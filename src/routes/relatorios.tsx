import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";
import {
  Download,
  Calendar,
  DollarSign,
  Award,
  Users,
  Target,
  PieChart as PieIcon,
  BarChart3,
  Building2,
  Sparkles,
  ShieldAlert,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
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
        content:
          "Relatórios analíticos, funil de conversão, financeiro e inteligência de vendas do Omni.",
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
  return `${val.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
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

/*
 * Séries de gráfico: ordem fixa do design system (seção 6). Os tokens de status
 * (--omni-success/--omni-danger) são reservados e nunca viram cor de série, por
 * isso a distribuição por resultado usa os slots 1, 2 e 3 com rótulo em texto.
 */
const SERIE = {
  s1: "var(--omni-chart-1)",
  s2: "var(--omni-chart-2)",
  s3: "var(--omni-chart-3)",
};

const PERIODOS = [
  { id: "30", label: "Últimos 30 dias" },
  { id: "90", label: "Últimos 90 dias" },
  { id: "365", label: "Este ano" },
  { id: "todos", label: "Todo o histórico" },
] as const;

const TOOLTIP_STYLE = {
  background: "var(--omni-surface)",
  border: "1px solid var(--omni-border)",
  borderRadius: "var(--omni-radius-md)",
  boxShadow: "var(--omni-shadow-md)",
  fontSize: "var(--omni-text-xs)",
  color: "var(--omni-text)",
} as const;

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
  const { data: clientes = [], isLoading: isLoadingClientes } = useQuery({
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
      const { data, error } = await supabase
        .from("mensagens")
        .select("mensagem_id, mensagem_origem, criado_em");
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
    const ganhos = filteredLeads.filter(
      (l: any) => l.lead_status === "Ganho" || l.lead_etapa_funil === "Venda Realizada",
    );
    const perdidos = filteredLeads.filter((l: any) => l.lead_status === "Perdido");
    const abertos = filteredLeads.filter(
      (l: any) => l.lead_status === "Aberto" && l.lead_etapa_funil !== "Venda Realizada",
    );

    const taxaConversao = totalLeads > 0 ? (ganhos.length / totalLeads) * 100 : 0;

    const valorTotalPipeline = filteredLeads.reduce(
      (acc: number, l: any) => acc + (Number(l.lead_valor) || 0),
      0,
    );
    const valorTotalGanho = ganhos.reduce(
      (acc: number, l: any) => acc + (Number(l.lead_valor) || 0),
      0,
    );

    const clientesAtivos = clientes.filter((c: any) => (c.status || "").toLowerCase() === "ativo");
    const mrrTotal = clientesAtivos.reduce(
      (acc: number, c: any) => acc + (Number(c.valor_recorrente) || 0),
      0,
    );
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
      const count = filteredLeads.filter(
        (l: any) => (l.lead_etapa_funil || "Novo Lead") === etapa,
      ).length;
      const valor = filteredLeads
        .filter((l: any) => (l.lead_etapa_funil || "Novo Lead") === etapa)
        .reduce((acc: number, l: any) => acc + (Number(l.lead_valor) || 0), 0);
      return { etapa, count, valor };
    });
  }, [filteredLeads]);

  // 2. Status dos Leads (Donut)
  const statusPieData = useMemo(() => {
    return [
      { name: "Ganhos", value: kpis.totalGanhos, color: SERIE.s1 },
      { name: "Em negociação", value: kpis.totalAbertos, color: SERIE.s2 },
      { name: "Perdidos", value: kpis.totalPerdidos, color: SERIE.s3 },
    ].filter((item) => item.value > 0);
  }, [kpis]);

  // 3. Motivos de Perda
  const motivosPerdaData = useMemo(() => {
    const counts: Record<string, number> = {};
    motivosPerda.forEach((m: any) => {
      counts[m.motivo_nome] = 0;
    });
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

    const csvContent =
      "data:text/csv;charset=utf-8,﻿" +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `relatorio-comercial-omni-${new Date().toISOString().split("T")[0]}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Relatório comercial exportado em CSV com sucesso!");
  };

  const periodoLabel = PERIODOS.find((p) => p.id === periodo)?.label ?? "";

  return (
    <AppShell
      title="Relatórios e inteligência comercial"
      subtitle="Conversão do funil, receita realizada, MRR e diagnóstico da operação"
      actions={
        <button
          type="button"
          onClick={handleExportCSV}
          className="omni-btn omni-btn--primary omni-btn--sm"
        >
          <Download /> Exportar CSV
        </button>
      }
    >
      <div className="omni-stack-6 w-full">
        {/* ══════ 1. Período de análise ══════ */}

        <div className="omni-card">
          <div className="omni-card__body flex flex-wrap items-center justify-between gap-4 py-3">
            <span className="flex items-center gap-2 text-sm font-medium text-ink-2">
              <Calendar className="size-4 text-ink-3" /> Período de análise
            </span>

            <div className="omni-btn-group" role="group" aria-label="Período de análise">
              {PERIODOS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={periodo === p.id}
                  onClick={() => setPeriodo(p.id as any)}
                  className="omni-btn omni-btn--secondary omni-btn--sm"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ══════ 2. Indicadores do período ══════ */}

        <section className="omni-grid omni-grid-4" aria-label="Indicadores do período">
          <div className="omni-card">
            <div className="omni-stat">
              <span className="omni-stat__label flex items-center gap-1.5">
                <Award className="size-3.5" /> Taxa de conversão
              </span>
              <p className="omni-stat__value">{formatPercent(kpis.taxaConversao)}</p>
              <p className="omni-stat__foot">
                {kpis.totalGanhos} fechamentos de {kpis.totalLeads} oportunidades
              </p>
            </div>
          </div>

          <div className="omni-card">
            <div className="omni-stat">
              <span className="omni-stat__label flex items-center gap-1.5">
                <DollarSign className="size-3.5" /> Faturamento em contratos
              </span>
              <p className="omni-stat__value">{formatCurrency(kpis.valorTotalGanho)}</p>
              <p className="omni-stat__foot">
                Ticket médio de{" "}
                <span className="num font-semibold text-ink">
                  {formatCurrency(kpis.ticketMedioGanho)}
                </span>
              </p>
            </div>
          </div>

          <div className="omni-card">
            <div className="omni-stat">
              <span className="omni-stat__label flex items-center gap-1.5">
                <Building2 className="size-3.5" /> MRR recorrente
              </span>
              <p className="omni-stat__value">
                {formatCurrency(kpis.mrrTotal)}
                <small>/mês</small>
              </p>
              <p className="omni-stat__foot">
                <Users className="size-3.5" /> {clientes.length} clientes na base
              </p>
            </div>
          </div>

          <div className="omni-card">
            <div className="omni-stat">
              <span className="omni-stat__label flex items-center gap-1.5">
                <Target className="size-3.5" /> Pipeline em aberto
              </span>
              <p className="omni-stat__value">
                {formatCurrency(kpis.valorTotalPipeline - kpis.valorTotalGanho)}
              </p>
              <p className="omni-stat__foot">{kpis.totalAbertos} negócios em andamento</p>
            </div>
          </div>
        </section>

        {/* ══════ 3. Funil e distribuição por resultado ══════ */}

        <section className="grid gap-6 lg:grid-cols-3">
          <div className="omni-card lg:col-span-2">
            <div className="omni-card__header">
              <div>
                <h2 className="omni-h4 flex items-center gap-2">
                  <BarChart3 className="size-4 text-ink-3" /> Funil de conversão
                </h2>
                <p className="omni-small mt-0.5">Leads por etapa · {periodoLabel.toLowerCase()}</p>
              </div>
            </div>

            <div className="omni-card__body">
              {isLoadingLeads ? (
                <div className="omni-skeleton h-72 w-full" />
              ) : filteredLeads.length === 0 ? (
                <div className="omni-empty">
                  <h4>Nenhum lead neste período</h4>
                  <p>Escolha um intervalo maior em "Período de análise" para ver o funil.</p>
                </div>
              ) : (
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={funilData}
                      layout="vertical"
                      margin={{ left: 8, right: 24, top: 4, bottom: 4 }}
                    >
                      <CartesianGrid
                        stroke="var(--omni-chart-grid)"
                        strokeDasharray="3 3"
                        horizontal={false}
                      />
                      <XAxis
                        type="number"
                        stroke="var(--omni-chart-axis)"
                        tick={{ fill: "var(--omni-text-3)", fontSize: 11 }}
                        tickLine={false}
                        allowDecimals={false}
                      />
                      <YAxis
                        dataKey="etapa"
                        type="category"
                        stroke="var(--omni-chart-axis)"
                        tick={{ fill: "var(--omni-text-3)", fontSize: 10 }}
                        tickLine={false}
                        axisLine={false}
                        width={124}
                      />
                      <Tooltip
                        cursor={{ fill: "var(--omni-surface-2)" }}
                        contentStyle={TOOLTIP_STYLE}
                        labelStyle={{ color: "var(--omni-text)", fontWeight: 700 }}
                        formatter={(value: any) => [`${value} leads`, "Volume"]}
                      />
                      <Bar dataKey="count" fill={SERIE.s1} radius={[0, 4, 4, 0]} barSize={18} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          <div className="omni-card flex flex-col">
            <div className="omni-card__header">
              <div>
                <h2 className="omni-h4 flex items-center gap-2">
                  <PieIcon className="size-4 text-ink-3" /> Distribuição por resultado
                </h2>
                <p className="omni-small mt-0.5">Ganhos, em negociação e perdidos</p>
              </div>
            </div>

            <div className="omni-card__body flex-1">
              {statusPieData.length === 0 ? (
                <div className="omni-empty">
                  <h4>Sem negócios no período</h4>
                  <p>Assim que houver oportunidades, a distribuição aparece aqui.</p>
                </div>
              ) : (
                <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusPieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={52}
                        outerRadius={78}
                        paddingAngle={2}
                        dataKey="value"
                        stroke="var(--omni-chart-surface)"
                        strokeWidth={2}
                      >
                        {statusPieData.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={TOOLTIP_STYLE}
                        labelStyle={{ color: "var(--omni-text)", fontWeight: 700 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="omni-list border-t border-line-subtle">
              <div className="omni-list__item py-2">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ background: SERIE.s1 }}
                  aria-hidden="true"
                />
                <span className="flex-1 text-sm text-ink-2">Ganhos</span>
                <span className="num text-sm font-semibold text-ink">
                  {kpis.totalGanhos} · {formatPercent(kpis.taxaConversao)}
                </span>
              </div>
              <div className="omni-list__item py-2">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ background: SERIE.s2 }}
                  aria-hidden="true"
                />
                <span className="flex-1 text-sm text-ink-2">Em negociação</span>
                <span className="num text-sm font-semibold text-ink">{kpis.totalAbertos}</span>
              </div>
              <div className="omni-list__item py-2">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ background: SERIE.s3 }}
                  aria-hidden="true"
                />
                <span className="flex-1 text-sm text-ink-2">Perdidos</span>
                <span className="num text-sm font-semibold text-ink">{kpis.totalPerdidos}</span>
              </div>
            </div>
          </div>
        </section>

        {/* ══════ 4. Motivos de perda e canais de aquisição ══════ */}

        <section className="grid gap-6 md:grid-cols-2">
          <div className="omni-card">
            <div className="omni-card__header">
              <div>
                <h2 className="omni-h4 flex items-center gap-2">
                  <ShieldAlert className="size-4 text-ink-3" /> Motivos de perda
                </h2>
                <p className="omni-small mt-0.5">Onde as negociações estão parando</p>
              </div>
            </div>

            <div className="omni-card__body">
              {motivosPerdaData.length === 0 ? (
                <div className="omni-empty">
                  <h4>Nenhum motivo registrado</h4>
                  <p>
                    Ao marcar um negócio como perdido, informe o motivo para ele aparecer neste
                    diagnóstico.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {motivosPerdaData.map((item) => {
                    const percent =
                      kpis.totalPerdidos > 0 ? (item.qtd / kpis.totalPerdidos) * 100 : 0;
                    return (
                      <div key={item.motivo} className="flex flex-col gap-1.5">
                        <div className="flex items-baseline justify-between gap-3 text-xs">
                          <span className="truncate font-medium text-ink-2">{item.motivo}</span>
                          <span className="num shrink-0 font-semibold text-ink">
                            {item.qtd} · {percent.toFixed(0)}%
                          </span>
                        </div>
                        <div className="omni-progress">
                          <div className="omni-progress__bar" style={{ width: `${percent}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="omni-card">
            <div className="omni-card__header">
              <div>
                <h2 className="omni-h4 flex items-center gap-2">
                  <Sparkles className="size-4 text-ink-3" /> Canais de aquisição
                </h2>
                <p className="omni-small mt-0.5">De onde vêm os leads do período</p>
              </div>
            </div>

            <div className="omni-card__body">
              {origemData.length === 0 ? (
                <div className="omni-empty">
                  <h4>Nenhuma origem registrada</h4>
                  <p>Preencha a origem ao cadastrar um negócio para medir os canais.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {origemData.map((item) => {
                    const percent = kpis.totalLeads > 0 ? (item.qtd / kpis.totalLeads) * 100 : 0;
                    return (
                      <div key={item.origem} className="flex flex-col gap-1.5">
                        <div className="flex items-baseline justify-between gap-3 text-xs">
                          <span className="truncate font-medium text-ink-2">{item.origem}</span>
                          <span className="num shrink-0 font-semibold text-ink">
                            {item.qtd} leads · {percent.toFixed(0)}%
                          </span>
                        </div>
                        <div className="omni-progress">
                          <div className="omni-progress__bar" style={{ width: `${percent}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ══════ 5. Carteira de clientes ══════ */}

        <section className="omni-table-wrap">
          <div className="omni-card__header">
            <div>
              <h2 className="omni-h4 flex items-center gap-2">
                <Award className="size-4 text-ink-3" /> Carteira de clientes
              </h2>
              <p className="omni-small mt-0.5">Negócios convertidos em contrato</p>
            </div>
            <span className="omni-badge omni-badge--brand">{clientes.length} clientes</span>
          </div>

          <div className="omni-table-scroll">
            <table className="omni-table">
              <thead>
                <tr>
                  <th>Cliente / Empresa</th>
                  <th>Telefone</th>
                  <th className="omni-th-num">Implantação</th>
                  <th className="omni-th-num">Mensalidade</th>
                  <th>Situação</th>
                  <th className="omni-th-num">Início</th>
                </tr>
              </thead>
              <tbody>
                {isLoadingClientes ? (
                  [0, 1, 2, 3, 4].map((i) => (
                    <tr key={i}>
                      <td colSpan={6} className="p-0">
                        <div className="omni-skeleton h-row w-full rounded-none" />
                      </td>
                    </tr>
                  ))
                ) : clientes.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-0">
                      <div className="omni-empty">
                        <h4>Nenhum cliente cadastrado</h4>
                        <p>
                          Converta um negócio em cliente na tela de Negócios para ele aparecer nesta
                          carteira.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  clientes.map((c: any) => {
                    const ativo = (c.status || "ativo").toLowerCase() === "ativo";
                    return (
                      <tr key={c.cliente_id}>
                        <td className="omni-td-strong">
                          {c.nome}
                          {c.empresa && (
                            <span className="block text-xs font-normal text-ink-3">
                              {c.empresa}
                            </span>
                          )}
                        </td>
                        <td className="num text-ink-2">{c.telefone || "—"}</td>
                        <td className="omni-td-num">{formatCurrency(c.valor_contrato)}</td>
                        <td className="omni-td-num">
                          {c.valor_recorrente ? `${formatCurrency(c.valor_recorrente)}/mês` : "—"}
                        </td>
                        <td>
                          <span
                            className={cn(
                              "omni-badge",
                              ativo ? "omni-badge--success" : "omni-badge--outline",
                            )}
                          >
                            {c.status || "ativo"}
                          </span>
                        </td>
                        <td className="omni-td-num">
                          {formatDate(c.data_inicio_contrato || c.criado_em)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="omni-table__foot">
            <span>
              {clientes.length} {clientes.length === 1 ? "cliente" : "clientes"} na carteira
            </span>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
