import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ADMIN_ROUTES = new Set([
  "/admin/kds",
  "/admin/order-taker",
  "/admin/order-summary",
]);

function response(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return response({ error: "Method not allowed." }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = request.headers.get("Authorization");
  if (!url || !anonKey || !serviceRoleKey || !authorization) return response({ error: "Server configuration is incomplete." }, 500);

  const caller = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
  const { data: { user }, error: userError } = await caller.auth.getUser();
  if (userError || !user) return response({ error: "Sign in is required." }, 401);

  const { data: callerProfile, error: callerError } = await caller
    .from("profiles")
    .select("role, is_authorized")
    .eq("id", user.id)
    .single();
  if (callerError || callerProfile?.role !== "SUPER_ADMIN" || !callerProfile.is_authorized) {
    return response({ error: "Only an authorized Super Admin can add staff accounts." }, 403);
  }

  let payload: Record<string, unknown>;
  try { payload = await request.json(); } catch { return response({ error: "Invalid request body." }, 400); }
  const staffName = String(payload.staffName || "").trim();
  const email = String(payload.email || "").trim().toLowerCase();
  const password = String(payload.password || "");
  const roleLabel = String(payload.roleLabel || "Staff").trim();
  const shiftDate = String(payload.shiftDate || "");
  const allowedRoutes = Array.isArray(payload.allowedRoutes) ? payload.allowedRoutes.filter((route): route is string => typeof route === "string" && ADMIN_ROUTES.has(route)) : [];

  if (!staffName || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8 || !roleLabel || !/^\d{4}-\d{2}-\d{2}$/.test(shiftDate) || allowedRoutes.length === 0) {
    return response({ error: "Enter a name, valid email, password of at least 8 characters, start date, and one or more permitted pages." }, 400);
  }

  const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: staffName },
  });
  if (createError || !created.user) return response({ error: createError?.message || "Unable to create the staff login." }, 400);

  const userId = created.user.id;
  const rollback = async () => { await admin.auth.admin.deleteUser(userId); };
  const { error: profileError } = await admin.from("profiles").update({
    display_name: staffName,
    role: "ADMIN",
    is_authorized: true,
    allowed_routes: [...new Set(allowedRoutes)],
  }).eq("id", userId);
  if (profileError) { await rollback(); return response({ error: "Unable to authorize the staff login." }, 500); }

  const { data: staff, error: staffError } = await admin.from("staff").insert({
    auth_user_id: userId,
    full_name: staffName,
    role_label: roleLabel,
  }).select("id, full_name, role_label").single();
  if (staffError || !staff) { await rollback(); return response({ error: "Unable to create the staff record." }, 500); }

  const { data: shift, error: shiftError } = await admin.from("staff_shifts").insert({
    staff_id: staff.id,
    shift_date: shiftDate,
  }).select("*").single();
  if (shiftError || !shift) { await admin.from("staff").delete().eq("id", staff.id); await rollback(); return response({ error: "Unable to create the first staff shift." }, 500); }

  return response({ staff: { ...shift, staff: { full_name: staff.full_name, role_label: staff.role_label } } }, 201);
});
