"use client";

import { CloudOff } from "lucide-react";
import { useT } from "@/i18n/LanguageProvider";
import { Button, EmptyState } from "@/components/ui";

/** Shown when markets cannot be loaded (database unreachable). */
export function MarketsUnavailable() {
  const { t } = useT();
  return (
    <EmptyState
      data-testid="markets-unavailable"
      icon={CloudOff}
      title={t("empty", "unavailableTitle")}
      body={t("empty", "unavailableBody")}
      action={
        <Button size="sm" variant="secondary" onClick={() => window.location.reload()}>
          {t("errors", "retry")}
        </Button>
      }
    />
  );
}
