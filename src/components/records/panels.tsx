"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Clock,
  Download,
  FileText,
  Link2,
  MessageSquarePlus,
  Paperclip,
  Pin,
  Plus,
  ShieldCheck,
  Trash2,
  Unlink,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { api, errorMessage } from "@/lib/api/client";
import { cn, formatDateTime, formatRelative, formatFileSize, initials } from "@/lib/utils";
import { Badge, Button, EmptyState, Skeleton, Spinner, Textarea } from "@/components/ui/primitives";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/overlays";
import { useSession } from "@/components/providers/session-provider";
import { RecordIcon } from "@/components/icon";

type Note = {
  id: string;
  body: string;
  pinned: boolean;
  createdAt: string;
  authorId: string | null;
  authorName: string | null;
};

type TimelineEntry = {
  id: string;
  type: string;
  message: string;
  actorName: string | null;
  metadata: unknown;
  occurredAt: string;
};

type Attachment = {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  description: string | null;
  createdAt: string;
  uploadedByName: string | null;
};

type Relationship = {
  id: string;
  fromType: string;
  fromId: string;
  toType: string;
  toId: string;
  relationType: string;
  createdAt: string;
};

const HREF: Record<string, string> = {
  person: "/people",
  vehicle: "/vehicles",
  incident: "/incidents",
  case: "/cases",
  report: "/reports",
  task: "/tasks",
  warrant: "/warrants",
  alert: "/alerts",
  bolo: "/bolos",
  evidence: "/evidence",
  call: "/dispatch",
  unit: "/units",
};

function useRecordKey(recordType: string, recordId: string) {
  return ["records", recordType, recordId] as const;
}

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------

export function TimelinePanel({ recordType, recordId }: { recordType: string; recordId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: [...useRecordKey(recordType, recordId), "timeline"],
    queryFn: () => api.get<{ rows: TimelineEntry[] }>(`/api/records/${recordType}/${recordId}/timeline`),
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (error) return <p className="text-sm text-destructive">{errorMessage(error)}</p>;

  if (!data?.rows.length) {
    return <EmptyState icon={<Clock className="h-5 w-5" />} title="No activity yet" description="Actions on this record appear here in order." />;
  }

  return (
    <ol className="relative space-y-4 pl-6">
      <span className="absolute left-2 top-1 h-[calc(100%-0.5rem)] w-px bg-border" aria-hidden />
      {data.rows.map((entry) => (
        <li key={entry.id} className="relative">
          <span className="absolute -left-4 top-1.5 h-2 w-2 rounded-full bg-primary ring-4 ring-background" aria-hidden />
          <div className="flex flex-wrap items-baseline gap-x-2">
            <p className="text-sm">{entry.message}</p>
            <Badge variant="muted" className="uppercase">
              {entry.type.toLowerCase()}
            </Badge>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {entry.actorName ? `${entry.actorName} · ` : ""}
            {formatRelative(new Date(entry.occurredAt))} · {formatDateTime(new Date(entry.occurredAt))}
          </p>
        </li>
      ))}
    </ol>
  );
}

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------

export function NotesPanel({ recordType, recordId }: { recordType: string; recordId: string }) {
  const queryClient = useQueryClient();
  const { user } = useSession();
  const key = [...useRecordKey(recordType, recordId), "notes"];

  const { data, isLoading } = useQuery({
    queryKey: key,
    queryFn: () => api.get<{ rows: Note[] }>(`/api/records/${recordType}/${recordId}/notes`),
  });

  const addNote = useMutation({
    mutationFn: (body: string) => api.post(`/api/records/${recordType}/${recordId}/notes`, { body }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: key });
      toast.success("Note added");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const removeNote = useMutation({
    mutationFn: (noteId: string) => api.delete(`/api/records/${recordType}/${recordId}/notes?noteId=${noteId}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: key });
      toast.success("Note deleted");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <div className="space-y-4">
      <NoteComposer onSubmit={(body) => addNote.mutateAsync(body)} submitting={addNote.isPending} />

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-16 w-full" />
          ))}
        </div>
      ) : !data?.rows.length ? (
        <EmptyState icon={<MessageSquarePlus className="h-5 w-5" />} title="No notes" description="Add context that colleagues should see when they open this record." />
      ) : (
        <ul className="space-y-2">
          {data.rows.map((note) => (
            <li key={note.id} className="rounded-md border border-border/70 bg-secondary/20 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="whitespace-pre-wrap text-sm">{note.body}</p>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {note.authorName ?? "Unknown"} · {formatRelative(new Date(note.createdAt))}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {note.pinned ? <Pin className="h-3.5 w-3.5 text-warning" /> : null}
                  {note.authorId === user?.id ? (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Delete note"
                      onClick={() => removeNote.mutate(note.id)}
                      disabled={removeNote.isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function NoteComposer({ onSubmit, submitting }: { onSubmit: (body: string) => Promise<unknown>; submitting?: boolean }) {
  const [body, setBody] = React.useState("");

  async function submit() {
    if (!body.trim()) return;
    await onSubmit(body.trim());
    setBody("");
  }

  return (
    <div className="space-y-2">
      <Textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder="Add a note…"
        aria-label="Note text"
        maxLength={20_000}
      />
      <div className="flex justify-end">
        <Button size="sm" onClick={() => void submit()} loading={submitting} disabled={!body.trim() || submitting}>
          Add note
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Attachments
// ---------------------------------------------------------------------------

export function AttachmentsPanel({ recordType, recordId }: { recordType: string; recordId: string }) {
  const queryClient = useQueryClient();
  const key = [...useRecordKey(recordType, recordId), "attachments"];
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);

  const { data, isLoading } = useQuery({
    queryKey: key,
    queryFn: () => api.get<{ rows: Attachment[] }>(`/api/records/${recordType}/${recordId}/attachments`),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/api/attachments/${id}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: key });
      toast.success("Attachment removed");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  async function upload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    setUploading(true);
    try {
      await api.upload(`/api/records/${recordType}/${recordId}/attachments`, formData);
      await queryClient.invalidateQueries({ queryKey: key });
      toast.success("File uploaded");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">Images, PDFs, documents and archives up to {Number(process.env.NEXT_PUBLIC_MAX_UPLOAD_MB ?? 25)} MB.</p>
        <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()} loading={uploading}>
          <Upload />
          Upload file
        </Button>
        <input ref={inputRef} type="file" className="hidden" onChange={(event) => void upload(event)} aria-label="Choose a file to upload" />
      </div>

      {isLoading ? (
        <Skeleton className="h-16 w-full" />
      ) : !data?.rows.length ? (
        <EmptyState icon={<Paperclip className="h-5 w-5" />} title="No attachments" description="Upload supporting documents, images or exports." />
      ) : (
        <ul className="divide-y divide-border/60 rounded-md border border-border/70">
          {data.rows.map((attachment) => (
            <li key={attachment.id} className="flex items-center gap-3 px-3 py-2">
              <span className="rounded-md border border-border bg-secondary/60 p-1.5 text-muted-foreground">
                <FileText className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{attachment.fileName}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(attachment.size)} · {attachment.uploadedByName ?? "Unknown"} · {formatRelative(new Date(attachment.createdAt))}
                </p>
              </div>
              <Button variant="ghost" size="icon-sm" onClick={() => window.open(`/api/attachments/${attachment.id}`, "_blank")} aria-label="Download">
                <Download className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon-sm" onClick={() => remove.mutate(attachment.id)} aria-label="Delete attachment">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Relationships
// ---------------------------------------------------------------------------

export function RelationshipsPanel({
  recordType,
  recordId,
  suggestions,
}: {
  recordType: string;
  recordId: string;
  suggestions?: Array<{ type: string; id: string; label: string; reference?: string | null }>;
}) {
  const queryClient = useQueryClient();
  const key = [...useRecordKey(recordType, recordId), "relationships"];
  const [open, setOpen] = React.useState(false);
  const [target, setTarget] = React.useState<{ type: string; id: string } | null>(null);
  const [relationType, setRelationType] = React.useState("RELATED");

  const { data, isLoading } = useQuery({
    queryKey: key,
    queryFn: () => api.get<{ rows: Relationship[] }>(`/api/records/${recordType}/${recordId}/relationships`),
  });

  const link = useMutation({
    mutationFn: () =>
      api.post(`/api/records/${recordType}/${recordId}/relationships`, {
        fromType: recordType,
        fromId: recordId,
        toType: target!.type,
        toId: target!.id,
        relationType,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: key });
      await queryClient.invalidateQueries({ queryKey: ["records", recordType, recordId] });
      setOpen(false);
      setTarget(null);
      toast.success("Record linked");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const unlink = useMutation({
    mutationFn: (id: string) => api.delete(`/api/records/${recordType}/${recordId}/relationships?relationshipId=${id}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: key });
      toast.success("Link removed");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const rows = data?.rows ?? [];

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          <Link2 />
          Link record
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-20 w-full" />
      ) : rows.length === 0 ? (
        <EmptyState icon={<Link2 className="h-5 w-5" />} title="Nothing linked yet" description="Connect this record to people, vehicles, incidents or reports." />
      ) : (
        <ul className="divide-y divide-border/60 rounded-md border border-border/70">
          {rows.map((relationship) => {
            const isSource = relationship.fromId === recordId && relationship.fromType === recordType;
            const otherType = isSource ? relationship.toType : relationship.fromType;
            const otherId = isSource ? relationship.toId : relationship.fromId;
            const href = `${HREF[otherType] ?? "/search"}/${otherId}`;
            return (
              <li key={relationship.id} className="flex items-center gap-3 px-3 py-2">
                <span className="rounded-md border border-border bg-secondary/60 p-1.5 text-muted-foreground">
                  <RecordIcon type={otherType} className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <a href={href} className="truncate text-sm font-medium hover:underline">
                    {otherType} · {otherId.slice(0, 8)}
                  </a>
                  <p className="text-xs text-muted-foreground">{relationship.relationType.toLowerCase()}</p>
                </div>
                <Button variant="ghost" size="icon-sm" onClick={() => unlink.mutate(relationship.id)} aria-label="Remove link">
                  <Unlink className="h-3.5 w-3.5" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Link another record</DialogTitle>
            <DialogDescription>Relationships appear on both records and in the timeline.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <label className="block space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Relation type</span>
              <select
                value={relationType}
                onChange={(event) => setRelationType(event.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              >
                {["RELATED", "WITNESS", "SUSPECT", "VICTIM", "OWNER", "PARENT", "CHILD", "DUPLICATE"].map((option) => (
                  <option key={option} value={option}>
                    {option.toLowerCase()}
                  </option>
                ))}
              </select>
            </label>

            {suggestions?.length ? (
              <label className="block space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Existing record</span>
                <select
                  value={target ? `${target.type}:${target.id}` : ""}
                  onChange={(event) => {
                    const [type, id] = event.target.value.split(":");
                    setTarget(type && id ? { type, id } : null);
                  }}
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                >
                  <option value="">Select a record…</option>
                  {suggestions.map((suggestion) => (
                    <option key={`${suggestion.type}:${suggestion.id}`} value={`${suggestion.type}:${suggestion.id}`}>
                      {suggestion.label}
                      {suggestion.reference ? ` (${suggestion.reference})` : ""}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <p className="text-xs text-muted-foreground">
                No linked records are suggested yet. Use the record pickers on the overview tab to connect records in context.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => link.mutate()} loading={link.isPending} disabled={!target}>
              Link record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Audit trail for a record
// ---------------------------------------------------------------------------

export function AuditPanel({ resourceId }: { resourceId: string }) {
  const { can } = useSession();
  const { data, isLoading } = useQuery({
    queryKey: ["audit", "record", resourceId],
    queryFn: () => api.get<{ rows: Array<{ id: string; action: string; summary: string | null; actorName: string | null; createdAt: string; newValue: unknown }> }>("/api/admin/audit", { resourceId: undefined, search: resourceId, pageSize: 25 }),
    enabled: can("admin.audit.view"),
  });

  if (!can("admin.audit.view")) {
    return (
      <EmptyState
        icon={<ShieldCheck className="h-5 w-5" />}
        title="Not available"
        description="You do not have permission to view the audit trail."
      />
    );
  }

  if (isLoading) return <Skeleton className="h-24 w-full" />;

  const rows = (data?.rows ?? []).filter((row) => row.summary?.includes(resourceId) || JSON.stringify(row.newValue ?? "").includes(resourceId));

  if (!rows.length) {
    return <EmptyState icon={<ShieldCheck className="h-5 w-5" />} title="No audit entries" description="Changes to this record will be recorded here." />;
  }

  return (
    <ul className="divide-y divide-border/60 rounded-md border border-border/70">
      {rows.slice(0, 25).map((row) => (
        <li key={row.id} className="px-3 py-2">
          <p className="text-sm">{row.summary}</p>
          <p className="text-xs text-muted-foreground">
            {row.actorName ?? "System"} · {row.action} · {formatRelative(new Date(row.createdAt))}
          </p>
        </li>
      ))}
    </ul>
  );
}

export function PanelSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="h-12 w-full" />
      ))}
    </div>
  );
}

export { Plus, Spinner, cn, initials };
