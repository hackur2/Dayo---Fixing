-- Business-data conflicts must not use serialization_failure (40001).
-- PostgREST 14 retries that SQLSTATE indefinitely, holding API pool connections.
-- Preserve the installed receiver, its permissions, timeout and conflict checks.
begin;
do $$
declare
  receiver regprocedure := to_regprocedure('public.apply_cloud_sync_batch(uuid,uuid,text)');
  definition text;
  previous_codes integer;
  fixed_codes integer;
begin
  if receiver is null then raise exception 'Install the safe cloud sync receiver before this correction.'; end if;
  select pg_get_functiondef(receiver) into definition;
  select count(*) into previous_codes from regexp_matches(definition, 'errcode[[:space:]]*=[[:space:]]*''40001''', 'gi');
  select count(*) into fixed_codes from regexp_matches(definition, 'errcode[[:space:]]*=[[:space:]]*''PT409''', 'gi');
  if previous_codes=0 and fixed_codes=5 then return; end if;
  if previous_codes<>5 or fixed_codes<>0 then
    raise exception 'Unexpected receiver conflict definitions. Review the installed function before changing it.';
  end if;
  definition := regexp_replace(definition, 'errcode[[:space:]]*=[[:space:]]*''40001''', 'errcode=''PT409''', 'gi');
  execute definition;
end;
$$;
notify pgrst, 'reload schema';
commit;
