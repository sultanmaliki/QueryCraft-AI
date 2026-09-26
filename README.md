# QueryCraft AI

An AI-powered database query assistant. Describe what you want in plain English and QueryCraft generates the query, explains it, and can run it against your data. It supports SQL, MongoDB, Cypher and several other query languages, and can route each request to a local model (Ollama), OpenRouter, or Google Gemini.

[![QueryCraft Homepage](https://syedmohammedsultan.online/assets/QueryCraft-uGgk6l1y.png)](https://querycraft.hubzero.in)

## Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Getting started](#getting-started)
- [Configuration](#configuration)
- [Running the project](#running-the-project)
- [Models and routing](#models-and-routing)
- [Data sources](#data-sources)
- [API reference](#api-reference)
- [Security notes](#security-notes)
- [Testing](#testing)
- [Known limitations](#known-limitations)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

## Overview

QueryCraft is a two-part application:

- **Backend** (`querycraft-backend/`): a Node.js/Express API that authenticates users, stores chats in MongoDB, calls the LLM providers, and executes queries against user-supplied data sources.
- **Frontend** (`querycraft-frontend/`): a Next.js chat interface with a landing page, sign-in, a model picker, syntax-highlighted query cards and a **Run** button that shows results in a table.

When you send a prompt, the backend detects which query language you want, picks or honours a model, sends a guided prompt (plus the recent chat context) to the LLM, and returns the answer in a fixed format: the query in a fenced code block followed by an explanation. **Queries are never run automatically.** You run one explicitly from the query card, against an uploaded file or a connection string you provide.

## Features

- **Multiple LLM providers**: local models through Ollama, OpenRouter (DeepSeek R1, Qwen, Grok Code, Mistral and others), and Google Gemini. Choose a model in the UI or let **Auto** decide.
- **Query language detection**: recognises SQL, MongoDB, Cypher, GraphQL, CQL, Redis, Elasticsearch and DynamoDB from keywords and structure, and steers the LLM toward that language.
- **Run queries from the chat**: execute the generated query against an uploaded file or a connection string and see rows in a table (see [Data sources](#data-sources)).
- **File uploads**: query CSV, JSON, SQLite (`.sqlite`, `.db`) or SQL dump (`.sql`) files, up to 100 MB.
- **Chat history**: chats and queries are stored per user in MongoDB. The last three completed exchanges of a chat are sent back to the model as context.
- **Authentication**: sign-up and login with bcrypt-hashed passwords and 7-day JWTs.
- **Rate limiting and security headers**: `express-rate-limit` and Helmet (see [Security notes](#security-notes)).
- **Landing page with live demo**: an unauthenticated NL-to-query demo endpoint.
- **UI**: dark-first theme with a light/dark/system preference, voice input (browser speech recognition, where supported), chat management and toast notifications.

## Architecture

```mermaid
flowchart TB
    subgraph Client["Browser: Next.js frontend"]
        Intro["IntroPage<br/>landing page + live demo"]
        Auth["AuthPage<br/>sign in / sign up"]
        ChatUI["ChatApp<br/>chat, model picker, Run button"]
    end

    subgraph Server["Express backend (Node.js)"]
        MW["Middleware<br/>rate limiting, Helmet, CORS, JWT"]
        Routes["Routes<br/>/api/auth, /api/chat, /api/query, /api/db"]
        LLM["utils/llm.js<br/>model routing and provider calls"]
        Exec["controllers/dbController.js<br/>query execution"]
        MW --> Routes
        Routes --> LLM
        Routes --> Exec
    end

    Client -->|"HTTP / JSON"| MW
    LLM --> Ollama["Ollama<br/>local models"]
    LLM --> OR["OpenRouter"]
    LLM --> Gemini["Google Gemini"]
    Routes --> Mongo[("MongoDB<br/>users, chats, queries")]
    Exec --> Targets["Your data<br/>SQLite / CSV / JSON / SQL files<br/>PostgreSQL, MySQL / MariaDB<br/>MongoDB, Neo4j"]
```

MongoDB holds application data only (users, chats, queries). The databases you query are separate and are reached only through `/api/db/execute`.

### Request flow

1. **Prompt**: the frontend sends `POST /api/query` with the prompt, optional `chatId` and optional `model`, plus the JWT.
2. **Sanitising**: the prompt has null bytes removed, whitespace collapsed and length capped at 4,000 characters. Triple backticks are neutralised before the prompt is embedded in the LLM instructions.
3. **Chat lookup**: the chat is loaded (and must belong to the user), or a new one is created titled with the first 50 characters of the prompt. The last three completed exchanges (each prompt and the query it produced) are added as context, capped at 1,800 characters.
4. **Language detection**: keywords such as "Cypher", "Neo4j", "GraphQL" or "Cassandra", or the structure of a pasted query, select the target language. If nothing matches, the LLM chooses between SQL and MongoDB (SQL by default).
5. **Model selection**: an explicit model is used as given; `auto` (or no model) applies the routing heuristics in [Models and routing](#models-and-routing).
6. **LLM call**: the query is saved as `pending`, the provider is called, and the record becomes `done` or `failed`.
7. **Output formatting**: the answer is normalised to `Here's the query`, then the query in a fenced block, then an explanation.
8. **Run (optional)**: the user clicks **Run** on the query card, which calls `POST /api/db/execute` with an uploaded file ID or a saved connection string.

## Tech stack

**Backend**

- Node.js 20, Express 4
- MongoDB with Mongoose 7 for application data
- Query execution drivers: `better-sqlite3`, `pg`, `mysql2`, `mongodb`, `neo4j-driver`, `csv-parser`
- LLM access: `@google/genai` (Gemini), `axios` (OpenRouter and Ollama)
- Auth and hardening: `jsonwebtoken`, `bcryptjs`, `helmet`, `express-rate-limit`, `cors`
- Uploads and logging: `multer`, `morgan`, `response-time`
- Dev tooling: `nodemon`

**Frontend**

- Next.js 15 (App Router), React 19, TypeScript 5
- Tailwind CSS 4, Radix UI primitives, `class-variance-authority`, `lucide-react`
- `framer-motion` (animation), `three` with `@react-three/fiber` and `@react-three/drei` (3D landing-page hero)
- `prismjs` (syntax highlighting), `sonner` (toasts), `next-themes` (theming)
- ESLint 9

## Project structure

```
QueryCraft-AI/
├── .github/workflows/node.js.yml    # GitHub Actions workflow
├── LICENSE
├── README.md
│
├── querycraft-backend/
│   ├── index.js                     # App setup, middleware, routes, Mongo connection, health check
│   ├── Dockerfile
│   ├── package.json
│   ├── controllers/
│   │   └── dbController.js          # File upload metadata + query execution for all data sources
│   ├── middleware/
│   │   └── auth.js                  # JWT verification
│   ├── models/                      # Mongoose schemas: User, Chat, Query
│   ├── routes/
│   │   ├── auth.js                  # /api/auth
│   │   ├── chat.js                  # /api/chat
│   │   ├── query.js                 # /api/query: language detection, model routing, prompt building
│   │   └── db.js                    # /api/db: upload and execute
│   └── utils/
│       ├── llm.js                   # Provider calls (Gemini, OpenRouter, Ollama) and model aliases
│       ├── responseParser.js        # Extracts text/SQL from provider responses
│       └── conversationMemory.js    # Chat summariser (not wired into any route yet)
│
└── querycraft-frontend/
    ├── package.json
    ├── next.config.ts, tailwind.config.ts, postcss.config.mjs, eslint.config.mjs, tsconfig.json
    ├── public/                      # Static assets
    └── src/
        ├── app/                     # layout.tsx, page.tsx (view router: intro / auth / chat), globals.css
        ├── components/
        │   ├── auth/                # AuthProviderClient (auth context, auto-login)
        │   ├── chat/                # ChatWindow, ChatInput, ChatMessage, ChatHeader (model picker), CodeCard, TypingIndicator
        │   ├── layout/              # Sidebar, ChatSidebar, Header, MobileSidebarTrigger
        │   ├── modals/              # DatabaseImportDialog, SettingsDialog
        │   ├── pages/               # IntroPage, AuthPage, ChatApp
        │   └── ui/                  # Radix-based UI primitives
        ├── hooks/                   # useAutoLogin
        ├── lib/                     # utils.ts (class-name helper)
        └── types/                   # Type declarations for prismjs and react-three
```

Two files appear at runtime and are git-ignored: `querycraft-backend/uploads/` (uploaded files) and `querycraft-backend/db_files.json` (metadata index for those uploads).

## Getting started

### Prerequisites

- **Node.js 20 or newer** and npm
- **MongoDB**, local or hosted (for example MongoDB Atlas)
- At least one LLM provider:
  - [Ollama](https://ollama.com/) for local models, and/or
  - an [OpenRouter](https://openrouter.ai/) API key, and/or
  - a [Google Gemini](https://ai.google.dev/) API key
- Optional: Docker

### Install

```bash
git clone https://github.com/sultanmaliki/QueryCraft-AI.git
cd QueryCraft-AI

cd querycraft-backend && npm install
cd ../querycraft-frontend && npm install
```

## Configuration

There are no `.env.example` files in the repository, so create the two env files yourself.

### Backend: `querycraft-backend/.env`

`dotenv` reads this file from the directory you start the server in, so run the backend from `querycraft-backend/`.

| Variable | Default | Purpose |
|----------|---------|---------|
| `MONGO_URI` | `mongodb://localhost:27017/querycraft` | MongoDB connection string. The server exits if it cannot connect. |
| `PORT` | `5001` | HTTP port. Note that `npm start` forces `PORT=5001`. |
| `JWT_SECRET` | `change_this_in_production` | Secret used to sign and verify JWTs. **Always set your own.** |
| `LLM_ENDPOINT` | `http://127.0.0.1:11434/api/generate` | Ollama-style endpoint for local models. |
| `DEFAULT_MODEL` | `mistral:7b-instruct` | Local model tag used when a request names no model or an unknown one. Sent as-is to `LLM_ENDPOINT`. |
| `GENAI_KEY` or `GOOGLE_GENAI_KEY` | none | Google Gemini API key. Required for Gemini models. |
| `OPENROUTER_KEY` | none | OpenRouter API key. Required for `or-*` models and the `mistral` aliases. |
| `OPENROUTER_SITE_URL` | `https://localhost` | Sent as the `HTTP-Referer` header to OpenRouter. |
| `OPENROUTER_APP_NAME` | `QueryCraft` | Sent as the `X-Title` header to OpenRouter. |
| `GEMINI_RETRIES` | `3` | Total attempts for transient Gemini errors. |
| `GEMINI_BASE_DELAY_MS` | `500` | Initial backoff delay between Gemini retries. |
| `GEMINI_MAX_BACKOFF_MS` | `5000` | Maximum backoff delay. |
| `SUMMARY_MODEL`, `SUMMARY_OLDEST_COUNT`, `SUMMARY_MAX_TOKENS` | `mistral:7b-instruct`, `15`, `400` | Only read by `utils/conversationMemory.js`, which no route calls yet. |

Minimal example:

```bash
MONGO_URI=mongodb://localhost:27017/querycraft
JWT_SECRET=replace-with-a-long-random-string
GENAI_KEY=your-gemini-key
OPENROUTER_KEY=your-openrouter-key
```

Generate a strong secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Frontend: `querycraft-frontend/.env.local`

```bash
NEXT_PUBLIC_API_BASE=http://localhost:5001
```

Always set this. A few components fall back to the hosted API (`https://apiquerycraft.hubzero.in`) when it is missing, and the sign-in flow does not, so leaving it unset gives a confusing mix of local and hosted behaviour.

### Local models with Ollama

The backend sends these tags to Ollama exactly as written, so they must exist in your local Ollama install: `qwen:4b`, `llama3.2:1b` and `phi3:mini-4k-instruct` (used by the **Auto** router and the demo), and `mistral:7b-instruct` (the default). Pull the ones you need with `ollama pull <tag>`, or alias an equivalent with `ollama cp`.

## Running the project

### Development

Backend (port 5001):

```bash
cd querycraft-backend
npm run dev
```

Frontend (port 3000):

```bash
cd querycraft-frontend
npm run dev
```

Then open <http://localhost:3000>.

> **Windows:** the npm scripts use POSIX-style inline variables (`NODE_ENV=development nodemon index.js`), which fail in `cmd` and PowerShell. Run `npx nodemon index.js` (or `node index.js`) directly, or use Git Bash or WSL.

### Production

```bash
# Backend
cd querycraft-backend
npm start

# Frontend
cd querycraft-frontend
npm run build
npm start
```

### Docker (backend only)

```bash
cd querycraft-backend
docker build -t querycraft-backend .
docker run -p 5001:5001 --env-file .env querycraft-backend
```

Things to know:

- From inside a container, `localhost` is the container. Point `MONGO_URI` and `LLM_ENDPOINT` at addresses the container can reach, for example `host.docker.internal`.
- There is no `.dockerignore`, and the Dockerfile runs `COPY . .` after `npm install`. Build from a checkout without a local `node_modules`, or a host-built `better-sqlite3` binary can overwrite the container's.
- Uploaded files and `db_files.json` live inside the container filesystem and are lost when the container is removed unless you mount volumes for them.

## Models and routing

The model picker in the UI offers **Auto**, Qwen 4B, Gemini, Phi-3 Mini, Llama 1B, Mistral 7B, DeepSeek R1, Grok Code Fast, Qwen3 235B A22B and Qwen3 Coder. The backend only accepts known aliases; an unknown model name falls back to `DEFAULT_MODEL`.

| Alias(es) | Resolves to | Provider |
|-----------|-------------|----------|
| `qwen4`, `qwen:4b` | `qwen:4b` | Ollama (local) |
| `llama1b`, `llama3.2:1b` | `llama3.2:1b` | Ollama (local) |
| `phi3`, `phi3-mini`, `phi3-mini-4k-instruct`, `phi3:mini-4k-instruct` | `phi3:mini-4k-instruct` | Ollama (local) |
| `gemini`, `gemini-2.5-flash` | `gemini-2.5-flash` | Google Gemini |
| `mistral`, `mistral:7b`, `mistral:7b-instruct` | `mistralai/mistral-7b-instruct:free` | OpenRouter |
| `or-deepseek-r1` | `deepseek/deepseek-r1` | OpenRouter |
| `or-qwen2.5-72b-free` | `qwen/qwen-2.5-72b-instruct:free` | OpenRouter |
| `or-qwen3-235b-a22b` | `qwen/qwen3-235b-a22b:free` | OpenRouter |
| `or-qwen3-coder` | `qwen/qwen3-coder:free` | OpenRouter |
| `or-grok-code-fast` | `x-ai/grok-code-fast-1` | OpenRouter |

**Auto routing** (`model: "auto"` or no model) is a set of heuristics in `routes/query.js`:

- The prompt already looks like a query (under 2,000 characters): local Phi-3 Mini.
- Vector or semantic search wording: DeepSeek R1.
- MongoDB or SQL requests: local Qwen 4B.
- Code-like prompts: Grok Code Fast.
- Long or explanation-heavy prompts, and anything else: Gemini 2.5 Flash.

Defaults: `max_tokens` 512 and `temperature` 0.2 (the demo endpoint uses 256 and 0.0). Retries with exponential backoff and jitter apply to Gemini calls only. OpenRouter calls time out after 30 seconds and local calls after 120 seconds.

## Data sources

QueryCraft can generate queries for more languages than it can run.

| Data source | Generate | Run from the UI |
|-------------|:--------:|:---------------:|
| SQL (generic ANSI-style) | Yes | Yes |
| SQLite / `.db` files | Yes | Yes (opened read-only) |
| CSV, JSON, SQL dump uploads | Yes | Yes (loaded into a temporary SQLite database) |
| PostgreSQL (`postgres://`, `postgresql://`) | Yes | Yes (10 s statement timeout) |
| MySQL / MariaDB (`mysql://`, `mariadb://`) | Yes | Yes |
| MongoDB (`mongodb://`, `mongodb+srv://`) | Yes | Yes (`find` with a filter only) |
| Neo4j / Cypher (`neo4j://`, `bolt://`, `http(s)://`) | Yes | Yes (Bolt, with HTTP fallback) |
| Cassandra CQL, Redis, Elasticsearch, DynamoDB, GraphQL | Yes | No |

How uploaded files are loaded:

- `.sqlite` and `.db` files are opened directly and read-only.
- `.csv` files become a table named `imported_csv` (all columns are `TEXT`).
- `.json` files (an array of objects, or a single object) become a table named `imported_json`.
- `.sql` files are executed into a temporary SQLite database, so the table names come from your script.
- Files with other extensions are sniffed: content starting with `[` is treated as JSON, anything else as CSV.

Connection strings are saved in your browser's `localStorage` (`qc_conn_default`) and sent to the backend each time you press **Run**.

## API reference

Base URL: `http://localhost:5001`. Protected endpoints need `Authorization: Bearer <token>`. Most errors have the form `{ "error": "message" }`, and some also include a `message` field with details.

### Rate limits

| Scope | Limit |
|-------|-------|
| All endpoints, per IP | 100 requests per minute (`/api/query/demo` is exempt from this one) |
| `POST /api/query` and `POST /api/query/demo`, per IP | 10 requests per minute |

Exceeding a limit returns `429`, with standard `RateLimit-*` headers.

### Health

`GET /` returns `{ "status": "QueryCraft backend is up", "mongo": "connected" }` (`mongo` is `disconnected` when the database is unreachable).

### Auth

**`POST /api/auth/signup`**: body `{ "name", "email", "password" }`. Returns `201` with `{ "user", "token" }`. Errors: `400` if a field is missing, `409` if the email is taken. Emails are lower-cased and trimmed, and no password strength rules are enforced.

**`POST /api/auth/login`**: body `{ "email", "password" }`. Returns `{ "user", "token" }`. Errors: `400` missing fields, `401` invalid credentials.

**`GET /api/auth/me`** (auth): returns `{ "user": { "_id", "name", "email", "role", "createdAt" } }`.

Tokens expire after 7 days. That value is fixed in `routes/auth.js` and is not configurable through the environment.

### Chats (auth)

| Endpoint | Description |
|----------|-------------|
| `GET /api/chat` | The user's chats, most recently updated first. |
| `POST /api/chat` | Create a chat. Body `{ "title"? }` (default `"New Chat"`). Returns `201` with the chat. |
| `GET /api/chat/:id` | `{ "chat", "queries" }` with queries oldest first. `404` if the chat is not the user's. |
| `DELETE /api/chat/:id` | Delete a chat and its queries. Returns `{ "success": true }`. |
| `DELETE /api/chat` | Delete all of the user's chats and queries. Returns `{ "success": true }`. |

A query record has `_id`, `user`, `chat`, `prompt`, `response`, `model`, `status` (`pending`, `done` or `failed`), `usage`, `raw` and `createdAt`.

### Generate a query

**`POST /api/query`** (auth, 10/min)

```json
{
  "chatId": "507f1f77bcf86cd799439012",
  "prompt": "Get all orders from last month with total greater than 1000",
  "model": "auto",
  "max_tokens": 512,
  "temperature": 0.2
}
```

Only `prompt` is required. Without `chatId`, a new chat is created. Response (the `response` string contains a fenced code block, so it is shown here in a four-backtick fence):

````json
{
  "queryId": "507f1f77bcf86cd799439015",
  "chatId": "507f1f77bcf86cd799439012",
  "model": "qwen:4b",
  "status": "done",
  "createdAt": "2026-03-15T10:05:00.000Z",
  "updatedAt": "2026-03-15T10:05:02.000Z",
  "response": "Here's the query\n\n```sql\nSELECT * FROM orders WHERE ...;\n```\n\nExplanation: ..."
}
````

Errors: `400` empty prompt, `404` chat not found, `500` `{ "error": "LLM request failed", "message": "..." }` (the stored query is marked `failed`).

**`POST /api/query/demo`** (no auth, 10/min): body `{ "prompt", "model"?, "max_tokens"?, "temperature"? }`. Returns `{ "status": "ok", "response": "<query text only>" }`. If the prompt is too ambiguous, `response` is a message asking for clarification instead. Nothing is stored.

### Upload and execute (no authentication; see [Security notes](#security-notes))

**`POST /api/db/upload`**: `multipart/form-data` with a `file` field (max 100 MB).

```json
{
  "success": true,
  "file": {
    "id": "0b2f5c4e-9d1a-4f5e-8a44-5c6f0f1d7a21",
    "originalName": "data.csv",
    "path": "/app/uploads/1742032800000-0b2f5c4e-...-data.csv",
    "size": 20480,
    "uploadedAt": "2026-03-15T12:00:00.000Z",
    "ext": ".csv",
    "type": "csv"
  }
}
```

**`POST /api/db/execute`**: run a query against an uploaded file or a connection string.

```json
{
  "sourceType": "file",
  "fileId": "0b2f5c4e-9d1a-4f5e-8a44-5c6f0f1d7a21",
  "query": "SELECT * FROM imported_csv WHERE CAST(age AS INTEGER) > 30",
  "maxRows": 100
}
```

```json
{
  "sourceType": "connection",
  "connectionString": "postgresql://user:pass@localhost:5432/mydb",
  "query": "SELECT * FROM orders LIMIT 50"
}
```

MongoDB takes a structured `mongo` object instead of `query`:

```json
{
  "sourceType": "connection",
  "connectionString": "mongodb://localhost:27017/shop",
  "mongo": { "collection": "orders", "filter": { "status": "paid" }, "projection": { "total": 1 }, "limit": 50 }
}
```

For Neo4j, send a Cypher string as `query`. Credentials come from the connection string, or from optional `user`, `password` and `database` fields (default database `neo4j`).

Response (`maxRows` defaults to 1000):

```json
{
  "source": "temp-sqlite-import",
  "columns": ["id", "name", "age"],
  "rows": [{ "id": "1", "name": "Alice", "age": "35" }],
  "rowCount": 1
}
```

Errors return `400` with `{ "error": "<message>" }`, for example `file_not_found`, `unsupported_connection_type` or a database error message.

## Security notes

What the project does:

- Passwords are hashed with bcrypt (10 rounds) and never returned by the API.
- JWTs are verified on `/api/chat`, `POST /api/query` and `/api/auth/me`, and chats are always scoped to the authenticated user.
- Helmet sets security headers, and the two rate limiters above apply to every request.
- Prompts are cleaned (null bytes, whitespace, length cap) and triple backticks are neutralised before reaching the LLM.
- Uploaded SQLite files are opened read-only, and Postgres queries have a 10 second statement timeout.

What you need to know before deploying:

- **Set `JWT_SECRET`.** If it is unset, tokens are signed with a well-known default string.
- **`/api/db/upload` and `/api/db/execute` do not require a JWT**, even though the frontend attaches one to execute requests. Anyone who can reach the server can upload files and ask it to connect to any database they name, and the Neo4j HTTP path will send requests to any host in the connection string. Put these routes behind authentication and network controls before exposing the backend publicly.
- **Generated queries run as written.** Beyond SQLite files, nothing restricts Postgres, MySQL or MongoDB access to read-only, so connect with a read-only database user and review queries before pressing **Run**.
- **CORS allows all origins** (`cors()` with defaults). Restrict it in `index.js` for production.
- The `xss` package is installed but not currently used anywhere.
- Auth tokens (`qc_token`) and saved connection strings (`qc_conn_default`) are kept in the browser's `localStorage`.
- Uploaded files are never deleted automatically.
- Use HTTPS in production, and keep LLM keys in environment variables, never in source control (`.env` files are git-ignored).

## Testing

There is no automated test suite. The only quality tooling is the frontend linter:

```bash
cd querycraft-frontend
npm run lint
```

A quick manual pass: sign up and log in, send a prompt in a new chat, reload to confirm history persists, upload a CSV and press **Run** on a generated query, then try each provider you have configured.

## Known limitations

- The row limit (`maxRows`, default 1000) is applied after PostgreSQL, MySQL, SQLite and Neo4j return their rows, so add a `LIMIT` to queries over large tables.
- MongoDB execution supports `find` with a filter only, not aggregation pipelines.
- CQL, Redis, Elasticsearch, DynamoDB and GraphQL queries can be generated but not run.
- Chat context is the last three completed exchanges. The summariser in `utils/conversationMemory.js` is not called anywhere, and the `Chat` schema has no fields to store its output.
- Prompt whitespace is collapsed, so line breaks in a pasted query are flattened before it reaches the model.
- The upload index (`db_files.json`) is a local file and the rate limiter is in-memory, so the backend is designed for a single instance.
- Model output can be wrong or unexpected; there is no query validation step.
- Retries with backoff exist for Gemini only.

## Roadmap

Ideas grounded in the gaps above:

- Add authentication and ownership checks to `/api/db/*`, restrict CORS, and cap or validate connection targets.
- Add automated tests (API and query-detection unit tests) and make the CI workflow useful for this monorepo layout.
- Wire up conversation summaries (add the fields to the `Chat` schema and call the summariser), and add pagination for long chats.
- Support MongoDB aggregation and execution for more of the languages that can already be generated.
- Schema introspection so prompts can include real table and column names.
- Automatic clean-up of old uploads.

## Contributing

Contributions are welcome.

1. Fork the repository and create a branch: `git checkout -b feature/your-feature`.
2. Make your changes. Run `npm run lint` in `querycraft-frontend/` for frontend changes (the backend has no linter or tests yet).
3. Document any new environment variable in the [Configuration](#configuration) tables.
4. Commit, push, and open a pull request describing the change.

## License

MIT. See [LICENSE](LICENSE).

## Links

- Repository: [github.com/sultanmaliki/QueryCraft-AI](https://github.com/sultanmaliki/QueryCraft-AI)
- Issues: [github.com/sultanmaliki/QueryCraft-AI/issues](https://github.com/sultanmaliki/QueryCraft-AI/issues)

**Authors:** Syed Mohammed Sultan, Rifaque Ahmed Akrami, Raif

**Project status:** Completed
