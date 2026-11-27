# KUP POGODĘ

Sklep z cyfrowymi, humorystycznymi prezentami. Pierwszy produkt: **KUP DOBRĄ POGODĘ** — personalizowany certyfikat „zakupu pogody”.

Jeden Cloudflare Worker obsługuje stronę (pliki z `public/`) i API. Dane w Cloudflare D1, płatności Stripe Checkout (BLIK, Przelewy24, karta, Apple Pay, Google Pay), e-maile przez Resend, panel `/admin` za Cloudflare Access.

## Jak to działa

1. `GET /` — strona główna; worker wstawia cenę i wariant gwarancji (testy A/B przez cookie `kp_v`).
2. `POST /api/checkout` — walidacja, cena z konfiguracji serwera, zamówienie `pending`, sesja Stripe Checkout.
3. `POST /api/stripe/webhook` — jedyne miejsce, gdzie zamówienie staje się `paid` (podpis, kwota, idempotencja), potem e-mail do kupującego i odbiorcy.
4. `GET /sukces` — ekran po płatności (czeka na webhook, jeśli trzeba).
5. `GET /c/:token` i `/c/:token/pdf` — certyfikat do udostępnienia i PDF.
6. `GET /reklamacja`, `POST /api/refund` — Gwarancja Pogody (reguły w `src/refunds.ts`).
7. `/admin` — zamówienia, ponowna wysyłka, zwroty, konwersja, testy A/B, źródła.

Wspólny szablon certyfikatu: `public/cert.js` (podgląd w przeglądarce, strona certyfikatu i układ PDF).

**Języki (PL / UA / EN).** `public/index.html` jest po polsku i ma znaczniki `data-i18n`; tłumaczenia są w `src/i18n.ts`. Worker wybiera język: `?lang=` → cookie `kp_lang` → nagłówek przeglądarki, i podmienia teksty po stronie serwera (bez kosztów za wizytę). Certyfikat, PDF, strona sukcesu i e-maile są w języku zamówienia (`orders.lang`). Regulamin i Polityka prywatności zostają po polsku (wersja wiążąca).

**Życzenia w różnych stylach.** 7 „charakterów” i gotowe teksty w `public/greetings.js` (jedno kliknięcie, działa bez sieci). Przycisk „✨” woła `POST /api/greeting`, które używa Workers AI (darmowy limit dzienny, model w `AI_MODEL`) z limitem na odwiedzającego i na dzień; przy błędzie lub braku limitu zawsze wraca gotowy tekst.

## Lokalnie

```bash
npm install
cp .dev.vars.example .dev.vars        # klucze testowe Stripe / Resend (opcjonalnie)
npm run db:migrate:local
npm run dev                            # http://localhost:8787
npm test
node scripts/fake-webhook.mjs checkout.session.completed KPG-XXXXXX   # udawana płatność lokalnie
```

## Wdrożenie (Cloudflare, plan darmowy)

```bash
npx wrangler login
npx wrangler d1 create buygoodweather       # wpisz database_id do wrangler.jsonc
npm run db:migrate:remote
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put STRIPE_WEBHOOK_SECRET
npx wrangler secret put RESEND_API_KEY
npm run deploy
```

Potem: `SITE_URL`, `EMAIL_FROM`, `SUPPORT_EMAIL` w `wrangler.jsonc`; webhook w Stripe na `https://<domena>/api/stripe/webhook` (zdarzenia `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded`); aplikacja Cloudflare Access na `/admin*` i jej `ACCESS_TEAM_DOMAIN` / `ACCESS_AUD`.

## Konfiguracja bez zmiany kodu

| Zmienna | Co robi |
| --- | --- |
| `PRICE_VARIANTS` | cena w groszach, np. `999`; kilka wartości (`799,999`) = test A/B |
| `GUARANTEE_VARIANTS` | `A` bez gwarancji, `B` Gwarancja Pogody, `C` „100% satysfakcji”; kilka = test A/B |
| `AUTO_REFUNDS` | `true` = zwroty automatyczne wg reguł, inaczej trafiają do panelu |
