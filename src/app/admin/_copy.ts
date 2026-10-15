/**
 * Admin panel copy. English only by owner decision: staff work in English and
 * none of this is shown to users. User-facing strings stay in src/i18n.
 */
import type { StaffRole } from "@/services/admin/auth";

export const NAV: Array<{ href: string; label: string; min: StaffRole }> = [
  { href: "/admin", label: "Dashboard", min: "moderator" },
];

export const COPY = {
  title: "Admin",
  brand: "BharatPredict admin",
  backToSite: "Back to site",
  signedInAs: (handle: string, role: string) => `Signed in as ${handle} (${role})`,
  playCredits: "Play credits only — no real money.",
  dashboard: {
    title: "Dashboard",
    intro: "What needs attention right now.",
    tradingOn: "Trading is on",
    tradingOff: "Trading is paused (kill switch)",
    stats: {
      open: "Open markets",
      closingSoon: "Closing in 24 h",
      drafts: "Drafts",
      awaiting: "Awaiting a proposal",
      pending: "Proposals to approve",
      inWindow: "In dispute window",
      grievances: "Open grievances",
      users: "Users",
      suspended: "Suspended",
    },
    windowTitle: "Dispute windows",
    windowEmpty: "No resolution is in its dispute window.",
    windowEnds: (when: string) => `ends ${when}`,
    selfApproved: "self-approved",
    auditTitle: "Recent activity",
    auditEmpty: "Nothing yet.",
    system: "system",
    unavailable: "The database could not be reached. Try again in a moment.",
  },
  mfa: {
    title: "Two-step verification",
    intro: "Every admin action needs an authenticator app code in this session.",
    enrollTitle: "Set up your authenticator app",
    enrollSteps: [
      "Open an authenticator app (Google Authenticator, 1Password, Authy…).",
      "Scan the QR code, or enter the setup key by hand.",
      "Type the 6-digit code it shows.",
    ],
    start: "Start setup",
    qrAlt: "QR code for your authenticator app",
    secretLabel: "Setup key",
    challengeTitle: "Enter your code",
    challengeIntro: "Open your authenticator app and type the 6-digit code for BharatPredict.",
    codeLabel: "6-digit code",
    verify: "Verify",
    done: "Verified. Opening the dashboard…",
    already: "This session is verified.",
    toDashboard: "Go to the dashboard",
    lost: "Lost your authenticator? The project owner resets it in Supabase (docs/ADMIN_RUNBOOK.md, \"Lost authenticator\").",
  },
} as const;

/** Database error codes (BP_*) → messages for staff. */
export const ERRORS: Record<string, string> = {
  BP_NOT_SIGNED_IN: "Your session ended. Sign in again.",
  BP_FORBIDDEN: "Your role cannot do this.",
  BP_MFA_REQUIRED: "Verify with your authenticator app first.",
  BP_NOT_FOUND: "Not found. It may have been changed by someone else; reload.",
  BP_CONFIRM_MISMATCH: "The typed slug does not match.",
  BP_INVALID_INPUT: "Some fields are invalid. Check them and try again.",
  BP_INVALID_AMOUNT: "That amount is not allowed.",
  BP_SLUG_TAKEN: "That slug is already used by another market.",
  BP_FIELD_LOCKED: "That field cannot change in the market's current status.",
  BP_WRONG_STATUS: "Not possible in the current status. Reload to see the latest state.",
  BP_NOT_READY: "Not ready to publish: needs a future end date, outcomes and a resolution source.",
  BP_ALREADY_PROPOSED: "This market already has a proposal.",
  BP_SECOND_PERSON_REQUIRED: "A second admin must approve (two-person rule is on).",
  BP_DISPUTE_WINDOW_OPEN: "The dispute window has not ended yet.",
  BP_SELF_ACTION: "You cannot do this to your own account.",
  BP_LAST_ADMIN: "This is the last admin; promote someone else first.",
  BP_INSUFFICIENT_FUNDS: "That would take the balance below zero.",
  BP_UNKNOWN_SETTING: "Unknown setting.",
  RATE_LIMITED: "Too many actions in a short time. Wait a minute.",
  INVALID_CODE: "That code is not right. Check the time on your phone and try again.",
  FAILED: "Something went wrong. Nothing was changed.",
};

export function errorMessage(code: string | undefined): string {
  return (code && ERRORS[code]) || ERRORS.FAILED;
}
