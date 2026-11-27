// Translations. Polish is the source language: public/index.html is written in Polish and marked with
// data-i18n / data-i18n-attr keys; for other languages the worker swaps those texts in (HTMLRewriter),
// so every visitor gets a finished page in their language without any per-visit cost.
// Legal documents (Regulamin, Polityka prywatności) stay in Polish: that is the binding version.

export type Lang = "pl" | "uk" | "en";
export const LANGS: Lang[] = ["pl", "uk", "en"];
export const isLang = (l: unknown): l is Lang => typeof l === "string" && (LANGS as string[]).includes(l);

/** First supported language from an Accept-Language header. No header: Polish. Unsupported languages only: English. */
export function langFromHeader(header: string | null | undefined): Lang {
  if (!header) return "pl";
  const prefs = header.split(",").map((part) => {
    const [tag, ...params] = part.trim().toLowerCase().split(";");
    const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
    return { base: tag.split("-")[0], q: q ? Number(q.slice(2)) || 0 : 1 };
  }).filter((p) => p.base && p.q > 0).sort((a, b) => b.q - a.q);
  for (const p of prefs) if (isLang(p.base)) return p.base;
  return prefs.length ? "en" : "pl";
}

/** ?lang= beats the remembered choice (cookie), which beats the browser language. */
export function pickLang(query?: string | null, cookie?: string | null, accept?: string | null): Lang {
  if (isLang(query)) return query;
  if (isLang(cookie)) return cookie;
  return langFromHeader(accept);
}

export const HTML_LANG: Record<Lang, string> = { pl: "pl", uk: "uk", en: "en" };

// ---------------------------------------------------------------------------------------------
// Landing page (keys match data-i18n attributes in public/index.html). {price} is filled in.
// ---------------------------------------------------------------------------------------------
type Dict = Record<string, string>;

export const LANDING_META: Record<Lang, { title: string; desc: string; ogDesc: string }> = {
  pl: { title: "Kup dobrą pogodę ☀️ | KUP POGODĘ", desc: "Kup dobrą pogodę dla siebie lub kogoś wyjątkowego. Wybierz miejsce, datę i wymarzoną pogodę. Otrzymaj personalizowany certyfikat.", ogDesc: "Nie możesz kontrolować pogody. Ale możesz ją kupić. Personalizowany certyfikat dla siebie albo kogoś wyjątkowego." },
  uk: { title: "Купи гарну погоду ☀️ | KUP POGODĘ", desc: "Купи гарну погоду для себе чи для когось особливого. Обери місце, дату й омріяну погоду. Отримай іменний сертифікат.", ogDesc: "Ти не можеш керувати погодою. Але можеш її купити. Іменний сертифікат для себе або для когось особливого." },
  en: { title: "Buy good weather ☀️ | KUP POGODĘ", desc: "Buy good weather for yourself or someone special. Pick a place, a date and your dream weather. Get a personalised certificate.", ogDesc: "You can't control the weather. But you can buy it. A personalised certificate for you or someone special." },
};

const LANDING_UK: Dict = {
  cancelled: "Оплату скасовано. Твої дані залишилися у формі, можна спробувати ще раз.",
  "nav.main": `<a href="#jak">Як це працює</a><a href="#certyfikat">Сертифікат</a><a href="#gwarancja" data-guarantee>Гарантія</a><a href="#faq">Питання</a>`,
  "cta.now": "КУПИТИ",
  "cta.nowPrice": `КУПИТИ — <span data-price>{price}</span>`,
  "hero.h1": `<span>КУПИ</span><span>ГАРНУ</span><span><span class="sunword">ПОГОДУ</span></span>`,
  "hero.hook": "Ти не можеш керувати погодою.<br><b>Але можеш її купити.</b>",
  "hero.lead": "Обери місце, дату й погоду, про яку мрієш. Купи її для себе або подаруй комусь особливому.",
  "hero.guar": `☀️ <span>З <a href="#gwarancja">Гарантією Погоди</a></span>`,
  "hero.sampleAria": "Приклад сертифіката",
  "how.eyebrow": "Як це працює?",
  "how.h2": "Простіше, ніж замовити піцу.",
  "how.sub": "Тільки замість піци ти замовляєш погоду.",
  "how.steps": `<div class="step"><div class="n">01</div><h3>Обери</h3><p>Місце, дату й погоду, яку хочеш «купити».</p></div><div class="step"><div class="n">02</div><h3>Купи</h3><p>Додай побажання й оплати BLIK-ом або карткою. Це займе хвилину.</p></div><div class="step"><div class="n">03</div><h3>Подаруй</h3><p>Отримаєш гарний сертифікат, яким легко поділитися. На e-mail і одразу на екрані.</p></div>`,
  "order.eyebrow": "Твоє замовлення",
  "order.h2": "Купи свою погоду",
  "order.preview": `<span>Попередній перегляд</span><span class="tog"><span class="o">Показати</span><span class="c">Згорнути</span></span>`,
  "f.who": `<span class="k">1</span>Для кого?`,
  "f.whoAria": "Для кого",
  "f.someone": "Для когось",
  "f.me": "Для себе",
  "f.recipientPh": "Ім’я отримувача, напр. Аня",
  "f.recipientAria": "Ім’я отримувача",
  "f.recipientEmailPh": "E-mail отримувача (необов’язково)",
  "f.recipientEmailAria": "E-mail отримувача, необов’язково",
  "f.recipientHint": "Якщо вкажеш e-mail отримувача, ми надішлемо сертифікат і йому.",
  "f.place": `<span class="k">2</span>Де купуємо погоду?`,
  "f.placePh": "напр. Краків, Закопане, Львів, Барселона",
  "f.when": `<span class="k">3</span>На коли?`,
  "f.dateAria": "Дата",
  "f.weekend": "Ці вихідні",
  "f.week": "За тиждень",
  "f.otherDate": "Інша дата",
  "f.pickDate": "Обери дату",
  "f.temp": `<span class="k">4</span>Яку температуру замовляємо?`,
  "f.tempAria": "Температура",
  "f.own": "Своя",
  "f.ownPh": "напр. 24",
  "f.ownAria": "Своя температура в °C",
  "f.cond": `<span class="k">5</span>Якою має бути погода?`,
  "f.condAria": "Умови",
  "c.sun": "☀️ Сонце",
  "c.clouds": "⛅ Легкі хмарки",
  "c.norain": "☂️ Без дощу",
  "c.warm": "🌡️ Приємно тепло",
  "f.msg": `<span class="k">6</span>Додай побажання <span class="hint">(необов’язково)</span>`,
  "f.styleHint": "Обери характер, і побажання напишеться саме:",
  "f.styleAria": "Стиль побажання",
  "f.msgPh": "напр. «На наші ідеальні вихідні ❤️»",
  "f.aiBtn": "✨ Придумати нове",
  "f.from": `<span class="k">7</span>Від кого?`,
  "f.buyerPh": "Твоє ім’я",
  "f.emailPh": "Твій e-mail",
  "f.emailHint": "На цю адресу надішлемо сертифікат і підтвердження замовлення.",
  "f.terms": `<input type="checkbox" id="terms"><span>Приймаю <a href="/regulamin" target="_blank">Регламент</a> магазину та ознайомився(-лася) з <a href="/prywatnosc" target="_blank">Політикою конфіденційності</a> (польською мовою).</span>`,
  "f.instant": `<input type="checkbox" id="instant"><span>Хочу отримати сертифікат одразу й розумію, що після його отримання втрачаю право на відмову від договору. Гарантія Погоди діє незалежно від цього.</span>`,
  "f.buy": `КУПУЮ — <span data-price>{price}</span>`,
  "f.methods": "BLIK · картка · Apple Pay · Google Pay",
  "f.guar": `<div class="sunbadge" aria-hidden="true">☀</div><p><b>Гарантія Погоди</b><span class="g-b">Купив сонце, а прийшла злива? Подай рекламацію, і ми повернемо гроші.</span><span class="g-c">100% задоволення або повернення грошей.</span></p>`,
  "what.eyebrow": "Що саме ти купуєш?",
  "what.big": "Не будемо вдавати, що впливаємо на атмосферу. Не впливаємо.",
  "what.sub": "Ти купуєш дещо значно простіше: гарний іменний цифровий подарунок, що виглядає як дуже офіційний документ.",
  "what.list": "<li>місце</li><li>дату</li><li>омріяну температуру</li><li>обрані умови</li><li>ім’я отримувача</li><li>твоє побажання</li>",
  "what.cta": `КУПИТИ ГАРНУ ПОГОДУ — <span data-price>{price}</span>`,
  "what.hint": "Доступно одразу. Сертифікат надсилаємо на e-mail.",
  "g.eyebrow": "☀️ Гарантія Погоди",
  "g.h2": "Купив сонце, а прийшла злива?",
  "g.t": "Якщо замовлена погода не виправдала очікувань, можна попросити повернути гроші. Бо якщо погоду можна купити, вона має працювати.",
  "g.fine": `Правила повернення описано в <a href="/regulamin" target="_blank">Регламенті</a> (польською). Замовлення погоди має символічний і розважальний характер.`,
  "g.q": "Ми так не домовлялися.",
  "g.stamp": "Рекламацію прийнято",
  "occ.eyebrow": "Маленький подарунок. Великий ефект.",
  "occ.h2": "З якої нагоди купують погоду?",
  "occ.1": `<span class="e">❤️</span><b>На побачення</b><small>Сонце до першої кави</small>`,
  "occ.1.msg": "Бо ти заслуговуєш на ідеальний день ❤️",
  "occ.2": `<span class="e">🎂</span><b>На день народження</b><small>Подарунок, що нічого не важить</small>`,
  "occ.2.msg": "З днем народження! Погоду вже оплачено 🎂",
  "occ.3": `<span class="e">💍</span><b>На річницю</b><small>Без дощу, як і обіцяли</small>`,
  "occ.3.msg": "Ще один рік разом. Цього разу без дощу 💍",
  "occ.4": `<span class="e">✈️</span><b>Перед подорожжю</b><small>Відпустка з гарантією</small>`,
  "occ.4.msg": "Гарної подорожі! Погоду вже владнано ✈️",
  "occ.5": `<span class="e">🏖️</span><b>На вихідні</b><small>Два дні сонця</small>`,
  "occ.5.msg": "На наші ідеальні вихідні ☀️",
  "occ.6": `<span class="e">😂</span><b>Для жарту</b><small>Найкращий подарунок за 10 zł</small>`,
  "occ.6.msg": "Кажуть, гарну погоду не купиш. Вирішено перевірити.",
  "occ.7": `<span class="e">☀️</span><b>Бо можна</b><small>Нагода не потрібна</small>`,
  "occ.7.msg": "Просто тому, що можна ☀️",
  "occ.8": `<span class="e">🍀</span><b>На важливий день</b><small>Іспит, весілля, старт</small>`,
  "occ.8.msg": "Тримаю кулаки! Погода на твоєму боці 🍀",
  "occ.hint": "Натисни на нагоду, і ми впишемо готове побажання у форму.",
  faq: `<details><summary>Ви справді можете купити погоду?</summary><p>Ні. І саме в цьому вся ідея. KUP POGODĘ — це цифровий жартівливий подарунок. Це не прогноз погоди й не метеорологічна послуга.</p></details>
<details><summary>Що я отримаю?</summary><p>Іменний сертифікат «купівлі погоди»: сторінку з посиланням, яким можна поділитися, і файл PDF. Надсилаємо його на твій e-mail одразу після оплати.</p></details>
<details><summary>Чи можна купити погоду для когось?</summary><p>Звісно. Впиши ім’я отримувача й додай побажання. Якщо вкажеш його e-mail, надішлемо сертифікат і йому. Або перешли сам через WhatsApp, Telegram чи Messenger.</p></details>
<details><summary>Чи можна обрати будь-яку дату?</summary><p>Так, будь-який день від сьогодні й до трьох років наперед.</p></details>
<details><summary>Це прогноз погоди?</summary><p>Ні. Ми не перевіряємо прогнози й не передбачаємо реальних погодних умов. Сертифікат — це символічне замовлення омріяної погоди.</p></details>
<details><summary>А якщо я куплю сонце, а буде дощ?</summary><p>Ми так не домовлялися. Тому є Гарантія Погоди: подай рекламацію з номером замовлення, і ми повернемо гроші згідно з Регламентом.</p></details>`,
  "soon.eyebrow": "Незабаром у магазині",
  "soon.h2": "А якщо тобі не потрібне сонце?",
  "soon.list": "<span>🌧️ КУПИ ДОЩ<em>незабаром</em></span><span>❄️ КУПИ СНІГ<em>незабаром</em></span><span>🔥 КУПИ СПЕКУ<em>незабаром</em></span><span>😈 КУПИ ПОГАНУ ПОГОДУ ДЛЯ КОЛИШНЬОГО<em>незабаром</em></span>",
  "foot.p": "Ми не можемо змінити погоду. Але можемо гарно її запакувати.",
  "foot.nav": `<a href="#jak">Як це працює</a><a href="#gwarancja">Гарантія Погоди</a><a href="#faq">Питання</a><a href="/regulamin">Регламент (PL)</a><a href="/prywatnosc">Конфіденційність (PL)</a><a href="/kontakt">Контакти</a><a href="/reklamacja">Рекламація погоди</a>`,
  "foot.legal": "Замовлення / купівля погоди має символічний і розважальний характер. Це не прогноз погоди й не гарантія реальних погодних умов.",
};

const LANDING_EN: Dict = {
  cancelled: "Payment was cancelled. Your details are still in the form, so you can try again.",
  "nav.main": `<a href="#jak">How it works</a><a href="#certyfikat">Certificate</a><a href="#gwarancja" data-guarantee>Guarantee</a><a href="#faq">FAQ</a>`,
  "cta.now": "BUY NOW",
  "cta.nowPrice": `BUY NOW — <span data-price>{price}</span>`,
  "hero.h1": `<span>BUY</span><span>GOOD</span><span><span class="sunword">WEATHER</span></span>`,
  "hero.hook": "You can't control the weather.<br><b>But you can buy it.</b>",
  "hero.lead": "Pick a place, a date and the weather you dream of. Buy it for yourself or give it to someone special.",
  "hero.guar": `☀️ <span>With the <a href="#gwarancja">Weather Guarantee</a></span>`,
  "hero.sampleAria": "Sample certificate",
  "how.eyebrow": "How does it work?",
  "how.h2": "Easier than ordering pizza.",
  "how.sub": "Only instead of pizza, you order weather.",
  "how.steps": `<div class="step"><div class="n">01</div><h3>Choose</h3><p>The place, date and weather you want to “buy”.</p></div><div class="step"><div class="n">02</div><h3>Buy</h3><p>Add a message and pay with BLIK or a card. It takes a minute.</p></div><div class="step"><div class="n">03</div><h3>Give</h3><p>You get a beautiful certificate to share. By e-mail and right on your screen.</p></div>`,
  "order.eyebrow": "Your order",
  "order.h2": "Buy your weather",
  "order.preview": `<span>Certificate preview</span><span class="tog"><span class="o">Show</span><span class="c">Hide</span></span>`,
  "f.who": `<span class="k">1</span>Who is it for?`,
  "f.whoAria": "Who is it for",
  "f.someone": "Someone else",
  "f.me": "Me",
  "f.recipientPh": "Recipient's name, e.g. Anna",
  "f.recipientAria": "Recipient's name",
  "f.recipientEmailPh": "Recipient's e-mail (optional)",
  "f.recipientEmailAria": "Recipient's e-mail, optional",
  "f.recipientHint": "If you add the recipient's e-mail, we'll send them the certificate too.",
  "f.place": `<span class="k">2</span>Where do you want good weather?`,
  "f.placePh": "e.g. Kraków, Zakopane, Gdańsk, Barcelona",
  "f.when": `<span class="k">3</span>When?`,
  "f.dateAria": "Date",
  "f.weekend": "This weekend",
  "f.week": "In a week",
  "f.otherDate": "Other date",
  "f.pickDate": "Pick a date",
  "f.temp": `<span class="k">4</span>What temperature would you like?`,
  "f.tempAria": "Temperature",
  "f.own": "Custom",
  "f.ownPh": "e.g. 24",
  "f.ownAria": "Custom temperature in °C",
  "f.cond": `<span class="k">5</span>What should the weather be like?`,
  "f.condAria": "Conditions",
  "c.sun": "☀️ Sunshine",
  "c.clouds": "⛅ Light clouds",
  "c.norain": "☂️ No rain",
  "c.warm": "🌡️ Pleasantly warm",
  "f.msg": `<span class="k">6</span>Add a message <span class="hint">(optional)</span>`,
  "f.styleHint": "Pick a character and the message writes itself:",
  "f.styleAria": "Message style",
  "f.msgPh": "e.g. “For our perfect weekend ❤️”",
  "f.aiBtn": "✨ Write a new one",
  "f.from": `<span class="k">7</span>From whom?`,
  "f.buyerPh": "Your name",
  "f.emailPh": "Your e-mail",
  "f.emailHint": "We'll send the certificate and order confirmation to this address.",
  "f.terms": `<input type="checkbox" id="terms"><span>I accept the shop's <a href="/regulamin" target="_blank">Terms</a> and have read the <a href="/prywatnosc" target="_blank">Privacy Policy</a> (in Polish).</span>`,
  "f.instant": `<input type="checkbox" id="instant"><span>I want the certificate right away and understand that once it is delivered I lose the right to withdraw from the contract. The Weather Guarantee applies regardless.</span>`,
  "f.buy": `BUY — <span data-price>{price}</span>`,
  "f.methods": "BLIK · card · Apple Pay · Google Pay",
  "f.guar": `<div class="sunbadge" aria-hidden="true">☀</div><p><b>Weather Guarantee</b><span class="g-b">Bought sunshine but got a downpour? File a complaint and we'll refund you.</span><span class="g-c">100% satisfaction or your money back.</span></p>`,
  "what.eyebrow": "So what are you actually buying?",
  "what.big": "We won't pretend we can influence the atmosphere. We can't.",
  "what.sub": "You're buying something much simpler: a beautiful, personalised digital gift that looks like a very official document.",
  "what.list": "<li>place</li><li>date</li><li>dream temperature</li><li>chosen conditions</li><li>recipient's name</li><li>your message</li>",
  "what.cta": `BUY GOOD WEATHER — <span data-price>{price}</span>`,
  "what.hint": "Available instantly. We send the certificate by e-mail.",
  "g.eyebrow": "☀️ Weather Guarantee",
  "g.h2": "Bought sunshine but got a downpour?",
  "g.t": "If the weather you ordered doesn't live up to expectations, you can ask for your money back. If weather can be bought, it should work.",
  "g.fine": `Refund rules are set out in the <a href="/regulamin" target="_blank">Terms</a> (in Polish). Ordering weather is symbolic and just for fun.`,
  "g.q": "That's not what we agreed.",
  "g.stamp": "Complaint accepted",
  "occ.eyebrow": "Small gift. Big effect.",
  "occ.h2": "What's the occasion for buying weather?",
  "occ.1": `<span class="e">❤️</span><b>A date</b><small>Sunshine for the first coffee</small>`,
  "occ.1.msg": "Because you deserve a perfect day ❤️",
  "occ.2": `<span class="e">🎂</span><b>A birthday</b><small>A gift that weighs nothing</small>`,
  "occ.2.msg": "Happy birthday! The weather is already paid for 🎂",
  "occ.3": `<span class="e">💍</span><b>An anniversary</b><small>No rain, as promised</small>`,
  "occ.3.msg": "Another year together. No rain this time 💍",
  "occ.4": `<span class="e">✈️</span><b>Before a trip</b><small>A holiday with a guarantee</small>`,
  "occ.4.msg": "Have a great trip! The weather is sorted ✈️",
  "occ.5": `<span class="e">🏖️</span><b>The weekend</b><small>Two days of sunshine</small>`,
  "occ.5.msg": "For our perfect weekend ☀️",
  "occ.6": `<span class="e">😂</span><b>As a joke</b><small>The best gift for 10 zł</small>`,
  "occ.6.msg": "They say you can't buy good weather. Time to find out.",
  "occ.7": `<span class="e">☀️</span><b>Just because</b><small>No occasion needed</small>`,
  "occ.7.msg": "Simply because you can ☀️",
  "occ.8": `<span class="e">🍀</span><b>A big day</b><small>Exam, wedding, new start</small>`,
  "occ.8.msg": "Fingers crossed! The weather is on your side 🍀",
  "occ.hint": "Tap an occasion and we'll put a ready-made message into the form.",
  faq: `<details><summary>Can you really buy weather?</summary><p>No. And that's the whole idea. KUP POGODĘ is a humorous digital gift. It is not a weather forecast or a meteorological service.</p></details>
<details><summary>What will I get?</summary><p>A personalised “weather purchase” certificate: a page with a link to share and a PDF file. We e-mail it to you right after payment.</p></details>
<details><summary>Can I buy weather for someone else?</summary><p>Of course. Enter the recipient's name and add a message. If you give their e-mail, we'll send them the certificate too. Or share it yourself via WhatsApp or Messenger.</p></details>
<details><summary>Can I choose any date?</summary><p>Yes, any day from today up to three years ahead.</p></details>
<details><summary>Is this a weather forecast?</summary><p>No. We don't check forecasts or predict actual weather. The certificate is a symbolic order for your dream weather.</p></details>
<details><summary>What if I buy sunshine and it rains?</summary><p>That's not what we agreed. That's why there's the Weather Guarantee: file a complaint with your order number and we'll refund you according to the Terms.</p></details>`,
  "soon.eyebrow": "Coming soon",
  "soon.h2": "What if you don't want sunshine?",
  "soon.list": "<span>🌧️ BUY RAIN<em>soon</em></span><span>❄️ BUY SNOW<em>soon</em></span><span>🔥 BUY A HEATWAVE<em>soon</em></span><span>😈 BUY BAD WEATHER FOR YOUR EX<em>soon</em></span>",
  "foot.p": "We can't change the weather. But we can wrap it beautifully.",
  "foot.nav": `<a href="#jak">How it works</a><a href="#gwarancja">Weather Guarantee</a><a href="#faq">FAQ</a><a href="/regulamin">Terms (PL)</a><a href="/prywatnosc">Privacy (PL)</a><a href="/kontakt">Contact</a><a href="/reklamacja">Weather complaint</a>`,
  "foot.legal": "Ordering / buying weather is symbolic and just for fun. It is not a weather forecast or a guarantee of actual weather conditions.",
};

export const LANDING: Partial<Record<Lang, Dict>> = { uk: LANDING_UK, en: LANDING_EN };

// ---------------------------------------------------------------------------------------------
// Strings used by the landing page's script (validation, preview, greeting buttons).
// ---------------------------------------------------------------------------------------------
export const CLIENT: Record<Lang, Dict> = {
  pl: {
    fill: "Uzupełnij: ", check: "Sprawdź: ", opening: "Otwieramy płatność…", genericErr: "Coś poszło nie tak. Spróbuj ponownie.", offline: "Brak połączenia. Spróbuj ponownie.",
    "v.recipient": "imię odbiorcy", "v.recipientEmail": "poprawny e-mail odbiorcy", "v.place": "miejsce", "v.date": "datę", "v.temp": "temperaturę", "v.conditions": "rodzaj pogody", "v.buyer": "swoje imię", "v.email": "poprawny e-mail", "v.terms": "akceptację Regulaminu", "v.instant": "zgodę na natychmiastowe dostarczenie",
    "p.you": "Ty", "p.recipient": "Imię odbiorcy", "p.place": "Twoje miejsce", "p.date": "wybierz datę", "p.buyer": "Twoje imię",
    "s.recipient": "Ania", "s.place": "Kraków", "s.message": "Bo podobno nie można kupić dobrej pogody. Postanowiłem sprawdzić.", "s.buyer": "Łukasz",
    writing: "✨ Piszę…", aiFallback: "Generator jest teraz zajęty, więc podstawiliśmy gotowe życzenia.",
  },
  uk: {
    fill: "Заповни: ", check: "Перевір: ", opening: "Відкриваємо оплату…", genericErr: "Щось пішло не так. Спробуй ще раз.", offline: "Немає з’єднання. Спробуй ще раз.",
    "v.recipient": "ім’я отримувача", "v.recipientEmail": "правильний e-mail отримувача", "v.place": "місце", "v.date": "дату", "v.temp": "температуру", "v.conditions": "тип погоди", "v.buyer": "своє ім’я", "v.email": "правильний e-mail", "v.terms": "згоду з Регламентом", "v.instant": "згоду на негайне отримання",
    "p.you": "Ти", "p.recipient": "Ім’я отримувача", "p.place": "Твоє місце", "p.date": "обери дату", "p.buyer": "Твоє ім’я",
    "s.recipient": "Аня", "s.place": "Львів", "s.message": "Кажуть, гарну погоду не купиш. Вирішено перевірити.", "s.buyer": "Богдан",
    writing: "✨ Пишу…", aiFallback: "Генератор зараз зайнятий, тому ми підставили готове побажання.",
  },
  en: {
    fill: "Please add: ", check: "Please check: ", opening: "Opening payment…", genericErr: "Something went wrong. Please try again.", offline: "No connection. Please try again.",
    "v.recipient": "recipient's name", "v.recipientEmail": "a valid recipient e-mail", "v.place": "place", "v.date": "date", "v.temp": "temperature", "v.conditions": "type of weather", "v.buyer": "your name", "v.email": "a valid e-mail", "v.terms": "acceptance of the Terms", "v.instant": "consent to instant delivery",
    "p.you": "You", "p.recipient": "Recipient's name", "p.place": "Your place", "p.date": "pick a date", "p.buyer": "Your name",
    "s.recipient": "Anna", "s.place": "Kraków", "s.message": "They say you can't buy good weather. Time to find out.", "s.buyer": "Luke",
    writing: "✨ Writing…", aiFallback: "The generator is busy right now, so here's a ready-made message.",
  },
};

// ---------------------------------------------------------------------------------------------
// Server-rendered pages, e-mails and API messages.
// ---------------------------------------------------------------------------------------------
const PL = {
  footer: `Zamówienie pogody ma charakter symboliczny i rozrywkowy. Nie jest prognozą pogody. · <a href="/regulamin">Regulamin</a> · <a href="/prywatnosc">Polityka prywatności</a>`,
  waitTitle: "Czekamy na potwierdzenie płatności", waitH1: "Sprawdzamy płatność…",
  waitText: "Operator płatności jeszcze nie potwierdził zamówienia {order}. Zwykle trwa to kilka sekund. Ta strona odświeży się sama.",
  waitNote: "Jeśli płacisz BLIK-iem, potwierdź płatność w aplikacji banku. Certyfikat wyślemy też na {email}.",
  okTitle: "Pogoda została zamówiona! ☀️", okSub: "Oficjalnie. Przynajmniej na papierze.",
  kOrder: "Numer zamówienia", kFor: "Dla", kPlace: "Miejsce", kDate: "Data", kWeather: "Pogoda", kTemp: "Temperatura",
  send: "WYŚLIJ CERTYFIKAT", pdf: "POBIERZ PDF", show: "POKAŻ CERTYFIKAT", resend: "WYŚLIJ PONOWNIE E-MAIL",
  sentTo: "Certyfikat wysłaliśmy na {emails}.", and: " i ",
  shareTitle: "Kupiłem Ci dobrą pogodę ☀️", copied: "Link skopiowany ✓", copyPrompt: "Skopiuj link:",
  certTitle: "Certyfikat zakupu pogody · {name}", ogTitle: "{name}, ktoś kupił Ci dobrą pogodę ☀️", ogDesc: "{place}, {date}. Oficjalny certyfikat KUP POGODĘ.",
  certH1: "{name}, masz dobrą pogodę ☀️", certSub: "{buyer} oficjalnie zamówił(a) ją dla Ciebie. {place}, {date}.",
  share: "UDOSTĘPNIJ", alsoBuy: `Też chcesz komuś kupić pogodę? <a href="/">Kup dobrą pogodę</a>.`, complain: `Pogoda nie dotrzymała umowy? <a href="/reklamacja?o={order}">Zgłoś reklamację</a>.`,
  rTitle: "Reklamacja zamówionej pogody", rSub: "Zamówiłeś słońce, a była ulewa? Nie tak się umawialiśmy. Opisz krótko, co poszło nie tak.",
  rOrder: "Numer zamówienia", rEmail: "E-mail użyty przy zamówieniu", rWhat: "Co się stało?", rWhatPh: "np. „Zamówiłem słońce. Była ulewa.”", rSend: "WYŚLIJ REKLAMACJĘ",
  rNote: `Zasady Gwarancji Pogody: reklamację można zgłosić od zamówionej daty do 14 dni po niej. Szczegóły w <a href="/regulamin">Regulaminie</a>.`, rOffline: "Nie udało się wysłać. Sprawdź połączenie i spróbuj ponownie.",
  nfTitle: "Nie znaleziono", nfH1: "Tej pogody tu nie ma.", nfText: `Link jest niepełny albo zamówienie nie istnieje. <a href="/">Wróć na stronę główną</a>.`, back: "Wróć",
  limitTitle: "Limit wysyłek", limitText: "Wysłaliśmy już ten certyfikat kilka razy. Sprawdź folder spam albo napisz do nas.", resentTitle: "Wysłane ✓", resentText: "Certyfikat poszedł ponownie na {email}.",
  // API
  payOff: "Płatności nie są jeszcze włączone. Wróć do nas wkrótce.", checkForm: "Sprawdź formularz.", tryLater: "Spróbuj ponownie za chwilę.", payFail: "Nie udało się otworzyć płatności. Spróbuj ponownie za chwilę.",
  refBad: "Sprawdź numer zamówienia (KPG-XXXXXX), e-mail i opis.", refNotFound: "Nie znaleźliśmy zamówienia o tym numerze i e-mailu.", refDup: "Reklamacja tego zamówienia została już zgłoszona.",
  refAuto: "Przyjęliśmy reklamację. Pogoda nie dotrzymała umowy, więc zwracamy pieniądze. Zwykle trafiają na konto w ciągu 5–10 dni roboczych.",
  refReview: "Przyjęliśmy reklamację. Sprawdzimy Twoje zamówienie i wrócimy do Ciebie zgodnie z zasadami określonymi w Regulaminie.",
  refUnpaid: "To zamówienie nie zostało opłacone, więc nie ma czego zwracać.", refTooEarly: "Reklamację można zgłosić od zamówionego dnia ({date}). Trzymamy kciuki za pogodę!", refTooLate: "Minęło już 14 dni od zamówionego dnia, więc termin Gwarancji Pogody upłynął.", refDone: "Reklamacja tego zamówienia została już rozpatrzona.",
  // e-mails
  mDisclaimer: "Zamówienie pogody ma charakter symboliczny i rozrywkowy. Nie jest prognozą pogody ani gwarancją rzeczywistych warunków atmosferycznych.",
  mPlace: "📍 Miejsce", mDate: "📅 Data", mWeather: "☀️ Pogoda", mTemp: "🌡️ Temperatura", mOrder: "Nr zamówienia",
  mBuyerSubject: "☀️ Twoja dobra pogoda została zamówiona!", mBuyerH1: "Twoja dobra pogoda została zamówiona!",
  mBuyerHello: "Cześć {buyer}! Pogoda{forWho} została właśnie zamówiona.", mForWho: " dla: <b>{name}</b>",
  mBuyerReady: "Twój certyfikat jest gotowy. Możesz go zachować albo podarować komuś wyjątkowemu.", mSee: "ZOBACZ CERTYFIKAT",
  mWaiver: "Potwierdzenie: na Twoje wyraźne żądanie certyfikat (treść cyfrowa) został dostarczony przed upływem terminu do odstąpienia od umowy, a Ty przyjąłeś(-ęłaś) do wiadomości utratę prawa odstąpienia. Gwarancja Pogody obowiązuje niezależnie.",
  mTerms: "Regulamin", mComplain: "Kupiłeś słońce, a przyszła ulewa?", mComplainLink: "Zgłoś reklamację pogody", mCertLine: "Certyfikat",
  mRcptSubject: "☀️ {buyer} kupił(a) Ci dobrą pogodę", mRcptH1: "{name}, ktoś kupił Ci dobrą pogodę ☀️", mRcptText: "<b>{buyer}</b> zamówił(a) dla Ciebie pogodę. Oficjalnie. Przynajmniej na papierze.", mRcptSee: "ZOBACZ SWÓJ CERTYFIKAT",
  mRefSubject: "Reklamacja pogody uznana ☔", mRefH1: "Reklamacja uznana. Pieniądze wracają.", mRefText: "Pogoda nie dotrzymała umowy, więc my dotrzymujemy swojej. Zwrot za zamówienie {order} jest w drodze. Zwykle trafia na konto w ciągu 5–10 dni roboczych.",
  productName: "KUP DOBRĄ POGODĘ — certyfikat", pdfName: "certyfikat-pogody",
};
type Strings = typeof PL;

const UK: Strings = {
  footer: `Замовлення погоди має символічний і розважальний характер. Це не прогноз погоди. · <a href="/regulamin">Регламент (PL)</a> · <a href="/prywatnosc">Конфіденційність (PL)</a>`,
  waitTitle: "Чекаємо на підтвердження оплати", waitH1: "Перевіряємо оплату…",
  waitText: "Платіжний оператор ще не підтвердив замовлення {order}. Зазвичай це займає кілька секунд. Сторінка оновиться сама.",
  waitNote: "Якщо платиш BLIK-ом, підтверди оплату в застосунку банку. Сертифікат також надішлемо на {email}.",
  okTitle: "Погоду замовлено! ☀️", okSub: "Офіційно. Принаймні на папері.",
  kOrder: "Номер замовлення", kFor: "Для", kPlace: "Місце", kDate: "Дата", kWeather: "Погода", kTemp: "Температура",
  send: "НАДІСЛАТИ СЕРТИФІКАТ", pdf: "ЗАВАНТАЖИТИ PDF", show: "ПОКАЗАТИ СЕРТИФІКАТ", resend: "НАДІСЛАТИ E-MAIL ЩЕ РАЗ",
  sentTo: "Сертифікат надіслано на {emails}.", and: " і ",
  shareTitle: "Я купив(ла) тобі гарну погоду ☀️", copied: "Посилання скопійовано ✓", copyPrompt: "Скопіюй посилання:",
  certTitle: "Сертифікат купівлі погоди · {name}", ogTitle: "{name}, хтось купив тобі гарну погоду ☀️", ogDesc: "{place}, {date}. Офіційний сертифікат KUP POGODĘ.",
  certH1: "{name}, у тебе гарна погода ☀️", certSub: "{buyer} офіційно замовив(ла) її для тебе. {place}, {date}.",
  share: "ПОДІЛИТИСЯ", alsoBuy: `Теж хочеш купити комусь погоду? <a href="/">Купи гарну погоду</a>.`, complain: `Погода не дотримала угоди? <a href="/reklamacja?o={order}">Подай рекламацію</a>.`,
  rTitle: "Рекламація замовленої погоди", rSub: "Замовили сонце, а була злива? Ми так не домовлялися. Коротко опиши, що пішло не так.",
  rOrder: "Номер замовлення", rEmail: "E-mail, вказаний у замовленні", rWhat: "Що сталося?", rWhatPh: "напр. «Замовляли сонце. Була злива.»", rSend: "НАДІСЛАТИ РЕКЛАМАЦІЮ",
  rNote: `Правила Гарантії Погоди: рекламацію можна подати від замовленої дати до 14 днів після неї. Деталі в <a href="/regulamin">Регламенті</a> (польською).`, rOffline: "Не вдалося надіслати. Перевір з’єднання й спробуй ще раз.",
  nfTitle: "Не знайдено", nfH1: "Цієї погоди тут немає.", nfText: `Посилання неповне або замовлення не існує. <a href="/">Повернутися на головну</a>.`, back: "Назад",
  limitTitle: "Ліміт надсилань", limitText: "Ми вже кілька разів надіслали цей сертифікат. Перевір папку «Спам» або напиши нам.", resentTitle: "Надіслано ✓", resentText: "Сертифікат знову надіслано на {email}.",
  payOff: "Оплату ще не ввімкнено. Повертайся незабаром.", checkForm: "Перевір форму.", tryLater: "Спробуй ще раз за хвилину.", payFail: "Не вдалося відкрити оплату. Спробуй ще раз за хвилину.",
  refBad: "Перевір номер замовлення (KPG-XXXXXX), e-mail і опис.", refNotFound: "Не знайшли замовлення з таким номером і e-mail.", refDup: "Рекламацію на це замовлення вже подано.",
  refAuto: "Рекламацію прийнято. Погода не дотримала угоди, тож ми повертаємо гроші. Зазвичай вони надходять на рахунок протягом 5–10 робочих днів.",
  refReview: "Рекламацію прийнято. Ми перевіримо замовлення й відповімо згідно з правилами Регламенту.",
  refUnpaid: "Це замовлення не було оплачене, тож повертати нічого.", refTooEarly: "Рекламацію можна подати починаючи із замовленого дня ({date}). Тримаємо кулаки за погоду!", refTooLate: "Минуло вже 14 днів від замовленого дня, тож строк Гарантії Погоди сплив.", refDone: "Рекламацію на це замовлення вже розглянуто.",
  mDisclaimer: "Замовлення погоди має символічний і розважальний характер. Це не прогноз погоди й не гарантія реальних погодних умов.",
  mPlace: "📍 Місце", mDate: "📅 Дата", mWeather: "☀️ Погода", mTemp: "🌡️ Температура", mOrder: "№ замовлення",
  mBuyerSubject: "☀️ Твою гарну погоду замовлено!", mBuyerH1: "Твою гарну погоду замовлено!",
  mBuyerHello: "Привіт, {buyer}! Погоду{forWho} щойно замовлено.", mForWho: " для: <b>{name}</b>",
  mBuyerReady: "Твій сертифікат готовий. Можна залишити його собі або подарувати комусь особливому.", mSee: "ПЕРЕГЛЯНУТИ СЕРТИФІКАТ",
  mWaiver: "Підтвердження: на твій прямий запит сертифікат (цифровий вміст) надано до спливу строку відмови від договору, і ти підтвердив(ла), що втрачаєш право на відмову. Гарантія Погоди діє незалежно від цього.",
  mTerms: "Регламент", mComplain: "Купив сонце, а прийшла злива?", mComplainLink: "Подати рекламацію погоди", mCertLine: "Сертифікат",
  mRcptSubject: "☀️ {buyer} купив(ла) тобі гарну погоду", mRcptH1: "{name}, хтось купив тобі гарну погоду ☀️", mRcptText: "<b>{buyer}</b> замовив(ла) для тебе погоду. Офіційно. Принаймні на папері.", mRcptSee: "ПЕРЕГЛЯНУТИ СВІЙ СЕРТИФІКАТ",
  mRefSubject: "Рекламацію погоди задоволено ☔", mRefH1: "Рекламацію задоволено. Гроші повертаються.", mRefText: "Погода не дотримала угоди, а ми дотримуємо своєї. Повернення за замовлення {order} уже в дорозі. Зазвичай гроші надходять протягом 5–10 робочих днів.",
  productName: "KUP POGODĘ — сертифікат гарної погоди", pdfName: "sertyfikat-pogody",
};

const EN: Strings = {
  footer: `Ordering weather is symbolic and just for fun. It is not a weather forecast. · <a href="/regulamin">Terms (PL)</a> · <a href="/prywatnosc">Privacy (PL)</a>`,
  waitTitle: "Waiting for payment confirmation", waitH1: "Checking your payment…",
  waitText: "The payment provider hasn't confirmed order {order} yet. This usually takes a few seconds. This page will refresh by itself.",
  waitNote: "If you're paying with BLIK, confirm the payment in your banking app. We'll also send the certificate to {email}.",
  okTitle: "Your weather is ordered! ☀️", okSub: "Officially. At least on paper.",
  kOrder: "Order number", kFor: "For", kPlace: "Place", kDate: "Date", kWeather: "Weather", kTemp: "Temperature",
  send: "SEND CERTIFICATE", pdf: "DOWNLOAD PDF", show: "SHOW CERTIFICATE", resend: "RESEND E-MAIL",
  sentTo: "We sent the certificate to {emails}.", and: " and ",
  shareTitle: "I bought you good weather ☀️", copied: "Link copied ✓", copyPrompt: "Copy the link:",
  certTitle: "Weather purchase certificate · {name}", ogTitle: "{name}, someone bought you good weather ☀️", ogDesc: "{place}, {date}. An official KUP POGODĘ certificate.",
  certH1: "{name}, you've got good weather ☀️", certSub: "{buyer} officially ordered it for you. {place}, {date}.",
  share: "SHARE", alsoBuy: `Want to buy someone weather too? <a href="/">Buy good weather</a>.`, complain: `The weather didn't keep its side of the deal? <a href="/reklamacja?o={order}">File a complaint</a>.`,
  rTitle: "Weather complaint", rSub: "Ordered sunshine and got a downpour? That's not what we agreed. Tell us briefly what went wrong.",
  rOrder: "Order number", rEmail: "E-mail used for the order", rWhat: "What happened?", rWhatPh: "e.g. “Ordered sunshine. Got a downpour.”", rSend: "SEND COMPLAINT",
  rNote: `Weather Guarantee rules: you can file a complaint from the ordered date up to 14 days after it. Details in the <a href="/regulamin">Terms</a> (in Polish).`, rOffline: "Couldn't send. Check your connection and try again.",
  nfTitle: "Not found", nfH1: "This weather isn't here.", nfText: `The link is incomplete or the order doesn't exist. <a href="/">Back to the home page</a>.`, back: "Back",
  limitTitle: "Sending limit", limitText: "We've already sent this certificate several times. Check your spam folder or write to us.", resentTitle: "Sent ✓", resentText: "The certificate was sent again to {email}.",
  payOff: "Payments aren't switched on yet. Come back soon.", checkForm: "Please check the form.", tryLater: "Please try again in a moment.", payFail: "Couldn't open the payment. Please try again in a moment.",
  refBad: "Check the order number (KPG-XXXXXX), e-mail and description.", refNotFound: "We couldn't find an order with this number and e-mail.", refDup: "A complaint for this order has already been filed.",
  refAuto: "Complaint accepted. The weather didn't keep its side of the deal, so we're refunding you. The money usually arrives within 5–10 business days.",
  refReview: "Complaint received. We'll check your order and get back to you according to the Terms.",
  refUnpaid: "This order wasn't paid, so there's nothing to refund.", refTooEarly: "You can file a complaint from the ordered day ({date}). Fingers crossed for the weather!", refTooLate: "More than 14 days have passed since the ordered day, so the Weather Guarantee has expired.", refDone: "The complaint for this order has already been handled.",
  mDisclaimer: "Ordering weather is symbolic and just for fun. It is not a weather forecast or a guarantee of actual weather conditions.",
  mPlace: "📍 Place", mDate: "📅 Date", mWeather: "☀️ Weather", mTemp: "🌡️ Temperature", mOrder: "Order no.",
  mBuyerSubject: "☀️ Your good weather is ordered!", mBuyerH1: "Your good weather is ordered!",
  mBuyerHello: "Hi {buyer}! The weather{forWho} has just been ordered.", mForWho: " for <b>{name}</b>",
  mBuyerReady: "Your certificate is ready. Keep it or give it to someone special.", mSee: "VIEW CERTIFICATE",
  mWaiver: "Confirmation: at your express request, the certificate (digital content) was delivered before the withdrawal period ended, and you acknowledged losing the right of withdrawal. The Weather Guarantee applies regardless.",
  mTerms: "Terms", mComplain: "Bought sunshine but got a downpour?", mComplainLink: "File a weather complaint", mCertLine: "Certificate",
  mRcptSubject: "☀️ {buyer} bought you good weather", mRcptH1: "{name}, someone bought you good weather ☀️", mRcptText: "<b>{buyer}</b> ordered weather for you. Officially. At least on paper.", mRcptSee: "VIEW YOUR CERTIFICATE",
  mRefSubject: "Weather complaint accepted ☔", mRefH1: "Complaint accepted. Your money is on its way back.", mRefText: "The weather didn't keep its side of the deal, so we're keeping ours. The refund for order {order} is on its way. It usually arrives within 5–10 business days.",
  productName: "KUP POGODĘ — good weather certificate", pdfName: "weather-certificate",
};

const STRINGS: Record<Lang, Strings> = { pl: PL, uk: UK, en: EN };

/** Text for a key, with {placeholders} filled in. Values are inserted as given: escape them first when they go into HTML. */
export function t(lang: string | null | undefined, key: keyof Strings, vars: Record<string, string> = {}): string {
  const s = (STRINGS[isLang(lang) ? lang : "pl"] ?? PL)[key] ?? PL[key];
  return s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
}
