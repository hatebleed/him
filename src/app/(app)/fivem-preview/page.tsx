"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Gamepad2, Link2, Monitor, Radio, Shield, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

import { api, errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { Button, Input } from "@/components/ui/primitives";
import { PageHeader } from "@/components/layout/page-header";
import { OpsPanel } from "@/components/ops/frame";
import type { HostMessage, UiMessage } from "@/components/nui/bridge";

/**
 * FiveM preview.
 *
 * Runs the exact UI the game loads - the same route, the same components - in a
 * simulated game screen, and speaks the same bridge the resource does
 * (`mdt:init` / `mdt:ready` / `mdt:close` / `mdt:notify`). What this page shows
 * is what a player sees when they type /mdt.
 *
 * Data is live: the preview runs as the signed-in operator, so the calls and
 * records inside the tablet are the ones really in the database.
 */

const TABS = [
  { key: "home", label: "Home", path: "/nui" },
  { key: "ops", label: "Ops", path: "/nui/ops" },
  { key: "units", label: "Units", path: "/nui/units" },
  { key: "search", label: "Search", path: "/nui/search" },
  { key: "briefing", label: "Briefing", path: "/nui/briefing" },
];

const RESOLUTIONS = [
  { key: "1080p", label: "1920 × 1080", width: 1920, height: 1080 },
  { key: "1440p", label: "2560 × 1440", width: 2560, height: 1440 },
  { key: "ultrawide", label: "3440 × 1440", width: 3440, height: 1440 },
];

export default function FiveMPreviewPage() {
  const [open, setOpen] = React.useState(true);
  const [path, setPath] = React.useState("/nui");
  const [resolution, setResolution] = React.useState(RESOLUTIONS[0]!);
  const [character, setCharacter] = React.useState({ callsign: "A-12", name: "Dana Whitfield", job: "police" });
  const [nonce, setNonce] = React.useState(0);
  const frameRef = React.useRef<HTMLIFrameElement>(null);

  // The preview plays the part of the game: it answers the tablet's handshake
  // and reacts to close/notify exactly as the resource's NUI page does.
  React.useEffect(() => {
    const onMessage = (event: MessageEvent<UiMessage>) => {
      const message = event.data;
      if (!message || typeof message !== "object" || typeof message.type !== "string") return;
      if (message.type === "mdt:ready") {
        const init: HostMessage = {
          type: "mdt:init",
          token: null, // The preview runs as the signed-in operator.
          character: { citizenId: "PREVIEW0001", job: character.job, callsign: character.callsign, name: character.name },
          resource: "qbx_mdt",
        };
        frameRef.current?.contentWindow?.postMessage(init, "*");
      }
      if (message.type === "mdt:close") setOpen(false);
      if (message.type === "mdt:notify") {
        if (message.level === "error") toast.error(message.message);
        else if (message.level === "success") toast.success(message.message);
        else toast.message(message.message);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [character]);

  const reopen = (next = path) => {
    setPath(next);
    setNonce((value) => value + 1);
    setOpen(true);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="FiveM preview"
        description="The in-game MDT, running in a simulated game screen. Same route, same components, same bridge messages."
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => (open ? setOpen(false) : reopen())}>
              <Gamepad2 className="h-3.5 w-3.5" /> {open ? "Close tablet" : "Open tablet"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => reopen()}>
              Reload
            </Button>
          </div>
        }
      />

      <div className="grid gap-3 xl:grid-cols-[1fr_260px]">
        {/* The "game" */}
        <div className="space-y-2">
          <div
            className={cn("relative w-full overflow-hidden rounded-xl border border-border/60 bg-black shadow-elevated")}
            style={{ aspectRatio: `${resolution.width} / ${resolution.height}` }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- a local demo backdrop, not remote content */}
            <img src="/preview/in-game-scene.jpg" alt="" className="absolute inset-0 h-full w-full object-cover opacity-90" aria-hidden />
            <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60" />

            {/* Abstract HUD: a stand-in for the game's own chrome. */}
            <div className="pointer-events-none absolute bottom-3 left-3 flex items-end gap-3">
              <div className="relative h-24 w-24 overflow-hidden rounded-full border-2 border-white/15 bg-black/55 backdrop-blur-sm">
                <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(hsl(var(--grid-line)/0.5)_1px,transparent_1px),linear-gradient(90deg,hsl(var(--grid-line)/0.5)_1px,transparent_1px)] [background-size:14px_14px]" />
                <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[hsl(var(--signal-live))] shadow-[0_0_10px_hsl(var(--signal-live))]" />
                <div className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/20" />
              </div>
              <div className="space-y-1">
                <HudChip icon={<Shield className="h-3 w-3" />} label="Armour" value={78} tone="bg-[hsl(var(--signal-live))]" />
                <HudChip icon={<Users className="h-3 w-3" />} label="Radio" value={100} tone="bg-[hsl(var(--signal-ok))]" />
              </div>
            </div>

            {/* The tablet */}
            {open ? (
              <div className="absolute inset-[6%] flex items-center justify-center">
                <div className="relative h-full w-full overflow-hidden rounded-lg border border-white/10 bg-background shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)]">
                  <iframe
                    key={`${path}-${nonce}`}
                    ref={frameRef}
                    src={path}
                    title="In-game MDT"
                    className="h-full w-full border-0"
                    allow="clipboard-read; clipboard-write"
                  />
                </div>
              </div>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="rounded-md border border-white/10 bg-black/60 px-3 py-1.5 text-xs text-white/80">
                  Press <kbd className="rounded border border-white/20 px-1">F4</kbd> or type <span className="font-mono">/mdt</span> to open the tablet
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="ops-label">Tablet</span>
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => reopen(tab.path)}
                className={cn(
                  "rounded-md border px-2.5 py-1 text-xs transition-colors",
                  path === tab.path && open ? "border-primary/50 bg-secondary" : "border-border hover:bg-secondary/60",
                )}
              >
                {tab.label}
              </button>
            ))}
            <span className="ml-auto flex items-center gap-1.5">
              <Monitor className="h-3.5 w-3.5 text-muted-foreground" />
              {RESOLUTIONS.map((entry) => (
                <button
                  key={entry.key}
                  type="button"
                  onClick={() => setResolution(entry)}
                  className={cn(
                    "rounded-md border px-2 py-1 text-[11px] transition-colors",
                    resolution.key === entry.key ? "border-primary/50 bg-secondary" : "border-border hover:bg-secondary/60",
                  )}
                >
                  {entry.label}
                </button>
              ))}
            </span>
          </div>
        </div>

        {/* Preview controls */}
        <div className="space-y-3">
          <OpsPanel title="Character" subtitle="Sent to the tablet as mdt:init" dense>
            <div className="space-y-2">
              <label className="block">
                <span className="ops-label">Callsign</span>
                <Input value={character.callsign} onChange={(event) => setCharacter((current) => ({ ...current, callsign: event.target.value }))} className="h-9" />
              </label>
              <label className="block">
                <span className="ops-label">Name</span>
                <Input value={character.name} onChange={(event) => setCharacter((current) => ({ ...current, name: event.target.value }))} className="h-9" />
              </label>
              <label className="block">
                <span className="ops-label">Job</span>
                <Input value={character.job} onChange={(event) => setCharacter((current) => ({ ...current, job: event.target.value }))} className="h-9" />
              </label>
              <p className="text-[11px] text-muted-foreground">
                Changing these re-hands the character to the tablet, exactly as the resource does after a handshake.
              </p>
            </div>
          </OpsPanel>

          <LinkManager />

          <OpsPanel title="What you are looking at" dense>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li>
                The panel inside the screen is <code className="text-foreground">/nui</code> — the same route the FiveM resource loads, not a mock-up.
              </li>
              <li>
                <code className="text-foreground">Esc</code> closes it here and in game; the tablet asks the host to close and the host decides.
              </li>
              <li>Data is live from this deployment: the calls, units and records are the ones in your database.</li>
              <li>Status changes made inside the preview are real writes.</li>
            </ul>
          </OpsPanel>

          <OpsPanel title="In game" dense>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li className="flex items-start gap-2">
                <Radio className="mt-0.5 h-3.5 w-3.5 shrink-0" /> The resource performs the handshake, then hands the tablet a short-lived token.
              </li>
              <li className="flex items-start gap-2">
                <Gamepad2 className="mt-0.5 h-3.5 w-3.5 shrink-0" /> <code className="text-foreground">/mdt</code> or the configured keybind opens it; job access is checked server-side.
              </li>
            </ul>
          </OpsPanel>
        </div>
      </div>
    </div>
  );
}

function HudChip({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: string }) {
  return (
    <div className="w-32 rounded-md border border-white/10 bg-black/55 px-2 py-1 backdrop-blur-sm">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-white/70">
        {icon}
        {label}
      </div>
      <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/15">
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

/**
 * Character linking.
 *
 * The same administrative API the resource depends on, exposed here so a server
 * owner can link a test character and watch the whole flow before installing
 * anything - including the "not linked" rejection.
 */
function LinkManager() {
  const queryClient = useQueryClient();
  const [citizenId, setCitizenId] = React.useState("");
  const [userId, setUserId] = React.useState("");

  const links = useQuery({
    queryKey: ["fivem", "identities"],
    queryFn: () =>
      api.get<Array<{ id: string; externalId: string; displayName: string | null; userName: string; lastSeenAt: string | null }>>(
        "/api/integrations/fivem/identities",
      ),
  });

  const users = useQuery({
    queryKey: ["fivem", "users"],
    queryFn: () => api.get<{ rows: Array<{ id: string; username: string; name: string }> }>("/api/admin/users", { pageSize: 100 }),
    staleTime: 60_000,
  });

  const link = useMutation({
    mutationFn: () => api.post("/api/integrations/fivem/identities", { citizenId: citizenId.trim(), userId }),
    onSuccess: () => {
      toast.success(`Linked ${citizenId.trim()}`);
      setCitizenId("");
      void queryClient.invalidateQueries({ queryKey: ["fivem", "identities"] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const unlink = useMutation({
    mutationFn: (id: string) => api.delete(`/api/integrations/fivem/identities/${id}`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["fivem", "identities"] }),
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <OpsPanel title="Characters" subtitle="Linked citizen ids" dense>
      <div className="space-y-2">
        <div className="flex gap-2">
          <Input placeholder="ABC12345" value={citizenId} onChange={(event) => setCitizenId(event.target.value)} className="h-9" aria-label="Citizen id" />
          <select
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
            className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background/60 px-2 text-xs"
            aria-label="Account"
          >
            <option value="">Account…</option>
            {(users.data?.rows ?? []).map((row) => (
              <option key={row.id} value={row.id}>
                {row.username} — {row.name}
              </option>
            ))}
          </select>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="w-full"
          disabled={citizenId.trim().length === 0 || !userId || link.isPending}
          onClick={() => link.mutate()}
        >
          <Link2 className="h-3.5 w-3.5" /> Link character
        </Button>

        <ul className="max-h-40 space-y-1 overflow-y-auto ops-scroll">
          {links.isLoading ? (
            <li className="text-[11px] text-muted-foreground">Loading…</li>
          ) : (links.data ?? []).length === 0 ? (
            <li className="text-[11px] text-muted-foreground">No characters linked yet.</li>
          ) : (
            (links.data ?? []).map((entry) => (
              <li key={entry.id} className="flex items-center gap-2 rounded-md border border-border/60 px-2 py-1">
                <span className="min-w-0 flex-1">
                  <span className="data-mono block truncate text-[11px]">{entry.externalId}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">{entry.userName}</span>
                </span>
                <button
                  type="button"
                  onClick={() => unlink.mutate(entry.id)}
                  aria-label={`Unlink ${entry.externalId}`}
                  className="rounded-md border border-border p-1 text-muted-foreground transition-colors hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </OpsPanel>
  );
}
