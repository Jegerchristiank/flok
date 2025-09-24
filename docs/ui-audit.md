# Flok – UI/UX audit og ændringer (HIG-baseret)

Formål: Rydde op, forenkle startoplevelsen og hæve tilgængelighed, med udgangspunkt i Apple Human Interface Guidelines (HIG).

## Oversigt
- Forenklet landing screen for gæster med tre tydelige handlinger.
- Skjult navigation på gæstelanding for at undgå dominans og støj.
- Forstørrede, accentuerede primærhandlinger og forbedrede trykområder.
- Små a11y‑rettelser (aria‑labels, fokus, live regioner, kontrastbevidsthed).
- Konsistens i knapstørrelser og typografi; støtte for Dynamic Type via `--text-scale`.

## Fund og udbedringer

1) Visuelt hierarki og CTA
- Problem: Forsiden for gæster blandede filter‑UI og lister uden klar primærhandling.
- Løsning: Ny gæste‑landing med tre store knapper placeret centralt: “Opret begivenhed” (primær CTA), “Log ind som gæst”, “Log ind”.
- HIG: Fremhæv primær handling med accent og placér vigtige kontroller højt, mod venstre/øverst i hierarkiet.

2) Navigationens dominans
- Problem: Top‑/bundnavigation var synlig på gæste‑landing og tog visuel opmærksomhed.
- Løsning: Skjul nav på gæste‑landing; vis igen når bruger er logget ind eller på andre skærme.
- HIG: Navigation skal være diskret og naturlig, ikke dominere.

3) Knapper og trykområde
- Problem: Nogle interaktive “chips” (børnevalg ved RSVP) var under 44×44pt.
- Løsning: Tilføj `min-h-11` og justér alignment, så faktiske trykområder opfylder 44×44pt.
- HIG: Minimum 44×44pt for touch‑mål; visuel feedback ved tryk beholdes.

4) Ikoner og etiketter
- Problem: Ikon‑kun knapper i topbaren manglede altid synlige labels på små skærme; enkelte manglede aria‑labels.
- Løsning: Tilføj `aria-label` til tema, notifikationer, log ind/ud og “Opret”. Behold synlige labels på større skærme.
- HIG: Ikoner skal ledsages af tekst eller have klar tilgængelig beskrivelse.

5) Farver og kontrast
- Status: Primærknap bruger blå accent med hvid tekst (tilstrækkelig kontrast). Neutrale knapper og kort bruger lyse/mørke baggrunde, der giver god læsbarhed.
- Anbefaling: Ved videre arbejde, tilføj `prefers-contrast: more`‑overrides og kontrasttests mod 4.5:1 for sekundærtekst.
- HIG: Brug farver konsistent og undgå at samme farve betyder flere ting.

6) Typografi og Dynamic Type
- Status: Systemfont og root‑skalering via CSS‑variabel `--text-scale` er på plads; hurtig toggling i UI.
- Anbefaling: Udvid skalaen og knapstørrelser ved højere skalaer for ældre brugere (20–100%).
- HIG: Støt Dynamic Type og ældre brugeres behov for større kontroller.

## Implementerede ændringer (kode)
- `flok-app.tsx`
  - Ny `Landing` komponent og logik i `Home` til at vise den for gæster.
  - Skjul `Nav` og `BottomNav` på gæste‑landing.
  - A11y: `aria-label` på tema, notifikationer, log ind/ud, og “Opret”.
  - RSVP: Forøg trykområde på valg af børn (`min-h-11`, inline‑flex alignment).
- Ingen breaking changes i dataflow; eksisterende routing bevares (home/explore/friends osv.).

## Test og validering
- Byg/lint kører grønt; eksisterende enhedstests for utils/invitations består.
- Manuel a11y‑check: Tastaturnavigation i modal/dialog, toasts med `aria-live`, fokuslås med `FocusTrap`.
- Yderligere anbefaling: Automatisk kontrastcheck i CI (axe/pa11y) og snapshottests for landing.

## Næste skridt (anbefalinger)
- Farvetemaer: Definér tone‑skalaer for lys/mørk/øget kontrast og henfør primær/sekundær/feedback konsistent.
- Størrelsesklasser: Introducér “XL” knapvariant og responsiv typografi bundet til `--text-scale`.
- Ikon‑etiketter: Sikr, at alle ikonknapper har synlige labels på mobil, eller stærke aria‑labels, afh. af plads.
- VoiceOver: Gennemgå skærme med VoiceOver for korrekt læserækkefølge og rolle/label.

—
Spørg gerne, hvis du vil have mig til at udvide tema‑systemet, tilføje kontrast‑overrides eller lave små a11y‑tests i CI.

