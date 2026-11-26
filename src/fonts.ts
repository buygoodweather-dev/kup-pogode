// Font files are bundled into the worker as binary data (see "rules" in wrangler.jsonc).
import serif from "../assets/fonts/CG-600.sub.ttf";
import serifBold from "../assets/fonts/CG-700.sub.ttf";
import serifItalic from "../assets/fonts/CG-500i.sub.ttf";
import sans from "../assets/fonts/MR-500.sub.ttf";
import sansBold from "../assets/fonts/MR-700.sub.ttf";
import script from "../assets/fonts/PS.sub.ttf";
import type { CertFonts } from "./pdf";

export const FONTS: CertFonts = { serif, serifBold, serifItalic, sans, sansBold, script };
