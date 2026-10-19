import type { Metadata, Viewport } from "next";
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/figtree";
import "./globals.css";
import { AppShell } from "@/components/AppShell";
import { withBase } from "@/lib/base";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Bibliotheca · cărți audio gratuite în română",
    template: "%s · Bibliotheca",
  },
  description:
    "Cărți audio gratuite în limba română: clasici românești citiți de voluntari LibriVox sau narați cu voci AI.",
  applicationName: "Bibliotheca",
  manifest: withBase("/manifest.webmanifest"),
  icons: {
    icon: [
      { url: withBase("/icons/favicon.svg"), type: "image/svg+xml" },
      { url: withBase("/icons/favicon-48.png"), sizes: "48x48", type: "image/png" },
      { url: withBase("/icons/icon-192.png"), sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: withBase("/icons/apple-touch-icon.png"), sizes: "180x180" }],
  },
  appleWebApp: {
    capable: true,
    title: "Bibliotheca",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#0b0b0d",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ro">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
