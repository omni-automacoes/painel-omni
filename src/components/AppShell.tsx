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
  PanelLeftClose,
  PanelLeft,
  LogOut,
  Sun,
  Moon,
  ChevronRight,
  ChevronLeft,
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
  /* Por padrão o menu sempre vem colapsado (recolhido) */
  const [collapsed, setCollapsed] = useState(true);
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();

  const email = user?.email || "";
  const name = user?.user_metadata?.full_name || user?.user_metadata?.name || email.split("@")[0] || "Usuário";
  const initials = name
    .split(" ")
    .map((n: string) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground font-sans antialiased">
      
      {/* ══════ SIDEBAR ULTRA-MODERNA ══════ */}
      <aside
        className={cn(
          "sticky top-0 z-30 flex h-screen shrink-0 flex-col bg-sidebar text-sidebar-foreground transition-all duration-300 ease-in-out border-r border-sidebar-border backdrop-blur-2xl select-none",
          collapsed ? "w-[78px]" : "w-[250px]",
        )}
      >
        {/* Header da Sidebar com a Logo Oficial Omni */}
        <div className={cn("flex h-20 items-center border-b border-sidebar-border px-4 transition-all", collapsed ? "justify-center" : "justify-between px-5")}>
          <Link to="/" className="flex items-center gap-3 group">
            {collapsed ? (
              <div className="p-2 rounded-2xl bg-white/5 border border-white/10 shadow-lg transition-transform group-hover:scale-105 flex items-center justify-center">
                <img
                  src="/LOGO%20OMNI%20(1).png"
                  alt="Omni Logo"
                  className="h-8 w-auto object-contain"
                />
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <img
                  src="/LOGO%20OMNI%20(1).png"
                  alt="Omni Logo"
                  className="h-10 w-auto object-contain transition-all"
                />
              </div>
            )}
          </Link>
        </div>

        {/* Links de Navegação */}
        <nav className="mt-4 flex flex-1 flex-col gap-1.5 px-3 overflow-y-auto scrollbar-none">
          {NAV.map((item) => {
            const active =
              item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "group relative flex items-center gap-3.5 rounded-xl px-3.5 py-3 text-sm font-semibold transition-all duration-200",
                  active
                    ? "bg-accent/15 text-accent font-bold shadow-md shadow-accent/5 border-l-4 border-l-accent"
                    : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                  collapsed && "justify-center px-0",
                )}
              >
                <item.icon
                  className={cn(
                    "size-5 shrink-0 transition-transform group-hover:scale-110",
                    active ? "text-accent" : "text-sidebar-foreground/60 group-hover:text-sidebar-foreground",
                  )}
                />

                {!collapsed && (
                  <span className="truncate tracking-tight">{item.label}</span>
                )}

                {/* Tooltip quando estiver colapsado */}
                {collapsed && (
                  <span className="absolute left-16 z-50 rounded-xl bg-card border border-border px-3 py-1.5 text-xs font-bold text-foreground shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                    {item.label}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Rodapé da Sidebar: Botão Sair & Botão Expandir/Recolher */}
        <div className="p-3 border-t border-sidebar-border space-y-1">
          {/* Botão Sair */}
          <button
            onClick={() => signOut()}
            className={cn(
              "group relative flex w-full items-center gap-3.5 rounded-xl px-3.5 py-2.5 text-sm font-medium text-red-400/80 hover:text-red-400 hover:bg-red-500/10 transition-all",
              collapsed && "justify-center px-0",
            )}
            title="Sair da conta"
          >
            <LogOut className="size-5 shrink-0 transition-transform group-hover:scale-110" />
            {!collapsed && <span>Sair da conta</span>}
            {collapsed && (
              <span className="absolute left-16 z-50 rounded-xl bg-card border border-border px-3 py-1.5 text-xs font-bold text-red-400 shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                Sair da conta
              </span>
            )}
          </button>

          {/* Botão Alternar Expansão */}
          <button
            onClick={() => setCollapsed((v) => !v)}
            className={cn(
              "group relative flex w-full items-center gap-3.5 rounded-xl px-3.5 py-2.5 text-sm font-medium text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-all",
              collapsed && "justify-center px-0",
            )}
            title={collapsed ? "Expandir menu" : "Recolher menu"}
          >
            {collapsed ? (
              <ChevronRight className="size-5 shrink-0 text-accent transition-transform group-hover:scale-110" />
            ) : (
              <>
                <ChevronLeft className="size-5 shrink-0 text-accent transition-transform group-hover:scale-110" />
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Recolher Menu</span>
              </>
            )}
            {collapsed && (
              <span className="absolute left-16 z-50 rounded-xl bg-card border border-border px-3 py-1.5 text-xs font-bold text-foreground shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                Expandir menu
              </span>
            )}
          </button>
        </div>
      </aside>

      {/* Área Principal (Header + Conteúdo) */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-border bg-card/90 px-6 backdrop-blur-xl">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-extrabold tracking-tight text-foreground">
              {title}
            </h1>
            {subtitle && (
              <p className="truncate text-xs text-muted-foreground font-medium">{subtitle}</p>
            )}
          </div>
          {actions}

          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className="relative grid size-9 place-items-center rounded-xl border border-border text-muted-foreground transition-colors hover:text-foreground hover:bg-accent/10"
            title={theme === "dark" ? "Alternar para Modo Claro" : "Alternar para Modo Escuro"}
          >
            {theme === "dark" ? (
              <Sun className="size-4 text-[#fba834]" />
            ) : (
              <Moon className="size-4 text-foreground" />
            )}
          </button>

          {/* Notifications Button */}
          <button className="relative grid size-9 place-items-center rounded-xl border border-border text-muted-foreground transition-colors hover:text-foreground">
            <Bell className="size-4" />
            <span className="absolute right-2 top-2 size-2 rounded-full bg-accent animate-pulse" />
          </button>

          {/* User Profile */}
          <div className="flex items-center gap-3 border-l border-border pl-4">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-bold leading-tight max-w-[150px] truncate text-foreground">{name}</p>
              <p className="text-xs text-muted-foreground truncate max-w-[150px] font-medium">{email}</p>
            </div>
            <span className="grid size-9 place-items-center rounded-2xl bg-gradient-to-r from-[#fba834] to-[#f7931e] text-sm font-extrabold text-[#0d0d26] shadow-md border border-white/20">
              {initials}
            </span>
          </div>
        </header>

        <main className={cn("min-w-0 flex-1", flush ? "" : "p-6")}>{children}</main>
      </div>
    </div>
  );
}
