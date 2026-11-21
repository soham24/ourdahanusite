-- Signed-in users may only upload into their own folder of the `uploads`
-- bucket, public/<their user id>/... . The old policy checked only the bucket,
-- so any account could write anywhere in it.
--
-- Safe to apply now: since PR #125 (live 2026-10-13) every upload component
-- writes through storageObjectPath(), which builds exactly that path. Both
-- folder segments are checked: without the first, an account could write
-- uploads/<anything>/<its own id>/x.jpg and the second check would prove
-- nothing. Checked against production in a rolled-back transaction first:
-- own folder (image and thumbnail) allowed; a flat path, another user's
-- folder and another top-level folder refused. Existing images are untouched
-- -- reads are governed by a separate policy that has not changed.
drop policy if exists "Authenticated users can upload images" on storage.objects;
drop policy if exists "Users upload into their own folder" on storage.objects;
create policy "Users upload into their own folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'uploads'
    and (storage.foldername(name))[1] = 'public'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );
