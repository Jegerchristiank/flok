# Contributing

Tak fordi du vil hjælpe! Dette repo er en lille Vite + React app med Tailwind og lokal persistence i `localStorage`.

## Kom i gang
- Node 18+
- `npm i`
- `npm run dev`

## Scripts
- `npm run build` – production build
- `npm run preview` – serve build
- `npm run lint` – ESLint (ignorerer `flok-app.tsx`)
- `npm run typecheck` – TypeScript noEmit (tests og utils er typed)
- `npm run test` – Vitest

## Retningslinjer
- Hold patches små og fokuserede.
- Undgå at flytte store mængder kode i samme PR.
- Ingen secrets i kode eller logs.
- Store komponenter i `flok-app.tsx` er genereret; vi migrerer gradvist til moduler i `src/`.

## Stil
- Prettier bruges til formattering.
- ESLint regler er pragmatiske; feel free til at foreslå forbedringer, men undgå at gøre koden svær at ændre.

