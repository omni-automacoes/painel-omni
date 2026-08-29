import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";
import {
  Search,
  SlidersHorizontal,
  Plus,
  X,
  Building2,
  Phone,
  Mail,
  CalendarDays,
  MoreHorizontal,
  Bot,
  DollarSign,
  Tag,
  CheckCircle2,
  XCircle,
  User,
  Loader2,
  Sparkles,
  Filter,
  AlertCircle,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/negocios")({
  head: () => ({
    meta: [
      { title: "Negócios · Funil de vendas no Omni" },
      {
        name: "description",
        content:
          "Quadro Kanban de negócios do Omni: acompanhe cada oportunidade da prospecção ao fechamento.",
      },
      { property: "og:title", content: "Negócios · Funil de vendas no Omni" },
      {
        property: "og:description",
        content: "Kanban de oportunidades, filtros e ficha completa de cada negócio.",
      },
    ],
  }),
  component: Negocios,
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
  lead_status: string | null;
  lead_etapa_funil: string | null;
  ativo_ia?: boolean | null;
  utm_data?: string | UtmData | null;
  lead_valor?: number | string | null;
  motivo_perda_id?: string | null;
};

type MotivoPerda = {
  idx?: number;
  motivo_id: string;
  motivo_nome: string;
  motivo_ativo: boolean;
  criado_em?: string;
};

/* ─── Funnel Default Stages (Enum Postgres) ─── */
const DEFAULT_STAGES = [
  "Novo Lead",
  "Tentando Contato",
  "Contato Realizado",
  "Lead Qualificado",
  "Reunião Agendada",
  "Reunião Realizada",
  "Orçamento Enviado",
  "Venda Realizada",
];

/* ─── Helper Functions ─── */
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

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "short",
    }).format(d);
  } catch {
    return dateStr;
  }
}

function formatDateTimeFull(dateStr: string | null | undefined): string {
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

function getInitials(name: string | null | undefined): string {
  if (!name || !name.trim()) return "LD";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/* ─── Main Component ─── */
function Negocios() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("Aberto");
  const [origemFilter, setOrigemFilter] = useState<string>("Todas");
  const [isNewDealOpen, setIsNewDealOpen] = useState(false);

  /* Fetch leads from Supabase */
  const {
    data: leads = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<Lead[]>({
    queryKey: ["leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .order("criado_em", { ascending: false });

      if (error) {
        toast.error("Erro ao carregar leads: " + error.message);
        throw error;
      }
      return (data as Lead[]) || [];
    },
    enabled: !!user,
  });

  /* Fetch motivos_perda from Supabase */
  const { data: motivosPerda = [] } = useQuery<MotivoPerda[]>({
    queryKey: ["motivos_perda"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("motivos_perda")
        .select("*")
        .order("motivo_nome", { ascending: true });

      if (error) {
        console.warn("Erro ao buscar motivos de perda:", error.message);
        return [];
      }
      return (data as MotivoPerda[]) || [];
    },
    enabled: !!user,
  });

  /* Filtered leads */
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const nome = (lead.lead_nome || "").toLowerCase();
        const tel = (lead.lead_telefone || "").toLowerCase();
        const email = (lead.lead_email || "").toLowerCase();
        const origem = (lead.lead_origem || "").toLowerCase();
        const utm = parseUtmData(lead.utm_data);
        const adTitle = (utm?.ad_title || "").toLowerCase();
        const sourceApp = (utm?.source_app || "").toLowerCase();

        const matches =
          nome.includes(q) ||
          tel.includes(q) ||
          email.includes(q) ||
          origem.includes(q) ||
          adTitle.includes(q) ||
          sourceApp.includes(q);

        if (!matches) return false;
      }

      // Status filter
      if (statusFilter !== "Todos") {
        if ((lead.lead_status || "Aberto") !== statusFilter) return false;
      }

      // Origem filter
      if (origemFilter !== "Todas") {
        if ((lead.lead_origem || "Outros") !== origemFilter) return false;
      }

      return true;
    });
  }, [leads, searchQuery, statusFilter, origemFilter]);

  /* Unique origins for filter dropdown */
  const origensDisponiveis = useMemo(() => {
    const set = new Set<string>();
    leads.forEach((l) => {
      if (l.lead_origem) set.add(l.lead_origem);
    });
    return Array.from(set);
  }, [leads]);

  /* Total Funnel Value */
  const totalFunnelValue = useMemo(() => {
    return filteredLeads.reduce((acc, lead) => acc + parseNumberValue(lead.lead_valor), 0);
  }, [filteredLeads]);

  /* Columns grouping */
  const columns = useMemo(() => {
    // Collect all stages present
    const stagesSet = new Set<string>(DEFAULT_STAGES);
    filteredLeads.forEach((l) => {
      const stage = l.lead_etapa_funil?.trim() || "Novo Lead";
      stagesSet.add(stage);
    });

    const stagesList = Array.from(stagesSet);

    return stagesList.map((stage) => {
      const stageDeals = filteredLeads.filter((l) => {
        const currentStage = l.lead_etapa_funil?.trim() || "Novo Lead";
        return currentStage === stage;
      });

      const totalVal = stageDeals.reduce((sum, l) => sum + parseNumberValue(l.lead_valor), 0);

      return {
        stage,
        total: totalVal,
        deals: stageDeals,
      };
    });
  }, [filteredLeads]);

  return (
    <AppShell
      title="Negócios"
      subtitle={`Funil comercial · ${leads.length} ${leads.length === 1 ? "oportunidade ativa" : "oportunidades ativas"}`}
      actions={
        <button
          onClick={() => setIsNewDealOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground shadow-sm transition-all hover:bg-accent/90 hover:-translate-y-px"
        >
          <Plus className="size-4" /> Novo negócio
        </button>
      }
      flush
    >
      <div className="flex h-[calc(100vh-4rem)] flex-col">
        {/* Header Filters Bar */}
        <div className="flex flex-wrap items-center gap-3 border-b border-border bg-card px-6 py-3">
          <div className="relative min-w-[220px] flex-1 md:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar negócio, telefone ou e-mail..."
              className="h-9 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:border-accent focus:ring-2 focus:ring-accent/30"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          {/* Status filter buttons */}
          <div className="flex items-center gap-1">
            <span className="mr-1 text-xs text-muted-foreground font-medium flex items-center gap-1">
              <Filter className="size-3.5" /> Status:
            </span>
            {["Todos", "Aberto", "Ganho", "Perdido"].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={cn(
                  "h-8 rounded-lg px-2.5 text-xs font-semibold transition-all",
                  statusFilter === st
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                )}
              >
                {st}
              </button>
            ))}
          </div>

          {/* Origem filter dropdown */}
          {origensDisponiveis.length > 0 && (
            <select
              value={origemFilter}
              onChange={(e) => setOrigemFilter(e.target.value)}
              className="h-8 rounded-lg border border-border bg-background px-3 text-xs font-medium text-muted-foreground outline-none hover:border-accent focus:border-accent"
            >
              <option value="Todas">Todas as Origens</option>
              {origensDisponiveis.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          )}

          <span className="ml-auto text-sm text-muted-foreground">
            Total no funil:{" "}
            <strong className="text-foreground">{formatCurrency(totalFunnelValue)}</strong>
          </span>
        </div>

        {/* Kanban Board Container */}
        {isLoading ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Loader2 className="size-8 animate-spin text-accent" />
              <p className="text-sm font-medium">Carregando negócios reais...</p>
            </div>
          </div>
        ) : isError ? (
          <div className="flex flex-1 items-center justify-center p-6">
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
              <p className="font-bold text-destructive">Erro ao carregar dados do Supabase</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {(error as Error)?.message || "Não foi possível conectar ao banco."}
              </p>
              <button
                onClick={() => refetch()}
                className="mt-4 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Tentar novamente
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 gap-4 overflow-x-auto scrollbar-slim p-6">
            {columns.map((col) => (
              <div key={col.stage} className="flex w-[310px] shrink-0 flex-col">
                {/* Column Header */}
                <div className="flex items-center justify-between rounded-t-xl border-b-2 border-accent bg-card px-4 py-3 shadow-xs">
                  <div>
                    <p className="text-sm font-bold text-foreground">{col.stage}</p>
                    <p className="text-xs text-muted-foreground">
                      {col.deals.length} {col.deals.length === 1 ? "negócio" : "negócios"} ·{" "}
                      {formatCurrency(col.total)}
                    </p>
                  </div>
                  <span className="grid size-6 place-items-center rounded-full bg-secondary text-xs font-semibold text-muted-foreground">
                    {col.deals.length}
                  </span>
                </div>

                {/* Column Body / Cards List */}
                <div className="flex flex-1 flex-col gap-3 rounded-b-xl bg-secondary/60 p-3 overflow-y-auto scrollbar-slim">
                  {col.deals.map((lead) => {
                    const utm = parseUtmData(lead.utm_data);
                    const displayName = lead.lead_nome || lead.lead_telefone || "Sem nome";
                    const displayVal = formatCurrency(lead.lead_valor);
                    const tag = lead.lead_origem || utm?.source_app || utm?.ad_title || "Direct";

                    const motivoObj = lead.motivo_perda_id
                      ? motivosPerda.find((m) => m.motivo_id === lead.motivo_perda_id)
                      : null;

                    return (
                      <button
                        key={lead.lead_id}
                        onClick={() => navigate({ to: "/lead/$leadId", params: { leadId: lead.lead_id } })}
                        className="group relative rounded-xl border border-border bg-card p-4 text-left shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:border-accent hover:shadow-md"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold leading-snug text-foreground group-hover:text-accent">
                            {displayName}
                          </p>
                          <div className="flex items-center gap-1">
                            {lead.lead_status === "Perdido" && (
                              <span
                                className="inline-flex shrink-0 items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-bold text-destructive"
                                title={motivoObj ? `Motivo: ${motivoObj.motivo_nome}` : "Perdido"}
                              >
                                <XCircle className="size-3" />{" "}
                                {motivoObj ? motivoObj.motivo_nome : "Perdido"}
                              </span>
                            )}
                          </div>
                        </div>

                        {lead.lead_telefone && (
                          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Phone className="size-3.5 text-muted-foreground/70" />{" "}
                            {lead.lead_telefone}
                          </p>
                        )}

                        <p className="mt-3 text-lg font-extrabold text-primary">{displayVal}</p>

                        <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-3">
                          <span className="max-w-[140px] truncate rounded-md bg-primary-soft px-2 py-0.5 text-[11px] font-semibold text-primary">
                            {tag}
                          </span>
                          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <CalendarDays className="size-3.5" /> {formatDate(lead.criado_em)}
                            <span
                              className="grid size-6 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground"
                              title={lead.lead_nome || "Lead"}
                            >
                              {getInitials(lead.lead_nome)}
                            </span>
                          </span>
                        </div>
                      </button>
                    );
                  })}

                  {col.deals.length === 0 && (
                    <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-border/80 p-4 text-center">
                      <p className="text-xs text-muted-foreground">Nenhum negócio nesta etapa</p>
                    </div>
                  )}

                  <button
                    onClick={() => setIsNewDealOpen(true)}
                    className="rounded-xl border border-dashed border-border py-2 text-xs font-semibold text-muted-foreground transition-colors hover:border-accent hover:bg-card hover:text-foreground"
                  >
                    + Adicionar negócio
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Side Drawer for Lead Details */}
      {selectedLead && (
        <DealDrawer
          lead={selectedLead}
          motivosPerda={motivosPerda}
          onClose={() => setSelectedLead(null)}
          onUpdate={() => {
            queryClient.invalidateQueries({ queryKey: ["leads"] });
          }}
        />
      )}

      {/* Modal for Creating New Lead */}
      {isNewDealOpen && (
        <NewDealModal
          onClose={() => setIsNewDealOpen(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["leads"] });
            setIsNewDealOpen(false);
          }}
        />
      )}
    </AppShell>
  );
}

/* ─── Deal Drawer Component ─── */
function DealDrawer({
  lead,
  motivosPerda,
  onClose,
  onUpdate,
}: {
  lead: Lead;
  motivosPerda: MotivoPerda[];
  onClose: () => void;
  onUpdate: () => void;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [currentStage, setCurrentStage] = useState<string>(
    lead.lead_etapa_funil || "Novo Lead"
  );
  const [currentStatus, setCurrentStatus] = useState<string>(
    lead.lead_status || "Aberto"
  );
  const [currentValor, setCurrentValor] = useState<string>(
    lead.lead_valor !== null && lead.lead_valor !== undefined
      ? String(lead.lead_valor)
      : ""
  );
  const [currentMotivoPerdaId, setCurrentMotivoPerdaId] = useState<string | null>(
    lead.motivo_perda_id || null
  );

  const [isLossModalOpen, setIsLossModalOpen] = useState(false);

  const utm = parseUtmData(lead.utm_data);
  const displayName = lead.lead_nome || lead.lead_telefone || "Sem nome";

  /* Update mutation */
  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<Lead>) => {
      const { error } = await supabase
        .from("leads")
        .update(updates)
        .eq("lead_id", lead.lead_id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      if (variables.lead_status === "Ganho" || variables.lead_etapa_funil === "Ganho") {
        toast.success("🏆 Lead Ganho! Cliente cadastrado automaticamente.");
      } else {
        toast.success("Negócio atualizado com sucesso!");
      }
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      onUpdate();
    },
    onError: (err: Error) => {
      toast.error("Erro ao atualizar negócio: " + err.message);
    },
  });

  const handleStageChange = (newStage: string) => {
    setCurrentStage(newStage);
    updateMutation.mutate({ lead_etapa_funil: newStage });
  };

  const handleStatusChange = (newStatus: string) => {
    if (newStatus === "Perdido") {
      setIsLossModalOpen(true);
      return;
    }
    setCurrentStatus(newStatus);
    // Clear motivo_perda_id if not lost
    setCurrentMotivoPerdaId(null);
    updateMutation.mutate({ lead_status: newStatus, motivo_perda_id: null });
  };

  const handleSaveValor = () => {
    const num = parseNumberValue(currentValor);
    updateMutation.mutate({ lead_valor: num });
  };

  const markAsGanho = () => {
    setCurrentStage("Venda Realizada");
    setCurrentStatus("Ganho");
    setCurrentMotivoPerdaId(null);
    updateMutation.mutate({
      lead_etapa_funil: "Venda Realizada",
      lead_status: "Ganho",
      motivo_perda_id: null,
    });
  };

  const markAsPerdido = () => {
    setIsLossModalOpen(true);
  };

  const handleConfirmLoss = (motivoId: string | null) => {
    setCurrentStatus("Perdido");
    setCurrentMotivoPerdaId(motivoId);
    updateMutation.mutate({
      lead_status: "Perdido",
      motivo_perda_id: motivoId,
    });
    setIsLossModalOpen(false);
  };

  return (
    <>
      <div className="fixed inset-0 z-40 flex justify-end bg-foreground/40 backdrop-blur-[2px]">
        <button className="flex-1" onClick={onClose} aria-label="Fechar" />
        <aside className="flex h-full w-full max-w-[560px] flex-col bg-card shadow-[var(--shadow-pop)] animate-in slide-in-from-right duration-200">
          {/* Header */}
          <header className="bg-primary px-6 py-5 text-primary-foreground">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-primary-foreground/70">
                  {lead.lead_origem || utm?.source_app || "Lead do Sistema"}
                </p>
                <h2 className="text-xl font-extrabold">{displayName}</h2>
                <p className="mt-1 text-2xl font-extrabold text-accent">
                  {formatCurrency(currentValor)}
                </p>
              </div>
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 text-primary-foreground/80 hover:bg-white/10 hover:text-primary-foreground"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={markAsGanho}
                disabled={updateMutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-bold text-accent-foreground shadow-sm transition-transform hover:-translate-y-px"
              >
                <CheckCircle2 className="size-4" /> Marcar como ganho
              </button>
              <button
                onClick={markAsPerdido}
                disabled={updateMutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/30 px-3 py-1.5 text-xs font-bold transition-colors hover:bg-white/10"
              >
                <XCircle className="size-4" /> Registrar perda
              </button>
            </div>
          </header>

          {/* Content */}
          <div className="flex-1 overflow-y-auto scrollbar-slim p-6 space-y-6">
            {/* Quick Controls Section */}
            <section className="rounded-xl border border-border bg-secondary/30 p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    Etapa do Funil
                  </label>
                  <select
                    value={currentStage}
                    onChange={(e) => handleStageChange(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm font-semibold outline-none focus:border-accent"
                  >
                    {DEFAULT_STAGES.map((stg) => (
                      <option key={stg} value={stg}>
                        {stg}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    Status do Lead
                  </label>
                  <select
                    value={currentStatus}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm font-semibold outline-none focus:border-accent"
                  >
                    <option value="Aberto">Aberto</option>
                    <option value="Ganho">Ganho</option>
                    <option value="Perdido">Perdido</option>
                  </select>
                </div>
              </div>

              {/* Loss Reason display/edit if status is Perdido */}
              {currentStatus === "Perdido" && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wide text-destructive flex items-center gap-1.5">
                      <XCircle className="size-4" /> Motivo da Perda
                    </label>
                    <button
                      onClick={() => setIsLossModalOpen(true)}
                      className="text-xs font-semibold text-accent hover:underline"
                    >
                      Alterar motivo
                    </button>
                  </div>
                  <select
                    value={currentMotivoPerdaId || ""}
                    onChange={(e) => {
                      const val = e.target.value || null;
                      setCurrentMotivoPerdaId(val);
                      updateMutation.mutate({ motivo_perda_id: val });
                    }}
                    className="w-full rounded-lg border border-input bg-card px-3 py-2 text-xs font-semibold outline-none focus:border-accent"
                  >
                    <option value="">Nenhum motivo selecionado</option>
                    {motivosPerda
                      .filter((m) => m.motivo_ativo || m.motivo_id === currentMotivoPerdaId)
                      .map((m) => (
                        <option key={m.motivo_id} value={m.motivo_id}>
                          {m.motivo_nome}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Valor da Oportunidade (R$)
                </label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="number"
                    step="0.01"
                    value={currentValor}
                    onChange={(e) => setCurrentValor(e.target.value)}
                    onBlur={handleSaveValor}
                    placeholder="0,00"
                    className="h-9 flex-1 rounded-lg border border-input bg-card px-3 text-sm font-semibold outline-none focus:border-accent"
                  />
                  <button
                    onClick={handleSaveValor}
                    disabled={updateMutation.isPending}
                    className="h-9 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                  >
                    Salvar
                  </button>
                </div>
              </div>
            </section>

            {/* Customer Data */}
            <section className="rounded-xl border border-border p-4">
              <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Dados do cliente
              </h3>
              <dl className="mt-3 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Nome Completo</dt>
                  <dd className="font-semibold text-foreground">{lead.lead_nome || "Não informado"}</dd>
                </div>

                <div>
                  <dt className="text-xs text-muted-foreground">ID do Lead</dt>
                  <dd className="font-mono text-xs text-muted-foreground truncate" title={lead.lead_id}>
                    {lead.lead_id}
                  </dd>
                </div>

                <div className="flex items-center gap-2">
                  <Phone className="size-4 text-accent" />
                  <span className="font-medium">{lead.lead_telefone || "Não informado"}</span>
                </div>

                <div className="flex items-center gap-2">
                  <Mail className="size-4 text-accent" />
                  <span className="truncate font-medium">{lead.lead_email || "Não informado"}</span>
                </div>

                <div>
                  <dt className="text-xs text-muted-foreground">Origem</dt>
                  <dd className="font-medium">{lead.lead_origem || "Outros / Direct"}</dd>
                </div>
              </dl>
            </section>

            {/* Campaign / UTM Info */}
            {utm && (
              <section className="rounded-xl border border-border p-4">
                <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                  <Tag className="size-3.5 text-accent" /> Dados de Anúncio / Meta Ads
                </h3>
                <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
                  {utm.ad_title && (
                    <div className="col-span-2">
                      <dt className="text-muted-foreground">Título do Anúncio</dt>
                      <dd className="font-bold text-foreground">{utm.ad_title}</dd>
                    </div>
                  )}
                  {utm.source_app && (
                    <div>
                      <dt className="text-muted-foreground">Aplicativo de Origem</dt>
                      <dd className="font-semibold capitalize">{utm.source_app}</dd>
                    </div>
                  )}
                  {utm.entry_point && (
                    <div>
                      <dt className="text-muted-foreground">Ponto de Entrada</dt>
                      <dd className="font-semibold">{utm.entry_point}</dd>
                    </div>
                  )}
                  {utm.ad_id && (
                    <div>
                      <dt className="text-muted-foreground">ID do Anúncio</dt>
                      <dd className="font-mono text-muted-foreground">{utm.ad_id}</dd>
                    </div>
                  )}
                </dl>
              </section>
            )}

            {/* Activity / Timeline */}
            <section className="rounded-xl border border-border p-4">
              <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Histórico & Linha do tempo
              </h3>
              <ol className="mt-4 space-y-4 border-l-2 border-border pl-5 text-xs">
                <li className="relative">
                  <span className="absolute -left-[27px] top-1 size-3 rounded-full border-2 border-card bg-accent" />
                  <p className="font-semibold text-foreground">Lead criado no sistema</p>
                  <p className="text-muted-foreground">{formatDateTimeFull(lead.criado_em)}</p>
                </li>
                {lead.lead_etapa_funil && (
                  <li className="relative">
                    <span className="absolute -left-[27px] top-1 size-3 rounded-full border-2 border-card bg-primary" />
                    <p className="font-semibold text-foreground">
                      Etapa atual: <span className="text-accent font-bold">{lead.lead_etapa_funil}</span>
                    </p>
                    <p className="text-muted-foreground">Atualizado recentemente</p>
                  </li>
                )}
              </ol>
            </section>
          </div>
        </aside>
      </div>

      {/* Modal to select loss reason */}
      {isLossModalOpen && (
        <LossReasonModal
          motivos={motivosPerda}
          currentMotivoId={currentMotivoPerdaId}
          onClose={() => setIsLossModalOpen(false)}
          onConfirm={handleConfirmLoss}
          isPending={updateMutation.isPending}
        />
      )}
    </>
  );
}

/* ─── Loss Reason Modal Component ─── */
function LossReasonModal({
  motivos,
  currentMotivoId,
  onClose,
  onConfirm,
  isPending,
}: {
  motivos: MotivoPerda[];
  currentMotivoId: string | null;
  onClose: () => void;
  onConfirm: (motivoId: string | null) => void;
  isPending?: boolean;
}) {
  const activeMotivos = motivos.filter(
    (m) => m.motivo_ativo || m.motivo_id === currentMotivoId
  );
  const [selectedId, setSelectedId] = useState<string>(
    currentMotivoId || (activeMotivos.length > 0 ? activeMotivos[0].motivo_id : "")
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-xs p-4">
      <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-pop border border-border animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-2">
            <XCircle className="size-5 text-destructive" />
            <h2 className="text-lg font-bold text-foreground">Motivo da Perda</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <p className="text-xs text-muted-foreground">
            Selecione o motivo pelo qual este negócio foi perdido:
          </p>

          {activeMotivos.length > 0 ? (
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {activeMotivos.map((m) => (
                <label
                  key={m.motivo_id}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition-all",
                    selectedId === m.motivo_id
                      ? "border-destructive bg-destructive/5 font-semibold text-foreground"
                      : "border-border bg-background hover:bg-secondary/60 text-muted-foreground"
                  )}
                >
                  <input
                    type="radio"
                    name="motivo_perda"
                    value={m.motivo_id}
                    checked={selectedId === m.motivo_id}
                    onChange={() => setSelectedId(m.motivo_id)}
                    className="accent-destructive"
                  />
                  <span className="text-sm">{m.motivo_nome}</span>
                </label>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
              Nenhum motivo de perda cadastrado ou ativo.
            </div>
          )}

          <div className="mt-6 flex justify-end gap-2 border-t border-border pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => onConfirm(selectedId || null)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-destructive px-4 py-2 text-xs font-bold text-destructive-foreground shadow-sm hover:bg-destructive/90"
            >
              {isPending && <Loader2 className="size-3.5 animate-spin" />}
              Confirmar Perda
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── New Deal Modal Component ─── */
function NewDealModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { user } = useAuth();
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [origem, setOrigem] = useState("Meta Ads");
  const [etapa, setEtapa] = useState("Novo Lead");
  const [valor, setValor] = useState("");

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("leads").insert([
        {
          lead_nome: nome.trim() || null,
          lead_telefone: telefone.trim() || null,
          lead_email: email.trim() || null,
          lead_origem: origem.trim() || null,
          lead_etapa_funil: etapa,
          lead_status: "Aberto",
          lead_valor: parseNumberValue(valor),
          user_id: user?.id || null,
          ativo_ia: true,
        },
      ]);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Novo negócio criado com sucesso!");
      onSuccess();
    },
    onError: (err: Error) => {
      toast.error("Erro ao criar negócio: " + err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() && !telefone.trim()) {
      toast.error("Preencha pelo menos o nome ou telefone do lead.");
      return;
    }
    createMutation.mutate();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-xs p-4">
      <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-pop border border-border animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <h2 className="text-lg font-bold text-foreground">Novo Negócio</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase">
              Nome do Lead / Empresa
            </label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: João da Silva"
              className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-accent"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase">
                Telefone
              </label>
              <input
                type="text"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="5514999999999"
                className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-accent"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase">
                E-mail
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="lead@email.com"
                className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-accent"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase">
                Etapa do Funil
              </label>
              <select
                value={etapa}
                onChange={(e) => setEtapa(e.target.value)}
                className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-3 text-xs font-semibold outline-none focus:border-accent"
              >
                {DEFAULT_STAGES.map((stg) => (
                  <option key={stg} value={stg}>
                    {stg}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase">
                Valor Estimado (R$)
              </label>
              <input
                type="number"
                step="0.01"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="1500,00"
                className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-accent"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase">
              Origem do Lead
            </label>
            <input
              type="text"
              value={origem}
              onChange={(e) => setOrigem(e.target.value)}
              placeholder="Ex: Meta Ads, Indicação, Outbound"
              className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-accent"
            />
          </div>

          <div className="mt-6 flex justify-end gap-2 border-t border-border pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-xs font-bold text-accent-foreground shadow-sm hover:bg-accent/90"
            >
              {createMutation.isPending && <Loader2 className="size-3.5 animate-spin" />}
              Criar Negócio
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

