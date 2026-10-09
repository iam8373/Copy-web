"use server";

import { z } from "zod";
import * as auth from "@/services/auth/server";

/**
 * Sign-in Server Actions. Thin: validate with zod, then call the server-only
 * auth service. Never trust anything else the client sends; identity always
 * comes from the verified session (getClaims / auth.uid()).
 */

const Email = z.string().trim().toLowerCase().email().max(254);
const Code = z.string().regex(/^\d{6}$/);
const Captcha = z.string().min(1).max(2048).optional();

export async function requestEmailCode(input: unknown): Promise<auth.SendResult> {
  const p = z.object({ email: Email, captchaToken: Captcha, ageConfirmed: z.literal(true) }).safeParse(input);
  if (!p.success) return { ok: false, reason: "invalid_email" };
  return auth.sendEmailCode(p.data.email, p.data.captchaToken);
}

export async function verifyEmailCode(input: unknown): Promise<auth.VerifyResult> {
  const p = z.object({ email: Email, code: Code, ageConfirmed: z.literal(true) }).safeParse(input);
  if (!p.success) return { ok: false, reason: "invalid" };
  return auth.verifyEmailCode(p.data.email, p.data.code);
}

export async function startGoogleSignIn(input: unknown): Promise<auth.GoogleResult> {
  const p = z.object({ next: z.string().max(512), ageConfirmed: z.literal(true) }).safeParse(input);
  if (!p.success) return { ok: false, reason: "failed" };
  return auth.startGoogle(p.data.next);
}

export async function confirmAge(): Promise<{ ok: boolean; at: string | null }> {
  const at = await auth.confirmAgeNow();
  return { ok: at !== null, at };
}

export async function signOut(): Promise<void> {
  await auth.signOutServer();
}
