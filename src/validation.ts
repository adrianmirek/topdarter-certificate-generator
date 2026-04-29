import { z } from "zod";

export const certificateRequestSchema = z.object({
  display_name: z.string().trim().min(2).max(60),
  font_url: z.string().url(),
  watermark_detection_image_url: z.string().url(),
  watermark_image_url: z.string().url(),
  stats: z
    .object({
      average_score: z.number().nullable().optional(),
      high_finish: z.number().int().nonnegative().optional(),
      best_leg: z.union([z.string(), z.number()]).optional(),
      score_140_count: z.number().int().nonnegative().optional(),
      score_170_count: z.number().int().nonnegative().optional(),
    })
    .default({}),
});

export type CertificateRequest = z.infer<typeof certificateRequestSchema>;
