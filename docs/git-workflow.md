# Git Workflow

This repo should use a simple three-lane flow:

- `feature/*` or `fix/*`: active development branches
- `staging`: integration and testing branch
- `main`: production branch

## Branch Roles

- `main`
  - reflects what is live in production
  - only receives reviewed, tested changes
  - tag releases from here
- `staging`
  - reflects the next release candidate
  - used for QA, content checks, and final UAT before production
- `feature/*` and `fix/*`
  - short-lived working branches
  - branch from `staging` for normal work
  - branch from `main` only for urgent production hotfixes

## Normal Development Flow

1. Start from the latest `staging`.
2. Create a branch like `feature/listing-seo` or `fix/job-payment-validation`.
3. Build and test locally.
4. Open a pull request into `staging`.
5. After review, merge into `staging`.
6. Deploy `staging` to the test environment and validate.
7. When the release is approved, merge `staging` into `main`.
8. Deploy `main` to production.

## Hotfix Flow

1. Branch from `main` using `hotfix/<name>`.
2. Make the smallest safe fix.
3. Validate locally.
4. Merge into `main` and deploy production.
5. Immediately merge the same fix back into `staging` so branches do not drift.

## Suggested Commands

### Start a new feature

```bash
git checkout staging
git pull origin staging
git checkout -b feature/short-name
```

### Validate before push

```bash
npm run build
```

### Push your branch

```bash
git push -u origin feature/short-name
```

### Release staging to production

```bash
git checkout main
git pull origin main
git merge --no-ff staging
git push origin main
```

## GitHub Settings To Enable

- make the repository private
- protect `main`
- prefer protecting `staging` too
- require pull requests for `main`
- disable direct pushes to `main`
- require at least one review before merging to `main`
- optionally require `npm run build` or CI checks before merge

## Repo Hygiene

- never commit `.env*`, `.vercel`, `.next`, or `node_modules`
- keep screenshots and local debugging artifacts out of git
- commit source files, migration files, docs, and configuration
- use small, intentional commits instead of one large dump
