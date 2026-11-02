-- Run AFTER ingredient_expiry_setup.sql, on the primary inventory database only.
-- Do not schedule a second sweep on the cloud mirror: it receives the primary's stock changes.
-- Supabase Cron keeps expiry processing active even when the app is closed.
create extension if not exists pg_cron;
select cron.unschedule(jobid) from cron.job where jobname = 'dayo-archive-expired-ingredients';
select cron.schedule('dayo-zero-expired-ingredient-stock', '* * * * *',
  'select public.zero_expired_ingredient_stock();');
select public.zero_expired_ingredient_stock();
select jobname, schedule, active from cron.job where jobname = 'dayo-zero-expired-ingredient-stock';
