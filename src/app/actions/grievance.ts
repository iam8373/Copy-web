"use server";

import { z } from "zod";
import { submitGrievance, type GrievanceResult } from "@/services/grievances/server";

/** Public grievance form (R6). Thin: zod, then the server-only service. */

const Input = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email().max(254),
  category: z.enum(["account", "market", "resolution", "privacy", "other"]),
  subject: z.string().trim().min(1).max(200),
  message: z.string().trim().min(10).max(5000),
  // Honeypot: real people never fill it.
  website: z.string().max(0).optional(),
});

export async function sendGrievance(input: unknown): Promise<GrievanceResult> {
  const p = Input.safeParse(input);
  if (!p.success) return { ok: false, reason: "invalid" };
  const { website: _hp, ...fields } = p.data;
  return submitGrievance(fields);
}
