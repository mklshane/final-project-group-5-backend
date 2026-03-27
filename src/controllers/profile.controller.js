import { profileService } from "../services/profile.service.js";

export async function getProfile(req, res) {
  const profile = await profileService.getProfile(req.user.id);
  res.json(profile);
}

export async function updateProfile(req, res) {
  const profile = await profileService.updateProfile(req.user.id, req.body);
  res.json(profile);
}

export async function completeOnboarding(req, res) {
  const profile = await profileService.completeOnboarding(req.user.id, req.body);
  res.json(profile);
}
