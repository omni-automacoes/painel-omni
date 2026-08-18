import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Handshake,
  MessagesSquare,
  CheckSquare,
  Wallet,
  BarChart3,
  Settings,
  Search,
  Bell,
  PanelLeftClose,
  PanelLeft,
  LogOut,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "./AuthProvider";

const NAV = [
  { label: "Visão Geral", to: "/", icon: LayoutDashboard },
  { label: "Negócios", to: "/negocios", icon: Handshake },
  { label: "Atendimentos", to: "/atendimentos", icon: MessagesSquare },
  { label: "Tarefas", to: "/tarefas", icon: CheckSquare },
  { label: "Financeiro", to: "/financeiro", icon: Wallet },
  { label: "Relatório Geral", to: "/relatorios", icon: BarChart3 },
  { label: "Configurações", to: "/configuracoes", icon: Settings },
] as const;

export function AppShell({
  title,
  subtitle,
  actions,
  children,
  flush,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  flush?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { user, signOut } = useAuth();

  const email = user?.email || "";
  const name = user?.user_metadata?.full_name || user?.user_metadata?.name || email.split("@")[0] || "Usuário";
  const initials = name
    .split(" ")
    .map((n: string) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside
        className={cn(
          "sticky top-0 flex h-screen shrink-0 flex-col bg-sidebar text-sidebar-foreground transition-[width] duration-200",
          collapsed ? "w-[76px]" : "w-[248px]",
        )}
      >
        <div className="flex h-16 items-center gap-3 px-5">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground text-lg font-extrabold">
            O
          </span>
          {!collapsed && (
            <span className="text-xl font-extrabold tracking-tight">Omni</span>
          )}
        </div>

        <nav className="mt-2 flex flex-1 flex-col gap-1 px-3">
          {NAV.map((item) => {
            const active =
              item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                title={item.label}
                className={cn(
                  "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                )}
              >
                <span
                  className={cn(
                    "absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-accent transition-opacity",
                    active ? "opacity-100" : "opacity-0",
                  )}
                />
                <item.icon
                  className={cn("size-[18px] shrink-0", active && "text-accent")}
                />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <button
          onClick={() => signOut()}
          className="mx-3 mb-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-red-400 hover:text-red-300 transition-colors hover:bg-sidebar-accent/60"
          title="Sair do sistema"
        >
          <LogOut className="size-[18px] shrink-0" />
          {!collapsed && <span>Sair</span>}
        </button>

        <button
          onClick={() => setCollapsed((v) => !v)}
          className="m-3 mt-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
        >
          {collapsed ? (
            <PanelLeft className="size-[18px]" />
          ) : (
            <>
              <PanelLeftClose className="size-[18px]" />
              <span>Recolher menu</span>
            </>
          )}
        </button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-border bg-card px-6">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold tracking-tight text-foreground">
              {title}
            </h1>
            {subtitle && (
              <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
          <div className="relative hidden md:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              placeholder="Buscar em tudo…"
              className="h-9 w-64 rounded-lg border border-input bg-background pl-9 pr-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
            />
          </div>
          {actions}
          <button className="relative grid size-9 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground">
            <Bell className="size-4" />
            <span className="absolute right-2 top-2 size-2 rounded-full bg-accent" />
          </button>
          <div className="flex items-center gap-3 border-l border-border pl-4">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold leading-tight max-w-[150px] truncate">{name}</p>
              <p className="text-xs text-muted-foreground truncate max-w-[150px]">{email}</p>
            </div>
            <span className="grid size-9 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
              {initials}
            </span>
          </div>
        </header>

        <main className={cn("min-w-0 flex-1", flush ? "" : "p-6")}>{children}</main>
      </div>
    </div>
  );
}
