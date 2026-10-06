"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { FOCUS_RING, HIT_AREA } from "./focus";

export interface TabItem<V extends string = string> {
  value: V;
  label: ReactNode;
  /** Optional count shown after the label (tabular numerals). */
  count?: number;
  disabled?: boolean;
}

export interface TabsProps<V extends string = string> {
  /** Unique per page; used to link tabs and panels by id. */
  id: string;
  items: TabItem<V>[];
  value: V;
  onValueChange: (value: V) => void;
  /** Accessible name for the tab list. */
  label: string;
  /** "underline" for section tabs, "pill" for compact segmented choices. */
  variant?: "underline" | "pill";
  className?: string;
}

export const tabId = (id: string, value: string) => `${id}-tab-${value}`;
export const panelId = (id: string, value: string) => `${id}-panel-${value}`;

/**
 * WAI-ARIA tabs with automatic activation: Left/Right move and select, Home/End
 * jump, only the selected tab is in the Tab order (roving tabindex). Scrolls
 * horizontally rather than wrapping at 360 px.
 */
export function Tabs<V extends string>({
  id,
  items,
  value,
  onValueChange,
  label,
  variant = "underline",
  className,
}: TabsProps<V>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const enabled = items.map((it, i) => (it.disabled ? -1 : i)).filter((i) => i >= 0);
    const pos = enabled.indexOf(index);
    let next: number | undefined;
    if (e.key === "ArrowRight") next = enabled[(pos + 1) % enabled.length];
    else if (e.key === "ArrowLeft") next = enabled[(pos - 1 + enabled.length) % enabled.length];
    else if (e.key === "Home") next = enabled[0];
    else if (e.key === "End") next = enabled[enabled.length - 1];
    if (next === undefined) return;
    e.preventDefault();
    refs.current[next]?.focus();
    onValueChange(items[next].value);
  };

  return (
    <div
      role="tablist"
      aria-label={label}
      aria-orientation="horizontal"
      className={cn(
        "no-scrollbar flex overflow-x-auto",
        variant === "underline" ? "gap-4 border-b border-subtle" : "gap-1 rounded-btn bg-surface-3 p-1",
        className
      )}
    >
      {items.map((item, i) => {
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={tabId(id, item.value)}
            aria-selected={selected}
            aria-controls={panelId(id, item.value)}
            tabIndex={selected ? 0 : -1}
            disabled={item.disabled}
            onClick={() => onValueChange(item.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              "relative inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap font-semibold transition-colors duration-xs ease-standard disabled:opacity-40",
              FOCUS_RING,
              variant === "underline" &&
                cn(
                  // 44 px tall: meets the touch rule without a pseudo hit area.
                  "-mb-px h-11 border-b-2 text-14",
                  selected
                    ? "border-brand text-primary"
                    : "border-transparent text-secondary hover:text-primary"
                ),
              variant === "pill" &&
                cn(
                  "h-8 rounded-chip px-3 text-13",
                  HIT_AREA,
                  selected ? "bg-surface-1 text-primary shadow-card" : "text-secondary hover:text-primary"
                )
            )}
          >
            {item.label}
            {item.count !== undefined && (
              <span className="tnum text-12 font-medium text-muted">{item.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export interface TabPanelProps {
  id: string;
  value: string;
  /** The currently selected tab value; the panel is hidden otherwise. */
  selected: string;
  children: ReactNode;
  className?: string;
}

/** Panel for one tab. Unselected panels are not rendered. */
export function TabPanel({ id, value, selected, children, className }: TabPanelProps) {
  if (value !== selected) return null;
  return (
    <div
      role="tabpanel"
      id={panelId(id, value)}
      aria-labelledby={tabId(id, value)}
      // Focusable so keyboard users can reach panels with no focusable content.
      tabIndex={0}
      className={cn(FOCUS_RING, "rounded-chip", className)}
    >
      {children}
    </div>
  );
}
