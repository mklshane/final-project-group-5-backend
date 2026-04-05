import { supabase } from "../config/supabase.js";
import { NotFoundError } from "../utils/errors.js";

export class ProfileService {
  async getProfile(userId) {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (error || !data) throw new NotFoundError("Profile");
    return data;
  }

  async updateProfile(userId, input) {
    const { data, error } = await supabase
      .from("profiles")
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq("id", userId)
      .select()
      .single();

    if (error) throw new Error(`Profile update failed: ${error.message}`);
    return data;
  }

  async completeOnboarding(userId, input) {
    const { data, error } = await supabase
      .from("profiles")
      .update({
        currency: input.currency,
        balance: input.balance,
        onboarding_done: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)
      .select()
      .single();

    if (error) throw new Error(`Onboarding failed: ${error.message}`);
    return data;
  }
}

export const profileService = new ProfileService();
