import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";
import {
  User,
  Users,
  XCircle,
  Pencil,
  Plus,
  Trash2,
  Save,
  Loader2,
  KeyRound,
  Bot,
  ShieldCheck,
  Phone,
  Mail,
  X,
  Check,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações · Usuários e Motivos no Omni" },
      {
        name: "description",
        content:
          "Gerencie seu perfil, configurações de IA, equipe com acesso e motivos de perda do funil comercial.",
      },
      { property: "og:title", content: "Configurações do Omni" },
    ],
  }),
  component: Configuracoes,
});

const TABS = [
  { id: "perfil", label: "Meu Perfil & IA", Icon: User },
  { id: "usuarios", label: "Equipe & Usuários", Icon: Users },
  { id: "perdas", label: "Motivos de Perda", Icon: XCircle },
] as const;

function Configuracoes() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("perfil");

  /* --- Perfil State --- */
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [tokenUazapi, setTokenUazapi] = useState("");
  const [userPrompt, setUserPrompt] = useState("");

  /* --- Modal States --- */
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [formUserNome, setFormUserNome] = useState("");
  const [formUserEmail, setFormUserEmail] = useState("");
  const [formUserTelefone, setFormUserTelefone] = useState("");
  const [formUserCargo, setFormUserCargo] = useState<"admin" | "usuario">("usuario");
  const [formUserStatus, setFormUserStatus] = useState<"Ativado" | "Desativado">("Ativado");
  const [formUserToken, setFormUserToken] = useState("");

  const [isMotivoModalOpen, setIsMotivoModalOpen] = useState(false);
  const [editingMotivo, setEditingMotivo] = useState<any | null>(null);
  const [formMotivoNome, setFormMotivoNome] = useState("");
  const [formMotivoAtivo, setFormMotivoAtivo] = useState(true);

  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");

  /* --- Query 1: Fetch Current User Profile --- */
  const { data: currentDbUser, isLoading: loadingProfile } = useQuery({
    queryKey: ["current_db_user", user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      const { data, error } = await supabase
        .from("usuarios")
        .select("*")
        .eq("user_email", user.email)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        // Fallback para o primeiro usuário se a consulta por email retornar vazia
        const { data: first } = await supabase.from("usuarios").select("*").limit(1).maybeSingle();
        return first;
      }
      return data;
    },
    enabled: !!user,
  });

  /* Preenche formulário de perfil ao carregar dados */
  useEffect(() => {
    if (currentDbUser) {
      setNome(currentDbUser.user_nome || "");
      setTelefone(currentDbUser.user_telefone || "");
      setTokenUazapi(currentDbUser.token_uazapi || "");
      setUserPrompt(currentDbUser.user_prompt || "");
    }
  }, [currentDbUser]);

  /* --- Validação de Alterações Pendentes (Dirty Checks) --- */
  const isProfileDirty = useMemo(() => {
    if (!currentDbUser) return false;
    return (
      nome !== (currentDbUser.user_nome || "") ||
      telefone !== (currentDbUser.user_telefone || "") ||
      tokenUazapi !== (currentDbUser.token_uazapi || "")
    );
  }, [nome, telefone, tokenUazapi, currentDbUser]);

  const isPromptDirty = useMemo(() => {
    if (!currentDbUser) return false;
    return userPrompt !== (currentDbUser.user_prompt || "");
  }, [userPrompt, currentDbUser]);

  /* --- Query 2: Fetch All Users --- */
  const { data: usuariosList = [], isLoading: loadingUsuarios } = useQuery({
    queryKey: ["usuarios"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("usuarios")
        .select("*")
        .order("criado_em", { ascending: false });
      if (error) {
        toast.error("Erro ao carregar usuários: " + error.message);
        throw error;
      }
      return data;
    },
    enabled: !!user,
  });

  /* --- Query 3: Fetch Motivos de Perda --- */
  const { data: motivosList = [], isLoading: loadingMotivos } = useQuery({
    queryKey: ["motivos_perda"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("motivos_perda")
        .select("*")
        .order("criado_em", { ascending: false });
      if (error) {
        toast.error("Erro ao carregar motivos de perda: " + error.message);
        throw error;
      }
      return data;
    },
    enabled: !!user,
  });

  /* --- Mutation: Save Profile --- */
  const updateProfileMutation = useMutation({
    mutationFn: async (mode: "profile" | "prompt") => {
      if (!currentDbUser?.user_id) throw new Error("Usuário não encontrado no banco de dados.");
      
      const payload = mode === "profile" 
        ? { user_nome: nome, user_telefone: telefone, token_uazapi: tokenUazapi }
        : { user_prompt: userPrompt };

      const { error } = await supabase
        .from("usuarios")
        .update(payload)
        .eq("user_id", currentDbUser.user_id);
      if (error) throw error;
    },
    onSuccess: (_, mode) => {
      toast.success(mode === "profile" ? "Perfil atualizado com sucesso!" : "Prompt da IA atualizado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["current_db_user"] });
      queryClient.invalidateQueries({ queryKey: ["usuarios"] });
    },
    onError: (err: any) => {
      toast.error("Erro ao salvar: " + err.message);
    },
  });

  /* --- Mutation: Save User (Create/Edit) --- */
  const saveUserMutation = useMutation({
    mutationFn: async () => {
      if (editingUser) {
        const { error } = await supabase
          .from("usuarios")
          .update({
            user_nome: formUserNome,
            user_email: formUserEmail,
            user_telefone: formUserTelefone,
            user_cargo: formUserCargo,
            user_status: formUserStatus,
            token_uazapi: formUserToken,
          })
          .eq("user_id", editingUser.user_id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("usuarios").insert([
          {
            user_id: crypto.randomUUID(),
            user_nome: formUserNome,
            user_email: formUserEmail,
            user_telefone: formUserTelefone,
            user_cargo: formUserCargo,
            user_status: formUserStatus,
            token_uazapi: formUserToken,
          },
        ]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingUser ? "Usuário atualizado com sucesso!" : "Novo usuário cadastrado!");
      queryClient.invalidateQueries({ queryKey: ["usuarios"] });
      setIsUserModalOpen(false);
    },
    onError: (err: any) => {
      toast.error("Erro ao salvar usuário: " + err.message);
    },
  });

  /* --- Mutation: Delete User --- */
  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("usuarios").delete().eq("user_id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Usuário removido com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["usuarios"] });
    },
    onError: (err: any) => {
      toast.error("Erro ao excluir usuário: " + err.message);
    },
  });

  /* --- Mutation: Save Motivo de Perda (Create/Edit) --- */
  const saveMotivoMutation = useMutation({
    mutationFn: async () => {
      if (editingMotivo) {
        const { error } = await supabase
          .from("motivos_perda")
          .update({
            motivo_nome: formMotivoNome,
            motivo_ativo: formMotivoAtivo,
          })
          .eq("motivo_id", editingMotivo.motivo_id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("motivos_perda").insert([
          {
            motivo_nome: formMotivoNome,
            motivo_ativo: formMotivoAtivo,
          },
        ]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingMotivo ? "Motivo atualizado!" : "Novo motivo cadastrado!");
      queryClient.invalidateQueries({ queryKey: ["motivos_perda"] });
      setIsMotivoModalOpen(false);
    },
    onError: (err: any) => {
      toast.error("Erro ao salvar motivo: " + err.message);
    },
  });

  /* --- Mutation: Delete Motivo de Perda --- */
  const deleteMotivoMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("motivos_perda").delete().eq("motivo_id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Motivo de perda removido!");
      queryClient.invalidateQueries({ queryKey: ["motivos_perda"] });
    },
    onError: (err: any) => {
      toast.error("Erro ao excluir motivo: " + err.message);
    },
  });

  /* --- Mutation: Alterar Senha de Acesso --- */
  const changePasswordMutation = useMutation({
    mutationFn: async (pass: string) => {
      const { error } = await supabase.auth.updateUser({ password: pass });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Sua senha foi alterada com sucesso!");
      setNewPassword("");
      setIsPasswordModalOpen(false);
    },
    onError: (err: any) => {
      toast.error("Erro ao alterar senha: " + err.message);
    },
  });

  /* Handlers para abrir modais */
  const openUserModal = (u?: any) => {
    if (u) {
      setEditingUser(u);
      setFormUserNome(u.user_nome || "");
      setFormUserEmail(u.user_email || "");
      setFormUserTelefone(u.user_telefone || "");
      setFormUserCargo(u.user_cargo || "usuario");
      setFormUserStatus(u.user_status || "Ativado");
      setFormUserToken(u.token_uazapi || "");
    } else {
      setEditingUser(null);
      setFormUserNome("");
      setFormUserEmail("");
      setFormUserTelefone("");
      setFormUserCargo("usuario");
      setFormUserStatus("Ativado");
      setFormUserToken("");
    }
    setIsUserModalOpen(true);
  };

  const openMotivoModal = (m?: any) => {
    if (m) {
      setEditingMotivo(m);
      setFormMotivoNome(m.motivo_nome || "");
      setFormMotivoAtivo(m.motivo_ativo !== false);
    } else {
      setEditingMotivo(null);
      setFormMotivoNome("");
      setFormMotivoAtivo(true);
    }
    setIsMotivoModalOpen(true);
  };

  const getInitials = (n: string) =>
    n ? n.split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2) : "OM";

  return (
    <AppShell title="Configurações" subtitle="Gerenciamento da conta, equipe, robô de IA e parâmetros comerciais">
      <div className="w-full space-y-6">
        
        {/* Navegação por Abas */}
        <div className="flex gap-2 border-b border-border pb-1 overflow-x-auto scrollbar-none">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-2.5 rounded-xl px-4 py-2.5 text-sm font-bold transition-all duration-200 whitespace-nowrap",
                tab === t.id
                  ? "bg-gradient-to-r from-[#fba834] to-[#f7931e] text-[#0d0d26] shadow-md shadow-[#fba834]/20"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              <t.Icon className="size-4" /> {t.label}
            </button>
          ))}
        </div>

        {/* ══════ ABA 1: MEU PERFIL & IA ══════ */}
        {tab === "perfil" && (
          <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-12">
              
              {/* Card Resumo do Perfil */}
              <div className="lg:col-span-4 rounded-2xl border border-border bg-card/90 p-6 backdrop-blur-2xl shadow-xl flex flex-col items-center text-center justify-between">
                <div className="space-y-4 w-full flex flex-col items-center">
                  <div className="relative">
                    <span className="grid size-24 place-items-center rounded-3xl bg-gradient-to-br from-[#fba834] to-[#f7931e] text-3xl font-extrabold text-[#0d0d26] shadow-xl border-2 border-white/20">
                      {getInitials(nome || user?.email || "")}
                    </span>
                    <span className="absolute -bottom-1 -right-1 size-5 rounded-full border-2 border-card bg-emerald-500" />
                  </div>
                  <div>
                    <h3 className="text-xl font-extrabold text-foreground tracking-tight">
                      {nome || "Administrador Omni"}
                    </h3>
                    <p className="text-xs text-muted-foreground font-medium mt-0.5">{user?.email}</p>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/15 text-accent text-xs font-semibold mt-3">
                      <ShieldCheck className="size-3.5" />
                      {currentDbUser?.user_cargo === "admin" ? "Administrador Principal" : "Usuário da Plataforma"}
                    </span>
                  </div>
                </div>

                <div className="w-full pt-6 mt-6 border-t border-border space-y-2">
                  <button
                    onClick={() => setIsPasswordModalOpen(true)}
                    className="w-full flex items-center justify-center gap-2 rounded-xl border border-border bg-secondary/80 py-2.5 text-xs font-bold text-foreground transition-all hover:bg-secondary hover:border-accent/40"
                  >
                    <KeyRound className="size-4 text-accent" />
                    Alterar Senha de Acesso
                  </button>
                </div>
              </div>

              {/* Formulário de Dados e Integrações */}
              <div className="lg:col-span-8 rounded-2xl border border-border bg-card/90 p-6 backdrop-blur-2xl shadow-xl space-y-5">
                <div className="flex items-center justify-between border-b border-border pb-4 h-14">
                  <div>
                    <h3 className="text-lg font-extrabold text-foreground tracking-tight">
                      Informações Pessoais & Integrações
                    </h3>
                    <p className="text-xs text-muted-foreground font-medium">
                      Atualize seus dados de contato e chave Uazapi
                    </p>
                  </div>

                  {/* O Botão só aparece se houver alteração pendente (isProfileDirty) */}
                  {isProfileDirty ? (
                    <button
                      onClick={() => updateProfileMutation.mutate("profile")}
                      disabled={updateProfileMutation.isPending}
                      className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#fba834] to-[#f7931e] px-4 py-2.5 text-xs font-bold text-[#0d0d26] transition-all hover:brightness-110 shadow-md shadow-[#fba834]/20 animate-in fade-in-0 zoom-in-95 duration-150"
                    >
                      {updateProfileMutation.isPending ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Save className="size-4" />
                      )}
                      Salvar Alterações
                    </button>
                  ) : (
                    <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full">
                      <Check className="size-3.5" />
                      Sincronizado
                    </span>
                  )}
                </div>

                {loadingProfile ? (
                  <div className="py-12 text-center text-muted-foreground">
                    <Loader2 className="size-6 animate-spin mx-auto mb-2 text-accent" />
                    Carregando dados do perfil...
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                        <User className="size-3.5 text-accent" />
                        Nome Completo
                      </label>
                      <input
                        value={nome}
                        onChange={(e) => setNome(e.target.value)}
                        className="h-11 w-full rounded-xl border border-input bg-background px-3.5 text-sm text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                        placeholder="Seu nome completo"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                        <Mail className="size-3.5 text-accent" />
                        E-mail de Cadastro
                      </label>
                      <input
                        value={user?.email || ""}
                        disabled
                        className="h-11 w-full rounded-xl border border-input bg-muted/50 px-3.5 text-sm text-muted-foreground outline-none cursor-not-allowed"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                        <Phone className="size-3.5 text-accent" />
                        Telefone / WhatsApp
                      </label>
                      <input
                        value={telefone}
                        onChange={(e) => setTelefone(e.target.value)}
                        className="h-11 w-full rounded-xl border border-input bg-background px-3.5 text-sm text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                        placeholder="5511999999999"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                        <KeyRound className="size-3.5 text-accent" />
                        Token Uazapi (WhatsApp API)
                      </label>
                      <input
                        value={tokenUazapi}
                        onChange={(e) => setTokenUazapi(e.target.value)}
                        className="h-11 w-full rounded-xl border border-input bg-background px-3.5 text-sm text-foreground font-mono outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                        placeholder="Token de conexão Uazapi"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Painel do Prompt do Agente de IA */}
            <div className="rounded-2xl border border-border bg-card/90 p-6 backdrop-blur-2xl shadow-xl space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4 h-14">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-accent/15 text-accent border border-accent/20">
                    <Bot className="size-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-extrabold text-foreground tracking-tight">
                      Instruções do Agente de IA (System Prompt)
                    </h3>
                    <p className="text-xs text-muted-foreground font-medium">
                      Configure o comportamento, persona e regras que a IA utilizará para atender os leads automaticamente.
                    </p>
                  </div>
                </div>

                {/* O Botão só aparece se o prompt for alterado (isPromptDirty) */}
                {isPromptDirty ? (
                  <button
                    onClick={() => updateProfileMutation.mutate("prompt")}
                    disabled={updateProfileMutation.isPending}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#fba834] to-[#f7931e] px-4 py-2.5 text-xs font-bold text-[#0d0d26] transition-all hover:brightness-110 shadow-md shadow-[#fba834]/20 animate-in fade-in-0 zoom-in-95 duration-150"
                  >
                    {updateProfileMutation.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Save className="size-4" />
                    )}
                    Salvar Prompt da IA
                  </button>
                ) : (
                  <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full">
                    <Check className="size-3.5" />
                    Prompt Atualizado
                  </span>
                )}
              </div>

              <div className="space-y-2">
                <textarea
                  rows={10}
                  value={userPrompt}
                  onChange={(e) => setUserPrompt(e.target.value)}
                  placeholder="Escreva aqui o System Prompt completo do seu agente de IA..."
                  className="w-full rounded-xl border border-input bg-background p-4 text-xs font-mono text-foreground leading-relaxed outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 scrollbar-slim"
                />
              </div>
            </div>
          </div>
        )}

        {/* ══════ ABA 2: EQUIPE & USUÁRIOS ══════ */}
        {tab === "usuarios" && (
          <section className="overflow-hidden rounded-2xl border border-border bg-card/90 backdrop-blur-2xl shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
              <div>
                <h3 className="text-lg font-extrabold text-foreground tracking-tight">
                  Equipe & Usuários Cadastrados
                </h3>
                <p className="text-xs text-muted-foreground font-medium">
                  Gerencie os membros da equipe que possuem acesso ao painel.
                </p>
              </div>
              <button
                onClick={() => openUserModal()}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#fba834] to-[#f7931e] px-4 py-2.5 text-xs font-bold text-[#0d0d26] transition-all hover:brightness-110 shadow-md shadow-[#fba834]/20"
              >
                <Plus className="size-4" /> Adicionar Usuário
              </button>
            </div>

            {loadingUsuarios ? (
              <div className="py-12 text-center text-muted-foreground">
                <Loader2 className="size-6 animate-spin mx-auto mb-2 text-accent" />
                Carregando usuários...
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-secondary/60 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border">
                    <tr>
                      <th className="px-6 py-3.5">Usuário</th>
                      <th className="px-6 py-3.5">E-mail</th>
                      <th className="px-6 py-3.5">Telefone</th>
                      <th className="px-6 py-3.5">Cargo</th>
                      <th className="px-6 py-3.5">Status</th>
                      <th className="px-6 py-3.5 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40 font-medium">
                    {usuariosList.map((u: any) => (
                      <tr key={u.user_id} className="hover:bg-secondary/40 transition-colors">
                        <td className="px-6 py-4 flex items-center gap-3 font-bold text-foreground">
                          <span
                            className="grid size-9 place-items-center rounded-xl text-xs font-bold text-white shadow-sm"
                            style={{ backgroundColor: "#fba834" }}
                          >
                            {getInitials(u.user_nome)}
                          </span>
                          <span>{u.user_nome || "Sem Nome"}</span>
                        </td>
                        <td className="px-6 py-4 text-muted-foreground">{u.user_email}</td>
                        <td className="px-6 py-4 text-muted-foreground">{u.user_telefone || "-"}</td>
                        <td className="px-6 py-4">
                          <span className="rounded-lg bg-accent/15 px-2.5 py-1 text-xs font-bold text-accent">
                            {u.user_cargo === "admin" ? "Administrador" : "Usuário"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
                              u.user_status === "Ativado"
                                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                : "bg-red-500/15 text-red-500",
                            )}
                          >
                            <span className={cn("size-1.5 rounded-full", u.user_status === "Ativado" ? "bg-emerald-500" : "bg-red-500")} />
                            {u.user_status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-1.5">
                            <button
                              onClick={() => openUserModal(u)}
                              className="p-2 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                              title="Editar"
                            >
                              <Pencil className="size-4" />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`Deseja realmente remover o usuário ${u.user_nome}?`)) {
                                  deleteUserMutation.mutate(u.user_id);
                                }
                              }}
                              className="p-2 rounded-lg text-muted-foreground hover:bg-red-500/10 hover:text-red-500 transition-colors"
                              title="Excluir"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {usuariosList.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-6 py-10 text-center text-muted-foreground">
                          Nenhum usuário cadastrado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* ══════ ABA 3: MOTIVOS DE PERDA ══════ */}
        {tab === "perdas" && (
          <section className="overflow-hidden rounded-2xl border border-border bg-card/90 backdrop-blur-2xl shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
              <div>
                <h3 className="text-lg font-extrabold text-foreground tracking-tight">
                  Motivos de Perda no Funil Comercial
                </h3>
                <p className="text-xs text-muted-foreground font-medium">
                  Motivos selecionáveis no CRM ao desqualificar um negócio.
                </p>
              </div>
              <button
                onClick={() => openMotivoModal()}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#fba834] to-[#f7931e] px-4 py-2.5 text-xs font-bold text-[#0d0d26] transition-all hover:brightness-110 shadow-md shadow-[#fba834]/20"
              >
                <Plus className="size-4" /> Novo Motivo
              </button>
            </div>

            {loadingMotivos ? (
              <div className="py-12 text-center text-muted-foreground">
                <Loader2 className="size-6 animate-spin mx-auto mb-2 text-accent" />
                Carregando motivos...
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-secondary/60 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border">
                    <tr>
                      <th className="px-6 py-3.5">Nome do Motivo</th>
                      <th className="px-6 py-3.5">Status</th>
                      <th className="px-6 py-3.5">Data de Criação</th>
                      <th className="px-6 py-3.5 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40 font-medium">
                    {motivosList.map((m: any) => (
                      <tr key={m.motivo_id} className="hover:bg-secondary/40 transition-colors">
                        <td className="px-6 py-4 font-bold text-foreground">{m.motivo_nome}</td>
                        <td className="px-6 py-4">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
                              m.motivo_ativo
                                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                : "bg-muted text-muted-foreground",
                            )}
                          >
                            <span className={cn("size-1.5 rounded-full", m.motivo_ativo ? "bg-emerald-500" : "bg-muted-foreground")} />
                            {m.motivo_ativo ? "Ativo" : "Inativo"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-muted-foreground">
                          {m.criado_em ? new Date(m.criado_em).toLocaleDateString("pt-BR") : "-"}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-1.5">
                            <button
                              onClick={() => openMotivoModal(m)}
                              className="p-2 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                              title="Editar"
                            >
                              <Pencil className="size-4" />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`Deseja excluir o motivo "${m.motivo_nome}"?`)) {
                                  deleteMotivoMutation.mutate(m.motivo_id);
                                }
                              }}
                              className="p-2 rounded-lg text-muted-foreground hover:bg-red-500/10 hover:text-red-500 transition-colors"
                              title="Excluir"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {motivosList.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-6 py-10 text-center text-muted-foreground">
                          Nenhum motivo cadastrado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

      </div>

      {/* ══════ MODAL USUÁRIO ══════ */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in-0 duration-200">
          <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-base font-bold text-foreground">
                {editingUser ? "Editar Usuário" : "Adicionar Novo Usuário"}
              </h3>
              <button onClick={() => setIsUserModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="size-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Nome Completo</label>
                <input
                  value={formUserNome}
                  onChange={(e) => setFormUserNome(e.target.value)}
                  placeholder="Nome do usuário"
                  className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-accent"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">E-mail</label>
                <input
                  type="email"
                  value={formUserEmail}
                  onChange={(e) => setFormUserEmail(e.target.value)}
                  placeholder="email@omniautomacoes.com"
                  className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-accent"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Telefone</label>
                <input
                  value={formUserTelefone}
                  onChange={(e) => setFormUserTelefone(e.target.value)}
                  placeholder="5511999999999"
                  className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-accent"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Cargo</label>
                  <select
                    value={formUserCargo}
                    onChange={(e) => setFormUserCargo(e.target.value as any)}
                    className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-accent"
                  >
                    <option value="usuario">Usuário</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Status</label>
                  <select
                    value={formUserStatus}
                    onChange={(e) => setFormUserStatus(e.target.value as any)}
                    className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-accent"
                  >
                    <option value="Ativado">Ativado</option>
                    <option value="Desativado">Desativado</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-border">
              <button
                onClick={() => setIsUserModalOpen(false)}
                className="flex-1 rounded-xl border border-border py-2.5 text-xs font-bold text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                Cancelar
              </button>
              <button
                onClick={() => saveUserMutation.mutate()}
                disabled={saveUserMutation.isPending || !formUserNome || !formUserEmail}
                className="flex-1 rounded-xl bg-gradient-to-r from-[#fba834] to-[#f7931e] py-2.5 text-xs font-bold text-[#0d0d26] hover:brightness-110 disabled:opacity-50"
              >
                {saveUserMutation.isPending ? "Salvando..." : "Salvar Usuário"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════ MODAL MOTIVO DE PERDA ══════ */}
      {isMotivoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in-0 duration-200">
          <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-base font-bold text-foreground">
                {editingMotivo ? "Editar Motivo" : "Novo Motivo de Perda"}
              </h3>
              <button onClick={() => setIsMotivoModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="size-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Descrição do Motivo</label>
                <input
                  value={formMotivoNome}
                  onChange={(e) => setFormMotivoNome(e.target.value)}
                  placeholder="Ex: Preço acima do orçamento"
                  className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-accent"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="motivoAtivo"
                  checked={formMotivoAtivo}
                  onChange={(e) => setFormMotivoAtivo(e.target.checked)}
                  className="size-4 rounded border-input"
                />
                <label htmlFor="motivoAtivo" className="text-xs font-medium text-foreground cursor-pointer">
                  Motivo Ativo
                </label>
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-border">
              <button
                onClick={() => setIsMotivoModalOpen(false)}
                className="flex-1 rounded-xl border border-border py-2.5 text-xs font-bold text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                Cancelar
              </button>
              <button
                onClick={() => saveMotivoMutation.mutate()}
                disabled={saveMotivoMutation.isPending || !formMotivoNome.trim()}
                className="flex-1 rounded-xl bg-gradient-to-r from-[#fba834] to-[#f7931e] py-2.5 text-xs font-bold text-[#0d0d26] hover:brightness-110 disabled:opacity-50"
              >
                {saveMotivoMutation.isPending ? "Salvando..." : "Salvar Motivo"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════ MODAL ALTERAR SENHA ══════ */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in-0 duration-200">
          <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-base font-bold text-foreground">Alterar Senha de Acesso</h3>
              <button onClick={() => setIsPasswordModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="size-5" />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Digite a nova senha desejada para a sua conta.
              </p>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-accent"
              />
            </div>

            <div className="flex gap-2 pt-2 border-t border-border">
              <button
                onClick={() => setIsPasswordModalOpen(false)}
                className="flex-1 rounded-xl border border-border py-2.5 text-xs font-bold text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                Cancelar
              </button>
              <button
                onClick={() => changePasswordMutation.mutate(newPassword)}
                disabled={changePasswordMutation.isPending || newPassword.length < 6}
                className="flex-1 rounded-xl bg-gradient-to-r from-[#fba834] to-[#f7931e] py-2.5 text-xs font-bold text-[#0d0d26] hover:brightness-110 disabled:opacity-50"
              >
                {changePasswordMutation.isPending ? "Salvando..." : "Confirmar Senha"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
