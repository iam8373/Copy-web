import type { MetadataRoute } from "next";
import { imageColor } from "@/lib/tokens";

/** Web app manifest (S4). Icons are the generated PNGs from src/app/icon1.tsx. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BharatPredict",
    short_name: "BharatPredict",
    description: "Prediction markets on Indian and world events, with play credits.",
    start_url: "/",
    display: "standalone",
    background_color: imageColor.surface,
    theme_color: imageColor.surface,
    icons: [
      { src: "/icon.svg", type: "image/svg+xml", sizes: "any" },
      { src: "/icon1/192", type: "image/png", sizes: "192x192" },
      { src: "/icon1/512", type: "image/png", sizes: "512x512" },
    ],
  };
}
