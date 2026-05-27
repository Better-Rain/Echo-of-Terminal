# AI Handoff

This document is for quickly onboarding another AI assistant or a new development host.

## Project

- Name: Echo of Terminal / 黑箱档案局 prototype.
- Type: pure frontend web puzzle game.
- Stack: Vite + TypeScript + plain CSS.
- Deployment target: GitHub Pages.
- Repository: `git@github.com:Better-Rain/Echo-of-Terminal.git`
- Local workspace used so far: `E:\Programs\Vscode Projects\web_puzzle_game`

## How To Run

```powershell
npm install
npm run dev
```

The dev server normally opens at `http://127.0.0.1:5173/`.

Build check:

```powershell
npm run build
```

## Publishing

The repo contains `.github/workflows/deploy-pages.yml`.

After pushing to GitHub:

1. Open repository Settings -> Pages.
2. Select GitHub Actions as the Pages source.
3. Push `main`; the workflow builds `dist/` and deploys it.

`vite.config.ts` uses `base: './'`, so the app can be served from a GitHub Pages project path without hardcoding the repository name.

## Progress Snapshot

Last updated: 2026-05-27.

- GitHub SSH remote is configured and `main` has been pushed to `git@github.com:Better-Rain/Echo-of-Terminal.git`.
- First-stage login flow is playable: boot self-check -> readonly `访客#0719` login -> placeholder password `0719` -> auth feedback -> archive shell.
- Second-stage entry now has a staged mount sequence: file manager scan -> delayed local cache mount -> delayed external media mount.
- The external media notice intentionally reads like an old operating system removable-drive prompt and does not reveal story metadata such as priority or document purpose.
- USB root currently contains `委托书_文化部_优先级A+.txt`, a cleartext Ministry of Culture commission letter with a European-style ministry header, mission scope, evidence-handling rules, and sign-off.
- The right-side document body layout was corrected so large desktop viewports no longer stretch paragraphs across the full panel height.
- Current verification command: `npm run build`.

## Current Player Flow

1. Boot screen plays a short system self-check.
2. Login page appears with readonly username `访客#0719`.
3. Current placeholder password is `0719`, derived from the username suffix.
4. Successful auth shows readonly access notices.
5. App enters the file manager workspace.
6. The file manager first shows a short mount scan; local cache appears after a brief delay.
7. After a second delay, the external media appears to simulate the protagonist inserting the storage device, and a bottom-right OS-like removable-drive prompt appears.
8. Clicking the notice opens the USB root directory.
9. USB contains `委托书_文化部_优先级A+.txt`, a cleartext Ministry of Culture commission document with a European-style ministry header and sign-off.
10. Top navigation switches between `文件管理器` and `档案记录`.

## Current Structure

- `src/main.ts`: state machine and UI rendering. Current stages are `boot`, `login`, `authenticating`, and `archive`.
- `src/styles.css`: all current visual styling, including terminal layout, scrollbars, file manager, record panels, login screens, and USB notice.
- `src/domain/types.ts`: shared data types for access rules, cases, chat, login, and virtual filesystem.
- `src/domain/access.ts`: access-rule evaluator, independent from UI.
- `src/data/loginStage.ts`: first-stage login puzzle content.
- `src/data/fileSystem.ts`: second-stage virtual volumes, directories, and documents.
- `src/data/cases.ts`: example archive records.
- `src/data/chats.ts`: example secure chat thread.
- `src/data/player.ts`: current player profile. Default is readonly guest account `访客#0719`.
- `src/data/access.ts`: role definitions and permissions.
- `public/assets/bureau-seal.svg`: current local visual identity asset.

## Design Direction

- Style: internal archive terminal, dark background, restrained green/cyan/amber accents.
- Avoid gamey copy in the main UI. Prefer system-like labels: record, access rule, internal note, readonly mirror, storage media.
- Keep page-level scrolling off where possible; scrolling should happen inside panels.
- Current scrollbars are intentionally narrow and terminal-styled.
- The UI should remain data-driven; puzzle text should live in `src/data/*` rather than directly inside rendering logic when practical.

## Known Placeholder Content

- Login puzzle is intentionally simple and can be replaced later.
- Avatar/original account owner image is still a placeholder.
- File manager currently has one delayed USB commission document and one local cache log.
- Archive records and chat are sample content, not final story canon.

## Useful Git Checkpoints

- `70b5afc Add file manager and USB brief flow`
- `c47e288 Refine archive scrollbars and file row layout`
- `baf5755 Tighten archive viewport and system labels`
- `efcb12c Add terminal login puzzle stage`
- `4578cbc Separate content data and access model`

## Next Likely Work

- Expand the USB directory tree and add the first real second-stage puzzle.
- Decide the original account owner's identity and avatar treatment.
- Connect file-manager discoveries to access flags in `PlayerProfile`.
- Add lightweight persistence for discovered files and unlocked records.
