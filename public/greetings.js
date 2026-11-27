// Greeting styles ("characters") and ready-made greetings for the certificate message.
// Shared by the browser (instant suggestions) and the worker (fallback when the AI is unavailable).
// Rule for every text: no gendered first-person past tense (the buyer can be anyone), at most 160 characters.

export const STYLES = [
  { key: "intellectual", emoji: "🎓", label: { pl: "Intelektualista", uk: "Інтелігент", en: "Intellectual" }, brief: "an erudite intellectual: dry wit, a light scientific or philosophical reference" },
  { key: "diplomat", emoji: "🤝", label: { pl: "Dyplomata", uk: "Дипломат", en: "Diplomat" }, brief: "a diplomat: formal, courteous, speaks of negotiations and agreements with the atmosphere" },
  { key: "charmer", emoji: "😏", label: { pl: "Bawidamek", uk: "Розпусник", en: "Flirt" }, brief: "a cheeky charmer: playful, flirty compliments, a wink, but always tasteful and never sexual or vulgar" },
  { key: "poet", emoji: "🪶", label: { pl: "Poeta", uk: "Поет", en: "Poet" }, brief: "a romantic poet: lyrical, tender imagery of sun, sky and light" },
  { key: "bureaucrat", emoji: "📎", label: { pl: "Urzędnik", uk: "Бюрократ", en: "Bureaucrat" }, brief: "a pompous bureaucrat: official office jargon, decisions, applications and stamps, deadpan" },
  { key: "grandma", emoji: "👵", label: { pl: "Babcia", uk: "Бабуся", en: "Grandma" }, brief: "a caring grandmother: warm, fussy advice about jackets and eating well" },
  { key: "forecaster", emoji: "📺", label: { pl: "Synoptyk", uk: "Синоптик", en: "Weatherman" }, brief: "a TV weather presenter: forecast jargon applied to happiness and mood" },
];
export const STYLE_KEYS = STYLES.map((s) => s.key);

export const GREETINGS = {
  pl: {
    intellectual: [
      "Kant zachwycał się niebem gwiaździstym nade mną. Ja dorzucam jeszcze bezchmurne. Korzystaj.",
      "Empirycznie nie da się kupić pogody. Teoretycznie właśnie się udało. Resztę zostawiam Twojemu optymizmowi.",
      "Słońce to gwiazda typu G2V. Ta konkretna świeci dziś wyłącznie dla Ciebie.",
    ],
    diplomat: [
      "Po długich negocjacjach z atmosferą osiągnięto porozumienie: słońce dla Ciebie, chmury gdzie indziej.",
      "W imieniu wszystkich zainteresowanych stron mam zaszczyt przekazać Ci dobrą pogodę. Bez zobowiązań, z sympatią.",
      "Front atmosferyczny zgodził się na rozejm. Warunki pokoju: słońce, ciepło i Twój uśmiech.",
    ],
    charmer: [
      "Słońce i tak by wyszło. Chciało tylko zobaczyć, jak się uśmiechasz.",
      "Ciepło, słonecznie i bez deszczu. Gorąco zrobi się dopiero, kiedy się uśmiechniesz 😉",
      "Nawet pogoda chce przy Tobie dobrze wyglądać. Dlatego się postarała ☀️",
    ],
    poet: [
      "Niech słońce tańczy na Twoich rzęsach, a wiatr szepcze tylko dobre wieści.",
      "Na jeden dzień niebo należy do Ciebie. Rozporządzaj nim z czułością.",
      "Złote światło, błękit bez skazy i ciepło jak pierwsza poranna kawa. Tylko dla Ciebie.",
    ],
    bureaucrat: [
      "Na podstawie złożonego wniosku przydziela się dobrą pogodę w wymiarze jednego dnia. Odwołanie nie przysługuje.",
      "Niniejszym informujemy, że deszcz otrzymał decyzję odmowną. Sprawę uznaje się za załatwioną pozytywnie.",
      "Pogodę wydano za potwierdzeniem odbioru. Korzystać zgodnie z przeznaczeniem: z uśmiechem.",
    ],
    grandma: [
      "Ubierz się ciepło, ale nie za ciepło, bo będzie słońce. Już załatwiłam. I zjedz coś!",
      "Kochanie, pogoda zamówiona, więc parasol zostaw w domu. Ale sweterek weź, tak na wszelki wypadek.",
      "Żeby było słonecznie, ciepło i spokojnie. A czapkę i tak załóż.",
    ],
    forecaster: [
      "Prognoza na Twój dzień: 100% szans na słońce, 0% na zły humor. Wiatr słaby, z kierunku przyjemnego.",
      "Nad Twoją okolicą tworzy się wyż szczęścia. Opady: wyłącznie komplementów.",
      "Synoptycy są zgodni: przez cały dzień przelotne uśmiechy, miejscami bardzo ciepło.",
    ],
  },
  uk: {
    intellectual: [
      "Кант захоплювався зоряним небом наді мною. Я додаю ще й безхмарне. Користуйся.",
      "Емпірично купити погоду неможливо. Теоретично це щойно вдалося. Решту доручаю твоєму оптимізму.",
      "Сонце — це зоря класу G2V. А саме ця сьогодні світить тільки для тебе.",
    ],
    diplomat: [
      "Після тривалих переговорів з атмосферою досягнуто згоди: сонце для тебе, хмари деінде.",
      "Від імені всіх зацікавлених сторін маю честь передати тобі гарну погоду. Без зобов’язань, із симпатією.",
      "Атмосферний фронт погодився на перемир’я. Умови миру: сонце, тепло і твоя усмішка.",
    ],
    charmer: [
      "Сонце й так би вийшло. Просто хотіло подивитися, як ти усміхаєшся.",
      "Тепло, сонячно, без дощу. А спекотно стане, щойно ти усміхнешся 😉",
      "Навіть погода хоче гарно виглядати поруч із тобою. Тож постаралася ☀️",
    ],
    poet: [
      "Хай сонце танцює на твоїх віях, а вітер шепоче лише добрі новини.",
      "На один день небо належить тобі. Розпоряджайся ним ніжно.",
      "Золоте світло, бездоганна блакить і тепло, як перша ранкова кава. Тільки для тебе.",
    ],
    bureaucrat: [
      "На підставі поданої заяви виділяється гарна погода в обсязі одного дня. Оскарженню не підлягає.",
      "Цим повідомляємо, що дощ отримав відмову. Справу вирішено позитивно.",
      "Погоду видано під розписку. Користуватися за призначенням: з усмішкою.",
    ],
    grandma: [
      "Вдягнися тепло, але не занадто, бо буде сонце. Я вже домовилася. І поїж щось!",
      "Сонечко, погоду замовлено, тож парасольку лиши вдома. Але кофтинку візьми, про всяк випадок.",
      "Щоб було сонячно, тепло і спокійно. А шапку все одно вдягни.",
    ],
    forecaster: [
      "Прогноз на твій день: 100% сонця, 0% поганого настрою. Вітер слабкий, з приємного напрямку.",
      "Над твоєю місцевістю формується антициклон щастя. Опади: лише компліменти.",
      "Синоптики одностайні: весь день мінлива усмішливість, місцями дуже тепло.",
    ],
  },
  en: {
    intellectual: [
      "Kant marvelled at the starry heavens above. I'm adding cloudless ones. Enjoy.",
      "Empirically, weather can't be bought. Theoretically, it just was. The rest is up to your optimism.",
      "The Sun is a G2V-type star. This particular one shines today just for you.",
    ],
    diplomat: [
      "After lengthy talks with the atmosphere, an agreement was reached: sunshine for you, clouds elsewhere.",
      "On behalf of all parties concerned, I have the honour of presenting you with good weather. No strings attached.",
      "The weather front has agreed to a ceasefire. Terms of peace: sunshine, warmth and your smile.",
    ],
    charmer: [
      "The sun would have come out anyway. It just wanted to see you smile.",
      "Warm, sunny, no rain. It only gets hot when you smile 😉",
      "Even the weather wants to look good next to you. So it made an effort ☀️",
    ],
    poet: [
      "May the sun dance on your eyelashes and the wind whisper only good news.",
      "For one day the sky belongs to you. Use it tenderly.",
      "Golden light, flawless blue and warmth like the first coffee of the morning. Just for you.",
    ],
    bureaucrat: [
      "Following your application, good weather is hereby allocated for one day. No appeals will be considered.",
      "We hereby inform you that the rain's application has been rejected. The matter is closed in your favour.",
      "Weather issued against signature. To be used as intended: with a smile.",
    ],
    grandma: [
      "Dress warm, but not too warm, because it'll be sunny. I've sorted it. And eat something!",
      "Sweetheart, the weather is ordered, so leave the umbrella at home. But take a cardigan, just in case.",
      "May it be sunny, warm and calm. And wear a hat anyway.",
    ],
    forecaster: [
      "Forecast for your day: 100% chance of sunshine, 0% chance of a bad mood. Light winds from a pleasant direction.",
      "A high-pressure system of happiness is forming over your area. Precipitation: compliments only.",
      "Forecasters agree: scattered smiles all day, very warm in places.",
    ],
  },
};

/** Next ready-made greeting for a style, skipping the one currently shown. */
export function pickGreeting(lang, style, current = "") {
  const list = (GREETINGS[lang] || GREETINGS.pl)[style];
  if (!list) return "";
  const i = list.indexOf(current);
  return i === -1 ? list[Math.floor(Math.random() * list.length)] : list[(i + 1) % list.length];
}
