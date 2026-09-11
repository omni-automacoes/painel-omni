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
  CheckCircle2,
  XCircle,
  User,
  MessageSquare,
  Clock,
  Edit3,
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

/* Prioridade: cor sempre acompanhada de rótulo em texto. */
const PRIORIDADE_MAP = {
  urgente: { label: "Urgente", badge: "omni-badge--danger" },
  alta: { label: "Alta", badge: "omni-badge--warning" },
  media: { label: "Média", badge: "omni-badge--info" },
  baixa: { label: "Baixa", badge: "omni-badge--outline" },
} as const;

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
  const cleaned = String(val)
    .replace(/[^\d.,-]/g, "")
    .replace(",", ".");
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
  const [activeTab, setActiveTab] = useState<"atendimento" | "tarefas" | "anotacoes">(
    "atendimento",
  );

  const [isLossModalOpen, setIsLossModalOpen] = useState(false);
  const [editingValor, setEditingValor] = useState(false);
  const [valorInput, setValorInput] = useState("");
  const [anotacaoTexto, setAnotacaoTexto] = useState("");

  /* State para nova tarefa */
  const [tarefaTitulo, setTarefaTitulo] = useState("");
  const [tarefaVencimento, setTarefaVencimento] = useState(new Date().toISOString().split("T")[0]);
  const [tarefaPrioridade, setTarefaPrioridade] = useState<Tarefa["prioridade"]>("media");
  const [showNewTaskForm, setShowNewTaskForm] = useState(false);
  const [tarefaTituloInvalido, setTarefaTituloInvalido] = useState(false);

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
  const { data: mensagens = [], isLoading: isMensagensLoading } = useQuery<Mensagem[]>({
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
  const { data: tarefas = [], isLoading: isTarefasLoading } = useQuery<Tarefa[]>({
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
      const { error } = await supabase.from("leads").update(updates).eq("lead_id", leadId);

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
    mutationFn: async (payload: {
      titulo: string;
      data_vencimento: string;
      prioridade: Tarefa["prioridade"];
    }) => {
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
      const { error } = await supabase.from("tarefas").delete().eq("tarefa_id", tarefaId);
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
      <AppShell title="Carregando negócio" subtitle="Buscando os dados no banco">
        <div className="omni-stack-6">
          <div className="omni-skeleton h-40 w-full" />
          <div className="omni-skeleton h-28 w-full" />
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="omni-skeleton h-80 w-full" />
            <div className="omni-skeleton h-80 w-full lg:col-span-2" />
          </div>
        </div>
      </AppShell>
    );
  }

  if (isLeadError || !lead) {
    return (
      <AppShell title="Negócio não encontrado" subtitle="O registro não foi localizado">
        <div className="omni-empty">
          <span className="omni-empty__art">
            <XCircle />
          </span>
          <h4>Este negócio não existe mais</h4>
          <p>
            {(leadError as Error)?.message ||
              "O registro pode ter sido excluído. Volte para o funil e abra o negócio a partir de lá."}
          </p>
          <button
            type="button"
            onClick={() => navigate({ to: "/negocios" })}
            className="omni-btn omni-btn--primary"
          >
            <ArrowLeft /> Voltar para o funil
          </button>
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

  const tarefasPendentesCount = tarefas.filter((t) => t.status === "pendente").length;
  const etapaAtual = lead.lead_etapa_funil || "Novo Lead";
  const indiceEtapaAtual = ETAPAS_FUNIL_REAL.indexOf(etapaAtual as any);

  return (
    <AppShell
      title={displayName}
      subtitle={`Negócio criado em ${formatDateTime(lead.criado_em)}`}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => navigate({ to: "/negocios" })}
            className="omni-btn omni-btn--ghost omni-btn--sm"
          >
            <ArrowLeft /> Voltar ao funil
          </button>
          {whatsappUrl && (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="omni-btn omni-btn--secondary omni-btn--sm"
            >
              <MessageSquare /> Abrir WhatsApp
            </a>
          )}
        </div>
      }
    >
      <div className="omni-stack-6 w-full">
        {/* ══════ 1. Identificação do negócio ══════ */}

        <section className="omni-card">
          <div className="omni-card__body flex flex-wrap items-start justify-between gap-6">
            <div className="flex min-w-0 items-center gap-4">
              <span className="omni-avatar omni-avatar--lg" aria-hidden="true">
                {getInitials(lead.lead_nome)}
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="omni-h2">{displayName}</h2>
                  {lead.lead_status === "Ganho" && (
                    <span className="omni-badge omni-badge--success">
                      <CheckCircle2 /> Ganho — cliente ativo
                    </span>
                  )}
                  {lead.lead_status === "Perdido" && (
                    <span className="omni-badge omni-badge--danger">
                      <XCircle /> Perdido
                      {motivoObj ? ` — ${motivoObj.motivo_nome}` : ""}
                    </span>
                  )}
                  {lead.lead_status === "Aberto" && (
                    <span className="omni-badge omni-badge--info">
                      <Clock /> Em negociação
                    </span>
                  )}
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-ink-3">
                  {lead.lead_telefone && (
                    <span className="num flex items-center gap-1.5 text-ink-2">
                      <Phone className="size-3.5" /> {lead.lead_telefone}
                    </span>
                  )}
                  {lead.lead_email && (
                    <span className="flex items-center gap-1.5 text-ink-2">
                      <Mail className="size-3.5" /> {lead.lead_email}
                    </span>
                  )}
                  <span className="num flex items-center gap-1.5">
                    <Calendar className="size-3.5" /> {formatDateTime(lead.criado_em)}
                  </span>
                </div>
              </div>
            </div>

            <div className="omni-card omni-card--inset min-w-[220px]">
              <div className="omni-stat p-4">
                <span className="omni-stat__label">Valor da oportunidade</span>
                {editingValor ? (
                  <div className="flex items-center gap-2">
                    <label className="omni-sr" htmlFor="lead-valor">
                      Valor da oportunidade em reais
                    </label>
                    <input
                      id="lead-valor"
                      value={valorInput}
                      onChange={(e) => setValorInput(e.target.value)}
                      placeholder="0,00"
                      className="omni-input num"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleSaveValor}
                      className="omni-btn omni-btn--secondary omni-btn--sm"
                    >
                      Salvar
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingValor(false)}
                      className="omni-btn omni-btn--ghost omni-btn--icon omni-btn--sm"
                    >
                      <X />
                      <span className="omni-sr">Cancelar edição</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <p className="omni-stat__value">{formatCurrency(lead.lead_valor)}</p>
                    <button
                      type="button"
                      onClick={() => {
                        setValorInput(lead.lead_valor ? String(lead.lead_valor) : "");
                        setEditingValor(true);
                      }}
                      className="omni-btn omni-btn--ghost omni-btn--icon omni-btn--sm"
                      title="Editar valor"
                    >
                      <Edit3 />
                      <span className="omni-sr">Editar valor da oportunidade</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="omni-card__footer justify-start gap-2">
            {lead.lead_status !== "Ganho" && (
              <button
                type="button"
                onClick={() => handleStatusChange("Ganho")}
                disabled={updateMutation.isPending}
                className="omni-btn omni-btn--primary omni-btn--sm"
              >
                <CheckCircle2 /> Marcar como ganho
              </button>
            )}

            {lead.lead_status !== "Perdido" && (
              <button
                type="button"
                onClick={() => setIsLossModalOpen(true)}
                disabled={updateMutation.isPending}
                className="omni-btn omni-btn--secondary omni-btn--sm"
              >
                <XCircle /> Registrar perda
              </button>
            )}

            {lead.lead_status !== "Aberto" && (
              <button
                type="button"
                onClick={() => handleStatusChange("Aberto")}
                disabled={updateMutation.isPending}
                className="omni-btn omni-btn--secondary omni-btn--sm"
              >
                <RefreshCw /> Reabrir oportunidade
              </button>
            )}

            {clienteVinculado && (
              <Link to="/clientes" className="omni-btn omni-btn--quiet omni-btn--sm ml-auto">
                <UserCheck /> Ver ficha do cliente
              </Link>
            )}
          </div>
        </section>

        {/* ══════ 2. Etapa do funil ══════ */}

        <section className="omni-card">
          <div className="omni-card__header py-3">
            <h2 className="omni-eyebrow flex items-center gap-1.5">
              <SlidersHorizontal className="size-3.5" /> Etapa do funil
            </h2>
            <span className="omni-badge omni-badge--brand">{etapaAtual}</span>
          </div>

          <div className="omni-card__body grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
            {ETAPAS_FUNIL_REAL.map((stg, idx) => {
              const isCurrent = etapaAtual === stg;
              const isPast = indiceEtapaAtual > -1 && idx < indiceEtapaAtual;
              return (
                <button
                  key={stg}
                  type="button"
                  aria-current={isCurrent ? "step" : undefined}
                  onClick={() => handleStageChange(stg)}
                  disabled={updateMutation.isPending}
                  className={cn(
                    "flex flex-col gap-1 rounded-md border p-2.5 text-left transition-colors duration-[var(--omni-dur-fast)] ease-omni",
                    isCurrent
                      ? "border-primary bg-primary-soft text-primary-soft-fg"
                      : isPast
                        ? "border-line bg-surface-2 text-ink-2 hover:border-line-strong"
                        : "border-line text-ink-3 hover:border-line-strong hover:text-ink",
                  )}
                >
                  <span className="num text-2xs font-semibold opacity-70">
                    {String(idx + 1).padStart(2, "0")}
                    {isPast && " ✓"}
                  </span>
                  <span className="text-xs font-semibold leading-tight">{stg}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* ══════ 3. Dados e abas ══════ */}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* ──── Coluna esquerda ──── */}
          <div className="omni-stack-6 lg:col-span-1">
            <section className="omni-card">
              <div className="omni-card__header py-3">
                <h2 className="omni-eyebrow flex items-center gap-1.5">
                  <User className="size-3.5" /> Dados cadastrais
                </h2>
              </div>
              <dl className="omni-list">
                <div className="omni-list__item flex-col items-start gap-0.5">
                  <dt className="omni-small">Nome / contato</dt>
                  <dd className="text-sm font-semibold text-ink">
                    {lead.lead_nome || "Não informado"}
                  </dd>
                </div>
                <div className="omni-list__item flex-col items-start gap-0.5">
                  <dt className="omni-small">WhatsApp / telefone</dt>
                  <dd className="num text-sm font-medium text-ink">
                    {lead.lead_telefone || "Não informado"}
                  </dd>
                </div>
                <div className="omni-list__item w-full flex-col items-start gap-0.5">
                  <dt className="omni-small">E-mail</dt>
                  <dd className="w-full truncate text-sm font-medium text-ink">
                    {lead.lead_email || "Não informado"}
                  </dd>
                </div>
                <div className="omni-list__item flex-col items-start gap-0.5">
                  <dt className="omni-small">Origem</dt>
                  <dd className="text-sm font-medium text-ink">
                    {lead.lead_origem || "Meta Ads / Direct"}
                  </dd>
                </div>
                <div className="omni-list__item w-full flex-col items-start gap-0.5">
                  <dt className="omni-small">ID interno</dt>
                  <dd className="omni-code w-full truncate">{lead.lead_id}</dd>
                </div>
              </dl>
            </section>

            {utm && (
              <section className="omni-card">
                <div className="omni-card__header py-3">
                  <h2 className="omni-eyebrow flex items-center gap-1.5">
                    <Sparkles className="size-3.5" /> Rastreamento do anúncio
                  </h2>
                </div>
                <dl className="omni-card__body grid grid-cols-2 gap-4 text-xs">
                  {utm.ad_title && (
                    <div className="col-span-2">
                      <dt className="omni-small">Anúncio</dt>
                      <dd className="font-semibold text-ink">{utm.ad_title}</dd>
                    </div>
                  )}
                  {utm.source_app && (
                    <div>
                      <dt className="omni-small">Plataforma</dt>
                      <dd className="font-medium capitalize text-ink">{utm.source_app}</dd>
                    </div>
                  )}
                  {utm.entry_point && (
                    <div>
                      <dt className="omni-small">Ponto de entrada</dt>
                      <dd className="font-medium text-ink">{utm.entry_point}</dd>
                    </div>
                  )}
                </dl>
              </section>
            )}

            <section className="omni-card">
              <div className="omni-card__header py-3">
                <h2 className="omni-eyebrow flex items-center gap-1.5">
                  <ListTodo className="size-3.5" /> Resumo de atividades
                </h2>
              </div>
              <div className="omni-card__body grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setActiveTab("tarefas")}
                  className="omni-card omni-card--inset cursor-pointer p-3 text-left transition-colors hover:border-line-strong"
                >
                  <p className="omni-small">Tarefas pendentes</p>
                  <p className="num text-xl font-bold text-ink">{tarefasPendentesCount}</p>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("anotacoes")}
                  className="omni-card omni-card--inset cursor-pointer p-3 text-left transition-colors hover:border-line-strong"
                >
                  <p className="omni-small">Anotações</p>
                  <p className="num text-xl font-bold text-ink">{anotacoes.length}</p>
                </button>
              </div>
            </section>
          </div>

          {/* ──── Coluna direita ──── */}
          <div className="flex flex-col gap-4 lg:col-span-2">
            <div className="omni-tabs" role="tablist" aria-label="Conteúdo do negócio">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "atendimento"}
                onClick={() => setActiveTab("atendimento")}
                className="omni-tab"
              >
                <MessageSquare className="size-4" /> Atendimento
                <span className="omni-badge omni-badge--outline">{mensagens.length}</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "tarefas"}
                onClick={() => setActiveTab("tarefas")}
                className="omni-tab"
              >
                <CheckSquare className="size-4" /> Tarefas
                <span
                  className={cn(
                    "omni-badge",
                    tarefasPendentesCount > 0 ? "omni-badge--warning" : "omni-badge--outline",
                  )}
                >
                  {tarefasPendentesCount}
                </span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "anotacoes"}
                onClick={() => setActiveTab("anotacoes")}
                className="omni-tab"
              >
                <StickyNote className="size-4" /> Anotações
                <span className="omni-badge omni-badge--outline">{anotacoes.length}</span>
              </button>
            </div>

            {/* ══════ Aba 1: atendimento ══════ */}
            {activeTab === "atendimento" && (
              <section className="omni-card flex h-[560px] flex-col">
                <div className="omni-card__header py-3">
                  <h2 className="omni-h4">Histórico de atendimento</h2>
                  <div className="omni-legend text-xs">
                    <span className="flex items-center gap-1.5 text-ink-3">
                      <span
                        className="size-2 rounded-full"
                        style={{ background: "var(--omni-border-strong)" }}
                        aria-hidden="true"
                      />
                      Cliente
                    </span>
                    <span className="flex items-center gap-1.5 text-ink-3">
                      <span
                        className="size-2 rounded-full"
                        style={{ background: "var(--omni-primary)" }}
                        aria-hidden="true"
                      />
                      Paola · IA
                    </span>
                  </div>
                </div>

                <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-5 scrollbar-slim">
                  {isMensagensLoading ? (
                    [0, 1, 2].map((i) => <div key={i} className="omni-skeleton h-16 w-[70%]" />)
                  ) : mensagens.length === 0 ? (
                    <div className="omni-empty m-auto">
                      <span className="omni-empty__art">
                        <MessageSquare />
                      </span>
                      <h4>Nenhuma mensagem ainda</h4>
                      <p>
                        Quando o cliente responder pelo WhatsApp, a conversa aparece aqui
                        automaticamente.
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
                            "flex max-w-[82%] flex-col rounded-lg border p-3 text-xs",
                            isCliente
                              ? "self-start border-line bg-surface-2"
                              : isIA
                                ? "self-end border-primary-soft bg-primary-soft"
                                : "self-end border-info-soft bg-info-soft",
                          )}
                        >
                          <div className="mb-1.5 flex items-center justify-between gap-3 border-b border-line-subtle pb-1">
                            <span className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-label text-ink-2">
                              {isCliente && <User className="size-3" />}
                              {isIA && <Bot className="size-3" />}
                              {!isCliente && !isIA && <UserCheck className="size-3" />}
                              {isCliente
                                ? lead.lead_nome || "Cliente"
                                : isIA
                                  ? "Paola · IA Omni"
                                  : "Atendente"}
                            </span>
                            <span className="num text-2xs text-ink-3">
                              {formatDateTime(msg.criado_em)}
                            </span>
                          </div>
                          <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">
                            {msg.mensagem_conteudo}
                          </p>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </section>
            )}

            {/* ══════ Aba 2: tarefas ══════ */}
            {activeTab === "tarefas" && (
              <section className="omni-card">
                <div className="omni-card__header">
                  <div>
                    <h2 className="omni-h4">Tarefas e follow-ups</h2>
                    <p className="omni-small mt-0.5">Pendências vinculadas a este negócio</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowNewTaskForm((prev) => !prev)}
                    className="omni-btn omni-btn--secondary omni-btn--sm"
                  >
                    <Plus /> {showNewTaskForm ? "Fechar formulário" : "Nova tarefa"}
                  </button>
                </div>

                {showNewTaskForm && (
                  <div className="omni-card__body border-b border-line-subtle">
                    <div className="omni-card omni-card--inset">
                      <div className="omni-card__body grid gap-4 md:grid-cols-4">
                        <div className="omni-field md:col-span-2">
                          <label className="omni-label" htmlFor="nova-tarefa-titulo">
                            Título da tarefa <span className="omni-req">*</span>
                          </label>
                          <input
                            id="nova-tarefa-titulo"
                            value={tarefaTitulo}
                            onChange={(e) => {
                              setTarefaTitulo(e.target.value);
                              if (e.target.value.trim()) setTarefaTituloInvalido(false);
                            }}
                            aria-invalid={tarefaTituloInvalido || undefined}
                            placeholder="Ex.: Ligar para confirmar a proposta"
                            className="omni-input"
                            autoFocus
                          />
                          {tarefaTituloInvalido && (
                            <p className="omni-error">
                              Descreva a tarefa em uma frase para poder salvá-la.
                            </p>
                          )}
                        </div>
                        <div className="omni-field">
                          <label className="omni-label" htmlFor="nova-tarefa-data">
                            Vencimento
                          </label>
                          <input
                            id="nova-tarefa-data"
                            type="date"
                            value={tarefaVencimento}
                            onChange={(e) => setTarefaVencimento(e.target.value)}
                            className="omni-input num"
                          />
                        </div>
                        <div className="omni-field">
                          <label className="omni-label" htmlFor="nova-tarefa-prioridade">
                            Prioridade
                          </label>
                          <select
                            id="nova-tarefa-prioridade"
                            value={tarefaPrioridade}
                            onChange={(e) => setTarefaPrioridade(e.target.value as any)}
                            className="omni-select"
                          >
                            <option value="baixa">Baixa</option>
                            <option value="media">Média</option>
                            <option value="alta">Alta</option>
                            <option value="urgente">Urgente</option>
                          </select>
                        </div>
                      </div>
                      <div className="omni-card__footer">
                        <button
                          type="button"
                          onClick={() => setShowNewTaskForm(false)}
                          className="omni-btn omni-btn--ghost omni-btn--sm"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (!tarefaTitulo.trim()) {
                              setTarefaTituloInvalido(true);
                              toast.error("Informe o título da tarefa!");
                              return;
                            }
                            addTarefaMutation.mutate({
                              titulo: tarefaTitulo,
                              data_vencimento: tarefaVencimento,
                              prioridade: tarefaPrioridade,
                            });
                          }}
                          disabled={addTarefaMutation.isPending}
                          data-loading={addTarefaMutation.isPending ? "true" : undefined}
                          className="omni-btn omni-btn--primary omni-btn--sm"
                        >
                          Salvar tarefa
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {isTarefasLoading ? (
                  <div className="omni-card__body flex flex-col gap-2">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="omni-skeleton h-row w-full" />
                    ))}
                  </div>
                ) : tarefas.length === 0 ? (
                  <div className="omni-empty">
                    <span className="omni-empty__art">
                      <CheckSquare />
                    </span>
                    <h4>Nenhuma tarefa neste negócio</h4>
                    <p>
                      Use "Nova tarefa" para agendar o próximo follow-up e não perder o timing da
                      negociação.
                    </p>
                  </div>
                ) : (
                  <div className="omni-list">
                    {tarefas.map((t) => {
                      const isDone = t.status === "concluida";
                      const prio = PRIORIDADE_MAP[t.prioridade] || PRIORIDADE_MAP.media;

                      return (
                        <div key={t.tarefa_id} className="omni-list__item group">
                          <button
                            type="button"
                            onClick={() => toggleTarefaStatusMutation.mutate(t)}
                            className="shrink-0 rounded-xs text-ink-faint transition-colors hover:text-success"
                            title={isDone ? "Reabrir tarefa" : "Marcar como concluída"}
                          >
                            {isDone ? (
                              <CheckCircle2 className="size-5 text-success" />
                            ) : (
                              <Square className="size-5" />
                            )}
                            <span className="omni-sr">
                              {isDone ? "Reabrir" : "Concluir"} {t.titulo}
                            </span>
                          </button>

                          <div className="min-w-0 flex-1">
                            <p
                              className={cn(
                                "truncate text-sm font-medium text-ink",
                                isDone && "text-ink-3 line-through",
                              )}
                            >
                              {t.titulo}
                            </p>
                            {t.descricao && <p className="omni-small truncate">{t.descricao}</p>}
                          </div>

                          {t.data_vencimento && (
                            <span className="num omni-small flex shrink-0 items-center gap-1">
                              <CalendarDays className="size-3.5" />{" "}
                              {formatDateOnly(t.data_vencimento)}
                            </span>
                          )}

                          <span className={cn("omni-badge shrink-0", prio.badge)}>
                            {prio.label}
                          </span>

                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Excluir a tarefa "${t.titulo}"?`)) {
                                deleteTarefaMutation.mutate(t.tarefa_id);
                              }
                            }}
                            className="omni-btn omni-btn--ghost omni-btn--icon omni-btn--sm shrink-0 text-danger hover:bg-danger-soft"
                            title={`Excluir ${t.titulo}`}
                          >
                            <Trash2 />
                            <span className="omni-sr">Excluir {t.titulo}</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            {/* ══════ Aba 3: anotações ══════ */}
            {activeTab === "anotacoes" && (
              <section className="omni-card">
                <div className="omni-card__header">
                  <div>
                    <h2 className="omni-h4">Anotações internas</h2>
                    <p className="omni-small mt-0.5">
                      Combinados, escopo e histórico da negociação
                    </p>
                  </div>
                  <span className="omni-badge omni-badge--outline">
                    {anotacoes.length} {anotacoes.length === 1 ? "anotação" : "anotações"}
                  </span>
                </div>

                <div className="omni-card__body omni-stack">
                  <div className="omni-field">
                    <label className="omni-label" htmlFor="nova-anotacao">
                      Nova anotação
                    </label>
                    <textarea
                      id="nova-anotacao"
                      value={anotacaoTexto}
                      onChange={(e) => setAnotacaoTexto(e.target.value)}
                      placeholder="Ex.: cliente pediu 10% de desconto no plano anual; reunião remarcada para quinta."
                      rows={3}
                      className="omni-textarea"
                    />
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          if (!anotacaoTexto.trim()) return;
                          addAnotacaoMutation.mutate(anotacaoTexto);
                        }}
                        disabled={addAnotacaoMutation.isPending || !anotacaoTexto.trim()}
                        data-loading={addAnotacaoMutation.isPending ? "true" : undefined}
                        className="omni-btn omni-btn--primary omni-btn--sm"
                      >
                        <Plus /> Salvar anotação
                      </button>
                    </div>
                  </div>
                </div>

                {anotacoes.length === 0 ? (
                  <div className="omni-empty">
                    <span className="omni-empty__art">
                      <StickyNote />
                    </span>
                    <h4>Nenhuma anotação ainda</h4>
                    <p>
                      Registre o que foi combinado na conversa para o time inteiro chegar junto na
                      próxima interação.
                    </p>
                  </div>
                ) : (
                  <div className="omni-card__body grid gap-3 border-t border-line-subtle md:grid-cols-2">
                    {anotacoes.map((note) => (
                      <article
                        key={note.anotacao_id}
                        className="omni-card omni-card--inset group flex flex-col justify-between"
                      >
                        <div className="omni-card__body p-4">
                          <div className="flex items-center justify-between gap-2 border-b border-line-subtle pb-2">
                            <span className="flex items-center gap-1.5 text-xs font-semibold text-ink-2">
                              <User className="size-3" /> {note.autor_nome || "Omni"}
                            </span>
                            <span className="num omni-small">{formatDateTime(note.criado_em)}</span>
                          </div>
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink">
                            {note.conteudo}
                          </p>
                        </div>
                        <div className="flex justify-end px-4 pb-3">
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm("Tem certeza que deseja excluir esta anotação?")) {
                                deleteAnotacaoMutation.mutate(note.anotacao_id);
                              }
                            }}
                            className="omni-btn omni-btn--quiet omni-btn--sm text-danger opacity-0 transition-opacity group-hover:opacity-100"
                          >
                            <Trash2 /> Excluir
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Motivo de Perda */}
      {isLossModalOpen && (
        <div
          className="omni-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-modal-perda-lead"
        >
          <div className="omni-modal">
            <div className="omni-modal__header">
              <div>
                <h2 id="titulo-modal-perda-lead" className="omni-h4">
                  Registrar motivo da perda
                </h2>
                <p className="omni-small mt-1">
                  O motivo escolhido alimenta o diagnóstico de gargalos em Relatórios.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsLossModalOpen(false)}
                className="omni-btn omni-btn--ghost omni-btn--icon omni-btn--sm"
              >
                <X />
                <span className="omni-sr">Fechar</span>
              </button>
            </div>

            <div className="omni-modal__body">
              {motivosPerda.filter((m) => m.motivo_ativo).length === 0 ? (
                <div className="omni-empty">
                  <h4>Nenhum motivo cadastrado</h4>
                  <p>Cadastre os motivos de perda em Configurações para poder classificar aqui.</p>
                </div>
              ) : (
                <div className="omni-stack-2 max-h-60 overflow-y-auto scrollbar-slim">
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
                        className="w-full rounded-md border border-line bg-surface p-3 text-left text-sm font-medium text-ink transition-colors duration-[var(--omni-dur-fast)] hover:border-primary hover:bg-primary-soft"
                      >
                        {m.motivo_nome}
                      </button>
                    ))}
                </div>
              )}
            </div>

            <div className="omni-modal__footer">
              <button
                type="button"
                onClick={() => setIsLossModalOpen(false)}
                className="omni-btn omni-btn--ghost"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
