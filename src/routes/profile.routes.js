import { Router } from "express";
import { auth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { updateProfileSchema, completeOnboardingSchema } from "../schemas/profile.schema.js";
import { getProfile, updateProfile, completeOnboarding } from "../controllers/profile.controller.js";

const router = Router();

router.get("/", auth, getProfile);
router.patch("/", auth, validate(updateProfileSchema), updateProfile);
router.post("/complete-onboarding", auth, validate(completeOnboardingSchema), completeOnboarding);

export default router;
