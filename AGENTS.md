# AGENTS.md

## Cursor Cloud specific instructions

This repo is the **AI Companion App** — a single Next.js 13 (App Router) + TypeScript product. There is no backend to self-host: the app is a Next.js server that talks entirely to external SaaS APIs.

### Services / how to run
Standard commands live in `package.json` (`dev`, `build`, `start`, `lint`, `generate-embeddings-pinecone`, `generate-embeddings-supabase`). Setup details are in `README.md`.

- Lint: `npm run lint`
- Build: `npm run build`
- Dev server: `npm run dev` (serves on `http://localhost:3000`)

### Secrets are required to actually run the app (non-obvious)
Every page and API route is wrapped by Clerk auth middleware (`src/middleware.ts`). Without a valid `CLERK_SECRET_KEY`, **every route returns HTTP 500** with `Missing Clerk Secret Key or API Key` — including the homepage and sign-in pages. `npm run build` and `npm run lint` succeed without any secrets, but the running app does not.

To run/chat end-to-end you need live keys for the "MUST" services (put them in `.env.local`; see `.env.local.example`):
- Clerk: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`
- OpenAI: `OPENAI_API_KEY` (used for embeddings on every request, plus chat for ChatGPT companions)
- Upstash Redis: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` (memory + rate limiting)
- Vector DB (pick one via `VECTOR_DB`): Pinecone (`PINECONE_API_KEY`, `PINECONE_ENVIRONMENT`, `PINECONE_INDEX`) or Supabase (`SUPABASE_URL`, `SUPABASE_PRIVATE_KEY`)

Optional: Replicate (`REPLICATE_API_TOKEN`) for Vicuna/Llama companions; Twilio (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`) for the SMS webhook (`/api/text`, usually needs ngrok).

### Before chatting: seed the vector DB (non-obvious)
Companion backstories must be embedded into the vector DB before chat retrieval works. After secrets are set, run once:
- `npm run generate-embeddings-pinecone` (or `npm run generate-embeddings-supabase`; Supabase also needs `pgvector.sql` applied to the DB first).

### Harmless dev-server noise
`npm run dev` prints `Watchpack Error ... EACCES: permission denied, watch '/etc/credstore'` (and similar for `/etc/credstore.encrypted`, `/root/.ssh`). These are just the file watcher hitting unreadable system paths and can be ignored.

### Node version
The `Dockerfile` pins Node 18, but the app builds and runs fine on the Node 22 present in this environment.
