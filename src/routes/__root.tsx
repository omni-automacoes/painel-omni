import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportOmniError } from "../lib/omni-error-reporting";
import { AuthProvider, useAuth } from "../components/AuthProvider";
import { ThemeProvider } from "../components/ThemeProvider";
import { Toaster } from "../components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="omni-root flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-prose text-center">
        <p className="omni-eyebrow">Erro 404</p>
        <h1 className="omni-h2 mt-2">Esta página não existe</h1>
        <p className="omni-p mx-auto mt-3 text-ink-2">
          O endereço pode ter mudado ou o registro foi removido. Volte para a visão geral e continue
          de lá.
        </p>
        <div className="mt-6 flex justify-center">
          <Link to="/" className="omni-btn omni-btn--primary">
            Ir para a visão geral
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportOmniError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="omni-root flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-prose text-center">
        <p className="omni-eyebrow">Falha ao carregar</p>
        <h1 className="omni-h3 mt-2">Esta página não abriu</h1>
        <p className="omni-p mx-auto mt-3 text-ink-2">
          A tentativa de carregar os dados falhou. Tente de novo — se o erro continuar, volte para a
          visão geral e reabra a partir de lá.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="omni-btn omni-btn--primary"
          >
            Tentar de novo
          </button>
          <a href="/" className="omni-btn omni-btn--secondary">
            Ir para a visão geral
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Omni · Gestão centralizada para pequenas empresas" },
      {
        name: "description",
        content:
          "Omni reúne vendas, atendimentos, tarefas e financeiro da sua pequena empresa em um só sistema.",
      },
      { name: "author", content: "Omni" },
      { property: "og:title", content: "Omni · Gestão centralizada para pequenas empresas" },
      {
        property: "og:description",
        content: "Vendas, atendimentos, tarefas e financeiro em um só lugar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700;800&display=swap",
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),

  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className="light" data-theme="light">
      <head>
        <HeadContent />
      </head>
      <body className="omni omni-root">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function AuthShield({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading) {
      if (!user && pathname !== "/login") {
        router.navigate({ to: "/login" });
      } else if (user && pathname === "/login") {
        router.navigate({ to: "/" });
      }
    }
  }, [user, loading, pathname, router]);

  if (loading) {
    return (
      <div className="omni-root flex min-h-screen items-center justify-center bg-bg">
        <div className="flex flex-col items-center gap-4">
          <span className="omni-spinner" style={{ width: 28, height: 28 }} aria-hidden="true" />
          <p className="text-sm font-medium text-ink-2">Carregando o Omni…</p>
        </div>
      </div>
    );
  }

  // Se não estiver logado e a rota não for /login, não renderiza as rotas internas enquanto redireciona
  if (!user && pathname !== "/login") {
    return null;
  }

  return <>{children}</>;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" storageKey="omni-theme">
        <AuthProvider>
          <AuthShield>
            {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
            <Outlet />
          </AuthShield>
        </AuthProvider>
        {/* Dentro do ThemeProvider para o toast seguir o tema escolhido. */}
        <Toaster />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
