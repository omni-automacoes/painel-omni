import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";
import {
  DollarSign,
  TrendingUp,
  Users,
  Target,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Plus,
  Building2,
  CalendarDays,
  ExternalLink,
  Square,
  Kanban,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
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
        content:
          "Painel executivo com vendas, clientes, tarefas e financeiro centralizados no Omni.",
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

/* Painel flutuante de detalhamento de um KPI (aparece no hover do card). */

function KpiPopover({
  title,
  icon,
  count,
  emptyText,
  children,
  align = "left",
}: {
  title: string;
  icon: React.ReactNode;
  count: string;
  emptyText: string;
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  const isEmpty = Array.isArray(children) ? children.length === 0 : !children;
  return (
    <div
      className={cn(
        "omni-card omni-card--raised pointer-events-none absolute top-[calc(100%+8px)] z-[var(--omni-z-dropdown)] w-[320px] opacity-0 transition-opacity duration-[var(--omni-dur-fast)] ease-omni group-hover:pointer-events-auto group-hover:opacity-100",
        align === "left" ? "left-0" : "right-0",
      )}
    >
      <div className="omni-card__header py-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-ink">
          {icon}
          {title}
        </p>
        <span className="omni-small shrink-0">{count}</span>
      </div>
      {isEmpty ? (
        <p className="omni-small px-5 py-4">{emptyText}</p>
      ) : (
        <div className="omni-list max-h-56 overflow-y-auto scrollbar-slim">{children}</div>
      )}
    </div>
  );
}

function DashboardOverview() {
  const { user } = useAuth();
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
  const { data: tarefas = [], isLoading: isLoadingTarefas } = useQuery({
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
    const totalReceitaMes = receitasMes.reduce(
      (acc: number, r: any) => acc + (Number(r.valor) || 0),
      0,
    );
    // 2. MRR Recorrente (APENAS clientes ATIVOS, nunca cancelados ou pausados)
    const clientesAtivos = clientes.filter((c: any) => (c.status || "").toLowerCase() === "ativo");
    const clientesAtivosRecorrentes = clientesAtivos.filter(
      (c: any) => (Number(c.valor_recorrente) || 0) > 0,
    );
    const mrrTotal = clientesAtivosRecorrentes.reduce(
      (acc: number, c: any) => acc + (Number(c.valor_recorrente) || 0),
      0,
    );
    // 3. Pipeline em aberto
    const leadsAbertos = leads.filter(
      (l: any) => l.lead_status === "Aberto" && l.lead_etapa_funil !== "Venda Realizada",
    );
    const pipelineAbertoValor = leadsAbertos.reduce(
      (acc: number, l: any) => acc + (Number(l.lead_valor) || 0),
      0,
    );
    // 4. Taxa de Conversão
    const totalGanhos = leads.filter(
      (l: any) => l.lead_status === "Ganho" || l.lead_etapa_funil === "Venda Realizada",
    ).length;
    const taxaConversao = leads.length > 0 ? (totalGanhos / leads.length) * 100 : 0;
    // 5. Tarefas em atraso e vencendo hoje
    const tarefasAtrasadas = tarefas.filter(
      (t: any) => t.status !== "concluida" && t.data_vencimento && t.data_vencimento < todayStr,
    );
    const tarefasHoje = tarefas.filter(
      (t: any) => t.status !== "concluida" && t.data_vencimento === todayStr,
    );
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
    const monthNames = [
      "Jan",
      "Fev",
      "Mar",
      "Abr",
      "Mai",
      "Jun",
      "Jul",
      "Ago",
      "Set",
      "Out",
      "Nov",
      "Dez",
    ];
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
  const maxFunnelCount = Math.max(...funnelData.map((f) => f.count), 1);
  return (
    <AppShell
      title="Visão Geral"
      subtitle="Vendas, clientes, financeiro e operação em tempo real"
      actions={
        <Link to="/negocios" className="omni-btn omni-btn--primary omni-btn--sm">
          <Plus /> Novo negócio
        </Link>
      }
    >
      <div className="omni-stack-6 w-full">
        {/* ══════ 1. Indicadores do topo ══════ */}
        <section className="omni-grid omni-grid-4" aria-label="Indicadores principais">
          {/* Receita paga no mês */}
          <div className="omni-card group relative z-10 cursor-default hover:z-[var(--omni-z-dropdown)]">
            <div className="omni-stat">
              <span className="omni-stat__label flex items-center gap-1.5">
                <DollarSign className="size-3.5" /> Receita paga (mês)
              </span>
              <p className="omni-stat__value">{formatCurrency(metrics.totalReceitaMes)}</p>
              <p className="omni-stat__foot">
                {metrics.receitasMesList.length} entradas pagas neste mês
              </p>
            </div>
            <KpiPopover
              title="Lançamentos pagos no mês"
              icon={<TrendingUp className="size-4 text-ink-3" />}
              count={`${metrics.receitasMesList.length} itens`}
              emptyText="Nenhuma receita paga registrada neste mês."
            >
              {metrics.receitasMesList.map((r: any) => (
                <div key={r.receita_id} className="omni-list__item">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{r.descricao}</p>
                    <p className="omni-small">
                      {formatDate(r.data_recebimento || r.data_vencimento)}
                    </p>
                  </div>
                  <span className="num shrink-0 text-sm font-semibold text-ink">
                    {formatCurrency(r.valor)}
                  </span>
                </div>
              ))}
            </KpiPopover>
          </div>
          {/* MRR recorrente */}
          <div className="omni-card group relative z-10 cursor-default hover:z-[var(--omni-z-dropdown)]">
            <div className="omni-stat">
              <span className="omni-stat__label flex items-center gap-1.5">
                <Building2 className="size-3.5" /> MRR recorrente
              </span>
              <p className="omni-stat__value">
                {formatCurrency(metrics.mrrTotal)}
                <small>/mês</small>
              </p>
              <p className="omni-stat__foot">
                {metrics.clientesRecorrentesList.length} clientes ativos com mensalidade
              </p>
            </div>
            <KpiPopover
              title="Clientes ativos e mensalidades"
              icon={<Users className="size-4 text-ink-3" />}
              count={`${metrics.clientesRecorrentesList.length} ativos`}
              emptyText="Nenhum cliente ativo com mensalidade recorrente."
            >
              {metrics.clientesRecorrentesList.map((c: any) => (
                <div key={c.cliente_id} className="omni-list__item">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{c.nome}</p>
                    {c.empresa && <p className="omni-small truncate">{c.empresa}</p>}
                  </div>
                  <span className="num shrink-0 text-sm font-semibold text-ink">
                    {formatCurrency(c.valor_recorrente)}/mês
                  </span>
                </div>
              ))}
            </KpiPopover>
          </div>
          {/* Pipeline em aberto */}
          <div className="omni-card group relative z-10 cursor-default hover:z-[var(--omni-z-dropdown)]">
            <div className="omni-stat">
              <span className="omni-stat__label flex items-center gap-1.5">
                <Target className="size-3.5" /> Pipeline em aberto
              </span>
              <p className="omni-stat__value">{formatCurrency(metrics.pipelineAbertoValor)}</p>
              <p className="omni-stat__foot">
                {metrics.leadsAbertosCount} negociações em andamento
              </p>
            </div>
            <KpiPopover
              title="Negociações no funil"
              icon={<Clock className="size-4 text-ink-3" />}
              count={`${metrics.leadsAbertosCount} em aberto`}
              emptyText="Nenhum negócio em aberto no momento."
            >
              {metrics.leadsAbertosList.map((l: any) => (
                <div key={l.lead_id} className="omni-list__item">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">
                      {l.lead_nome || l.lead_telefone || "Sem nome"}
                    </p>
                    <p className="omni-small truncate">{l.lead_etapa_funil || "Novo Lead"}</p>
                  </div>
                  <span className="num shrink-0 text-sm font-semibold text-ink">
                    {formatCurrency(l.lead_valor)}
                  </span>
                </div>
              ))}
            </KpiPopover>
          </div>
          {/* Rotina comercial */}
          <div className="omni-card group relative z-10 cursor-default hover:z-[var(--omni-z-dropdown)]">
            <div className="omni-stat">
              <span className="omni-stat__label flex items-center gap-1.5">
                {metrics.tarefasAtrasadasCount > 0 ? (
                  <AlertTriangle className="size-3.5" />
                ) : (
                  <CheckCircle2 className="size-3.5" />
                )}
                Rotina comercial
              </span>
              <p
                className={cn(
                  "omni-stat__value",
                  metrics.tarefasAtrasadasCount > 0 && "text-danger",
                )}
              >
                {metrics.tarefasAtrasadasCount}
                <small>atrasadas</small>
              </p>
              <p className="omni-stat__foot">
                {metrics.tarefasAtrasadasCount > 0 ? (
                  <span className="omni-badge omni-badge--danger">Ação necessária</span>
                ) : (
                  <span className="omni-badge omni-badge--success">Em dia</span>
                )}
                <span>{metrics.tarefasHojeCount} vencem hoje</span>
              </p>
            </div>
            <KpiPopover
              align="right"
              title="Tarefas atrasadas e de hoje"
              icon={<AlertTriangle className="size-4 text-ink-3" />}
              count={`${metrics.tarefasUrgentesList.length} tarefas`}
              emptyText="Nenhuma tarefa atrasada ou para hoje."
            >
              {metrics.tarefasUrgentesList.map((t: any) => {
                const isAtrasada = t.data_vencimento && t.data_vencimento < todayStr;
                return (
                  <div key={t.tarefa_id} className="omni-list__item">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{t.titulo}</p>
                      {t.lead_nome && <p className="omni-small truncate">{t.lead_nome}</p>}
                    </div>
                    <span
                      className={cn(
                        "omni-badge shrink-0",
                        isAtrasada ? "omni-badge--danger" : "omni-badge--warning",
                      )}
                    >
                      {isAtrasada ? "Atrasada" : "Hoje"}
                    </span>
                  </div>
                );
              })}
            </KpiPopover>
          </div>
        </section>

        {/* ══════ 2. Gráficos ══════ */}
        <section className="grid gap-6 lg:grid-cols-3">
          {/* Faturamento realizado vs. previsto */}
          <div className="omni-card lg:col-span-2">
            <div className="omni-card__header">
              <div>
                <h2 className="omni-h4">Faturamento realizado e previsto</h2>
                <p className="omni-small mt-0.5">Últimos 6 meses, em reais</p>
              </div>
            </div>
            <div className="omni-card__body">
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={financialChartData}
                    margin={{ left: 4, right: 8, top: 8, bottom: 0 }}
                    barGap={2}
                  >
                    <CartesianGrid
                      stroke="var(--omni-chart-grid)"
                      strokeDasharray="3 3"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="m"
                      stroke="var(--omni-chart-axis)"
                      tick={{ fill: "var(--omni-text-3)", fontSize: 11 }}
                      tickLine={false}
                    />
                    <YAxis
                      stroke="var(--omni-chart-axis)"
                      tick={{ fill: "var(--omni-text-3)", fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      width={56}
                      tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)} mil`}
                    />
                    <Tooltip
                      cursor={{ fill: "var(--omni-surface-2)" }}
                      contentStyle={{
                        background: "var(--omni-surface)",
                        border: "1px solid var(--omni-border)",
                        borderRadius: "var(--omni-radius-md)",
                        boxShadow: "var(--omni-shadow-md)",
                        fontSize: "var(--omni-text-xs)",
                        color: "var(--omni-text)",
                      }}
                      labelStyle={{ color: "var(--omni-text)", fontWeight: 700 }}
                      formatter={(val: any, name: any) => [formatCurrency(val), name]}
                    />
                    <Legend
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{
                        fontSize: "var(--omni-text-xs)",
                        color: "var(--omni-text-2)",
                        paddingTop: 8,
                      }}
                    />
                    <Bar
                      dataKey="realizado"
                      name="Realizado"
                      fill="var(--omni-chart-1)"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="previsto"
                      name="Previsto"
                      fill="var(--omni-chart-2)"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
          {/* Funil comercial */}
          <div className="omni-card flex flex-col">
            <div className="omni-card__header">
              <div>
                <h2 className="omni-h4">Funil comercial</h2>
                <p className="omni-small mt-0.5">{leads.length} leads no total</p>
              </div>
              <Link to="/negocios" className="omni-link shrink-0 text-xs">
                Ver funil
              </Link>
            </div>
            <div className="omni-card__body flex-1">
              {isLoadingLeads ? (
                <div className="flex flex-col gap-3">
                  {ETAPAS_ORDENADAS.map((e) => (
                    <div key={e} className="omni-skeleton h-8 w-full" />
                  ))}
                </div>
              ) : leads.length === 0 ? (
                <div className="omni-empty">
                  <h4>Nenhum lead cadastrado</h4>
                  <p>Cadastre o primeiro negócio para o funil começar a mostrar as etapas.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {funnelData.map((f) => {
                    const largura = (f.count / maxFunnelCount) * 100;
                    return (
                      <div key={f.etapa} className="flex flex-col gap-1.5">
                        <div className="flex items-baseline justify-between gap-3 text-xs">
                          <span className="truncate font-medium text-ink-2">{f.etapa}</span>
                          <span className="num shrink-0 font-semibold text-ink">{f.count}</span>
                        </div>
                        <div className="omni-progress">
                          <div
                            className="omni-progress__bar"
                            style={{ width: `${Math.max(largura, 2)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="omni-card__footer justify-between">
              <span className="omni-small">Taxa de conversão</span>
              <span className="num text-sm font-bold text-ink">
                {metrics.taxaConversao.toFixed(1).replace(".", ",")}%
              </span>
            </div>
          </div>
        </section>

        {/* ══════ 3. Tarefas e oportunidades ══════ */}
        <section className="grid gap-6 md:grid-cols-2">
          {/* Tarefas urgentes */}
          <div className="omni-card">
            <div className="omni-card__header">
              <div>
                <h2 className="omni-h4 flex items-center gap-2">
                  <CalendarDays className="size-4 text-ink-3" /> Tarefas urgentes
                </h2>
                <p className="omni-small mt-0.5">Pendências comerciais e follow-ups</p>
              </div>
              <Link to="/tarefas" className="omni-link shrink-0 text-xs">
                Ver todas ({tarefas.length})
              </Link>
            </div>
            {isLoadingTarefas ? (
              <div className="omni-card__body flex flex-col gap-2">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="omni-skeleton h-row w-full" />
                ))}
              </div>
            ) : urgentTasks.length === 0 ? (
              <div className="omni-empty">
                <span className="omni-empty__art">
                  <CheckCircle2 />
                </span>
                <h4>Nenhuma tarefa pendente</h4>
                <p>Tudo em dia. Novas tarefas aparecem aqui assim que forem criadas.</p>
              </div>
            ) : (
              <div className="omni-list">
                {urgentTasks.map((t: any) => {
                  const isAtrasada = t.data_vencimento && t.data_vencimento < todayStr;
                  const isHoje = t.data_vencimento === todayStr;
                  return (
                    <div key={t.tarefa_id} className="omni-list__item">
                      <button
                        type="button"
                        onClick={() => toggleTarefaMutation.mutate(t)}
                        className="shrink-0 rounded-xs text-ink-faint transition-colors hover:text-success"
                        title="Marcar como concluída"
                      >
                        <Square className="size-4" />
                        <span className="omni-sr">Concluir tarefa {t.titulo}</span>
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink">{t.titulo}</p>
                        {t.lead_id && (
                          <Link
                            to="/lead/$leadId"
                            params={{ leadId: t.lead_id }}
                            className="omni-link mt-0.5 inline-flex items-center gap-1 text-xs"
                          >
                            <ExternalLink className="size-3" /> {t.lead_nome || "Ver negócio"}
                          </Link>
                        )}
                      </div>
                      <div className="shrink-0">
                        {isAtrasada ? (
                          <span className="omni-badge omni-badge--danger">Atrasada</span>
                        ) : isHoje ? (
                          <span className="omni-badge omni-badge--warning">Vence hoje</span>
                        ) : (
                          <span className="num omni-small">{formatDate(t.data_vencimento)}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          {/* Oportunidades recentes */}
          <div className="omni-card">
            <div className="omni-card__header">
              <div>
                <h2 className="omni-h4 flex items-center gap-2">
                  <Kanban className="size-4 text-ink-3" /> Últimas oportunidades
                </h2>
                <p className="omni-small mt-0.5">Contatos e negócios mais recentes</p>
              </div>
              <Link to="/negocios" className="omni-link shrink-0 text-xs">
                Ver todos
              </Link>
            </div>
            {isLoadingLeads ? (
              <div className="omni-card__body flex flex-col gap-2">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="omni-skeleton h-row w-full" />
                ))}
              </div>
            ) : recentLeads.length === 0 ? (
              <div className="omni-empty">
                <h4>Nenhuma oportunidade ainda</h4>
                <p>Cadastre um negócio para acompanhar as entradas mais recentes por aqui.</p>
              </div>
            ) : (
              <div className="omni-list">
                {recentLeads.map((lead: any) => {
                  const isGanho =
                    lead.lead_status === "Ganho" || lead.lead_etapa_funil === "Venda Realizada";
                  return (
                    <Link
                      key={lead.lead_id}
                      to="/lead/$leadId"
                      params={{ leadId: lead.lead_id }}
                      className="omni-list__item no-underline"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink">
                          {lead.lead_nome || lead.lead_telefone || "Sem nome"}
                        </p>
                        <p className="omni-small truncate">
                          {lead.lead_origem || "Meta Ads"} · {formatDate(lead.criado_em)}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="num text-sm font-semibold text-ink">
                          {formatCurrency(lead.lead_valor)}
                        </span>
                        <span
                          className={cn(
                            "omni-badge",
                            isGanho ? "omni-badge--success" : "omni-badge--outline",
                          )}
                        >
                          {lead.lead_etapa_funil || "Novo Lead"}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
