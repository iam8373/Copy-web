import { ImageResponse } from "next/og";
import { MarkImage } from "@/lib/brand/mark-image";
import { imageColor } from "@/lib/tokens";

/**
 * Social preview (S4), generated at build time with Next's built-in renderer
 * and its bundled Latin font (English text only, so no font is downloaded).
 */
export const alt = "BharatPredict — prediction markets on Indian and world events, with play credits";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 96,
          background: imageColor.surface,
          color: imageColor.text,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <MarkImage size={120} />
          <div style={{ display: "flex", fontSize: 84, fontWeight: 700, letterSpacing: -2 }}>BharatPredict</div>
        </div>
        <div style={{ display: "flex", marginTop: 40, fontSize: 40, color: imageColor.textSecondary }}>
          Prediction markets on Indian and world events.
        </div>
        <div style={{ display: "flex", marginTop: 12, fontSize: 32, color: imageColor.textSecondary }}>
          Play credits only — no real money.
        </div>
      </div>
    ),
    size
  );
}
