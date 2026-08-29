import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import {
  KeyRound,
  Mail,
  Loader2,
  ArrowRight,
  Eye,
  EyeOff,
  ShieldCheck,
  Zap,
  Activity,
  CheckCircle2,
  Lock,
} from "lucide-react";

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
    <div className="relative min-h-screen w-full bg-[#080819] text-white flex items-center justify-center p-4 sm:p-6 md:p-10 overflow-hidden font-sans select-none">
      {/* Luzes difusas de fundo (Efeito Ambient Glow) */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#fba834]/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-[#272757]/40 rounded-full blur-[160px] pointer-events-none" />
      <div className="absolute top-0 left-0 w-[400px] h-[400px] bg-[#1d1d4d]/30 rounded-full blur-[120px] pointer-events-none" />

      {/* Grid Pattern overlay */}
      <div 
        className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none"
      />

      {/* Main Container */}
      <div className="relative z-10 w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        
        {/* Lado Esquerdo: Visual / Branding */}
        <div className="lg:col-span-6 flex flex-col justify-center space-y-8 px-2 lg:px-4">
          
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl shadow-xl shadow-black/20">
              <img
                src="/LOGO%20OMNI%20(1).png"
                alt="Omni Logo"
                className="h-12 sm:h-14 w-auto object-contain"
              />
            </div>
          </div>

          {/* Título Impactante e Enxuto */}
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#fba834]/10 border border-[#fba834]/20 text-[#fba834] text-xs font-semibold tracking-wide">
              <Zap className="size-3.5" />
              PAINEL DE CONTROL DE AUTOMAÇÕES
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight">
              Ecossistema Inteligente <br />
              <span className="bg-gradient-to-r from-[#fba834] via-[#ffc06e] to-white bg-clip-text text-transparent">
                Omni Automações
              </span>
            </h1>
            <p className="text-sm sm:text-base text-white/50 font-medium max-w-md">
              Gestão centralizada de fluxos de trabalho, dados e integrações em tempo real.
            </p>
          </div>

          {/* Micro Card Visual de Status */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-md flex items-center gap-3.5 transition-all hover:bg-white/[0.06] hover:border-white/20">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Activity className="size-5" />
              </div>
              <div>
                <p className="text-xs text-white/50 font-medium">Status do Sistema</p>
                <p className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 mt-0.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  100% Operacional
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-md flex items-center gap-3.5 transition-all hover:bg-white/[0.06] hover:border-white/20">
              <div className="p-2.5 rounded-xl bg-[#fba834]/10 text-[#fba834] border border-[#fba834]/20">
                <ShieldCheck className="size-5" />
              </div>
              <div>
                <p className="text-xs text-white/50 font-medium">Segurança</p>
                <p className="text-xs font-bold text-white mt-0.5">Criptografia Ponta a Ponta</p>
              </div>
            </div>
          </div>
        </div>

        {/* Lado Direito: Formulário de Login */}
        <div className="lg:col-span-6 flex justify-center">
          <div className="w-full max-w-[440px] rounded-3xl border border-white/10 bg-[#12122d]/80 p-7 sm:p-9 shadow-2xl shadow-black/80 backdrop-blur-2xl relative overflow-hidden group">
            
            {/* Linha superior decorativa de destaque */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#fba834]/60 to-transparent" />

            <div className="mb-6 space-y-1">
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                Acesse sua conta
              </h2>
              <p className="text-xs sm:text-sm text-white/50 font-normal">
                Informe suas credenciais para entrar no sistema
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleLogin} className="space-y-4">
              
              {/* Input E-mail */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-white/70 flex items-center justify-between" htmlFor="email">
                  <span>E-MAIL</span>
                </label>
                <div className="relative group/input">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40 group-focus-within/input:text-[#fba834] transition-colors">
                    <Mail className="size-4" />
                  </div>
                  <input
                    id="email"
                    type="email"
                    required
                    disabled={loading}
                    placeholder="seu.email@omniautomacoes.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-12 w-full rounded-xl border border-white/10 bg-[#0a0a1e]/90 pl-10 pr-4 text-sm text-white placeholder-white/25 outline-none transition-all focus:border-[#fba834] focus:ring-2 focus:ring-[#fba834]/20 disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Input Senha */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-white/70 flex items-center justify-between" htmlFor="password">
                  <span>SENHA</span>
                </label>
                <div className="relative group/input">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40 group-focus-within/input:text-[#fba834] transition-colors">
                    <KeyRound className="size-4" />
                  </div>
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    disabled={loading}
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12 w-full rounded-xl border border-white/10 bg-[#0a0a1e]/90 pl-10 pr-11 text-sm text-white placeholder-white/25 outline-none transition-all focus:border-[#fba834] focus:ring-2 focus:ring-[#fba834]/20 disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors p-1"
                    disabled={loading}
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Checkbox Lembrar-me */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="size-4 rounded-md border border-white/20 bg-[#0a0a1e] peer-checked:bg-[#fba834] peer-checked:border-[#fba834] flex items-center justify-center transition-all">
                    {rememberMe && <CheckCircle2 className="size-3 text-[#0a0a1e] stroke-[3]" />}
                  </div>
                  <span className="text-xs text-white/60 font-medium">Lembrar acesso</span>
                </label>
              </div>

              {/* Botão de Entrar */}
              <button
                type="submit"
                disabled={loading}
                className="group relative flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#fba834] to-[#f7931e] px-4 font-bold text-[#0d0d26] transition-all duration-200 hover:brightness-110 active:scale-[0.99] disabled:opacity-50 shadow-lg shadow-[#fba834]/20 hover:shadow-[#fba834]/35 mt-5"
              >
                {loading ? (
                  <Loader2 className="size-5 animate-spin text-[#0d0d26]" />
                ) : (
                  <>
                    <span>Entrar no Painel</span>
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </button>
            </form>

            {/* Rodapé do Form com Sinal de Segurança */}
            <div className="mt-6 pt-5 border-t border-white/5 flex items-center justify-center gap-2 text-[11px] text-white/40 font-medium">
              <Lock className="size-3 text-emerald-400/80" />
              <span>Ambiente Protegido & Autenticado</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
