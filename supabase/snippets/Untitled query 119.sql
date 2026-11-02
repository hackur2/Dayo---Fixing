select
  has_function_privilege('anon', 'public.create_customer_qr_session()', 'EXECUTE') as anon_can_start_session,
  has_function_privilege('anon', 'public.get_customer_menu()', 'EXECUTE') as anon_can_read_menu;