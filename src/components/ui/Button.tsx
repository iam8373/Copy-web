"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/LanguageProvider";
import { FOCUS_RING, HIT_AREA } from "./focus";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "outline" | "yes" | "no";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-brand-fill text-white hover:bg-brand-fill-hover",
  secondary: "bg-surface-3 text-primary hover:bg-surface-3/70",
  ghost: "text-secondary hover:bg-surface-3 hover:text-primary",
  outline: "border border-strong text-primary hover:bg-surface-3",
  // Tinted, not solid: white on the dark-theme success/danger fills fails AA.
  yes: "border border-success/30 bg-success/15 text-success hover:bg-success/20",
  no: "border border-danger/30 bg-danger/15 text-danger hover:bg-danger/20",
};

/** Visual heights 32 / 40 / 48 px; the hit area is always at least 44 px. */
const SIZES: Record<ButtonSize, string> = {
  sm: "h-8 gap-1.5 px-3 text-13",
  md: "h-10 gap-2 px-4 text-14",
  lg: "h-12 gap-2 px-5 text-16",
};

const ICON_SIZES: Record<ButtonSize, string> = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-12 w-12",
};

const BASE =
  "relative inline-flex shrink-0 select-none items-center justify-center rounded-btn font-semibold transition-colors duration-xs ease-standard active:brightness-95 disabled:pointer-events-none disabled:opacity-40";

/**
 * Class string for button-styled elements that are not <button>, e.g. a
 * next/link `<Link className={buttonClasses({ variant: "primary" })}>`.
 */
export function buttonClasses({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
} = {}) {
  return cn(BASE, HIT_AREA, FOCUS_RING, VARIANTS[variant], SIZES[size], fullWidth && "w-full", className);
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  /** Shows a spinner, sets aria-busy and blocks clicks; the label stays for width. */
  loading?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    fullWidth,
    loading = false,
    leadingIcon,
    trailingIcon,
    className,
    children,
    disabled,
    type = "button",
    ...rest
  },
  ref
) {
  const { t } = useT();
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses({ variant, size, fullWidth, className })}
      {...rest}
    >
      {loading && (
        <span className="absolute inset-0 grid place-items-center">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          <span className="sr-only">{t("loading", "label")}</span>
        </span>
      )}
      <span className={cn("inline-flex min-w-0 items-center gap-[inherit]", loading && "invisible")}>
        {leadingIcon && <span className="shrink-0" aria-hidden>{leadingIcon}</span>}
        {children !== undefined && <span className="truncate">{children}</span>}
        {trailingIcon && <span className="shrink-0" aria-hidden>{trailingIcon}</span>}
      </span>
    </button>
  );
});

export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label" | "children"> {
  /** Required: icon-only buttons need an accessible name. */
  label: string;
  icon: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, icon, variant = "ghost", size = "sm", className, type = "button", ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cn(BASE, HIT_AREA, FOCUS_RING, VARIANTS[variant], ICON_SIZES[size], "p-0", className)}
      {...rest}
    >
      <span aria-hidden className="grid place-items-center [&>svg]:h-4 [&>svg]:w-4">
        {icon}
      </span>
    </button>
  );
});
