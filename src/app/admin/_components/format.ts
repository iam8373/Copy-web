/** Admin date/number formatting: India time, English, unambiguous. */
const DT = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export const fmtDate = (iso: string | null | undefined) => (iso ? `${DT.format(new Date(iso))} IST` : "—");
export const fmtNum = (n: number) => new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(n);
