"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Hash, Send, Users } from "lucide-react";
import { toast } from "sonner";

import { api, errorMessage } from "@/lib/api/client";
import { Badge, Button, Card, EmptyState, Input, Skeleton } from "@/components/ui/primitives";
import { PageHeader } from "@/components/layout/page-header";
import { useSession } from "@/components/providers/session-provider";
import { cn, formatRelative, initials } from "@/lib/utils";

type Channel = {
  id: string;
  name: string;
  type: string;
  topic: string | null;
  unread: number;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  memberCount: number;
};

type Message = {
  id: string;
  body: string;
  createdAt: string;
  authorId: string;
  authorName: string;
};

/** Channel-based communications with real persistence and live updates. */
export default function CommunicationsPage() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState("");

  const { data: channels, isLoading } = useQuery({
    queryKey: ["communications", "channels"],
    queryFn: () => api.get<{ rows: Channel[] }>("/api/communications/channels"),
    refetchInterval: 20_000,
  });

  const rows = channels?.rows ?? [];
  const activeChannelId = activeId ?? rows[0]?.id ?? null;

  const { data: channel, isLoading: loadingChannel } = useQuery({
    queryKey: ["channel", activeChannelId],
    queryFn: () => api.get<{ id: string; name: string; topic: string | null; messages: Message[]; members: Array<{ userId: string; name: string; role: string }> }>(`/api/communications/channels/${activeChannelId}`),
    enabled: Boolean(activeChannelId),
  });

  const send = useMutation({
    mutationFn: (body: string) => api.post(`/api/communications/channels/${activeChannelId}/messages`, { body }),
    onSuccess: async () => {
      setDraft("");
      await queryClient.invalidateQueries({ queryKey: ["channel", activeChannelId] });
      await queryClient.invalidateQueries({ queryKey: ["communications", "channels"] });
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  React.useEffect(() => {
    const list = document.getElementById("message-list");
    if (list) list.scrollTop = list.scrollHeight;
  }, [channel?.messages.length]);

  return (
    <div className="space-y-4">
      <PageHeader title="Communications" description="Channels and direct messages with the people you work with." />

      <div className="grid gap-3 lg:grid-cols-[260px_1fr_220px]">
        <Card className="overflow-hidden">
          <div className="border-b border-border/60 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Channels</div>
          <div className="max-h-[26rem] overflow-y-auto p-1">
            {isLoading ? (
              <div className="space-y-2 p-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="h-8 w-full" />
                ))}
              </div>
            ) : rows.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">You are not a member of any channel.</p>
            ) : (
              rows.map((channelRow) => (
                <button
                  key={channelRow.id}
                  type="button"
                  onClick={() => setActiveId(channelRow.id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                    channelRow.id === activeChannelId ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/60",
                  )}
                >
                  <Hash className="h-3.5 w-3.5 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{channelRow.name}</span>
                  {channelRow.unread > 0 ? <Badge variant="default">{channelRow.unread}</Badge> : null}
                </button>
              ))
            )}
          </div>
        </Card>

        <Card className="flex h-[32rem] flex-col overflow-hidden">
          {loadingChannel ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-10 w-full" />
              ))}
            </div>
          ) : !channel ? (
            <EmptyState icon={<Hash className="h-5 w-5" />} title="No channel selected" description="Pick a channel to read and send messages." />
          ) : (
            <>
              <div className="border-b border-border/60 px-4 py-2.5">
                <p className="text-sm font-semibold">{channel.name}</p>
                {channel.topic ? <p className="text-xs text-muted-foreground">{channel.topic}</p> : null}
              </div>

              <div id="message-list" className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
                {channel.messages.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">No messages yet. Start the conversation.</p>
                ) : (
                  channel.messages.map((message) => (
                    <div key={message.id} className={cn("flex gap-2.5", message.authorId === user?.id && "flex-row-reverse")}>
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-[10px] font-semibold">
                        {initials(message.authorName)}
                      </span>
                      <div className={cn("max-w-[75%] rounded-lg px-3 py-2", message.authorId === user?.id ? "bg-primary/15" : "bg-secondary/50")}>
                        <p className="text-[11px] font-medium text-muted-foreground">
                          {message.authorName} · {formatRelative(new Date(message.createdAt))}
                        </p>
                        <p className="whitespace-pre-wrap text-sm">{message.body}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <form
                className="flex items-center gap-2 border-t border-border/60 p-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (draft.trim()) send.mutate(draft.trim());
                }}
              >
                <Input
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Write a message…"
                  aria-label="Message"
                />
                <Button type="submit" size="icon" disabled={!draft.trim() || send.isPending} aria-label="Send message">
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </>
          )}
        </Card>

        <Card className="hidden overflow-hidden lg:block">
          <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            Members
          </div>
          <ul className="max-h-[26rem] overflow-y-auto p-2 text-sm">
            {(channel?.members ?? []).map((member) => (
              <li key={member.userId} className="truncate py-1">
                {member.name}
                <span className="ml-1 text-xs text-muted-foreground">{member.role.toLowerCase()}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
