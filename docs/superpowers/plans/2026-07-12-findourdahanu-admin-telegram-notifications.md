# FindOurDahanu Admin Telegram Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Notify opted-in administrators when a FindOurDahanu professional or professional review enters moderation.

**Architecture:** Extend the existing `admin.new_submission` payload and renderer, then dispatch it from the two successful FindOurDahanu mutations. Use the unified dispatcher so administrator Telegram preferences remain authoritative and delivery failures cannot fail the database mutation.

**Tech Stack:** Next.js 16.2.1 Server Actions, TypeScript, Supabase, existing notification dispatcher

## Global Constraints

- Telegram delivery must respect each administrator's existing notification preferences.
- Notifications are sent only after a successful pending database write.
- Notification delivery is best-effort and does not change a successful mutation result.
- Both notifications link to `/admin/find`.

---

### Task 1: Extend the admin submission notification contract

**Files:**
- Modify: `src/lib/notifications/types.ts`
- Modify: `src/lib/notifications/templates.ts`

**Interfaces:**
- Consumes: `NotificationPayload<'admin.new_submission'>`
- Produces: `kind: 'professional' | 'professional_review'` support in the shared renderer

- [ ] **Step 1: Add the new payload kinds and deliberately leave the renderer incomplete**

Add `professional` and `professional_review` to `AdminSubmissionPayload['kind']` without changing the exhaustive `labels` record.

- [ ] **Step 2: Run the type checker to verify the contract fails**

Run: `npx tsc --noEmit`
Expected: FAIL because the renderer's `Record` lacks `professional` and `professional_review`.

- [ ] **Step 3: Add exact renderer labels**

Add these entries to the `labels` record:

```ts
professional: 'Professional',
professional_review: 'Professional review',
```

- [ ] **Step 4: Verify the notification contract passes**

Run: `npx tsc --noEmit`
Expected: PASS.

### Task 2: Dispatch notifications from successful FindOurDahanu writes

**Files:**
- Modify: `src/app/actions/find.ts`

**Interfaces:**
- Consumes: `sendNotificationToAdmins(type, payload)`
- Produces: best-effort `admin.new_submission` dispatches after professional and rating writes

- [ ] **Step 1: Import the dispatcher and capture required returned rows**

Import `sendNotificationToAdmins`. Change the professional insert to select its `id`, and change the professional lookup in `submitRating` to select `id, name`, while preserving every existing validation and mutation result.

- [ ] **Step 2: Dispatch the professional submission notification**

After a successful insert, call without awaiting:

```ts
void sendNotificationToAdmins('admin.new_submission', {
  kind: 'professional',
  title: name,
  submitterName: getUserDisplayName(user),
  reviewPath: '/admin/find',
}).catch((err) => console.error('[find:submitProfessional:notify]', err))
```

- [ ] **Step 3: Dispatch the professional review notification**

After a successful rating upsert, call without awaiting:

```ts
void sendNotificationToAdmins('admin.new_submission', {
  kind: 'professional_review',
  title: `${pro.name} · ${rating}/5`,
  submitterName: getUserDisplayName(user),
  reviewPath: '/admin/find',
}).catch((err) => console.error('[find:submitRating:notify]', err))
```

Define `getUserDisplayName` locally to return trimmed `user_metadata.full_name`, then the user's email, then `null`.

- [ ] **Step 4: Run focused static verification**

Run: `npx eslint src/app/actions/find.ts src/lib/notifications/types.ts src/lib/notifications/templates.ts`
Expected: PASS with no errors.

- [ ] **Step 5: Run full verification**

Run: `npx tsc --noEmit` and `npm run build`.
Expected: both commands PASS.

- [ ] **Step 6: Commit the implementation**

```powershell
git add -- src/app/actions/find.ts src/lib/notifications/types.ts src/lib/notifications/templates.ts
git commit -m "feat: notify admins of find submissions"
```
