## Why

<!-- The problem this solves, and why this way. The diff already shows what changed. -->

## How it was checked

<!-- What you ran or clicked to know it works. -->

- [ ] `npx tsc --noEmit`, `npx eslint`, `npm test` and `npm run build` pass
- [ ] Schema changes are a **new** file in `supabase/migrations/` (not an edit to an existing one), and `src/lib/database.types.ts` is regenerated
- [ ] No keys, phone numbers or real people's data in code, tests, fixtures or screenshots
