import type { Metadata, Viewport } from "next";

import { Providers } from "@/components/providers";
import { getTheme } from "@/server/configuration/service";

import "./globals.css";

export const metadata: Metadata = {
  title: "Operations Platform",
  description: "Configurable operational records and dispatch platform.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0b1220",
  width: "device-width",
  initialScale: 1,
};

/**
 * Root layout.
 * Branding and theme values are read from the database so a fresh
 * installation renders the organisation's identity, not a placeholder.
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let theme = null;
  try {
    theme = await getTheme();
  } catch {
    // The database may not be reachable during a cold build - fall back to the
    // default tokens defined in globals.css.
  }

  return (
    <html lang="en" data-theme={theme?.mode === "light" ? "light" : "dark"} suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:text-primary-foreground"
        >
          Skip to content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
