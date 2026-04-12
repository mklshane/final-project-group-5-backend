import { supabase } from "../config/supabase.js";

const PROFILE_FIELDS = "id, role, full_name, email, currency";

function buildProfileSeed(user) {
  return {
    id: user.id,
    email: (user.email || "").trim().toLowerCase(),
    full_name: (user.user_metadata?.full_name || user.user_metadata?.name || "").trim(),
  };
}

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
      .select(PROFILE_FIELDS)
      .eq("id", data.user.id)
      .single();

    if (profileError && profileError.code !== "PGRST116") {
      console.error('[auth] profile fetch failed for user', data.user.id, ':', JSON.stringify(profileError));
      return res.status(500).json({ error: "Failed to read user profile", detail: profileError.message });
    }

    if (!profile) {
      // Recover from an orphaned auth user (exists in auth.users but missing in profiles).
      const { data: createdProfile, error: createError } = await supabase
        .from("profiles")
        .insert(buildProfileSeed(data.user))
        .select(PROFILE_FIELDS)
        .single();

      if (createError || !createdProfile) {
        console.error('[auth] profile recovery failed for user', data.user.id, ':', JSON.stringify(createError));

        if (createError?.code === "23505") {
          return res.status(409).json({
            error: "Account data conflict detected",
            detail: "A profile already exists for this email under a different account.",
          });
        }

        return res.status(500).json({ error: "Unable to initialize user profile", detail: createError?.message });
      }

      req.userProfile = createdProfile;
      return next();
    }

    req.userProfile = profile;
    next();
  } catch (err) {
    console.error('[auth] unexpected error:', err);
    return res.status(401).json({ error: "Authentication failed", detail: err?.message });
  }
}
