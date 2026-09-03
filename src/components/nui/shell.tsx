"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Briefcase, LayoutGrid, Radio, Search, ShieldAlert, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { setApiToken } from "@/lib/api/client";
import { useSession } from "@/components/providers/session-provider";
import { LiveClock } from "@/components/ops/live";
import { SignalDot } from "@/components/ops/signal";
import { onHostMessage, postToHost, type CharacterContext } from "./bridge";

const TABS = [
  { href: "/nui", label: "Home", icon: LayoutGrid },
  { href: "/nui/ops", label: "Ops", icon: Radio },
  { href: "/nui/units", label: "Units", icon: Radio },
  { href: "/nui/search", label: "Search", icon: Search },
  { href: "/nui/briefing", label: "Briefing", icon: Briefcase },
];

const TOKEN_STORAGE_KEY = "nui:token";
const CHARACTER_STORAGE_KEY = "nui:character";

/**
 * In-game shell.
 *
 * Deliberately smaller than the desktop application: no page scroll, large
 * touch targets, one hand on the keyboard. It reads the access token handed to
 * it by the game (or the preview page), and reports every action back through
 * the same bridge, so the resource stays in control of focus and the cursor.
 */
export function NuiShell({ children }: { children: React.ReactNode }) {
  const { data, error, loading } = useSession();
  const pathname = usePathname();
  const [character, setCharacter] = React.useState<CharacterContext | null>(null);
  const [ready, setReady] = React.useState(false);

  // Accept the token from the query string (deep link) or from the host page.
  React.useEffect(() => {
    const fromQuery = new URLSearchParams(window.location.search).get("token");
    const stored = window.sessionStorage.getItem(TOKEN_STORAGE_KEY);
    const token = fromQuery ?? stored;
    if (token) {
      setApiToken(token);
      window.sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
      // The token is a credential: keep it out of the address bar and history.
      if (fromQuery) window.history.replaceState({}, "", window.location.pathname);
    }
    const storedCharacter = window.sessionStorage.getItem(CHARACTER_STORAGE_KEY);
    if (storedCharacter) {
      try {
        setCharacter(JSON.parse(storedCharacter) as CharacterContext);
      } catch {
        // Ignore a corrupt value; the host will send a fresh one.
      }
    }
    setReady(true);
    postToHost({ type: "mdt:ready" });

    return onHostMessage((message) => {
      if (message.type === "mdt:init") {
        if (message.token) {
          setApiToken(message.token);
          window.sessionStorage.setItem(TOKEN_STORAGE_KEY, message.token);
        }
        if (message.character) {
          setCharacter(message.character);
          window.sessionStorage.setItem(CHARACTER_STORAGE_KEY, JSON.stringify(message.character));
        }
      }
    });
  }, []);

  // Escape closes the tablet, exactly as it does in game.
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        postToHost({ type: "mdt:close" });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  React.useEffect(() => {
    postToHost({ type: "mdt:opened", path: pathname });
  }, [pathname]);

  const branding = data?.config.branding;
  const operator = data?.user;
  const callsign = character?.callsign ?? operator?.badgeNumber ?? null;

  if (error || (!loading && !data)) {
    return (
      <div className="flex h-screen items-center justify-center bg-background p-6">
        <div className="ops-frame max-w-md p-5 text-center">
          <ShieldAlert className="mx-auto h-6 w-6 text-destructive" />
          <p className="mt-3 text-sm font-semibold">This device is not connected</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {(error as Error | null)?.message ?? "The MDT could not identify this operator."}
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            Ask a supervisor to link your character, then close and reopen the tablet.
          </p>
          <button
            type="button"
            onClick={() => postToHost({ type: "mdt:close" })}
            className="mt-4 rounded-md border border-border bg-secondary px-3 py-1.5 text-xs"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      {/* Rail */}
      <nav className="flex w-[74px] shrink-0 flex-col items-center gap-1 border-r border-border/70 bg-sidebar py-3">
        <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-[10px] font-bold text-primary-foreground shadow-[var(--console-glow)]">
          {(branding?.organisationShort ?? "OP").slice(0, 3).toUpperCase()}
        </div>
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "relative flex w-[62px] flex-col items-center gap-1 rounded-md px-1 py-2 text-[10px] transition-colors",
                active ? "bg-sidebar-accent text-foreground" : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
              )}
            >
              {active ? <span aria-hidden className="absolute inset-y-2 left-0 w-[2px] rounded-full bg-[hsl(var(--signal-live))]" /> : null}
              <Icon className="h-5 w-5" />
              <span>{tab.label}</span>
            </Link>
          );
        })}
        <div className="mt-auto flex flex-col items-center gap-2">
          <SignalDot signal="live" pulse />
        </div>
      </nav>

      {/* Body */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border/70 px-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{branding?.organisationName ?? "Operations"}</p>
            <p className="truncate text-[11px] text-muted-foreground">
              {operator?.name ? `${operator.name}` : "Unknown operator"}
              {operator?.jobTitle ? ` · ${operator.jobTitle}` : ""}
            </p>
          </div>
          {callsign ? (
            <span className="data-mono rounded-md border border-border bg-secondary/60 px-2 py-0.5 text-[11px] font-semibold">{callsign}</span>
          ) : null}
          <div className="ml-auto flex items-center gap-3">
            <LiveClock className="text-xs" />
            <button
              type="button"
              onClick={() => postToHost({ type: "mdt:close" })}
              aria-label="Close the MDT"
              className="rounded-md border border-border bg-secondary/60 p-1.5 text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <main className="ops-backdrop min-h-0 flex-1 overflow-y-auto ops-scroll p-4">{ready ? children : null}</main>
      </div>
    </div>
  );
}
