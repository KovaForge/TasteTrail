# TasteTrail OpenClaw CLI

TasteTrail is designed so OpenClaw can operate it through shell execution rather than browser-only control.

## Build once

```bash
cd /Users/mike/Projects/KovaForge/TasteTrail
npm run build
```

## CLI entrypoint

OpenClaw can invoke:

```bash
node /Users/mike/Projects/KovaForge/TasteTrail/apps/cli/dist/index.js
```

## Authentication flow

1. Create a CLI token from the TasteTrail Settings page or through an authenticated session.
2. Save the token into the CLI config:

```bash
node /Users/mike/Projects/KovaForge/TasteTrail/apps/cli/dist/index.js auth login --token <token> --base-url http://localhost:3000
```

3. Verify:

```bash
node /Users/mike/Projects/KovaForge/TasteTrail/apps/cli/dist/index.js auth whoami
```

## Workspace operations

```bash
node /Users/mike/Projects/KovaForge/TasteTrail/apps/cli/dist/index.js workspaces list
node /Users/mike/Projects/KovaForge/TasteTrail/apps/cli/dist/index.js workspaces create --name "Family"
node /Users/mike/Projects/KovaForge/TasteTrail/apps/cli/dist/index.js workspaces members --workspace-id <workspace-id>
```

## Restaurant and menu operations

```bash
node /Users/mike/Projects/KovaForge/TasteTrail/apps/cli/dist/index.js restaurants list --workspace-id <workspace-id>
node /Users/mike/Projects/KovaForge/TasteTrail/apps/cli/dist/index.js restaurants create --workspace-id <workspace-id> --name "The Dumpling Bench" --cuisine "Chinese"
node /Users/mike/Projects/KovaForge/TasteTrail/apps/cli/dist/index.js menu-items list --restaurant-id <restaurant-id>
node /Users/mike/Projects/KovaForge/TasteTrail/apps/cli/dist/index.js menu-items create --restaurant-id <restaurant-id> --name "Pork Xiao Long Bao"
```

## Import and stats operations

```bash
node /Users/mike/Projects/KovaForge/TasteTrail/apps/cli/dist/index.js imports parse --workspace-id <workspace-id> --source-type text --source-value "menu text here"
node /Users/mike/Projects/KovaForge/TasteTrail/apps/cli/dist/index.js imports commit --workspace-id <workspace-id> --import-id <import-id> --draft-file /absolute/path/to/draft.json
node /Users/mike/Projects/KovaForge/TasteTrail/apps/cli/dist/index.js search query --workspace-id <workspace-id> --q dumpling
node /Users/mike/Projects/KovaForge/TasteTrail/apps/cli/dist/index.js stats cuisines --workspace-id <workspace-id>
node /Users/mike/Projects/KovaForge/TasteTrail/apps/cli/dist/index.js debug logs --workspace-id <workspace-id>
```

## OpenClaw usage note

OpenClaw does not need a custom plugin to operate TasteTrail if shell execution is available. The CLI is intentionally plain Node output with JSON responses so agents can parse it reliably.
