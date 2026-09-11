import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowRight,
  Calculator,
  CalendarClock,
  CheckSquare,
  Handshake,
  Plus,
  Repeat,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useMemo } from "react";
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

import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Visão Geral · Omni Automações" },
      {
        name: "description",
        content: "Resumo diário de caixa, funil comercial e pendências da Omni Automações.",
      },
    ],
  }),
  component: VisaoGeral,
});

/* ─── Helpers ─── */
const fmtMoeda = (val: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(val) || 0);

const fmtMoedaCurta = (val: number) => {
  const n = Number(val) || 0;
  if (Math.abs(n) >= 1000) {
    return `R$ ${(n / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  }
  return `R$ ${n.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
};

const fmtDiaMes = (d?: string | null) => {
  if (!d) return "—";
  const parte = d.split("T")[0].split("-");
  return parte.length === 3 ? `${parte[2]}/${parte[1]}` : d;
};

const isoDe = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const hojeISO = () => isoDe(new Date());

const addDiasISO = (base: string, dias: number) => {
  const [y, m, d] = base.split("-").map(Number);
  return isoDe(new Date(y, m - 1, d + dias));
};

const diasEntre = (de: string, ate: string) =>
  Math.round(
    (new Date(`${ate}T12:00:00`).getTime() - new Date(`${de}T12:00:00`).getTime()) / 86400000,
  );

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

/* Ordem do funil comercial. Etapas fora desta lista entram no fim. */
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

const TOOLTIP_STYLE = {
  background: "var(--omni-surface)",
  border: "1px solid var(--omni-border)",
  borderRadius: "var(--omni-radius-md)",
  boxShadow: "var(--omni-shadow-md)",
  fontSize: "var(--omni-text-xs)",
  color: "var(--omni-text)",
} as const;

/* Lançamento em aberto e vencido conta como atraso: o banco só grava
   "pendente", nunca "atrasado". Mesma regra usada no Financeiro. */
const emAberto = (status?: string | null) => status === "pendente" || status === "atrasado";

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

/* Contador acionável: mostra o que exige decisão e leva direto para a tela. */
function Pendencia({
  titulo,
  quantidade,
  detalhe,
  para,
  icone,
  alerta,
}: {
  titulo: string;
  quantidade: number;
  detalhe: string;
  para: string;
  icone: React.ReactNode;
  alerta?: boolean;
}) {
  const vazio = quantidade === 0;
  return (
    <Link
      to={para}
      className={cn(
        "omni-card flex items-center gap-3 p-4 transition-colors duration-[var(--omni-dur-fast)] ease-omni",
        "hover:border-line-strong",
        alerta && !vazio && "border-danger",
      )}
    >
      <span
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-lg",
          vazio
            ? "bg-surface-3 text-ink-faint"
            : alerta
              ? "bg-danger-soft text-danger"
              : "bg-primary-soft text-primary-soft-fg",
        )}
        aria-hidden="true"
      >
        {icone}
      </span>

      <div className="min-w-0 flex-1">
        <p className="flex items-baseline gap-2">
          <span
            className={cn(
              "num text-xl font-extrabold tracking-tight",
              vazio ? "text-ink-faint" : alerta ? "text-danger" : "text-ink",
            )}
          >
            {quantidade}
          </span>
          <span className="truncate text-sm font-medium text-ink-2">{titulo}</span>
        </p>
        <p className="omni-small truncate">{vazio ? "nada pendente" : detalhe}</p>
      </div>

      <ArrowRight className="size-4 shrink-0 text-ink-faint" aria-hidden="true" />
    </Link>
  );
}

/* Leitura simples de uma tabela inteira — o volume aqui é de dezenas de
   linhas, então agregar no cliente sai mais barato que várias idas ao banco. */
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
function VisaoGeral() {
  const { user } = useAuth();
  const logado = !!user;
  const hoje = hojeISO();
  const chaveMesAtual = hoje.slice(0, 7);

  const { data: leads = [], isLoading: carregandoLeads } = useTabela<{
    lead_id: string;
    lead_nome: string | null;
    lead_status: string | null;
    lead_etapa_funil: string | null;
    lead_valor: number | null;
    criado_em: string;
  }>(
    "visao_leads",
    "leads",
    "lead_id, lead_nome, lead_status, lead_etapa_funil, lead_valor, criado_em",
    logado,
  );

  const { data: clientes = [] } = useTabela<{
    cliente_id: string;
    status: string | null;
    valor_recorrente: number | null;
    valor_contrato: number | null;
  }>("visao_clientes", "clientes", "cliente_id, status, valor_recorrente, valor_contrato", logado);

  const { data: receitas = [] } = useTabela<{
    receita_id: string;
    descricao: string | null;
    valor: number | null;
    status: string | null;
    data_vencimento: string;
    cliente_nome: string | null;
  }>(
    "visao_receitas",
    "receitas",
    "receita_id, descricao, valor, status, data_vencimento, cliente_nome",
    logado,
  );

  const { data: despesas = [] } = useTabela<{
    despesa_id: string;
    descricao: string | null;
    valor_parcela: number | null;
    status: string | null;
    data_vencimento: string;
    fornecedor: string | null;
  }>(
    "visao_despesas",
    "despesas",
    "despesa_id, descricao, valor_parcela, status, data_vencimento, fornecedor",
    logado,
  );

  const { data: tarefas = [] } = useTabela<{
    tarefa_id: string;
    titulo: string | null;
    status: string | null;
    data_vencimento: string | null;
  }>("visao_tarefas", "tarefas", "tarefa_id, titulo, status, data_vencimento", logado);

  const { data: orcamentos = [] } = useTabela<{
    orcamento_id: number;
    lead_id: string | null;
  }>("visao_orcamentos", "orcamentos", "orcamento_id, lead_id", logado);

  const { data: mensagens = [] } = useTabela<{
    lead_id: string | null;
    criado_em: string;
  }>("visao_mensagens", "mensagens", "lead_id, criado_em", logado);

  /* ── Dinheiro ── */
  const caixa = useMemo(() => {
    let entrouMes = 0;
    let aReceberMes = 0;
    let saiuMes = 0;
    let aPagarMes = 0;

    receitas.forEach((r) => {
      if (r.status === "cancelado") return;
      if (!(r.data_vencimento || "").startsWith(chaveMesAtual)) return;
      const v = Number(r.valor) || 0;
      if (r.status === "recebido") entrouMes += v;
      else if (emAberto(r.status)) aReceberMes += v;
    });

    despesas.forEach((d) => {
      if (d.status === "cancelado") return;
      if (!(d.data_vencimento || "").startsWith(chaveMesAtual)) return;
      const v = Number(d.valor_parcela) || 0;
      if (d.status === "pago") saiuMes += v;
      else if (emAberto(d.status)) aPagarMes += v;
    });

    return {
      entrouMes,
      aReceberMes,
      saiuMes,
      aPagarMes,
      saldoRealizado: entrouMes - saiuMes,
      saldoPrevisto: entrouMes + aReceberMes - (saiuMes + aPagarMes),
    };
  }, [receitas, despesas, chaveMesAtual]);

  const mrr = useMemo(
    () =>
      clientes
        .filter((c) => c.status === "ativo")
        .reduce((soma, c) => soma + (Number(c.valor_recorrente) || 0), 0),
    [clientes],
  );

  const clientesAtivos = useMemo(
    () => clientes.filter((c) => c.status === "ativo").length,
    [clientes],
  );

  /* ── Comercial ── */
  const comercial = useMemo(() => {
    const ganhos = leads.filter((l) => l.lead_status === "Ganho");
    const perdidos = leads.filter((l) => l.lead_status === "Perdido");
    const abertos = leads.filter((l) => l.lead_status === "Aberto");

    const ganhosMes = ganhos.filter((l) => (l.criado_em || "").slice(0, 7) === chaveMesAtual);
    const decididos = ganhos.length + perdidos.length;

    return {
      ganhos,
      abertos,
      ganhosMes,
      valorGanhoMes: ganhosMes.reduce((s, l) => s + (Number(l.lead_valor) || 0), 0),
      valorEmAberto: abertos.reduce((s, l) => s + (Number(l.lead_valor) || 0), 0),
      conversao: decididos > 0 ? (ganhos.length / decididos) * 100 : 0,
      ticketMedio:
        ganhos.length > 0
          ? ganhos.reduce((s, l) => s + (Number(l.lead_valor) || 0), 0) / ganhos.length
          : 0,
    };
  }, [leads, chaveMesAtual]);

  const funil = useMemo(() => {
    const mapa = new Map<string, { qtd: number; valor: number }>();
    leads.forEach((l) => {
      const etapa = l.lead_etapa_funil || "Sem etapa";
      const atual = mapa.get(etapa) || { qtd: 0, valor: 0 };
      atual.qtd += 1;
      atual.valor += Number(l.lead_valor) || 0;
      mapa.set(etapa, atual);
    });

    const ordenadas = Array.from(mapa.entries()).sort((a, b) => {
      const ia = ETAPAS.indexOf(a[0]);
      const ib = ETAPAS.indexOf(b[0]);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });

    const maior = Math.max(...ordenadas.map(([, v]) => v.qtd), 1);
    return ordenadas.map(([etapa, v]) => ({ etapa, ...v, pct: (v.qtd / maior) * 100 }));
  }, [leads]);

  /* ── Pendências do dia ── */
  const contasVencidas = useMemo(() => {
    const r = receitas.filter((x) => emAberto(x.status) && x.data_vencimento < hoje).length;
    const d = despesas.filter((x) => emAberto(x.status) && x.data_vencimento < hoje).length;
    return r + d;
  }, [receitas, despesas, hoje]);

  const tarefasPendentes = useMemo(
    () =>
      tarefas.filter(
        (t) =>
          t.status !== "concluida" &&
          t.status !== "concluída" &&
          t.data_vencimento &&
          t.data_vencimento <= hoje,
      ).length,
    [tarefas, hoje],
  );

  const orcamentosSemNegocio = useMemo(
    () => orcamentos.filter((o) => !o.lead_id).length,
    [orcamentos],
  );

  /* Negócio parado: aberto e sem mensagem nem criação nos últimos 7 dias. */
  const negociosParados = useMemo(() => {
    const ultimaAtividade = new Map<string, string>();
    mensagens.forEach((m) => {
      if (!m.lead_id) return;
      const data = (m.criado_em || "").slice(0, 10);
      const atual = ultimaAtividade.get(m.lead_id);
      if (!atual || data > atual) ultimaAtividade.set(m.lead_id, data);
    });

    const limite = addDiasISO(hoje, -7);
    return comercial.abertos.filter((l) => {
      const referencia = ultimaAtividade.get(l.lead_id) || (l.criado_em || "").slice(0, 10);
      return referencia < limite;
    }).length;
  }, [comercial.abertos, mensagens, hoje]);

  /* ── Caixa dos próximos meses ── */
  const projecao = useMemo(() => {
    const agora = new Date();
    const janela = [];
    for (let offset = -2; offset <= 3; offset += 1) {
      const d = new Date(agora.getFullYear(), agora.getMonth() + offset, 1);
      janela.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        label: MESES_ABREV[d.getMonth()],
        entradas: 0,
        saidas: 0,
      });
    }
    const porChave = new Map(janela.map((j) => [j.key, j]));

    receitas.forEach((r) => {
      if (r.status === "cancelado") return;
      const alvo = porChave.get((r.data_vencimento || "").slice(0, 7));
      if (alvo) alvo.entradas += Number(r.valor) || 0;
    });
    despesas.forEach((d) => {
      if (d.status === "cancelado") return;
      const alvo = porChave.get((d.data_vencimento || "").slice(0, 7));
      if (alvo) alvo.saidas += Number(d.valor_parcela) || 0;
    });

    return janela.map((j) => ({
      ...j,
      entradas: Math.round(j.entradas),
      saidas: Math.round(j.saidas),
      saldo: Math.round(j.entradas - j.saidas),
    }));
  }, [receitas, despesas]);

  /* ── Próximos vencimentos (7 dias) ── */
  const proximosVencimentos = useMemo(() => {
    const limite = addDiasISO(hoje, 7);
    const itens: {
      id: string;
      descricao: string;
      valor: number;
      vencimento: string;
      entrada: boolean;
      atrasado: boolean;
    }[] = [];

    receitas.forEach((r) => {
      if (!emAberto(r.status)) return;
      if (r.data_vencimento > limite) return;
      itens.push({
        id: `r-${r.receita_id}`,
        descricao: r.descricao || r.cliente_nome || "Receita",
        valor: Number(r.valor) || 0,
        vencimento: r.data_vencimento,
        entrada: true,
        atrasado: r.data_vencimento < hoje,
      });
    });

    despesas.forEach((d) => {
      if (!emAberto(d.status)) return;
      if (d.data_vencimento > limite) return;
      itens.push({
        id: `d-${d.despesa_id}`,
        descricao: d.descricao || d.fornecedor || "Despesa",
        valor: Number(d.valor_parcela) || 0,
        vencimento: d.data_vencimento,
        entrada: false,
        atrasado: d.data_vencimento < hoje,
      });
    });

    return itens.sort((a, b) => a.vencimento.localeCompare(b.vencimento)).slice(0, 8);
  }, [receitas, despesas, hoje]);

  /* ── Negócios em aberto por valor ── */
  const negociosTop = useMemo(
    () =>
      [...comercial.abertos]
        .sort((a, b) => (Number(b.lead_valor) || 0) - (Number(a.lead_valor) || 0))
        .slice(0, 6),
    [comercial.abertos],
  );

  return (
    <AppShell
      title="Visão Geral"
      subtitle="O essencial do dia: caixa, funil e o que precisa de decisão"
      actions={
        <Link to="/negocios" className="omni-btn omni-btn--primary omni-btn--sm">
          <Plus /> Novo negócio
        </Link>
      }
    >
      <div className="omni-stack-6 w-full *:min-w-0">
        {/* ═════ 1. Os quatro números que importam ═════ */}
        <section className="omni-grid omni-grid-4" aria-label="Indicadores principais">
          <Kpi
            label="Receita recorrente"
            valor={fmtMoeda(mrr)}
            icone={<Repeat className="size-3.5" />}
            rodape={
              <>
                <span className="num">{clientesAtivos}</span>{" "}
                {clientesAtivos === 1 ? "cliente ativo" : "clientes ativos"}
              </>
            }
          />
          <Kpi
            label="Vendas do mês"
            valor={fmtMoeda(comercial.valorGanhoMes)}
            icone={<TrendingUp className="size-3.5" />}
            rodape={
              <>
                <span className="num">{comercial.ganhosMes.length}</span>{" "}
                {comercial.ganhosMes.length === 1 ? "negócio fechado" : "negócios fechados"}
              </>
            }
          />
          <Kpi
            label="A receber no mês"
            valor={fmtMoeda(caixa.aReceberMes)}
            icone={<Wallet className="size-3.5" />}
            rodape={
              <>
                <span className="num">{fmtMoeda(caixa.entrouMes)}</span> já entrou
              </>
            }
          />
          <Kpi
            label="Saldo previsto do mês"
            valor={fmtMoeda(caixa.saldoPrevisto)}
            tom={caixa.saldoPrevisto < 0 ? "negativo" : undefined}
            icone={<CalendarClock className="size-3.5" />}
            rodape={
              <>
                <span className="num">{fmtMoeda(caixa.aPagarMes)}</span> ainda a pagar
              </>
            }
          />
        </section>

        {/* ═════ 2. O que precisa de decisão hoje ═════ */}
        <section aria-label="Pendências">
          <h2 className="omni-h4 mb-3">Precisa de você</h2>
          <div className="omni-grid omni-grid-4">
            <Pendencia
              titulo="contas vencidas"
              quantidade={contasVencidas}
              detalhe="em aberto depois do vencimento"
              para="/financeiro"
              icone={<AlertCircle className="size-4" />}
              alerta
            />
            <Pendencia
              titulo="tarefas atrasadas"
              quantidade={tarefasPendentes}
              detalhe="vencem hoje ou já venceram"
              para="/tarefas"
              icone={<CheckSquare className="size-4" />}
              alerta
            />
            <Pendencia
              titulo="negócios parados"
              quantidade={negociosParados}
              detalhe="sem contato há mais de 7 dias"
              para="/negocios"
              icone={<Handshake className="size-4" />}
            />
            <Pendencia
              titulo="orçamentos soltos"
              quantidade={orcamentosSemNegocio}
              detalhe="sem negócio vinculado"
              para="/orcamentos"
              icone={<Calculator className="size-4" />}
            />
          </div>
        </section>

        {/* ═════ 3. Funil + projeção de caixa ═════ */}
        <div className="grid gap-4 lg:grid-cols-2 *:min-w-0">
          <section className="omni-card">
            <div className="omni-card__header">
              <div>
                <h2 className="omni-h4">Funil comercial</h2>
                <p className="omni-small mt-0.5">
                  {leads.length} {leads.length === 1 ? "negócio" : "negócios"} ·{" "}
                  {comercial.conversao.toFixed(0)}% de conversão
                </p>
              </div>
              <Link to="/negocios" className="omni-btn omni-btn--quiet omni-btn--sm">
                Abrir funil
              </Link>
            </div>

            <div className="omni-card__body">
              {carregandoLeads ? (
                <div className="omni-stack-2">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="omni-skeleton h-8 w-full" />
                  ))}
                </div>
              ) : funil.length === 0 ? (
                <p className="omni-small">Nenhum negócio cadastrado ainda.</p>
              ) : (
                <ul className="omni-stack-2">
                  {funil.map((etapa) => (
                    <li key={etapa.etapa}>
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="truncate text-sm font-medium text-ink">{etapa.etapa}</span>
                        <span className="num shrink-0 text-sm text-ink-2">
                          {etapa.qtd}
                          {etapa.valor > 0 && (
                            <span className="omni-muted"> · {fmtMoedaCurta(etapa.valor)}</span>
                          )}
                        </span>
                      </div>
                      <div className="omni-progress mt-1.5">
                        <div
                          className="omni-progress__bar"
                          style={{ width: `${Math.max(etapa.pct, 3)}%` }}
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
                  <p className="omni-small">Ticket médio ganho</p>
                  <p className="num text-md font-bold text-ink">
                    {fmtMoeda(comercial.ticketMedio)}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="omni-card">
            <div className="omni-card__header">
              <div>
                <h2 className="omni-h4">Caixa dos próximos meses</h2>
                <p className="omni-small mt-0.5">Entradas e saídas por data de vencimento</p>
              </div>
              <Link to="/financeiro" className="omni-btn omni-btn--quiet omni-btn--sm">
                Ver financeiro
              </Link>
            </div>

            <div className="omni-card__body">
              <div className="omni-scroll-x scrollbar-slim">
                <div className="h-56 min-w-[420px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={projecao}
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
                        width={70}
                        tick={{ fill: "var(--omni-text-3)", fontSize: 10 }}
                        tickFormatter={(v) => fmtMoedaCurta(Number(v))}
                      />
                      <Tooltip
                        cursor={{ fill: "var(--omni-surface-2)" }}
                        contentStyle={TOOLTIP_STYLE}
                        labelStyle={{ color: "var(--omni-text)", fontWeight: 700 }}
                        formatter={(val: number | string, name: string) => [
                          fmtMoeda(Number(val)),
                          name,
                        ]}
                      />
                      <Bar
                        dataKey="entradas"
                        name="Entradas"
                        fill="var(--omni-chart-1)"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="saidas"
                        name="Saídas"
                        fill="var(--omni-chart-2)"
                        radius={[4, 4, 0, 0]}
                      />
                      <Line
                        type="monotone"
                        dataKey="saldo"
                        name="Saldo"
                        stroke="var(--omni-text-2)"
                        strokeWidth={2}
                        dot={{ r: 2.5, fill: "var(--omni-text-2)" }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* ═════ 4. Vencimentos + negócios em aberto ═════ */}
        <div className="grid gap-4 lg:grid-cols-2 *:min-w-0">
          <section className="omni-card">
            <div className="omni-card__header">
              <div>
                <h2 className="omni-h4">Vence nos próximos 7 dias</h2>
                <p className="omni-small mt-0.5">Incluindo o que já passou do vencimento</p>
              </div>
            </div>

            {proximosVencimentos.length === 0 ? (
              <div className="omni-empty">
                <span className="omni-empty__art">
                  <CalendarClock />
                </span>
                <h4>Nada vencendo por agora</h4>
                <p>Nenhuma conta em aberto com vencimento nos próximos sete dias.</p>
              </div>
            ) : (
              <ul>
                {proximosVencimentos.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center gap-3 border-b border-line-subtle px-5 py-2.5 last:border-b-0"
                  >
                    <span
                      className={cn(
                        "num w-12 shrink-0 text-xs font-semibold",
                        item.atrasado ? "text-danger" : "text-ink-3",
                      )}
                    >
                      {fmtDiaMes(item.vencimento)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-ink">
                      {item.descricao}
                    </span>
                    {item.atrasado && (
                      <span className="omni-badge omni-badge--danger shrink-0">vencida</span>
                    )}
                    <span
                      className={cn(
                        "num shrink-0 text-sm font-semibold",
                        item.entrada ? "text-success" : "text-ink",
                      )}
                    >
                      {item.entrada ? "+" : "−"}
                      {fmtMoeda(item.valor)}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <div className="omni-table__foot">
              <Link to="/financeiro" className="omni-link">
                Ver todos os lançamentos
              </Link>
            </div>
          </section>

          <section className="omni-card">
            <div className="omni-card__header">
              <div>
                <h2 className="omni-h4">Maiores negócios em aberto</h2>
                <p className="omni-small mt-0.5">Oportunidades ainda em negociação</p>
              </div>
            </div>

            {negociosTop.length === 0 ? (
              <div className="omni-empty">
                <span className="omni-empty__art">
                  <Handshake />
                </span>
                <h4>Nenhum negócio em aberto</h4>
                <p>Cadastre uma oportunidade para acompanhar o funil por aqui.</p>
              </div>
            ) : (
              <ul>
                {negociosTop.map((lead) => (
                  <li key={lead.lead_id} className="border-b border-line-subtle last:border-b-0">
                    <Link
                      to="/lead/$leadId"
                      params={{ leadId: lead.lead_id }}
                      className="flex items-center gap-3 px-5 py-2.5 transition-colors hover:bg-surface-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink">
                          {lead.lead_nome || "Sem nome"}
                        </p>
                        <p className="omni-small truncate">
                          {lead.lead_etapa_funil || "Sem etapa"} · aberto há{" "}
                          {diasEntre((lead.criado_em || "").slice(0, 10), hoje)}d
                        </p>
                      </div>
                      <span className="num shrink-0 text-sm font-semibold text-ink">
                        {fmtMoeda(Number(lead.lead_valor) || 0)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            <div className="omni-table__foot">
              <Link to="/negocios" className="omni-link">
                Abrir o funil completo
              </Link>
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
