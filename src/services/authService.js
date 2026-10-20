import { isSupabaseConfigured, supabase } from "../lib/supabase";

export async function authenticateUser({ email, password }) {
  if (!isSupabaseConfigured) throw new Error("Supabase is not configured.");

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: String(email).trim(),
    password: String(password),
  });

  if (authError) throw authError;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, display_name, role, is_authorized")
    .eq("id", authData.user.id)
    .single();

  if (profileError || !profile?.is_authorized) {
    await supabase.auth.signOut();
    throw profileError || new Error("This account is not authorized.");
  }

  return {
    id: profile.id,
    name: profile.display_name,
    email: authData.user.email,
    role: profile.role,
    isAuthorized: profile.is_authorized,
  };
}
