select
  u.email,
  u.email_confirmed_at,
  p.role,
  p.is_authorized,
  p.id is not null as has_profile
from auth.users u
left join public.profiles p on p.id = u.id
where lower(u.email) = lower('owner@dayo.local');