import { Bell, Menu } from "lucide-react";
import { type ReactNode } from "react";

import { cn } from "@/lib/utils";
import { AppSidebar, useSidebarState } from "./AppSidebar";

/* Botão de utilidade do cabeçalho: abrir a gaveta no mobile e o sino. */
const MENU_BUTTON =
  "order-1 grid size-9 shrink-0 place-items-center rounded-lg text-ink-2 transition-colors duration-[var(--omni-dur-fast)] ease-omni hover:bg-surface-3 hover:text-ink";

/*
 * Casca da aplicação: altura fixa de viewport, menu e cabeçalho estáticos e a
 * rolagem acontecendo dentro do <main>. É isso que permite o cabeçalho crescer
 * (duas linhas no mobile) sem quebrar as telas de altura cheia, que agora usam
 * `h-full` em vez de calcular 100vh menos a altura do topo.
 */
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
  const sidebar = useSidebarState();

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-bg font-sans text-ink antialiased">
      <AppSidebar state={sidebar} />

      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col",
          "transition-[padding] duration-[var(--omni-dur-base)] ease-omni",
          sidebar.expanded ? "lg:pl-[284px]" : "lg:pl-[100px]",
        )}
      >
        <header className="shrink-0 px-4 pb-4 pt-5 sm:px-6 lg:pb-5 lg:pt-7">
          {/*
            Desktop: uma linha só — título, ações e sino. Recolher o menu é
            papel da alça na borda do próprio menu, não daqui.
            Mobile: `order` + `w-full` reorganizam em três linhas — utilidades
            (abrir a gaveta e sino), título e ações — para o título ter a
            largura inteira em vez de ficar espremido entre dois botões.
          */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
            <button
              type="button"
              onClick={() => sidebar.setMobileOpen(true)}
              className={cn(MENU_BUTTON, "lg:hidden")}
              title="Abrir menu"
            >
              <Menu className="size-[18px]" />
              <span className="omni-sr">Abrir menu</span>
            </button>

            <button
              type="button"
              className={cn(MENU_BUTTON, "order-2 ml-auto lg:order-4 lg:ml-0")}
              title="Notificações"
            >
              <Bell className="size-[18px]" />
              <span className="omni-sr">Notificações</span>
            </button>

            <div className="order-3 w-full min-w-0 lg:order-2 lg:w-auto lg:flex-1">
              <h1 className="line-clamp-2 text-lg font-bold leading-snug tracking-tight text-ink lg:truncate lg:text-xl">
                {title}
              </h1>
              {subtitle && (
                <p className="mt-0.5 line-clamp-1 text-sm leading-snug text-ink-3 lg:truncate">
                  {subtitle}
                </p>
              )}
            </div>

            {actions && (
              <div className="order-4 flex w-full flex-wrap items-center gap-2 lg:order-3 lg:w-auto lg:flex-nowrap">
                {actions}
              </div>
            )}
          </div>
        </header>

        <main
          id="omni-main"
          className={cn(
            "min-h-0 flex-1",
            flush
              ? "flex flex-col overflow-hidden"
              : "overflow-y-auto px-4 pb-6 sm:px-6 scrollbar-slim",
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
