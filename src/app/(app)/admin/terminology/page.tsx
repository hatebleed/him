"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { api, errorMessage } from "@/lib/api/client";
import { Button, Card, Input, Skeleton } from "@/components/ui/overlays-primitives";
import { PageHeader } from "@/components/layout/page-header";
import { useSession } from "@/components/providers/session-provider";

type Terminology = Record<string, { singular: string; plural: string }>;

/**
 * Terminology editor.
 * Renaming a concept here updates navigation, headings, empty states and all
 * record pages immediately - nothing is hard-coded in the UI.
 */
export default function AdminTerminologyPage() {
  const queryClient = useQueryClient();
  const { term } = useSession();
  const [draft, setDraft] = React.useState<Terminology>({});

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "terminology"],
    queryFn: () => api.get<{ rows: Terminology }>("/api/admin/terminology"),
  });

  React.useEffect(() => {
    if (data?.rows) setDraft(data.rows);
  }, [data]);

  const save = useMutation({
    mutationFn: (payload: { termKey: string; singular: string; plural: string }) => api.put("/api/admin/terminology", payload),
    onSuccess: async (_result, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "terminology"] });
      await queryClient.invalidateQueries({ queryKey: ["session", "shell"] });
      toast.success(`Renamed to ${variables.singular}/${variables.plural}`);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const entries = Object.entries(draft);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Terminology"
        description="Rename the words the platform uses. Changes apply across navigation, headings and record pages."
      />

      <Card>
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            {entries.map(([key, value]) => {
              const dirty = value.singular !== data?.rows[key]?.singular || value.plural !== data?.rows[key]?.plural;
              return (
                <li key={key} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                  <span className="w-32 shrink-0 font-mono text-xs text-muted-foreground">{key}</span>
                  <Input
                    value={value.singular}
                    onChange={(event) => setDraft({ ...draft, [key]: { ...value, singular: event.target.value } })}
                    className="h-8 w-40"
                    aria-label={`${key} singular`}
                  />
                  <Input
                    value={value.plural}
                    onChange={(event) => setDraft({ ...draft, [key]: { ...value, plural: event.target.value } })}
                    className="h-8 w-40"
                    aria-label={`${key} plural`}
                  />
                  <span className="hidden text-xs text-muted-foreground sm:block">
                    currently shown as “{term(key, "singular", key)}” / “{term(key, "plural", key)}”
                  </span>
                  <div className="ml-auto flex items-center gap-1">
                    {dirty ? (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDraft({ ...draft, [key]: data?.rows[key] ?? { singular: key, plural: key } })}
                          aria-label="Revert"
                        >
                          <RotateCcw />
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => save.mutate({ termKey: key, singular: value.singular || key, plural: value.plural || key })}
                          loading={save.isPending}
                        >
                          <Check />
                          Save
                        </Button>
                      </>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
