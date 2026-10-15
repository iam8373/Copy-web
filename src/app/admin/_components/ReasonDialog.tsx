"use client";

import { useState } from "react";
import { Button, Dialog } from "@/components/ui";
import { COPY, errorMessage } from "../_copy";
import { label, textarea } from "./styles";

/** A destructive action that needs a written reason (reject, withdraw, suspend). */
export function ReasonDialog({
  trigger,
  title,
  body,
  onConfirm,
}: {
  trigger: string;
  title: string;
  body: string;
  onConfirm: (reason: string) => Promise<string | null>;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const close = () => {
    setOpen(false);
    setReason("");
    setError(null);
  };
  const go = async () => {
    setBusy(true);
    setError(null);
    const err = await onConfirm(reason.trim());
    setBusy(false);
    if (err) setError(errorMessage(err));
    else close();
  };
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
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
            <Button variant="no" onClick={go} loading={busy} disabled={reason.trim().length < 3}>
              {trigger}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-1">
          <label htmlFor="reason" className={label}>
            {COPY.resolutions.reason}
          </label>
          <textarea id="reason" data-autofocus className={textarea} value={reason} maxLength={2000} onChange={(e) => setReason(e.target.value)} />
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
