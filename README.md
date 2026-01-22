# TasteTrail

A mobile-first web app for tracking restaurant menu items, recording notes, analysing food preferences, and sharing collections with family members.

## Features

- 📱 **Mobile-first PWA** - Install on your phone for native-like experience
- 🍽️ **Restaurant & Menu Tracking** - Keep track of dishes you've tried
- ⭐ **Ratings & Notes** - Rate items and add personal notes
- 📊 **Cuisine Statistics** - Visualize your food preferences
- 👨‍👩‍👧‍👦 **Family Sharing** - One shared workspace for the whole family
- 📥 **Menu Import** - Import menus from text, URLs, or photos
- 🔒 **Microsoft Authentication** - Secure sign-in with your Microsoft account

## Tech Stack

- **Frontend**: React, TypeScript, Vite, PWA
- **Backend**: Azure Functions (Node.js)
- **Database**: Neon PostgreSQL
- **Hosting**: Azure Static Web Apps
- **Auth**: Microsoft Entra External ID

## Prerequisites

- Node.js 18+
- npm or yarn
- [Azure Static Web Apps CLI](https://github.com/Azure/static-web-apps-cli) (for local dev)
- [Azure Functions Core Tools](https://github.com/Azure/azure-functions-core-tools)
- Neon PostgreSQL database

## Setup

### 1. Clone and Install

```bash
git clone https://github.com/your-username/TasteTrail.git
cd TasteTrail

# Install frontend dependencies
npm install

# Install API dependencies
cd api && npm install && cd ..
```

### 2. Database Setup

1. Create a [Neon PostgreSQL](https://neon.tech) database
2. Run the migration:

```bash
# Connect to your Neon database and run:
psql -h your-neon-host -U your-username -d your-database -f db/migrations/001_initial_schema.sql
```

### 3. Environment Variables

Create `api/local.settings.json`:

```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "",
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "DATABASE_URL": "postgres://your-neon-connection-string"
  }
}
```

### 4. Azure App Registration

1. Go to [Azure Portal](https://portal.azure.com) → Microsoft Entra ID
2. App registrations → New registration
3. Configure:
   - Name: TasteTrail
   - Supported account types: **Accounts in any organizational directory and personal Microsoft accounts**
   - Redirect URI: `https://your-app.azurestaticapps.net/.auth/login/aad/callback`
4. Copy the Application (client) ID
5. Create a client secret under Certificates & secrets

### 5. Local Development

```bash
# Terminal 1: Start API
cd api && npm start

# Terminal 2: Start frontend
npm run dev
```

Open http://localhost:5173

### 6. Deploy to Azure

```bash
# Install SWA CLI
npm install -g @azure/static-web-apps-cli

# Deploy
swa deploy --env production
```

Configure environment variables in Azure Portal:
- `AAD_CLIENT_ID`: Your app registration client ID
- `AAD_CLIENT_SECRET`: Your app registration client secret
- `DATABASE_URL`: Your Neon PostgreSQL connection string

## Project Structure

```
TasteTrail/
├── src/                    # React frontend
│   ├── components/         # Reusable UI components
│   ├── context/            # React context providers
│   ├── pages/              # Page components
│   ├── services/           # API client
│   └── types/              # TypeScript types
├── api/                    # Azure Functions backend
│   └── src/
│       ├── functions/      # API endpoints
│       ├── middleware/     # Auth middleware
│       └── db/             # Database client
├── db/
│   └── migrations/         # SQL migrations
└── public/                 # Static assets
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/workspaces` | Get user's workspaces |
| POST | `/api/workspaces` | Create workspace |
| GET | `/api/restaurants` | List restaurants |
| POST | `/api/restaurants` | Create restaurant |
| GET | `/api/restaurants/{id}` | Get restaurant |
| PUT | `/api/restaurants/{id}` | Update restaurant |
| DELETE | `/api/restaurants/{id}` | Delete restaurant |
| GET | `/api/restaurants/{id}/menu-items` | List menu items |
| POST | `/api/restaurants/{id}/menu-items` | Create menu item |
| GET | `/api/menu-items/{id}` | Get menu item |
| PUT | `/api/menu-items/{id}` | Update menu item |
| DELETE | `/api/menu-items/{id}` | Delete menu item |
| GET | `/api/search` | Search restaurants/items |
| GET | `/api/stats/cuisines` | Cuisine statistics |
| POST | `/api/imports` | Create import draft |
| POST | `/api/imports/{id}/commit` | Commit import |

## Collaboration

- **Owner**: Full access, can manage members
- **Editor**: Can add/edit restaurants and menu items
- **Viewer**: Read-only access

Invite family members by email from the Settings page.

## License

See [LICENSE](LICENSE) file.
