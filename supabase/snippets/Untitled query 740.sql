update public.profiles p
set role = 'SUPER_ADMIN',
    is_authorized = true
from auth.users u
where p.id = u.id
  and lower(u.email) = lower('owner@dayo.local');