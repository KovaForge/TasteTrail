# TasteTrail Rearchitecture Goal Prompt

You are rearchitecting TasteTrail from its current Azure Static Web Apps + Azure Functions + Microsoft-auth-shaped implementation into a Vercel + Neon system that is native-first, OpenClaw-operable, and production-ready.

## Primary Goal

Completely reshape this repo so TasteTrail becomes:

1. A Vercel-hosted application for web and server workloads.
2. A Neon PostgreSQL-backed system for all persistent data.
3. A native-first app experience rather than a web-only PWA.
4. Operable by OpenClaw through a stable CLI, without requiring browser automation for normal use.
5. Structured so the same domain actions can be triggered from:
   - native UI
   - web UI
   - CLI
   - future OpenClaw skills or agent tooling

## Critical Context

The current repo is a React + Vite frontend with an Azure Functions backend and Neon database usage already present. It is still tightly coupled to Azure SWA auth and Microsoft-oriented login flows.

The OpenClaw reference implementation is available locally at:

- `/Users/mike/Projects/openclaw/openclaw`

Use it as reference for:

- CLI-first operability
- gateway/tool/command patterns
- skill-friendly design
- stable command surfaces
- automation-safe JSON output

Do not copy OpenClaw blindly. Use it to shape the operator and automation model.

## End-State Requirements

### Hosting and Infrastructure

- Use Vercel for hosting and server execution.
- Use Neon PostgreSQL for all persistent storage.
- Do not depend on Azure Static Web Apps, Azure Functions, Microsoft Entra, or Azure-specific auth/runtime primitives anymore.
- Remove architectural dependence on `/.auth/*`, `x-ms-client-principal`, Azure route roles, and Microsoft token exchange code.

### Native-First Product Direction

TasteTrail must no longer be treated as only a mobile-first web app. Re-architect it into a native-first product with shared domain logic.

Choose a pragmatic stack that preserves strong TypeScript reuse. Prefer a structure like:

- `apps/web`
- `apps/native`
- `apps/cli`
- `packages/domain`
- `packages/api`
- `packages/db`
- `packages/ui` or other shared packages as needed

If you choose a different layout, it must be clearly superior and still support shared business logic across app surfaces.

The native app must feel intentional, not like a thin web wrapper. However, do not overbuild platform-specific UI before the architecture is correct.

### OpenClaw Operability

TasteTrail must be operable via CLI in a way that OpenClaw can use reliably.

That means:

- Every important user action must have a CLI path.
- CLI commands must support machine-readable JSON output.
- Commands must have stable names, explicit arguments, and useful exit codes.
- Commands must avoid interactive prompts unless explicitly requested.
- Commands must support non-interactive auth/session usage suitable for automation.
- Commands must expose draft-oriented import workflows rather than hiding them behind UI-only state.

The CLI should cover at least:

- auth and session management
- workspace discovery and selection
- invite and member management
- restaurant CRUD
- menu item CRUD
- import parse from text / URL / image
- import draft review and commit
- search
- stats
- debug log export or tail
- health checks

The CLI should be designed so an OpenClaw skill can call it directly and reason over JSON responses.

Do not design TasteTrail so OpenClaw has to click around the UI to do core work.

### Shared Action Surface

Design the system so UI and CLI call the same application services.

Preferred layering:

1. Domain model and rules
2. Application services / use cases
3. Delivery layers:
   - web routes / API handlers
   - native app bindings
   - CLI commands

Do not bury business logic inside React components or route handlers.
Do not let the CLI become a second implementation of the backend.

## Product Requirements To Preserve

Preserve and improve these TasteTrail capabilities:

- account-based sign-in required for all usage
- invite-only shared family workspace model
- workspace membership and role enforcement
- restaurant and menu item tracking
- tried history and notes
- search and statistics
- AI-assisted import from:
  - URL
  - screenshot image
  - pasted text
- draft review before commit
- user-supplied OpenAI and Gemini API keys
- provider key encryption at rest
- debug logging and debug view concepts

## Auth Requirements

Do not keep Microsoft or Entra auth.

Replace auth with app-managed authentication appropriate for Vercel + Neon and native + CLI use. The auth design must work across:

- web
- native
- CLI
- OpenClaw automation

The design must support:

- email-owned user identity
- invite-only access
- server-side permission enforcement
- secure session handling
- practical login flows for native and CLI users
- passkey-based authentication as the target steady-state account model

The rearchitecture must also include a migration path from the current Microsoft-account-based identity model to passkey-based accounts.

That migration design must:

- preserve existing user-owned TasteTrail data
- preserve workspace ownership and membership relationships
- preserve AI provider settings and other per-user settings where safe and appropriate
- let an existing Microsoft-account-based user claim or convert their account into a passkey-based account
- avoid creating duplicate logical users during migration
- define how identity linking, verification, and cutover are handled
- make clear whether Microsoft login remains temporarily available only for migration/bootstrap or is removed immediately after migration support is in place

Be explicit and opinionated here. Do not leave auth as a vague placeholder.

## Database and Data Rules

- Neon remains the system of record.
- Keep database migrations first-class.
- Normalize the schema around users, workspaces, memberships, restaurants, menu items, import drafts, provider keys, and debug logs.
- Never trust client-supplied workspace or ownership identifiers without server validation.
- Preserve encryption-at-rest for provider API keys.
- Keep secrets out of logs and responses.

## Import Pipeline Requirements

The import pipeline must stay server-controlled.

- URL imports must handle JavaScript-rendered pages.
- Screenshot imports must perform OCR without external OCR SaaS.
- AI providers must return strict JSON drafts.
- No auto-commit of imports.

Validate early whether Playwright plus OCR can run reliably in the chosen Vercel architecture. If there is a runtime constraint, solve it within the Vercel + Neon target architecture instead of silently downgrading the requirement.

## Debug and Observability Requirements

Keep the debug logging model as a first-class product feature.

Every new screen or route should register with the debug system.
Log at minimum:

- page or screen load
- API request start
- API request failure
- unhandled UI error
- import parsing failure

Each debug entry should include:

- timestamp
- route or screen name
- user identifier
- workspace identifier
- correlation id if present
- severity
- safe message text

Keep the debug view master toggle concept, but re-implement it in the new architecture if needed.

The debug system must remain usable without browser developer tools.

## OpenClaw Integration Requirements

Design TasteTrail so OpenClaw can operate it cleanly.

At minimum, deliver:

1. A strong CLI with JSON output.
2. A documented command set that maps to TasteTrail use cases.
3. A prompt- or skill-friendly surface for OpenClaw operators.
4. A clear path for an OpenClaw workspace skill or plugin wrapper if needed later.

If helpful, add a repo-local OpenClaw skill definition or operator docs, but the CLI is the non-negotiable integration point.

The OpenClaw integration should support practical flows such as:

- “list my restaurants”
- “import this menu URL as a draft”
- “show warnings from the draft”
- “commit only selected menu items”
- “invite this family member as Viewer”
- “show recent debug failures”

## Engineering Expectations

- Prefer TypeScript throughout.
- Keep state management simple and predictable.
- Favor shared typed contracts between UI, CLI, and server.
- Favor testable modules over framework-bound logic.
- Document local development clearly.
- Make local development practical for web, native, CLI, and server workflows.

## Migration Expectations

This is not a patch job. It is a rearchitecture.

You should:

- identify what can be preserved
- isolate what must be rewritten
- retire Azure-specific code paths
- redesign auth deliberately
- create a clean package/app structure
- move features onto shared application services
- produce a CLI that is truly usable by OpenClaw

Do not preserve bad boundaries just to minimize diff size.
Do not keep dead Azure-era abstractions out of sentimentality.

## Delivery Expectations

When implementing:

1. Start by proposing the target architecture in concrete repo terms.
2. Identify deletions, moves, and new package/app boundaries.
3. Sequence the migration so the build stays understandable.
4. Keep README and operator docs current as the architecture changes.
5. Ensure the final result can be built locally and validated.

## Definition of Done

The work is done when:

- TasteTrail is architected around Vercel + Neon rather than Azure SWA + Azure Functions.
- Microsoft-specific auth dependencies are gone.
- A native-first app architecture exists with shared business logic.
- A real CLI exists for core TasteTrail operations.
- The CLI is suitable for OpenClaw automation and returns useful JSON.
- Core TasteTrail features still work in the new architecture.
- Documentation explains how to run the web app, native app, server surface, and CLI locally.
- The repo structure is coherent rather than transitional.

If a requirement is ambiguous, choose the path that produces the most durable architecture for Vercel + Neon + native app + OpenClaw CLI operability.
