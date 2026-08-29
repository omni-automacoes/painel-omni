import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";
import {
  DollarSign,
  TrendingUp,
  Award,
  Users,
  Target,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Plus,
  ArrowUpRight,
  Sparkles,
  Building2,
  CalendarDays,
  ExternalLink,
  Square,
  FastForward,
  Kanban,
  FileSpreadsheet,
  ChevronRight,
  MessageSquare,
  Info,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell } from "@/components/AppShell";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Visão Geral · Omni Automações" },
      {
        name: "description",
        content: "Painel executivo com vendas, clientes, tarefas e financeiro centralizados no Omni.",
      },
    ],
  }),
  component: DashboardOverview,
});

/* ─── Funções Utilitárias ─── */
function formatCurrency(val: number | string | null | undefined): string {
  const num = typeof val === "number" ? val : parseFloat(String(val || 0));
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(isNaN(num) ? 0 : num);
}

function formatDate(dateStr?: string | null) {
  if (!dateStr) return "-";
  try {
    const parts = dateStr.split("T")[0].split("-");
    if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
  } catch {}
  return dateStr;
}

function todayISO() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isReceitaPaga(statusStr?: string | null): boolean {
  const s = (statusStr || "").toLowerCase();
  return s === "recebido" || s === "pago" || s === "concluido";
}

const ETAPAS_ORDENADAS = [
  "Novo Lead",
  "Tentando Contato",
  "Contato Realizado",
  "Lead Qualificado",
  "Reunião Agendada",
  "Reunião Realizada",
  "Orçamento Enviado",
  "Venda Realizada",
];

function DashboardOverview() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const todayStr = todayISO();

  /* 1. Fetch Leads */
  const { data: leads = [], isLoading: isLoadingLeads } = useQuery({
    queryKey: ["overview_leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  /* 2. Fetch Clientes */
  const { data: clientes = [] } = useQuery({
    queryKey: ["overview_clientes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("*")
        .order("valor_recorrente", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  /* 3. Fetch Receitas */
  const { data: receitas = [] } = useQuery({
    queryKey: ["overview_receitas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("receitas")
        .select("*")
        .order("data_vencimento", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  /* 4. Fetch Tarefas */
  const { data: tarefas = [] } = useQuery({
    queryKey: ["overview_tarefas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tarefas")
        .select("*, leads (lead_nome, lead_telefone)")
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return (data || []).map((t: any) => ({
        ...t,
        lead_nome: t.leads?.lead_nome,
        lead_telefone: t.leads?.lead_telefone,
      }));
    },
    enabled: !!user,
  });

  /* Toggle Tarefa Status Mutation */
  const toggleTarefaMutation = useMutation({
    mutationFn: async (t: any) => {
      const nextStatus = t.status === "concluida" ? "pendente" : "concluida";
      const { error } = await supabase
        .from("tarefas")
        .update({ status: nextStatus })
        .eq("tarefa_id", t.tarefa_id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["overview_tarefas"] });
      queryClient.invalidateQueries({ queryKey: ["tarefas"] });
    },
    onError: (err: any) => {
      toast.error("Erro ao atualizar tarefa: " + err.message);
    },
  });

  /* ─── Métricas & Listas para o Hover Popover ─── */
  const metrics = useMemo(() => {
    // 1. Receitas do mês corrente (status = 'recebido' ou 'pago')
    const currentMonthPrefix = todayStr.substring(0, 7); // "YYYY-MM"
    const receitasMes = receitas.filter((r: any) => {
      const dt = r.data_recebimento || r.data_competencia || r.data_vencimento;
      return dt && dt.startsWith(currentMonthPrefix) && isReceitaPaga(r.status);
    });
    const totalReceitaMes = receitasMes.reduce((acc: number, r: any) => acc + (Number(r.valor) || 0), 0);

    // 2. MRR Recorrente (APENAS clientes ATIVOS, nunca cancelados ou pausados)
    const clientesAtivos = clientes.filter((c: any) => (c.status || "").toLowerCase() === "ativo");
    const clientesAtivosRecorrentes = clientesAtivos.filter((c: any) => (Number(c.valor_recorrente) || 0) > 0);
    const mrrTotal = clientesAtivosRecorrentes.reduce((acc: number, c: any) => acc + (Number(c.valor_recorrente) || 0), 0);

    // 3. Pipeline em aberto
    const leadsAbertos = leads.filter((l: any) => l.lead_status === "Aberto" && l.lead_etapa_funil !== "Venda Realizada");
    const pipelineAbertoValor = leadsAbertos.reduce((acc: number, l: any) => acc + (Number(l.lead_valor) || 0), 0);

    // 4. Taxa de Conversão
    const totalGanhos = leads.filter((l: any) => l.lead_status === "Ganho" || l.lead_etapa_funil === "Venda Realizada").length;
    const taxaConversao = leads.length > 0 ? (totalGanhos / leads.length) * 100 : 0;

    // 5. Tarefas em atraso e vencendo hoje
    const tarefasAtrasadas = tarefas.filter((t: any) => t.status !== "concluida" && t.data_vencimento && t.data_vencimento < todayStr);
    const tarefasHoje = tarefas.filter((t: any) => t.status !== "concluida" && t.data_vencimento === todayStr);

    return {
      totalReceitaMes,
      receitasMesList: receitasMes,
      mrrTotal,
      clientesAtivosCount: clientesAtivos.length,
      clientesRecorrentesList: clientesAtivosRecorrentes,
      pipelineAbertoValor,
      leadsAbertosCount: leadsAbertos.length,
      leadsAbertosList: leadsAbertos,
      totalGanhos,
      taxaConversao,
      tarefasAtrasadasCount: tarefasAtrasadas.length,
      tarefasHojeCount: tarefasHoje.length,
      tarefasUrgentesList: [...tarefasAtrasadas, ...tarefasHoje],
    };
  }, [receitas, clientes, leads, tarefas, todayStr]);

  /* ─── Gráfico do Funil de Conversão ─── */
  const funnelData = useMemo(() => {
    return ETAPAS_ORDENADAS.map((etapa) => {
      const count = leads.filter((l: any) => (l.lead_etapa_funil || "Novo Lead") === etapa).length;
      return { etapa, count };
    });
  }, [leads]);

  /* ─── Gráfico Financeiro Mensal (Últimos 6 meses) ─── */
  const financialChartData = useMemo(() => {
    const monthsMap: Record<string, { m: string; realizado: number; previsto: number }> = {};
    const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

    const d = new Date();
    for (let i = 5; i >= 0; i--) {
      const targetDate = new Date(d.getFullYear(), d.getMonth() - i, 1);
      const key = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, "0")}`;
      const label = `${monthNames[targetDate.getMonth()]}/${String(targetDate.getFullYear()).slice(2)}`;
      monthsMap[key] = { m: label, realizado: 0, previsto: 0 };
    }

    receitas.forEach((r: any) => {
      const dt = r.data_recebimento || r.data_competencia || r.data_vencimento;
      if (!dt) return;
      const key = dt.substring(0, 7);
      if (monthsMap[key]) {
        if (isReceitaPaga(r.status)) {
          monthsMap[key].realizado += Number(r.valor) || 0;
        } else if (r.status === "pendente" || r.status === "atrasado") {
          monthsMap[key].previsto += Number(r.valor) || 0;
        }
      }
    });

    return Object.values(monthsMap);
  }, [receitas]);

  /* ─── Top 5 Tarefas Urgentes ─── */
  const urgentTasks = useMemo(() => {
    const pending = tarefas.filter((t: any) => t.status !== "concluida");
    pending.sort((a: any, b: any) => {
      const dateA = a.data_vencimento || "9999-99-99";
      const dateB = b.data_vencimento || "9999-99-99";
      return dateA > dateB ? 1 : -1;
    });
    return pending.slice(0, 5);
  }, [tarefas]);

  /* ─── Últimos Leads / Fechamentos ─── */
  const recentLeads = useMemo(() => {
    return leads.slice(0, 5);
  }, [leads]);

  return (
    <AppShell
      title="Visão Geral"
      subtitle="Painel executivo · Vendas, clientes, financeiro e operação em tempo real"
      actions={
        <div className="flex items-center gap-2">
          <Link
            to="/negocios"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#fba834] to-[#f7931e] px-4 py-2 text-xs font-bold text-[#0d0d26] shadow-md shadow-[#fba834]/20 hover:brightness-110 transition-all"
          >
            <Plus className="size-4" /> Novo Negócio
          </Link>
        </div>
      }
    >
      <div className="w-full space-y-6 pb-12">
        {/* ══════ 1. KPIS EXECUTIVOS NO TOPO COM HOVER DETALHADO (ELEVADO z-50) ══════ */}
        <div className="relative z-30 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          
          {/* Card 1: Receita Paga do Mês */}
          <div className="group relative z-10 hover:z-50 rounded-2xl border border-accent/40 bg-card/95 p-5 backdrop-blur-2xl shadow-xl space-y-2 hover:border-accent transition-all cursor-pointer">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-accent flex items-center gap-1.5">
                <DollarSign className="size-4" /> Receita Paga (Mês)
              </span>
              <span className="p-1.5 rounded-lg bg-accent/15 text-accent">
                <TrendingUp className="size-4" />
              </span>
            </div>
            <p className="text-3xl font-black text-accent">{formatCurrency(metrics.totalReceitaMes)}</p>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{metrics.receitasMesList.length} entradas pagas</span>
              <span className="text-[10px] text-accent font-bold opacity-0 group-hover:opacity-100 transition-opacity">Ver detalhes ▾</span>
            </div>

            {/* ─── HOVER PREVIEW: Entradas que compõem este valor ─── */}
            <div className="absolute left-0 top-[calc(100%+8px)] z-[100] w-84 rounded-2xl border border-accent/60 bg-[#0c0c24] p-4 shadow-[0_20px_50px_rgba(0,0,0,0.85)] opacity-0 scale-95 pointer-events-none group-hover:opacity-100 group-hover:scale-100 group-hover:pointer-events-auto transition-all duration-200">
              <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2.5">
                <p className="text-xs font-extrabold text-accent flex items-center gap-1.5">
                  <Sparkles className="size-3.5" /> Lançamentos Pagos no Mês
                </p>
                <span className="text-[10px] text-muted-foreground font-semibold">{metrics.receitasMesList.length} itens</span>
              </div>
              {metrics.receitasMesList.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">Nenhuma receita paga registrada para este mês.</p>
              ) : (
                <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                  {metrics.receitasMesList.map((r: any) => (
                    <div key={r.receita_id} className="flex items-center justify-between text-xs border-b border-white/5 pb-1.5">
                      <div className="min-w-0 pr-2">
                        <p className="font-bold text-white truncate">{r.descricao}</p>
                        <p className="text-[10px] text-muted-foreground">{formatDate(r.data_recebimento || r.data_vencimento)}</p>
                      </div>
                      <span className="font-black text-emerald-400 shrink-0">{formatCurrency(r.valor)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Card 2: MRR Recorrente (Clientes Ativos) */}
          <div className="group relative z-10 hover:z-50 rounded-2xl border border-blue-500/30 bg-card/95 p-5 backdrop-blur-2xl shadow-xl space-y-2 hover:border-blue-400 transition-all cursor-pointer">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                <Building2 className="size-4" /> MRR Recorrente
              </span>
              <span className="p-1.5 rounded-lg bg-blue-500/15 text-blue-400">
                <Users className="size-4" />
              </span>
            </div>
            <p className="text-3xl font-black text-foreground">{formatCurrency(metrics.mrrTotal)}<span className="text-xs font-normal text-muted-foreground">/mês</span></p>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{metrics.clientesRecorrentesList.length} clientes ativos</span>
              <span className="text-[10px] text-blue-400 font-bold opacity-0 group-hover:opacity-100 transition-opacity">Ver clientes ▾</span>
            </div>

            {/* ─── HOVER PREVIEW: Clientes Recorrentes Ativos ─── */}
            <div className="absolute left-0 top-[calc(100%+8px)] z-[100] w-84 rounded-2xl border border-blue-500/60 bg-[#0c0c24] p-4 shadow-[0_20px_50px_rgba(0,0,0,0.85)] opacity-0 scale-95 pointer-events-none group-hover:opacity-100 group-hover:scale-100 group-hover:pointer-events-auto transition-all duration-200">
              <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2.5">
                <p className="text-xs font-extrabold text-blue-400 flex items-center gap-1.5">
                  <Users className="size-3.5" /> Clientes Ativos & Mensalidades
                </p>
                <span className="text-[10px] text-muted-foreground font-semibold">{metrics.clientesRecorrentesList.length} ativos</span>
              </div>
              {metrics.clientesRecorrentesList.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">Nenhum cliente ativo com mensalidade recorrente.</p>
              ) : (
                <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                  {metrics.clientesRecorrentesList.map((c: any) => (
                    <div key={c.cliente_id} className="flex items-center justify-between text-xs border-b border-white/5 pb-1.5">
                      <div className="min-w-0 pr-2">
                        <p className="font-bold text-white truncate">{c.nome}</p>
                        {c.empresa && <p className="text-[10px] text-muted-foreground truncate">{c.empresa}</p>}
                      </div>
                      <span className="font-black text-blue-400 shrink-0">{formatCurrency(c.valor_recorrente)}/mês</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Card 3: Pipeline Comercial Aberto */}
          <div className="group relative z-10 hover:z-50 rounded-2xl border border-border bg-card/95 p-5 backdrop-blur-2xl shadow-xl space-y-2 hover:border-accent/60 transition-all cursor-pointer">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                <Target className="size-4 text-accent" /> Pipeline em Aberto
              </span>
              <span className="p-1.5 rounded-lg bg-white/5 text-muted-foreground">
                <Clock className="size-4" />
              </span>
            </div>
            <p className="text-3xl font-black text-foreground">{formatCurrency(metrics.pipelineAbertoValor)}</p>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{metrics.leadsAbertosCount} negociações</span>
              <span className="text-[10px] text-accent font-bold opacity-0 group-hover:opacity-100 transition-opacity">Ver negócios ▾</span>
            </div>

            {/* ─── HOVER PREVIEW: Negócios no Pipeline ─── */}
            <div className="absolute left-0 top-[calc(100%+8px)] z-[100] w-84 rounded-2xl border border-accent/60 bg-[#0c0c24] p-4 shadow-[0_20px_50px_rgba(0,0,0,0.85)] opacity-0 scale-95 pointer-events-none group-hover:opacity-100 group-hover:scale-100 group-hover:pointer-events-auto transition-all duration-200">
              <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2.5">
                <p className="text-xs font-extrabold text-accent flex items-center gap-1.5">
                  <Target className="size-3.5" /> Negociações no Funil
                </p>
                <span className="text-[10px] text-muted-foreground font-semibold">{metrics.leadsAbertosCount} em aberto</span>
              </div>
              {metrics.leadsAbertosList.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">Nenhum negócio em aberto.</p>
              ) : (
                <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                  {metrics.leadsAbertosList.map((l: any) => (
                    <div key={l.lead_id} className="flex items-center justify-between text-xs border-b border-white/5 pb-1.5">
                      <div className="min-w-0 pr-2">
                        <p className="font-bold text-white truncate">{l.lead_nome || l.lead_telefone || "Sem nome"}</p>
                        <p className="text-[10px] text-accent truncate">{l.lead_etapa_funil || "Novo Lead"}</p>
                      </div>
                      <span className="font-black text-foreground shrink-0">{formatCurrency(l.lead_valor)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Card 4: Tarefas & Urgências */}
          <div className={cn(
            "group relative z-10 hover:z-50 rounded-2xl border p-5 backdrop-blur-2xl shadow-xl space-y-2 transition-all cursor-pointer",
            metrics.tarefasAtrasadasCount > 0
              ? "border-red-500/40 bg-gradient-to-br from-card to-red-500/10 hover:border-red-500"
              : "border-border bg-card/95 hover:border-accent/40"
          )}>
            <div className="flex items-center justify-between">
              <span className={cn(
                "text-xs font-extrabold uppercase tracking-wider flex items-center gap-1.5",
                metrics.tarefasAtrasadasCount > 0 ? "text-red-400" : "text-emerald-400"
              )}>
                {metrics.tarefasAtrasadasCount > 0 ? <AlertTriangle className="size-4" /> : <CheckCircle2 className="size-4" />}
                Rotina Comercial
              </span>
              <Link to="/tarefas" className="p-1 text-muted-foreground hover:text-foreground">
                <ArrowUpRight className="size-4" />
              </Link>
            </div>
            <div className="flex items-baseline gap-2">
              <p className={cn("text-3xl font-black", metrics.tarefasAtrasadasCount > 0 ? "text-red-400" : "text-foreground")}>
                {metrics.tarefasAtrasadasCount}
              </p>
              <span className="text-xs text-muted-foreground font-semibold">atrasadas · {metrics.tarefasHojeCount} hoje</span>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Follow-ups pendentes</span>
              <span className="text-[10px] text-red-400 font-bold opacity-0 group-hover:opacity-100 transition-opacity">Ver tarefas ▾</span>
            </div>

            {/* ─── HOVER PREVIEW: Tarefas Urgentes ─── */}
            <div className="absolute right-0 top-[calc(100%+8px)] z-[100] w-84 rounded-2xl border border-red-500/60 bg-[#0c0c24] p-4 shadow-[0_20px_50px_rgba(0,0,0,0.85)] opacity-0 scale-95 pointer-events-none group-hover:opacity-100 group-hover:scale-100 group-hover:pointer-events-auto transition-all duration-200">
              <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2.5">
                <p className="text-xs font-extrabold text-red-400 flex items-center gap-1.5">
                  <AlertTriangle className="size-3.5" /> Tarefas Críticas / Hoje
                </p>
                <span className="text-[10px] text-muted-foreground font-semibold">{metrics.tarefasUrgentesList.length} tarefas</span>
              </div>
              {metrics.tarefasUrgentesList.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">Nenhuma tarefa atrasada ou para hoje!</p>
              ) : (
                <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                  {metrics.tarefasUrgentesList.map((t: any) => {
                    const isAtrasada = t.data_vencimento && t.data_vencimento < todayStr;
                    return (
                      <div key={t.tarefa_id} className="flex items-center justify-between text-xs border-b border-white/5 pb-1.5">
                        <div className="min-w-0 pr-2">
                          <p className="font-bold text-white truncate">{t.titulo}</p>
                          {t.lead_nome && <p className="text-[10px] text-accent truncate">{t.lead_nome}</p>}
                        </div>
                        <span className={cn("text-[10px] font-extrabold px-1.5 py-0.5 rounded", isAtrasada ? "bg-red-500/20 text-red-400" : "bg-amber-500/20 text-[#fba834]")}>
                          {isAtrasada ? "Atrasada" : "Hoje"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

        </div>

        {/* ══════ 2. GRÁFICOS: EVOLUÇÃO FINANCEIRA & FUNIL DE VENDAS ══════ */}
        <div className="relative z-10 grid gap-6 lg:grid-cols-3">
          
          {/* Gráfico 1: Desempenho Financeiro Mensal (2 Colunas) */}
          <div className="rounded-2xl border border-border bg-card/90 p-6 backdrop-blur-2xl shadow-xl space-y-4 lg:col-span-2">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-foreground flex items-center gap-2">
                  <TrendingUp className="size-4 text-accent" /> Evolução de Faturamento Realizado vs Previsto
                </h3>
                <p className="text-xs text-muted-foreground">Histórico financeiro dos últimos 6 meses</p>
              </div>
              <div className="flex items-center gap-3 text-xs font-semibold">
                <span className="flex items-center gap-1 text-accent">
                  <span className="size-2 rounded-full bg-accent" /> Realizado (Recebido)
                </span>
                <span className="flex items-center gap-1 text-slate-400">
                  <span className="size-2 rounded-full bg-slate-400" /> Previsto
                </span>
              </div>
            </div>

            <div className="h-72 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={financialChartData} margin={{ left: 10, right: 10, top: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                  <XAxis dataKey="m" stroke="#94a3b8" fontSize={11} />
                  <YAxis stroke="#94a3b8" fontSize={10} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#12122d",
                      borderColor: "#fba83440",
                      borderRadius: "12px",
                      fontSize: "12px",
                      color: "#fff",
                    }}
                    formatter={(val: any) => [formatCurrency(val), ""]}
                  />
                  <Bar dataKey="realizado" name="Realizado" fill="#fba834" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="previsto" name="Previsto" fill="#334155" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Gráfico 2: Mini Funil de Vendas (1 Coluna) */}
          <div className="rounded-2xl border border-border bg-card/90 p-6 backdrop-blur-2xl shadow-xl space-y-4 lg:col-span-1 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div>
                  <h3 className="text-sm font-extrabold text-foreground flex items-center gap-2">
                    <Kanban className="size-4 text-accent" /> Funil Comercial
                  </h3>
                  <p className="text-xs text-muted-foreground">{leads.length} leads totais</p>
                </div>
                <Link to="/negocios" className="text-xs font-bold text-accent hover:underline flex items-center gap-0.5">
                  Ver Funil <ChevronRight className="size-3" />
                </Link>
              </div>

              <div className="space-y-2 pt-3">
                {funnelData.map((f) => {
                  const percent = leads.length > 0 ? (f.count / leads.length) * 100 : 0;
                  const isWon = f.etapa === "Venda Realizada";

                  return (
                    <div key={f.etapa} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className={cn("text-[11px]", isWon ? "text-emerald-400 font-bold" : "text-muted-foreground")}>
                          {f.etapa}
                        </span>
                        <span className={cn("text-[11px] font-extrabold", isWon ? "text-emerald-400" : "text-foreground")}>
                          {f.count}
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                        <div
                          className={cn("h-full rounded-full transition-all", isWon ? "bg-emerald-400" : "bg-accent")}
                          style={{ width: `${Math.max(percent, 4)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl border border-border/80 bg-secondary/40 p-3 mt-4 text-xs flex items-center justify-between">
              <span className="text-muted-foreground">Taxa de Conversão:</span>
              <span className="font-extrabold text-emerald-400 text-sm">
                {metrics.taxaConversao.toFixed(1)}%
              </span>
            </div>
          </div>

        </div>

        {/* ══════ 3. TAREFAS PRIORITÁRIAS & ÚLTIMOS LEADS ══════ */}
        <div className="relative z-10 grid gap-6 md:grid-cols-2">
          
          {/* Coluna Esquerda: Tarefas Prioritárias */}
          <div className="rounded-2xl border border-border bg-card/90 p-6 backdrop-blur-2xl shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-foreground flex items-center gap-2">
                  <CalendarDays className="size-4 text-accent" /> Tarefas & Atividades Urgentes
                </h3>
                <p className="text-xs text-muted-foreground">Pendências comerciais e follow-ups</p>
              </div>
              <Link to="/tarefas" className="text-xs font-bold text-accent hover:underline flex items-center gap-0.5">
                Ver Todas ({tarefas.length}) <ChevronRight className="size-3" />
              </Link>
            </div>

            {urgentTasks.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                <CheckCircle2 className="size-8 mx-auto text-emerald-400/50 mb-2" />
                Nenhuma tarefa pendente! Tudo em dia.
              </div>
            ) : (
              <div className="space-y-2.5">
                {urgentTasks.map((t: any) => {
                  const isAtrasada = t.data_vencimento && t.data_vencimento < todayStr;
                  const isHoje = t.data_vencimento === todayStr;

                  return (
                    <div
                      key={t.tarefa_id}
                      className={cn(
                        "flex items-center justify-between gap-3 rounded-xl border p-3.5 transition-all group",
                        isAtrasada
                          ? "border-red-500/40 bg-red-500/[0.06] hover:bg-red-500/[0.10]"
                          : isHoje
                          ? "border-amber-500/40 bg-amber-500/[0.05] hover:bg-amber-500/[0.08]"
                          : "border-border bg-secondary/30 hover:bg-secondary/60"
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <button
                          type="button"
                          onClick={() => toggleTarefaMutation.mutate(t)}
                          className="text-muted-foreground hover:text-emerald-400 shrink-0"
                          title="Concluir tarefa"
                        >
                          <Square className={cn("size-4", isAtrasada ? "text-red-400" : "")} />
                        </button>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-foreground leading-snug truncate">
                            {t.titulo}
                          </p>
                          {t.lead_id && (
                            <Link
                              to="/lead/$leadId"
                              params={{ leadId: t.lead_id }}
                              className="text-[11px] font-semibold text-accent hover:underline flex items-center gap-1 mt-0.5"
                            >
                              <ExternalLink className="size-2.5" /> {t.lead_nome || "Ver Lead"}
                            </Link>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        {isAtrasada ? (
                          <span className="inline-flex items-center gap-1 rounded-md border border-red-500/40 bg-red-500/20 px-2 py-0.5 text-[10px] font-extrabold text-red-400">
                            Atrasada
                          </span>
                        ) : isHoje ? (
                          <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/20 px-2 py-0.5 text-[10px] font-extrabold text-[#fba834]">
                            Hoje
                          </span>
                        ) : (
                          <span className="text-[11px] text-muted-foreground font-medium">
                            {formatDate(t.data_vencimento)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Coluna Direita: Oportunidades Recentes */}
          <div className="rounded-2xl border border-border bg-card/90 p-6 backdrop-blur-2xl shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-foreground flex items-center gap-2">
                  <Users className="size-4 text-accent" /> Últimas Oportunidades & Leads
                </h3>
                <p className="text-xs text-muted-foreground">Novos contatos e negócios recentes</p>
              </div>
              <Link to="/negocios" className="text-xs font-bold text-accent hover:underline flex items-center gap-0.5">
                Ver Todos <ChevronRight className="size-3" />
              </Link>
            </div>

            <div className="space-y-2.5">
              {recentLeads.map((lead: any) => {
                const isGanho = lead.lead_status === "Ganho" || lead.lead_etapa_funil === "Venda Realizada";

                return (
                  <Link
                    key={lead.lead_id}
                    to="/lead/$leadId"
                    params={{ leadId: lead.lead_id }}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border bg-secondary/30 p-3.5 hover:border-accent/40 hover:bg-secondary/60 transition-all group"
                  >
                    <div>
                      <p className="text-xs font-bold text-foreground group-hover:text-accent transition-colors">
                        {lead.lead_nome || lead.lead_telefone || "Sem nome"}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                        <span>{lead.lead_origem || "Meta Ads"}</span>
                        <span>·</span>
                        <span>{formatDate(lead.criado_em)}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-xs font-extrabold text-accent">
                        {formatCurrency(lead.lead_valor)}
                      </p>
                      <span className={cn(
                        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.2 text-[9px] font-bold mt-0.5",
                        isGanho ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" : "bg-secondary text-muted-foreground"
                      )}>
                        {lead.lead_etapa_funil || "Novo Lead"}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

        </div>
      </div>
    </AppShell>
  );
}
