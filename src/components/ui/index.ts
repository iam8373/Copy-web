/**
 * Shared UI primitives (docs/DESIGN.md → Components). New buttons, chips,
 * tabs, tooltips, dialogs and empty states are built from these only.
 */
export { Button, IconButton, buttonClasses } from "./Button";
export type { ButtonProps, IconButtonProps, ButtonVariant, ButtonSize } from "./Button";
export { Chip } from "./Chip";
export type { ChipProps, ChipTone } from "./Chip";
export { Badge } from "./Badge";
export type { BadgeProps, BadgeTone } from "./Badge";
export { Card } from "./Card";
export type { CardProps } from "./Card";
export { EmptyState } from "./EmptyState";
export type { EmptyStateProps } from "./EmptyState";
export { Tabs, TabPanel, tabId, panelId } from "./Tabs";
export type { TabItem, TabsProps, TabPanelProps } from "./Tabs";
export { Tooltip } from "./Tooltip";
export type { TooltipProps } from "./Tooltip";
export { Dialog } from "./Dialog";
export type { DialogProps } from "./Dialog";
export { FOCUS_RING, HIT_AREA } from "./focus";
