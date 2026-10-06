"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/LanguageProvider";
import { IconButton } from "./Button";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  /** Visible heading; also the dialog's accessible name. */
  title: ReactNode;
  /** Hide the heading visually but keep it for screen readers. */
  hideTitle?: boolean;
  description?: ReactNode;
  children: ReactNode;
  /** Sticky area under the scrolling body, e.g. the primary action. */
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
  /**
   * "responsive" (default): bottom sheet below `sm`, centred dialog from `sm`.
   * "center": centred at every width.
   */
  layout?: "responsive" | "center";
  className?: string;
  "data-testid"?: string;
}

const WIDTHS = { sm: "sm:max-w-sm", md: "sm:max-w-md", lg: "sm:max-w-xl" } as const;

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Modal dialog / bottom sheet. Portalled to <body>; Escape and the backdrop
 * close it; Tab is trapped inside; page scroll is locked while open; focus
 * moves to the first `[data-autofocus]` element (else the panel) and returns
 * to the trigger on close.
 */
export function Dialog({
  open,
  onClose,
  title,
  hideTitle = false,
  description,
  children,
  footer,
  size = "md",
  layout = "responsive",
  className,
  "data-testid": testId,
}: DialogProps) {
  const { t } = useT();
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  // Kept in a ref so a new onClose identity each render doesn't re-run effects.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>("[data-autofocus]");
    (first ?? panel)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => !el.hasAttribute("hidden") && el.offsetParent !== null
      );
      if (items.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const head = items[0];
      const tail = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === head || active === panel)) {
        e.preventDefault();
        tail.focus();
      } else if (!e.shiftKey && active === tail) {
        e.preventDefault();
        head.focus();
      }
    };
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [open]);

  if (!mounted || !open) return null;

  const sheet = layout === "responsive";

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-50 flex justify-center",
        sheet ? "items-end sm:items-center sm:p-4" : "items-center p-4"
      )}
    >
      <div
        aria-hidden
        className="absolute inset-0 bg-black/70 animate-fade-in"
        onClick={() => onCloseRef.current()}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        data-testid={testId ?? "dialog"}
        className={cn(
          "relative flex max-h-[90dvh] w-full flex-col border border-subtle bg-surface-2 shadow-dialog outline-none animate-slide-up",
          sheet ? "rounded-t-dialog sm:rounded-dialog" : "rounded-dialog",
          WIDTHS[size],
          !sheet && "max-w-[calc(100vw-2rem)]",
          className
        )}
      >
        {sheet && (
          <span aria-hidden className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-surface-3 sm:hidden" />
        )}
        <div className="flex shrink-0 items-start gap-3 px-4 pt-4 sm:px-5 sm:pt-5">
          <div className={cn("min-w-0 flex-1", hideTitle && "sr-only")}>
            <h2 id={titleId} className="text-18 font-bold text-primary">
              {title}
            </h2>
            {description && (
              <p id={descId} className="mt-1 text-13 text-secondary">
                {description}
              </p>
            )}
          </div>
          <IconButton
            label={t("bottomNav", "close")}
            icon={<X />}
            onClick={() => onCloseRef.current()}
            className="-mr-1 -mt-1 ml-auto"
          />
        </div>
        <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          {children}
        </div>
        {footer && (
          <div className="shrink-0 border-t border-subtle px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:px-5 sm:pb-5">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
