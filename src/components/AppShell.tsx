import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Handshake,
  MessagesSquare,
  CheckSquare,
  Users,
  Wallet,
  BarChart3,
  Settings,
  Calculator,
  Bell,
  LogOut,
  Sun,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "./AuthProvider";
import { useTheme } from "./ThemeProvider";

const NAV = [
  { label: "Visão Geral", to: "/", icon: LayoutDashboard },
  { label: "Negócios", to: "/negocios", icon: Handshake },
  { label: "Clientes", to: "/clientes", icon: Users },
  { label: "Atendimentos", to: "/atendimentos", icon: MessagesSquare },
  { label: "Tarefas", to: "/tarefas", icon: CheckSquare },
  { label: "Orçamentos", to: "/orcamentos", icon: Calculator },
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
  /* Padrão do guia: menu lateral de 248px. O modo recolhido continua
     disponível como estado secundário (trilho de ícones). */
  const [collapsed, setCollapsed] = useState(false);
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();

  const email = user?.email || "";
  const name =
    user?.user_metadata?.full_name || user?.user_metadata?.name || email.split("@")[0] || "Usuário";
  const initials = name
    .split(" ")
    .map((n: string) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const isDark = theme === "dark";
  const toggleTheme = () => setTheme(isDark ? "light" : "dark");

  return (
    <div className="flex min-h-screen w-full bg-bg font-sans text-ink antialiased">
      {/* ───────────────────────── Menu lateral ───────────────────────── */}
      <aside
        className={cn(
          "sticky top-0 z-[var(--omni-z-sticky)] flex h-screen shrink-0 flex-col border-r border-line bg-surface transition-[width] duration-[var(--omni-dur-base)] ease-omni",
          collapsed ? "w-[68px]" : "w-sidebar",
        )}
      >
        <div
          className={cn(
            "flex h-topbar shrink-0 items-center border-b border-line",
            collapsed ? "justify-center px-2" : "px-5",
          )}
        >
          <Link
            to="/"
            className="flex items-center gap-3 rounded-md"
            aria-label="Omni — ir para a visão geral"
          >
            <img
              src="/LOGO%20OMNI%20(1).png"
              alt="Omni"
              className={cn("w-auto object-contain", collapsed ? "h-7" : "h-8")}
            />
          </Link>
        </div>

        <nav
          className="omni-nav flex-1 gap-0.5 overflow-y-auto p-3 scrollbar-slim"
          aria-label="Navegação principal"
        >
          {NAV.map((item) => {
            const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={active ? "page" : undefined}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "group relative flex h-control items-center gap-3 rounded-md px-3 text-sm font-medium text-ink-2 transition-colors duration-[var(--omni-dur-fast)] ease-omni hover:bg-surface-3 hover:text-ink",
                  active &&
                    "bg-primary-soft font-semibold text-primary-soft-fg hover:bg-primary-soft hover:text-primary-soft-fg",
                  collapsed && "justify-center px-0",
                )}
              >
                <item.icon className={cn("size-4 shrink-0", !active && "opacity-75")} />
                {collapsed ? (
                  <span className="omni-sr">{item.label}</span>
                ) : (
                  <span className="truncate">{item.label}</span>
                )}
                {collapsed && (
                  <span className="omni-tooltip pointer-events-none absolute left-[60px] whitespace-nowrap opacity-0 transition-opacity duration-[var(--omni-dur-fast)] group-hover:opacity-100">
                    {item.label}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="shrink-0 border-t border-line p-3">
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className={cn(
              "flex h-control w-full items-center gap-3 rounded-md px-3 text-sm font-medium text-ink-3 transition-colors duration-[var(--omni-dur-fast)] ease-omni hover:bg-surface-3 hover:text-ink",
              collapsed && "justify-center px-0",
            )}
          >
            {collapsed ? (
              <PanelLeftOpen className="size-4 shrink-0" />
            ) : (
              <PanelLeftClose className="size-4 shrink-0" />
            )}
            <span className={cn(collapsed && "omni-sr")}>
              {collapsed ? "Expandir menu" : "Recolher menu"}
            </span>
          </button>

          <button
            type="button"
            onClick={() => signOut()}
            className={cn(
              "flex h-control w-full items-center gap-3 rounded-md px-3 text-sm font-medium text-ink-3 transition-colors duration-[var(--omni-dur-fast)] ease-omni hover:bg-danger-soft hover:text-danger-fg",
              collapsed && "justify-center px-0",
            )}
          >
            <LogOut className="size-4 shrink-0" />
            <span className={cn(collapsed && "omni-sr")}>Sair da conta</span>
          </button>
        </div>
      </aside>

      {/* ─────────────────────── Área principal ─────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-[var(--omni-z-sticky)] flex h-topbar shrink-0 items-center gap-4 border-b border-line bg-surface px-5">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-md font-bold leading-tight tracking-snug text-ink">
              {title}
            </h1>
            {subtitle && <p className="truncate text-xs text-ink-3">{subtitle}</p>}
          </div>

          {actions}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              className="omni-btn omni-btn--ghost omni-btn--icon omni-btn--sm"
              title={isDark ? "Usar tema claro" : "Usar tema escuro"}
            >
              {isDark ? <Sun /> : <Moon />}
              <span className="omni-sr">{isDark ? "Usar tema claro" : "Usar tema escuro"}</span>
            </button>

            <button
              type="button"
              className="omni-btn omni-btn--ghost omni-btn--icon omni-btn--sm"
              title="Notificações"
            >
              <Bell />
              <span className="omni-sr">Notificações</span>
            </button>
          </div>

          <div className="flex items-center gap-3 border-l border-line pl-4">
            <div className="hidden text-right sm:block">
              <p className="max-w-[160px] truncate text-sm font-semibold leading-tight text-ink">
                {name}
              </p>
              <p className="max-w-[160px] truncate text-xs text-ink-3">{email}</p>
            </div>
            <span className="omni-avatar" aria-hidden="true">
              {initials}
            </span>
          </div>
        </header>

        <main className={cn("min-w-0 flex-1", flush ? "" : "p-5")}>{children}</main>
      </div>
    </div>
  );
}
