import { z } from "zod";

export const updateProfileSchema = z.object({
  full_name: z.string().min(1).max(100).optional(),
  currency: z.string().length(3).optional(),
});

export const completeOnboardingSchema = z.object({
  full_name: z.string().min(1).max(100),
  currency: z.string().length(3),
  balance: z.number().min(0),
});
