"use client";

import * as React from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Download, Upload } from "lucide-react";
import { toast } from "sonner";

import { api, errorMessage } from "@/lib/api/client";
import { Badge, Button, Card, EmptyState, Input } from "@/components/ui/overlays-primitives";
import { PageHeader } from "@/components/layout/page-header";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/overlays";

type Definition = { resourceType: string; fields: Array<{ key: string; label: string; required?: boolean }> };
type Preview = { total: number; valid: number; invalid: number; errors: Array<{ row: number; issues: string[] }>; sample: Array<Record<string, unknown>> };

/**
 * Import & export.
 *
 * The CSV is parsed in the browser, validated on the server against the same
 * schemas used by the API, and only committed after a clean preview.
 */
export default function AdminImportPage() {
  const [resourceType, setResourceType] = React.useState("person");
  const [csv, setCsv] = React.useState("");
  const [rows, setRows] = React.useState<Array<Record<string, string>>>([]);
  const [headers, setHeaders] = React.useState<string[]>([]);
  const [mapping, setMapping] = React.useState<Record<string, string>>({});
  const [preview, setPreview] = React.useState<Preview | null>(null);
  const [fileName, setFileName] = React.useState<string | null>(null);

  const { data: definitions } = useQuery({
    queryKey: ["admin", "import-definitions"],
    queryFn: () => api.get<{ rows: Definition[] }>("/api/admin/import"),
  });

  const definition = (definitions?.rows ?? []).find((entry) => entry.resourceType === resourceType);

  const previewMutation = useMutation({
    mutationFn: () => api.post<Preview>("/api/admin/import", { resourceType, mapping, rows, mode: "preview" }),
    onSuccess: (result) => {
      setPreview(result);
      toast.success(`${result.valid} of ${result.total} rows are valid`);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const commitMutation = useMutation({
    mutationFn: () => api.post<{ created: number; failed: Array<{ row: number; issues: string[] }> }>("/api/admin/import", { resourceType, mapping, rows, mode: "commit" }),
    onSuccess: (result) => {
      toast.success(`${result.created} records imported`);
      setPreview(null);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  function parseCsv(text: string) {
    const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
    if (lines.length < 2) {
      toast.error("The CSV needs a header row and at least one data row.");
      return;
    }
    const parseLine = (line: string): string[] => {
      const cells: string[] = [];
      let current = "";
      let quoted = false;
      for (let index = 0; index < line.length; index += 1) {
        const char = line[index]!;
        if (char === '"') {
          if (quoted && line[index + 1] === '"') {
            current += '"';
            index += 1;
          } else {
            quoted = !quoted;
          }
        } else if (char === "," && !quoted) {
          cells.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
      cells.push(current.trim());
      return cells;
    };

    const parsedHeaders = parseLine(lines[0]!);
    const parsedRows = lines.slice(1).map((line) => {
      const cells = parseLine(line);
      return Object.fromEntries(parsedHeaders.map((header, index) => [header, cells[index] ?? ""]));
    });

    setHeaders(parsedHeaders);
    setRows(parsedRows);
    setPreview(null);

    // Auto-map columns whose header matches a field key or label.
    const auto: Record<string, string> = {};
    for (const field of definition?.fields ?? []) {
      const match = parsedHeaders.find((header) => header.toLowerCase() === field.key.toLowerCase() || header.toLowerCase() === field.label.toLowerCase());
      if (match) auto[field.key] = match;
    }
    setMapping(auto);
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Import & export" description="Bring records in from CSV and export any list you can see." />

      <div className="grid gap-3 lg:grid-cols-3">
        <Card className="p-4 lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold">Import</h2>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Select value={resourceType} onValueChange={(value) => { setResourceType(value); setPreview(null); }}>
                <SelectTrigger className="h-9 w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(definitions?.rows ?? []).map((entry) => (
                    <SelectItem key={entry.resourceType} value={entry.resourceType}>
                      {entry.resourceType}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <label className="cursor-pointer rounded-md border border-border px-3 py-2 text-sm transition-colors hover:bg-secondary/60">
                Choose CSV
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    setFileName(file.name);
                    parseCsv(await file.text());
                  }}
                />
              </label>
              {fileName ? <span className="text-xs text-muted-foreground">{fileName}</span> : null}
            </div>

            <Input
              value={csv}
              onChange={(event) => setCsv(event.target.value)}
              placeholder="…or paste CSV content here"
              className="font-mono text-xs"
              aria-label="CSV content"
            />
            <Button size="sm" variant="outline" onClick={() => parseCsv(csv)} disabled={!csv.trim()}>
              Parse pasted CSV
            </Button>

            {rows.length > 0 ? (
              <>
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Column mapping ({rows.length} rows)</p>
                  {(definition?.fields ?? []).map((field) => (
                    <div key={field.key} className="grid gap-2 sm:grid-cols-[160px_1fr]">
                      <span className="text-sm">
                        {field.label}
                        {field.required ? <span className="ml-1 text-destructive">*</span> : null}
                      </span>
                      <select
                        value={mapping[field.key] ?? ""}
                        onChange={(event) => setMapping({ ...mapping, [field.key]: event.target.value })}
                        className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                      >
                        <option value="">Do not import</option>
                        {headers.map((header) => (
                          <option key={header} value={header}>
                            {header}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => previewMutation.mutate()} loading={previewMutation.isPending}>
                    Validate
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => commitMutation.mutate()}
                    loading={commitMutation.isPending}
                    disabled={!preview || preview.invalid > 0}
                  >
                    <Upload />
                    Import records
                  </Button>
                </div>

                {preview ? (
                  <div className="rounded-md border border-border/70 p-3 text-sm">
                    <p className="flex flex-wrap items-center gap-2">
                      <Badge variant="success">{preview.valid} valid</Badge>
                      <Badge variant={preview.invalid ? "destructive" : "muted"}>{preview.invalid} invalid</Badge>
                      <span className="text-xs text-muted-foreground">{preview.total} total</span>
                    </p>
                    {preview.errors.length ? (
                      <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs">
                        {preview.errors.slice(0, 20).map((error) => (
                          <li key={error.row} className="text-destructive">
                            Row {error.row}: {error.issues.join(" ")}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ) : null}
              </>
            ) : (
              <EmptyState title="No data loaded" description="Choose a CSV file to map its columns and validate before importing." />
            )}
          </div>
        </Card>

        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold">Export</h2>
          <p className="mb-3 text-xs text-muted-foreground">Exports respect your permissions and any filters applied in the list views.</p>
          <div className="space-y-2">
            {["person", "vehicle", "incident", "report", "task", "evidence"].map((type) => (
              <Button
                key={type}
                variant="outline"
                size="sm"
                className="w-full justify-start"
                onClick={() => {
                  window.location.href = `/api/export?resourceType=${type}`;
                  toast.success(`Exporting ${type} records`);
                }}
              >
                <Download />
                {type} CSV
              </Button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
