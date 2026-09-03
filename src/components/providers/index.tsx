"use client";

import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";

import { TooltipProvider } from "@/components/ui/overlays";
import { SessionProvider, useSession, type ShellData } from "./session-provider";
import { ThemeSync } from "./theme-provider";
import { RealtimeProvider } from "./realtime-provider";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: (failureCount, error: unknown) => {
          const status = (error as { status?: number })?.status;
          if (status === 401 || status === 403 || status === 404) return false;
          return failureCount < 2;
        },
        refetchOnWindowFocus: false,
      },
      mutations: { retry: false },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
  if (typeof window === "undefined") return makeQueryClient();
  browserQueryClient = browserQueryClient ?? makeQueryClient();
  return browserQueryClient;
}

export function Providers({ children, initialSession }: { children: React.ReactNode; initialSession?: ShellData | null }) {
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={200}>
        <SessionProvider initialData={initialSession}>
          <ThemeSyncBridge />
          <RealtimeBridge />
          {children}
          <Toaster
            position="bottom-right"
            toastOptions={{
              classNames: {
                toast: "group border border-border bg-card text-card-foreground shadow-elevated rounded-lg",
                description: "text-muted-foreground",
                actionButton: "bg-primary text-primary-foreground",
                cancelButton: "bg-secondary text-secondary-foreground",
                error: "border-destructive/40",
              },
            }}
          />
        </SessionProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

function ThemeSyncBridge() {
  const { data } = useSession();
  return <ThemeSync theme={data?.config?.theme} branding={data?.config?.branding} />;
}

function RealtimeBridge() {
  return <RealtimeProvider />;
}
