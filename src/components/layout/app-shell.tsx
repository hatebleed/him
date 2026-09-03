"use client";

import * as React from "react";
import { Menu, X } from "lucide-react";

import { useQueryClient } from "@tanstack/react-query";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/primitives";
import { useSession } from "@/components/providers/session-provider";
import { Sidebar, SidebarContent } from "./sidebar";
import { Topbar } from "./topbar";
import { CommandPalette } from "./command-palette";

/**
 * Application shell.
 *
 * Owns the responsive frame (desktop sidebar + mobile drawer), the command
 * palette and the global chrome. Page content renders inside <main>.
 */
export function AppShell({ children, initialSession }: { children: React.ReactNode; initialSession?: unknown }) {
  const { data } = useSession();
  const queryClient = useQueryClient();

  // Seed the session query with the server-rendered payload so the shell never
  // flashes empty chrome while the client refetches.
  React.useEffect(() => {
    if (initialSession) {
      queryClient.setQueryData(["session", "shell"], initialSession);
    }
  }, [initialSession, queryClient]);

  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [commandOpen, setCommandOpen] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState(false);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // Persist the sidebar state per browser.
  React.useEffect(() => {
    const stored = window.localStorage.getItem("shell:collapsed");
    if (stored) setCollapsed(stored === "true");
  }, []);

  const toggleCollapsed = React.useCallback(() => {
    setCollapsed((previous) => {
      window.localStorage.setItem("shell:collapsed", String(!previous));
      return !previous;
    });
  }, []);

  const navItems = data?.config?.navigation ?? [];

  return (
    <div className="flex min-h-screen bg-background">
      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 border-r border-sidebar-border bg-sidebar transition-[width] duration-200 md:block",
          collapsed ? "w-[68px]" : "w-[248px]",
        )}
      >
        <Sidebar items={navItems} collapsed={collapsed} onToggle={toggleCollapsed} />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-[268px] border-r border-sidebar-border bg-sidebar shadow-elevated">
            <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-3">
              <span className="text-sm font-semibold">Navigation</span>
              <Button variant="ghost" size="icon-sm" onClick={() => setMobileOpen(false)} aria-label="Close navigation">
                <X />
              </Button>
            </div>
            <SidebarContent
              items={navItems}
              collapsed={false}
              onNavigate={() => setMobileOpen(false)}
            />
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          onOpenMobileNav={() => setMobileOpen(true)}
          onOpenCommand={() => setCommandOpen(true)}
          collapsed={collapsed}
          onToggleCollapsed={toggleCollapsed}
          showMobileNavButton={!data?.config?.navigation?.length}
        />
        <main id="main" className="ops-backdrop flex-1 px-4 pb-10 pt-4 sm:px-6">
          {children}
        </main>
      </div>

      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
    </div>
  );
}

export function MobileNavButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="ghost" size="icon" className="md:hidden" onClick={onClick} aria-label="Open navigation">
      <Menu />
    </Button>
  );
}
