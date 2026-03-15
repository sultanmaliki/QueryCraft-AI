# QueryCraft AI

An intelligent, AI-powered database query assistant that transforms natural language into optimized database queries. QueryCraft leverages large language models (LLMs) to understand user intent and generate queries across multiple database systems.

## Overview

QueryCraft solves the problem of non-technical users struggling to write complex database queries. By accepting natural language input, the system:

1. Detects the intended query language (SQL, MongoDB, Cypher, GraphQL, CQL, etc.)
2. Intelligently selects an appropriate LLM based on query complexity
3. Generates optimized queries with automatic error handling and validation
4. Maintains conversation context for multi-turn query refinement
5. Supports direct database execution and result retrieval

The project consists of a **Node.js/Express backend** that handles LLM orchestration and database connectivity, paired with a **modern Next.js frontend** for an intuitive chat-based user experience.

## Use Cases

- **Data Analysts**: Quickly explore datasets without writing SQL from scratch
- **Business Users**: Generate reports by describing data needs in plain English
- **Developers**: Accelerate database query development and prototyping
- **DBAs**: Assist in documentation and query validation
- **Educational Settings**: Learn database query syntax through AI-assisted instruction
- **Data Science Teams**: Rapidly prototype ETL and data preparation queries

## Key Features

- 🤖 **Multi-LLM Support**: Seamlessly integrate Gemini, Mistral, Qwen, Llama, Phi, OpenRouter models
- 📊 **Multi-Database Support**: SQL, MongoDB, Neo4j, PostgreSQL, MySQL, Cassandra, DynamoDB, Elasticsearch, GraphQL
- 🔐 **Secure Authentication**: JWT-based user authentication with bcrypt password hashing
- 💬 **Conversation Management**: Chat-based interface with persistent conversation history
- 📁 **File Upload Support**: Upload CSV/database files for direct querying
- 🧠 **Conversation Memory**: Automatic summarization of chat history for context awareness
- ⚡ **Rate Limiting**: Configurable rate limits protect against abuse
- 🛡️ **Security Headers**: Helmet.js security headers, XSS protection, CORS support
- 🎨 **Modern UI**: Responsive design with dark/light theme support, real-time typing indicators
- 🔍 **Smart Query Language Detection**: Automatically identifies intended query syntax through heuristics
- 📋 **Response Parsing**: Extracts executable queries from LLM responses with code fence handling

## Architecture / System Design

```
┌────────────────────────────────────────────────────────────┐
│                    Next.js Frontend                        │
│  (React 19, TypeScript, Tailwind CSS, Framer Motion)       │
│  ┌──────────────┬──────────────┬──────────────────────┐    │
│  │ AuthPage     │ IntroPage    │ ChatApp              │    │
│  │ (Login/Reg)  │ (Landing)    │ (Main Interface)     │    │
│  └──────────────┴──────────────┴──────────────────────┘    │
└────────────────────────────────────────────────────────────┘
                             ↕ HTTP/REST
┌────────────────────────────────────────────────────────────┐
│                  Express Backend (Node.js)                 │
│                                                            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                   Routes Layer                      │   │
│  │  /api/auth  │  /api/query  │  /api/chat  │ /api/db  │   │
│  └─────────────────────────────────────────────────────┘   │
│                          ↓                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Controllers / Middleware               │   │
│  │  • JWT Authentication       • Rate Limiting         │   │
│  │  • Query Language Detection • Response Parsing      │   │
│  │  • Database Query Execution                         │   │
│  └─────────────────────────────────────────────────────┘   │
│                          ↓                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │             LLM Orchestration                       │   │
│  │  • Model Selection Logic (qwen/mistral/llama/...)   │   │
│  │  • OpenRouter API Integration                       │   │
│  │  • Google GenAI / Gemini Support                    │   │
│  │  • Local LLM Endpoint (Ollama)                      │   │
│  │  • Retry Logic & Error Handling                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                          ↓                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │           Multi-Database Layer                      │   │
│  │  ┌──────────────────────────────────────────────┐   │   │
│  │  │ SQL: SQLite │ PostgreSQL │ MySQL             │   │   │
│  │  ├──────────────────────────────────────────────┤   │   │
│  │  │ NoSQL: MongoDB │ Neo4j │ Cassandra           │   │   │
│  │  ├──────────────────────────────────────────────┤   │   │
│  │  │ Search: Elasticsearch │ DynamoDB             │   │   │
│  │  └──────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────┘   │
│                          ↓                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Data Models (MongoDB)                  │   │
│  │  • User    • Chat    • Query                        │   │
│  └─────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────┘
                             ↕
┌────────────────────────────────────────────────────────────┐
│                    MongoDB Database                        │
│    Stores: Users, Conversations, Query History, Metadata   │
└────────────────────────────────────────────────────────────┘
```

### Request Flow

1. **User Query Submission** → Frontend sends natural language prompt + optional database credentials
2. **Authentication** → JWT middleware validates user session
3. **Query Language Detection** → Backend analyzes prompt to identify target query language
4. **Model Selection** → Chooses optimal LLM based on query type and length
5. **LLM Call** → Routes to appropriate LLM provider (local, OpenRouter, Gemini)
6. **Response Parsing** → Extracts executable query from LLM response
7. **Database Execution** → Runs query against specified database
8. **Result Storage** → Persists query, response, and metadata to MongoDB
9. **Response to Client** → Returns results with formatting and syntax highlighting

## Tech Stack

### Backend
- **Runtime**: Node.js 20
- **Framework**: Express.js 4.18
- **Database Drivers**:
  - MongoDB: `mongoose` 7.5, `mongodb` 6.21
  - PostgreSQL: `pg` 8.16
  - MySQL: `mysql2` 3.15
  - SQLite: `better-sqlite3` 11.10
  - Neo4j: `neo4j-driver` 6.0
- **LLM Integration**:
  - `@google/genai` 1.0 (Gemini models)
  - OpenRouter API (via axios)
  - Local Ollama support
- **Authentication**: `jsonwebtoken` 9.0, `bcryptjs` 2.4
- **File Handling**: `multer` 2.0, `csv-parser` 3.2
- **Security**: `helmet` 8.1, `express-rate-limit` 8.0, `xss` 1.0
- **Utilities**: `cors`, `morgan`, `dotenv`, `uuid`
- **Development**: `nodemon` 2.0

### Frontend
- **Framework**: Next.js 15.5
- **UI Library**: React 19.1
- **Language**: TypeScript
- **Styling**: 
  - Tailwind CSS 4.1
  - Radix UI components (Dialog, Select, Tabs, Dropdown, etc.)
  - `framer-motion` 12.23 (animations)
- **Code Display**: `prismjs` 1.30
- **3D Graphics**: `three.js` 0.180 + `@react-three/fiber` 9.3
- **Notifications**: `sonner` 2.0
- **Theme**: `next-themes` 0.4
- **Utilities**: `tailwind-merge`, `lucide-react` (icons)
- **Development**: ESLint, TypeScript, Tailwind Autoprefixer

## Project Structure

```
QueryCraft AI/
├── README.md
├── .gitignore
│
├── querycraft-backend/              # Express.js Backend
│   ├── index.js                     # Server entry point, middleware setup
│   ├── package.json                 # Dependencies
│   ├── Dockerfile                   # Docker configuration
│   ├── db_files.json                # File upload metadata store
│   │
│   ├── controllers/
│   │   └── dbController.js          # Multi-database query execution logic
│   │
│   ├── middleware/
│   │   └── auth.js                  # JWT authentication middleware
│   │
│   ├── models/                      # MongoDB schemas
│   │   ├── User.js                  # User model with bcrypt hashing
│   │   ├── Chat.js                  # Chat session model
│   │   └── Query.js                 # Query history model
│   │
│   ├── routes/                      # API endpoints
│   │   ├── auth.js                  # Signup, login, profile endpoints
│   │   ├── query.js                 # Query language detection & LLM calls
│   │   ├── chat.js                  # Chat management endpoints
│   │   └── db.js                    # File upload & database execution
│   │
│   └── utils/
│       ├── llm.js                   # LLM provider orchestration
│       ├── responseParser.js        # LLM response parsing & SQL extraction
│       ├── conversationMemory.js    # Chat history summarization
│       └── uploads/                 # Temporary file storage
│
└── querycraft-frontend/             # Next.js Frontend
    ├── package.json
    ├── tsconfig.json
    ├── next.config.ts
    ├── tailwind.config.ts
    ├── postcss.config.mjs
    ├── eslint.config.mjs
    │
    ├── public/
    │   └── assets/                  # Static assets
    │
    └── src/
        ├── app/
        │   ├── layout.tsx           # Root layout
        │   ├── page.tsx             # Main page (view router)
        │   └── globals.css          # Global styles
        │
        ├── components/
        │   ├── auth/
        │   │   └── AuthProviderClient.tsx   # Auth context provider
        │   │
        │   ├── chat/                # Chat interface components
        │   │   ├── ChatWindow.tsx            # Message display
        │   │   ├── ChatInput.tsx             # User input area
        │   │   ├── ChatMessage.tsx           # Message rendering
        │   │   ├── ChatHeader.tsx            # Chat header UI
        │   │   ├── CodeCard.tsx              # Code block display
        │   │   ├── TypingIndicator.tsx       # AI typing animation
        │   │
        │   ├── layout/              # Layout components
        │   │   ├── Sidebar.tsx               # Chat list sidebar
        │   │   ├── ChatSidebar.tsx           # Chat-specific sidebar
        │   │   ├── Header.tsx                # Top navigation
        │   │   ├── MobileSidebarTrigger.tsx  # Mobile menu
        │   │
        │   ├── modals/              # Dialog components
        │   │   ├── DatabaseImportDialog.tsx  # DB connection setup
        │   │   ├── SettingsDialog.tsx        # User preferences
        │   │
        │   ├── pages/               # Page containers
        │   │   ├── IntroPage.tsx             # Landing page
        │   │   ├── AuthPage.tsx              # Login/signup
        │   │   ├── ChatApp.tsx               # Main chat interface
        │   │
        │   └── ui/                  # Radix UI primitives
        │       ├── button.tsx, card.tsx, dialog.tsx
        │       ├── dropdown-menu.tsx, select.tsx
        │       ├── alert.tsx, badge.tsx, tabs.tsx
        │       ├── input.tsx, textarea.tsx, label.tsx
        │       ├── tooltip.tsx, separator.tsx
        │       └── [more UI components]
        │
        ├── hooks/
        │   └── useAutoLogin.ts       # Auto-login logic
        │
        ├── lib/
        │   ├── api.ts                # API utilities (empty in current version)
        │   └── utils.ts              # Helper utilities
        │
        └── types/
            ├── prismjs.d.ts          # Prism.js type definitions
            └── react-three.d.ts      # Three.js type definitions
```

### Key Files Explained

| File | Purpose |
|------|---------|
| `querycraft-backend/index.js` | Express app setup, MongoDB connection, middleware initialization, route registration |
| `querycraft-backend/controllers/dbController.js` | Multi-database query execution (500+ lines), supports SQLite, PostgreSQL, MySQL, MongoDB, Neo4j with HTTP/Bolt fallback |
| `querycraft-backend/utils/llm.js` | LLM provider routing (Gemini, OpenRouter, Ollama), model normalization, retry logic, prompt optimization |
| `querycraft-backend/utils/responseParser.js` | JSON parsing, code fence extraction, SQL detection from LLM responses |
| `querycraft-backend/routes/query.js` | Query language heuristics (SQL/Mongo/Cypher/GraphQL detection), model selection logic |
| `querycraft-frontend/src/app/page.tsx` | App state management, view routing (intro/auth/chat), auto-login orchestration |
| `querycraft-frontend/src/components/pages/ChatApp.tsx` | Main chat interface, message state, LLM interaction, database operations |

## Installation

### Prerequisites

- **Node.js 20+** ([Download](https://nodejs.org/))
- **MongoDB** (local or cloud, e.g., MongoDB Atlas)
- **Git**
- (Optional) **Docker** for containerized deployment
- (Optional) **Ollama** for local LLM execution ([Download](https://ollama.ai/))

### Clone Repository

```bash
git clone https://github.com/sultanmaliki/QueryCraft-AI.git
cd QueryCraft-AI
```

### Backend Setup

```bash
cd querycraft-backend

# Install dependencies
npm install

# Create environment file
cp .env.example .env  # (if available, or create manually)
```

### Frontend Setup

```bash
cd ../querycraft-frontend

# Install dependencies
npm install
```

## Configuration

### Backend Environment Variables

Create a `.env` file in `querycraft-backend/`:

```bash
# MongoDB Connection (required)
MONGO_URI=mongodb://localhost:27017/querycraft
# or cloud: mongodb+srv://user:pass@cluster.mongodb.net/querycraft

# Server Configuration
PORT=5001
NODE_ENV=development

# Authentication
JWT_SECRET=your-secret-key-change-in-production
TOKEN_EXPIRY=7d

# LLM Configuration - Choose one or multiple providers

# 1. Local Ollama (default)
LLM_ENDPOINT=http://127.0.0.1:11434/api/generate
DEFAULT_MODEL=mistral:7b-instruct

# 2. Google Gemini
GENAI_KEY=your-google-genai-api-key
# or
GOOGLE_GENAI_KEY=your-google-genai-api-key

# 3. OpenRouter (for specialized models)
OPENROUTER_KEY=your-openrouter-api-key
OPENROUTER_SITE_URL=https://yourapp.com
OPENROUTER_APP_NAME=QueryCraft

# Feature Configuration
SUMMARY_MODEL=mistral:7b-instruct       # Model for conversation summarization
SUMMARY_OLDEST_COUNT=15                 # Number of messages to summarize
SUMMARY_MAX_TOKENS=400                  # Max tokens for summary

# (Optional) Database Test Credentials - for demo purposes
TEST_SQLITE_PATH=/tmp/test.db
TEST_POSTGRES_URI=
TEST_MYSQL_URI=
TEST_MONGODB_URI=
```

### Frontend Environment Variables

Create a `.env.local` file in `querycraft-frontend/`:

```bash
# API Base URL
NEXT_PUBLIC_API_BASE=http://localhost:5001
# or production: https://api.querycraft.ai

# Optional: Analytics, feature flags, etc.
```

### Optional: Docker Setup

Backend Dockerfile is provided. Build and run:

```bash
cd querycraft-backend
docker build -t querycraft-backend .
docker run -p 5001:5001 --env-file .env querycraft-backend
```

## Running the Project

### Development Mode

#### Terminal 1: Backend

```bash
cd querycraft-backend
npm run dev
# Output: Server running on port 5001
```

#### Terminal 2: Frontend

```bash
cd querycraft-frontend
npm run dev
# Output: ▲ Next.js 15.5.7
#         - Local:        http://localhost:3000
```

Visit **http://localhost:3000** in your browser.

### Production Mode

#### Backend

```bash
cd querycraft-backend
npm start
# PORT=5001 NODE_ENV=production node index.js
```

#### Frontend

```bash
cd querycraft-frontend
npm run build
npm start
# ▲ Next.js 15.5.7 (Standalone)
#   ▲ Ready on http://0.0.0.0:3000
```

## API Documentation

### Authentication Endpoints

#### `POST /api/auth/signup`

Register a new user.

**Request:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securePassword123"
}
```

**Response:**
```json
{
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "user",
    "createdAt": "2025-03-15T10:30:00Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### `POST /api/auth/login`

Authenticate and receive JWT token.

**Request:**
```json
{
  "email": "john@example.com",
  "password": "securePassword123"
}
```

**Response:**
```json
{
  "user": { /* user object */ },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### `GET /api/auth/me`

Get current user profile (requires authentication).

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "user"
  }
}
```

---

### Chat Endpoints

All chat endpoints require JWT authentication via `Authorization: Bearer <token>` header.

#### `GET /api/chat`

List all chats for the authenticated user.

**Response:**
```json
[
  {
    "_id": "507f1f77bcf86cd799439012",
    "user": "507f1f77bcf86cd799439011",
    "title": "SQL Analysis Session",
    "createdAt": "2025-03-15T10:00:00Z",
    "updatedAt": "2025-03-15T11:30:00Z"
  }
]
```

#### `POST /api/chat`

Create a new chat session.

**Request:**
```json
{
  "title": "Customer Query Analysis"
}
```

**Response:**
```json
{
  "_id": "507f1f77bcf86cd799439013",
  "user": "507f1f77bcf86cd799439011",
  "title": "Customer Query Analysis",
  "createdAt": "2025-03-15T11:45:00Z"
}
```

#### `GET /api/chat/:id`

Get a specific chat with all its queries.

**Response:**
```json
{
  "chat": {
    "_id": "507f1f77bcf86cd799439012",
    "user": "507f1f77bcf86cd799439011",
    "title": "SQL Analysis Session",
    "createdAt": "2025-03-15T10:00:00Z"
  },
  "queries": [
    {
      "_id": "507f1f77bcf86cd799439014",
      "user": "507f1f77bcf86cd799439011",
      "chat": "507f1f77bcf86cd799439012",
      "prompt": "Show me all active customers",
      "response": "SELECT * FROM customers WHERE status='active'",
      "model": "mistral:7b-instruct",
      "status": "done",
      "createdAt": "2025-03-15T10:05:00Z"
    }
  ]
}
```

#### `DELETE /api/chat/:id`

Delete a specific chat and all associated queries.

**Response:**
```json
{
  "success": true
}
```

#### `DELETE /api/chat`

Delete all chats for the authenticated user.

**Response:**
```json
{
  "success": true
}
```

---

### Query Endpoints

#### `POST /api/query`

Generate and execute a query from natural language.

**Request:**
```json
{
  "prompt": "Get all orders from last month with total amount greater than 1000",
  "chatId": "507f1f77bcf86cd799439012",
  "model": "or-qwen2.5-72b-free",
  "sourceType": "connection",
  "connectionString": "postgres://user:pass@localhost/mydb"
}
```

**Response:**
```json
{
  "queryId": "507f1f77bcf86cd799439015",
  "response": "SELECT * FROM orders WHERE created_at >= NOW() - INTERVAL '1 month' AND total > 1000",
  "model": "or-qwen2.5-72b-free",
  "status": "done",
  "usage": {
    "prompt_tokens": 45,
    "completion_tokens": 28
  },
  "raw": { /* LLM raw response */ }
}
```

---

### Database Execution Endpoints

#### `POST /api/db/upload`

Upload a CSV or database file for querying.

**Request:**
```
Content-Type: multipart/form-data
file: [binary file data]
```

**Response:**
```json
{
  "success": true,
  "file": {
    "id": "1678876200000-550e8400-e29b-41d4-a716-446655440000-data.csv",
    "originalName": "data.csv",
    "path": "/app/uploads/1678876200000-550e8400-e29b-41d4-a716-446655440000-data.csv",
    "uploadedAt": "2025-03-15T12:00:00Z"
  }
}
```

#### `POST /api/db/execute`

Execute a query against an uploaded file or database connection.

**Request:**
```json
{
  "sourceType": "file",
  "fileId": "1678876200000-550e8400-e29b-41d4-a716-446655440000-data.csv",
  "query": "SELECT * FROM data WHERE age > 30",
  "maxRows": 100
}
```

or

```json
{
  "sourceType": "connection",
  "connectionString": "postgresql://user:pass@localhost:5432/mydb",
  "query": "SELECT * FROM orders LIMIT 50",
  "maxRows": 50
}
```

**Response:**
```json
{
  "source": "file",
  "columns": ["id", "name", "age", "email"],
  "rows": [
    { "id": 1, "name": "Alice", "age": 35, "email": "alice@example.com" },
    { "id": 2, "name": "Bob", "age": 42, "email": "bob@example.com" }
  ],
  "rowCount": 2
}
```

---

### Error Responses

All endpoints may return error responses:

```json
{
  "error": "error_code",
  "message": "Human-readable error message"
}
```

Common status codes:
- `400 Bad Request` - Invalid input
- `401 Unauthorized` - Missing or invalid token
- `404 Not Found` - Resource not found
- `409 Conflict` - Resource already exists (e.g., email in use)
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error

## Internal Modules / Core Components

### LLM Orchestration (`utils/llm.js`)

Intelligently routes requests to appropriate LLM providers:

- **Model Normalization**: Converts frontend model aliases to actual provider names
  - `mistral` → `openrouter:mistralai/mistral-7b-instruct:free`
  - `gemini` → `gemini-2.5-flash`
  - `or-deepseek-r1` → `openrouter:deepseek/deepseek-r1`

- **Provider Selection**:
  1. Gemini → Uses Google GenAI SDK with API key
  2. OpenRouter → HTTP calls with auth header
  3. Default → Local Ollama endpoint

- **Retry Logic**: Exponential backoff for transient errors (429, 503, timeouts)
- **Response Extraction**: Handles multiple response formats (JSON, streaming, structured)
- **Token Limits**: Adaptive `max_tokens` based on query complexity

### Query Language Detection (`routes/query.js`)

Smart heuristics identify intended query language:

- **SQL**: Detects keywords (SELECT, INSERT, UPDATE, DELETE, JOIN, CREATE, ALTER)
- **MongoDB**: Recognizes `db.collection.find()`, aggregation syntax
- **Cypher** (Neo4j): Matches MATCH/MERGE patterns with relationship syntax `->`, `-[]-`
- **GraphQL**: Identifies `query{`, `mutation{`, `subscription{` blocks
- **Explicit Mentions**: Prioritizes natural language hints ("use Cypher", "write MongoDB")
- **Fallback**: Returns null if ambiguous, lets LLM infer from context

### Response Parsing (`utils/responseParser.js`)

Extracts executable queries from LLM responses:

- **Fence Extraction**: Finds SQL within ` ```sql ... ``` ` code blocks
- **JSON Handling**: Parses JSON-encoded responses, extracts `response`, `output`, `result` fields
- **Format Flexibility**: Handles various LLM output formats from different providers
- **Validation**: Detects obvious SQL keywords (SELECT, INSERT, UPDATE, etc.)

### Database Controller (`controllers/dbController.js`)

Unified interface for multi-database query execution:

**SQLite**:
```javascript
const db = new Database(filePath);
return db.prepare(query).all().slice(0, maxRows);
```

**PostgreSQL**:
```javascript
const client = new PgClient(connectionString);
const result = await client.query(query);
```

**MySQL**:
```javascript
const connection = await mysql.createConnection(connectionString);
const [rows] = await connection.execute(query);
```

**MongoDB**:
```javascript
const client = new MongoClient(connectionString);
const db = client.db(databaseName);
const coll = db.collection(collectionName);
const docs = await coll.find(queryObj).toArray();
```

**Neo4j** (with HTTP fallback):
- Primary: Bolt driver with auto-fallback if routing/network fails
- Fallback: HTTP transactional endpoint with base64 auth
- Supports both `neo4j://`, `bolt://`, and `http://` schemes

### Conversation Memory (`utils/conversationMemory.js`)

Automatic context preservation across conversations:

- **Summarization**: Creates bullet-point summaries of oldest K messages (default 15)
- **Model**: Uses configurable model (default: Mistral)
- **Storage**: Persists `memorySummary` and `memorySummaryUpdatedAt` to Chat document
- **Use Cases**: Reduces context length for long conversations, maintains task understanding

### Security & Validation

**Password Security**:
- 10-round bcrypt hashing via `bcryptjs`
- Never returns passwords in API responses
- Password-only validated on login attempt

**JWT Authentication**:
- Standard Bearer token in Authorization header
- 7-day expiry (configurable via `TOKEN_EXPIRY`)
- Secret must be changed in production (`.env` vs hardcoded `JWT_SECRET`)

**Input Sanitization**:
```javascript
// SQL injection prevention: Triple-backtick escaping
s.replace(/```/g, '`` + `` + `');

// XSS prevention: xss package for user-generated content
const cleanedText = xss(userInput);

// Null byte filtering for prompt sanitization
s.replace(/\u0000/g, '')
```

**Rate Limiting**:
- Global: 100 requests per 60 seconds per IP
- Demo bypass: `/api/query/demo` endpoints skip rate limiting
- Configurable via `express-rate-limit`

**Security Headers**:
- Helmet.js enforces CSP, X-Frame-Options, X-Content-Type-Options, etc.
- CORS restricted to configured origins (modifiable in `index.js`)

## Security Considerations

1. **Environment Variables**: Never commit `.env` to version control. Use `.gitignore` (included).

2. **JWT Secret**: Generate a strong, random secret in production:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

3. **MongoDB Connection**:
   - Use MongoDB Atlas with firewall rules for production
   - Avoid public IP exposure
   - Database-level authentication (username/password)

4. **LLM API Keys**:
   - Store in `.env`, never hardcode
   - Rotate regularly
   - Monitor usage and set spending limits (e.g., OpenRouter)

5. **File Uploads**:
   - 100 MB file limit (configurable via `multer`)
   - Files stored temporarily in `uploads/` directory
   - Consider cleanup job for abandoned files

6. **HTTPS in Production**:
   - Always use TLS/SSL
   - Update `JWT_SECRET` to a strong value
   - Set `NODE_ENV=production` to enable optimizations

7. **CORS Policy**:
   - Default: All origins allowed
   - Production: Restrict to frontend domain

## Testing

The repository does not currently include automated test suites. Manual testing workflow:

1. **Authentication**: Sign up → login → token persistence
2. **Query Generation**: Test each supported database type
3. **File Upload**: Upload CSV → verify metadata storage
4. **Multi-turn Conversation**: Create chat → add multiple queries → verify history
5. **LLM Providers**: Test Gemini, OpenRouter, and Ollama models

## Limitations

1. **No Cursor-Based Pagination**: Chat queries endpoint returns all results; consider pagination for large chat histories.

2. **Fixed Result Limit**: Default 1000 rows for database queries; very large datasets may be truncated.

3. **No Transaction Support**: Individual queries only; multi-statement transactions not supported.

4. **Limited GraphQL Support**: GraphQL endpoint detection works; execution depends on external GraphQL server.

5. **No Query Validation**: Generated queries are sent directly to databases; malformed queries return database errors.

6. **Conversation Memory**: Summary generation is non-blocking; may lag behind real conversations.

7. **No Concurrent User Limits**: Backend designed for small-to-medium user bases; horizontal scaling needed for enterprise.

8. **File Cleanup**: Uploaded files not auto-deleted; manual cleanup or scheduled job needed.

9. **Model Availability**: OpenRouter and Gemini require active API keys; failures if services unavailable.

10. **No Query Explanation**: LLM generates queries but doesn't automatically explain them to users.

## Future Improvements

1. **Advanced UI**:
   - Query result visualization (charts, graphs, maps)
   - Side-by-side query/result comparison
   - Query saved templates and snippets

2. **LLM Enhancements**:
   - In-context learning from user corrections
   - Few-shot examples in system prompt
   - Query optimization suggestions

3. **Database Features**:
   - Schema introspection modal
   - Query performance analysis
   - Index recommendations

4. **Scalability**:
   - Redis caching for repeated queries
   - Query result caching layer
   - Horizontal scaling with load balancing

5. **Testing & Validation**:
   - Comprehensive Jest/Mocha test suite
   - Query validation before execution
   - Dry-run mode for previewing results

6. **User Experience**:
   - Query history export (CSV, JSON)
   - Shareable query links
   - Team collaboration features
   - Custom prompt templates

7. **Monitoring & Analytics**:
   - Query execution logging and analytics
   - LLM cost tracking per user
   - Performance metrics dashboard

8. **Security**:
   - Two-factor authentication (2FA)
   - Query audit trail with timestamps
   - Role-based access control (RBAC)

## Contributing

Contributions are welcome! To contribute:

1. **Fork** the repository: https://github.com/sultanmaliki/QueryCraft-AI
2. **Create** a feature branch: `git checkout -b feature/your-feature`
3. **Commit** changes: `git commit -m "Add your feature"`
4. **Push** to branch: `git push origin feature/your-feature`
5. **Open** a Pull Request with description

Please ensure:
- Code follows existing style (no specific linter configured yet)
- New features include appropriate error handling
- Environment variables are documented in `.env.example`

## License

MIT License. See [LICENSE](LICENSE) file for details.

---

**Questions or Issues?** Open a GitHub Issue at [QueryCraft-AI/issues](https://github.com/sultanmaliki/QueryCraft-AI/issues) or contact the development team.

**Repository**: [github.com/sultanmaliki/QueryCraft-AI](https://github.com/sultanmaliki/QueryCraft-AI)

**Authors**:
- Syed Mohammed Sultan
- Rifaque Ahmed Akrami
- Raif

**Project Status**: Completed
