# Produktionsplan: Accelerator & Udvikler

Denne tjekliste samler de faste håndtag vi skal dreje på for at gøre Flok klar til offentlig lancering. Brug den som fælles reference mellem udvikler (programmør) og accelerator (forretning/operation).

## 1. Arkitektur & Teknik
- [ ] Planlæg backend-løsning (managed Postgres + Node/Cloud Functions) og aftal ansvar for drift, sikkerhedspatches og backup.
- [ ] Fastlæg API-kontrakter (events, brugere, invitationer, notifikationer). Udvikler udarbejder OpenAPI-spec og mock endpoints, accelerator godkender datafelter og compliance-krav (GDPR, opbevaringsperiode).
- [ ] Definér miljøer: `dev`, `staging`, `produktion`. Accelerator stiller infrastruktur til rådighed, udvikler sætter CI/CD op til automatisk deploy.
- [ ] Beslut identitetsløsning (Auth0, Cognito, Clerk, egen). Accelerator ejer leverandørvalg og budget, udvikler integrerer og migrerer temp logins til rigtige session tokens.

## 2. Datakvalitet & Migration
- [ ] Udarbejd plan for flytning af eksisterende localStorage-data til backend (engangsscript + brugernotifikation).
- [ ] Definér dataopbevaring og slettepolitik. Accelerator tager stilling til retention, udvikler implementerer purge-jobs.
- [ ] Sæt lognings- og monitoreringskrav (audit log, fejlrapportering, performance-målepunkter).

## 3. Sikkerhed & Privatliv
- [ ] Udfør threat-model workshop: hvilke angreb skal dækkes (brute-force, invitation guessing, CSRF, XSS).
- [ ] Accelerator indkøber juridiske dokumenter (privatlivspolitik, databehandleraftale). Udvikler implementerer samtykke-flows og cookie-banner.
- [ ] Fastlæg incident response-plan (kontaktliste, SLA for kritiske fejl, kommunikation til brugere).

## 4. QA & Release-proces
- [ ] Udvikler opsætter testpyramide: enhedstests (Vitest), komponenttests (React Testing Library), e2e (Playwright/Cypress).
- [ ] Accelerator planlægger beta-program (målgruppe, feedback-kanaler, support SLA).
- [ ] Opret release-checklist (funktionel test, regression, performancebudget, accessibility-audit). Begge parter signerer før “Go”.

## 5. Drift & Support
- [ ] Vælg overvågningsstack (Logtail/Datadog/Sentry) og definer alarmer for uptime, fejlrate, e-mail/SMS leveringsfejl.
- [ ] Etabler supportkanaler (helpdesk, FAQ, statuspage). Accelerator bemander, udvikler leverer integrationer.
- [ ] Plan for løbende optimering: kvartalsvise retros, roadmap-opdatering, budget for nye features.

## Sådan bruger du dokumentet
1. Gennemgå hver sektion sammen i sprint-planlægning.
2. Tildel klare ejere (Accelerator vs. Udvikler) og deadlines.
3. Opdater status ugentligt – dokumentet skal afspejle den aktuelle sandhed.

Når punkterne er grønne, har vi både de tekniske og organisatoriske byggesten til en tryggere lancering.
