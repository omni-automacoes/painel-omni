import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";
import {
  CheckSquare,
  Square,
  Plus,
  X,
  LayoutList,
  Columns3,
  Clock,
  CheckCircle2,
  Trash2,
  ExternalLink,
  Search,
  CalendarDays,
  AlertTriangle,
  RotateCcw,
  FastForward,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/tarefas")({
  head: () => ({
    meta: [
      { title: "Tarefas · Omni Automações" },
      {
        name: "description",
        content: "Gestão e quadro de tarefas com destaque para pendências e atividades em atraso.",
      },
    ],
  }),
  component: TarefasPage,
});

/* ─── Types ─── */
interface TarefaItem {
  tarefa_id: string;
  lead_id?: string | null;
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
  lead_nome?: string | null;
  lead_telefone?: string | null;
}

/* Prioridade e situação: cor sempre acompanhada de rótulo em texto. */
const PRIORIDADES = {
  urgente: { label: "Urgente", badge: "omni-badge--danger" },
  alta: { label: "Alta", badge: "omni-badge--warning" },
  media: { label: "Média", badge: "omni-badge--info" },
  baixa: { label: "Baixa", badge: "omni-badge--outline" },
} as const;

const STATUS_MAP = {
  pendente: { label: "Pendente", badge: "omni-badge--warning" },
  em_andamento: { label: "Em andamento", badge: "omni-badge--info" },
  concluida: { label: "Concluída", badge: "omni-badge--success" },
  cancelada: { label: "Cancelada", badge: "omni-badge--outline" },
} as const;

function todayISO() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(dateStr?: string | null) {
  if (!dateStr) return "Sem data";
  try {
    const parts = dateStr.split("-");
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  } catch {}
  return dateStr;
}

function getDaysDiff(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  const today = new Date(todayISO() + "T00:00:00");
  const target = new Date(dateStr + "T00:00:00");
  const diffTime = target.getTime() - today.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

function TarefasPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [view, setView] = useState<"lista" | "quadro">("lista");
  const [search, setSearch] = useState("");
  const [filterBucket, setFilterBucket] = useState<
    "todas" | "atrasadas" | "hoje" | "proximas" | "concluidas"
  >("todas");
  const [prioFilter, setPrioFilter] = useState("todas");
  const [modalOpen, setModalOpen] = useState(false);

  /* Form state */
  const [titulo, setTitulo] = useState("");
  const [leadId, setLeadId] = useState("");
  const [dataVencimento, setDataVencimento] = useState(todayISO());
  const [prioridade, setPrioridade] = useState<TarefaItem["prioridade"]>("media");
  const [descricao, setDescricao] = useState("");
  const [saving, setSaving] = useState(false);
  const [tituloInvalido, setTituloInvalido] = useState(false);

  /* Fetch tarefas com lead */
  const { data: tarefas = [], isLoading } = useQuery<TarefaItem[]>({
    queryKey: ["tarefas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tarefas")
        .select("*, leads (lead_nome, lead_telefone)")
        .order("criado_em", { ascending: false });
      if (error) {
        console.error("Erro ao buscar tarefas:", error);
        return [];
      }
      return (data || []).map((t: any) => ({
        ...t,
        lead_nome: t.leads?.lead_nome,
        lead_telefone: t.leads?.lead_telefone,
      }));
    },
    enabled: !!user,
  });

  /* Fetch leads para vincular */
  const { data: leads = [] } = useQuery({
    queryKey: ["leads_select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("lead_id, lead_nome, lead_telefone")
        .order("lead_nome", { ascending: true });
      if (error) return [];
      return data || [];
    },
    enabled: !!user,
  });

  const todayStr = todayISO();

  /* Classificação Temporal dos Itens */
  const { atrasadas, vencemHoje, proximas, concluidas } = useMemo(() => {
    const atrasadasArr: TarefaItem[] = [];
    const hojeArr: TarefaItem[] = [];
    const proximasArr: TarefaItem[] = [];
    const concluidasArr: TarefaItem[] = [];

    tarefas.forEach((t) => {
      if (t.status === "concluida") {
        concluidasArr.push(t);
        return;
      }

      if (t.data_vencimento && t.data_vencimento < todayStr) {
        atrasadasArr.push(t);
      } else if (t.data_vencimento === todayStr) {
        hojeArr.push(t);
      } else {
        proximasArr.push(t);
      }
    });

    // Ordenar atrasadas: da mais antiga para a mais recente
    atrasadasArr.sort((a, b) => ((a.data_vencimento || "") > (b.data_vencimento || "") ? 1 : -1));
    // Ordenar próximas: da mais próxima para a mais distante
    proximasArr.sort((a, b) => ((a.data_vencimento || "") > (b.data_vencimento || "") ? 1 : -1));

    return {
      atrasadas: atrasadasArr,
      vencemHoje: hojeArr,
      proximas: proximasArr,
      concluidas: concluidasArr,
    };
  }, [tarefas, todayStr]);

  /* KPIs */
  const kpis = useMemo(() => {
    return {
      totalAtrasadas: atrasadas.length,
      totalHoje: vencemHoje.length,
      totalProximas: proximas.length,
      totalConcluidas: concluidas.length,
      totalGeral: tarefas.length,
    };
  }, [atrasadas, vencemHoje, proximas, concluidas, tarefas]);

  /* Lista Geral com Ordenação Inteligente (Atrasadas SEMPRE no topo, depois Hoje, depois Próximas, depois Concluídas) */
  const sortedAndFilteredTasks = useMemo(() => {
    let list: TarefaItem[] = [];

    if (filterBucket === "atrasadas") {
      list = [...atrasadas];
    } else if (filterBucket === "hoje") {
      list = [...vencemHoje];
    } else if (filterBucket === "proximas") {
      list = [...proximas];
    } else if (filterBucket === "concluidas") {
      list = [...concluidas];
    } else {
      // "todas": SEMPRE colocar Atrasadas no topo, depois Hoje, depois Próximas, depois Concluídas
      list = [...atrasadas, ...vencemHoje, ...proximas, ...concluidas];
    }

    return list.filter((t) => {
      if (prioFilter !== "todas" && t.prioridade !== prioFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const tit = (t.titulo || "").toLowerCase();
        const leadN = (t.lead_nome || "").toLowerCase();
        const desc = (t.descricao || "").toLowerCase();
        if (!tit.includes(q) && !leadN.includes(q) && !desc.includes(q)) return false;
      }
      return true;
    });
  }, [filterBucket, atrasadas, vencemHoje, proximas, concluidas, prioFilter, search]);

  /* Toggle Status Mutation */
  const toggleStatusMutation = useMutation({
    mutationFn: async (t: TarefaItem) => {
      const nextStatus = t.status === "concluida" ? "pendente" : "concluida";
      const { error } = await supabase
        .from("tarefas")
        .update({ status: nextStatus })
        .eq("tarefa_id", t.tarefa_id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tarefas"] });
    },
    onError: (err: any) => {
      toast.error("Erro ao atualizar: " + err.message);
    },
  });

  /* Quick Reschedule Mutation (Adiar para Hoje ou +1 Dia) */
  const rescheduleMutation = useMutation({
    mutationFn: async ({ tarefaId, newDate }: { tarefaId: string; newDate: string }) => {
      const { error } = await supabase
        .from("tarefas")
        .update({ data_vencimento: newDate })
        .eq("tarefa_id", tarefaId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tarefas"] });
      toast.success("Data da tarefa reprogramada com sucesso!");
    },
    onError: (err: any) => {
      toast.error("Erro ao reprogramar: " + err.message);
    },
  });

  /* Delete Mutation */
  const deleteMutation = useMutation({
    mutationFn: async (tarefaId: string) => {
      const { error } = await supabase.from("tarefas").delete().eq("tarefa_id", tarefaId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tarefas"] });
      toast.success("Tarefa excluída!");
    },
    onError: (err: any) => {
      toast.error("Erro ao excluir: " + err.message);
    },
  });

  /* Create Task Handler */
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim()) {
      setTituloInvalido(true);
      toast.error("Informe o título da tarefa!");
      return;
    }
    setTituloInvalido(false);
    setSaving(true);
    try {
      const { error } = await supabase.from("tarefas").insert([
        {
          titulo: titulo.trim(),
          lead_id: leadId || null,
          data_vencimento: dataVencimento || null,
          prioridade,
          descricao: descricao.trim() || null,
          status: "pendente",
        },
      ]);
      if (error) throw error;
      toast.success("Tarefa criada com sucesso!");
      setModalOpen(false);
      setTitulo("");
      setLeadId("");
      setDescricao("");
      queryClient.invalidateQueries({ queryKey: ["tarefas"] });
    } catch (err: any) {
      toast.error("Erro ao criar: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  /* Cartão de tarefa usado nas colunas do quadro. */
  const TaskCard = ({
    t,
    tone,
  }: {
    t: TarefaItem;
    tone: "atraso" | "hoje" | "futuro" | "feito";
  }) => {
    const isDone = t.status === "concluida";
    const prio = PRIORIDADES[t.prioridade] || PRIORIDADES.media;

    return (
      <div
        className={cn(
          "omni-card omni-card--flat group flex flex-col gap-2.5 p-3",
          tone === "atraso" && "border-danger bg-danger-soft",
          tone === "hoje" && "border-warning bg-warning-soft",
          tone === "feito" && "bg-surface-2",
        )}
      >
        <div className="flex items-start gap-2">
          <button
            type="button"
            onClick={() => toggleStatusMutation.mutate(t)}
            className="mt-0.5 shrink-0 rounded-xs text-ink-faint transition-colors hover:text-success"
            title={isDone ? "Reabrir tarefa" : "Marcar como concluída"}
          >
            {isDone ? (
              <CheckCircle2 className="size-4 text-success" />
            ) : (
              <Square className="size-4" />
            )}
            <span className="omni-sr">
              {isDone ? "Reabrir" : "Concluir"} {t.titulo}
            </span>
          </button>
          <p
            className={cn(
              "flex-1 text-sm font-medium leading-snug text-ink",
              isDone && "text-ink-3 line-through",
            )}
          >
            {t.titulo}
          </p>
        </div>

        {t.lead_id && (
          <Link
            to="/lead/$leadId"
            params={{ leadId: t.lead_id }}
            className="omni-link inline-flex items-center gap-1 text-xs"
          >
            <ExternalLink className="size-3" /> {t.lead_nome || "Ver negócio"}
          </Link>
        )}

        <div className="flex items-center justify-between gap-2 border-t border-line-subtle pt-2">
          <span className="num text-xs text-ink-3">{formatDate(t.data_vencimento)}</span>
          {tone === "atraso" ? (
            <button
              type="button"
              onClick={() =>
                rescheduleMutation.mutate({ tarefaId: t.tarefa_id, newDate: todayStr })
              }
              className="omni-btn omni-btn--quiet omni-btn--sm"
            >
              <RotateCcw /> Mover para hoje
            </button>
          ) : tone === "feito" ? (
            <button
              type="button"
              onClick={() => {
                if (confirm(`Excluir "${t.titulo}"?`)) {
                  deleteMutation.mutate(t.tarefa_id);
                }
              }}
              className="omni-btn omni-btn--quiet omni-btn--sm text-danger opacity-0 group-hover:opacity-100"
            >
              Excluir
            </button>
          ) : (
            <span className={cn("omni-badge", prio.badge)}>{prio.label}</span>
          )}
        </div>
      </div>
    );
  };

  /* Coluna do quadro. */
  const BoardColumn = ({
    title,
    icon,
    count,
    empty,
    children,
  }: {
    title: string;
    icon: React.ReactNode;
    count: number;
    empty: string;
    children: React.ReactNode;
  }) => (
    <div className="omni-card flex flex-col">
      <div className="omni-card__header py-3">
        <h2 className="omni-eyebrow flex items-center gap-1.5">
          {icon} {title}
        </h2>
        <span className="omni-badge omni-badge--outline">{count}</span>
      </div>
      <div className="flex min-h-[240px] flex-col gap-2.5 p-3">
        {count === 0 ? <p className="omni-small py-8 text-center">{empty}</p> : children}
      </div>
    </div>
  );

  /* Linha da tabela em modo lista. */
  const renderTaskRow = (t: TarefaItem) => {
    const isDone = t.status === "concluida";
    const prio = PRIORIDADES[t.prioridade] || PRIORIDADES.media;
    const isAtrasada = !isDone && !!t.data_vencimento && t.data_vencimento < todayStr;
    const isHoje = !isDone && t.data_vencimento === todayStr;
    const diffDays = getDaysDiff(t.data_vencimento);
    const st = STATUS_MAP[t.status] || STATUS_MAP.pendente;

    return (
      <tr
        key={t.tarefa_id}
        className={cn(
          "group",
          isAtrasada && "[&>td]:bg-danger-soft",
          isHoje && "[&>td]:bg-warning-soft",
        )}
      >
        <td className="w-12">
          <button
            type="button"
            onClick={() => toggleStatusMutation.mutate(t)}
            className="rounded-xs text-ink-faint transition-colors hover:text-success"
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
        </td>

        <td>
          <div className="flex items-center gap-2">
            <p className={cn("omni-td-strong", isDone && "font-normal text-ink-3 line-through")}>
              {t.titulo}
            </p>
            {isAtrasada && (
              <span className="omni-badge omni-badge--danger shrink-0">
                <AlertTriangle />
                Vencida
                {diffDays !== null ? ` há ${Math.abs(diffDays)} d` : ""}
              </span>
            )}
            {isHoje && <span className="omni-badge omni-badge--warning shrink-0">Vence hoje</span>}
          </div>
          {t.descricao && <p className="omni-small max-w-sm truncate">{t.descricao}</p>}
        </td>

        <td>
          {t.lead_id ? (
            <Link
              to="/lead/$leadId"
              params={{ leadId: t.lead_id }}
              className="omni-link inline-flex items-center gap-1"
            >
              <ExternalLink className="size-3" /> {t.lead_nome || "Ver negócio"}
            </Link>
          ) : (
            <span className="omni-small">Tarefa interna</span>
          )}
        </td>

        <td className="omni-td-num">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="size-3.5 text-ink-faint" />
            {formatDate(t.data_vencimento)}
          </span>
        </td>

        <td>
          <span className={cn("omni-badge", prio.badge)}>{prio.label}</span>
        </td>

        <td>
          <span className={cn("omni-badge", isAtrasada ? "omni-badge--danger" : st.badge)}>
            {isAtrasada ? "Em atraso" : st.label}
          </span>
        </td>

        <td className="omni-td-actions">
          <div className="inline-flex items-center gap-1">
            {isAtrasada && (
              <button
                type="button"
                onClick={() =>
                  rescheduleMutation.mutate({ tarefaId: t.tarefa_id, newDate: todayStr })
                }
                className="omni-btn omni-btn--secondary omni-btn--sm"
                title="Mover o vencimento para hoje"
              >
                <RotateCcw /> Mover para hoje
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if (confirm(`Excluir a tarefa "${t.titulo}"?`)) {
                  deleteMutation.mutate(t.tarefa_id);
                }
              }}
              className="omni-btn omni-btn--ghost omni-btn--icon omni-btn--sm text-danger hover:bg-danger-soft"
              title={`Excluir ${t.titulo}`}
            >
              <Trash2 />
              <span className="omni-sr">Excluir {t.titulo}</span>
            </button>
          </div>
        </td>
      </tr>
    );
  };

  const FILTROS = [
    { id: "todas", label: "Todas", count: kpis.totalGeral },
    { id: "atrasadas", label: "Em atraso", count: kpis.totalAtrasadas },
    { id: "hoje", label: "Vencem hoje", count: kpis.totalHoje },
    { id: "proximas", label: "Próximas", count: kpis.totalProximas },
    { id: "concluidas", label: "Concluídas", count: kpis.totalConcluidas },
  ] as const;

  return (
    <AppShell
      title="Tarefas"
      subtitle={`${kpis.totalAtrasadas} em atraso · ${kpis.totalHoje} vencem hoje · ${kpis.totalConcluidas} concluídas`}
      actions={
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="omni-btn omni-btn--primary omni-btn--sm"
        >
          <Plus /> Nova tarefa
        </button>
      }
    >
      <div className="omni-stack-6 w-full">
        {/* ══════ 1. Indicadores (também servem de filtro) ══════ */}

        <section className="omni-grid omni-grid-4" aria-label="Situação das tarefas">
          <button
            type="button"
            aria-pressed={filterBucket === "atrasadas"}
            onClick={() => setFilterBucket(filterBucket === "atrasadas" ? "todas" : "atrasadas")}
            className={cn(
              "omni-card cursor-pointer text-left transition-colors duration-[var(--omni-dur-fast)]",
              filterBucket === "atrasadas" ? "border-primary" : "hover:border-line-strong",
            )}
          >
            <div className="omni-stat">
              <span className="omni-stat__label flex items-center gap-1.5">
                <AlertTriangle className="size-3.5" /> Em atraso
              </span>
              <p className={cn("omni-stat__value", kpis.totalAtrasadas > 0 && "text-danger")}>
                {kpis.totalAtrasadas}
              </p>
              <p className="omni-stat__foot">
                {kpis.totalAtrasadas > 0 ? (
                  <span className="omni-badge omni-badge--danger">Exigem ação hoje</span>
                ) : (
                  <span className="omni-badge omni-badge--success">Nada vencido</span>
                )}
              </p>
            </div>
          </button>

          <button
            type="button"
            aria-pressed={filterBucket === "hoje"}
            onClick={() => setFilterBucket(filterBucket === "hoje" ? "todas" : "hoje")}
            className={cn(
              "omni-card cursor-pointer text-left transition-colors duration-[var(--omni-dur-fast)]",
              filterBucket === "hoje" ? "border-primary" : "hover:border-line-strong",
            )}
          >
            <div className="omni-stat">
              <span className="omni-stat__label flex items-center gap-1.5">
                <CalendarDays className="size-3.5" /> Vencem hoje
              </span>
              <p className="omni-stat__value">{kpis.totalHoje}</p>
              <p className="omni-stat__foot">Programadas para a data de hoje</p>
            </div>
          </button>

          <button
            type="button"
            aria-pressed={filterBucket === "proximas"}
            onClick={() => setFilterBucket(filterBucket === "proximas" ? "todas" : "proximas")}
            className={cn(
              "omni-card cursor-pointer text-left transition-colors duration-[var(--omni-dur-fast)]",
              filterBucket === "proximas" ? "border-primary" : "hover:border-line-strong",
            )}
          >
            <div className="omni-stat">
              <span className="omni-stat__label flex items-center gap-1.5">
                <FastForward className="size-3.5" /> Próximas
              </span>
              <p className="omni-stat__value">{kpis.totalProximas}</p>
              <p className="omni-stat__foot">Agendadas para os próximos dias</p>
            </div>
          </button>

          <button
            type="button"
            aria-pressed={filterBucket === "concluidas"}
            onClick={() => setFilterBucket(filterBucket === "concluidas" ? "todas" : "concluidas")}
            className={cn(
              "omni-card cursor-pointer text-left transition-colors duration-[var(--omni-dur-fast)]",
              filterBucket === "concluidas" ? "border-primary" : "hover:border-line-strong",
            )}
          >
            <div className="omni-stat">
              <span className="omni-stat__label flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5" /> Concluídas
              </span>
              <p className="omni-stat__value">{kpis.totalConcluidas}</p>
              <p className="omni-stat__foot">Finalizadas até agora</p>
            </div>
          </button>
        </section>

        {/* ══════ 2. Filtros, busca e modo de exibição ══════ */}

        <div className="omni-card">
          <div className="omni-tabs px-3 pt-2" role="tablist" aria-label="Filtro rápido">
            {FILTROS.map((f) => (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={filterBucket === f.id}
                onClick={() => setFilterBucket(f.id as any)}
                className="omni-tab"
              >
                {f.label}
                <span className="omni-badge omni-badge--outline">{f.count}</span>
              </button>
            ))}
          </div>

          <div className="omni-card__body flex flex-wrap items-end gap-4 py-4">
            <div className="omni-field min-w-[220px] flex-1">
              <label className="omni-label" htmlFor="busca-tarefa">
                Buscar tarefa
              </label>
              <div className="omni-input-group">
                <Search />
                <input
                  id="busca-tarefa"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Título, descrição ou nome do negócio"
                  className="omni-input"
                />
              </div>
            </div>

            <div className="omni-field w-full sm:w-48">
              <label className="omni-label" htmlFor="filtro-prioridade">
                Prioridade
              </label>
              <select
                id="filtro-prioridade"
                value={prioFilter}
                onChange={(e) => setPrioFilter(e.target.value)}
                className="omni-select"
              >
                <option value="todas">Todas</option>
                <option value="urgente">Urgente</option>
                <option value="alta">Alta</option>
                <option value="media">Média</option>
                <option value="baixa">Baixa</option>
              </select>
            </div>

            <div className="omni-field">
              <span className="omni-label">Exibição</span>
              <div className="omni-btn-group" role="group" aria-label="Modo de exibição">
                <button
                  type="button"
                  aria-pressed={view === "lista"}
                  onClick={() => setView("lista")}
                  className="omni-btn omni-btn--secondary"
                >
                  <LayoutList /> Lista
                </button>
                <button
                  type="button"
                  aria-pressed={view === "quadro"}
                  onClick={() => setView("quadro")}
                  className="omni-btn omni-btn--secondary"
                >
                  <Columns3 /> Quadro
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ══════ 3. Lista ou quadro ══════ */}

        {view === "lista" ? (
          <section className="omni-table-wrap">
            <div className="omni-table-scroll">
              <table className="omni-table">
                <thead>
                  <tr>
                    <th className="w-12">
                      <span className="omni-sr">Concluir</span>
                    </th>
                    <th>Tarefa</th>
                    <th>Negócio</th>
                    <th className="omni-th-num">Vencimento</th>
                    <th>Prioridade</th>
                    <th>Situação</th>
                    <th className="omni-th-num">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    [0, 1, 2, 3, 4, 5].map((i) => (
                      <tr key={i}>
                        <td colSpan={7} className="p-0">
                          <div className="omni-skeleton h-row w-full rounded-none" />
                        </td>
                      </tr>
                    ))
                  ) : sortedAndFilteredTasks.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-0">
                        <div className="omni-empty">
                          <span className="omni-empty__art">
                            <CheckSquare />
                          </span>
                          <h4>Nenhuma tarefa nestes filtros</h4>
                          <p>
                            Volte para a aba "Todas" ou crie uma tarefa para começar a acompanhar a
                            rotina comercial.
                          </p>
                          <button
                            type="button"
                            onClick={() => setModalOpen(true)}
                            className="omni-btn omni-btn--secondary omni-btn--sm"
                          >
                            <Plus /> Nova tarefa
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    sortedAndFilteredTasks.map((t) => renderTaskRow(t))
                  )}
                </tbody>
              </table>
            </div>

            <div className="omni-table__foot">
              <span>
                {sortedAndFilteredTasks.length} de {kpis.totalGeral}{" "}
                {kpis.totalGeral === 1 ? "tarefa" : "tarefas"}
              </span>
            </div>
          </section>
        ) : isLoading ? (
          <div className="grid gap-4 md:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="omni-skeleton h-80 w-full" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-4">
            <BoardColumn
              title="Em atraso"
              icon={<AlertTriangle className="size-3.5" />}
              count={atrasadas.length}
              empty="Nada vencido. Bom sinal."
            >
              {atrasadas.map((t) => (
                <TaskCard key={t.tarefa_id} t={t} tone="atraso" />
              ))}
            </BoardColumn>

            <BoardColumn
              title="Vencem hoje"
              icon={<Clock className="size-3.5" />}
              count={vencemHoje.length}
              empty="Sem tarefas para hoje."
            >
              {vencemHoje.map((t) => (
                <TaskCard key={t.tarefa_id} t={t} tone="hoje" />
              ))}
            </BoardColumn>

            <BoardColumn
              title="Próximas"
              icon={<FastForward className="size-3.5" />}
              count={proximas.length}
              empty="Nada agendado à frente."
            >
              {proximas.map((t) => (
                <TaskCard key={t.tarefa_id} t={t} tone="futuro" />
              ))}
            </BoardColumn>

            <BoardColumn
              title="Concluídas"
              icon={<CheckCircle2 className="size-3.5" />}
              count={concluidas.length}
              empty="Nenhuma tarefa concluída ainda."
            >
              {concluidas.map((t) => (
                <TaskCard key={t.tarefa_id} t={t} tone="feito" />
              ))}
            </BoardColumn>
          </div>
        )}
      </div>

      {/* Modal de Criação de Tarefa */}
      {modalOpen && (
        <div
          className="omni-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-modal-tarefa"
        >
          <div className="omni-modal w-full max-w-[560px]">
            <div className="omni-modal__header">
              <div>
                <h2 id="titulo-modal-tarefa" className="omni-h4">
                  Nova tarefa
                </h2>
                <p className="omni-small mt-1">Follow-ups, atividades e combinados da equipe</p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="omni-btn omni-btn--ghost omni-btn--icon omni-btn--sm"
              >
                <X />
                <span className="omni-sr">Fechar</span>
              </button>
            </div>

            <form onSubmit={handleCreateTask}>
              <div className="omni-modal__body omni-stack">
                <div className="omni-field">
                  <label className="omni-label" htmlFor="tarefa-titulo">
                    Título da tarefa <span className="omni-req">*</span>
                  </label>
                  <input
                    id="tarefa-titulo"
                    value={titulo}
                    onChange={(e) => {
                      setTitulo(e.target.value);
                      if (e.target.value.trim()) setTituloInvalido(false);
                    }}
                    aria-invalid={tituloInvalido || undefined}
                    placeholder="Ex.: Ligar para confirmar a proposta"
                    className="omni-input"
                    autoFocus
                  />
                  {tituloInvalido && (
                    <p className="omni-error">
                      Descreva a tarefa em uma frase para poder salvá-la.
                    </p>
                  )}
                </div>

                <div className="omni-field">
                  <label className="omni-label" htmlFor="tarefa-lead">
                    Negócio vinculado
                  </label>
                  <select
                    id="tarefa-lead"
                    value={leadId}
                    onChange={(e) => setLeadId(e.target.value)}
                    className="omni-select"
                  >
                    <option value="">Nenhum — tarefa interna</option>
                    {leads.map((l: any) => (
                      <option key={l.lead_id} value={l.lead_id}>
                        {l.lead_nome || l.lead_telefone || l.lead_id}
                      </option>
                    ))}
                  </select>
                  <p className="omni-hint">
                    Vincular um negócio faz a tarefa aparecer também na página dele.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="omni-field">
                    <label className="omni-label" htmlFor="tarefa-data">
                      Data de vencimento
                    </label>
                    <input
                      id="tarefa-data"
                      type="date"
                      value={dataVencimento}
                      onChange={(e) => setDataVencimento(e.target.value)}
                      className="omni-input num"
                    />
                  </div>
                  <div className="omni-field">
                    <label className="omni-label" htmlFor="tarefa-prioridade">
                      Prioridade
                    </label>
                    <select
                      id="tarefa-prioridade"
                      value={prioridade}
                      onChange={(e) => setPrioridade(e.target.value as any)}
                      className="omni-select"
                    >
                      <option value="baixa">Baixa</option>
                      <option value="media">Média</option>
                      <option value="alta">Alta</option>
                      <option value="urgente">Urgente</option>
                    </select>
                  </div>
                </div>

                <div className="omni-field">
                  <label className="omni-label" htmlFor="tarefa-descricao">
                    Descrição
                  </label>
                  <textarea
                    id="tarefa-descricao"
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                    rows={3}
                    placeholder="Detalhes que a equipe precisa saber para executar"
                    className="omni-textarea"
                  />
                </div>
              </div>

              <div className="omni-modal__footer">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="omni-btn omni-btn--ghost"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  data-loading={saving ? "true" : undefined}
                  className="omni-btn omni-btn--primary"
                >
                  Criar tarefa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
