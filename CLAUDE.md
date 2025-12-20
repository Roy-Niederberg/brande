# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Philosophy

**Minimalism First**
- This is early-stage development - most code hasn't been reviewed and functionality may be experimental
- No README files, no extra documentation unless absolutely necessary
- Code should be ~50-60 lines per file maximum (see `services/prompt_composer/src/server.js` as reference)
- One-liner functions preferred
- Minimal error handling and logging - only what's essential
- **Code runs ONLY in containers** - never worry about local file paths or environment variables
- All configuration responsibility delegated to docker-compose files

**Whitelist .gitignore Strategy**
- Ignore everything by default (`*` at root)
- Explicitly whitelist only necessary files:
  - `docker-compose.yml`
  - `Dockerfile`
  - `.gitignore`
  - `.gitlab-ci.yml`
  - Service-specific files added in their respective directories

**When Writing Code**
- Follow the prompt_composer service style: concise, functional, container-first
- Don't add defensive error handling or extensive logging
- Let Docker handle paths, secrets, and environment concerns
- Keep functions small and inline where possible
- Functionality may be temporary/experimental - don't over-engineer

**Environment Variables**
- Avoid environment variables when possible
- When necessary for simplicity, require them explicitly - NO defaults
- Service must crash on startup if required env var is missing
- Example: `if (!process.env.VAR) throw new Error('VAR is required')`

## Architecture Overview

**Brandelicious/Qabu** (shortened to "Brande" in this repo) is a microservices-based platform for AI-powered customer conversation management. Each client gets their own subdomain with isolated services.

**Note**: Company is considering rebrand from "Brandelicious" to "Qabu" - keep both names in code for now.

### Two-Server Architecture

**Main Server** (qabu.mooo.com / brandelicious.mooo.com - both point to same IP)
- Runs company website and shared services
- Deployed via `prod_setup/main_server/docker-compose.yml`
- Services:
  - `services/main_router/` - Caddy serving company website
  - `services/facebook_signup/` - Facebook page token generation tool (manual process)

**Client Server** (separate VM)
- Runs client-specific services with isolation
- Deployed via `prod_setup/{client_name}/docker-compose.yml`
- Services:
  - `services/router/` - Caddy for HTTPS termination and inter-client routing
  - `services/admin/` - Admin interface per client
  - `services/prompt_composer/` - LLM service per client
  - `services/facebook_*` - Facebook integration services
  - `services/site/` - Client public website
- Future: Plan to move Facebook webhooks to main server

### Domain Structure
- `qabu.mooo.com` / `brandelicious.mooo.com` - Company main page (main server)
- `craftkidstoys.mooo.com` - CraftKids Toys client (client server)
- `drlipokatz.mooo.com` - Dr Lipo Katz client (client server)

### Services Architecture

**Main Router Service** (`services/main_router/`)
- Runs on main server
- Caddy serving company website and shared tools
- Handles `/facebook-page-signup/*` routing to facebook-signup service
- Configured in `services/main_router/src/Caddyfile`

**Client Router Service** (`services/router/`)
- Runs on client server
- Caddy-based reverse proxy for HTTPS termination and client routing
- Routes to `{client_name}-{service_name}:9876` using path-based routing
- Pattern: `http://*.mooo.com/{service}` → `{client_name}-{service}-1:9876`
- Serves unified chat widget at `/widget.js`
- Configured in `services/router/src/Caddyfile`

**Admin Service** (`services/admin/`)
- Node.js/Express web application with Google OAuth authentication
- Simple landing page at `/` with Google sign-in, chat interface at protected `/chatQA`
- Google OAuth integration with email whitelist (`./data/authorized_emails.json`)
- File-based session management using session-file-store
- Trust proxy enabled for HTTPS termination by Caddy
- Auto RTL/LTR text direction detection for Hebrew/English content
- Mobile-responsive with dynamic viewport height (dvh) units
- Protected routes: `/chatQA`, `/style.css`, `/script.js`
- API endpoints: `/api/user`, `/api/initial-content`, `/api/chat`
- Main entry: `services/admin/src/server.js` (~80 lines)

**Prompt Composer Service** (`services/prompt_composer/`)
- LLM service that processes queries using Google Gemini and Groq APIs
- **Trust proxy enabled**: `app.set('trust proxy', true)` for rate limiting behind Caddy
- Loads configuration from text files in `/app/data/`:
  - `role.txt` - AI assistant role definition
  - `instructions.txt` - Job instructions
  - `knowledge_base.txt` - Company information
  - `response_guidelines.txt` - Response formatting rules
- Multiple LLM providers with fallback:
  - `llm_1`, `llm_2` - Google Gemini (gemini-flash-lite-latest)
  - `llm_3`, `llm_4` - Groq (openai/gpt-oss-120b)
  - Tries each LLM in sequence until one succeeds
- Exposes endpoints:
  - `POST /ask` - Generate response (with module-specific query builder)
  - `GET /knowledge-base` - View knowledge base
  - `GET /prompt-instructions` - View instructions
  - `POST /knowledge-base` - Update knowledge base
  - `POST /instructions` - Update instructions
  - `POST /reload-knowledge-base` - Reload knowledge base from disk
  - `POST /reload-instructions` - Reload instructions from disk
- Main entry: `services/prompt_composer/src/server.js`

**Facebook Services**
Multiple services handle different Facebook integrations:
- `services/facebook_dispatcher/` - Main webhook receiver, routes to appropriate handlers
- `services/facebook_comments/` - Handles comment events, integrates with Prompt Composer
- `services/facebook_dm/` - Handles direct message events, integrates with Prompt Composer
- All services validate signatures using APP_SECRET
- Fetch full event details via Graph API
- **Fully operational**: Auto-replies to comments and DMs using AI responses

**Site Service** (`services/site/`)
- Public-facing website service for each client
- Currently serves privacy policy and other public pages

**Widget Service** (`services/router/public/widget.js`)
- Unified chat widget embedded on client websites
- Self-contained IIFE with all CSS and HTML inline
- Served at `/widget.js` from client router
- **Key Features**:
  - WhatsApp-style UI with green user bubbles (#dcf8c6) and white bot bubbles
  - Glassmorphism background effect
  - Message bubbles with 3 rounded corners + 1 sharp corner (no SVG tails)
  - **Always LTR layout** - widget on right, user messages on right, bot on left
  - **Smart text direction** - auto-detects Hebrew/RTL vs English/LTR per message (>30% Hebrew = RTL)
  - Multi-line textarea input with auto-resize (max 100px)
  - Send button with paper plane icon (circular, 44x44px)
  - Minimize/Close/Reopen functionality
  - Click-outside to minimize
  - **Markdown support**:
    - Bold: `**text**` or `__text__`
    - Italic: `*text*` or `_text_`
    - Code: `` `text` ``
    - Links: `[text](url)`
    - Bullet lists: `* item` or `- item`
  - Mobile-responsive with dvh units and safe-area insets
  - Typing indicator with bouncing dots
- API endpoint: `POST /widget-api/ask` → routed to prompt-composer
- Query builder: `widget_query_builder.js` formats chat history

### Data Flow

1. **Admin Chat**: Admin UI → Prompt Composer → LLM (Gemini/Groq) → Response
2. **Widget Chat**: Client website → `/widget-api/ask` → Prompt Composer → LLM → Response
3. **Facebook Comments**: Facebook → Dispatcher → Comments Handler → Prompt Composer → LLM → Auto-reply posted to Facebook
4. **Facebook DMs**: Facebook → Dispatcher → DM Handler → Prompt Composer → LLM → Auto-reply sent via Messenger

### Configuration Management

**Development** (`dev_setup/`)
- `secrets/authorized_emails.json` - Email whitelist for UI access

**Production** (`prod_setup/`)
- Main server: `prod_setup/main_server/` - company website and shared tools
- Client server deployments: `prod_setup/craftkidstoys/`, `prod_setup/drlipokatz/`
- Each client has: router, admin, prompt-composer, facebook services, site, widget
- Shared data volumes in `data/` for prompt configuration and query builders
- Each service has docker-compose.yml with secrets management
- New clients require manual setup (not automated yet)

## Development Commands

### Running Services

All services run in Docker containers only:

```bash
# Run any service
cd services/{service_name}
docker-compose up

# Router service
cd services/router
docker build -t router .
docker run -p 80:80 router
```

**Note**: Services are designed to run ONLY in containers. Docker Compose handles all environment variables, secrets, and file paths.

### Environment Variables

Configuration is managed through docker-compose.yml files. Services expect:

**Admin Service**: Google OAuth credentials via `/run/secrets/google_strategy`, session config via `/run/secrets/session_config`
**Prompt Composer**: Gemini API key via Docker secrets at `/run/secrets/llm_api_key`, LLM endpoint via `LLM` env var
**Facebook Services**: App secret, verify token, page access token via Docker secrets

See individual service docker-compose.yml files for exact configuration.

## Adding New Services

When creating a new service, follow this workflow:

1. **Create service directory** under `services/{service_name}/`:
   - `src/` - service implementation code
   - `docker-compose.yml` or `test/` - for local development/testing
   - `Dockerfile`, `.gitignore` - containerization

2. **Ask which client(s)** need this service deployed

3. **Add to production** in `prod_setup/{client_name}/docker-compose.yml` for each selected client

**Important**: Not all clients need all services. Each client's production setup is independent.

## CI/CD

### GitLab CI Pipeline

Root `.gitlab-ci.yml` uses trigger strategy to build services independently when their directories change. Each service has its own `.gitlab-ci.yml`:

```bash
# Triggers only on main branch when service files change
# Builds and pushes to GitLab Container Registry
# Tags: {branch}-{commit-sha} and latest
```

Active services in CI/CD: `router`, `admin`, `prompt_composer`, `facebook_dispatcher`, `facebook_comments`, `facebook_dm`, `site`

### Docker Images

Images are pushed to: `registry.gitlab.com/{group}/{project}/{service}:latest`

Example: `registry.gitlab.com/rny3/brande/prompt_composer:latest`

## Key Implementation Details

### Authentication Flow (Admin Service)
1. User visits `/` → sees landing page with "Sign in with Google" button
2. Click sign-in → redirects to `/login/` (Google OAuth)
3. Google OAuth callback → `/login/callback` validates email against whitelist
4. If authorized → redirects to `/chatQA`, else redirects to `/`
5. Session stored in file-based store (`./sessions` directory)
6. Protected routes use `isAuthorized` middleware (one-liner ternary)
7. API routes use `checkSession` middleware
8. Trust proxy enabled via `app.set('trust proxy', true)` for HTTPS cookie security

### Prompt Composition Pattern
The Prompt Composer service constructs prompts by concatenating:
```
role + instructions + knowledge_base + query + response_guidelines
```
This is assembled in `services/prompt_composer/src/server.js:38,44`

**Query Builders**: Different modules (facebook_comments, facebook_messages, admin_ui) use custom query builder functions to format conversation context into structured queries. These are loaded from `/app/data/` and selected based on the module specified in POST requests to `/ask`.

### Auto RTL/LTR Text Direction
The admin frontend automatically detects Hebrew vs English text and sets `dir` attribute:
- Detection function counts Hebrew characters (Unicode U+0590 to U+05FF)
- If >30% Hebrew → RTL, else LTR
- Applied to: instructions textarea, knowledge base textarea, chat input, chat messages
- Updates in real-time as user types (`services/admin/src/views/script.js`)

### Router Dynamic Routing
The Caddy configuration uses regex to extract app names from paths and route to Docker services with predictable naming: `{labels.2}-{re.app.1}-1:9876` where `labels.2` is the client name and `re.app.1` is the service name.

### Mobile Responsiveness
Admin UI is fully responsive with special mobile optimizations:
- Uses `dvh` (dynamic viewport height) units to handle mobile keyboard
- Fixed body position prevents scroll issues
- Smaller header on mobile (50px vs 60px desktop)
- Grid layout: 25% instructions / 75% chat on mobile
- Input scrolls into view when keyboard appears
- Font-size 16px on input prevents iOS auto-zoom
- Sticky input container with `flex-shrink: 0` ensures visibility
- Proper flex layout chain prevents content overflow

## Production Deployment

Two-server deployment structure:
```
prod_setup/
  ├── main_server/         # Main server (qabu.mooo.com)
  │   ├── docker-compose.yml
  │   └── secrets/
  └── client_name/         # Client server (e.g., craftkidstoys, drlipokatz)
      ├── docker-compose.yml
      ├── secrets/         # Client-specific secrets
      └── data/            # Mounted volumes for config
```

### Network Architecture (Client Isolation)

**Client Server - Each client has a private network:**
- `craftkidstoys_network` - contains craftkidstoys services (router, admin, prompt-composer, facebook services, site)
- `drlipokatz_network` - contains drlipokatz services (router, admin, prompt-composer, facebook services, site)
- Client router joins **all** client networks as external networks

**Main Server - Simple single network:**
- Main router and facebook-signup share default network
- No client isolation needed on main server

**Benefits:**
- Complete isolation between clients on client server (no shared DNS namespace)
- Each client's services can only communicate within their own network
- Client router can reach all client services for HTTP routing
- No cross-client data leakage

**Deployment Process:**

1. **Make changes** to services in development
2. **Commit changes** to git (on `dev` branch)
3. **Create and push tags** for changed services:
   ```bash
   git tag <service_name>-v<version>  # e.g., main_router-v0.0.5, admin-v0.0.2
   git push origin <service_name>-v<version>
   ```
4. **Wait for CI/CD** - GitLab CI automatically builds Docker images when tags are pushed (see `.gitlab-ci.yml`)
   - Images are pushed to GitLab Container Registry: `registry.gitlab.com/rny3/brande/<service>:latest`
5. **Sync prod_setup to appropriate server** using rsync:
   ```bash
   # For main server
   rsync -avz prod_setup/main_server/ user@mainserver:/path/to/prod_setup/main_server/

   # For client server
   rsync -avz prod_setup/craftkidstoys/ user@clientserver:/path/to/prod_setup/craftkidstoys/
   ```
6. **On the server**, pull new images and recreate containers:
   ```bash
   cd /path/to/prod_setup/<deployment>
   docker compose pull
   docker compose up -d --force-recreate
   ```

**Important Notes:**
- Tags should be on `dev` branch (not `main`)
- Production runs whatever is in `prod_setup/` directory
- Docker images are tagged as `latest` by CI, so `docker compose pull` gets the newest build
- Service-specific changes: tag and deploy only that service
- **Two separate servers**: main server and client server require separate rsync/deployment
- **Widget changes**: Served from client router, requires client server deployment
- **Facebook signup**: On main server at `/facebook-page-signup/` path

**Deployment order for initial client setup (client server only):**
```bash
# 1. Start client services first (creates networks)
cd prod_setup/craftkidstoys && docker compose up -d
cd prod_setup/drlipokatz && docker compose up -d
```

Note: Each client's docker-compose includes their own router, no shared router on client server.
