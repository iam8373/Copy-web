import { ImageResponse } from "next/og";
import { MarkImage } from "@/lib/brand/mark-image";

/** Apple touch icon (S4), generated at build time from the brand mark. */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(<MarkImage size={180} radius={0} padding={18} />, size);
}
