import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Bot,
  Building2,
  CheckSquare,
  Download,
  Handshake,
  Percent,
  Repeat,
  Target,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/relatorios")({
  head: () => ({
    meta: [
      { title: "Relatórios · Omni Automações" },
      {
        name: "description",
        content:
          "Conversão do funil, resultado financeiro, carteira de clientes e operação da Omni.",
      },
    ],
  }),
  component: Relatorios,
});

/* ─── Helpers ─── */
const fmtMoeda = (val: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(Number(val) || 0);

const fmtMoedaExata = (val: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(val) || 0);

const fmtMoedaCurta = (val: number) => {
  const n = Number(val) || 0;
  if (Math.abs(n) >= 1000) {
    return `R$ ${(n / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  }
  return `R$ ${n.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
};

const fmtPct = (val: number) => `${(Number(val) || 0).toFixed(1).replace(".", ",")}%`;

const isoDe = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const hojeISO = () => isoDe(new Date());

const addDiasISO = (base: string, dias: number) => {
  const [y, m, d] = base.split("-").map(Number);
  return isoDe(new Date(y, m - 1, d + dias));
};

const soData = (valor?: string | null) => (valor || "").split("T")[0];

const MESES_ABREV = [
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

/* Ordem canônica do funil: define o que significa "avançou" e alimenta o
   cálculo de passagem entre etapas. */
const ETAPAS = [
  "Novo Lead",
  "Tentando Contato",
  "Contato Realizado",
  "Lead Qualificado",
  "Reunião Agendada",
  "Reunião Realizada",
  "Orçamento Enviado",
  "Venda Realizada",
];

const PERIODOS = [
  { id: "30", label: "30 dias" },
  { id: "90", label: "90 dias" },
  { id: "365", label: "12 meses" },
  { id: "todos", label: "Tudo" },
] as const;

type PeriodoId = (typeof PERIODOS)[number]["id"];

const TOOLTIP_STYLE = {
  background: "var(--omni-surface)",
  border: "1px solid var(--omni-border)",
  borderRadius: "var(--omni-radius-md)",
  boxShadow: "var(--omni-shadow-md)",
  fontSize: "var(--omni-text-xs)",
  color: "var(--omni-text)",
} as const;

/* "Parceria Visi" e "Parceria VISI" são a mesma origem — sem normalizar, o
   relatório divide o mesmo canal em duas linhas e subestima os dois. */
const normalizaOrigem = (origem?: string | null) => {
  const limpo = (origem || "").trim();
  if (!limpo) return "Sem origem";
  return limpo
    .toLocaleLowerCase("pt-BR")
    .split(" ")
    .filter(Boolean)
    .map((palavra) => palavra.charAt(0).toLocaleUpperCase("pt-BR") + palavra.slice(1))
    .join(" ");
};

/* ─── Tipos ─── */
interface LeadRow {
  lead_id: string;
  lead_nome: string | null;
  lead_status: string | null;
  lead_etapa_funil: string | null;
  lead_origem: string | null;
  lead_valor: number | null;
  motivo_perda_id: string | null;
  criado_em: string;
}

interface ClienteRow {
  cliente_id: string;
  lead_id: string | null;
  nome: string | null;
  status: string | null;
  valor_contrato: number | null;
  valor_recorrente: number | null;
  data_inicio_contrato: string | null;
}

interface ReceitaRow {
  valor: number | null;
  status: string | null;
  categoria: string | null;
  tipo: string | null;
  data_vencimento: string;
}

interface DespesaRow {
  valor_parcela: number | null;
  status: string | null;
  categoria: string | null;
  tipo: string | null;
  data_vencimento: string;
}

interface MensagemRow {
  lead_id: string | null;
  mensagem_origem: string | null;
  criado_em: string;
}

interface TarefaRow {
  status: string | null;
  data_vencimento: string | null;
  criado_em: string;
}

interface MotivoRow {
  motivo_id: string;
  motivo_nome: string | null;
}

/* ─── Blocos ─── */
function Kpi({
  label,
  valor,
  rodape,
  icone,
  tom,
}: {
  label: string;
  valor: string;
  rodape: React.ReactNode;
  icone: React.ReactNode;
  tom?: "negativo";
}) {
  return (
    <div className="omni-card">
      <div className="omni-stat">
        <span className="omni-stat__label flex items-center gap-1.5">
          {icone} {label}
        </span>
        <p className={cn("omni-stat__value num", tom === "negativo" && "text-danger")}>{valor}</p>
        <p className="omni-stat__foot">{rodape}</p>
      </div>
    </div>
  );
}

function BarraProporcional({
  nome,
  valor,
  detalhe,
  pct,
}: {
  nome: string;
  valor: string;
  detalhe?: string;
  pct: number;
}) {
  return (
    <li>
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate text-sm font-medium text-ink">{nome}</span>
        <span className="num shrink-0 text-sm text-ink-2">
          {valor}
          {detalhe && <span className="omni-muted"> · {detalhe}</span>}
        </span>
      </div>
      <div className="omni-progress mt-1.5">
        <div className="omni-progress__bar" style={{ width: `${Math.max(pct, 2)}%` }} />
      </div>
    </li>
  );
}

function useTabela<T>(chave: string, tabela: string, colunas: string, habilitado: boolean) {
  return useQuery<T[]>({
    queryKey: [chave],
    queryFn: async () => {
      const { data, error } = await supabase.from(tabela).select(colunas);
      if (error) {
        console.error(`Erro ao buscar ${tabela}:`, error);
        return [];
      }
      return (data || []) as T[];
    },
    enabled: habilitado,
  });
}

/* ─── Página ─── */
function Relatorios() {
  const { user } = useAuth();
  const logado = !!user;
  const hoje = hojeISO();
  const [periodo, setPeriodo] = useState<PeriodoId>("90");

  const { data: leads = [], isLoading: carregando } = useTabela<LeadRow>(
    "rel_leads",
    "leads",
    "lead_id, lead_nome, lead_status, lead_etapa_funil, lead_origem, lead_valor, motivo_perda_id, criado_em",
    logado,
  );

  const { data: clientes = [] } = useTabela<ClienteRow>(
    "rel_clientes",
    "clientes",
    "cliente_id, lead_id, nome, status, valor_contrato, valor_recorrente, data_inicio_contrato",
    logado,
  );

  const { data: receitas = [] } = useTabela<ReceitaRow>(
    "rel_receitas",
    "receitas",
    "valor, status, categoria, tipo, data_vencimento",
    logado,
  );

  const { data: despesas = [] } = useTabela<DespesaRow>(
    "rel_despesas",
    "despesas",
    "valor_parcela, status, categoria, tipo, data_vencimento",
    logado,
  );

  const { data: mensagens = [] } = useTabela<MensagemRow>(
    "rel_mensagens",
    "mensagens",
    "lead_id, mensagem_origem, criado_em",
    logado,
  );

  const { data: tarefas = [] } = useTabela<TarefaRow>(
    "rel_tarefas",
    "tarefas",
    "status, data_vencimento, criado_em",
    logado,
  );

  const { data: motivos = [] } = useTabela<MotivoRow>(
    "rel_motivos",
    "motivos_perda",
    "motivo_id, motivo_nome",
    logado,
  );

  /* Data de corte do período: tudo abaixo filtra por ela. */
  const inicio = useMemo(
    () => (periodo === "todos" ? "0000-01-01" : addDiasISO(hoje, -Number(periodo))),
    [periodo, hoje],
  );

  const rotuloPeriodo = useMemo(() => {
    if (periodo === "todos") return "todo o histórico";
    if (periodo === "365") return "os últimos 12 meses";
    return `os últimos ${periodo} dias`;
  }, [periodo]);

  /* ── Comercial ── */
  const leadsPeriodo = useMemo(
    () => leads.filter((l) => soData(l.criado_em) >= inicio),
    [leads, inicio],
  );

  const comercial = useMemo(() => {
    const ganhos = leadsPeriodo.filter((l) => l.lead_status === "Ganho");
    const perdidos = leadsPeriodo.filter((l) => l.lead_status === "Perdido");
    const abertos = leadsPeriodo.filter((l) => l.lead_status === "Aberto");
    const decididos = ganhos.length + perdidos.length;
    const valorGanho = ganhos.reduce((s, l) => s + (Number(l.lead_valor) || 0), 0);

    return {
      criados: leadsPeriodo.length,
      ganhos: ganhos.length,
      perdidos: perdidos.length,
      abertos: abertos.length,
      valorGanho,
      valorEmAberto: abertos.reduce((s, l) => s + (Number(l.lead_valor) || 0), 0),
      valorPerdido: perdidos.reduce((s, l) => s + (Number(l.lead_valor) || 0), 0),
      conversao: decididos > 0 ? (ganhos.length / decididos) * 100 : 0,
      ticket: ganhos.length > 0 ? valorGanho / ganhos.length : 0,
    };
  }, [leadsPeriodo]);

  /*
   * O banco guarda só a etapa atual, não o histórico de passagem. Então
   * "alcançaram" é contado de forma acumulada: quem está na etapa 5 passou
   * pelas anteriores. É a leitura honesta possível com um retrato do funil.
   */
  const funil = useMemo(() => {
    const indiceDe = (etapa?: string | null) => ETAPAS.indexOf(etapa || "");
    const usadas = ETAPAS.map((etapa, i) => {
      const alcancaram = leadsPeriodo.filter((l) => indiceDe(l.lead_etapa_funil) >= i).length;
      const valor = leadsPeriodo
        .filter((l) => indiceDe(l.lead_etapa_funil) >= i)
        .reduce((s, l) => s + (Number(l.lead_valor) || 0), 0);
      return { etapa, alcancaram, valor };
    }).filter((e, i) => e.alcancaram > 0 || i === 0);

    const base = usadas[0]?.alcancaram || 1;
    return usadas.map((e, i) => ({
      ...e,
      pctTotal: (e.alcancaram / base) * 100,
      passagem:
        i === 0 || usadas[i - 1].alcancaram === 0
          ? 100
          : (e.alcancaram / usadas[i - 1].alcancaram) * 100,
    }));
  }, [leadsPeriodo]);

  const origens = useMemo(() => {
    const mapa = new Map<string, { leads: number; ganhos: number; valor: number }>();
    leadsPeriodo.forEach((l) => {
      const nome = normalizaOrigem(l.lead_origem);
      const atual = mapa.get(nome) || { leads: 0, ganhos: 0, valor: 0 };
      atual.leads += 1;
      if (l.lead_status === "Ganho") {
        atual.ganhos += 1;
        atual.valor += Number(l.lead_valor) || 0;
      }
      mapa.set(nome, atual);
    });
    return Array.from(mapa.entries())
      .map(([nome, v]) => ({
        nome,
        ...v,
        conversao: v.leads > 0 ? (v.ganhos / v.leads) * 100 : 0,
      }))
      .sort((a, b) => b.valor - a.valor || b.leads - a.leads);
  }, [leadsPeriodo]);

  const perdas = useMemo(() => {
    const nomePorId = new Map(motivos.map((m) => [m.motivo_id, m.motivo_nome || "Sem nome"]));
    const mapa = new Map<string, number>();
    leadsPeriodo
      .filter((l) => l.lead_status === "Perdido")
      .forEach((l) => {
        const nome = l.motivo_perda_id
          ? nomePorId.get(l.motivo_perda_id) || "Motivo removido"
          : "Sem motivo registrado";
        mapa.set(nome, (mapa.get(nome) || 0) + 1);
      });
    const total = Array.from(mapa.values()).reduce((a, b) => a + b, 0);
    return {
      total,
      linhas: Array.from(mapa.entries())
        .map(([nome, qtd]) => ({ nome, qtd, pct: total > 0 ? (qtd / total) * 100 : 0 }))
        .sort((a, b) => b.qtd - a.qtd),
    };
  }, [leadsPeriodo, motivos]);

  /* Ciclo de venda: dias entre a criação do negócio e o início do contrato. */
  const cicloVenda = useMemo(() => {
    const criacaoPorLead = new Map(leads.map((l) => [l.lead_id, soData(l.criado_em)]));
    const dias: number[] = [];
    clientes.forEach((c) => {
      if (!c.lead_id || !c.data_inicio_contrato) return;
      const criado = criacaoPorLead.get(c.lead_id);
      if (!criado) return;
      const delta = Math.round(
        (new Date(`${soData(c.data_inicio_contrato)}T12:00:00`).getTime() -
          new Date(`${criado}T12:00:00`).getTime()) /
          86400000,
      );
      if (delta >= 0) dias.push(delta);
    });
    if (dias.length === 0) return null;
    return Math.round(dias.reduce((a, b) => a + b, 0) / dias.length);
  }, [leads, clientes]);

  /* ── Financeiro ── */
  const financeiro = useMemo(() => {
    let receitaRealizada = 0;
    let receitaPrevista = 0;
    let despesaRealizada = 0;
    let despesaPrevista = 0;

    receitas.forEach((r) => {
      if (r.status === "cancelado") return;
      if (r.data_vencimento < inicio || r.data_vencimento > hoje) return;
      const v = Number(r.valor) || 0;
      receitaPrevista += v;
      if (r.status === "recebido") receitaRealizada += v;
    });

    despesas.forEach((d) => {
      if (d.status === "cancelado") return;
      if (d.data_vencimento < inicio || d.data_vencimento > hoje) return;
      const v = Number(d.valor_parcela) || 0;
      despesaPrevista += v;
      if (d.status === "pago") despesaRealizada += v;
    });

    const resultado = receitaRealizada - despesaRealizada;
    return {
      receitaRealizada,
      receitaPrevista,
      despesaRealizada,
      despesaPrevista,
      resultado,
      margem: receitaRealizada > 0 ? (resultado / receitaRealizada) * 100 : 0,
      inadimplencia:
        receitaPrevista > 0 ? ((receitaPrevista - receitaRealizada) / receitaPrevista) * 100 : 0,
    };
  }, [receitas, despesas, inicio, hoje]);

  const custoFixoMensal = useMemo(() => {
    const mesAtual = hoje.slice(0, 7);
    return despesas
      .filter(
        (d) =>
          d.tipo === "recorrente" &&
          d.status !== "cancelado" &&
          (d.data_vencimento || "").startsWith(mesAtual),
      )
      .reduce((s, d) => s + (Number(d.valor_parcela) || 0), 0);
  }, [despesas, hoje]);

  /* Série mensal: cobre o período escolhido, no máximo 12 meses. */
  const serieMensal = useMemo(() => {
    const agora = new Date();
    const meses = periodo === "30" ? 3 : periodo === "90" ? 6 : 12;
    const janela = [];
    for (let offset = meses - 1; offset >= 0; offset -= 1) {
      const d = new Date(agora.getFullYear(), agora.getMonth() - offset, 1);
      janela.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        label: MESES_ABREV[d.getMonth()],
        receita: 0,
        despesa: 0,
      });
    }
    const porChave = new Map(janela.map((j) => [j.key, j]));

    receitas.forEach((r) => {
      if (r.status !== "recebido") return;
      const alvo = porChave.get((r.data_vencimento || "").slice(0, 7));
      if (alvo) alvo.receita += Number(r.valor) || 0;
    });
    despesas.forEach((d) => {
      if (d.status !== "pago") return;
      const alvo = porChave.get((d.data_vencimento || "").slice(0, 7));
      if (alvo) alvo.despesa += Number(d.valor_parcela) || 0;
    });

    return janela.map((j) => ({
      ...j,
      receita: Math.round(j.receita),
      despesa: Math.round(j.despesa),
      resultado: Math.round(j.receita - j.despesa),
    }));
  }, [receitas, despesas, periodo]);

  const categoriasDespesa = useMemo(() => {
    const mapa = new Map<string, number>();
    despesas.forEach((d) => {
      if (d.status === "cancelado") return;
      if (d.data_vencimento < inicio || d.data_vencimento > hoje) return;
      const nome = d.categoria || "Outros";
      mapa.set(nome, (mapa.get(nome) || 0) + (Number(d.valor_parcela) || 0));
    });
    const total = Array.from(mapa.values()).reduce((a, b) => a + b, 0);
    return {
      total,
      linhas: Array.from(mapa.entries())
        .map(([nome, valor]) => ({ nome, valor, pct: total > 0 ? (valor / total) * 100 : 0 }))
        .sort((a, b) => b.valor - a.valor)
        .slice(0, 8),
    };
  }, [despesas, inicio, hoje]);

  /* ── Carteira ── */
  const carteira = useMemo(() => {
    const ativos = clientes.filter((c) => c.status === "ativo");
    const cancelados = clientes.filter((c) => c.status === "cancelado");
    const mrr = ativos.reduce((s, c) => s + (Number(c.valor_recorrente) || 0), 0);
    const mrrPerdido = cancelados.reduce((s, c) => s + (Number(c.valor_recorrente) || 0), 0);
    const comRecorrencia = ativos.filter((c) => (Number(c.valor_recorrente) || 0) > 0);

    return {
      ativos: ativos.length,
      cancelados: cancelados.length,
      mrr,
      mrrPerdido,
      churn: clientes.length > 0 ? (cancelados.length / clientes.length) * 100 : 0,
      ticketRecorrente: comRecorrencia.length > 0 ? mrr / comRecorrencia.length : 0,
      contratos: clientes.reduce((s, c) => s + (Number(c.valor_contrato) || 0), 0),
      maiores: [...clientes]
        .sort(
          (a, b) =>
            (Number(b.valor_recorrente) || 0) - (Number(a.valor_recorrente) || 0) ||
            (Number(b.valor_contrato) || 0) - (Number(a.valor_contrato) || 0),
        )
        .slice(0, 6),
    };
  }, [clientes]);

  /* ── Operação ── */
  const atendimento = useMemo(() => {
    const noPeriodo = mensagens.filter((m) => soData(m.criado_em) >= inicio);
    const daIA = noPeriodo.filter((m) => m.mensagem_origem === "IA").length;
    const leadsAtendidos = new Set(noPeriodo.map((m) => m.lead_id).filter(Boolean)).size;
    return {
      total: noPeriodo.length,
      daIA,
      pctIA: noPeriodo.length > 0 ? (daIA / noPeriodo.length) * 100 : 0,
      leadsAtendidos,
    };
  }, [mensagens, inicio]);

  const produtividade = useMemo(() => {
    const noPeriodo = tarefas.filter((t) => soData(t.criado_em) >= inicio);
    const concluidas = noPeriodo.filter(
      (t) => t.status === "concluida" || t.status === "concluída",
    ).length;
    const atrasadas = tarefas.filter(
      (t) =>
        t.status !== "concluida" &&
        t.status !== "concluída" &&
        t.data_vencimento &&
        t.data_vencimento < hoje,
    ).length;
    return {
      total: noPeriodo.length,
      concluidas,
      atrasadas,
      taxa: noPeriodo.length > 0 ? (concluidas / noPeriodo.length) * 100 : 0,
    };
  }, [tarefas, inicio, hoje]);

  const exportarCSV = () => {
    const linhas: [string, string][] = [
      ["Período", rotuloPeriodo],
      ["Negócios criados", String(comercial.criados)],
      ["Negócios ganhos", String(comercial.ganhos)],
      ["Negócios perdidos", String(comercial.perdidos)],
      ["Taxa de conversão", fmtPct(comercial.conversao)],
      ["Ticket médio", fmtMoedaExata(comercial.ticket)],
      ["Valor em negociação", fmtMoedaExata(comercial.valorEmAberto)],
      ["Ciclo médio de venda (dias)", cicloVenda === null ? "—" : String(cicloVenda)],
      ["Receita realizada", fmtMoedaExata(financeiro.receitaRealizada)],
      ["Despesa realizada", fmtMoedaExata(financeiro.despesaRealizada)],
      ["Resultado", fmtMoedaExata(financeiro.resultado)],
      ["Margem", fmtPct(financeiro.margem)],
      ["Custo fixo mensal", fmtMoedaExata(custoFixoMensal)],
      ["Receita recorrente (MRR)", fmtMoedaExata(carteira.mrr)],
      ["Clientes ativos", String(carteira.ativos)],
      ["Clientes cancelados", String(carteira.cancelados)],
      ["Churn", fmtPct(carteira.churn)],
      ["Mensagens no período", String(atendimento.total)],
      ["Respondidas pela IA", fmtPct(atendimento.pctIA)],
    ];

    const csv = ["Indicador,Valor", ...linhas.map(([k, v]) => `"${k}","${v}"`)].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio_omni_${hoje}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Relatório exportado.");
  };

  const semDados = !carregando && leads.length === 0 && clientes.length === 0;

  return (
    <AppShell
      title="Relatórios"
      subtitle="Conversão, resultado financeiro, carteira e operação"
      actions={
        <button
          type="button"
          onClick={exportarCSV}
          className="omni-btn omni-btn--secondary omni-btn--sm"
        >
          <Download /> Exportar indicadores
        </button>
      }
    >
      <div className="omni-stack-6 w-full *:min-w-0">
        {/* ═════ Período — o único filtro da página ═════ */}
        <section className="omni-card flex flex-wrap items-center justify-between gap-3 p-3">
          <div>
            <p className="text-sm font-semibold text-ink">Analisando {rotuloPeriodo}</p>
            <p className="omni-small">
              Comercial e operação por data de criação; financeiro por vencimento.
            </p>
          </div>
          <div className="omni-btn-group" role="group" aria-label="Período do relatório">
            {PERIODOS.map((p) => (
              <button
                key={p.id}
                type="button"
                aria-pressed={periodo === p.id}
                onClick={() => setPeriodo(p.id)}
                className="omni-btn omni-btn--secondary omni-btn--sm"
              >
                {p.label}
              </button>
            ))}
          </div>
        </section>

        {semDados && (
          <div className="omni-card">
            <div className="omni-empty">
              <span className="omni-empty__art">
                <Target />
              </span>
              <h4>Ainda não há dados para analisar</h4>
              <p>
                Cadastre negócios, clientes e lançamentos financeiros — os relatórios se montam
                sozinhos a partir deles.
              </p>
            </div>
          </div>
        )}

        {/* ═════ 1. Comercial ═════ */}
        <section aria-label="Resultado comercial">
          <h2 className="omni-h3 mb-3">Comercial</h2>

          <div className="omni-grid omni-grid-4">
            <Kpi
              label="Negócios criados"
              valor={String(comercial.criados)}
              icone={<Handshake className="size-3.5" />}
              rodape={
                <>
                  <span className="num">{comercial.abertos}</span> ainda em aberto
                </>
              }
            />
            <Kpi
              label="Vendas fechadas"
              valor={fmtMoeda(comercial.valorGanho)}
              icone={<TrendingUp className="size-3.5" />}
              rodape={
                <>
                  <span className="num">{comercial.ganhos}</span>{" "}
                  {comercial.ganhos === 1 ? "negócio ganho" : "negócios ganhos"}
                </>
              }
            />
            <Kpi
              label="Taxa de conversão"
              valor={fmtPct(comercial.conversao)}
              icone={<Percent className="size-3.5" />}
              rodape={
                <>
                  <span className="num">{comercial.ganhos}</span> de{" "}
                  <span className="num">{comercial.ganhos + comercial.perdidos}</span> decididos
                </>
              }
            />
            <Kpi
              label="Ticket médio"
              valor={fmtMoeda(comercial.ticket)}
              icone={<Target className="size-3.5" />}
              rodape={
                cicloVenda === null ? (
                  "ciclo de venda sem histórico"
                ) : cicloVenda === 0 ? (
                  "fechamento no mesmo dia da entrada"
                ) : (
                  <>
                    ciclo médio de <span className="num">{cicloVenda}</span> dias até fechar
                  </>
                )
              }
            />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2 *:min-w-0">
            <div className="omni-card">
              <div className="omni-card__header">
                <div>
                  <h3 className="omni-h4">Funil de conversão</h3>
                  <p className="omni-small mt-0.5">
                    Quantos negócios chegaram a cada etapa e a passagem entre elas
                  </p>
                </div>
              </div>
              <div className="omni-card__body">
                {funil.length === 0 || funil[0].alcancaram === 0 ? (
                  <p className="omni-small">Nenhum negócio no período.</p>
                ) : (
                  <ul className="omni-stack-2">
                    {funil.map((etapa, i) => (
                      <li key={etapa.etapa}>
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="truncate text-sm font-medium text-ink">
                            {etapa.etapa}
                          </span>
                          <span className="num shrink-0 text-sm text-ink-2">
                            {etapa.alcancaram}
                            {i > 0 && (
                              <span
                                className={cn(
                                  "omni-muted",
                                  etapa.passagem < 50 && "text-warning-fg",
                                )}
                              >
                                {" "}
                                · {fmtPct(etapa.passagem)} da anterior
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="omni-progress mt-1.5">
                          <div
                            className="omni-progress__bar"
                            style={{ width: `${Math.max(etapa.pctTotal, 2)}%` }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-4 grid grid-cols-2 gap-3 border-t border-line-subtle pt-3">
                  <div>
                    <p className="omni-small">Em negociação</p>
                    <p className="num text-md font-bold text-ink">
                      {fmtMoeda(comercial.valorEmAberto)}
                    </p>
                  </div>
                  <div>
                    <p className="omni-small">Perdido no período</p>
                    <p className="num text-md font-bold text-ink">
                      {fmtMoeda(comercial.valorPerdido)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="omni-card">
              <div className="omni-card__header">
                <div>
                  <h3 className="omni-h4">Por onde chegam os negócios</h3>
                  <p className="omni-small mt-0.5">Volume, conversão e receita de cada origem</p>
                </div>
              </div>
              <div className="omni-table-scroll">
                <table className="omni-table">
                  <thead>
                    <tr>
                      <th>Origem</th>
                      <th className="omni-th-num">Negócios</th>
                      <th className="omni-th-num">Ganhos</th>
                      <th className="omni-th-num">Conversão</th>
                      <th className="omni-th-num">Receita</th>
                    </tr>
                  </thead>
                  <tbody>
                    {origens.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center text-ink-3">
                          Nenhum negócio no período.
                        </td>
                      </tr>
                    ) : (
                      origens.map((o) => (
                        <tr key={o.nome}>
                          <td className="omni-td-strong">{o.nome}</td>
                          <td className="omni-td-num">{o.leads}</td>
                          <td className="omni-td-num">{o.ganhos}</td>
                          <td className="omni-td-num">
                            <span
                              className={cn(
                                "omni-badge",
                                o.conversao >= 50
                                  ? "omni-badge--success"
                                  : o.conversao > 0
                                    ? "omni-badge--warning"
                                    : "omni-badge--outline",
                              )}
                            >
                              {fmtPct(o.conversao)}
                            </span>
                          </td>
                          <td className="omni-td-num">{fmtMoeda(o.valor)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {perdas.total > 0 && (
            <div className="omni-card mt-4">
              <div className="omni-card__header">
                <div>
                  <h3 className="omni-h4">Por que perdemos</h3>
                  <p className="omni-small mt-0.5">
                    {perdas.total} {perdas.total === 1 ? "negócio perdido" : "negócios perdidos"} em{" "}
                    {rotuloPeriodo}
                  </p>
                </div>
              </div>
              <div className="omni-card__body">
                <ul className="omni-stack-2">
                  {perdas.linhas.map((linha) => (
                    <BarraProporcional
                      key={linha.nome}
                      nome={linha.nome}
                      valor={String(linha.qtd)}
                      detalhe={fmtPct(linha.pct)}
                      pct={linha.pct}
                    />
                  ))}
                </ul>
              </div>
            </div>
          )}
        </section>

        {/* ═════ 2. Financeiro ═════ */}
        <section aria-label="Resultado financeiro">
          <h2 className="omni-h3 mb-3">Financeiro</h2>

          <div className="omni-grid omni-grid-4">
            <Kpi
              label="Receita realizada"
              valor={fmtMoeda(financeiro.receitaRealizada)}
              icone={<TrendingUp className="size-3.5" />}
              rodape={
                <>
                  <span className="num">{fmtMoeda(financeiro.receitaPrevista)}</span> previstos
                </>
              }
            />
            <Kpi
              label="Despesa realizada"
              valor={fmtMoeda(financeiro.despesaRealizada)}
              icone={<TrendingDown className="size-3.5" />}
              rodape={
                <>
                  <span className="num">{fmtMoeda(financeiro.despesaPrevista)}</span> previstos
                </>
              }
            />
            <Kpi
              label="Resultado"
              valor={fmtMoeda(financeiro.resultado)}
              tom={financeiro.resultado < 0 ? "negativo" : undefined}
              icone={<Wallet className="size-3.5" />}
              rodape={
                <>
                  margem de <span className="num">{fmtPct(financeiro.margem)}</span>
                </>
              }
            />
            <Kpi
              label="Custo fixo mensal"
              valor={fmtMoeda(custoFixoMensal)}
              icone={<Repeat className="size-3.5" />}
              rodape="despesas recorrentes deste mês"
            />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr] *:min-w-0">
            <div className="omni-card">
              <div className="omni-card__header">
                <div>
                  <h3 className="omni-h4">Receita e despesa mês a mês</h3>
                  <p className="omni-small mt-0.5">Somente valores já liquidados</p>
                </div>
              </div>
              <div className="omni-card__body">
                <div className="omni-scroll-x scrollbar-slim">
                  <div className="h-64 min-w-[460px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart
                        data={serieMensal}
                        margin={{ left: 4, right: 8, top: 8 }}
                        barGap={2}
                      >
                        <CartesianGrid
                          stroke="var(--omni-chart-grid)"
                          strokeDasharray="3 3"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="label"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fill: "var(--omni-text-3)", fontSize: 11 }}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          width={72}
                          tick={{ fill: "var(--omni-text-3)", fontSize: 10 }}
                          tickFormatter={(v) => fmtMoedaCurta(Number(v))}
                        />
                        <Tooltip
                          cursor={{ fill: "var(--omni-surface-2)" }}
                          contentStyle={TOOLTIP_STYLE}
                          labelStyle={{ color: "var(--omni-text)", fontWeight: 700 }}
                          formatter={(val: number | string, name: string) => [
                            fmtMoedaExata(Number(val)),
                            name,
                          ]}
                        />
                        <Bar
                          dataKey="receita"
                          name="Receita"
                          fill="var(--omni-chart-1)"
                          radius={[4, 4, 0, 0]}
                        />
                        <Bar
                          dataKey="despesa"
                          name="Despesa"
                          fill="var(--omni-chart-2)"
                          radius={[4, 4, 0, 0]}
                        />
                        <Line
                          type="monotone"
                          dataKey="resultado"
                          name="Resultado"
                          stroke="var(--omni-text-2)"
                          strokeWidth={2}
                          dot={{ r: 2.5, fill: "var(--omni-text-2)" }}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>

            <div className="omni-card">
              <div className="omni-card__header">
                <div>
                  <h3 className="omni-h4">Onde a empresa gasta</h3>
                  <p className="omni-small mt-0.5">Despesas do período por categoria</p>
                </div>
                <span className="omni-badge omni-badge--outline num">
                  {fmtMoeda(categoriasDespesa.total)}
                </span>
              </div>
              <div className="omni-card__body">
                {categoriasDespesa.linhas.length === 0 ? (
                  <p className="omni-small">Nenhuma despesa no período.</p>
                ) : (
                  <ul className="omni-stack-2">
                    {categoriasDespesa.linhas.map((linha) => (
                      <BarraProporcional
                        key={linha.nome}
                        nome={linha.nome}
                        valor={fmtMoeda(linha.valor)}
                        detalhe={`${Math.round(linha.pct)}%`}
                        pct={linha.pct}
                      />
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ═════ 3. Carteira de clientes ═════ */}
        <section aria-label="Carteira de clientes">
          <h2 className="omni-h3 mb-3">Carteira de clientes</h2>

          <div className="omni-grid omni-grid-4">
            <Kpi
              label="Receita recorrente"
              valor={fmtMoeda(carteira.mrr)}
              icone={<Repeat className="size-3.5" />}
              rodape={
                <>
                  <span className="num">{carteira.ativos}</span>{" "}
                  {carteira.ativos === 1 ? "cliente ativo" : "clientes ativos"}
                </>
              }
            />
            <Kpi
              label="Recorrência perdida"
              valor={fmtMoeda(carteira.mrrPerdido)}
              tom={carteira.mrrPerdido > 0 ? "negativo" : undefined}
              icone={<TrendingDown className="size-3.5" />}
              rodape={
                <>
                  <span className="num">{carteira.cancelados}</span>{" "}
                  {carteira.cancelados === 1 ? "cancelamento" : "cancelamentos"}
                </>
              }
            />
            <Kpi
              label="Churn de clientes"
              valor={fmtPct(carteira.churn)}
              tom={carteira.churn >= 20 ? "negativo" : undefined}
              icone={<Percent className="size-3.5" />}
              rodape="cancelados sobre o total da carteira"
            />
            <Kpi
              label="Ticket recorrente"
              valor={fmtMoeda(carteira.ticketRecorrente)}
              icone={<Building2 className="size-3.5" />}
              rodape={
                <>
                  <span className="num">{fmtMoeda(carteira.contratos)}</span> em contratos
                </>
              }
            />
          </div>

          <div className="omni-table-wrap mt-4">
            <div className="omni-card__header">
              <div>
                <h3 className="omni-h4">Maiores clientes</h3>
                <p className="omni-small mt-0.5">Ordenados pela recorrência mensal</p>
              </div>
            </div>
            <div className="omni-table-scroll">
              <table className="omni-table">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Situação</th>
                    <th className="omni-th-num">Contrato</th>
                    <th className="omni-th-num">Recorrência</th>
                    <th className="omni-th-num">Início</th>
                  </tr>
                </thead>
                <tbody>
                  {carteira.maiores.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center text-ink-3">
                        Nenhum cliente cadastrado.
                      </td>
                    </tr>
                  ) : (
                    carteira.maiores.map((c) => (
                      <tr key={c.cliente_id}>
                        <td className="omni-td-strong">{c.nome || "Sem nome"}</td>
                        <td>
                          <span
                            className={cn(
                              "omni-badge",
                              c.status === "ativo" ? "omni-badge--success" : "omni-badge--danger",
                            )}
                          >
                            {c.status === "ativo" ? "Ativo" : "Cancelado"}
                          </span>
                        </td>
                        <td className="omni-td-num">{fmtMoeda(Number(c.valor_contrato) || 0)}</td>
                        <td className="omni-td-num">
                          {Number(c.valor_recorrente) > 0
                            ? `${fmtMoeda(Number(c.valor_recorrente))}/mês`
                            : "—"}
                        </td>
                        <td className="omni-td-num">
                          {c.data_inicio_contrato
                            ? soData(c.data_inicio_contrato).split("-").reverse().join("/")
                            : "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ═════ 4. Operação ═════ */}
        <section aria-label="Operação">
          <h2 className="omni-h3 mb-3">Operação</h2>

          <div className="grid gap-4 lg:grid-cols-2 *:min-w-0">
            <div className="omni-card">
              <div className="omni-card__header">
                <div>
                  <h3 className="omni-h4">Atendimento</h3>
                  <p className="omni-small mt-0.5">Conversas registradas em {rotuloPeriodo}</p>
                </div>
              </div>
              <div className="omni-card__body">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <p className="omni-small">Mensagens</p>
                    <p className="num text-xl font-extrabold tracking-tight text-ink">
                      {atendimento.total}
                    </p>
                  </div>
                  <div>
                    <p className="omni-small">Pela IA</p>
                    <p className="num text-xl font-extrabold tracking-tight text-ink">
                      {atendimento.daIA}
                    </p>
                  </div>
                  <div>
                    <p className="omni-small">Negócios atendidos</p>
                    <p className="num text-xl font-extrabold tracking-tight text-ink">
                      {atendimento.leadsAtendidos}
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="flex items-center gap-1.5 text-sm font-medium text-ink">
                      <Bot className="size-3.5" /> Atendido pela IA
                    </span>
                    <span className="num text-sm text-ink-2">{fmtPct(atendimento.pctIA)}</span>
                  </div>
                  <div className="omni-progress mt-1.5">
                    <div
                      className="omni-progress__bar"
                      style={{ width: `${Math.max(atendimento.pctIA, 2)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="omni-card">
              <div className="omni-card__header">
                <div>
                  <h3 className="omni-h4">Tarefas</h3>
                  <p className="omni-small mt-0.5">Criadas em {rotuloPeriodo}</p>
                </div>
              </div>
              <div className="omni-card__body">
                {produtividade.total === 0 && produtividade.atrasadas === 0 ? (
                  <div className="omni-empty">
                    <span className="omni-empty__art">
                      <CheckSquare />
                    </span>
                    <h4>Nenhuma tarefa no período</h4>
                    <p>Assim que a equipe cadastrar tarefas, a taxa de conclusão aparece aqui.</p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <p className="omni-small">Criadas</p>
                        <p className="num text-xl font-extrabold tracking-tight text-ink">
                          {produtividade.total}
                        </p>
                      </div>
                      <div>
                        <p className="omni-small">Concluídas</p>
                        <p className="num text-xl font-extrabold tracking-tight text-ink">
                          {produtividade.concluidas}
                        </p>
                      </div>
                      <div>
                        <p className="omni-small">Atrasadas</p>
                        <p
                          className={cn(
                            "num text-xl font-extrabold tracking-tight",
                            produtividade.atrasadas > 0 ? "text-danger" : "text-ink",
                          )}
                        >
                          {produtividade.atrasadas}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-sm font-medium text-ink">Taxa de conclusão</span>
                        <span className="num text-sm text-ink-2">{fmtPct(produtividade.taxa)}</span>
                      </div>
                      <div className="omni-progress mt-1.5">
                        <div
                          className="omni-progress__bar"
                          style={{ width: `${Math.max(produtividade.taxa, 2)}%` }}
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
