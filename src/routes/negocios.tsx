import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";
import {
  Search,
  Plus,
  X,
  Phone,
  Mail,
  CalendarDays,
  Tag,
  CheckCircle2,
  XCircle,
  Filter,
  Inbox,
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

/* Situação do negócio: cor sempre acompanhada de rótulo em texto. */
const STATUS_BADGE: Record<string, string> = {
  Aberto: "omni-badge--info",
  Ganho: "omni-badge--success",
  Perdido: "omni-badge--danger",
};

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
      subtitle={`${leads.length} ${leads.length === 1 ? "oportunidade" : "oportunidades"} no funil comercial`}
      actions={
        <button
          type="button"
          onClick={() => setIsNewDealOpen(true)}
          className="omni-btn omni-btn--primary omni-btn--sm"
        >
          <Plus /> Novo negócio
        </button>
      }
      flush
    >
      <div className="flex h-[calc(100vh-var(--omni-topbar-h))] flex-col">
        {/* ── Filtros ── */}
        <div className="flex flex-wrap items-center gap-3 border-b border-line bg-surface px-5 py-3">
          <div className="omni-input-group min-w-[220px] flex-1 md:max-w-sm">
            <Search />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar negócio, telefone ou e-mail"
              aria-label="Buscar negócio"
              className="omni-input pr-9"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="omni-suffix cursor-pointer rounded-xs hover:text-ink"
              >
                <X className="static size-3.5" />
                <span className="omni-sr">Limpar busca</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-xs font-medium text-ink-3">
              <Filter className="size-3.5" /> Situação
            </span>
            <div className="omni-btn-group" role="group" aria-label="Filtrar por situação">
              {["Todos", "Aberto", "Ganho", "Perdido"].map((st) => (
                <button
                  key={st}
                  type="button"
                  aria-pressed={statusFilter === st}
                  onClick={() => setStatusFilter(st)}
                  className="omni-btn omni-btn--secondary omni-btn--sm"
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {origensDisponiveis.length > 0 && (
            <select
              value={origemFilter}
              onChange={(e) => setOrigemFilter(e.target.value)}
              aria-label="Filtrar por origem"
              className="omni-select w-auto"
            >
              <option value="Todas">Todas as origens</option>
              {origensDisponiveis.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          )}

          <span className="ml-auto text-sm text-ink-3">
            Total no funil{" "}
            <span className="num font-semibold text-ink">{formatCurrency(totalFunnelValue)}</span>
          </span>
        </div>

        {/* ── Quadro ── */}
        {isLoading ? (
          <div className="omni-scroll-x flex flex-1 gap-4 p-5">
            {DEFAULT_STAGES.map((s) => (
              <div key={s} className="omni-skeleton h-[420px] w-[300px] shrink-0" />
            ))}
          </div>
        ) : isError ? (
          <div className="flex flex-1 items-center justify-center p-6">
            <div className="omni-alert omni-alert--danger max-w-lg">
              <XCircle className="omni-alert__icon" />
              <div className="omni-alert__body">
                <p className="omni-alert__title">Não foi possível carregar os negócios</p>
                <p className="omni-alert__text">
                  {(error as Error)?.message ||
                    "A conexão com o banco falhou. Verifique a internet e tente de novo."}
                </p>
                <button
                  type="button"
                  onClick={() => refetch()}
                  className="omni-btn omni-btn--secondary omni-btn--sm mt-3"
                >
                  Tentar de novo
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="omni-scroll-x flex flex-1 gap-4 p-5 scrollbar-slim">
            {columns.map((col) => (
              <section key={col.stage} className="flex w-[300px] shrink-0 flex-col">
                <div className="flex items-start justify-between gap-2 rounded-t-lg border border-b-0 border-line bg-surface px-4 py-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-semibold text-ink">{col.stage}</h2>
                    <p className="num omni-small">
                      {col.deals.length} {col.deals.length === 1 ? "negócio" : "negócios"} ·{" "}
                      {formatCurrency(col.total)}
                    </p>
                  </div>
                  <span className="omni-badge omni-badge--outline shrink-0">
                    {col.deals.length}
                  </span>
                </div>

                <div className="flex flex-1 flex-col gap-3 overflow-y-auto rounded-b-lg border border-line bg-surface-2 p-3 scrollbar-slim">
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
                        type="button"
                        onClick={() =>
                          navigate({ to: "/lead/$leadId", params: { leadId: lead.lead_id } })
                        }
                        className="omni-card group w-full cursor-pointer p-4 text-left transition-colors duration-[var(--omni-dur-fast)] ease-omni hover:border-line-strong"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold leading-snug text-ink">
                            {displayName}
                          </p>
                          {lead.lead_status === "Perdido" && (
                            <span
                              className="omni-badge omni-badge--danger shrink-0"
                              title={motivoObj ? `Motivo: ${motivoObj.motivo_nome}` : "Perdido"}
                            >
                              <XCircle />
                              {motivoObj ? motivoObj.motivo_nome : "Perdido"}
                            </span>
                          )}
                          {lead.lead_status === "Ganho" && (
                            <span className="omni-badge omni-badge--success shrink-0">
                              <CheckCircle2 />
                              Ganho
                            </span>
                          )}
                        </div>

                        {lead.lead_telefone && (
                          <p className="num mt-1 flex items-center gap-1.5 text-xs text-ink-3">
                            <Phone className="size-3.5" /> {lead.lead_telefone}
                          </p>
                        )}

                        <p className="num mt-3 text-lg font-bold tracking-tight text-ink">
                          {displayVal}
                        </p>

                        <div className="mt-3 flex items-center justify-between gap-2 border-t border-line-subtle pt-3">
                          <span className="omni-badge omni-badge--brand max-w-[130px] truncate">
                            {tag}
                          </span>
                          <span className="num flex items-center gap-2 text-xs text-ink-3">
                            <CalendarDays className="size-3.5" /> {formatDate(lead.criado_em)}
                            <span
                              className="omni-avatar omni-avatar--sm"
                              title={lead.lead_nome || "Negócio"}
                            >
                              {getInitials(lead.lead_nome)}
                            </span>
                          </span>
                        </div>
                      </button>
                    );
                  })}

                  {col.deals.length === 0 && (
                    <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-line-strong px-4 py-6 text-center">
                      <Inbox className="size-5 text-ink-faint" />
                      <p className="omni-small">Nenhum negócio nesta etapa</p>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setIsNewDealOpen(true)}
                    className="rounded-md border border-dashed border-line-strong py-2 text-xs font-semibold text-ink-3 transition-colors duration-[var(--omni-dur-fast)] hover:border-primary hover:text-ink"
                  >
                    + Adicionar negócio
                  </button>
                </div>
              </section>
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
  const queryClient = useQueryClient();

  const [currentStage, setCurrentStage] = useState<string>(lead.lead_etapa_funil || "Novo Lead");
  const [currentStatus, setCurrentStatus] = useState<string>(lead.lead_status || "Aberto");
  const [currentValor, setCurrentValor] = useState<string>(
    lead.lead_valor !== null && lead.lead_valor !== undefined ? String(lead.lead_valor) : "",
  );
  const [currentMotivoPerdaId, setCurrentMotivoPerdaId] = useState<string | null>(
    lead.motivo_perda_id || null,
  );

  const [isLossModalOpen, setIsLossModalOpen] = useState(false);

  const utm = parseUtmData(lead.utm_data);
  const displayName = lead.lead_nome || lead.lead_telefone || "Sem nome";

  /* Update mutation */
  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<Lead>) => {
      const { error } = await supabase.from("leads").update(updates).eq("lead_id", lead.lead_id);

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
      <div className="fixed inset-0 z-[var(--omni-z-overlay)] flex justify-end bg-[var(--omni-overlay)]">
        <button className="flex-1 cursor-default" onClick={onClose} aria-label="Fechar painel" />
        <aside
          className="flex h-full w-full max-w-[560px] flex-col border-l border-line bg-surface shadow-lg"
          aria-label={`Negócio ${displayName}`}
        >
          <header className="border-b border-line bg-surface-2 px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="omni-eyebrow">
                  {lead.lead_origem || utm?.source_app || "Lead do sistema"}
                </p>
                <h2 className="omni-h3 mt-1 truncate">{displayName}</h2>
                <p className="num mt-1 text-2xl font-extrabold tracking-tight text-ink">
                  {formatCurrency(currentValor)}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="omni-btn omni-btn--ghost omni-btn--icon omni-btn--sm"
              >
                <X />
                <span className="omni-sr">Fechar</span>
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={markAsGanho}
                disabled={updateMutation.isPending}
                className="omni-btn omni-btn--primary omni-btn--sm"
              >
                <CheckCircle2 /> Marcar como ganho
              </button>
              <button
                type="button"
                onClick={markAsPerdido}
                disabled={updateMutation.isPending}
                className="omni-btn omni-btn--secondary omni-btn--sm"
              >
                <XCircle /> Registrar perda
              </button>
            </div>
          </header>

          <div className="omni-stack-6 flex-1 overflow-y-auto p-5 scrollbar-slim">
            {/* Controles rápidos */}
            <section className="omni-card omni-card--inset">
              <div className="omni-card__body omni-stack">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="omni-field">
                    <label className="omni-label" htmlFor="drawer-etapa">
                      Etapa do funil
                    </label>
                    <select
                      id="drawer-etapa"
                      value={currentStage}
                      onChange={(e) => handleStageChange(e.target.value)}
                      className="omni-select"
                    >
                      {DEFAULT_STAGES.map((stg) => (
                        <option key={stg} value={stg}>
                          {stg}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="omni-field">
                    <label className="omni-label" htmlFor="drawer-status">
                      Situação
                    </label>
                    <select
                      id="drawer-status"
                      value={currentStatus}
                      onChange={(e) => handleStatusChange(e.target.value)}
                      className="omni-select"
                    >
                      <option value="Aberto">Aberto</option>
                      <option value="Ganho">Ganho</option>
                      <option value="Perdido">Perdido</option>
                    </select>
                  </div>
                </div>

                {currentStatus === "Perdido" && (
                  <div className="omni-alert omni-alert--danger">
                    <XCircle className="omni-alert__icon" />
                    <div className="omni-alert__body">
                      <p className="omni-alert__title">Motivo da perda</p>
                      <select
                        aria-label="Motivo da perda"
                        value={currentMotivoPerdaId || ""}
                        onChange={(e) => {
                          const val = e.target.value || null;
                          setCurrentMotivoPerdaId(val);
                          updateMutation.mutate({ motivo_perda_id: val });
                        }}
                        className="omni-select mt-2"
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
                  </div>
                )}

                <div className="omni-field">
                  <label className="omni-label" htmlFor="drawer-valor">
                    Valor da oportunidade (R$)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="drawer-valor"
                      type="number"
                      step="0.01"
                      value={currentValor}
                      onChange={(e) => setCurrentValor(e.target.value)}
                      onBlur={handleSaveValor}
                      placeholder="0,00"
                      className="omni-input num flex-1"
                    />
                    <button
                      type="button"
                      onClick={handleSaveValor}
                      disabled={updateMutation.isPending}
                      className="omni-btn omni-btn--secondary"
                    >
                      Salvar
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* Dados do cliente */}
            <section className="omni-card">
              <div className="omni-card__header py-3">
                <h3 className="omni-eyebrow">Dados do cliente</h3>
                <span
                  className={cn("omni-badge", STATUS_BADGE[currentStatus] || "omni-badge--outline")}
                >
                  {currentStatus}
                </span>
              </div>
              <dl className="omni-card__body grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="omni-small">Nome completo</dt>
                  <dd className="font-medium text-ink">{lead.lead_nome || "Não informado"}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="omni-small">ID do negócio</dt>
                  <dd className="omni-code truncate" title={lead.lead_id}>
                    {lead.lead_id}
                  </dd>
                </div>
                <div>
                  <dt className="omni-small">Telefone</dt>
                  <dd className="num flex items-center gap-1.5 font-medium text-ink">
                    <Phone className="size-3.5 text-ink-faint" />
                    {lead.lead_telefone || "Não informado"}
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="omni-small">E-mail</dt>
                  <dd className="flex items-center gap-1.5 truncate font-medium text-ink">
                    <Mail className="size-3.5 shrink-0 text-ink-faint" />
                    {lead.lead_email || "Não informado"}
                  </dd>
                </div>
                <div>
                  <dt className="omni-small">Origem</dt>
                  <dd className="font-medium text-ink">{lead.lead_origem || "Outros / Direct"}</dd>
                </div>
              </dl>
            </section>

            {/* Campanha / UTM */}
            {utm && (
              <section className="omni-card">
                <div className="omni-card__header py-3">
                  <h3 className="omni-eyebrow flex items-center gap-1.5">
                    <Tag className="size-3.5" /> Dados do anúncio
                  </h3>
                </div>
                <dl className="omni-card__body grid grid-cols-2 gap-3 text-xs">
                  {utm.ad_title && (
                    <div className="col-span-2">
                      <dt className="omni-small">Título do anúncio</dt>
                      <dd className="font-semibold text-ink">{utm.ad_title}</dd>
                    </div>
                  )}
                  {utm.source_app && (
                    <div>
                      <dt className="omni-small">Aplicativo de origem</dt>
                      <dd className="font-medium capitalize text-ink">{utm.source_app}</dd>
                    </div>
                  )}
                  {utm.entry_point && (
                    <div>
                      <dt className="omni-small">Ponto de entrada</dt>
                      <dd className="font-medium text-ink">{utm.entry_point}</dd>
                    </div>
                  )}
                  {utm.ad_id && (
                    <div className="min-w-0">
                      <dt className="omni-small">ID do anúncio</dt>
                      <dd className="omni-code truncate">{utm.ad_id}</dd>
                    </div>
                  )}
                </dl>
              </section>
            )}

            {/* Linha do tempo */}
            <section className="omni-card">
              <div className="omni-card__header py-3">
                <h3 className="omni-eyebrow">Histórico</h3>
              </div>
              <div className="omni-card__body">
                <ol className="omni-timeline">
                  <li className="omni-timeline__item">
                    <span className="omni-timeline__mark">
                      <Plus />
                    </span>
                    <div className="omni-timeline__body">
                      <p className="omni-timeline__title">Negócio criado no sistema</p>
                      <p className="omni-timeline__meta">{formatDateTimeFull(lead.criado_em)}</p>
                    </div>
                  </li>
                  {lead.lead_etapa_funil && (
                    <li className="omni-timeline__item">
                      <span className="omni-timeline__mark">
                        <CalendarDays />
                      </span>
                      <div className="omni-timeline__body">
                        <p className="omni-timeline__title">
                          Etapa atual:{" "}
                          <span className="font-semibold">{lead.lead_etapa_funil}</span>
                        </p>
                        <p className="omni-timeline__meta">Atualizado recentemente</p>
                      </div>
                    </li>
                  )}
                </ol>
              </div>
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
  const activeMotivos = motivos.filter((m) => m.motivo_ativo || m.motivo_id === currentMotivoId);
  const [selectedId, setSelectedId] = useState<string>(
    currentMotivoId || (activeMotivos.length > 0 ? activeMotivos[0].motivo_id : ""),
  );

  return (
    <div
      className="omni-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-modal-perda"
    >
      <div className="omni-modal">
        <div className="omni-modal__header">
          <div>
            <h2 id="titulo-modal-perda" className="omni-h4">
              Motivo da perda
            </h2>
            <p className="omni-small mt-1">
              Registrar o motivo alimenta o diagnóstico de gargalos em Relatórios.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="omni-btn omni-btn--ghost omni-btn--icon omni-btn--sm"
          >
            <X />
            <span className="omni-sr">Fechar</span>
          </button>
        </div>

        <div className="omni-modal__body">
          {activeMotivos.length > 0 ? (
            <div className="omni-stack-2 max-h-60 overflow-y-auto scrollbar-slim">
              {activeMotivos.map((m) => (
                <label
                  key={m.motivo_id}
                  className={cn(
                    "omni-radio-item cursor-pointer rounded-md border p-3 transition-colors duration-[var(--omni-dur-fast)]",
                    selectedId === m.motivo_id
                      ? "border-primary bg-primary-soft"
                      : "border-line hover:bg-surface-2",
                  )}
                >
                  <input
                    type="radio"
                    name="motivo_perda"
                    value={m.motivo_id}
                    checked={selectedId === m.motivo_id}
                    onChange={() => setSelectedId(m.motivo_id)}
                  />
                  <span className="text-sm">{m.motivo_nome}</span>
                </label>
              ))}
            </div>
          ) : (
            <div className="omni-empty">
              <h4>Nenhum motivo cadastrado</h4>
              <p>Cadastre os motivos de perda em Configurações para poder classificar aqui.</p>
            </div>
          )}
        </div>

        <div className="omni-modal__footer">
          <button type="button" onClick={onClose} className="omni-btn omni-btn--ghost">
            Cancelar
          </button>
          <button
            type="button"
            disabled={isPending}
            data-loading={isPending ? "true" : undefined}
            onClick={() => onConfirm(selectedId || null)}
            className="omni-btn omni-btn--danger"
          >
            Registrar perda
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── New Deal Modal Component ─── */
function NewDealModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { user } = useAuth();
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [origem, setOrigem] = useState("Meta Ads");
  const [etapa, setEtapa] = useState("Novo Lead");
  const [valor, setValor] = useState("");
  const [contatoInvalido, setContatoInvalido] = useState(false);

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
      setContatoInvalido(true);
      toast.error("Preencha pelo menos o nome ou telefone do lead.");
      return;
    }
    setContatoInvalido(false);
    createMutation.mutate();
  };

  return (
    <div
      className="omni-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-modal-negocio"
    >
      <div className="omni-modal w-full max-w-[560px]">
        <div className="omni-modal__header">
          <div>
            <h2 id="titulo-modal-negocio" className="omni-h4">
              Novo negócio
            </h2>
            <p className="omni-small mt-1">A oportunidade entra no funil na etapa escolhida</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="omni-btn omni-btn--ghost omni-btn--icon omni-btn--sm"
          >
            <X />
            <span className="omni-sr">Fechar</span>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="omni-modal__body omni-stack">
            <div className="omni-field">
              <label className="omni-label" htmlFor="negocio-nome">
                Nome do contato ou empresa
              </label>
              <input
                id="negocio-nome"
                type="text"
                value={nome}
                onChange={(e) => {
                  setNome(e.target.value);
                  if (e.target.value.trim()) setContatoInvalido(false);
                }}
                aria-invalid={contatoInvalido || undefined}
                placeholder="Ex.: João da Silva"
                className="omni-input"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="omni-field">
                <label className="omni-label" htmlFor="negocio-telefone">
                  Telefone
                </label>
                <input
                  id="negocio-telefone"
                  type="text"
                  value={telefone}
                  onChange={(e) => {
                    setTelefone(e.target.value);
                    if (e.target.value.trim()) setContatoInvalido(false);
                  }}
                  aria-invalid={contatoInvalido || undefined}
                  placeholder="5514999999999"
                  className="omni-input num"
                />
              </div>

              <div className="omni-field">
                <label className="omni-label" htmlFor="negocio-email">
                  E-mail
                </label>
                <input
                  id="negocio-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contato@empresa.com"
                  className="omni-input"
                />
              </div>
            </div>

            {contatoInvalido && (
              <p className="omni-error">
                Informe o nome ou o telefone — é por eles que o negócio é identificado no funil.
              </p>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="omni-field">
                <label className="omni-label" htmlFor="negocio-etapa">
                  Etapa do funil
                </label>
                <select
                  id="negocio-etapa"
                  value={etapa}
                  onChange={(e) => setEtapa(e.target.value)}
                  className="omni-select"
                >
                  {DEFAULT_STAGES.map((stg) => (
                    <option key={stg} value={stg}>
                      {stg}
                    </option>
                  ))}
                </select>
              </div>

              <div className="omni-field">
                <label className="omni-label" htmlFor="negocio-valor">
                  Valor estimado (R$)
                </label>
                <input
                  id="negocio-valor"
                  type="number"
                  step="0.01"
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  placeholder="1500,00"
                  className="omni-input num"
                />
              </div>
            </div>

            <div className="omni-field">
              <label className="omni-label" htmlFor="negocio-origem">
                Origem
              </label>
              <input
                id="negocio-origem"
                type="text"
                value={origem}
                onChange={(e) => setOrigem(e.target.value)}
                placeholder="Ex.: Meta Ads, indicação, outbound"
                className="omni-input"
              />
              <p className="omni-hint">A origem alimenta o relatório de canais de aquisição.</p>
            </div>
          </div>

          <div className="omni-modal__footer">
            <button type="button" onClick={onClose} className="omni-btn omni-btn--ghost">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              data-loading={createMutation.isPending ? "true" : undefined}
              className="omni-btn omni-btn--primary"
            >
              Criar negócio
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
