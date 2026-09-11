import { Link, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  Calculator,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Handshake,
  LayoutDashboard,
  LogOut,
  MessagesSquare,
  Moon,
  Settings,
  Sun,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState, type ComponentType } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useAuth } from "./AuthProvider";
import { useTheme } from "./ThemeProvider";

/* ---------------------------------------------------------------------------
 * Navegação
 * Cada item pode declarar rotas extras em `match` — é o que mantém "Negócios"
 * marcado enquanto o usuário está dentro de /lead/$leadId.
 * ------------------------------------------------------------------------- */
type NavItem = {
  label: string;
  to: string;
  icon: ComponentType<{ className?: string }>;
  match?: string[];
};

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Operação",
    items: [
      { label: "Visão Geral", to: "/", icon: LayoutDashboard },
      { label: "Negócios", to: "/negocios", icon: Handshake, match: ["/lead"] },
      { label: "Clientes", to: "/clientes", icon: Users },
      { label: "Atendimentos", to: "/atendimentos", icon: MessagesSquare },
      { label: "Tarefas", to: "/tarefas", icon: CheckSquare },
    ],
  },
  {
    label: "Financeiro",
    items: [
      { label: "Orçamentos", to: "/orcamentos", icon: Calculator },
      { label: "Financeiro", to: "/financeiro", icon: Wallet },
      { label: "Relatório Geral", to: "/relatorios", icon: BarChart3 },
    ],
  },
  {
    label: "Sistema",
    items: [{ label: "Configurações", to: "/configuracoes", icon: Settings }],
  },
];

const OPEN_KEY = "omni-sidebar-open";

/* ---------------------------------------------------------------------------
 * Estado do menu
 * Só existe a escolha explícita do usuário, persistida. O padrão é sempre
 * fechado: o SSR e a primeira pintura renderizam o trilho recolhido, e o valor
 * salvo só é lido depois da hidratação para não gerar divergência de marcação.
 * ------------------------------------------------------------------------- */
export function useSidebarState() {
  const [expanded, setExpanded] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(OPEN_KEY) === "1") setExpanded(true);
    } catch {
      // localStorage indisponível (modo privado): segue fechado.
    }
  }, []);

  const toggleExpanded = useCallback(() => {
    setExpanded((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(OPEN_KEY, next ? "1" : "0");
      } catch {
        // ignora
      }
      return next;
    });
  }, []);

  return { expanded, toggleExpanded, mobileOpen, setMobileOpen };
}

export type SidebarState = ReturnType<typeof useSidebarState>;

function useAccount() {
  const { user } = useAuth();
  const email = user?.email || "";
  const name =
    user?.user_metadata?.full_name || user?.user_metadata?.name || email.split("@")[0] || "Usuário";
  const initials =
    name
      .split(" ")
      .map((part: string) => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "U";

  return { name, email, initials };
}

/* Ícone sempre na mesma coordenada X: a caixa fixa de 44px é o que faz o
   rótulo aparecer sem que nada se desloque quando o menu abre. */
const ICON_BOX = "grid w-11 shrink-0 place-items-center";

function NavLinks({ expanded, onNavigate }: { expanded: boolean; onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  const isActive = (item: NavItem) => {
    if (item.to === "/") return pathname === "/";
    const targets = [item.to, ...(item.match ?? [])];
    return targets.some((target) => pathname === target || pathname.startsWith(`${target}/`));
  };

  return (
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto overflow-x-hidden px-3 py-2 scrollbar-none">
      {NAV_GROUPS.map((group, index) => (
        <div key={group.label} className="flex flex-col gap-1">
          {expanded ? (
            <p
              className={cn(
                "px-3 pb-1 text-2xs font-bold uppercase tracking-label text-ink-faint",
                index === 0 ? "pt-1" : "pt-4",
              )}
            >
              {group.label}
            </p>
          ) : (
            index > 0 && <span className="mx-auto my-2 h-px w-6 bg-line" aria-hidden="true" />
          )}

          {group.items.map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-11 w-full items-center gap-1 rounded-xl text-sm font-medium text-ink-2",
                  "transition-colors duration-[var(--omni-dur-fast)] ease-omni",
                  "hover:bg-surface-3 hover:text-ink",
                  active &&
                    "bg-primary font-semibold text-primary-fg shadow-sm hover:bg-primary-hover hover:text-primary-fg",
                )}
              >
                <span className={ICON_BOX}>
                  <item.icon className={cn("size-[18px]", !active && "opacity-80")} />
                </span>
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate whitespace-nowrap pr-3 text-left",
                    "transition-opacity duration-[var(--omni-dur-fast)] ease-omni",
                    !expanded && "opacity-0",
                  )}
                  aria-hidden={!expanded}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

/* Conta do usuário — saiu do topo da página e virou o rodapé do menu. */
function AccountMenu({ expanded }: { expanded: boolean }) {
  const { signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const { name, email, initials } = useAccount();

  const isDark = theme === "dark";
  const itemClass =
    "gap-2 rounded-md px-2.5 py-2 text-sm text-ink-2 focus:bg-surface-3 focus:text-ink";

  return (
    <div className="shrink-0 border-t border-line-subtle p-3">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex h-12 w-full items-center gap-1 rounded-xl text-left",
              "transition-colors duration-[var(--omni-dur-fast)] ease-omni hover:bg-surface-3",
              "data-[state=open]:bg-surface-3",
            )}
            aria-label="Conta e preferências"
          >
            <span className={ICON_BOX}>
              <span className="omni-avatar" aria-hidden="true">
                {initials}
              </span>
            </span>
            <span
              className={cn(
                "min-w-0 flex-1 transition-opacity duration-[var(--omni-dur-fast)] ease-omni",
                !expanded && "opacity-0",
              )}
              aria-hidden={!expanded}
            >
              <span className="block truncate text-sm font-semibold leading-tight text-ink">
                {name}
              </span>
              <span className="block truncate text-xs leading-tight text-ink-3">{email}</span>
            </span>
            <ChevronsUpDown
              className={cn(
                "mr-3 size-4 shrink-0 text-ink-faint transition-opacity duration-[var(--omni-dur-fast)]",
                !expanded && "opacity-0",
              )}
              aria-hidden="true"
            />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          side="top"
          align="start"
          sideOffset={10}
          /* Acima do próprio menu lateral (z-dropdown), senão abre por baixo dele. */
          className="z-[var(--omni-z-overlay)] w-64 rounded-xl border-line bg-surface p-1.5 shadow-lg"
        >
          <div className="px-2.5 py-2">
            <p className="truncate text-sm font-semibold leading-tight text-ink">{name}</p>
            <p className="truncate text-xs leading-tight text-ink-3">{email}</p>
          </div>

          <DropdownMenuSeparator className="bg-line-subtle" />

          <DropdownMenuItem asChild className={itemClass}>
            <Link to="/configuracoes">
              <Settings />
              Configurações
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem
            className={itemClass}
            onSelect={(event) => {
              event.preventDefault();
              setTheme(isDark ? "light" : "dark");
            }}
          >
            {isDark ? <Sun /> : <Moon />}
            {isDark ? "Tema claro" : "Tema escuro"}
          </DropdownMenuItem>

          <DropdownMenuSeparator className="bg-line-subtle" />

          <DropdownMenuItem
            className="gap-2 rounded-md px-2.5 py-2 text-sm text-danger-fg focus:bg-danger-soft focus:text-danger-fg"
            onSelect={() => signOut()}
          >
            <LogOut />
            Sair da conta
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function SidebarHeader({ expanded, onClose }: { expanded: boolean; onClose?: () => void }) {
  return (
    <div className="flex h-16 shrink-0 items-center gap-1 px-3">
      <Link to="/" onClick={onClose} className={ICON_BOX} aria-label="Omni — ir para a visão geral">
        <img src="/LOGO%20OMNI%20(1).png" alt="" className="size-8 object-contain" />
      </Link>

      <span
        className={cn(
          "min-w-0 flex-1 truncate text-md font-extrabold tracking-tight text-ink",
          "transition-opacity duration-[var(--omni-dur-fast)] ease-omni",
          !expanded && "opacity-0",
        )}
        aria-hidden={!expanded}
      >
        Omni
      </span>

      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="mr-1 grid size-8 shrink-0 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-surface-3 hover:text-ink lg:hidden"
        >
          <X className="size-4" />
          <span className="omni-sr">Fechar menu</span>
        </button>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Menu flutuante
 * Desktop: cartão solto do conteúdo (inset-y-3 / left-3), recolhido em 68px e
 * aberto em 252px. Abre e fecha só pela alça redonda na borda direita — não
 * reage ao passar do mouse.
 * Mobile: gaveta sobre overlay.
 * ------------------------------------------------------------------------- */
export function AppSidebar({ state }: { state: SidebarState }) {
  const { expanded, toggleExpanded, mobileOpen, setMobileOpen } = state;

  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen, setMobileOpen]);

  const shell = "flex flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-lg";

  return (
    <>
      {/*
        A alça vive fora do cartão, então quem posiciona e anima a largura é
        este contêiner: o <aside> continua com overflow oculto para recortar os
        rótulos durante a transição, e o botão fica livre para escapar da borda.
      */}
      <div
        className={cn(
          "fixed inset-y-3 left-3 z-[var(--omni-z-dropdown)] hidden lg:block",
          "transition-[width] duration-[var(--omni-dur-base)] ease-omni",
          expanded ? "w-[252px]" : "w-[68px]",
        )}
      >
        <aside aria-label="Navegação principal" className={cn(shell, "h-full w-full")}>
          <SidebarHeader expanded={expanded} />
          <NavLinks expanded={expanded} />
          <AccountMenu expanded={expanded} />
        </aside>

        <button
          type="button"
          onClick={toggleExpanded}
          aria-expanded={expanded}
          title={expanded ? "Recolher menu" : "Expandir menu"}
          className={cn(
            /* Logo abaixo da linha do logo, longe da curva da quina. */
            "absolute right-0 top-10 grid size-7 -translate-y-1/2 translate-x-1/2 place-items-center",
            "rounded-full border border-line bg-surface text-ink-2 shadow-md",
            "transition-colors duration-[var(--omni-dur-fast)] ease-omni",
            "hover:border-line-strong hover:bg-surface-3 hover:text-ink",
          )}
        >
          {expanded ? <ChevronLeft className="size-4" /> : <ChevronRight className="size-4" />}
          <span className="omni-sr">{expanded ? "Recolher menu" : "Expandir menu"}</span>
        </button>
      </div>

      {/* ───────────────────────────── Mobile ───────────────────────────── */}
      <div
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
        className={cn(
          "fixed inset-0 z-[var(--omni-z-overlay)] bg-overlay backdrop-blur-sm lg:hidden",
          "transition-opacity duration-[var(--omni-dur-base)] ease-omni",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />
      <aside
        aria-label="Navegação principal"
        aria-hidden={!mobileOpen}
        className={cn(
          shell,
          "fixed inset-y-3 left-3 z-[var(--omni-z-overlay)] w-[268px] max-w-[82vw] lg:hidden",
          "transition-transform duration-[var(--omni-dur-base)] ease-omni",
          mobileOpen ? "translate-x-0" : "-translate-x-[calc(100%+16px)]",
        )}
      >
        <SidebarHeader expanded onClose={() => setMobileOpen(false)} />
        <NavLinks expanded onNavigate={() => setMobileOpen(false)} />
        <AccountMenu expanded />
      </aside>
    </>
  );
}
