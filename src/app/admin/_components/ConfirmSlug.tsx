"use client";

import { useState } from "react";
import { Button, Dialog } from "@/components/ui";
import { COPY, errorMessage } from "../_copy";
import { input, label } from "./styles";

/**
 * Typed-slug confirmation for publish / close / approve / finalize. The
 * database checks the slug again (BP_CONFIRM_MISMATCH).
 */
export function ConfirmSlug({
  slug,
  trigger,
  title,
  body,
  confirmLabel,
  variant = "primary",
  onConfirm,
  children,
}: {
  slug: string;
  trigger: string;
  title: string;
  body: string;
  confirmLabel?: string;
  variant?: "primary" | "outline" | "no";
  /** Return an error code, or null on success. */
  onConfirm: (typed: string) => Promise<string | null>;
  /** Extra fields shown above the slug input (e.g. a reason). */
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setOpen(false);
    setTyped("");
    setError(null);
  };
  const go = async () => {
    setBusy(true);
    setError(null);
    const err = await onConfirm(typed);
    setBusy(false);
    if (err) setError(errorMessage(err));
    else close();
  };

  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)}>
        {trigger}
      </Button>
      <Dialog
        open={open}
        onClose={close}
        title={title}
        description={body}
        layout="center"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={close}>
              {COPY.confirm.cancel}
            </Button>
            <Button variant={variant} onClick={go} loading={busy} disabled={typed !== slug}>
              {confirmLabel ?? trigger}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-3">
          {children}
          <div className="flex flex-col gap-1">
            <label htmlFor="confirm-slug" className={label}>
              {COPY.confirm.slugLabel}
            </label>
            <p className="text-13 text-secondary">{COPY.confirm.typeSlug(slug)}</p>
            <input
              id="confirm-slug"
              data-autofocus
              autoComplete="off"
              spellCheck={false}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className={input + " font-mono"}
            />
          </div>
          {error && (
            <p role="alert" className="text-13 text-danger">
              {error}
            </p>
          )}
        </div>
      </Dialog>
    </>
  );
}
