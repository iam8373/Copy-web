import { ImageResponse } from "next/og";
import { MarkImage } from "@/lib/brand/mark-image";

/** PNG fallbacks for the SVG favicon (S4): 32 px and 192/512 px for the manifest. */
const SIZES = [32, 192, 512] as const;

export function generateImageMetadata() {
  return SIZES.map((s) => ({ id: String(s), size: { width: s, height: s }, contentType: "image/png" }));
}

export default function Icon({ id }: { id: string }) {
  const s = SIZES.find((x) => String(x) === id) ?? 32;
  return new ImageResponse(<MarkImage size={s} />, { width: s, height: s });
}
