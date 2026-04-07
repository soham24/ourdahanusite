# Git Workflow

This repo should use a hybrid workflow:

- keep the day-to-day flow simple
- keep production protected
- add release discipline only when a release needs to be frozen and stabilized

Core branch model:

- `main`: production-ready code only
- `staging`: integration, QA, and release-candidate branch
- `feature/*` and `fix/*`: short-lived development branches
- `hotfix/*`: urgent production fixes branched from `main`
- `release/*`: optional release stabilization branches for larger or coordinated releases

## Why This Model

Classic Git Flow with `develop` plus `release/*` can work well for large teams, but it is heavier than this project needs for normal day-to-day work. For this app:

- `staging` already plays the role of the shared next-release branch
- `main` stays protected and production-only
- `release/*` is available when QA or DevOps needs a frozen release candidate
- normal shipping stays fast and simple

## Branch Roles

- `main`
  - always reflects production-ready code
  - only receives reviewed and tested changes
  - production tags should be created from here

- `staging`
  - shared branch for the next release
  - used for integration, QA testing, and UAT
  - default base branch for feature and fix work

- `feature/*`
  - used for new features
  - branch from `staging`
  - merge back into `staging`

- `fix/*`
  - used for non-production bug fixes
  - branch from `staging`
  - merge back into `staging`

- `hotfix/*`
  - used for urgent production issues
  - branch from `main`
  - merge into `main` first, then merge back into `staging`

- `release/*`
  - optional
  - create only when a release needs to be frozen for QA, config work, migration work, or coordinated approval
  - branch from `staging`
  - after validation, merge into `main`
  - then sync back into `staging` if needed

## Environment Mapping

- local machine: development environment
- preview or shared QA deployment: testing environment
- `staging` deployment: staging environment
- `main` deployment: production environment

Every production change must be tested in at least one earlier environment first.

## Standard Development Flow

1. Pull the latest `staging`.
2. Create a focused branch such as `feature/listing-seo` or `fix/job-payment-validation`.
3. Implement the change in small, regular commits.
4. Run local validation before pushing.
5. Push the branch and open a pull request into `staging`.
6. After review and approval, merge into `staging`.
7. Deploy `staging` to the testing or staging environment.
8. QA validates the change.
9. Once the release is approved, merge `staging` to `main` or create a `release/*` branch if the release needs to be frozen.
10. Deploy `main` to production only after approval.

## When To Use `release/*`

Create a `release/*` branch only when one or more of these are true:

- QA needs a frozen release candidate while development continues
- the release includes database migrations
- the release includes environment or config changes
- multiple features are being bundled for one controlled release
- DevOps or management approval is needed before production

If none of those apply, release directly from `staging` to `main`.

## Hotfix Flow

1. Branch from `main` using `hotfix/<short-name>`.
2. Make the smallest safe fix.
3. Validate locally.
4. Open a PR into `main`.
5. After approval, merge and deploy production.
6. Merge the same hotfix back into `staging` immediately so branches do not drift.

## PR And Review Rules

- all development must happen in `feature/*`, `fix/*`, or `hotfix/*`
- no direct development on `main`
- no direct development on `staging`
- every PR must be reviewed before merge
- if the team lead opens the PR, another developer should review it
- commit messages should be specific and meaningful

## QA And Issue Tracking

- developers must share a short changelog with QA for every branch or PR
- QA logs defects as GitHub issues
- issues should be assigned to the responsible developer
- critical issues must be escalated immediately
- fixes go back through the same branch and PR flow

## Suggested Commands

### Start a feature or fix

```bash
git checkout staging
git pull origin staging
git checkout -b feature/short-name
```

Or:

```bash
git checkout staging
git pull origin staging
git checkout -b fix/short-name
```

### Start a hotfix

```bash
git checkout main
git pull origin main
git checkout -b hotfix/short-name
```

### Start a release branch

```bash
git checkout staging
git pull origin staging
git checkout -b release/2026-04-06
```

### Review local work

```bash
git status
git diff
```

### Validate before push

```bash
npm run build
```

### Push a working branch

```bash
git push -u origin feature/short-name
```

### Merge `staging` into `main`

```bash
git checkout main
git pull origin main
git merge --no-ff staging
git push origin main
```

### Merge a hotfix back into `staging`

```bash
git checkout staging
git pull origin staging
git merge --no-ff hotfix/short-name
git push origin staging
```

## Optional `git flow` Tooling

The `git flow` CLI can be used if the team wants it, but it is not required. The branching policy matters more than the tool itself.

If used, map it like this:

- production branch: `main`
- develop branch: `staging`
- feature prefix: `feature/`
- release prefix: `release/`
- hotfix prefix: `hotfix/`
- version tag prefix: `v`

## GitHub Settings To Enable

- keep the repository private
- protect `main`
- protect `staging`
- require pull requests for `main`
- prefer pull requests for `staging`
- disable direct pushes to `main`
- require at least one review before merging to `main`
- require `npm run build` or CI checks before merge once CI is added

## Repo Hygiene

- never commit `.env*`, `.vercel`, `.next`, or `node_modules`
- never commit secrets, API keys, or production credentials
- keep screenshots and local debugging artifacts out of git
- commit source files, migration files, docs, and configuration
- prefer small, intentional commits over large bulk commits
