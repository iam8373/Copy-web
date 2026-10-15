import type { AuditRow } from "@/services/admin/read";
import { COPY } from "../_copy";
import { fmtDate } from "./format";

/** Compact audit list (dashboard); the full viewer is /admin/audit (R6). */
export function AuditList({ rows, empty }: { rows: AuditRow[]; empty: string }) {
  if (rows.length === 0) return <p className="mt-2 text-13 text-secondary">{empty}</p>;
  return (
    <ul className="mt-2 flex flex-col divide-y divide-[rgb(var(--border-subtle))]">
      {rows.map((r) => (
        <li key={r.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-2 text-13">
          <span className="font-mono text-12 text-secondary">{fmtDate(r.createdAt)}</span>
          <span className="font-semibold text-primary">{r.action}</span>
          <span className="text-secondary">
            {r.entity}
            {r.entityId ? ` ${r.entityId.slice(0, 8)}` : ""}
          </span>
          <span className="text-secondary">· {r.actor ?? COPY.dashboard.system}</span>
        </li>
      ))}
    </ul>
  );
}
