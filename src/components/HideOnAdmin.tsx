"use client";

import { usePathname } from "next/navigation";

/** Public chrome (category bar, footer, bottom nav) is not shown in /admin. */
export function HideOnAdmin({ children }: { children: React.ReactNode }) {
  const path = usePathname() ?? "";
  if (path === "/admin" || path.startsWith("/admin/")) return null;
  return <>{children}</>;
}
