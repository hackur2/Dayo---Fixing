update public.profiles
set role = 'SUPER_ADMIN', is_authorized = true
where id = (
  select id from auth.users where email = 'owner@example.com'
);