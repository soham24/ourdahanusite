# FindOurDahanu Admin Telegram Notifications

## Goal

Notify administrators through the existing notification system whenever a signed-in user submits a professional or submits/updates a professional rating for moderation. Telegram delivery must respect each administrator's existing notification preferences.

## Architecture

Reuse the `admin.new_submission` notification type and extend its submission kinds with `professional` and `professional_review`. Both FindOurDahanu server actions will dispatch through `sendNotificationToAdmins` only after the corresponding pending database write succeeds.

The shared dispatcher will continue to load administrators, honor muted types and enabled channels, and send Telegram only when an administrator has connected and enabled Telegram. The actions will not call the Telegram API directly.

## Data Flow

For a professional submission, the action validates and inserts the pending professional, then dispatches an admin submission notification containing the professional name, submitter identity when available, and `/admin/find` as the moderation link.

For a rating submission or update, the action verifies the professional, writes the pending rating, then dispatches an admin submission notification containing the professional name, star rating, reviewer identity when available, and `/admin/find` as the moderation link.

## Error Handling

Notification delivery is best-effort and must not change the successful result of a completed database mutation. Dispatch failures are logged with action-specific context. No notification is sent when validation or the database write fails.

## Testing and Verification

Add focused tests that prove both successful mutations create the correct admin notification payload and that failed writes do not notify. Follow test-driven development by observing the tests fail before implementation. Then run the focused tests, lint, type/build checks, and the relevant wider test suite available in the repository.

## Scope

This change does not add direct Telegram credentials, bypass administrator preferences, alter moderation behavior, or notify the submitting user.
