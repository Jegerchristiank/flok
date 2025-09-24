# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, and this project adheres to Semantic Versioning, as far as it makes sense for a demo.

## [Unreleased]
### Changed
- Delingslinks bruger nu stabile `#event:<id>`-URL’er i stedet for midlertidige snapshot-koder.
- Lokal database starter tom uden demo-data for at understøtte produktion.

## [0.2.0] - 2025-08-29
### Added
- Internal invitations: Send per‑friend invites in-app; recipients accept via Notifikationer.
- Short invite links: `#s:<snapshot>` with automatic import + navigation.
- Conversation: Combined “Opslag” and “Afstemninger”; removed “Chat” tab.
- Tooling: ESLint, Prettier, Vitest; tests for utils in `src/utils.test.ts`.
- Utils module: Extracted reusable helpers to `src/utils.ts`.
- Docs: Updated README with scripts and notes.

### Changed
- Invite dialog now uses short links for share/copy and consistent email fallback for “Del”.
- “Del link” per friend replaced by “Send invitation”.

### Fixed
- Various UI inconsistencies around sharing/copy.

### Deprecated
- None.

### Removed
- GIF support in chat (the chat tab removed in favor of Conversation).

### Security
- None.
## [0.2.1] - 2025-08-30
### Fixed
- TypeScript typing of invitation flows to satisfy strict union types.

### Added
- Unit tests for invitations module: send, accept, decline, and duplicate prevention.

## [0.3.0] - 2025-08-30
### Added
- GitHub Actions CI pipeline (Node 18/20) running lint, typecheck, tests and build.
- Safer Base64 URL utilities using TextEncoder/TextDecoder with Node/browser fallbacks.

### Changed
- Monolithic `flok-app.tsx` now reuses helpers from `src/utils.ts` (removed duplicate implementations).

