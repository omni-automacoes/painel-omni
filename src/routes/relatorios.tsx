import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";
import {
  Download,
  Calendar,
  DollarSign,
  TrendingUp,
  Award,
  Users,
  Target,
  CheckCircle2,
  XCircle,
  Clock,
  PieChart as PieIcon,
  BarChart3,
  Building2,
  Sparkles,
  ArrowUpRight,
  ShieldAlert,
  FileSpreadsheet,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import { AppShell } from "@/components/AppShell";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/relatorios")({
  head: () => ({
    meta: [
      { title: "Relatórios Comerciais · Omni Automações" },
      {
        name: "description",
        content: "Relatórios analíticos, funil de conversão, financeiro e inteligência de vendas do Omni.",
      },
    ],
  }),
  component: RelatoriosPage,
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

function formatPercent(val: number): string {
  return `${val.toFixed(1)}%`;
}

function formatDate(dateStr?: string | null) {
  if (!dateStr) return "-";
  try {
    const parts = dateStr.split("T")[0].split("-");
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  } catch {}
  return dateStr;
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

const COLORS = {
  primary: "#fba834",
  success: "#10b981",
  danger: "#ef4444",
  info: "#3b82f6",
  purple: "#8b5cf6",
  slate: "#64748b",
};

function RelatoriosPage() {
  const { user } = useAuth();
  const [periodo, setPeriodo] = useState<"30" | "90" | "365" | "todos">("todos");

  /* 1. Fetch Leads */
  const { data: leads = [], isLoading: isLoadingLeads } = useQuery({
    queryKey: ["relatorio_leads"],
    queryFn: async () => {
      const { data, error } = await supabase.from("leads").select("*");
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  /* 2. Fetch Clientes */
  const { data: clientes = [] } = useQuery({
    queryKey: ["relatorio_clientes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clientes").select("*");
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  /* 3. Fetch Receitas */
  const { data: receitas = [] } = useQuery({
    queryKey: ["relatorio_receitas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("receitas").select("*");
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  /* 4. Fetch Motivos de Perda */
  const { data: motivosPerda = [] } = useQuery({
    queryKey: ["relatorio_motivos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("motivos_perda").select("*");
      if (error) return [];
      return data || [];
    },
    enabled: !!user,
  });

  /* 5. Fetch Tarefas */
  const { data: tarefas = [] } = useQuery({
    queryKey: ["relatorio_tarefas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tarefas").select("*");
      if (error) return [];
      return data || [];
    },
    enabled: !!user,
  });

  /* 6. Fetch Mensagens */
  const { data: mensagens = [] } = useQuery({
    queryKey: ["relatorio_mensagens"],
    queryFn: async () => {
      const { data, error } = await supabase.from("mensagens").select("mensagem_id, mensagem_origem, criado_em");
      if (error) return [];
      return data || [];
    },
    enabled: !!user,
  });

  /* ─── Filtro por Período ─── */
  const filteredLeads = useMemo(() => {
    if (periodo === "todos") return leads;
    const days = parseInt(periodo, 10);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return leads.filter((l: any) => new Date(l.criado_em) >= cutoff);
  }, [leads, periodo]);

  /* ─── KPIs Principais ─── */
  const kpis = useMemo(() => {
    const totalLeads = filteredLeads.length;
    const ganhos = filteredLeads.filter((l: any) => l.lead_status === "Ganho" || l.lead_etapa_funil === "Venda Realizada");
    const perdidos = filteredLeads.filter((l: any) => l.lead_status === "Perdido");
    const abertos = filteredLeads.filter((l: any) => l.lead_status === "Aberto" && l.lead_etapa_funil !== "Venda Realizada");

    const taxaConversao = totalLeads > 0 ? (ganhos.length / totalLeads) * 100 : 0;

    const valorTotalPipeline = filteredLeads.reduce((acc: number, l: any) => acc + (Number(l.lead_valor) || 0), 0);
    const valorTotalGanho = ganhos.reduce((acc: number, l: any) => acc + (Number(l.lead_valor) || 0), 0);

    const clientesAtivos = clientes.filter((c: any) => (c.status || "").toLowerCase() === "ativo");
    const mrrTotal = clientesAtivos.reduce((acc: number, c: any) => acc + (Number(c.valor_recorrente) || 0), 0);
    const ticketMedioGanho = ganhos.length > 0 ? valorTotalGanho / ganhos.length : 0;

    const totalMensagensIA = mensagens.filter((m: any) => m.mensagem_origem === "IA").length;
    const totalTarefasConcluidas = tarefas.filter((t: any) => t.status === "concluida").length;

    return {
      totalLeads,
      totalGanhos: ganhos.length,
      totalPerdidos: perdidos.length,
      totalAbertos: abertos.length,
      taxaConversao,
      valorTotalPipeline,
      valorTotalGanho,
      mrrTotal,
      ticketMedioGanho,
      totalMensagensIA,
      totalTarefasConcluidas,
    };
  }, [filteredLeads, clientes, mensagens, tarefas]);

  /* ─── Dados dos Gráficos ─── */

  // 1. Funil de Vendas por Etapa
  const funilData = useMemo(() => {
    return ETAPAS_ORDENADAS.map((etapa) => {
      const count = filteredLeads.filter((l: any) => (l.lead_etapa_funil || "Novo Lead") === etapa).length;
      const valor = filteredLeads
        .filter((l: any) => (l.lead_etapa_funil || "Novo Lead") === etapa)
        .reduce((acc: number, l: any) => acc + (Number(l.lead_valor) || 0), 0);
      return { etapa, count, valor };
    });
  }, [filteredLeads]);

  // 2. Status dos Leads (Donut)
  const statusPieData = useMemo(() => {
    return [
      { name: "Ganhos", value: kpis.totalGanhos, color: COLORS.success },
      { name: "Em Negociação", value: kpis.totalAbertos, color: COLORS.primary },
      { name: "Perdidos", value: kpis.totalPerdidos, color: COLORS.danger },
    ].filter((item) => item.value > 0);
  }, [kpis]);

  // 3. Motivos de Perda
  const motivosPerdaData = useMemo(() => {
    const counts: Record<string, number> = {};
    motivosPerda.forEach((m: any) => { counts[m.motivo_nome] = 0; });
    filteredLeads.forEach((l: any) => {
      if (l.motivo_perda_id) {
        const m = motivosPerda.find((item: any) => item.motivo_id === l.motivo_perda_id);
        const name = m ? m.motivo_nome : "Outro / Não especificado";
        counts[name] = (counts[name] || 0) + 1;
      }
    });
    return Object.entries(counts)
      .map(([motivo, qtd]) => ({ motivo, qtd }))
      .filter((i) => i.qtd > 0)
      .sort((a, b) => b.qtd - a.qtd);
  }, [filteredLeads, motivosPerda]);

  // 4. Origem dos Leads
  const origemData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredLeads.forEach((l: any) => {
      const orig = l.lead_origem || "Meta Ads / Direct";
      counts[orig] = (counts[orig] || 0) + 1;
    });
    return Object.entries(counts).map(([origem, qtd]) => ({ origem, qtd }));
  }, [filteredLeads]);

  /* Exportar Relatório em CSV */
  const handleExportCSV = () => {
    if (filteredLeads.length === 0) {
      toast.error("Nenhum dado para exportar!");
      return;
    }
    const headers = ["Nome", "Telefone", "Origem", "Status", "Etapa", "Valor (R$)", "Criado Em"];
    const rows = filteredLeads.map((l: any) => [
      `"${l.lead_nome || ""}"`,
      `"${l.lead_telefone || ""}"`,
      `"${l.lead_origem || ""}"`,
      `"${l.lead_status || ""}"`,
      `"${l.lead_etapa_funil || ""}"`,
      l.lead_valor || 0,
      `"${l.criado_em}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `relatorio-comercial-omni-${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Relatório comercial exportado em CSV com sucesso!");
  };

  return (
    <AppShell
      title="Relatórios & Inteligência Comercial"
      subtitle="Métricas de conversão de funil, receita realizada, MRR e diagnósticos da operação"
      actions={
        <button
          type="button"
          onClick={handleExportCSV}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#fba834] to-[#f7931e] px-4 py-2 text-xs font-bold text-[#0d0d26] shadow-md shadow-[#fba834]/20 hover:brightness-110 transition-all"
        >
          <Download className="size-4" /> Exportar CSV
        </button>
      }
    >
      <div className="w-full space-y-6 pb-12">
        {/* ══════ 1. SELETOR DE PERÍODO ══════ */}
        <div className="rounded-2xl border border-border bg-card/90 p-3.5 backdrop-blur-2xl shadow-xl flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="size-4 text-accent" />
            <span className="text-xs font-extrabold uppercase tracking-wider text-foreground">Período de Análise:</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: "30", label: "Últimos 30 dias" },
              { id: "90", label: "Últimos 90 dias" },
              { id: "365", label: "Este Ano" },
              { id: "todos", label: "Todo o Histórico" },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriodo(p.id as any)}
                className={cn(
                  "rounded-xl px-3 py-1.5 text-xs font-bold transition-all",
                  periodo === p.id
                    ? "bg-accent text-[#0d0d26] shadow-md shadow-accent/20"
                    : "bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* ══════ 2. KPIS EXECUTIVOS EM DESTAQUE ══════ */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* KPI 1: Taxa de Conversão */}
          <div className="rounded-2xl border border-emerald-500/30 bg-card/90 p-5 backdrop-blur-2xl shadow-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <Award className="size-4" /> Taxa de Conversão
              </span>
              <span className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-400">
                <TrendingUp className="size-4" />
              </span>
            </div>
            <p className="text-3xl font-black text-emerald-400">{formatPercent(kpis.taxaConversao)}</p>
            <p className="text-xs text-muted-foreground">
              {kpis.totalGanhos} fechamentos de {kpis.totalLeads} oportunidades
            </p>
          </div>

          {/* KPI 2: Receita Fechada */}
          <div className="rounded-2xl border border-accent/40 bg-card/90 p-5 backdrop-blur-2xl shadow-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-accent flex items-center gap-1.5">
                <DollarSign className="size-4" /> Faturamento em Contratos
              </span>
              <span className="p-1.5 rounded-lg bg-accent/15 text-accent">
                <Sparkles className="size-4" />
              </span>
            </div>
            <p className="text-3xl font-black text-accent">{formatCurrency(kpis.valorTotalGanho)}</p>
            <p className="text-xs text-muted-foreground">
              Ticket Médio: <strong className="text-foreground">{formatCurrency(kpis.ticketMedioGanho)}</strong>
            </p>
          </div>

          {/* KPI 3: MRR Recorrente Ativo */}
          <div className="rounded-2xl border border-blue-500/30 bg-card/90 p-5 backdrop-blur-2xl shadow-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                <Building2 className="size-4" /> MRR Recorrente
              </span>
              <span className="p-1.5 rounded-lg bg-blue-500/15 text-blue-400">
                <Users className="size-4" />
              </span>
            </div>
            <p className="text-3xl font-black text-foreground">{formatCurrency(kpis.mrrTotal)}<span className="text-xs font-normal text-muted-foreground">/mês</span></p>
            <p className="text-xs text-muted-foreground">
              {clientes.length} clientes ativos na base
            </p>
          </div>

          {/* KPI 4: Pipeline em Aberto */}
          <div className="rounded-2xl border border-border bg-card/90 p-5 backdrop-blur-2xl shadow-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Target className="size-4 text-accent" /> Pipeline em Aberto
              </span>
              <span className="p-1.5 rounded-lg bg-white/5 text-muted-foreground">
                <Clock className="size-4" />
              </span>
            </div>
            <p className="text-3xl font-black text-foreground">{formatCurrency(kpis.valorTotalPipeline - kpis.valorTotalGanho)}</p>
            <p className="text-xs text-muted-foreground">
              {kpis.totalAbertos} negócios em andamento
            </p>
          </div>
        </div>

        {/* ══════ 3. GRÁFICOS PRINCIPAIS (FUNIL DE VENDAS & STATUS) ══════ */}
        <div className="grid gap-6 lg:grid-cols-3">
          
          {/* Gráfico 1: Funil por Etapa (2 colunas) */}
          <div className="rounded-2xl border border-border bg-card/90 p-6 backdrop-blur-2xl shadow-xl space-y-4 lg:col-span-2">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-foreground flex items-center gap-2">
                  <BarChart3 className="size-4 text-accent" /> Funil de Conversão Comercial
                </h3>
                <p className="text-xs text-muted-foreground">Quantidade de leads ativos por etapa do funil</p>
              </div>
            </div>

            <div className="h-72 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={funilData} layout="vertical" margin={{ left: 30, right: 30, top: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" horizontal={false} />
                  <XAxis type="number" stroke="#94a3b8" fontSize={11} />
                  <YAxis dataKey="etapa" type="category" stroke="#94a3b8" fontSize={10} width={110} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#12122d",
                      borderColor: "#fba83440",
                      borderRadius: "12px",
                      fontSize: "12px",
                      color: "#fff",
                    }}
                    formatter={(value: any, name: any) => [
                      `${value} leads`,
                      "Volume",
                    ]}
                  />
                  <Bar dataKey="count" fill="url(#goldGradient)" radius={[0, 8, 8, 0]}>
                    {funilData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.etapa === "Venda Realizada" ? "#10b981" : "#fba834"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Gráfico 2: Donut Status dos Negócios (1 coluna) */}
          <div className="rounded-2xl border border-border bg-card/90 p-6 backdrop-blur-2xl shadow-xl space-y-4 lg:col-span-1">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-foreground flex items-center gap-2">
                  <PieIcon className="size-4 text-accent" /> Taxa de Fechamento
                </h3>
                <p className="text-xs text-muted-foreground">Distribuição de resultados</p>
              </div>
            </div>

            <div className="h-56 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {statusPieData.map((entry, index) => (
                      <Cell key={`pie-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#12122d",
                      borderColor: "#ffffff20",
                      borderRadius: "12px",
                      fontSize: "12px",
                      color: "#fff",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-2 pt-2 border-t border-border/40 text-xs">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-emerald-400 font-bold">
                  <span className="size-2 rounded-full bg-emerald-400" /> Ganhos
                </span>
                <span className="font-extrabold text-foreground">{kpis.totalGanhos} ({formatPercent(kpis.taxaConversao)})</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-accent font-bold">
                  <span className="size-2 rounded-full bg-accent" /> Em Aberto
                </span>
                <span className="font-extrabold text-foreground">{kpis.totalAbertos}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-red-400 font-bold">
                  <span className="size-2 rounded-full bg-red-400" /> Perdidos
                </span>
                <span className="font-extrabold text-foreground">{kpis.totalPerdidos}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ══════ 4. GRÁFICOS SECUNDÁRIOS: MOTIVOS DE PERDA & ORIGEM ══════ */}
        <div className="grid gap-6 md:grid-cols-2">
          
          {/* Motivos de Perda */}
          <div className="rounded-2xl border border-border bg-card/90 p-6 backdrop-blur-2xl shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-foreground flex items-center gap-2">
                  <ShieldAlert className="size-4 text-red-400" /> Motivos de Perda Comercial
                </h3>
                <p className="text-xs text-muted-foreground">Diagnóstico dos principais gargalos de fechamento</p>
              </div>
            </div>

            {motivosPerdaData.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                Nenhum negócio marcado como perdido com motivo registrado.
              </div>
            ) : (
              <div className="space-y-3 pt-1">
                {motivosPerdaData.map((item) => {
                  const percent = kpis.totalPerdidos > 0 ? (item.qtd / kpis.totalPerdidos) * 100 : 0;
                  return (
                    <div key={item.motivo} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="text-foreground">{item.motivo}</span>
                        <span className="text-red-400 font-bold">{item.qtd} ({percent.toFixed(0)}%)</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                        <div
                          className="h-full bg-red-500 rounded-full transition-all"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Origem dos Leads */}
          <div className="rounded-2xl border border-border bg-card/90 p-6 backdrop-blur-2xl shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-foreground flex items-center gap-2">
                  <Sparkles className="size-4 text-accent" /> Canais de Aquisição (Origem)
                </h3>
                <p className="text-xs text-muted-foreground">De onde estão vindo os leads qualificados</p>
              </div>
            </div>

            <div className="space-y-3 pt-1">
              {origemData.map((item) => {
                const percent = kpis.totalLeads > 0 ? (item.qtd / kpis.totalLeads) * 100 : 0;
                return (
                  <div key={item.origem} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-foreground">{item.origem}</span>
                      <span className="text-accent font-bold">{item.qtd} leads ({percent.toFixed(0)}%)</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full bg-gradient-to-r from-[#fba834] to-[#f7931e] rounded-full transition-all"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ══════ 5. RANKING DOS MAIORES CLIENTES & CONTRATOS GANHOS ══════ */}
        <section className="rounded-2xl border border-border bg-card/90 backdrop-blur-2xl shadow-xl overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <div>
              <h3 className="text-sm font-extrabold text-foreground flex items-center gap-2">
                <Award className="size-4 text-accent" /> Carteira de Clientes Fechados & Contratos
              </h3>
              <p className="text-xs text-muted-foreground">Listagem de negócios convertidos em clientes ativos</p>
            </div>
            <span className="rounded-lg bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 text-xs font-bold text-emerald-400">
              {clientes.length} clientes ativos
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-secondary/40 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border">
                <tr>
                  <th className="px-6 py-3.5">Cliente / Empresa</th>
                  <th className="px-6 py-3.5">Telefone</th>
                  <th className="px-6 py-3.5">Valor Implantação</th>
                  <th className="px-6 py-3.5">Mensalidade (MRR)</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Início</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {clientes.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-xs text-muted-foreground">
                      Nenhum cliente cadastrado.
                    </td>
                  </tr>
                ) : (
                  clientes.map((c: any) => (
                    <tr key={c.cliente_id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-3.5 font-bold text-xs text-foreground">
                        {c.nome}
                        {c.empresa && <span className="block text-[11px] font-normal text-muted-foreground">{c.empresa}</span>}
                      </td>
                      <td className="px-6 py-3.5 text-xs text-muted-foreground">
                        {c.telefone || "-"}
                      </td>
                      <td className="px-6 py-3.5 text-xs font-extrabold text-accent">
                        {formatCurrency(c.valor_contrato)}
                      </td>
                      <td className="px-6 py-3.5 text-xs font-extrabold text-emerald-400">
                        {c.valor_recorrente ? `${formatCurrency(c.valor_recorrente)}/mês` : "-"}
                      </td>
                      <td className="px-6 py-3.5">
                        <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                          {c.status || "ativo"}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-right text-xs text-muted-foreground">
                        {formatDate(c.data_inicio_contrato || c.criado_em)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
