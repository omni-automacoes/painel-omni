import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { KeyRound, Mail, Loader2, ArrowRight, Eye, EyeOff } from "lucide-react";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Omni · Login" },
      { name: "description", content: "Acesse o painel do Omni." },
    ],
  }),
  component: LoginComponent,
});

function LoginComponent() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
    <div className="relative flex min-h-screen w-full items-center justify-center bg-[#0d0d26] overflow-hidden">
      {/* Luzes difusas de fundo (efeito premium neon/glow) */}
      <div className="absolute left-1/2 top-1/4 -translate-x-1/2 -translate-y-1/2 size-96 rounded-full bg-[#fba834]/5 blur-[120px] pointer-events-none" />
      <div className="absolute right-10 bottom-10 size-80 rounded-full bg-[#272757] blur-[100px] pointer-events-none" />

      {/* Card de Login */}
      <div className="relative z-10 w-full max-w-[420px] rounded-2xl border border-white/5 bg-[#16163a]/60 p-8 shadow-2xl backdrop-blur-xl sm:p-10 mx-4">
        
        {/* Logo / Cabeçalho minimalista */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <img
            src="/LOGO%20OMNI%20(1).png"
            alt="Worklivoo Logo"
            className="h-16 w-auto object-contain"
          />
        </div>

        {/* Formulário */}
        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-4">
            
            {/* Input E-mail */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-white/60 flex items-center gap-2" htmlFor="email">
                <Mail className="size-3.5 text-[#fba834]/80" />
                E-mail
              </label>
              <input
                id="email"
                type="email"
                required
                disabled={loading}
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 w-full rounded-xl border border-white/10 bg-[#0d0d26]/80 px-4 text-sm text-white placeholder-white/30 outline-none transition-all focus:border-[#fba834] focus:ring-2 focus:ring-[#fba834]/20 disabled:opacity-50"
              />
            </div>

            {/* Input Senha */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-white/60 flex items-center gap-2" htmlFor="password">
                <KeyRound className="size-3.5 text-[#fba834]/80" />
                Senha
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  disabled={loading}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 w-full rounded-xl border border-white/10 bg-[#0d0d26]/80 pl-4 pr-10 text-sm text-white placeholder-white/30 outline-none transition-all focus:border-[#fba834] focus:ring-2 focus:ring-[#fba834]/20 disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition-colors"
                  disabled={loading}
                >
                  {showPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Botão Ação */}
          <button
            type="submit"
            disabled={loading}
            className="relative flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#fba834] px-4 font-bold text-[#272757] transition-all hover:bg-[#fba834]/95 active:scale-[0.98] disabled:opacity-50 shadow-lg shadow-[#fba834]/10 hover:shadow-[#fba834]/20 mt-6"
          >
            {loading ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <>
                Acessar Painel
                <ArrowRight className="size-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
