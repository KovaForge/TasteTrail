# AGENTS.md

## Non negotiable constraints
* Use Azure Static Web Apps for hosting the frontend.
* Use only the integrated Azure Functions that ship with Azure Static Web Apps for the backend.
* Do not use any other Azure services. This includes Microsoft Entra. It also includes Key Vault. Cosmos DB. Storage accounts. App Insights. Azure OpenAI. Service Bus. Cognitive Services. Any managed identity dependency.
* Use Neon PostgreSQL for all persistent storage.

## Authentication and accounts
* Do not implement Microsoft Entra based authentication.
* Implement app managed authentication using only Azure Static Web Apps plus Azure Functions plus Neon.
* Treat a user account as an email address owned by the user. Prefer Microsoft account emails but do not rely on Microsoft OAuth.
* Require sign in for all app usage.
* Support invite only access for the shared family workspace.
* Enforce all permissions server side.

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
  * Debug entries render in real time
  * Copy Debug Report button is available
* Behaviour when disabled:
  * Debug logs continue to be collected silently
  * Debug UI is hidden
* Owners can enable or disable Debug View for any user.
* Debug View must work without browser developer tools.

## AI provider keys
* Support user supplied OpenAI API keys and Gemini API keys.
* Store provider keys in Neon PostgreSQL under the signed in user account.
* Encrypt provider keys at rest using AES 256 GCM in Azure Functions.
* Store the encryption master key only as an Azure Functions application setting within the SWA environment.
* Never store provider keys in the browser. Never return provider keys to the client after save. Never log provider keys.

## Import processing
* Supported inputs are URL. screenshot image. pasted text.
* All parsing and transformation runs in Azure Functions.
* URL import must handle JavaScript rendered pages.
  * Use Playwright inside Azure Functions to render the page and extract visible text.
* Screenshot import must extract text without using external OCR services.
  * Use an in process OCR library that can run inside Azure Functions runtime.
* The AI call must return strict JSON drafts only.
* Always require a draft review step before commit.
* Never auto commit imported content.

## Data ownership and sharing
* Implement a Workspace model.
* A single shared family workspace is the default.
* Membership and roles are stored in Neon.
* Enforce workspace membership on every API request.
* Never trust client supplied identifiers without server validation.

## Implementation expectations
* Prefer React with TypeScript for the frontend.
* Keep the UI mobile first with bottom tab navigation.
* Keep state management simple and predictable.
* Use database migrations for schema changes.
* Provide a clear README with local run instructions and environment variables.

## Development Workflow
* Before any git commit & push, you must verify the build locally to prevent CI/CD failures.
* Run `cmd /c npm run build` (or equivalent) to ensure `tsc` and `vite build` pass.
* If the build fails, fix all errors before committing changes.
* This applies to both frontend and backend changes.

## Out of scope
* Any Azure service beyond Azure Static Web Apps plus integrated Azure Functions.
* Any authentication that depends on Microsoft Entra.
* Any background jobs or queues that require extra infrastructure.
