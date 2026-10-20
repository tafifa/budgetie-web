# Budgetie (Ionic + Capacitor)

A calm, local-first budget tracker: income and expenses, multiple accounts, transfers, monthly category budgets, and paylater installments. There is no backend. All data lives on the device in `localStorage`, and users back it up through JSON export/import.

This is a rewrite of the Dart/Jaspr app in `../budgetie_fe`. It uses the same features, the same URLs (`/`, `/transactions`, `/accounts`, `/budgets`, `/paylater`), and the **same stored data format**, so people who used the old app keep their data.

Live at https://budgetie.justtffy.web.id (served from `127.0.0.1:8082` through the Cloudflare Tunnel).

## Stack

- Ionic React 8, React 18, React Router 5 (Ionic's router), TypeScript, Vite 5
- Capacitor 7 for native builds; `@capacitor/filesystem` and `@capacitor/share` handle backup export on a phone
- Vitest for the domain tests
- Production: static build served by nginx in Docker

## Layout

```
src/
├── domain/        # framework-free business logic (ported from lib/models.dart, lib/store.dart)
│   ├── models.ts       # entities + JSON (de)serialisation in the original snake_case shape
│   ├── store.ts        # BudgetStore: queries, mutations, validation, import/export
│   ├── formatters.ts   # dates (YYYY-MM-DD strings), IDR formatting, amount parsing
│   └── store.test.ts   # ported Dart tests + data-compatibility tests
├── state/         # React glue: store context (useBudget) and UI context (modals, toasts)
├── components/    # shared UI: header, cards, form fields, rows, charts
├── modals/        # one form per action; ModalHost renders the active one
├── pages/         # the five tabs
├── services/      # backup export (web download / native share sheet)
└── theme/         # Ionic variables + app styles
public/js/service_worker.js   # retires the old app's service worker (see below)
```

Every mutation goes through `BudgetStore`, which saves to `localStorage` right away and notifies React (`useSyncExternalStore`). Pages and rows read from the store directly. Forms keep their own state and call the store on save.

## Development

Node is not installed on the server. Run the tools through Docker from this folder:

```bash
alias dnode='docker run --rm -it -u $(id -u):$(id -g) -e HOME=/tmp -v "$PWD":/app -w /app -p 5175:5175 node:22-alpine'
dnode npm install
dnode npm test            # domain tests
dnode npm run typecheck
dnode npm run dev         # http://localhost:5175
dnode npm run build       # output in dist/
```

On a machine with Node 20+, use `npm` directly.

## Deploy (web)

```bash
cd ~/projects/budgetie_web
docker compose up -d --build
```

(This folder is not a git repository yet; run `git init` and commit before using `git pull` in this flow.)

The Docker build runs `npm test` before `npm run build`. If a test fails, no new image is produced and the running version stays up.

`nginx.conf` serves `index.html` for unknown paths (SPA routing) and caches `/assets/*` (hashed file names) forever. It never caches `index.html`, `manifest.json` or the service worker, so a deploy reaches users on their next visit. No version bump is needed.

## Native app (Capacitor)

The Capacitor config (`capacitor.config.ts`, app id `id.web.justtffy.budgetie`) and the Android package are installed, but no native project is committed yet. To create one (on a machine with Android Studio):

```bash
npm install
npm run build
npx cap add android      # creates ./android
npx cap sync
npx cap open android     # build/run from Android Studio
```

iOS works the same way (`npm i @capacitor/ios`, then `npx cap add ios`) but needs macOS with Xcode.

Inside the native app, data is stored in the WebView's `localStorage`, separate from the website's. Users move data between the two with Export/Restore JSON backup.

## Data compatibility

- Storage key `budgetie.dataset.v1`, envelope `{ schema_version: 1, exported_at, app_version, data: {...} }` and every field name are unchanged. `store.test.ts` loads a dataset in the exact shape the Dart app wrote and checks that it round-trips unchanged.
- Old JSON backups can be restored, and backups from this version can be restored into the old app.
- If stored data cannot be read, the raw text is kept under `budgetie.unreadable.v1` before the app starts fresh. The old app overwrote it silently.
- Before an import replaces data, a copy is saved under `budgetie.last-backup.v1` (same as before).

### Old service worker

The Dart app registered `/js/service_worker.js`, which served `index.html` cache-first, so returning visitors could stay on the old app. This project ships a replacement at the same path that deletes all caches, unregisters itself and reloads open tabs. `localStorage` is not touched. The file can be removed once old visitors have come back (a few months is plenty).

## Behaviour changes compared to the Dart app

Intentional fixes, all covered by tests or visible in the UI:

- **Amount parsing**: `1.250.000` and `1,250,000` are read as thousands. The old app read both as 0. A single separator (`2,5`, `2.5`) is still a decimal.
- **Overdue**: an installment due *today* is no longer marked overdue. Only past due dates are.
- **Editing a budget** and moving it to another category or month no longer leaves a duplicate budget with the same id behind.
- **Paylater, automatic mode**: the "custom monthly installment" field was removed. The old app showed it but ignored the value when saving.
- **Opening-balance warning** when editing an account with transactions now appears. In the old app it was wired to a count that was always 0.
- **Interaction**: transactions and transfers open an action sheet (Edit / Archive) on tap instead of showing inline buttons. Toasts and the archive confirmation use Ionic components.
