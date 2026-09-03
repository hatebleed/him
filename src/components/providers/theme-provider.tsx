"use client";

import * as React from "react";

import type { Branding, ThemeConfig } from "./session-provider";

/**
 * Applies organisation branding and theme by writing CSS variables.
 * Nothing about the look of the application is hard-coded in components.
 */
export function applyTheme(theme: ThemeConfig | null | undefined, branding: Branding | null | undefined) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  if (theme?.mode) root.dataset.theme = theme.mode === "light" ? "light" : "dark";
  root.dataset.density = theme?.density ?? "comfortable";
  root.dataset.motion = theme?.motion ?? "full";

  if (theme?.radius) root.style.setProperty("--radius", theme.radius);
  if (branding?.primaryColour) root.style.setProperty("--primary", hexToHslTriplet(branding.primaryColour) ?? root.style.getPropertyValue("--primary"));
  if (branding?.accentColour) root.style.setProperty("--accent", hexToHslTriplet(branding.accentColour) ?? root.style.getPropertyValue("--accent"));
  if (branding?.sidebarColour) root.style.setProperty("--sidebar", hexToHslTriplet(branding.sidebarColour) ?? root.style.getPropertyValue("--sidebar"));
}

/** Converts #rrggbb into "H S% L%" so it can be used with hsl(var(--x)). */
export function hexToHslTriplet(hex: string): string | null {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!match) return null;
  const r = parseInt(match[1]!, 16) / 255;
  const g = parseInt(match[2]!, 16) / 255;
  const b = parseInt(match[3]!, 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h /= 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export function ThemeSync({ theme, branding }: { theme?: ThemeConfig | null; branding?: Branding | null }) {
  React.useEffect(() => {
    applyTheme(theme, branding);
  }, [theme, branding]);

  React.useEffect(() => {
    if (!branding?.organisationName) return;
    document.title = `${branding.organisationName} · Operations Platform`;
  }, [branding?.organisationName]);

  return null;
}
