import { requireStaff } from "@/services/admin/auth";
import { getSettings } from "@/services/admin/people";
import { COPY } from "../_copy";
import { fmtDate } from "../_components/format";
import { SettingRow } from "./SettingRow";

const C = COPY.settings;

export default async function Settings() {
  const staff = await requireStaff("admin");
  const rows = await getSettings(staff);
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-24 font-bold text-primary">{C.title}</h1>
        <p className="text-14 text-secondary">{C.intro}</p>
      </header>
      {!rows ? (
        <p role="alert" className="text-14 text-danger">{COPY.dashboard.unavailable}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-[rgb(var(--border-subtle))] rounded-card border border-subtle bg-surface-2">
          {rows.map((r) => {
            const [title, hint] = C.items[r.key] ?? [r.key, ""];
            return (
              <li key={r.key} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-14 font-semibold text-primary">{title}</span>
                  <span className="text-12 text-secondary">{hint}</span>
                  <span className="font-mono text-11 text-muted">{r.key}</span>
                  {r.editor && r.updatedAt && <span className="text-11 text-muted">{C.lastChanged(r.editor, fmtDate(r.updatedAt))}</span>}
                </div>
                <SettingRow k={r.key} value={r.value} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
