"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";
import { declutter, extendBounds, padBounds, project, type Bounds, type Point } from "./projection";
import { SignalDot, signalForStatus } from "./signal";

export type MapUnit = {
  id: string;
  callsign: string;
  name: string;
  status: string;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  updatedAt: string | null;
};

export type MapIncident = {
  id: string;
  reference: string;
  title: string;
  priority: string;
  status: string;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  occurredAt: string | null;
};

export type MapDistrict = { name: string; latitude: number; longitude: number };

const PRIORITY_COLOUR: Record<string, string> = {
  CRITICAL: "hsl(var(--signal-hot))",
  HIGH: "hsl(var(--signal-warn))",
  MEDIUM: "hsl(var(--signal-live))",
  LOW: "hsl(var(--signal-idle))",
};

/**
 * Sector view.
 *
 * A schematic plan of the operating area: district grid, units and incidents
 * placed by their recorded coordinates, and a radar sweep while the view is
 * live. It is deliberately not a street map - it stays readable at a glance and
 * needs no external map provider.
 */
export function SectorMap({
  units,
  incidents,
  districts,
  className,
  height = 420,
  live = true,
}: {
  units: MapUnit[];
  incidents: MapIncident[];
  districts?: MapDistrict[];
  className?: string;
  height?: number;
  live?: boolean;
}) {
  const router = useRouter();
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [size, setSize] = React.useState({ width: 720, height });
  const [selected, setSelected] = React.useState<string | null>(null);
  const [showUnits, setShowUnits] = React.useState(true);
  const [showIncidents, setShowIncidents] = React.useState(true);

  React.useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      if (width > 0) setSize({ width, height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [height]);

  const points = React.useMemo<Point[]>(
    () => [
      ...units.filter((unit) => unit.latitude != null && unit.longitude != null).map((unit) => ({ lat: unit.latitude!, lng: unit.longitude! })),
      ...incidents
        .filter((incident) => incident.latitude != null && incident.longitude != null)
        .map((incident) => ({ lat: incident.latitude!, lng: incident.longitude! })),
      ...(districts ?? []).map((district) => ({ lat: district.latitude, lng: district.longitude })),
    ],
    [units, incidents, districts],
  );

  const bounds: Bounds = React.useMemo(() => padBounds(points.reduce<Bounds | null>((acc, point) => extendBounds(acc, point), null)), [points]);

  const unitPoints = React.useMemo(
    () =>
      declutter(
        units
          .filter((unit) => unit.latitude != null && unit.longitude != null)
          .map((unit) => ({ id: unit.id, ...project({ lat: unit.latitude!, lng: unit.longitude! }, bounds, size, 34) })),
        26,
      ),
    [units, bounds, size],
  );

  const incidentPoints = React.useMemo(
    () =>
      declutter(
        incidents
          .filter((incident) => incident.latitude != null && incident.longitude != null)
          .map((incident) => ({ id: incident.id, ...project({ lat: incident.latitude!, lng: incident.longitude! }, bounds, size, 34) })),
        22,
      ),
    [incidents, bounds, size],
  );

  const unitById = React.useMemo(() => new Map(units.map((unit) => [unit.id, unit])), [units]);
  const incidentById = React.useMemo(() => new Map(incidents.map((incident) => [incident.id, incident])), [incidents]);

  const unplotted = units.filter((unit) => unit.latitude == null).length + incidents.filter((incident) => incident.latitude == null).length;

  return (
    <div className={cn("relative", className)} ref={containerRef}>
      <svg
        width={size.width}
        height={size.height}
        viewBox={`0 0 ${size.width} ${size.height}`}
        className="block"
        role="img"
        aria-label="Sector view of units and incidents"
      >
        <defs>
          <pattern id="sector-grid" width="46" height="46" patternUnits="userSpaceOnUse">
            <path d="M 46 0 L 0 0 0 46" fill="none" stroke="hsl(var(--grid-line) / 0.14)" strokeWidth="1" />
          </pattern>
          <radialGradient id="sector-vignette" cx="50%" cy="45%" r="75%">
            <stop offset="55%" stopColor="transparent" />
            <stop offset="100%" stopColor="hsl(var(--background))" stopOpacity="0.85" />
          </radialGradient>
          <linearGradient id="sector-sweep" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="hsl(var(--signal-live))" stopOpacity="0.22" />
            <stop offset="100%" stopColor="hsl(var(--signal-live))" stopOpacity="0" />
          </linearGradient>
        </defs>

        <rect width={size.width} height={size.height} fill="url(#sector-grid)" />

        {/* Radar sweep, centred on the middle of the operating area. */}
        {live ? (
          <g className="ops-sweep" style={{ transformOrigin: `${size.width / 2}px ${size.height / 2}px` }}>
            <path
              d={`M ${size.width / 2} ${size.height / 2} L ${size.width / 2} ${size.height / 2 - Math.max(size.width, size.height)} A ${Math.max(size.width, size.height)} ${Math.max(size.width, size.height)} 0 0 1 ${size.width / 2 + Math.max(size.width, size.height) * 0.62} ${size.height / 2 - Math.max(size.width, size.height) * 0.78} Z`}
              fill="url(#sector-sweep)"
            />
          </g>
        ) : null}

        {/* Districts */}
        {(districts ?? []).map((district) => {
          const at = project({ lat: district.latitude, lng: district.longitude }, bounds, size, 34);
          return (
            <g key={district.name} opacity={0.75}>
              <circle cx={at.x} cy={at.y} r={3} fill="hsl(var(--muted-foreground))" />
              <text x={at.x + 8} y={at.y + 3} fontSize={10} letterSpacing="0.12em" fill="hsl(var(--muted-foreground))" className="uppercase">
                {district.name}
              </text>
            </g>
          );
        })}

        {/* Incidents */}
        {showIncidents
          ? incidentPoints.map((point) => {
              const incident = incidentById.get(point.id);
              if (!incident) return null;
              const colour = PRIORITY_COLOUR[incident.priority] ?? "hsl(var(--signal-live))";
              const isSelected = selected === incident.id;
              return (
                <g
                  key={incident.id}
                  transform={`translate(${point.x} ${point.y})`}
                  className="cursor-pointer"
                  onClick={() => setSelected(isSelected ? null : incident.id)}
                  onDoubleClick={() => router.push(`/incidents/${incident.id}`)}
                >
                  <title>{`${incident.reference} · ${incident.title}\n${incident.location ?? "No location"}`}</title>
                  {incident.priority === "CRITICAL" ? (
                    <circle r={13} fill="none" stroke={colour} strokeWidth={1} opacity={0.5} className="animate-ping" />
                  ) : null}
                  <path d="M 0 -8 L 8 0 L 0 8 L -8 0 Z" fill={colour} fillOpacity={0.22} stroke={colour} strokeWidth={1.4} />
                  {isSelected ? <circle r={14} fill="none" stroke={colour} strokeWidth={1} strokeDasharray="3 3" /> : null}
                  <text y={-12} textAnchor="middle" fontSize={8.5} fill="hsl(var(--foreground))" className="data-mono">
                    {incident.reference.replace(/^INC-\d+-/, "")}
                  </text>
                </g>
              );
            })
          : null}

        {/* Units */}
        {showUnits
          ? unitPoints.map((point) => {
              const unit = unitById.get(point.id);
              if (!unit) return null;
              const signal = signalForStatus(unit.status);
              const colour =
                signal === "live"
                  ? "hsl(var(--signal-ok))"
                  : signal === "warn"
                    ? "hsl(var(--signal-warn))"
                    : signal === "hot"
                      ? "hsl(var(--signal-hot))"
                      : "hsl(var(--signal-idle))";
              const moving = ["EN_ROUTE", "ON_SCENE", "BUSY"].includes(unit.status);
              return (
                <g
                  key={unit.id}
                  transform={`translate(${point.x} ${point.y})`}
                  className="cursor-pointer"
                  onClick={() => setSelected(selected === unit.id ? null : unit.id)}
                  onDoubleClick={() => router.push(`/units/${unit.id}`)}
                >
                  <title>{`${unit.callsign} · ${unit.name}\n${unit.status.replace(/_/g, " ")}${unit.location ? `\n${unit.location}` : ""}`}</title>
                  {moving ? <circle r={11} fill="none" stroke={colour} strokeWidth={1} opacity={0.45} className="animate-ping" /> : null}
                  <rect x={-9} y={-9} width={18} height={18} rx={3} fill="hsl(var(--card))" stroke={colour} strokeWidth={1.3} />
                  <text y={3.5} textAnchor="middle" fontSize={8} fontWeight={700} fill={colour} className="data-mono">
                    {unit.callsign.slice(0, 4)}
                  </text>
                </g>
              );
            })
          : null}

        <rect width={size.width} height={size.height} fill="url(#sector-vignette)" pointerEvents="none" />
      </svg>

      {/* Layer toggles */}
      <div className="absolute left-2 top-2 flex flex-wrap gap-1.5">
        <MapToggle label="Units" active={showUnits} count={units.length} onClick={() => setShowUnits((value) => !value)} />
        <MapToggle
          label="Incidents"
          active={showIncidents}
          count={incidents.length}
          onClick={() => setShowIncidents((value) => !value)}
        />
      </div>

      {selected ? <MapSelection unit={unitById.get(selected)} incident={incidentById.get(selected)} onClose={() => setSelected(null)} /> : null}

      {unplotted > 0 ? (
        <p className="absolute bottom-2 right-2 rounded-sm border border-border/70 bg-card/80 px-1.5 py-0.5 text-[10px] text-muted-foreground">
          {unplotted} record{unplotted === 1 ? "" : "s"} without coordinates
        </p>
      ) : null}
    </div>
  );
}

function MapToggle({ label, active, count, onClick }: { label: string; active: boolean; count: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-sm border px-1.5 py-0.5 text-[10px] uppercase tracking-wide transition-colors",
        active ? "border-[hsl(var(--hud-line)/0.5)] bg-card/80 text-foreground" : "border-border/60 bg-card/50 text-muted-foreground",
      )}
    >
      <SignalDot signal={active ? "live" : "idle"} />
      {label}
      <span className="data-mono text-muted-foreground">{count}</span>
    </button>
  );
}

function MapSelection({
  unit,
  incident,
  onClose,
}: {
  unit?: MapUnit;
  incident?: MapIncident;
  onClose: () => void;
}) {
  const router = useRouter();
  const record = unit ?? incident;
  if (!record) return null;

  return (
    <div className="ops-frame ops-frame-glow absolute bottom-2 left-2 w-64 p-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="ops-label">{unit ? "Unit" : "Incident"}</p>
          <p className="truncate text-sm font-semibold">{unit ? `${unit.callsign} · ${unit.name}` : incident?.title}</p>
        </div>
        <button type="button" onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground" aria-label="Close">
          ✕
        </button>
      </div>
      <dl className="mt-2 space-y-1 text-[11px]">
        {unit ? (
          <>
            <Row label="Status" value={unit.status.replace(/_/g, " ")} />
            <Row label="Location" value={unit.location ?? "—"} />
          </>
        ) : null}
        {incident ? (
          <>
            <Row label="Reference" value={incident.reference} mono />
            <Row label="Priority" value={incident.priority} />
            <Row label="Status" value={incident.status.replace(/_/g, " ")} />
            <Row label="Location" value={incident.location ?? "—"} />
          </>
        ) : null}
      </dl>
      <button
        type="button"
        onClick={() => router.push(unit ? `/units/${unit.id}` : `/incidents/${incident!.id}`)}
        className="mt-2 w-full rounded-sm border border-[hsl(var(--hud-line)/0.4)] bg-secondary/40 px-2 py-1 text-[11px] font-medium uppercase tracking-wide hover:bg-secondary/70"
      >
        Open record
      </button>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("truncate text-foreground", mono && "data-mono")}>{value}</dd>
    </div>
  );
}
