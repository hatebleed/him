"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, ChevronLeft, ChevronsUpDown, LogOut, Menu, Moon, PanelLeft, Search, Settings, Sun, UserCircle } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Badge, Button, Separator } from "@/components/ui/primitives";
import { Avatar, AvatarFallback } from "@/components/ui/overlays";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/overlays";
import { useSession } from "@/components/providers/session-provider";
import { api, errorMessage } from "@/lib/api/client";
import { formatRelative, initials } from "@/lib/utils";
import { NotificationList } from "./notification-centre";

/** Top application bar: breadcrumbs, search, notifications, account menu. */
export function Topbar({
  onOpenMobileNav,
  onOpenCommand,
  collapsed,
  onToggleCollapsed,
}: {
  onOpenMobileNav: () => void;
  onOpenCommand: () => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  showMobileNavButton?: boolean;
}) {
  const { user, permissions, data, term } = useSession();
  const passwordAuth = (data?.security?.authMode ?? "password") === "password";
  const pathname = usePathname();
  const router = useRouter();
  const [theme, setTheme] = React.useState<string>("dark");

  React.useEffect(() => {
    setTheme(document.documentElement.dataset.theme ?? "dark");
  }, []);

  const toggleTheme = React.useCallback(() => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    setTheme(next);
    window.localStorage.setItem("theme", next);
    // Persist for this user when they have permission to set the theme.
    if (permissions.has("admin.themes.manage")) {
      void api.put("/api/admin/theme", { mode: next }).catch(() => undefined);
    }
  }, [theme, permissions]);

  const crumbs = React.useMemo(() => buildCrumbs(pathname, data?.config.navigation ?? [], term), [pathname, data?.config.navigation, term]);

  async function signOut() {
    try {
      await api.post("/api/auth/logout", {});
      toast.success("Signed out");
      router.replace("/login");
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border/70 bg-background/85 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/65 sm:px-5">
      <Button variant="ghost" size="icon-sm" className="md:hidden" onClick={onOpenMobileNav} aria-label="Open navigation">
        <Menu className="h-4 w-4" />
      </Button>

      <Button
        variant="ghost"
        size="icon-sm"
        className="hidden md:inline-flex"
        onClick={onToggleCollapsed}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        <PanelLeft className={cn("h-4 w-4", collapsed && "rotate-180")} />
      </Button>

      {pathname !== "/dashboard" ? (
        <Button variant="ghost" size="icon-sm" onClick={() => router.back()} aria-label="Go back" className="hidden sm:inline-flex">
          <ChevronLeft className="h-4 w-4" />
        </Button>
      ) : null}

      <nav aria-label="Breadcrumb" className="min-w-0 flex-1 overflow-hidden">
        <ol className="flex items-center gap-1.5 text-sm">
          {crumbs.map((crumb, index) => (
            <li key={`${crumb.href}-${index}`} className="flex min-w-0 items-center gap-1.5">
              {index > 0 ? <span className="text-muted-foreground/60">/</span> : null}
              {crumb.href && index < crumbs.length - 1 ? (
                <Link href={crumb.href} className="truncate text-muted-foreground transition-colors hover:text-foreground">
                  {crumb.label}
                </Link>
              ) : (
                <span className="truncate font-medium">{crumb.label}</span>
              )}
            </li>
          ))}
        </ol>
      </nav>

      <button
        type="button"
        onClick={onOpenCommand}
        className="hidden h-9 items-center gap-2 rounded-md border border-border bg-secondary/40 px-3 text-sm text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground md:flex"
        aria-label="Open command palette"
      >
        <Search className="h-4 w-4" />
        <span className="hidden lg:inline">Search or jump to…</span>
        <kbd className="ml-2 rounded border border-border bg-card px-1 text-[10px]">⌘K</kbd>
      </button>

      <Button variant="ghost" size="icon-sm" className="md:hidden" onClick={onOpenCommand} aria-label="Search">
        <Search className="h-4 w-4" />
      </Button>

      <NotificationBell />

      <Button variant="ghost" size="icon-sm" onClick={toggleTheme} aria-label="Toggle theme">
        {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </Button>

      <Separator orientation="vertical" className="mx-1 h-6" />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-2 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-secondary/70"
            aria-label="Account menu"
          >
            <Avatar className="h-7 w-7">
              <AvatarFallback>{initials(user?.name ?? "?")}</AvatarFallback>
            </Avatar>
            <span className="hidden min-w-0 flex-col lg:flex">
              <span className="truncate text-xs font-medium leading-tight">{user?.name ?? "Loading…"}</span>
              <span className="truncate text-[11px] leading-tight text-muted-foreground">{user?.jobTitle ?? user?.username}</span>
            </span>
            <ChevronsUpDown className="hidden h-3.5 w-3.5 text-muted-foreground lg:block" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel>
            {user?.name}
            <span className="block truncate text-[11px] font-normal normal-case text-muted-foreground">{user?.email}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => router.push("/settings")}>
            <UserCircle />
            My profile &amp; settings
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => router.push("/settings/notifications")}>
            <Bell />
            Notification preferences
          </DropdownMenuItem>
          {permissions.has("admin.access") ? (
            <DropdownMenuItem onSelect={() => router.push("/admin")}>
              <Settings />
              Administration
              <DropdownMenuShortcut>Admin</DropdownMenuShortcut>
            </DropdownMenuItem>
          ) : null}
          {passwordAuth ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive onSelect={() => void signOut()}>
                <LogOut />
                Sign out
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}

function NotificationBell() {
  const { data, refresh } = useSession();
  const unread = data?.notifications.unread ?? 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="relative" aria-label={`Notifications (${unread} unread)`}>
          <Bell className="h-4 w-4" />
          {unread > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">
              {unread > 99 ? "99+" : unread}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <NotificationList onChanged={refresh} />
      </PopoverContent>
    </Popover>
  );
}

function buildCrumbs(
  pathname: string,
  navigation: Array<{ href: string | null; label: string; moduleKey: string | null }>,
  term?: (key: string, form?: "singular" | "plural", fallback?: string) => string,
) {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return [{ label: "Dashboard", href: "/dashboard" }];

  const crumbs: Array<{ label: string; href: string | null }> = [{ label: "Dashboard", href: "/dashboard" }];
  let current = "";
  for (const segment of segments) {
    current = `${current}/${segment}`;
    const navItem = navigation.find((item) => item.href === current);
    const label = navItem
      ? navItem.moduleKey && term
        ? term(navItem.moduleKey, "plural", navItem.label)
        : navItem.label
      : toTitle(segment);
    crumbs.push({ label, href: current });
  }
  // A detail view shows the record id; keep the last crumb compact.
  if (crumbs.length > 1) crumbs[crumbs.length - 1] = { ...crumbs[crumbs.length - 1]!, href: null };
  return crumbs.slice(-4);
}

function toTitle(segment: string) {
  if (segment.length > 24) return "Details";
  return segment
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export { Badge, formatRelative };
