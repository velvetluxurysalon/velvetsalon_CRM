# Velvet — AI Agent Guide

## Project
pnpm monorepo · `apps/web` (React 19 + Vite 7 + Tailwind 4 + shadcn/ui) · `apps/api` (Express 5 + Node 20)

## Stack
| Layer | Tech |
|---|---|
| Frontend | React 19, Vite 7, Tailwind CSS 4, shadcn/ui, TypeScript 5 |
| Backend | Express 5, Node 20, TypeScript 5, Zod (validation) |
| Testing | Vitest 4 (unit), Playwright 1.58 (E2E) |
| Quality | ESLint 9 (flat config), Prettier 3, Husky 9, Commitlint |
| Commits | Conventional Commits (`feat/fix/docs/refactor/test/chore/ci`) |

## Commands (from root)
```bash
pnpm dev           # web :5173 + api :3001
pnpm test          # vitest unit tests
pnpm test:e2e      # playwright e2e
pnpm lint          # eslint all apps
pnpm typecheck     # tsc --noEmit
pnpm format        # prettier write
```

## Backend Architecture (MVC + Repository)
```
api/src/
  controllers/     # request handling, response helpers (BaseController)
  routes/          # thin route definitions, delegate to controllers
  services/        # business logic (future)
  repositories/    # data access, DB-agnostic (IRepository<T>)
  dtos/            # Zod schemas for request validation
  models/          # domain entities (BaseEntity)
  middleware/      # errorHandler, validate(ZodSchema)
  types/           # shared TS types
```

## Frontend Structure
```
web/src/
  components/      # shared UI (shadcn/ui lives in components/ui/)
  features/        # feature modules (self-contained)
  pages/           # one per route
  hooks/           # shared custom hooks
  services/        # API client layer
  lib/             # pure utilities (cn, formatters)
  types/           # shared TS types
```

## Rules
- TypeScript strict, no `any`, use `unknown`
- ESM (`"type": "module"`), `.js` extensions in backend imports
- Functional components only, no class components
- Co-locate unit tests (`*.test.ts(x)`)

## Security — MUST Follow

### Credentials & Secrets
- NEVER hardcode API keys, tokens, passwords, or secrets in source code
- ALL secrets go in `.env` files (gitignored) — update `.env.example` with placeholder keys
- Use `process.env` (backend) or `import.meta.env` (frontend) to access env vars
- No secrets in frontend code — `VITE_` prefixed vars are public

### Banned Patterns
- NEVER use `eval()`, `new Function()`, or `setTimeout/setInterval` with string args
- NEVER use `document.write()` or `innerHTML` directly
- NEVER disable TypeScript checks (`@ts-ignore`, `@ts-nocheck`) without a justified comment
- NEVER use `any` — use `unknown` and narrow types

### React Security
- NEVER use `dangerouslySetInnerHTML` — if absolutely necessary, sanitize with DOMPurify
- NEVER inject user input into `href`, `src`, or `action` without validation — block `javascript:` URLs
- NEVER spread unvalidated props onto DOM elements (`{...userInput}`)
- Always validate/sanitize user input before rendering
- Use `textContent` patterns (React default) — React auto-escapes JSX expressions

### Backend Security
- Validate ALL request inputs with Zod schemas via `validate()` middleware
- Never trust client-side data — always re-validate on server
- Set security headers (helmet.js when ready)
- Rate-limit auth endpoints (express-rate-limit when ready)
- Never log sensitive data (passwords, tokens, PII)
- Use parameterized queries — never concatenate user input into queries

### Task Completion Checklist
After every feature/fix, verify:
1. No hardcoded secrets in committed code
2. No `eval`/`Function`/`innerHTML` usage
3. All user inputs validated (Zod on backend, controlled inputs on frontend)
4. No `any` types introduced
5. Tests pass (`pnpm test`)
6. Lint passes (`pnpm lint`)
- Never commit `.env`; update `.env.example`
- Commits: `type(scope): subject` — e.g. `feat(web): add login page`
