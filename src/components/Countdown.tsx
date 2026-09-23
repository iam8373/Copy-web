"use client";

import { useEffect, useState } from "react";
import { countdown } from "@/lib/utils";

export function Countdown({ endDate }: { endDate: string }) {
  const [label, setLabel] = useState("--:--");

  useEffect(() => {
    setLabel(countdown(endDate));
    const id = setInterval(() => setLabel(countdown(endDate)), 1000);
    return () => clearInterval(id);
  }, [endDate]);

  return <span className="tnum">{label}</span>;
}
