# AGENTS.md

## Non negotiable constraints
* Use Vercel for the web app and route handlers.
* Use Neon PostgreSQL for all persistent storage.
* Keep the backend portable within the repo. Shared business logic belongs in workspace packages, not in Vercel-only route files.
* Keep the app operable through a local CLI so OpenClaw can drive TasteTrail through shell execution.
* Keep the native app surface separate from the core web plus CLI workspace loop so web and CLI builds stay fast.

## Authentication and accounts
* Do not implement Microsoft Entra based authentication as the steady state model.
* Use passkeys as the target sign-in model.
* Microsoft sign-in may exist only as a migration bridge for claiming legacy account data.
* Require sign in for all app usage.
* Treat a user account as an email address owned by the user.
* Support invite only access for the shared family workspace.
* Enforce all permissions server side.

## Legacy migration
* Preserve the ability for a user to migrate Microsoft-account-based TasteTrail data into a passkey-based account.
* Prevent duplicate logical users during migration.
* Record legacy identity links in Neon.
* Make the migration flow explicit in both UI and backend APIs.

## Debug logging and visibility
* Every new webpage or screen must automatically register with the Debug Log system.
* A Debug Log entry must be created for:
  * Page load
  * API request start and failure
  * Unhandled UI error
  * Import parsing failure
* Each Debug Log entry must include:
  * Timestamp
  * Page or route name
  * User identifier
  * Workspace identifier
  * Correlation id if available
  * Severity level
  * Safe message text
* Never include secrets or API keys in Debug Logs.

### Debug View master toggle
* Implement a single master toggle called EnableDebugView.
* Toggle location:
  * Settings page
* Default state:
  * Disabled for all users
* Behaviour when enabled:
  * Debug View panel is visible in the UI
  * Debug entries render in real time or on refresh without browser developer tools
  * Copy Debug Report button is available
* Behaviour when disabled:
  * Debug logs continue to be collected silently
  * Debug UI is hidden
* Owners can enable or disable Debug View for any user.

## AI provider keys
* Support user supplied OpenAI API keys and Gemini API keys.
* Store provider keys in Neon under the signed in user account.
* Encrypt provider keys at rest using AES 256 GCM on the server.
* Keep the encryption master key only in server environment variables.
* Never store provider keys in the browser. Never return provider keys to the client after save. Never log provider keys.

## Import processing
* Supported inputs are URL, screenshot image, pasted text.
* All parsing and transformation runs on the server.
* URL import must be able to evolve toward JavaScript rendered page extraction.
* Screenshot import must extract text without external OCR services.
* The AI call must return strict JSON drafts only.
* Always require a draft review step before commit.
* Never auto commit imported content.

## Data ownership and sharing
* Implement a Workspace model.
* A single shared family workspace is the default.
* Membership and roles are stored in Neon.
* Enforce workspace membership on every API request.
* Never trust client supplied identifiers without server validation.

## Native and CLI expectations
* Keep shared types and domain logic reusable between web, native, and CLI surfaces.
* The CLI must support authentication, workspace inspection, restaurant operations, imports, stats, and debug log access.
* Document CLI usage clearly enough for OpenClaw shell execution.
* The native app should consume the same backend contracts and shared domain model as the web app.

## Implementation expectations
* Prefer TypeScript across web, server, shared packages, CLI, and native scaffolding.
* Keep the UI mobile first with bottom tab navigation patterns where they fit.
* Keep state management simple and predictable.
* Use database migrations for schema changes.
* Provide a clear README with local run instructions and environment variables.

## Development Workflow
* Before any git commit and push, verify the build locally to prevent CI/CD failures.
* Run `npm run build` from the repo root and fix all errors before committing changes.
* This applies to both web and CLI changes. Native scaffolding can remain out of the root build if intentionally isolated.

## Out of scope
* Reintroducing Azure Static Web Apps or Azure Functions as the primary runtime.
* Any authentication design that depends on Microsoft Entra in steady state.
* Any backend design that prevents OpenClaw from operating TasteTrail through a CLI.

## GitHub Issue Creation Workflow
When a bug or feature is identified or provided by user, follow this process:

1. **Inspect** the relevant code files, classes, components, functions.
2. **Identify** the most important affected class names, file paths, component names.
3. **Classify**:
   - If broken, incorrect, error, or crash then **BUG** with label `bug`
   - If new feature, missing capability, or improvement then **FEATURE REQUEST** with label `enhancement`
4. **Create a GitHub issue using gh CLI**:
   - Title: `[BUG]` or `[FEATURE]` plus a clear concise title
   - Body: structured Markdown with:
     - Reproduction and expected versus actual for bugs
     - Use case and benefit for features
     - Bolded affected **ClassName**, **FilePath**, **Component**
     - Any logs or errors
5. **Report**:
   - The exact `gh` command ran
   - The created issue URL
   - Confirmation of classification and labels
