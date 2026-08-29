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
  CircleDot,
  Clock,
  CheckCircle2,
  Calendar,
  User,
  Trash2,
  ExternalLink,
  Search,
  AlertCircle,
  Tag,
  CalendarDays,
  AlertTriangle,
  RotateCcw,
  FastForward,
  ChevronDown,
  ChevronRight,
  Filter,
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

const PRIORIDADES = {
  urgente: { label: "Urgente", cls: "text-red-400 bg-red-500/15 border-red-500/30" },
  alta: { label: "Alta", cls: "text-amber-400 bg-amber-500/15 border-amber-500/30" },
  media: { label: "Média", cls: "text-blue-400 bg-blue-500/15 border-blue-500/30" },
  baixa: { label: "Baixa", cls: "text-slate-400 bg-slate-500/15 border-slate-500/30" },
} as const;

const STATUS_MAP = {
  pendente: { label: "Pendente", cls: "text-amber-400 bg-amber-500/15 border-amber-500/30", Icon: CircleDot },
  em_andamento: { label: "Em Andamento", cls: "text-blue-400 bg-blue-500/15 border-blue-500/30", Icon: Clock },
  concluida: { label: "Concluída", cls: "text-emerald-400 bg-emerald-500/15 border-emerald-500/30", Icon: CheckCircle2 },
  cancelada: { label: "Cancelada", cls: "text-slate-400 bg-slate-500/15 border-slate-500/30", Icon: X },
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
  const [filterBucket, setFilterBucket] = useState<"todas" | "atrasadas" | "hoje" | "proximas" | "concluidas">("todas");
  const [prioFilter, setPrioFilter] = useState("todas");
  const [modalOpen, setModalOpen] = useState(false);
  const [showConcluidasGroup, setShowConcluidasGroup] = useState(false);

  /* Form state */
  const [titulo, setTitulo] = useState("");
  const [leadId, setLeadId] = useState("");
  const [dataVencimento, setDataVencimento] = useState(todayISO());
  const [prioridade, setPrioridade] = useState<TarefaItem["prioridade"]>("media");
  const [descricao, setDescricao] = useState("");
  const [saving, setSaving] = useState(false);

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
    if (!titulo.trim()) { toast.error("Informe o título da tarefa!"); return; }
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

  /* Helper para renderizar linhas da tarefa */
  const renderTaskRow = (t: TarefaItem) => {
    const isDone = t.status === "concluida";
    const prio = PRIORIDADES[t.prioridade] || PRIORIDADES["media"];
    const isAtrasada = !isDone && t.data_vencimento && t.data_vencimento < todayStr;
    const isHoje = !isDone && t.data_vencimento === todayStr;
    const diffDays = getDaysDiff(t.data_vencimento);

    return (
      <tr
        key={t.tarefa_id}
        className={cn(
          "transition-all group border-b border-border/40",
          isAtrasada
            ? "bg-red-500/[0.06] hover:bg-red-500/[0.10] border-l-4 border-l-red-500"
            : isHoje
            ? "bg-amber-500/[0.04] hover:bg-amber-500/[0.08] border-l-4 border-l-[#fba834]"
            : isDone
            ? "opacity-50 hover:opacity-80"
            : "hover:bg-white/[0.02]"
        )}
      >
        <td className="w-12 px-5 py-3.5">
          <button
            type="button"
            onClick={() => toggleStatusMutation.mutate(t)}
            className="text-muted-foreground hover:text-accent transition-colors"
            title={isDone ? "Reabrir tarefa" : "Concluir tarefa"}
          >
            {isDone ? (
              <CheckCircle2 className="size-5 text-emerald-400" />
            ) : (
              <Square className={cn("size-5", isAtrasada ? "text-red-400 hover:border-red-400" : "hover:border-accent")} />
            )}
          </button>
        </td>

        <td className="px-5 py-3.5">
          <div className="flex items-center gap-2">
            <p className={cn("font-semibold text-xs text-foreground", isDone && "line-through text-muted-foreground")}>
              {t.titulo}
            </p>
            {isAtrasada && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-red-500/40 bg-red-500/20 px-2 py-0.2 text-[10px] font-black text-red-400">
                <span className="size-1.5 rounded-full bg-red-400 animate-ping" />
                VENCIDA {diffDays !== null ? `(${Math.abs(diffDays)}d atrás)` : ""}
              </span>
            )}
            {isHoje && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/20 px-2 py-0.2 text-[10px] font-extrabold text-[#fba834]">
                HOJE
              </span>
            )}
          </div>
          {t.descricao && (
            <p className="text-[11px] text-muted-foreground mt-0.5 max-w-sm truncate">{t.descricao}</p>
          )}
        </td>

        <td className="px-5 py-3.5">
          {t.lead_id ? (
            <Link
              to="/lead/$leadId"
              params={{ leadId: t.lead_id }}
              className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
            >
              <ExternalLink className="size-3" /> {t.lead_nome || "Ver Lead"}
            </Link>
          ) : (
            <span className="text-xs text-muted-foreground">Geral / Sem Lead</span>
          )}
        </td>

        <td className="px-5 py-3.5">
          <div className="flex items-center gap-2">
            <span className={cn(
              "text-xs font-semibold flex items-center gap-1",
              isAtrasada ? "text-red-400 font-bold" : isHoje ? "text-[#fba834] font-bold" : "text-muted-foreground"
            )}>
              <CalendarDays className={cn("size-3.5", isAtrasada ? "text-red-400" : isHoje ? "text-[#fba834]" : "text-accent")} />
              {formatDate(t.data_vencimento)}
            </span>
          </div>
        </td>

        <td className="px-5 py-3.5">
          <span className={cn("inline-flex items-center gap-1 rounded-lg border px-2.5 py-0.5 text-[10px] font-bold", prio.cls)}>
            {prio.label}
          </span>
        </td>

        <td className="px-5 py-3.5">
          <span className={cn(
            "inline-flex items-center gap-1 rounded-lg border px-2.5 py-0.5 text-[10px] font-bold",
            isAtrasada ? "border-red-500/40 bg-red-500/15 text-red-400" : STATUS_MAP[t.status]?.cls || STATUS_MAP.pendente.cls
          )}>
            {isAtrasada ? "Em Atraso" : STATUS_MAP[t.status]?.label || "Pendente"}
          </span>
        </td>

        <td className="px-5 py-3.5 text-right">
          <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            {isAtrasada && (
              <button
                type="button"
                onClick={() => rescheduleMutation.mutate({ tarefaId: t.tarefa_id, newDate: todayStr })}
                className="inline-flex items-center gap-1 rounded-lg bg-amber-500/15 border border-amber-500/30 px-2 py-1 text-[10px] font-extrabold text-[#fba834] hover:bg-amber-500/25"
                title="Mover vencimento para hoje"
              >
                <RotateCcw className="size-3" /> Mover p/ Hoje
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if (confirm(`Excluir a tarefa "${t.titulo}"?`)) {
                  deleteMutation.mutate(t.tarefa_id);
                }
              }}
              className="p-1.5 text-red-400 hover:bg-red-500/15 rounded-lg transition-all"
              title="Excluir tarefa"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        </td>
      </tr>
    );
  };

  return (
    <AppShell
      title="Gestão de Tarefas"
      subtitle={`${kpis.totalAtrasadas} em atraso · ${kpis.totalHoje} vencem hoje · ${kpis.totalConcluidas} concluídas`}
      actions={
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#fba834] to-[#f7931e] px-4 py-2 text-xs font-bold text-[#0d0d26] shadow-md shadow-[#fba834]/20 hover:brightness-110 transition-all"
        >
          <Plus className="size-4" /> Nova Tarefa
        </button>
      }
    >
      <div className="w-full space-y-6">

        {/* ══════ 1. KPIS DE TAREFAS COM DESTAQUE MÁXIMO PARA ATRASO ══════ */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          
          {/* Card: Em Atraso */}
          <button
            type="button"
            onClick={() => setFilterBucket(filterBucket === "atrasadas" ? "todas" : "atrasadas")}
            className={cn(
              "rounded-2xl border p-5 backdrop-blur-2xl shadow-xl space-y-2 text-left transition-all",
              kpis.totalAtrasadas > 0
                ? "border-red-500/40 bg-gradient-to-br from-card to-red-500/10 hover:border-red-500"
                : "border-border bg-card/90 opacity-70",
              filterBucket === "atrasadas" && "ring-2 ring-red-400"
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-red-400 flex items-center gap-1.5">
                <AlertTriangle className="size-4" /> Em Atraso (Vencidas)
              </span>
              {kpis.totalAtrasadas > 0 && (
                <span className="p-1.5 rounded-lg bg-red-500/20 text-red-400 animate-pulse">
                  <AlertCircle className="size-4" />
                </span>
              )}
            </div>
            <p className="text-3xl font-black text-red-400">{kpis.totalAtrasadas}</p>
            <p className="text-xs text-muted-foreground">Exigem ação imediata</p>
          </button>

          {/* Card: Vencem Hoje */}
          <button
            type="button"
            onClick={() => setFilterBucket(filterBucket === "hoje" ? "todas" : "hoje")}
            className={cn(
              "rounded-2xl border p-5 backdrop-blur-2xl shadow-xl space-y-2 text-left transition-all",
              kpis.totalHoje > 0
                ? "border-amber-500/40 bg-gradient-to-br from-card to-amber-500/10 hover:border-[#fba834]"
                : "border-border bg-card/90 opacity-70",
              filterBucket === "hoje" && "ring-2 ring-[#fba834]"
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-[#fba834] flex items-center gap-1.5">
                <CalendarDays className="size-4" /> Vencem Hoje
              </span>
              <span className="p-1.5 rounded-lg bg-amber-500/10 text-[#fba834]">
                <Clock className="size-4" />
              </span>
            </div>
            <p className="text-3xl font-black text-[#fba834]">{kpis.totalHoje}</p>
            <p className="text-xs text-muted-foreground">Programadas para hoje</p>
          </button>

          {/* Card: Próximas */}
          <button
            type="button"
            onClick={() => setFilterBucket(filterBucket === "proximas" ? "todas" : "proximas")}
            className={cn(
              "rounded-2xl border border-blue-500/20 bg-card/90 p-5 backdrop-blur-2xl shadow-xl space-y-2 text-left transition-all hover:border-blue-400",
              filterBucket === "proximas" && "ring-2 ring-blue-400"
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                <FastForward className="size-4" /> Próximas Atividades
              </span>
              <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
                <Calendar className="size-4" />
              </span>
            </div>
            <p className="text-3xl font-black text-foreground">{kpis.totalProximas}</p>
            <p className="text-xs text-muted-foreground">Dias futuros</p>
          </button>

          {/* Card: Concluídas */}
          <button
            type="button"
            onClick={() => setFilterBucket(filterBucket === "concluidas" ? "todas" : "concluidas")}
            className={cn(
              "rounded-2xl border border-emerald-500/20 bg-card/90 p-5 backdrop-blur-2xl shadow-xl space-y-2 text-left transition-all hover:border-emerald-400",
              filterBucket === "concluidas" && "ring-2 ring-emerald-400"
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="size-4" /> Concluídas
              </span>
              <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                <CheckSquare className="size-4" />
              </span>
            </div>
            <p className="text-3xl font-black text-foreground">{kpis.totalConcluidas}</p>
            <p className="text-xs text-muted-foreground">Finalizadas com sucesso</p>
          </button>
        </div>

        {/* ══════ 2. BARRA DE BUSCA, ABAS DE FILTRO RÁPIDO & CONTROLES ══════ */}
        <div className="rounded-2xl border border-border bg-card/90 p-4 backdrop-blur-2xl shadow-xl flex flex-wrap items-center justify-between gap-3">
          
          {/* Pílulas de Filtro Rápido */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setFilterBucket("todas")}
              className={cn(
                "rounded-xl px-3 py-1.5 text-xs font-bold transition-all",
                filterBucket === "todas"
                  ? "bg-accent text-[#0d0d26] shadow-sm"
                  : "bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              Todas ({kpis.totalGeral})
            </button>

            {kpis.totalAtrasadas > 0 && (
              <button
                type="button"
                onClick={() => setFilterBucket("atrasadas")}
                className={cn(
                  "rounded-xl px-3 py-1.5 text-xs font-extrabold transition-all flex items-center gap-1",
                  filterBucket === "atrasadas"
                    ? "bg-red-500 text-white shadow-md shadow-red-500/20"
                    : "bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25"
                )}
              >
                <AlertTriangle className="size-3.5" /> Em Atraso ({kpis.totalAtrasadas})
              </button>
            )}

            <button
              type="button"
              onClick={() => setFilterBucket("hoje")}
              className={cn(
                "rounded-xl px-3 py-1.5 text-xs font-bold transition-all",
                filterBucket === "hoje"
                  ? "bg-amber-500 text-[#0d0d26] shadow-md shadow-amber-500/20"
                  : "bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25"
              )}
            >
              Vencem Hoje ({kpis.totalHoje})
            </button>

            <button
              type="button"
              onClick={() => setFilterBucket("proximas")}
              className={cn(
                "rounded-xl px-3 py-1.5 text-xs font-bold transition-all",
                filterBucket === "proximas"
                  ? "bg-blue-500 text-white"
                  : "bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              Próximas ({kpis.totalProximas})
            </button>

            <button
              type="button"
              onClick={() => setFilterBucket("concluidas")}
              className={cn(
                "rounded-xl px-3 py-1.5 text-xs font-bold transition-all",
                filterBucket === "concluidas"
                  ? "bg-emerald-500 text-white"
                  : "bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              Concluídas ({kpis.totalConcluidas})
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Campo de Busca */}
            <div className="relative min-w-[200px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar tarefa ou lead..."
                className="h-9 w-full rounded-xl border border-input bg-background pl-9 pr-3 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-accent/60"
              />
            </div>

            {/* Filtro de Prioridade */}
            <select
              value={prioFilter}
              onChange={(e) => setPrioFilter(e.target.value)}
              className="h-9 rounded-xl border border-input bg-background px-3 text-xs font-semibold text-foreground outline-none focus:border-accent/60 cursor-pointer"
            >
              <option value="todas">Prioridade: Todas</option>
              <option value="urgente">Urgente</option>
              <option value="alta">Alta</option>
              <option value="media">Média</option>
              <option value="baixa">Baixa</option>
            </select>

            {/* Alternador Lista / Quadro */}
            <div className="flex rounded-xl border border-border p-0.5 bg-background/50">
              <button
                type="button"
                onClick={() => setView("lista")}
                className={cn(
                  "flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition-all",
                  view === "lista" ? "bg-accent text-[#0d0d26] shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <LayoutList className="size-3.5" /> Lista
              </button>
              <button
                type="button"
                onClick={() => setView("quadro")}
                className={cn(
                  "flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition-all",
                  view === "quadro" ? "bg-accent text-[#0d0d26] shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Columns3 className="size-3.5" /> Quadro
              </button>
            </div>
          </div>
        </div>

        {/* ══════ 3. CONTEÚDO PRINCIPAL (LISTA INTELIGENTE OU QUADRO) ══════ */}
        {isLoading ? (
          <div className="py-16 text-center text-muted-foreground text-sm">Carregando tarefas...</div>
        ) : sortedAndFilteredTasks.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card/90 p-12 text-center space-y-3 backdrop-blur-2xl shadow-xl">
            <CheckSquare className="size-10 mx-auto text-muted-foreground/30" />
            <p className="text-sm font-semibold text-muted-foreground">Nenhuma tarefa encontrada para os filtros selecionados.</p>
            <p className="text-xs text-muted-foreground/60">
              Clique em "+ Nova Tarefa" para adicionar atividades da sua rotina comercial.
            </p>
          </div>
        ) : view === "lista" ? (
          <section className="overflow-hidden rounded-2xl border border-border bg-card/90 backdrop-blur-2xl shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-secondary/50 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border">
                  <tr>
                    <th className="w-12 px-5 py-3.5" />
                    <th className="px-5 py-3.5">Tarefa</th>
                    <th className="px-5 py-3.5">Lead / Negócio</th>
                    <th className="px-5 py-3.5">Vencimento</th>
                    <th className="px-5 py-3.5">Prioridade</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {sortedAndFilteredTasks.map((t) => renderTaskRow(t))}
                </tbody>
              </table>
            </div>
          </section>
        ) : (
          /* ──── MODO QUADRO KANBAN POR TEMPO E STATUS ──── */
          <div className="grid gap-4 md:grid-cols-4">
            
            {/* Coluna 1: Em Atraso */}
            <div className="rounded-2xl border border-red-500/30 bg-card/90 p-4 backdrop-blur-2xl shadow-xl space-y-3">
              <div className="flex items-center justify-between border-b border-red-500/30 pb-3">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-red-400 flex items-center gap-1.5">
                  <AlertTriangle className="size-4" /> Em Atraso
                </h3>
                <span className="rounded-lg bg-red-500/20 px-2 py-0.5 text-[11px] font-black text-red-400 border border-red-500/30">
                  {atrasadas.length}
                </span>
              </div>
              <div className="space-y-2.5 min-h-[260px]">
                {atrasadas.length === 0 ? (
                  <p className="text-xs text-muted-foreground/60 text-center pt-8">Nenhuma tarefa atrasada!</p>
                ) : (
                  atrasadas.map((t) => (
                    <div
                      key={t.tarefa_id}
                      className="rounded-xl border border-red-500/40 bg-red-500/[0.07] p-3.5 space-y-2.5 hover:border-red-400 transition-all group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => toggleStatusMutation.mutate(t)}
                          className="mt-0.5 text-red-400 hover:text-emerald-400 shrink-0"
                        >
                          <Square className="size-4" />
                        </button>
                        <p className="text-xs font-bold text-foreground flex-1 leading-snug">
                          {t.titulo}
                        </p>
                      </div>

                      {t.lead_id && (
                        <Link
                          to="/lead/$leadId"
                          params={{ leadId: t.lead_id }}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent hover:underline"
                        >
                          <ExternalLink className="size-3" /> {t.lead_nome || "Ver Lead"}
                        </Link>
                      )}

                      <div className="flex items-center justify-between border-t border-red-500/20 pt-2 text-[11px]">
                        <span className="text-red-400 font-bold flex items-center gap-1">
                          <CalendarDays className="size-3" /> {formatDate(t.data_vencimento)}
                        </span>
                        <button
                          type="button"
                          onClick={() => rescheduleMutation.mutate({ tarefaId: t.tarefa_id, newDate: todayStr })}
                          className="text-[10px] font-extrabold text-[#fba834] hover:underline"
                        >
                          p/ Hoje
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Coluna 2: Vencem Hoje */}
            <div className="rounded-2xl border border-amber-500/30 bg-card/90 p-4 backdrop-blur-2xl shadow-xl space-y-3">
              <div className="flex items-center justify-between border-b border-amber-500/30 pb-3">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#fba834] flex items-center gap-1.5">
                  <Clock className="size-4" /> Vencem Hoje
                </h3>
                <span className="rounded-lg bg-amber-500/20 px-2 py-0.5 text-[11px] font-black text-[#fba834] border border-amber-500/30">
                  {vencemHoje.length}
                </span>
              </div>
              <div className="space-y-2.5 min-h-[260px]">
                {vencemHoje.length === 0 ? (
                  <p className="text-xs text-muted-foreground/60 text-center pt-8">Sem tarefas para hoje.</p>
                ) : (
                  vencemHoje.map((t) => (
                    <div
                      key={t.tarefa_id}
                      className="rounded-xl border border-amber-500/40 bg-amber-500/[0.06] p-3.5 space-y-2.5 hover:border-[#fba834] transition-all group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => toggleStatusMutation.mutate(t)}
                          className="mt-0.5 text-muted-foreground hover:text-emerald-400 shrink-0"
                        >
                          <Square className="size-4" />
                        </button>
                        <p className="text-xs font-bold text-foreground flex-1 leading-snug">
                          {t.titulo}
                        </p>
                      </div>

                      {t.lead_id && (
                        <Link
                          to="/lead/$leadId"
                          params={{ leadId: t.lead_id }}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent hover:underline"
                        >
                          <ExternalLink className="size-3" /> {t.lead_nome || "Ver Lead"}
                        </Link>
                      )}

                      <div className="flex items-center justify-between border-t border-amber-500/20 pt-2 text-[11px]">
                        <span className="text-[#fba834] font-bold">Hoje</span>
                        <span className={cn("rounded border px-1.5 py-0.2 text-[9px] font-bold", PRIORIDADES[t.prioridade]?.cls)}>
                          {PRIORIDADES[t.prioridade]?.label}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Coluna 3: Próximas Atividades */}
            <div className="rounded-2xl border border-blue-500/20 bg-card/90 p-4 backdrop-blur-2xl shadow-xl space-y-3">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                  <FastForward className="size-4" /> Próximas
                </h3>
                <span className="rounded-lg bg-secondary px-2 py-0.5 text-[11px] font-bold text-muted-foreground border border-border">
                  {proximas.length}
                </span>
              </div>
              <div className="space-y-2.5 min-h-[260px]">
                {proximas.length === 0 ? (
                  <p className="text-xs text-muted-foreground/60 text-center pt-8">Sem próximas tarefas.</p>
                ) : (
                  proximas.map((t) => (
                    <div
                      key={t.tarefa_id}
                      className="rounded-xl border border-border/80 bg-secondary/30 p-3.5 space-y-2.5 hover:border-accent/40 transition-all group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => toggleStatusMutation.mutate(t)}
                          className="mt-0.5 text-muted-foreground hover:text-emerald-400 shrink-0"
                        >
                          <Square className="size-4" />
                        </button>
                        <p className="text-xs font-semibold text-foreground flex-1 leading-snug">
                          {t.titulo}
                        </p>
                      </div>

                      {t.lead_id && (
                        <Link
                          to="/lead/$leadId"
                          params={{ leadId: t.lead_id }}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent hover:underline"
                        >
                          <ExternalLink className="size-3" /> {t.lead_nome || "Ver Lead"}
                        </Link>
                      )}

                      <div className="flex items-center justify-between border-t border-border/40 pt-2 text-[11px]">
                        <span className="text-muted-foreground">{formatDate(t.data_vencimento)}</span>
                        <span className={cn("rounded border px-1.5 py-0.2 text-[9px] font-bold", PRIORIDADES[t.prioridade]?.cls)}>
                          {PRIORIDADES[t.prioridade]?.label}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Coluna 4: Concluídas */}
            <div className="rounded-2xl border border-emerald-500/20 bg-card/90 p-4 backdrop-blur-2xl shadow-xl space-y-3">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="size-4" /> Concluídas
                </h3>
                <span className="rounded-lg bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-emerald-400 border border-emerald-500/20">
                  {concluidas.length}
                </span>
              </div>
              <div className="space-y-2.5 min-h-[260px]">
                {concluidas.length === 0 ? (
                  <p className="text-xs text-muted-foreground/60 text-center pt-8">Nenhuma tarefa concluída ainda.</p>
                ) : (
                  concluidas.map((t) => (
                    <div
                      key={t.tarefa_id}
                      className="rounded-xl border border-border/60 bg-secondary/20 p-3.5 space-y-2 opacity-60 hover:opacity-100 transition-all group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => toggleStatusMutation.mutate(t)}
                          className="mt-0.5 text-emerald-400 shrink-0"
                          title="Reabrir tarefa"
                        >
                          <CheckCircle2 className="size-4" />
                        </button>
                        <p className="text-xs font-medium line-through text-muted-foreground flex-1 leading-snug">
                          {t.titulo}
                        </p>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground border-t border-border/40 pt-2">
                        <span>{formatDate(t.data_vencimento)}</span>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`Excluir "${t.titulo}"?`)) {
                              deleteMutation.mutate(t.tarefa_id);
                            }
                          }}
                          className="opacity-0 group-hover:opacity-100 text-red-400 hover:underline"
                        >
                          Excluir
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        )}
      </div>

      {/* Modal de Criação de Tarefa */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#12122d]/95 backdrop-blur-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
              <div>
                <h2 className="text-base font-extrabold text-foreground">Nova Tarefa</h2>
                <p className="text-xs text-muted-foreground">Agende atividades, follow-ups ou tarefas gerais</p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-white/10"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="p-6 space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Título da Tarefa *</label>
                <input
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  placeholder="Ex: Ligar para confirmar proposta, Enviar contrato assinado..."
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white outline-none focus:border-accent/60"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Vincular a um Lead (Opcional)</label>
                <select
                  value={leadId}
                  onChange={(e) => setLeadId(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#12122d] px-3 py-2 text-xs text-white outline-none focus:border-accent/60 cursor-pointer"
                >
                  <option value="">Nenhum (Tarefa interna / Geral)</option>
                  {leads.map((l: any) => (
                    <option key={l.lead_id} value={l.lead_id}>
                      {l.lead_nome || l.lead_telefone || l.lead_id}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Data de Vencimento</label>
                  <input
                    type="date"
                    value={dataVencimento}
                    onChange={(e) => setDataVencimento(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white outline-none focus:border-accent/60 cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Prioridade</label>
                  <select
                    value={prioridade}
                    onChange={(e) => setPrioridade(e.target.value as any)}
                    className="w-full rounded-xl border border-white/10 bg-[#12122d] px-3 py-2 text-xs text-white outline-none focus:border-accent/60 cursor-pointer"
                  >
                    <option value="baixa">Baixa</option>
                    <option value="media">Média</option>
                    <option value="alta">Alta</option>
                    <option value="urgente">Urgente</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Descrição / Observações</label>
                <textarea
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  rows={3}
                  placeholder="Instruções ou detalhes adicionais para a equipe..."
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white outline-none focus:border-accent/60 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-white/10 pt-4">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-white/10"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving || !titulo.trim()}
                  className="rounded-xl bg-gradient-to-r from-[#fba834] to-[#f7931e] px-5 py-2 text-xs font-bold text-[#0d0d26] shadow-md shadow-[#fba834]/20 hover:brightness-110 transition-all disabled:opacity-50"
                >
                  {saving ? "Salvando..." : "Criar Tarefa"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
