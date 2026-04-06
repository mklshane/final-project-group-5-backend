import { z } from "zod";

export const parseReceiptSchema = z.object({
  imageBase64: z
    .string()
    .min(100, "imageBase64 is too short")
    .max(10_000_000, "imageBase64 is too large"),
  mimeType: z
    .string()
    .regex(/^image\/(jpeg|jpg|png|webp|heic|heif)$/i, "mimeType must be an image type")
    .optional(),
});
