# TasteTrail

TasteTrail is now structured as a Vercel + Neon monorepo with three first-class surfaces:

* `apps/web`: Next.js web app and route handlers
* `apps/cli`: OpenClaw-friendly CLI for shell-driven operation
* `apps/native`: Expo native scaffold that consumes the same backend contracts

The old Azure Static Web Apps plus Azure Functions architecture has been replaced by shared workspace packages and a web runtime that is portable across web, CLI, and native clients.

## Architecture

### Workspaces

* `apps/web`
  * Next.js App Router UI
  * API route handlers for TasteTrail operations
  * Passkey-first auth UI plus Microsoft migration bridge
* `apps/cli`
  * Node CLI with commands for auth, workspaces, restaurants, imports, stats, debug logs, and CLI token creation
  * Intended execution surface for OpenClaw shell automation
* `apps/native`
  * Expo scaffold for the native client surface
* `packages/shared`
  * Cross-surface TypeScript domain types
* `packages/server`
  * Shared backend services for auth, workspaces, restaurants, menu items, imports, AI settings, and debug logging
* `db/migrations`
  * SQL migrations for Neon PostgreSQL

### Authentication

TasteTrail now targets passkeys as the steady-state auth model.

Migration support remains for Microsoft-era accounts:

* Microsoft sign-in is optional and intended only as a migration bridge
* legacy identity links are stored in Neon
* users can claim legacy data and attach a passkey to the new account

### OpenClaw operation

TasteTrail is designed to be operable through the CLI so OpenClaw can drive it via shell execution.

Key pattern:

```bash
npm run build
node /Users/mike/Projects/KovaForge/TasteTrail/apps/cli/dist/index.js auth whoami
```

More examples are in [docs/openclaw-cli.md](/Users/mike/Projects/KovaForge/TasteTrail/docs/openclaw-cli.md:1).

## Root commands

```bash
npm install
npm run build
npm run dev:web
npm run dev:cli
```

`npm run build` builds:

* `@tastetrail/cli`
* `@tastetrail/web`

The native scaffold is intentionally excluded from the root build so the main web plus CLI loop stays fast.

## Environment

Create a local `.env` file at the repo root with values such as:

```bash
DATABASE_URL=postgres://...
BETTER_AUTH_SECRET=replace-with-a-random-32-byte-plus-secret
BETTER_AUTH_URL=http://localhost:3000
APP_BASE_URL=http://localhost:3000
PASSKEY_RP_ID=localhost
TASTETRAIL_ENCRYPTION_KEY=replace-with-a-random-32-byte-base64-key
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_TENANT_ID=common
NEXT_PUBLIC_MICROSOFT_AUTH_ENABLED=false
```

Notes:

* `BETTER_AUTH_SECRET` must be a strong secret. The build will warn if it is weak.
* Leave the Microsoft values empty unless you are actively testing the legacy migration bridge.
* `TASTETRAIL_ENCRYPTION_KEY` is used for AES-256-GCM encryption of stored AI provider keys.

## Database migrations

Run the Neon migrations in order. The current rearchitecture adds:

* [db/migrations/007_vercel_neon_rearchitecture.sql](/Users/mike/Projects/KovaForge/TasteTrail/db/migrations/007_vercel_neon_rearchitecture.sql:1)

That migration introduces:

* CLI tokens
* debug log entries
* legacy identity links for Microsoft-to-passkey migration

## Web app

Run the web app locally:

```bash
npm run dev:web
```

Important routes:

* `/sign-in`
* `/restaurants`
* `/import`
* `/settings`
* `/migrate-account`

## CLI

Build first:

```bash
npm run build
```

Common commands:

```bash
node apps/cli/dist/index.js auth login --token <token> --base-url http://localhost:3000
node apps/cli/dist/index.js auth whoami
node apps/cli/dist/index.js workspaces list
node apps/cli/dist/index.js restaurants list --workspace-id <workspace-id>
node apps/cli/dist/index.js imports parse --workspace-id <workspace-id> --source-type text --source-value "..."
node apps/cli/dist/index.js debug logs --workspace-id <workspace-id>
```

The CLI stores config at `~/.tastetrail/config.json`.

## Native scaffold

The native scaffold lives in `apps/native` and is intentionally isolated from the root workspace install.

Run it separately:

```bash
cd apps/native
npm install
npm run dev
```

## Verification

The repo-local verification command is:

```bash
npm run build
```

This has been validated for the current rearchitecture.
