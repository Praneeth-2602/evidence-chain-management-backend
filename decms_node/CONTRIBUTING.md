# Contributing Guide

Thanks for contributing to DECMS backend! A few guidelines:

- Use conventional commits: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, etc.
- Keep changes focused and include tests when feasible.
- Run `npm run seed` to set up local data before testing endpoints.
- Do not commit secrets; use `.env` and update `.env.example` if new keys are introduced.

## Development

1. Copy `.env.example` to `.env` and fill values.
2. Start dev server: `npm run dev`.
3. Backup DB (optional): `npm run backup`.

## Code style

Prettier/ESLint are not configured yet; feel free to propose a minimal setup.