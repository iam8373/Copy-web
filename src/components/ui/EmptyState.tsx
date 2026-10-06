import type { ReactNode } from "react";
import { Inbox, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  title: string;
  body?: string;
  icon?: LucideIcon;
  /** Optional call to action, e.g. a <Button> or <Link>. */
  action?: ReactNode;
  /** "compact" for tabs and table bodies; "default" for page sections. */
  size?: "default" | "compact";
  className?: string;
  "data-testid"?: string;
}

/**
 * Honest "nothing here yet" block, used instead of fake rows (activity,
 * holders, positions, comments) until the backend provides real data.
 */
export function EmptyState({
  title,
  body,
  icon: Icon = Inbox,
  action,
  size = "default",
  className,
  "data-testid": testId,
}: EmptyStateProps) {
  return (
    <div
      data-testid={testId ?? "empty-state"}
      className={cn(
        "flex flex-col items-center gap-2 rounded-card border border-dashed border-subtle text-center",
        size === "compact" ? "px-4 py-6" : "px-6 py-12",
        className
      )}
    >
      <span className="grid h-10 w-10 place-items-center rounded-full bg-surface-3 text-muted">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <p className="text-14 font-semibold text-primary">{title}</p>
      {body && <p className="max-w-sm text-13 text-secondary">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
