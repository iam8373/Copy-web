"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useMarketStore } from "@/store/useMarketStore";
import { useT } from "@/i18n/LanguageProvider";
import { Button, Dialog } from "@/components/ui";
import { confirmAge } from "@/app/actions/auth";

/**
 * Asks a signed-in user without a recorded 18+ consent to confirm before
 * trading. The consent is stored server-side by confirm_age() (identity from
 * the session). Draft copy — pending legal review.
 */
export function AgeConfirmDialog() {
  const open = useMarketStore((s) => s.ageConfirmOpen);
  const setOpen = useMarketStore((s) => s.setAgeConfirmOpen);
  const setConfirmed = useMarketStore((s) => s.setAgeConfirmed);
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const { t } = useT();

  useEffect(() => {
    if (!open) {
      setOk(false);
      setBusy(false);
      setFailed(false);
    }
  }, [open]);

  return (
    <Dialog
      open={open}
      onClose={() => setOpen(false)}
      title={t("toast", "confirmAge")}
      description={t("toast", "confirmAgeBody")}
      size="sm"
      data-testid="age-confirm-dialog"
    >
      <div className="flex flex-col gap-4">
        <label className="flex cursor-pointer items-start gap-3 rounded-btn border border-subtle bg-surface-3 p-3">
          <input
            type="checkbox"
            data-testid="age-reconfirm"
            checked={ok}
            onChange={(e) => setOk(e.target.checked)}
            className="mt-1 h-4 w-4 shrink-0 accent-brand"
          />
          <span className="text-12 text-secondary">
            {t("auth", "ageConfirm")}{" "}
            <Link href="/terms" className="font-semibold text-brand underline-offset-2 hover:underline">
              {t("auth", "termsLink")}
            </Link>
          </span>
        </label>
        {failed && (
          <p role="alert" className="rounded-btn border border-danger/30 bg-danger/10 px-3 py-2 text-12 text-danger">
            {t("auth", "errorSendFailed")}
          </p>
        )}
        <Button
          size="lg"
          fullWidth
          disabled={!ok}
          loading={busy}
          onClick={async () => {
            setBusy(true);
            const r = await confirmAge().catch(() => ({ ok: false, at: null }));
            setBusy(false);
            if (r.ok && r.at) setConfirmed(r.at);
            else setFailed(true);
          }}
          className="text-14"
        >
          {t("auth", "confirmAgeButton")}
        </Button>
      </div>
    </Dialog>
  );
}
