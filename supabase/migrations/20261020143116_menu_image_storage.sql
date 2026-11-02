-- Public menu photos can be viewed without signing in. Only authorized staff
-- can upload, replace, or delete files from this bucket.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'menu-images',
  'menu-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Authorized staff can upload menu images" on storage.objects;
create policy "Authorized staff can upload menu images"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'menu-images'
  and exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and is_authorized = true
      and role in ('ADMIN', 'SUPER_ADMIN')
  )
);

drop policy if exists "Authorized staff can update menu images" on storage.objects;
create policy "Authorized staff can update menu images"
on storage.objects for update to authenticated
using (
  bucket_id = 'menu-images'
  and exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and is_authorized = true
      and role in ('ADMIN', 'SUPER_ADMIN')
  )
)
with check (
  bucket_id = 'menu-images'
  and exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and is_authorized = true
      and role in ('ADMIN', 'SUPER_ADMIN')
  )
);

drop policy if exists "Authorized staff can delete menu images" on storage.objects;
create policy "Authorized staff can delete menu images"
on storage.objects for delete to authenticated
using (
  bucket_id = 'menu-images'
  and exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and is_authorized = true
      and role in ('ADMIN', 'SUPER_ADMIN')
  )
);
