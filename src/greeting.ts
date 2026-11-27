import type { Env } from "./env";
import { STYLES, pickGreeting } from "../public/greetings.js";
import { MESSAGE_MAX } from "../public/cert.js";
import type { Lang } from "./i18n";

const LANG_NAME: Record<Lang, string> = { pl: "Polish", uk: "Ukrainian", en: "English" };
export const DEFAULT_AI_MODEL = "@cf/google/gemma-3-12b-it";
// Keep well inside the Workers AI free allowance (10,000 neurons a day; one greeting costs roughly 10-15).
export const AI_PER_VISITOR_PER_HOUR = 15;
export const AI_PER_DAY = 500;

/** Tidy a model answer into one short greeting, or "" if it is unusable. */
export function cleanGreeting(raw: string): string {
  let s = String(raw ?? "").replace(/\r/g, "").trim();
  s = s.split("\n").map((l) => l.trim()).find((l) => l && !/^(here|oto|ось|greeting|życzenia|побажання)\b.*:$/i.test(l)) ?? "";
  s = s.replace(/^[\s"'„“”«»*_-]+|[\s"'„“”«»*_]+$/g, "").replace(/\s+/g, " ").trim();
  if (s.length > MESSAGE_MAX) {
    const cut = s.slice(0, MESSAGE_MAX);
    const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
    s = end > 40 ? cut.slice(0, end + 1) : cut.slice(0, MESSAGE_MAX - 1).replace(/\s+\S*$/, "") + "…";
  }
  if (s.length < 12 || /https?:|www\.|<|>|\{|\}/i.test(s)) return "";
  return s;
}

export function greetingPrompt(style: string, lang: Lang, recipient: string, place: string) {
  const persona = STYLES.find((s) => s.key === style)?.brief ?? "a warm friend";
  const system = [
    `You write one short greeting for a humorous gift certificate saying that someone has "bought good weather" for the recipient.`,
    `Write in ${LANG_NAME[lang]} only, informal "you" (ty/ти).`,
    `Voice: ${persona}.`,
    `Rules: 60 to 140 characters; one or two sentences; at most one emoji; no hashtags, no quotation marks, no title, no explanation.`,
    `Keep it kind and tasteful: nothing sexual, vulgar, political, religious or insulting.`,
    `The buyer's gender is unknown: do not use first-person past-tense verb forms that show gender (Polish -łem/-łam, Ukrainian -в/-ла).`,
    `Answer with the greeting text only.`,
  ].join(" ");
  const facts = [recipient && `Recipient's first name: ${recipient}.`, place && `Place: ${place}.`].filter(Boolean).join(" ");
  const user = `${facts} Write a new, original greeting in this voice. Be witty and surprising.`.trim();
  return { system, user };
}

/**
 * A greeting from Workers AI, or a ready-made one when the AI is not configured, over its limit or fails.
 * Never throws: the visitor always gets text.
 */
export async function makeGreeting(env: Env, input: { style: string; lang: Lang; recipient: string; place: string; current: string }, allowAi: boolean): Promise<{ text: string; source: "ai" | "template" }> {
  const fallback = () => ({ text: pickGreeting(input.lang, input.style, input.current), source: "template" as const });
  if (!env.AI || !allowAi) return fallback();
  try {
    const { system, user } = greetingPrompt(input.style, input.lang, input.recipient, input.place);
    const run = env.AI.run((env.AI_MODEL || DEFAULT_AI_MODEL) as Parameters<Ai["run"]>[0], {
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      max_tokens: 120,
      temperature: 0.95,
    } as never) as Promise<{ response?: string }>;
    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("AI timeout")), 8000));
    const out = await Promise.race([run, timeout]);
    const text = cleanGreeting(out?.response ?? "");
    if (!text || text === input.current) return fallback();
    return { text, source: "ai" };
  } catch (e) {
    console.error("greeting AI failed", e);
    return fallback();
  }
}
