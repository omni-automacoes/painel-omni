import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";
import {
  ArrowLeft,
  Phone,
  Mail,
  Calendar,
  DollarSign,
  Tag,
  CheckCircle2,
  XCircle,
  User,
  MessageSquare,
  Clock,
  ExternalLink,
  Edit3,
  Loader2,
  Building2,
  FileText,
  Sparkles,
  X,
  UserCheck,
  RefreshCw,
  SlidersHorizontal,
  Bot,
  StickyNote,
  Trash2,
  Plus,
  CheckSquare,
  Square,
  AlertTriangle,
  CalendarDays,
  ListTodo,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/lead/$leadId")({
  head: () => ({
    meta: [
      { title: "Detalhes do Lead · Omni Automações" },
      { name: "description", content: "Página de detalhes, histórico e gestão comercial do lead." },
    ],
  }),
  component: LeadDetailPage,
});

/* ─── Types ─── */
type UtmData = {
  ad_id?: string | null;
  ad_title?: string | null;
  source_app?: string | null;
  entry_point?: string | null;
  [key: string]: any;
};

type Lead = {
  idx?: number;
  lead_id: string;
  criado_em: string;
  lead_nome: string | null;
  lead_telefone: string | null;
  lead_email: string | null;
  lead_origem: string | null;
  user_id?: string | null;
  lead_status: "Aberto" | "Ganho" | "Perdido" | string | null;
  lead_etapa_funil: string | null;
  ativo_ia?: boolean | null;
  utm_data?: string | UtmData | null;
  lead_valor?: number | string | null;
  motivo_perda_id?: string | null;
};

type MotivoPerda = {
  motivo_id: string;
  motivo_nome: string;
  motivo_ativo: boolean;
};

type Mensagem = {
  mensagem_id: string;
  lead_id: string;
  user_id?: string | null;
  mensagem_origem: "Cliente" | "IA" | "Humano" | string;
  mensagem_conteudo: string;
  criado_em: string;
  mensagem_id_provedor?: string | null;
};

type Anotacao = {
  anotacao_id: string;
  lead_id: string;
  user_id?: string | null;
  autor_nome?: string | null;
  conteudo: string;
  criado_em: string;
  atualizado_em?: string | null;
};

type Tarefa = {
  tarefa_id: string;
  lead_id: string;
  cliente_id?: string | null;
  user_id?: string | null;
  titulo: string;
  descricao?: string | null;
  responsavel?: string | null;
  data_vencimento?: string | null;
  hora_vencimento?: string | null;
  prioridade: "baixa" | "media" | "alta" | "urgente";
  status: "pendente" | "em_andamento" | "concluida" | "cancelada";
  criado_em: string;
};

/* ─── Etapas Reais do Banco de Dados (Enum Postgres) ─── */
export const ETAPAS_FUNIL_REAL = [
  "Novo Lead",
  "Tentando Contato",
  "Contato Realizado",
  "Lead Qualificado",
  "Reunião Agendada",
  "Reunião Realizada",
  "Orçamento Enviado",
  "Venda Realizada",
] as const;

function parseUtmData(raw: string | UtmData | null | undefined): UtmData | null {
  if (!raw) return null;
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function parseNumberValue(val: number | string | null | undefined): number {
  if (val === null || val === undefined || val === "") return 0;
  if (typeof val === "number") return val;
  const cleaned = String(val).replace(/[^\d.,-]/g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function formatCurrency(val: number | string | null | undefined): string {
  const num = parseNumberValue(val);
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num);
}

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return dateStr;
  }
}

function formatDateOnly(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  try {
    const parts = dateStr.split("-");
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  } catch {}
  return dateStr;
}

function getInitials(name: string | null | undefined): string {
  if (!name || !name.trim()) return "LD";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function LeadDetailPage() {
  const { leadId } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  /* Tab state */
  const [activeTab, setActiveTab] = useState<"atendimento" | "tarefas" | "anotacoes">("atendimento");

  const [isLossModalOpen, setIsLossModalOpen] = useState(false);
  const [editingValor, setEditingValor] = useState(false);
  const [valorInput, setValorInput] = useState("");
  const [anotacaoTexto, setAnotacaoTexto] = useState("");
  
  /* State para nova tarefa */
  const [tarefaTitulo, setTarefaTitulo] = useState("");
  const [tarefaVencimento, setTarefaVencimento] = useState(new Date().toISOString().split("T")[0]);
  const [tarefaPrioridade, setTarefaPrioridade] = useState<Tarefa["prioridade"]>("media");
  const [showNewTaskForm, setShowNewTaskForm] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  /* Fetch lead */
  const {
    data: lead,
    isLoading: isLeadLoading,
    isError: isLeadError,
    error: leadError,
  } = useQuery<Lead | null>({
    queryKey: ["lead", leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .eq("lead_id", leadId)
        .single();

      if (error) {
        toast.error("Erro ao buscar dados do lead: " + error.message);
        throw error;
      }
      return data as Lead;
    },
    enabled: !!user && !!leadId,
  });

  /* Fetch motivos_perda */
  const { data: motivosPerda = [] } = useQuery<MotivoPerda[]>({
    queryKey: ["motivos_perda"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("motivos_perda")
        .select("*")
        .order("motivo_nome", { ascending: true });
      if (error) return [];
      return (data as MotivoPerda[]) || [];
    },
    enabled: !!user,
  });

  /* Fetch mensagens */
  const { data: mensagens = [] } = useQuery<Mensagem[]>({
    queryKey: ["mensagens", leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mensagens")
        .select("*")
        .eq("lead_id", leadId)
        .order("criado_em", { ascending: true });
      if (error) {
        console.error("Erro ao buscar mensagens:", error);
        return [];
      }
      return (data as Mensagem[]) || [];
    },
    enabled: !!user && !!leadId,
    refetchInterval: 5000,
  });

  /* Fetch anotações */
  const { data: anotacoes = [] } = useQuery<Anotacao[]>({
    queryKey: ["anotacoes", leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_anotacoes")
        .select("*")
        .eq("lead_id", leadId)
        .order("criado_em", { ascending: false });
      if (error) {
        console.error("Erro ao buscar anotações:", error);
        return [];
      }
      return (data as Anotacao[]) || [];
    },
    enabled: !!user && !!leadId,
  });

  /* Fetch tarefas */
  const { data: tarefas = [] } = useQuery<Tarefa[]>({
    queryKey: ["tarefas_lead", leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tarefas")
        .select("*")
        .eq("lead_id", leadId)
        .order("criado_em", { ascending: false });
      if (error) {
        console.error("Erro ao buscar tarefas:", error);
        return [];
      }
      return (data as Tarefa[]) || [];
    },
    enabled: !!user && !!leadId,
  });

  /* Scroll automático para a última mensagem */
  useEffect(() => {
    if (activeTab === "atendimento" && mensagens.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [mensagens.length, activeTab]);

  /* Fetch cliente vinculado */
  const { data: clienteVinculado } = useQuery({
    queryKey: ["cliente_lead", leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("*")
        .eq("lead_id", leadId)
        .maybeSingle();
      if (error) return null;
      return data;
    },
    enabled: !!user && !!leadId && lead?.lead_status === "Ganho",
  });

  /* Update lead mutation */
  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<Lead>) => {
      const { error } = await supabase
        .from("leads")
        .update(updates)
        .eq("lead_id", leadId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      if (variables.lead_status === "Ganho") {
        toast.success("🏆 Lead Ganho! Cliente cadastrado automaticamente.");
      } else if (variables.lead_status === "Perdido") {
        toast.success("Negócio marcado como Perdido.");
      } else {
        toast.success("Lead atualizado com sucesso!");
      }
      queryClient.invalidateQueries({ queryKey: ["lead", leadId] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
    },
    onError: (err: Error) => {
      toast.error("Erro ao atualizar: " + err.message);
    },
  });

  /* Add Anotação Mutation */
  const addAnotacaoMutation = useMutation({
    mutationFn: async (conteudo: string) => {
      const { error } = await supabase.from("lead_anotacoes").insert([
        {
          lead_id: leadId,
          user_id: user?.id || null,
          autor_nome: user?.email ? user.email.split("@")[0] : "Omni Automações",
          conteudo: conteudo.trim(),
        },
      ]);
      if (error) throw error;
    },
    onSuccess: () => {
      setAnotacaoTexto("");
      queryClient.invalidateQueries({ queryKey: ["anotacoes", leadId] });
      toast.success("Anotação adicionada com sucesso!");
    },
    onError: (err: Error) => {
      toast.error("Erro ao salvar anotação: " + err.message);
    },
  });

  /* Delete Anotação Mutation */
  const deleteAnotacaoMutation = useMutation({
    mutationFn: async (anotacaoId: string) => {
      const { error } = await supabase
        .from("lead_anotacoes")
        .delete()
        .eq("anotacao_id", anotacaoId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["anotacoes", leadId] });
      toast.success("Anotação excluída!");
    },
    onError: (err: Error) => {
      toast.error("Erro ao excluir anotação: " + err.message);
    },
  });

  /* Add Tarefa Mutation */
  const addTarefaMutation = useMutation({
    mutationFn: async (payload: { titulo: string; data_vencimento: string; prioridade: Tarefa["prioridade"] }) => {
      const { error } = await supabase.from("tarefas").insert([
        {
          lead_id: leadId,
          user_id: user?.id || null,
          titulo: payload.titulo.trim(),
          data_vencimento: payload.data_vencimento || null,
          prioridade: payload.prioridade,
          status: "pendente",
        },
      ]);
      if (error) throw error;
    },
    onSuccess: () => {
      setTarefaTitulo("");
      setShowNewTaskForm(false);
      queryClient.invalidateQueries({ queryKey: ["tarefas_lead", leadId] });
      queryClient.invalidateQueries({ queryKey: ["tarefas"] });
      toast.success("Tarefa criada com sucesso!");
    },
    onError: (err: Error) => {
      toast.error("Erro ao criar tarefa: " + err.message);
    },
  });

  /* Toggle Tarefa Status Mutation */
  const toggleTarefaStatusMutation = useMutation({
    mutationFn: async (tarefa: Tarefa) => {
      const nextStatus = tarefa.status === "concluida" ? "pendente" : "concluida";
      const { error } = await supabase
        .from("tarefas")
        .update({ status: nextStatus })
        .eq("tarefa_id", tarefa.tarefa_id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tarefas_lead", leadId] });
      queryClient.invalidateQueries({ queryKey: ["tarefas"] });
    },
    onError: (err: any) => {
      toast.error("Erro ao atualizar status: " + err.message);
    },
  });

  /* Delete Tarefa Mutation */
  const deleteTarefaMutation = useMutation({
    mutationFn: async (tarefaId: string) => {
      const { error } = await supabase
        .from("tarefas")
        .delete()
        .eq("tarefa_id", tarefaId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tarefas_lead", leadId] });
      queryClient.invalidateQueries({ queryKey: ["tarefas"] });
      toast.success("Tarefa excluída!");
    },
    onError: (err: Error) => {
      toast.error("Erro ao excluir tarefa: " + err.message);
    },
  });

  if (isLeadLoading) {
    return (
      <AppShell title="Carregando Lead..." subtitle="Aguarde um instante">
        <div className="flex h-96 items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="size-8 animate-spin text-accent" />
            <p className="text-sm font-medium">Buscando informações do lead...</p>
          </div>
        </div>
      </AppShell>
    );
  }

  if (isLeadError || !lead) {
    return (
      <AppShell title="Lead Não Encontrado" subtitle="Negócio não localizado">
        <div className="flex h-96 items-center justify-center p-6">
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center max-w-md">
            <XCircle className="mx-auto size-12 text-destructive" />
            <h2 className="mt-3 text-lg font-bold text-foreground">Lead não encontrado</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {(leadError as Error)?.message || "O registro do lead não foi localizado no banco."}
            </p>
            <button
              onClick={() => navigate({ to: "/negocios" })}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:brightness-110"
            >
              <ArrowLeft className="size-4" /> Voltar para Negócios
            </button>
          </div>
        </div>
      </AppShell>
    );
  }

  const utm = parseUtmData(lead.utm_data);
  const displayName = lead.lead_nome || lead.lead_telefone || "Sem nome";
  const motivoObj = lead.motivo_perda_id
    ? motivosPerda.find((m) => m.motivo_id === lead.motivo_perda_id)
    : null;

  const handleStageChange = (newStage: string) => {
    if (newStage === "Venda Realizada") {
      updateMutation.mutate({
        lead_etapa_funil: "Venda Realizada",
        lead_status: "Ganho",
        motivo_perda_id: null,
      });
    } else {
      updateMutation.mutate({
        lead_etapa_funil: newStage,
        lead_status: lead.lead_status === "Perdido" ? "Aberto" : lead.lead_status,
      });
    }
  };

  const handleStatusChange = (newStatus: "Aberto" | "Ganho" | "Perdido") => {
    if (newStatus === "Perdido") {
      setIsLossModalOpen(true);
      return;
    }
    if (newStatus === "Ganho") {
      updateMutation.mutate({
        lead_status: "Ganho",
        lead_etapa_funil: "Venda Realizada",
        motivo_perda_id: null,
      });
      return;
    }
    updateMutation.mutate({
      lead_status: "Aberto",
      motivo_perda_id: null,
    });
  };

  const handleSaveValor = () => {
    const num = parseNumberValue(valorInput);
    updateMutation.mutate({ lead_valor: num });
    setEditingValor(false);
  };

  const cleanPhone = lead.lead_telefone ? lead.lead_telefone.replace(/\D/g, "") : "";
  const whatsappUrl = cleanPhone ? `https://wa.me/${cleanPhone}` : null;

  const prioridadeMap = {
    urgente: { label: "Urgente", cls: "text-red-400 bg-red-500/15 border-red-500/30" },
    alta: { label: "Alta", cls: "text-amber-400 bg-amber-500/15 border-amber-500/30" },
    media: { label: "Média", cls: "text-blue-400 bg-blue-500/15 border-blue-500/30" },
    baixa: { label: "Baixa", cls: "text-slate-400 bg-slate-500/15 border-slate-500/30" },
  };

  const tarefasPendentesCount = tarefas.filter((t) => t.status === "pendente").length;

  return (
    <AppShell
      title={`Lead: ${displayName}`}
      subtitle={`Gestão comercial · Criado em ${formatDateTime(lead.criado_em)}`}
      actions={
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate({ to: "/negocios" })}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-secondary/80 px-3.5 py-2 text-xs font-bold text-foreground hover:bg-secondary transition-all"
          >
            <ArrowLeft className="size-4" /> Voltar ao Funil
          </button>
          {whatsappUrl && (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-md shadow-emerald-500/20 transition-all"
            >
              <MessageSquare className="size-4" /> WhatsApp
            </a>
          )}
        </div>
      }
    >
      <div className="w-full space-y-6 pb-12">
        {/* ══════ 1. BANNER PRINCIPAL DO LEAD ══════ */}
        <section className="rounded-2xl border border-border bg-card/90 p-6 backdrop-blur-2xl shadow-xl">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-[#fba834] to-[#f7931e] text-xl font-extrabold text-[#0d0d26] shadow-lg shadow-[#fba834]/20">
                {getInitials(lead.lead_nome)}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-2xl font-extrabold text-foreground">{displayName}</h1>
                  {lead.lead_status === "Ganho" && (
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1 text-xs font-extrabold text-emerald-400">
                      <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <CheckCircle2 className="size-3.5" /> Ganho (Cliente Ativo)
                    </span>
                  )}
                  {lead.lead_status === "Perdido" && (
                    <span className="inline-flex items-center gap-1 rounded-lg border border-red-500/40 bg-red-500/15 px-2.5 py-1 text-xs font-extrabold text-red-400">
                      <XCircle className="size-3.5" /> Perdido {motivoObj ? `(${motivoObj.motivo_nome})` : ""}
                    </span>
                  )}
                  {lead.lead_status === "Aberto" && (
                    <span className="inline-flex items-center gap-1 rounded-lg border border-accent/40 bg-accent/15 px-2.5 py-1 text-xs font-extrabold text-accent">
                      <Clock className="size-3.5" /> Em Negociação
                    </span>
                  )}
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                  {lead.lead_telefone && (
                    <span className="flex items-center gap-1.5 font-medium text-foreground">
                      <Phone className="size-3.5 text-accent" /> {lead.lead_telefone}
                    </span>
                  )}
                  {lead.lead_email && (
                    <span className="flex items-center gap-1.5 font-medium text-foreground">
                      <Mail className="size-3.5 text-accent" /> {lead.lead_email}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Calendar className="size-3.5 text-muted-foreground" /> Criado em {formatDateTime(lead.criado_em)}
                  </span>
                </div>
              </div>
            </div>

            <div className="text-right bg-secondary/40 border border-border/60 rounded-xl p-3.5 min-w-[200px]">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Valor da Oportunidade
              </p>
              {editingValor ? (
                <div className="mt-1 flex items-center justify-end gap-1.5">
                  <input
                    value={valorInput}
                    onChange={(e) => setValorInput(e.target.value)}
                    placeholder="0,00"
                    className="w-28 rounded-lg border border-accent bg-background px-2 py-1 text-xs font-bold text-foreground outline-none text-right"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleSaveValor}
                    className="rounded-lg bg-accent px-2 py-1 text-xs font-bold text-[#0d0d26]"
                  >
                    Salvar
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingValor(false)}
                    className="p-1 text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-end gap-2 mt-0.5">
                  <p className="text-2xl font-black text-accent">
                    {formatCurrency(lead.lead_valor)}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setValorInput(lead.lead_valor ? String(lead.lead_valor) : "");
                      setEditingValor(true);
                    }}
                    className="p-1 text-muted-foreground hover:text-accent transition-colors"
                    title="Editar valor"
                  >
                    <Edit3 className="size-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Botões de Ação Rápida */}
          <div className="mt-6 flex flex-wrap items-center gap-2.5 border-t border-border/60 pt-4">
            {lead.lead_status !== "Ganho" && (
              <button
                type="button"
                onClick={() => handleStatusChange("Ganho")}
                disabled={updateMutation.isPending}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#fba834] to-[#f7931e] px-4 py-2 text-xs font-bold text-[#0d0d26] shadow-md shadow-[#fba834]/20 hover:brightness-110 transition-all disabled:opacity-50"
              >
                <CheckCircle2 className="size-4" /> Marcar como Ganho
              </button>
            )}

            {lead.lead_status !== "Perdido" && (
              <button
                type="button"
                onClick={() => setIsLossModalOpen(true)}
                disabled={updateMutation.isPending}
                className="inline-flex items-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-xs font-bold text-red-400 hover:bg-red-500/20 transition-all disabled:opacity-50"
              >
                <XCircle className="size-4" /> Marcar como Perdido
              </button>
            )}

            {lead.lead_status !== "Aberto" && (
              <button
                type="button"
                onClick={() => handleStatusChange("Aberto")}
                disabled={updateMutation.isPending}
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-secondary px-4 py-2 text-xs font-bold text-foreground hover:border-accent/40 transition-all disabled:opacity-50"
              >
                <RefreshCw className="size-4 text-accent" /> Reabrir Oportunidade
              </button>
            )}

            {clienteVinculado && (
              <Link
                to="/clientes"
                className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-bold text-emerald-400 hover:bg-emerald-500/20 transition-all ml-auto"
              >
                <UserCheck className="size-4" /> Ver Ficha de Cliente
              </Link>
            )}
          </div>
        </section>

        {/* ══════ 2. RÉGUA DE PROGRESSO DAS ETAPAS DO FUNIL ══════ */}
        <section className="rounded-2xl border border-border bg-card/90 p-5 backdrop-blur-2xl shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <SlidersHorizontal className="size-4 text-accent" /> Etapa Atual do Funil
            </h3>
            <span className="rounded-lg bg-accent/15 border border-accent/30 px-2.5 py-0.5 text-xs font-extrabold text-accent">
              {lead.lead_etapa_funil || "Novo Lead"}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 pt-1">
            {ETAPAS_FUNIL_REAL.map((stg, idx) => {
              const isCurrent = (lead.lead_etapa_funil || "Novo Lead") === stg;
              return (
                <button
                  key={stg}
                  type="button"
                  onClick={() => handleStageChange(stg)}
                  disabled={updateMutation.isPending}
                  className={cn(
                    "rounded-xl border p-2.5 text-left transition-all relative overflow-hidden group",
                    isCurrent
                      ? "border-accent bg-accent/20 text-accent shadow-md shadow-accent/10"
                      : "border-border bg-secondary/40 text-muted-foreground hover:bg-secondary hover:text-foreground hover:border-accent/40"
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold opacity-60">0{idx + 1}</span>
                    {isCurrent && <span className="size-2 rounded-full bg-accent animate-ping" />}
                  </div>
                  <p className="text-[11px] font-bold leading-tight">{stg}</p>
                </button>
              );
            })}
          </div>
        </section>

        {/* ══════ 3. GRID CENTRAL: DADOS NA LATERAL & ABAS INTERATIVAS ══════ */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          
          {/* ──── Coluna Esquerda (1/3): Dados Cadastrais & Rastreamento ──── */}
          <div className="space-y-6 lg:col-span-1">
            <div className="rounded-2xl border border-border bg-card/90 p-5 backdrop-blur-2xl shadow-xl space-y-4">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <User className="size-4 text-accent" /> Dados Cadastrais
              </h3>
              <dl className="space-y-3 text-xs">
                <div className="border-b border-border/40 pb-2">
                  <dt className="text-muted-foreground mb-0.5">Nome / Contato</dt>
                  <dd className="font-bold text-foreground text-sm">{lead.lead_nome || "Não informado"}</dd>
                </div>
                <div className="border-b border-border/40 pb-2">
                  <dt className="text-muted-foreground mb-0.5">WhatsApp / Telefone</dt>
                  <dd className="font-semibold text-foreground">{lead.lead_telefone || "Não informado"}</dd>
                </div>
                <div className="border-b border-border/40 pb-2">
                  <dt className="text-muted-foreground mb-0.5">E-mail</dt>
                  <dd className="font-semibold text-foreground truncate">{lead.lead_email || "Não informado"}</dd>
                </div>
                <div className="border-b border-border/40 pb-2">
                  <dt className="text-muted-foreground mb-0.5">Origem do Lead</dt>
                  <dd className="font-bold text-accent">{lead.lead_origem || "Meta Ads / Direct"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground mb-0.5">ID Interno</dt>
                  <dd className="font-mono text-[10px] text-muted-foreground truncate">{lead.lead_id}</dd>
                </div>
              </dl>
            </div>

            {utm && (
              <div className="rounded-2xl border border-border bg-card/90 p-5 backdrop-blur-2xl shadow-xl space-y-3">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Sparkles className="size-4 text-accent" /> Rastreamento / Meta Ads
                </h3>
                <dl className="grid grid-cols-2 gap-3 text-xs">
                  {utm.ad_title && (
                    <div className="col-span-2 border-b border-border/40 pb-2">
                      <dt className="text-muted-foreground mb-0.5">Anúncio</dt>
                      <dd className="font-bold text-foreground">{utm.ad_title}</dd>
                    </div>
                  )}
                  {utm.source_app && (
                    <div>
                      <dt className="text-muted-foreground mb-0.5">Plataforma</dt>
                      <dd className="font-bold capitalize text-foreground">{utm.source_app}</dd>
                    </div>
                  )}
                  {utm.entry_point && (
                    <div>
                      <dt className="text-muted-foreground mb-0.5">Ponto de Entrada</dt>
                      <dd className="font-bold text-foreground">{utm.entry_point}</dd>
                    </div>
                  )}
                </dl>
              </div>
            )}

            {/* Resumo de Atividades Pendentes */}
            <div className="rounded-2xl border border-border bg-card/90 p-4 backdrop-blur-2xl shadow-xl space-y-3">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <ListTodo className="size-4 text-accent" /> Resumo de Atividades
              </h4>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab("tarefas")}
                  className="rounded-xl border border-border/80 bg-secondary/40 p-3 text-left hover:border-accent/40 transition-all group"
                >
                  <p className="text-[11px] text-muted-foreground">Tarefas Pendentes</p>
                  <p className="text-lg font-black text-foreground group-hover:text-accent transition-colors">
                    {tarefasPendentesCount}
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("anotacoes")}
                  className="rounded-xl border border-border/80 bg-secondary/40 p-3 text-left hover:border-accent/40 transition-all group"
                >
                  <p className="text-[11px] text-muted-foreground">Anotações</p>
                  <p className="text-lg font-black text-foreground group-hover:text-accent transition-colors">
                    {anotacoes.length}
                  </p>
                </button>
              </div>
            </div>
          </div>

          {/* ──── Coluna Direita (2/3): SISTEMA DE ABAS (Atendimento, Tarefas, Anotações) ──── */}
          <div className="space-y-4 lg:col-span-2">
            
            {/* Navegação por Abas */}
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card/90 p-1.5 backdrop-blur-2xl shadow-xl">
              <button
                type="button"
                onClick={() => setActiveTab("atendimento")}
                className={cn(
                  "flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all",
                  activeTab === "atendimento"
                    ? "bg-accent text-[#0d0d26] shadow-md shadow-accent/20"
                    : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                )}
              >
                <MessageSquare className="size-4" />
                <span>Atendimento & Conversas</span>
                <span className={cn(
                  "rounded-full px-2 py-0.2 text-[10px] font-extrabold",
                  activeTab === "atendimento" ? "bg-[#0d0d26]/20 text-[#0d0d26]" : "bg-secondary text-muted-foreground"
                )}>
                  {mensagens.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("tarefas")}
                className={cn(
                  "flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all",
                  activeTab === "tarefas"
                    ? "bg-accent text-[#0d0d26] shadow-md shadow-accent/20"
                    : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                )}
              >
                <CheckSquare className="size-4" />
                <span>Tarefas & Follow-ups</span>
                {tarefasPendentesCount > 0 && (
                  <span className={cn(
                    "rounded-full px-2 py-0.2 text-[10px] font-extrabold",
                    activeTab === "tarefas" ? "bg-[#0d0d26]/20 text-[#0d0d26]" : "bg-amber-500/20 text-amber-400"
                  )}>
                    {tarefasPendentesCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("anotacoes")}
                className={cn(
                  "flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all",
                  activeTab === "anotacoes"
                    ? "bg-accent text-[#0d0d26] shadow-md shadow-accent/20"
                    : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                )}
              >
                <StickyNote className="size-4" />
                <span>Anotações Internas</span>
                <span className={cn(
                  "rounded-full px-2 py-0.2 text-[10px] font-extrabold",
                  activeTab === "anotacoes" ? "bg-[#0d0d26]/20 text-[#0d0d26]" : "bg-secondary text-muted-foreground"
                )}>
                  {anotacoes.length}
                </span>
              </button>
            </div>

            {/* ══════ ABA 1: HISTÓRICO DE ATENDIMENTO ══════ */}
            {activeTab === "atendimento" && (
              <div className="flex flex-col rounded-2xl border border-border bg-card/90 backdrop-blur-2xl shadow-xl h-[560px] animate-in fade-in duration-200">
                <div className="flex items-center justify-between border-b border-border px-6 py-4">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="size-4 text-accent" />
                    <h3 className="text-sm font-extrabold text-foreground">Histórico de Atendimento</h3>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1 text-slate-400 text-[11px]">
                      <span className="size-2 rounded-full bg-slate-400" /> Cliente
                    </span>
                    <span className="flex items-center gap-1 text-accent text-[11px]">
                      <span className="size-2 rounded-full bg-accent" /> IA Paola
                    </span>
                    <span className="text-muted-foreground font-semibold text-[11px] border-l border-border pl-2">
                      {mensagens.length} {mensagens.length === 1 ? "mensagem" : "mensagens"}
                    </span>
                  </div>
                </div>

                <div className="flex-1 space-y-3.5 p-6 overflow-y-auto">
                  {mensagens.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
                      <MessageSquare className="size-10 text-muted-foreground/30 mb-2" />
                      <p className="text-xs font-semibold">Nenhuma mensagem registrada para este lead.</p>
                      <p className="text-[11px] text-muted-foreground/70 mt-1 max-w-xs">
                        Assim que o cliente interagir pelo WhatsApp com a IA Paola, as mensagens aparecerão aqui em tempo real.
                      </p>
                    </div>
                  ) : (
                    mensagens.map((msg) => {
                      const isCliente = msg.mensagem_origem === "Cliente";
                      const isIA = msg.mensagem_origem === "IA";

                      return (
                        <div
                          key={msg.mensagem_id}
                          className={cn(
                            "flex flex-col max-w-[82%] rounded-2xl p-3.5 text-xs shadow-md transition-all",
                            isCliente
                              ? "bg-[#181838] border border-white/10 text-foreground self-start rounded-tl-xs"
                              : isIA
                              ? "bg-[#fba834]/15 border border-[#fba834]/35 text-foreground self-end rounded-tr-xs"
                              : "bg-blue-500/15 border border-blue-500/35 text-foreground self-end rounded-tr-xs"
                          )}
                        >
                          <div className="flex items-center justify-between gap-3 text-[10px] font-extrabold mb-1.5 pb-1 border-b border-white/5">
                            <span className={cn(
                              "flex items-center gap-1.5",
                              isCliente ? "text-slate-300" : isIA ? "text-accent" : "text-blue-400"
                            )}>
                              {isCliente && <User className="size-3 text-slate-400" />}
                              {isIA && <Bot className="size-3 text-accent" />}
                              {!isCliente && !isIA && <UserCheck className="size-3 text-blue-400" />}
                              {isCliente ? (lead.lead_nome || "Cliente") : isIA ? "Paola · IA Omni" : "Atendente Humano"}
                            </span>
                            <span className="text-muted-foreground font-normal">
                              {formatDateTime(msg.criado_em)}
                            </span>
                          </div>
                          <p className="whitespace-pre-wrap leading-relaxed text-[12px]">{msg.mensagem_conteudo}</p>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </div>
            )}

            {/* ══════ ABA 2: TAREFAS DO LEAD ══════ */}
            {activeTab === "tarefas" && (
              <div className="rounded-2xl border border-border bg-card/90 p-6 backdrop-blur-2xl shadow-xl space-y-5 animate-in fade-in duration-200">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
                  <div>
                    <h3 className="text-base font-extrabold text-foreground flex items-center gap-2">
                      <CheckSquare className="size-5 text-accent" /> Tarefas & Atividades
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Follow-ups, reuniões e pendências comerciais vinculadas a este lead
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowNewTaskForm((prev) => !prev)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#fba834] to-[#f7931e] px-4 py-2 text-xs font-bold text-[#0d0d26] shadow-md shadow-[#fba834]/20 hover:brightness-110 transition-all"
                  >
                    <Plus className="size-4" /> {showNewTaskForm ? "Fechar Formulário" : "Nova Tarefa"}
                  </button>
                </div>

                {/* Formulário de criação de tarefa */}
                {showNewTaskForm && (
                  <div className="rounded-xl border border-accent/40 bg-secondary/40 p-4 space-y-3 animate-in fade-in duration-200">
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-accent flex items-center gap-1.5">
                      <Plus className="size-3.5" /> Adicionar Tarefa
                    </h4>
                    <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-4">
                      <div className="md:col-span-2">
                        <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Título da Tarefa *</label>
                        <input
                          value={tarefaTitulo}
                          onChange={(e) => setTarefaTitulo(e.target.value)}
                          placeholder="Ex: Ligar para confirmar proposta, Enviar contrato..."
                          className="h-10 w-full rounded-xl border border-input bg-background px-3 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-accent/60"
                          autoFocus
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Data de Vencimento</label>
                        <input
                          type="date"
                          value={tarefaVencimento}
                          onChange={(e) => setTarefaVencimento(e.target.value)}
                          className="h-10 w-full rounded-xl border border-input bg-background px-3 text-xs text-foreground outline-none focus:border-accent/60 cursor-pointer"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Prioridade</label>
                        <select
                          value={tarefaPrioridade}
                          onChange={(e) => setTarefaPrioridade(e.target.value as any)}
                          className="h-10 w-full rounded-xl border border-input bg-background px-3 text-xs text-foreground outline-none focus:border-accent/60 cursor-pointer font-semibold"
                        >
                          <option value="baixa">Baixa</option>
                          <option value="media">Média</option>
                          <option value="alta">Alta</option>
                          <option value="urgente">Urgente</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowNewTaskForm(false)}
                        className="rounded-xl border border-border bg-white/5 px-4 py-1.5 text-xs font-bold text-muted-foreground hover:bg-white/10"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!tarefaTitulo.trim()) {
                            toast.error("Informe o título da tarefa!");
                            return;
                          }
                          addTarefaMutation.mutate({
                            titulo: tarefaTitulo,
                            data_vencimento: tarefaVencimento,
                            prioridade: tarefaPrioridade,
                          });
                        }}
                        disabled={addTarefaMutation.isPending || !tarefaTitulo.trim()}
                        className="rounded-xl bg-gradient-to-r from-[#fba834] to-[#f7931e] px-4 py-1.5 text-xs font-bold text-[#0d0d26] shadow-md shadow-[#fba834]/20 hover:brightness-110 transition-all disabled:opacity-50"
                      >
                        {addTarefaMutation.isPending ? "Salvando..." : "Salvar Tarefa"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Lista de tarefas */}
                {tarefas.length === 0 ? (
                  <div className="py-12 text-center space-y-2">
                    <CheckSquare className="size-10 mx-auto text-muted-foreground/30" />
                    <p className="text-sm font-semibold text-muted-foreground">
                      Nenhuma tarefa pendente para este lead.
                    </p>
                    <p className="text-xs text-muted-foreground/60">
                      Clique no botão "+ Nova Tarefa" acima para agendar follow-ups e lembretes.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/50 rounded-xl border border-border/70 overflow-hidden bg-secondary/20">
                    {tarefas.map((t) => {
                      const isDone = t.status === "concluida";
                      const prio = prioridadeMap[t.prioridade] || prioridadeMap["media"];

                      return (
                        <div
                          key={t.tarefa_id}
                          className={cn(
                            "flex items-center justify-between gap-3 p-4 transition-colors group",
                            isDone ? "bg-white/[0.01] opacity-60" : "hover:bg-white/[0.03]"
                          )}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <button
                              type="button"
                              onClick={() => toggleTarefaStatusMutation.mutate(t)}
                              className="text-muted-foreground hover:text-accent transition-colors shrink-0"
                              title={isDone ? "Marcar como pendente" : "Marcar como concluída"}
                            >
                              {isDone ? (
                                <CheckCircle2 className="size-5 text-emerald-400" />
                              ) : (
                                <Square className="size-5 hover:border-accent" />
                              )}
                            </button>
                            <div className="min-w-0">
                              <p className={cn("text-xs font-semibold text-foreground leading-snug", isDone && "line-through text-muted-foreground")}>
                                {t.titulo}
                              </p>
                              {t.descricao && (
                                <p className="text-[11px] text-muted-foreground truncate">{t.descricao}</p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            {t.data_vencimento && (
                              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                <CalendarDays className="size-3.5 text-accent" /> {formatDateOnly(t.data_vencimento)}
                              </span>
                            )}

                            <span className={cn("inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] font-bold", prio.cls)}>
                              {prio.label}
                            </span>

                            <button
                              type="button"
                              onClick={() => {
                                if (confirm(`Excluir a tarefa "${t.titulo}"?`)) {
                                deleteTarefaMutation.mutate(t.tarefa_id);
                              }
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:bg-red-500/15 rounded-lg transition-all"
                            title="Excluir tarefa"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ══════ ABA 3: ANOTAÇÕES INTERNAS ══════ */}
          {activeTab === "anotacoes" && (
            <div className="rounded-2xl border border-border bg-card/90 p-6 backdrop-blur-2xl shadow-xl space-y-6 animate-in fade-in duration-200">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div>
                  <h3 className="text-base font-extrabold text-foreground flex items-center gap-2">
                    <StickyNote className="size-5 text-accent" /> Anotações Internas
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Notas estratégicas, alinhamentos de escopo e histórico de negociação
                  </p>
                </div>
                <span className="rounded-lg bg-secondary px-3 py-1 text-xs font-bold text-muted-foreground border border-border">
                  {anotacoes.length} {anotacoes.length === 1 ? "anotação" : "anotações"}
                </span>
              </div>

              {/* Campo para criar nova anotação */}
              <div className="rounded-xl border border-border/80 bg-secondary/30 p-4 space-y-3">
                <textarea
                  value={anotacaoTexto}
                  onChange={(e) => setAnotacaoTexto(e.target.value)}
                  placeholder="Escreva uma nova anotação sobre este negócio (ex: cliente pediu desconto de 10% no plano anual, reunião remarcada para quinta-feira...)"
                  rows={3}
                  className="w-full rounded-xl border border-input bg-background/80 p-3.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-accent/60 resize-none"
                  autoFocus
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      if (!anotacaoTexto.trim()) return;
                      addAnotacaoMutation.mutate(anotacaoTexto);
                    }}
                    disabled={addAnotacaoMutation.isPending || !anotacaoTexto.trim()}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#fba834] to-[#f7931e] px-4 py-2 text-xs font-bold text-[#0d0d26] shadow-md shadow-[#fba834]/20 hover:brightness-110 transition-all disabled:opacity-50"
                  >
                    <Plus className="size-4" />
                    {addAnotacaoMutation.isPending ? "Salvando..." : "Salvar Anotação"}
                  </button>
                </div>
              </div>

              {/* Lista de anotações registradas */}
              {anotacoes.length === 0 ? (
                <div className="py-8 text-center space-y-2">
                  <StickyNote className="size-8 mx-auto text-muted-foreground/30" />
                  <p className="text-xs font-semibold text-muted-foreground">
                    Nenhuma anotação registrada ainda para este lead.
                  </p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-2">
                  {anotacoes.map((note) => (
                    <div
                      key={note.anotacao_id}
                      className="flex flex-col justify-between rounded-xl border border-border/70 bg-secondary/40 p-4 shadow-sm hover:border-accent/40 transition-all group"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground border-b border-border/40 pb-2">
                          <span className="font-semibold text-accent flex items-center gap-1">
                            <User className="size-3" /> {note.autor_nome || "Omni"}
                          </span>
                          <span>{formatDateTime(note.criado_em)}</span>
                        </div>
                        <p className="whitespace-pre-wrap text-xs text-foreground leading-relaxed">
                          {note.conteudo}
                        </p>
                      </div>
                      <div className="mt-3 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity border-t border-border/40 pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm("Tem certeza que deseja excluir esta anotação?")) {
                              deleteAnotacaoMutation.mutate(note.anotacao_id);
                            }
                          }}
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold text-red-400 hover:bg-red-500/15 transition-colors"
                        >
                          <Trash2 className="size-3" /> Excluir
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>

      {/* Modal de Motivo de Perda */}
      {isLossModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#12122d]/95 backdrop-blur-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-extrabold text-destructive flex items-center gap-2">
                <XCircle className="size-5" /> Registrar Motivo da Perda
              </h3>
              <button
                onClick={() => setIsLossModalOpen(false)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-white/10"
              >
                <X className="size-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Selecione o motivo pelo qual este negócio não foi fechado para qualificar os relatórios:
            </p>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {motivosPerda
                .filter((m) => m.motivo_ativo)
                .map((m) => (
                  <button
                    key={m.motivo_id}
                    type="button"
                    onClick={() => {
                      updateMutation.mutate({
                        lead_status: "Perdido",
                        motivo_perda_id: m.motivo_id,
                      });
                      setIsLossModalOpen(false);
                    }}
                    className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-left text-xs font-bold text-foreground hover:border-accent hover:bg-accent/10 transition-all"
                  >
                    {m.motivo_nome}
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
