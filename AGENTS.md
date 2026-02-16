# Repository Guidelines

This package ntrust is used to batch-manage npm trusted publishing relationships for monorepo packages.

Reference documents:

- [Trusted publishing | npm docs](https://docs.npmjs.com/trusted-publishers)
- [CLI commands npm-trust | npm docs](https://docs.npmjs.com/cli/v11/commands/npm-trust)
- [GitHub release blog about npm trusted publishing](https://github.blog/changelog/2025-07-31-npm-trusted-publishing-with-oidc-is-generally-available/)

## Project Structure & Module Organization

This repository is a pnpm + Turborepo monorepo.

- `packages/ntrust/src`: TypeScript source for the `ntrust` library and CLI (`cli.ts`, `trust.ts`, provider logic).
- `packages/ntrust/test`: Vitest tests (currently `*.test.ts`).
- `packages/ntrust/dist`: Build output from `tsdown` (generated).
- Root config: `turbo.json`, `pnpm-workspace.yaml`, `tsconfig.json`, `.prettierrc`, and GitHub workflows in `.github/workflows`.

## Build, Test, and Development Commands

Use Node `>=24` and pnpm `10.x`.

- `pnpm install`: Install workspace dependencies.
- `pnpm build`: Run Turborepo build pipeline (`tsdown` for packages).
- `pnpm typecheck`: Run strict TypeScript checks across packages.
- `pnpm test:ci`: Run non-watch tests used by CI (`vitest --run`).
- `pnpm dev`: Run package `dev` tasks in parallel (if defined).
- `pnpm ntrust --help`: Run the CLI entrypoint from source.
- `pnpm -C packages/ntrust test`: Run package tests in watch mode while developing.

## Coding Style & Naming Conventions

Code is TypeScript ESM with strict compiler settings.

- Formatting is enforced with Prettier: semicolons, single quotes, `printWidth: 100`, no trailing commas.
- Use 2-space indentation (Prettier default).
- File names in `src` are lowercase and domain-oriented (for example `provider.ts`, `monorepo.ts`).
- Use `PascalCase` for types/interfaces (for example `TrustOptions`) and `camelCase` for variables/functions.

## Testing Guidelines

Vitest is the test framework.

- Place tests under `packages/ntrust/test` with `*.test.ts` naming.
- Prefer behavior-focused tests around CLI flows and trust/revoke/list logic.
- Run `pnpm test:ci` before opening a PR; include/adjust tests for behavioral changes.

## Commit & Pull Request Guidelines

Follow the existing Conventional Commit style seen in history:

- Examples: `feat: init impl framework`, `feat(core): init key api`, `chore: sync docs`.
- Format: `type(scope?): short imperative summary`.

PRs should include:

- A concise description of what changed and why.
- Linked issue(s) when applicable.
- Test evidence (`pnpm test:ci` output summary) and example CLI usage/output for user-facing changes.
