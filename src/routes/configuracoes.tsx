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
  { id: "perfil", label: "Perfil e IA", Icon: User },
  { id: "usuarios", label: "Equipe", Icon: Users },
  { id: "perdas", label: "Motivos de perda", Icon: XCircle },
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

      const payload =
        mode === "profile"
          ? { user_nome: nome, user_telefone: telefone, token_uazapi: tokenUazapi }
          : { user_prompt: userPrompt };

      const { error } = await supabase
        .from("usuarios")
        .update(payload)
        .eq("user_id", currentDbUser.user_id);
      if (error) throw error;
    },
    onSuccess: (_, mode) => {
      toast.success(
        mode === "profile"
          ? "Perfil atualizado com sucesso!"
          : "Prompt da IA atualizado com sucesso!",
      );
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
    n
      ? n
          .split(" ")
          .map((p) => p[0])
          .join("")
          .toUpperCase()
          .slice(0, 2)
      : "OM";

  return (
    <AppShell
      title="Configurações"
      subtitle="Conta, equipe, agente de IA e parâmetros do funil comercial"
    >
      <div className="omni-stack-6 w-full">
        <div className="omni-tabs" role="tablist" aria-label="Seções de configuração">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className="omni-tab"
            >
              <t.Icon className="size-4" /> {t.label}
            </button>
          ))}
        </div>

        {/* ══════ Aba 1: perfil e IA ══════ */}
        {tab === "perfil" && (
          <div className="omni-stack-6">
            <div className="grid gap-6 lg:grid-cols-12">
              {/* Resumo do perfil */}
              <section className="omni-card flex flex-col lg:col-span-4">
                <div className="omni-card__body flex flex-1 flex-col items-center gap-4 text-center">
                  <span className="omni-avatar size-20 text-2xl" aria-hidden="true">
                    {getInitials(nome || user?.email || "")}
                  </span>
                  <div>
                    <h2 className="omni-h3">{nome || "Administrador Omni"}</h2>
                    <p className="omni-small mt-0.5">{user?.email}</p>
                    <span className="omni-badge omni-badge--brand mt-3">
                      <ShieldCheck />
                      {currentDbUser?.user_cargo === "admin"
                        ? "Administrador principal"
                        : "Usuário da plataforma"}
                    </span>
                  </div>
                </div>

                <div className="omni-card__footer justify-center">
                  <button
                    type="button"
                    onClick={() => setIsPasswordModalOpen(true)}
                    className="omni-btn omni-btn--secondary omni-btn--block"
                  >
                    <KeyRound /> Alterar senha de acesso
                  </button>
                </div>
              </section>

              {/* Dados e integrações */}
              <section className="omni-card lg:col-span-8">
                <div className="omni-card__header">
                  <div>
                    <h2 className="omni-h4">Dados pessoais e integrações</h2>
                    <p className="omni-small mt-0.5">
                      Contato do responsável e chave de conexão do WhatsApp
                    </p>
                  </div>

                  {isProfileDirty ? (
                    <button
                      type="button"
                      onClick={() => updateProfileMutation.mutate("profile")}
                      disabled={updateProfileMutation.isPending}
                      data-loading={updateProfileMutation.isPending ? "true" : undefined}
                      className="omni-btn omni-btn--primary omni-btn--sm"
                    >
                      <Save /> Salvar alterações
                    </button>
                  ) : (
                    <span className="omni-badge omni-badge--success">
                      <Check /> Tudo salvo
                    </span>
                  )}
                </div>

                <div className="omni-card__body">
                  {loadingProfile ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                      {[0, 1, 2, 3].map((i) => (
                        <div key={i} className="omni-skeleton h-control w-full" />
                      ))}
                    </div>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="omni-field">
                        <label className="omni-label" htmlFor="perfil-nome">
                          Nome completo
                        </label>
                        <div className="omni-input-group">
                          <User />
                          <input
                            id="perfil-nome"
                            value={nome}
                            onChange={(e) => setNome(e.target.value)}
                            className="omni-input"
                            placeholder="Seu nome completo"
                          />
                        </div>
                      </div>

                      <div className="omni-field">
                        <label className="omni-label" htmlFor="perfil-email">
                          E-mail de cadastro
                        </label>
                        <div className="omni-input-group">
                          <Mail />
                          <input
                            id="perfil-email"
                            value={user?.email || ""}
                            disabled
                            className="omni-input"
                          />
                        </div>
                        <p className="omni-hint">
                          O e-mail de login não muda por aqui. Fale com o administrador.
                        </p>
                      </div>

                      <div className="omni-field">
                        <label className="omni-label" htmlFor="perfil-telefone">
                          Telefone / WhatsApp
                        </label>
                        <div className="omni-input-group">
                          <Phone />
                          <input
                            id="perfil-telefone"
                            value={telefone}
                            onChange={(e) => setTelefone(e.target.value)}
                            className="omni-input num"
                            placeholder="5511999999999"
                          />
                        </div>
                      </div>

                      <div className="omni-field">
                        <label className="omni-label" htmlFor="perfil-token">
                          Token Uazapi
                        </label>
                        <div className="omni-input-group">
                          <KeyRound />
                          <input
                            id="perfil-token"
                            value={tokenUazapi}
                            onChange={(e) => setTokenUazapi(e.target.value)}
                            className="omni-input font-mono"
                            placeholder="Token de conexão do WhatsApp"
                          />
                        </div>
                        <p className="omni-hint">
                          É essa chave que conecta o painel à sua conta de WhatsApp.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            </div>

            {/* Prompt do agente de IA */}
            <section className="omni-card">
              <div className="omni-card__header">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-md bg-primary-soft text-primary-soft-fg">
                    <Bot className="size-5" />
                  </span>
                  <div>
                    <h2 className="omni-h4">Instruções do agente de IA</h2>
                    <p className="omni-small mt-0.5">
                      Comportamento, tom de voz e regras que a IA segue ao atender os leads.
                    </p>
                  </div>
                </div>

                {isPromptDirty ? (
                  <button
                    type="button"
                    onClick={() => updateProfileMutation.mutate("prompt")}
                    disabled={updateProfileMutation.isPending}
                    data-loading={updateProfileMutation.isPending ? "true" : undefined}
                    className="omni-btn omni-btn--primary omni-btn--sm"
                  >
                    <Save /> Salvar instruções
                  </button>
                ) : (
                  <span className="omni-badge omni-badge--success">
                    <Check /> Tudo salvo
                  </span>
                )}
              </div>

              <div className="omni-card__body">
                <div className="omni-field">
                  <label className="omni-label" htmlFor="perfil-prompt">
                    Instruções (system prompt)
                  </label>
                  <textarea
                    id="perfil-prompt"
                    rows={12}
                    value={userPrompt}
                    onChange={(e) => setUserPrompt(e.target.value)}
                    placeholder="Descreva como a IA deve se apresentar, o que pode prometer e quando passar o atendimento para uma pessoa."
                    className="omni-textarea font-mono text-sm scrollbar-slim"
                  />
                  <p className="omni-hint">
                    Mudanças só valem para as próximas conversas — as em andamento seguem com as
                    instruções antigas.
                  </p>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* ══════ Aba 2: equipe ══════ */}
        {tab === "usuarios" && (
          <section className="omni-table-wrap">
            <div className="omni-card__header">
              <div>
                <h2 className="omni-h4">Equipe com acesso ao painel</h2>
                <p className="omni-small mt-0.5">
                  Quem pode entrar no Omni e com qual nível de permissão
                </p>
              </div>
              <button
                type="button"
                onClick={() => openUserModal()}
                className="omni-btn omni-btn--primary omni-btn--sm"
              >
                <Plus /> Adicionar usuário
              </button>
            </div>

            <div className="omni-table-scroll">
              <table className="omni-table">
                <thead>
                  <tr>
                    <th>Usuário</th>
                    <th>E-mail</th>
                    <th>Telefone</th>
                    <th>Cargo</th>
                    <th>Situação</th>
                    <th className="omni-th-num">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingUsuarios ? (
                    [0, 1, 2, 3].map((i) => (
                      <tr key={i}>
                        <td colSpan={6} className="p-0">
                          <div className="omni-skeleton h-row w-full rounded-none" />
                        </td>
                      </tr>
                    ))
                  ) : usuariosList.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-0">
                        <div className="omni-empty">
                          <span className="omni-empty__art">
                            <Users />
                          </span>
                          <h4>Nenhum usuário cadastrado</h4>
                          <p>
                            Adicione as pessoas da equipe que precisam entrar no painel para
                            trabalhar.
                          </p>
                          <button
                            type="button"
                            onClick={() => openUserModal()}
                            className="omni-btn omni-btn--secondary omni-btn--sm"
                          >
                            <Plus /> Adicionar usuário
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    usuariosList.map((u: any) => (
                      <tr key={u.user_id}>
                        <td>
                          <div className="omni-user">
                            <span className="omni-avatar" aria-hidden="true">
                              {getInitials(u.user_nome)}
                            </span>
                            <span className="omni-user__name truncate">
                              {u.user_nome || "Sem nome"}
                            </span>
                          </div>
                        </td>
                        <td className="text-ink-2">{u.user_email}</td>
                        <td className="num text-ink-2">{u.user_telefone || "—"}</td>
                        <td>
                          <span
                            className={cn(
                              "omni-badge",
                              u.user_cargo === "admin"
                                ? "omni-badge--brand"
                                : "omni-badge--outline",
                            )}
                          >
                            {u.user_cargo === "admin" ? "Administrador" : "Usuário"}
                          </span>
                        </td>
                        <td>
                          <span
                            className={cn(
                              "omni-badge",
                              u.user_status === "Ativado"
                                ? "omni-badge--success"
                                : "omni-badge--danger",
                            )}
                          >
                            {u.user_status}
                          </span>
                        </td>
                        <td className="omni-td-actions">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openUserModal(u)}
                              className="omni-btn omni-btn--ghost omni-btn--icon omni-btn--sm"
                              title={`Editar ${u.user_nome || "usuário"}`}
                            >
                              <Pencil />
                              <span className="omni-sr">Editar {u.user_nome || "usuário"}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm(`Deseja realmente remover o usuário ${u.user_nome}?`)) {
                                  deleteUserMutation.mutate(u.user_id);
                                }
                              }}
                              className="omni-btn omni-btn--ghost omni-btn--icon omni-btn--sm text-danger hover:bg-danger-soft"
                              title={`Excluir ${u.user_nome || "usuário"}`}
                            >
                              <Trash2 />
                              <span className="omni-sr">Excluir {u.user_nome || "usuário"}</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="omni-table__foot">
              <span>
                {usuariosList.length} {usuariosList.length === 1 ? "usuário" : "usuários"} com
                acesso
              </span>
            </div>
          </section>
        )}

        {/* ══════ Aba 3: motivos de perda ══════ */}
        {tab === "perdas" && (
          <section className="omni-table-wrap">
            <div className="omni-card__header">
              <div>
                <h2 className="omni-h4">Motivos de perda</h2>
                <p className="omni-small mt-0.5">
                  Opções que aparecem ao marcar um negócio como perdido no funil
                </p>
              </div>
              <button
                type="button"
                onClick={() => openMotivoModal()}
                className="omni-btn omni-btn--primary omni-btn--sm"
              >
                <Plus /> Novo motivo
              </button>
            </div>

            <div className="omni-table-scroll">
              <table className="omni-table">
                <thead>
                  <tr>
                    <th>Motivo</th>
                    <th>Situação</th>
                    <th className="omni-th-num">Criado em</th>
                    <th className="omni-th-num">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingMotivos ? (
                    [0, 1, 2, 3].map((i) => (
                      <tr key={i}>
                        <td colSpan={4} className="p-0">
                          <div className="omni-skeleton h-row w-full rounded-none" />
                        </td>
                      </tr>
                    ))
                  ) : motivosList.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-0">
                        <div className="omni-empty">
                          <span className="omni-empty__art">
                            <XCircle />
                          </span>
                          <h4>Nenhum motivo cadastrado</h4>
                          <p>
                            Cadastre os motivos mais comuns para o relatório de gargalos apontar
                            onde as vendas estão parando.
                          </p>
                          <button
                            type="button"
                            onClick={() => openMotivoModal()}
                            className="omni-btn omni-btn--secondary omni-btn--sm"
                          >
                            <Plus /> Novo motivo
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    motivosList.map((m: any) => (
                      <tr key={m.motivo_id}>
                        <td className="omni-td-strong">{m.motivo_nome}</td>
                        <td>
                          <span
                            className={cn(
                              "omni-badge",
                              m.motivo_ativo ? "omni-badge--success" : "omni-badge--outline",
                            )}
                          >
                            {m.motivo_ativo ? "Ativo" : "Inativo"}
                          </span>
                        </td>
                        <td className="omni-td-num">
                          {m.criado_em ? new Date(m.criado_em).toLocaleDateString("pt-BR") : "—"}
                        </td>
                        <td className="omni-td-actions">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openMotivoModal(m)}
                              className="omni-btn omni-btn--ghost omni-btn--icon omni-btn--sm"
                              title={`Editar ${m.motivo_nome}`}
                            >
                              <Pencil />
                              <span className="omni-sr">Editar {m.motivo_nome}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm(`Deseja excluir o motivo "${m.motivo_nome}"?`)) {
                                  deleteMotivoMutation.mutate(m.motivo_id);
                                }
                              }}
                              className="omni-btn omni-btn--ghost omni-btn--icon omni-btn--sm text-danger hover:bg-danger-soft"
                              title={`Excluir ${m.motivo_nome}`}
                            >
                              <Trash2 />
                              <span className="omni-sr">Excluir {m.motivo_nome}</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="omni-table__foot">
              <span>
                {motivosList.length} {motivosList.length === 1 ? "motivo" : "motivos"} cadastrados
              </span>
            </div>
          </section>
        )}
      </div>

      {/* ══════ Modal: usuário ══════ */}
      {isUserModalOpen && (
        <div
          className="omni-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-modal-usuario"
        >
          <div className="omni-modal w-full max-w-[520px]">
            <div className="omni-modal__header">
              <div>
                <h2 id="titulo-modal-usuario" className="omni-h4">
                  {editingUser ? "Editar usuário" : "Adicionar usuário"}
                </h2>
                <p className="omni-small mt-1">Dados de acesso e permissão no painel</p>
              </div>
              <button
                type="button"
                onClick={() => setIsUserModalOpen(false)}
                className="omni-btn omni-btn--ghost omni-btn--icon omni-btn--sm"
              >
                <X />
                <span className="omni-sr">Fechar</span>
              </button>
            </div>

            <div className="omni-modal__body omni-stack">
              <div className="omni-field">
                <label className="omni-label" htmlFor="usuario-nome">
                  Nome completo <span className="omni-req">*</span>
                </label>
                <input
                  id="usuario-nome"
                  value={formUserNome}
                  onChange={(e) => setFormUserNome(e.target.value)}
                  placeholder="Nome de quem vai usar o painel"
                  className="omni-input"
                />
              </div>

              <div className="omni-field">
                <label className="omni-label" htmlFor="usuario-email">
                  E-mail <span className="omni-req">*</span>
                </label>
                <input
                  id="usuario-email"
                  type="email"
                  value={formUserEmail}
                  onChange={(e) => setFormUserEmail(e.target.value)}
                  placeholder="email@omniautomacoes.com"
                  className="omni-input"
                />
                <p className="omni-hint">É por este e-mail que a pessoa faz login.</p>
              </div>

              <div className="omni-field">
                <label className="omni-label" htmlFor="usuario-telefone">
                  Telefone
                </label>
                <input
                  id="usuario-telefone"
                  value={formUserTelefone}
                  onChange={(e) => setFormUserTelefone(e.target.value)}
                  placeholder="5511999999999"
                  className="omni-input num"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="omni-field">
                  <label className="omni-label" htmlFor="usuario-cargo">
                    Cargo
                  </label>
                  <select
                    id="usuario-cargo"
                    value={formUserCargo}
                    onChange={(e) => setFormUserCargo(e.target.value as any)}
                    className="omni-select"
                  >
                    <option value="usuario">Usuário</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>

                <div className="omni-field">
                  <label className="omni-label" htmlFor="usuario-status">
                    Situação
                  </label>
                  <select
                    id="usuario-status"
                    value={formUserStatus}
                    onChange={(e) => setFormUserStatus(e.target.value as any)}
                    className="omni-select"
                  >
                    <option value="Ativado">Ativado</option>
                    <option value="Desativado">Desativado</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="omni-modal__footer">
              <button
                type="button"
                onClick={() => setIsUserModalOpen(false)}
                className="omni-btn omni-btn--ghost"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => saveUserMutation.mutate()}
                disabled={saveUserMutation.isPending || !formUserNome || !formUserEmail}
                data-loading={saveUserMutation.isPending ? "true" : undefined}
                className="omni-btn omni-btn--primary"
              >
                {editingUser ? "Salvar alterações" : "Cadastrar usuário"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════ Modal: motivo de perda ══════ */}
      {isMotivoModalOpen && (
        <div
          className="omni-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-modal-motivo"
        >
          <div className="omni-modal w-full max-w-[440px]">
            <div className="omni-modal__header">
              <div>
                <h2 id="titulo-modal-motivo" className="omni-h4">
                  {editingMotivo ? "Editar motivo" : "Novo motivo de perda"}
                </h2>
                <p className="omni-small mt-1">Aparece na lista ao registrar uma perda</p>
              </div>
              <button
                type="button"
                onClick={() => setIsMotivoModalOpen(false)}
                className="omni-btn omni-btn--ghost omni-btn--icon omni-btn--sm"
              >
                <X />
                <span className="omni-sr">Fechar</span>
              </button>
            </div>

            <div className="omni-modal__body omni-stack">
              <div className="omni-field">
                <label className="omni-label" htmlFor="motivo-nome">
                  Descrição do motivo <span className="omni-req">*</span>
                </label>
                <input
                  id="motivo-nome"
                  value={formMotivoNome}
                  onChange={(e) => setFormMotivoNome(e.target.value)}
                  placeholder="Ex.: preço acima do orçamento do cliente"
                  className="omni-input"
                />
              </div>

              <label className="omni-check">
                <input
                  type="checkbox"
                  id="motivoAtivo"
                  checked={formMotivoAtivo}
                  onChange={(e) => setFormMotivoAtivo(e.target.checked)}
                />
                <span>Disponível para seleção no funil</span>
              </label>
            </div>

            <div className="omni-modal__footer">
              <button
                type="button"
                onClick={() => setIsMotivoModalOpen(false)}
                className="omni-btn omni-btn--ghost"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => saveMotivoMutation.mutate()}
                disabled={saveMotivoMutation.isPending || !formMotivoNome.trim()}
                data-loading={saveMotivoMutation.isPending ? "true" : undefined}
                className="omni-btn omni-btn--primary"
              >
                {editingMotivo ? "Salvar alterações" : "Cadastrar motivo"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════ Modal: alterar senha ══════ */}
      {isPasswordModalOpen && (
        <div
          className="omni-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-modal-senha"
        >
          <div className="omni-modal w-full max-w-[440px]">
            <div className="omni-modal__header">
              <div>
                <h2 id="titulo-modal-senha" className="omni-h4">
                  Alterar senha de acesso
                </h2>
                <p className="omni-small mt-1">A troca vale a partir do próximo login</p>
              </div>
              <button
                type="button"
                onClick={() => setIsPasswordModalOpen(false)}
                className="omni-btn omni-btn--ghost omni-btn--icon omni-btn--sm"
              >
                <X />
                <span className="omni-sr">Fechar</span>
              </button>
            </div>

            <div className="omni-modal__body">
              <div className="omni-field">
                <label className="omni-label" htmlFor="nova-senha">
                  Nova senha <span className="omni-req">*</span>
                </label>
                <input
                  id="nova-senha"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Pelo menos 6 caracteres"
                  aria-invalid={newPassword.length > 0 && newPassword.length < 6 ? true : undefined}
                  className="omni-input"
                />
                {newPassword.length > 0 && newPassword.length < 6 ? (
                  <p className="omni-error">
                    Faltam {6 - newPassword.length} caracteres para atingir o mínimo de 6.
                  </p>
                ) : (
                  <p className="omni-hint">Use pelo menos 6 caracteres.</p>
                )}
              </div>
            </div>

            <div className="omni-modal__footer">
              <button
                type="button"
                onClick={() => setIsPasswordModalOpen(false)}
                className="omni-btn omni-btn--ghost"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => changePasswordMutation.mutate(newPassword)}
                disabled={changePasswordMutation.isPending || newPassword.length < 6}
                data-loading={changePasswordMutation.isPending ? "true" : undefined}
                className="omni-btn omni-btn--primary"
              >
                Alterar senha
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
