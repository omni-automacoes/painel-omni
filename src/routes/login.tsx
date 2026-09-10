import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { KeyRound, Mail, ArrowRight, Eye, EyeOff, ShieldCheck, Activity, Lock } from "lucide-react";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [{ title: "Omni · Login" }, { name: "description", content: "Acesse o painel do Omni." }],
  }),
  component: LoginComponent,
});

function LoginComponent() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Por favor, preencha todos os campos.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast.error(error.message || "Credenciais inválidas. Tente novamente.");
      } else {
        toast.success("Acesso autorizado!");
        router.navigate({ to: "/" });
      }
    } catch (err) {
      toast.error("Erro inesperado. Tente novamente.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-bg px-4 py-10 font-sans text-ink sm:px-6">
      <div className="grid w-full max-w-omni items-center gap-12 lg:grid-cols-2">
        {/* ───────────── Apresentação ───────────── */}
        <div className="flex flex-col gap-8">
          <img
            src="/LOGO%20OMNI%20(1).png"
            alt="Omni"
            className="h-12 w-auto self-start object-contain"
          />

          <div className="flex flex-col gap-3">
            <p className="omni-eyebrow">Painel de controle de automações</p>
            <h1 className="omni-h1">Omni Automações</h1>
            <p className="omni-lead text-ink-2">
              Vendas, atendimentos, tarefas e financeiro da sua empresa em um só lugar, com os dados
              atualizados em tempo real.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="omni-card omni-card--inset">
              <div className="omni-card__body flex items-center gap-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-md bg-success-soft text-success">
                  <Activity className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="omni-eyebrow">Status do sistema</p>
                  <p className="omni-status mt-1">
                    <span className="omni-dot omni-dot--success omni-dot--pulse" />
                    100% operacional
                  </p>
                </div>
              </div>
            </div>

            <div className="omni-card omni-card--inset">
              <div className="omni-card__body flex items-center gap-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-md bg-primary-soft text-primary-soft-fg">
                  <ShieldCheck className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="omni-eyebrow">Segurança</p>
                  <p className="mt-1 text-sm font-semibold text-ink">Criptografia ponta a ponta</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ───────────── Formulário ───────────── */}
        <div className="flex justify-center">
          <div className="omni-card omni-card--raised w-full max-w-[440px]">
            <div className="omni-card__header">
              <div>
                <h2 className="omni-h3">Acesse sua conta</h2>
                <p className="omni-small mt-1">
                  Informe o e-mail e a senha cadastrados para entrar no painel.
                </p>
              </div>
            </div>

            <form onSubmit={handleLogin} className="omni-card__body omni-stack">
              <div className="omni-field">
                <label className="omni-label" htmlFor="email">
                  E-mail <span className="omni-req">*</span>
                </label>
                <div className="omni-input-group">
                  <Mail />
                  <input
                    id="email"
                    type="email"
                    required
                    disabled={loading}
                    autoComplete="email"
                    placeholder="seu.email@omniautomacoes.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="omni-input"
                  />
                </div>
              </div>

              <div className="omni-field">
                <label className="omni-label" htmlFor="password">
                  Senha <span className="omni-req">*</span>
                </label>
                <div className="omni-input-group">
                  <KeyRound />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    disabled={loading}
                    autoComplete="current-password"
                    placeholder="Sua senha de acesso"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="omni-input pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="omni-suffix cursor-pointer rounded-xs text-ink-faint transition-colors hover:text-ink"
                    disabled={loading}
                  >
                    {showPassword ? (
                      <EyeOff className="static size-4" />
                    ) : (
                      <Eye className="static size-4" />
                    )}
                    <span className="omni-sr">
                      {showPassword ? "Ocultar senha" : "Mostrar senha"}
                    </span>
                  </button>
                </div>
                <p className="omni-hint">
                  Esqueceu a senha? Peça a redefinição ao administrador do painel.
                </p>
              </div>

              <label className="omni-check">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span>Lembrar acesso neste dispositivo</span>
              </label>

              <button
                type="submit"
                disabled={loading}
                data-loading={loading ? "true" : undefined}
                className="omni-btn omni-btn--accent omni-btn--lg omni-btn--block"
              >
                <span>Entrar no painel</span>
                <ArrowRight />
              </button>
            </form>

            <div className="omni-card__footer justify-center gap-2 text-ink-3">
              <Lock className="size-3.5" />
              <span className="text-xs font-medium">Ambiente protegido e autenticado</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
