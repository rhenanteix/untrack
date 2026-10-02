import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LinkOr",
    short_name: "LinkOr",
    description: "Crie, organize e acompanhe links, UTMs e QR Codes.",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f7f2",
    theme_color: "#172a3a",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
