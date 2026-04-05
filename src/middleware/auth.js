import { supabase } from "../config/supabase.js";

export async function auth(req, res, next) {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid Authorization header" });
  }

  const token = header.replace("Bearer ", "");

  try {
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      console.error('[auth] getUser failed:', JSON.stringify(error));
      return res.status(401).json({ error: "Invalid or expired token", detail: error?.message });
    }

    req.user = data.user;

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role, full_name, email, currency")
      .eq("id", data.user.id)
      .single();

    if (profileError || !profile) {
      console.error('[auth] profile fetch failed for user', data.user.id, ':', JSON.stringify(profileError));
      return res.status(401).json({ error: "User profile not found", detail: profileError?.message });
    }

    req.userProfile = profile;
    next();
  } catch (err) {
    console.error('[auth] unexpected error:', err);
    return res.status(401).json({ error: "Authentication failed", detail: err?.message });
  }
}
