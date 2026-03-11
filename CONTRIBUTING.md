# Contributing to Autonomous Forge

Autonomous Forge is a Next.js, Prisma, Clerk, and git-runtime prototype. Contributions should preserve that direction: ship useful features, keep the repo runnable on Vercel, and avoid breaking the real git-backed repo actions.

## Stack Assumptions

- Frontend: Next.js App Router, React 19, TypeScript.
- Auth: Clerk.
- Database: Neon Postgres through `DATABASE_URL`.
- Persistence fallback: local JSON store for non-database development.
- Git runtime: `simple-git` writing repositories under the forge storage root.

## Local Setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env`.
3. Set `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` if you want to exercise authenticated flows locally.
4. Create a Neon database or run local Postgres and set `DATABASE_URL`.
5. Generate Prisma client with `npm run db:generate`.
6. Push the schema with `npm run db:push`.
7. Start the app with `npm run dev`.

## Required Checks

Before opening a pull request, run:

```bash
npm run typecheck
npm run lint
npm run build
```

Do not open a PR with failing checks unless the PR is explicitly marked as draft and the breakage is documented.

## Contribution Rules

1. Keep changes focused. Avoid mixing refactors with feature work unless the refactor is required for the feature.
2. Preserve real git behavior. Repository creation, branch writes, commit recording, and merge behavior must stay functional.
3. Do not reintroduce custom password auth. Authentication is Clerk-based.
4. Treat Neon Postgres as the primary production database target.
5. Keep local fallback mode working when `DATABASE_URL` is not configured.
6. Prefer adding tests or validation coverage when touching auth, API routes, or git runtime behavior.
7. Update docs when adding new env vars, workflows, or public API behavior.

## Pull Request Expectations

- Include a short problem statement.
- Describe the user-facing or maintainer-facing change.
- List any new environment variables.
- Mention whether the change affects Vercel deployment, Clerk setup, Neon setup, or git runtime behavior.
- Include screenshots or short recordings for UI changes when practical.

## Suggested Areas for Contributors

- Durable background workers for git execution.
- Better repo detail pages and diff visualization.
- Governance controls and repo-level policy overrides.
- Streaming improvements beyond in-memory SSE.
- Better contributor-facing test coverage.

## Security and Secrets

- Never commit real Clerk keys, Neon credentials, or Vercel tokens.
- Use placeholder values in docs and workflow examples.
- Prefer GitHub Actions secrets and Vercel project environment variables for deployment.