# Flok

En lille (men voksende) React‑app til at planlægge og dele begivenheder. Kører på Web via Vite + Tailwind og gemmer data i `localStorage` (fake backend). Målet er en funktionel app på Web, iOS og Android.

Kom i gang (Web)
- Krav: Node 18+ og npm
- Installér: `npm i`
- Udvikling: `npm run dev` og åbn `http://localhost:5173`
- Build: `npm run build` (output i `dist/`)
- Preview: `npm run preview`
- Lint: `npm run lint` (ignorerer den genererede fil `flok-app.tsx`)
- Typecheck: `npm run typecheck`
- Test: `npm run test` (Vitest + jsdom)
 - CI: GitHub Actions kører lint/type/test/build på Node 18 og 20

Mobil (iOS/Android)
- PWA (anbefalet først): Appen kan køre “installérbar” på mobil. For at gøre Flok installérbar tilføjes:
  - Web App Manifest (`public/manifest.webmanifest`),
  - Service worker (`public/sw.js`),
  - Ikoner/splashes i `public/`.
  - Når disse er tilføjet kan brugere installere direkte fra browseren (Android/Chrome, iOS/Safari ≥ 16.4).
- Capacitor (native indpakning): Når webdelen er klar, kan den pakkes til App Store/Play:
  1) `npm i -D @capacitor/cli && npm i @capacitor/core`
  2) `npx cap init flok dev.example.flok`
  3) I `capacitor.config.ts`: sæt `webDir: 'dist'`
  4) `npm run build`
  5) `npx cap add ios && npx cap add android`
  6) `npx cap sync`
  7) `npx cap open ios` / `npx cap open android` og byg i Xcode/Android Studio.
  - Fordele: Native deling, push (APNs/FCM), deeplinks/Universal Links, filsystem, kamera m.m.

PWA hurtigt (lokal test)
- Build + preview: `npm run build && npm run preview`
- Åbn preview‑URL’en og tjek “Installér app” i browseren.
- Note: Manifest peger nu på `favicon.svg`. Til produktion bør der lægges rigtige PNG‑ikoner (192×192 og 512×512) i `public/` og refereres fra manifestet.

Nye forbedringer
- Ny gæste‑landing: Enkel forside for ikke‑loggede brugere med tre tydelige knapper: “Opret begivenhed” (primær), “Log ind som gæst” og “Log ind”. Navigation skjules her for at holde fokus.
- Samlet samtale: “Opslag” og “Afstemninger” er samlet i fanen “Samtale”. “Chat”-kategorien er fjernet.
 - Deltag via kode: Knap i topbaren åbner felt til event‑ID, invitekode eller snapshot (s:...). Finder event og navigerer dertil.
 - Børn for forældre: Tilføj/administrér børn på din profil og vælg dem direkte i RSVP‑panelet, når du svarer.
- Deling: Korte links bruges ved kopiering og deling. Ekstra knapper til Facebook‑sharer, Messenger (kræver `VITE_FB_APP_ID`), SMS og WhatsApp. “Kopiér besked” kopierer hele invitationsteksten i ét klik.
- Facebook på kort: Lille “Del via Facebook”‑knap direkte på eventkortene.
- QR‑kode: I delingsdialogen kan du generere en QR‑kode for kort link eller eventkode, med mulighed for download og print.
- Interne invitationer: Send invitationer direkte til venner i appen. Invitationer kan accepteres fra Notifikationer.
- Kort delingslink: Del med et kort hash-link af formen `#s:<snapshot>` (importeres automatisk ved åbning).
- Del/Share: Web Share API med fallback til e-mail, mens “Kopiér tekst” bevarer ren kopi.
- Opslag: Fastgjorte opslag vises øverst.
- Hjem: Skift mellem “Kommende” og “Tidligere” events.
- Værtstyring: Duplikér, arkivér eller slet begivenheder. Bedre billedkomprimering.
- Modulær UI: Tailwind-stilklasser i `src/ui/styles.ts`. Genbrugelige hjælpefunktioner i `src/utils.ts` (med tests).
 - Invitationer: Eget modul i `src/modules/invitations.ts` med enhedstests.
 - Base64 utils: Sikker URL‑safe encoding/decoding uden deprecated API’er.
 - Feedback og tilgængelighed: Ikke‑blokkerende toasts (`ToastProvider`) med `aria-live`, let haptik (vibration) samt reduceret motion ved `prefers-reduced-motion`.
 - A11y‑småtterier: `aria-label` på ikonknapper (tema, notifikationer, log ind/ud, opret). Interaktive chips (børnevalg) har nu minimum 44×44 pt trykområde.
 - Bekræftelser: Egen `ConfirmProvider` med tilpasset modal og “Fortryd” via toast‑handling for destruktive valg (fx slet begivenhed, fjern ven, ryd notifikationer).
 - Tekststørrelse: “Aa”‑knap i toolbar toggler `--text-scale` (1.0 ↔ 1.15).
- Kontrast: Sekundær tekst og ringfarver justeret for bedre WCAG‑kontrast i lys/mørk tilstand.

Deling og links (hurtigt overblik)
- Kort link: `shortInviteUrl(ev)` genererer `/#s:<snapshot>` som virker uden backend (snapshot importeres ved åbning).
- Facebook: Del via sharer på kort og i dialog.
- Messenger: Understøttes via Facebook Dialog Send (kræver `VITE_FB_APP_ID`).
- SMS/WhatsApp: Hurtig deling med forudfyldt tekst.
- QR: QR‑kode for kort link eller eventkode kan vises, downloades som PNG og printes.

Bemærk
- Data gemmes i browseren. Ryd localStorage-nøglen `flok-db-v1` for at nulstille demo-data.
- Notifikationer kræver tilladelse i browseren.
- `flok-app.tsx` er en stor, genereret komponent. Den er bevidst udeladt fra ESLint og har `// @ts-nocheck` indtil gradvis udtrækning til moduler er færdig.

Konfiguration
- Miljøvariabler:
  - `VITE_FB_APP_ID` (valgfrit): Kræves for Facebook Messenger‑deling via Dialog Send.
 - Capacitor: `capacitor.config.ts` er inkluderet (`appId: dev.flok.app`, `webDir: 'dist'`).

Capacitor hurtigt
- Sync web → native: `npm run build && npm run cap:sync`
- Tilføj platforme: `npm run cap:add:ios` og/eller `npm run cap:add:android`
- Åbn projekterne: `npm run cap:open:ios` eller `npm run cap:open:android`

Roadmap mod Web + iOS + Android
- PWA (Web → Mobil installérbar):
  - Tilføj manifest, service worker og ikoner; cache strategier for app‑shell + billeder.
  - Badge/notifications (Web Push). iOS PWA‑push understøttes fra iOS 16.4 (kræver bruger‑opt‑in).
- Native (Capacitor):
  - App‑pakning, deeplinks/Universal Links, Push (APNs/FCM), native filvælger/kamera.
- Backend:
  - Rigtig persistens (events, brugere, invites), login og kortere delings‑URLs.
  - Webhooks/notifikationer og e‑mail/SMS udsendelse.
- Deling:
  - URL‑forkortelse eller server‑slug for ultra‑korte links.
- Kvalitet:
  - Flere tests, performance budgets, accessibility‑tjek, i18n.
