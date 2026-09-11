import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Info,
  Layers,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  Cell,
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

export const Route = createFileRoute("/financeiro")({
  head: () => ({
    meta: [
      { title: "Financeiro · Omni Automações" },
      {
        name: "description",
        content: "Fluxo de caixa mensal, contas a pagar e a receber da Omni Automações.",
      },
    ],
  }),
  component: Financeiro,
});

/* ─── Tipos ─── */
export type TipoReceita = "pontual" | "recorrente";
export type StatusReceita = "pendente" | "recebido" | "atrasado" | "cancelado";
export type TipoDespesa = "pontual" | "recorrente" | "parcelada";
export type StatusDespesa = "pendente" | "pago" | "atrasado" | "cancelado";

export interface Receita {
  receita_id: string;
  descricao: string;
  tipo: TipoReceita;
  categoria: string;
  valor: number;
  status: StatusReceita;
  data_competencia: string;
  data_vencimento: string;
  data_recebimento?: string | null;
  cliente_nome?: string | null;
  lead_id?: string | null;
  recorrente_grupo_id?: string | null;
  observacoes?: string | null;
  criado_em: string;
}

export interface Despesa {
  despesa_id: string;
  descricao: string;
  tipo: TipoDespesa;
  categoria: string;
  valor_parcela: number;
  valor_total: number;
  status: StatusDespesa;
  data_competencia: string;
  data_vencimento: string;
  data_pagamento?: string | null;
  parcela_atual?: number | null;
  total_parcelas?: number | null;
  recorrente_grupo_id?: string | null;
  fornecedor?: string | null;
  observacoes?: string | null;
  criado_em: string;
}

interface FinanceiroItem {
  id: string;
  tipo_lancamento: "receita" | "despesa";
  descricao: string;
  categoria: string;
  valor: number;
  status: string;
  data_vencimento: string;
  data_competencia: string;
  data_liquidacao?: string | null;
  tipo_sub: string;
  cliente_ou_fornecedor?: string | null;
  extra?: string | null;
  recorrente_grupo_id?: string | null;
  observacoes?: string | null;
  raw: Receita | Despesa;
}

/*
 * Situação exibida na tela. O banco só grava "pendente" — nada nunca vira
 * "atrasado" sozinho —, então o atraso é calculado aqui comparando o
 * vencimento com a data de hoje. Sem isso, conta vencida fica invisível.
 */
type Situacao = "liquidado" | "aberto" | "atrasado" | "cancelado";

/* ─── Constantes ─── */
const MESES_NOME = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

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

const CATEGORIAS_RECEITA = [
  "Sites e Landing Pages",
  "SaaS / Recorrência",
  "Consultoria e IA",
  "Automação N8N",
  "Outros",
];

const CATEGORIAS_DESPESA = [
  "Infraestrutura e Cloud",
  "Marketing e Tráfego",
  "Ferramentas e SaaS",
  "Salários / Pró-labore",
  "Impostos e Taxas",
  "Escritório e Estrutura",
  "Outros",
];

/* ─── Helpers ─── */
const fmtCurrency = (val: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(val) || 0);

/* Eixo do gráfico: "R$ 2,5 mil" lê melhor que "R$ 2.500,00" repetido 12 vezes. */
const fmtCompact = (val: number) => {
  const n = Number(val) || 0;
  if (Math.abs(n) >= 1000) {
    return `R$ ${(n / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  }
  return `R$ ${n.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
};

const fmtDate = (d?: string | null) => {
  if (!d) return "—";
  const parts = d.split("-");
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : d;
};

const fmtDiaMes = (d?: string | null) => {
  if (!d) return "—";
  const parts = d.split("-");
  return parts.length === 3 ? `${parts[2]}/${parts[1]}` : d;
};

/*
 * Data local, não UTC: `toISOString()` vira o dia seguinte depois das 21h no
 * fuso do Brasil, o que faria uma conta de hoje aparecer como atrasada.
 */
const isoDe = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const todayISO = () => isoDe(new Date());

const firstOfMonthISO = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-01`;
};

const addDaysISO = (dateStr: string, days: number) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  return isoDe(new Date(y, m - 1, d + days));
};

function addMonthsToDate(dateStr: string, monthsToAdd: number): string {
  try {
    const parts = dateStr.split("-").map(Number);
    if (parts.length === 3) {
      const target = new Date(parts[0], parts[1] - 1 + monthsToAdd, parts[2] || 1);
      return isoDe(target);
    }
  } catch {
    // fallback
  }
  return dateStr;
}

const chaveMes = (ano: number, mes: number) => `${ano}-${String(mes + 1).padStart(2, "0")}`;

function situacaoDe(item: FinanceiroItem, hoje: string): Situacao {
  if (item.status === "cancelado") return "cancelado";
  if (item.status === "recebido" || item.status === "pago") return "liquidado";
  return item.data_vencimento && item.data_vencimento < hoje ? "atrasado" : "aberto";
}

function rotuloSituacao(item: FinanceiroItem, situacao: Situacao) {
  if (situacao === "liquidado") return item.tipo_lancamento === "receita" ? "Recebido" : "Pago";
  if (situacao === "atrasado") return "Atrasado";
  if (situacao === "cancelado") return "Cancelado";
  return "Em aberto";
}

const BADGE_SITUACAO: Record<Situacao, string> = {
  liquidado: "omni-badge--success",
  aberto: "omni-badge--warning",
  atrasado: "omni-badge--danger",
  cancelado: "omni-badge--outline",
};

function IconeSituacao({ situacao }: { situacao: Situacao }) {
  if (situacao === "liquidado") return <CheckCircle2 />;
  if (situacao === "atrasado") return <AlertCircle />;
  if (situacao === "cancelado") return <X />;
  return <Clock />;
}

function ocorrenciaLabel(item: FinanceiroItem) {
  if (item.tipo_sub === "recorrente") return "Mensal";
  if (item.tipo_sub === "parcelada") return `Parcela ${item.extra ?? ""}`.trim();
  return "Único";
}

const TOOLTIP_STYLE = {
  background: "var(--omni-surface)",
  border: "1px solid var(--omni-border)",
  borderRadius: "var(--omni-radius-md)",
  boxShadow: "var(--omni-shadow-md)",
  fontSize: "var(--omni-text-xs)",
  color: "var(--omni-text)",
} as const;

/* ─── Modal Form Component ─── */
interface ModalFormProps {
  open: boolean;
  onClose: () => void;
  editingItem?: FinanceiroItem | null;
  onSaved: () => void;
}

function ModalForm({ open, onClose, editingItem, onSaved }: ModalFormProps) {
  const [tipoLancamento, setTipoLancamento] = useState<"receita" | "despesa">("receita");
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState(CATEGORIAS_RECEITA[0]);
  const [valor, setValor] = useState("0,00");
  const [status, setStatus] = useState("pendente");
  const [dataCompetencia, setDataCompetencia] = useState(firstOfMonthISO());
  const [dataVencimento, setDataVencimento] = useState(todayISO());
  const [dataLiquidacao, setDataLiquidacao] = useState(todayISO());
  const [tipoSub, setTipoSub] = useState<string>("pontual");
  const [clienteOuFornecedor, setClienteOuFornecedor] = useState("");
  const [parcelaAtual, setParcelaAtual] = useState(1);
  const [totalParcelas, setTotalParcelas] = useState(1);
  const [mesesProjecao, setMesesProjecao] = useState<number>(12);
  const [observacoes, setObservacoes] = useState("");
  const [saving, setSaving] = useState(false);
  const [descricaoInvalida, setDescricaoInvalida] = useState(false);
  const [valorInvalido, setValorInvalido] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDescricaoInvalida(false);
    setValorInvalido(false);
    if (editingItem) {
      setTipoLancamento(editingItem.tipo_lancamento);
      setDescricao(editingItem.descricao || "");
      setCategoria(editingItem.categoria || CATEGORIAS_RECEITA[0]);
      setValor(
        Number(editingItem.valor || 0)
          .toFixed(2)
          .replace(".", ","),
      );
      setStatus(editingItem.status || "pendente");
      setTipoSub(editingItem.tipo_sub || "pontual");
      setClienteOuFornecedor(editingItem.cliente_ou_fornecedor ?? "");
      setObservacoes(editingItem.observacoes ?? "");
      if (editingItem.tipo_lancamento === "receita") {
        const r = editingItem.raw as Receita;
        setDataCompetencia(r?.data_competencia || firstOfMonthISO());
        setDataVencimento(r?.data_vencimento || todayISO());
        setDataLiquidacao(r?.data_recebimento || todayISO());
      } else {
        const d = editingItem.raw as Despesa;
        setDataCompetencia(d?.data_competencia || firstOfMonthISO());
        setDataVencimento(d?.data_vencimento || todayISO());
        setDataLiquidacao(d?.data_pagamento || todayISO());
        setParcelaAtual(d?.parcela_atual ?? 1);
        setTotalParcelas(d?.total_parcelas ?? 1);
      }
    } else {
      setTipoLancamento("receita");
      setDescricao("");
      setCategoria(CATEGORIAS_RECEITA[0]);
      setValor("0,00");
      setStatus("pendente");
      setDataCompetencia(firstOfMonthISO());
      setDataVencimento(todayISO());
      setDataLiquidacao(todayISO());
      setTipoSub("pontual");
      setClienteOuFornecedor("");
      setParcelaAtual(1);
      setTotalParcelas(1);
      setMesesProjecao(12);
      setObservacoes("");
    }
  }, [open, editingItem]);

  useEffect(() => {
    if (tipoLancamento === "receita") {
      setCategoria(CATEGORIAS_RECEITA[0]);
      if (status === "pago") setStatus("recebido");
    } else {
      setCategoria(CATEGORIAS_DESPESA[0]);
      if (status === "recebido") setStatus("pago");
    }
    if (tipoLancamento === "receita" && tipoSub === "parcelada") setTipoSub("pontual");
  }, [tipoLancamento]);

  const numValor = () => parseFloat(valor.replace(/\./g, "").replace(",", ".")) || 0;

  const handleSave = async () => {
    if (!descricao.trim()) {
      setDescricaoInvalida(true);
      toast.error("Informe a descrição!");
      return;
    }
    if (numValor() <= 0) {
      setValorInvalido(true);
      toast.error("Informe um valor válido!");
      return;
    }
    setDescricaoInvalida(false);
    setValorInvalido(false);
    setSaving(true);
    try {
      if (tipoLancamento === "receita") {
        if (editingItem) {
          const payload: Partial<Receita> = {
            descricao: descricao.trim(),
            tipo: tipoSub as TipoReceita,
            categoria,
            valor: numValor(),
            status: status as StatusReceita,
            data_competencia: dataCompetencia,
            data_vencimento: dataVencimento,
            data_recebimento: status === "recebido" ? dataLiquidacao : null,
            cliente_nome: clienteOuFornecedor || null,
            observacoes: observacoes || null,
          };
          const { error } = await supabase
            .from("receitas")
            .update(payload)
            .eq("receita_id", editingItem.id);
          if (error) throw error;
          toast.success("Receita atualizada com sucesso!");
        } else if (tipoSub === "recorrente") {
          const grupoId = crypto.randomUUID();
          const rowsToInsert: any[] = [];
          for (let i = 0; i < mesesProjecao; i++) {
            const isFirst = i === 0;
            rowsToInsert.push({
              descricao: descricao.trim(),
              tipo: "recorrente",
              categoria,
              valor: numValor(),
              status: isFirst ? status : "pendente",
              data_competencia: addMonthsToDate(dataCompetencia, i),
              data_vencimento: addMonthsToDate(dataVencimento, i),
              data_recebimento: isFirst && status === "recebido" ? dataLiquidacao : null,
              cliente_nome: clienteOuFornecedor || null,
              recorrente_grupo_id: grupoId,
              observacoes: observacoes
                ? `${observacoes}${i > 0 ? ` (Mês ${i + 1}/${mesesProjecao})` : ""}`
                : i > 0
                  ? `Projeção automática recorrência (${i + 1}/${mesesProjecao})`
                  : null,
            });
          }
          const { error } = await supabase.from("receitas").insert(rowsToInsert);
          if (error) throw error;
          toast.success(
            `Receita recorrente criada e projetada para os próximos ${mesesProjecao} meses!`,
          );
        } else {
          const payload: Partial<Receita> = {
            descricao: descricao.trim(),
            tipo: "pontual",
            categoria,
            valor: numValor(),
            status: status as StatusReceita,
            data_competencia: dataCompetencia,
            data_vencimento: dataVencimento,
            data_recebimento: status === "recebido" ? dataLiquidacao : null,
            cliente_nome: clienteOuFornecedor || null,
            observacoes: observacoes || null,
          };
          const { error } = await supabase.from("receitas").insert([payload]);
          if (error) throw error;
          toast.success("Receita criada com sucesso!");
        }
      } else {
        const v = numValor();
        if (editingItem) {
          const payload: Partial<Despesa> = {
            descricao: descricao.trim(),
            tipo: tipoSub as TipoDespesa,
            categoria,
            valor_parcela: v,
            valor_total: tipoSub === "parcelada" ? v * totalParcelas : v,
            status: status as StatusDespesa,
            data_competencia: dataCompetencia,
            data_vencimento: dataVencimento,
            data_pagamento: status === "pago" ? dataLiquidacao : null,
            parcela_atual: tipoSub === "parcelada" ? parcelaAtual : null,
            total_parcelas: tipoSub === "parcelada" ? totalParcelas : null,
            fornecedor: clienteOuFornecedor || null,
            observacoes: observacoes || null,
          };
          const { error } = await supabase
            .from("despesas")
            .update(payload)
            .eq("despesa_id", editingItem.id);
          if (error) throw error;
          toast.success("Despesa atualizada com sucesso!");
        } else if (tipoSub === "recorrente") {
          const grupoId = crypto.randomUUID();
          const rowsToInsert: any[] = [];
          for (let i = 0; i < mesesProjecao; i++) {
            const isFirst = i === 0;
            rowsToInsert.push({
              descricao: descricao.trim(),
              tipo: "recorrente",
              categoria,
              valor_parcela: v,
              valor_total: v,
              status: isFirst ? status : "pendente",
              data_competencia: addMonthsToDate(dataCompetencia, i),
              data_vencimento: addMonthsToDate(dataVencimento, i),
              data_pagamento: isFirst && status === "pago" ? dataLiquidacao : null,
              fornecedor: clienteOuFornecedor || null,
              recorrente_grupo_id: grupoId,
              observacoes: observacoes
                ? `${observacoes}${i > 0 ? ` (Mês ${i + 1}/${mesesProjecao})` : ""}`
                : i > 0
                  ? `Projeção automática recorrência (${i + 1}/${mesesProjecao})`
                  : null,
            });
          }
          const { error } = await supabase.from("despesas").insert(rowsToInsert);
          if (error) throw error;
          toast.success(
            `Despesa recorrente criada e projetada para os próximos ${mesesProjecao} meses!`,
          );
        } else if (tipoSub === "parcelada") {
          const grupoId = crypto.randomUUID();
          const rowsToInsert: any[] = [];
          const vTotal = v * totalParcelas;
          for (let i = 0; i < totalParcelas; i++) {
            const isFirst = i === 0;
            rowsToInsert.push({
              descricao: descricao.trim(),
              tipo: "parcelada",
              categoria,
              valor_parcela: v,
              valor_total: vTotal,
              parcela_atual: i + 1,
              total_parcelas: totalParcelas,
              status: isFirst ? status : "pendente",
              data_competencia: addMonthsToDate(dataCompetencia, i),
              data_vencimento: addMonthsToDate(dataVencimento, i),
              data_pagamento: isFirst && status === "pago" ? dataLiquidacao : null,
              fornecedor: clienteOuFornecedor || null,
              recorrente_grupo_id: grupoId,
              observacoes: observacoes
                ? `${observacoes} (Parcela ${i + 1}/${totalParcelas})`
                : `Parcela ${i + 1}/${totalParcelas}`,
            });
          }
          const { error } = await supabase.from("despesas").insert(rowsToInsert);
          if (error) throw error;
          toast.success(`Compra parcelada em ${totalParcelas}x criada com sucesso!`);
        } else {
          const payload: Partial<Despesa> = {
            descricao: descricao.trim(),
            tipo: "pontual",
            categoria,
            valor_parcela: v,
            valor_total: v,
            status: status as StatusDespesa,
            data_competencia: dataCompetencia,
            data_vencimento: dataVencimento,
            data_pagamento: status === "pago" ? dataLiquidacao : null,
            fornecedor: clienteOuFornecedor || null,
            observacoes: observacoes || null,
          };
          const { error } = await supabase.from("despesas").insert([payload]);
          if (error) throw error;
          toast.success("Despesa criada com sucesso!");
        }
      }

      onSaved();
      onClose();
    } catch (e: any) {
      toast.error("Erro ao salvar: " + (e?.message || String(e)));
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const categorias = tipoLancamento === "receita" ? CATEGORIAS_RECEITA : CATEGORIAS_DESPESA;
  const isLiquidado = tipoLancamento === "receita" ? status === "recebido" : status === "pago";

  return (
    <div
      className="omni-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-modal-lancamento"
    >
      <div className="omni-modal w-full max-w-[620px]">
        <div className="omni-modal__header">
          <div>
            <h2 id="titulo-modal-lancamento" className="omni-h4">
              {editingItem ? "Editar lançamento" : "Novo lançamento"}
            </h2>
            <p className="omni-small mt-1">
              {tipoLancamento === "receita" ? "Entrada financeira" : "Saída financeira"}
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

        <div className="omni-modal__body omni-stack max-h-[70vh] overflow-y-auto scrollbar-slim">
          {/* Tipo de lançamento */}
          <div className="omni-field">
            <span className="omni-label">Tipo de lançamento</span>
            <div className="omni-btn-group" role="group" aria-label="Tipo de lançamento">
              {(["receita", "despesa"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={tipoLancamento === t}
                  onClick={() => setTipoLancamento(t)}
                  className="omni-btn omni-btn--secondary"
                >
                  {t === "receita" ? <ArrowDownLeft /> : <ArrowUpRight />}
                  {t === "receita" ? "Receita (entrada)" : "Despesa (saída)"}
                </button>
              ))}
            </div>
          </div>

          {/* Sub-tipo */}
          <div className="omni-field">
            <span className="omni-label">Tipo de ocorrência</span>
            <div className="omni-btn-group" role="group" aria-label="Tipo de ocorrência">
              {(tipoLancamento === "receita"
                ? ["pontual", "recorrente"]
                : ["pontual", "recorrente", "parcelada"]
              ).map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={tipoSub === t}
                  onClick={() => setTipoSub(t)}
                  className="omni-btn omni-btn--secondary"
                >
                  {t === "parcelada" ? "Parcelada" : t === "recorrente" ? "Recorrente" : "Pontual"}
                </button>
              ))}
            </div>
          </div>

          {/* Projeção da recorrência */}
          {tipoSub === "recorrente" && !editingItem && (
            <div className="omni-alert omni-alert--info">
              <Info className="omni-alert__icon" />
              <div className="omni-alert__body">
                <p className="omni-alert__title">Projeção automática da recorrência</p>
                <p className="omni-alert__text">
                  O primeiro mês fica com a situação escolhida abaixo. Os meses seguintes são
                  criados como <strong>pendentes</strong>.
                </p>
                <div className="omni-field mt-2">
                  <label className="omni-label" htmlFor="meses-projecao">
                    Projetar para
                  </label>
                  <select
                    id="meses-projecao"
                    value={mesesProjecao}
                    onChange={(e) => setMesesProjecao(Number(e.target.value))}
                    className="omni-select"
                  >
                    <option value={6}>Próximos 6 meses</option>
                    <option value={12}>Próximos 12 meses</option>
                    <option value={24}>Próximos 24 meses</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Parcelas */}
          {tipoSub === "parcelada" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="omni-field">
                <label className="omni-label" htmlFor="parcela-atual">
                  Parcela atual
                </label>
                <input
                  id="parcela-atual"
                  type="number"
                  min={1}
                  value={parcelaAtual}
                  onChange={(e) => setParcelaAtual(Number(e.target.value) || 1)}
                  className="omni-input num"
                />
              </div>
              <div className="omni-field">
                <label className="omni-label" htmlFor="total-parcelas">
                  Total de parcelas
                </label>
                <input
                  id="total-parcelas"
                  type="number"
                  min={1}
                  value={totalParcelas}
                  onChange={(e) => setTotalParcelas(Number(e.target.value) || 1)}
                  className="omni-input num"
                />
              </div>
            </div>
          )}

          {/* Descrição */}
          <div className="omni-field">
            <label className="omni-label" htmlFor="lanc-descricao">
              Descrição <span className="omni-req">*</span>
            </label>
            <input
              id="lanc-descricao"
              value={descricao}
              onChange={(e) => {
                setDescricao(e.target.value);
                if (e.target.value.trim()) setDescricaoInvalida(false);
              }}
              aria-invalid={descricaoInvalida || undefined}
              placeholder={
                tipoLancamento === "receita"
                  ? "Ex.: Mensalidade Painel Omni — Cliente Rex"
                  : "Ex.: Pagamento Murilo — pró-labore"
              }
              className="omni-input"
            />
            {descricaoInvalida && (
              <p className="omni-error">
                Escreva uma descrição — é por ela que o lançamento é encontrado na busca.
              </p>
            )}
          </div>

          {/* Categoria + Valor */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="omni-field">
              <label className="omni-label" htmlFor="lanc-categoria">
                Categoria <span className="omni-req">*</span>
              </label>
              <select
                id="lanc-categoria"
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                className="omni-select"
              >
                {categorias.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="omni-field">
              <label className="omni-label" htmlFor="lanc-valor">
                {tipoSub === "parcelada"
                  ? "Valor por parcela (R$)"
                  : tipoSub === "recorrente"
                    ? "Valor mensal (R$)"
                    : "Valor (R$)"}{" "}
                <span className="omni-req">*</span>
              </label>
              <input
                id="lanc-valor"
                value={valor}
                onChange={(e) => {
                  setValor(e.target.value);
                  setValorInvalido(false);
                }}
                aria-invalid={valorInvalido || undefined}
                placeholder="0,00"
                className="omni-input num"
              />
              {valorInvalido && (
                <p className="omni-error">Digite um valor maior que zero, no formato 1.250,00.</p>
              )}
            </div>
          </div>

          {/* Cliente / Fornecedor */}
          <div className="omni-field">
            <label className="omni-label" htmlFor="lanc-contraparte">
              {tipoLancamento === "receita" ? "Cliente" : "Fornecedor ou colaborador"}
            </label>
            <input
              id="lanc-contraparte"
              value={clienteOuFornecedor}
              onChange={(e) => setClienteOuFornecedor(e.target.value)}
              placeholder={
                tipoLancamento === "receita" ? "Ex.: Auto Center Rex" : "Ex.: Meta Platforms"
              }
              className="omni-input"
            />
          </div>

          {/* Status */}
          <div className="omni-field">
            <label className="omni-label" htmlFor="lanc-status">
              Situação do primeiro mês
            </label>
            <select
              id="lanc-status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="omni-select"
            >
              {(tipoLancamento === "receita"
                ? [
                    ["pendente", "Pendente"],
                    ["recebido", "Recebido"],
                    ["atrasado", "Atrasado"],
                    ["cancelado", "Cancelado"],
                  ]
                : [
                    ["pendente", "Pendente"],
                    ["pago", "Pago"],
                    ["atrasado", "Atrasado"],
                    ["cancelado", "Cancelado"],
                  ]
              ).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>

          {/* Datas */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="omni-field">
              <label className="omni-label" htmlFor="lanc-competencia">
                Competência inicial
              </label>
              <input
                id="lanc-competencia"
                type="date"
                value={dataCompetencia}
                onChange={(e) => setDataCompetencia(e.target.value)}
                className="omni-input num"
              />
            </div>
            <div className="omni-field">
              <label className="omni-label" htmlFor="lanc-vencimento">
                Vencimento inicial <span className="omni-req">*</span>
              </label>
              <input
                id="lanc-vencimento"
                type="date"
                value={dataVencimento}
                onChange={(e) => setDataVencimento(e.target.value)}
                className="omni-input num"
              />
            </div>
          </div>

          {isLiquidado && (
            <div className="omni-field">
              <label className="omni-label" htmlFor="lanc-liquidacao">
                Data de {tipoLancamento === "receita" ? "recebimento" : "pagamento"}
              </label>
              <input
                id="lanc-liquidacao"
                type="date"
                value={dataLiquidacao}
                onChange={(e) => setDataLiquidacao(e.target.value)}
                className="omni-input num"
              />
            </div>
          )}

          {/* Observações */}
          <div className="omni-field">
            <label className="omni-label" htmlFor="lanc-observacoes">
              Observações
            </label>
            <textarea
              id="lanc-observacoes"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={2}
              placeholder="Notas internas sobre este lançamento"
              className="omni-textarea"
            />
          </div>
        </div>

        <div className="omni-modal__footer">
          <button type="button" onClick={onClose} className="omni-btn omni-btn--ghost">
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            data-loading={saving ? "true" : undefined}
            className="omni-btn omni-btn--primary"
          >
            {editingItem ? "Salvar alterações" : "Criar lançamento"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Blocos da página ─── */

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
  tom?: "positivo" | "negativo";
}) {
  return (
    <div className="omni-card">
      <div className="omni-stat">
        <span className="omni-stat__label flex items-center gap-1.5">
          {icone} {label}
        </span>
        <p
          className={cn(
            "omni-stat__value num",
            tom === "positivo" && "text-success",
            tom === "negativo" && "text-danger",
          )}
        >
          {valor}
        </p>
        <p className="omni-stat__foot">{rodape}</p>
      </div>
    </div>
  );
}

/* Linha compacta dos painéis de atraso e de próximos vencimentos. */
function LinhaPendencia({
  item,
  hoje,
  onLiquidar,
}: {
  item: FinanceiroItem;
  hoje: string;
  onLiquidar: (item: FinanceiroItem) => void;
}) {
  const isReceita = item.tipo_lancamento === "receita";
  const dias = Math.round(
    (new Date(`${item.data_vencimento}T12:00:00`).getTime() -
      new Date(`${hoje}T12:00:00`).getTime()) /
      86400000,
  );
  const quando = dias === 0 ? "vence hoje" : dias > 0 ? `em ${dias}d` : `há ${Math.abs(dias)}d`;

  return (
    <li className="flex items-center gap-3 border-b border-line-subtle px-4 py-2.5 last:border-b-0">
      <span
        className={cn(
          "grid size-7 shrink-0 place-items-center rounded-sm",
          isReceita ? "bg-success-soft text-success" : "bg-danger-soft text-danger",
        )}
        aria-hidden="true"
      >
        {isReceita ? <ArrowDownLeft className="size-3.5" /> : <ArrowUpRight className="size-3.5" />}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{item.descricao}</p>
        <p className="omni-small truncate">
          {fmtDiaMes(item.data_vencimento)} · {quando}
          {item.cliente_ou_fornecedor ? ` · ${item.cliente_ou_fornecedor}` : ""}
        </p>
      </div>

      <span
        className={cn(
          "num shrink-0 text-sm font-semibold",
          isReceita ? "text-success" : "text-ink",
        )}
      >
        {fmtCurrency(item.valor)}
      </span>

      <button
        type="button"
        onClick={() => onLiquidar(item)}
        title={isReceita ? "Marcar como recebido" : "Marcar como pago"}
        className="omni-btn omni-btn--ghost omni-btn--icon omni-btn--sm shrink-0 text-success hover:bg-success-soft"
      >
        <CheckCircle2 />
        <span className="omni-sr">{isReceita ? "Marcar como recebido" : "Marcar como pago"}</span>
      </button>
    </li>
  );
}

/* Cartão de lançamento — substitui a tabela abaixo de md. */
function CardLancamento({
  item,
  hoje,
  onLiquidar,
  onEditar,
  onExcluir,
}: {
  item: FinanceiroItem;
  hoje: string;
  onLiquidar: (item: FinanceiroItem) => void;
  onEditar: (item: FinanceiroItem) => void;
  onExcluir: (item: FinanceiroItem) => void;
}) {
  const isReceita = item.tipo_lancamento === "receita";
  const situacao = situacaoDe(item, hoje);

  return (
    <li className="omni-card p-4">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-sm",
            isReceita ? "bg-success-soft text-success" : "bg-danger-soft text-danger",
          )}
          aria-hidden="true"
        >
          {isReceita ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">{item.descricao}</p>
          <p className="omni-small truncate">
            {item.categoria}
            {item.cliente_ou_fornecedor ? ` · ${item.cliente_ou_fornecedor}` : ""}
          </p>
        </div>

        <span
          className={cn(
            "num shrink-0 text-sm font-bold",
            isReceita ? "text-success" : "text-danger",
          )}
        >
          {isReceita ? "+" : "−"}
          {fmtCurrency(item.valor)}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className={cn("omni-badge", BADGE_SITUACAO[situacao])}>
          <IconeSituacao situacao={situacao} /> {rotuloSituacao(item, situacao)}
        </span>
        <span className="omni-badge omni-badge--outline">
          {item.tipo_sub === "recorrente" && <RefreshCw />}
          {item.tipo_sub === "parcelada" && <Layers />}
          {ocorrenciaLabel(item)}
        </span>
        <span className="omni-small ml-auto">venc. {fmtDate(item.data_vencimento)}</span>
      </div>

      <div className="mt-3 flex items-center gap-2 border-t border-line-subtle pt-3">
        {situacao !== "liquidado" && situacao !== "cancelado" && (
          <button
            type="button"
            onClick={() => onLiquidar(item)}
            className="omni-btn omni-btn--secondary omni-btn--sm flex-1"
          >
            <CheckCircle2 /> {isReceita ? "Recebi" : "Paguei"}
          </button>
        )}
        <button
          type="button"
          onClick={() => onEditar(item)}
          className="omni-btn omni-btn--ghost omni-btn--icon omni-btn--sm"
          title={`Editar ${item.descricao}`}
        >
          <Pencil />
          <span className="omni-sr">Editar {item.descricao}</span>
        </button>
        <button
          type="button"
          onClick={() => onExcluir(item)}
          className="omni-btn omni-btn--ghost omni-btn--icon omni-btn--sm text-danger hover:bg-danger-soft"
          title={`Excluir ${item.descricao}`}
        >
          <Trash2 />
          <span className="omni-sr">Excluir {item.descricao}</span>
        </button>
      </div>
    </li>
  );
}

/* ─── Página ─── */
function Financeiro() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const hoje = todayISO();
  const agora = useMemo(() => new Date(), []);

  /*
   * Um único estado de período: o mês visível. Sem seletor de ano, sem régua de
   * meses e sem escolha de base de data — a tela inteira é por data de
   * vencimento, que é o que a empresa usa no dia a dia.
   */
  const [ref, setRef] = useState({ ano: agora.getFullYear(), mes: agora.getMonth() });
  const [busca, setBusca] = useState("");
  const [lado, setLado] = useState<"tudo" | "receita" | "despesa">("tudo");
  const [soAberto, setSoAberto] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<FinanceiroItem | null>(null);

  const { data: receitas = [], isLoading: loadingR } = useQuery({
    queryKey: ["receitas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("receitas")
        .select("*")
        .order("data_vencimento", { ascending: false });
      if (error) {
        console.error("Erro ao buscar receitas:", error);
        return [];
      }
      return (data || []) as Receita[];
    },
    enabled: !!user,
  });

  const { data: despesas = [], isLoading: loadingD } = useQuery({
    queryKey: ["despesas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("despesas")
        .select("*")
        .order("data_vencimento", { ascending: false });
      if (error) {
        console.error("Erro ao buscar despesas:", error);
        return [];
      }
      return (data || []) as Despesa[];
    },
    enabled: !!user,
  });

  const isLoading = loadingR || loadingD;

  const allItems = useMemo<FinanceiroItem[]>(() => {
    const rs: FinanceiroItem[] = (receitas || []).map((r) => ({
      id: r.receita_id,
      tipo_lancamento: "receita",
      descricao: r.descricao || "Sem descrição",
      categoria: r.categoria || "Outros",
      valor: Number(r.valor) || 0,
      status: r.status || "pendente",
      data_vencimento: r.data_vencimento || todayISO(),
      data_competencia: r.data_competencia || firstOfMonthISO(),
      data_liquidacao: r.data_recebimento,
      tipo_sub: r.tipo || "pontual",
      cliente_ou_fornecedor: r.cliente_nome,
      recorrente_grupo_id: r.recorrente_grupo_id,
      observacoes: r.observacoes,
      raw: r,
    }));

    const ds: FinanceiroItem[] = (despesas || []).map((d) => ({
      id: d.despesa_id,
      tipo_lancamento: "despesa",
      descricao: d.descricao || "Sem descrição",
      categoria: d.categoria || "Outros",
      valor: Number(d.valor_parcela) || 0,
      status: d.status || "pendente",
      data_vencimento: d.data_vencimento || todayISO(),
      data_competencia: d.data_competencia || firstOfMonthISO(),
      data_liquidacao: d.data_pagamento,
      tipo_sub: d.tipo || "pontual",
      cliente_ou_fornecedor: d.fornecedor,
      extra:
        d.tipo === "parcelada" && d.parcela_atual && d.total_parcelas
          ? `${d.parcela_atual}/${d.total_parcelas}`
          : null,
      recorrente_grupo_id: d.recorrente_grupo_id,
      observacoes: d.observacoes,
      raw: d,
    }));

    return [...rs, ...ds];
  }, [receitas, despesas]);

  const chaveRef = chaveMes(ref.ano, ref.mes);
  const chaveHoje = hoje.slice(0, 7);
  const noMesAtual = chaveRef === chaveHoje;

  const doMes = useMemo(
    () => allItems.filter((i) => (i.data_vencimento || "").startsWith(chaveRef)),
    [allItems, chaveRef],
  );

  /* Resumo do mês: realizado com o previsto logo abaixo. */
  const resumo = useMemo(() => {
    let entrouRealizado = 0;
    let entrouPrevisto = 0;
    let saiuRealizado = 0;
    let saiuPrevisto = 0;

    doMes.forEach((i) => {
      const situacao = situacaoDe(i, hoje);
      if (situacao === "cancelado") return;
      if (i.tipo_lancamento === "receita") {
        entrouPrevisto += i.valor;
        if (situacao === "liquidado") entrouRealizado += i.valor;
      } else {
        saiuPrevisto += i.valor;
        if (situacao === "liquidado") saiuRealizado += i.valor;
      }
    });

    return {
      entrouRealizado,
      entrouPrevisto,
      saiuRealizado,
      saiuPrevisto,
      aReceber: entrouPrevisto - entrouRealizado,
      aPagar: saiuPrevisto - saiuRealizado,
      saldoRealizado: entrouRealizado - saiuRealizado,
      saldoPrevisto: entrouPrevisto - saiuPrevisto,
    };
  }, [doMes, hoje]);

  /* Atrasos e próximos vencimentos varrem todos os meses, não só o visível. */
  const atrasados = useMemo(
    () =>
      allItems
        .filter((i) => situacaoDe(i, hoje) === "atrasado")
        .sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento)),
    [allItems, hoje],
  );

  const proximos = useMemo(() => {
    const limite = addDaysISO(hoje, 7);
    return allItems
      .filter((i) => {
        if (situacaoDe(i, hoje) !== "aberto") return false;
        return i.data_vencimento >= hoje && i.data_vencimento <= limite;
      })
      .sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento));
  }, [allItems, hoje]);

  /* Atraso tem dois lados: o que a empresa deixou de receber e o que deixou
     de pagar. Somar tudo num número só esconderia metade do problema. */
  const totalAtrasado = useMemo(() => {
    let aReceber = 0;
    let aPagar = 0;
    atrasados.forEach((i) => {
      if (i.tipo_lancamento === "receita") aReceber += i.valor;
      else aPagar += i.valor;
    });
    return { aReceber, aPagar };
  }, [atrasados]);

  /* Fluxo de caixa: seis meses atrás até cinco à frente do mês visível. */
  const fluxo = useMemo(() => {
    const janela = [];
    for (let offset = -6; offset <= 5; offset += 1) {
      const d = new Date(ref.ano, ref.mes + offset, 1);
      janela.push({
        key: chaveMes(d.getFullYear(), d.getMonth()),
        label: MESES_ABREV[d.getMonth()],
        entradas: 0,
        saidas: 0,
      });
    }

    const porChave = new Map(janela.map((j) => [j.key, j]));
    allItems.forEach((i) => {
      if (i.status === "cancelado") return;
      const alvo = porChave.get((i.data_vencimento || "").slice(0, 7));
      if (!alvo) return;
      if (i.tipo_lancamento === "receita") alvo.entradas += i.valor;
      else alvo.saidas += i.valor;
    });

    return janela.map((j) => ({
      ...j,
      entradas: Math.round(j.entradas),
      saidas: Math.round(j.saidas),
      saldo: Math.round(j.entradas - j.saidas),
      futuro: j.key > chaveHoje,
    }));
  }, [allItems, ref, chaveHoje]);

  /* Para onde foi o dinheiro: despesas do mês agrupadas por categoria. */
  const categorias = useMemo(() => {
    const mapa = new Map<string, number>();
    doMes.forEach((i) => {
      if (i.tipo_lancamento !== "despesa") return;
      if (situacaoDe(i, hoje) === "cancelado") return;
      mapa.set(i.categoria, (mapa.get(i.categoria) || 0) + i.valor);
    });
    const total = Array.from(mapa.values()).reduce((a, b) => a + b, 0);
    const linhas = Array.from(mapa.entries())
      .map(([nome, valor]) => ({ nome, valor, pct: total > 0 ? (valor / total) * 100 : 0 }))
      .sort((a, b) => b.valor - a.valor);
    return { total, linhas };
  }, [doMes, hoje]);

  const custoFixo = useMemo(
    () =>
      doMes
        .filter(
          (i) =>
            i.tipo_lancamento === "despesa" &&
            i.tipo_sub === "recorrente" &&
            i.status !== "cancelado",
        )
        .reduce((soma, i) => soma + i.valor, 0),
    [doMes],
  );

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return doMes
      .filter((item) => {
        if (lado !== "tudo" && item.tipo_lancamento !== lado) return false;
        if (soAberto) {
          const situacao = situacaoDe(item, hoje);
          if (situacao !== "aberto" && situacao !== "atrasado") return false;
        }
        if (q) {
          const alvo = `${item.descricao} ${item.categoria} ${item.cliente_ou_fornecedor ?? ""}`;
          if (!alvo.toLowerCase().includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento));
  }, [doMes, lado, soAberto, busca, hoje]);

  /* ─── Ações ─── */
  const irParaMes = (offset: number) => {
    const d = new Date(ref.ano, ref.mes + offset, 1);
    setRef({ ano: d.getFullYear(), mes: d.getMonth() });
  };

  const marcarLiquidado = async (item: FinanceiroItem) => {
    const data = todayISO();
    try {
      if (item.tipo_lancamento === "receita") {
        const { error } = await supabase
          .from("receitas")
          .update({ status: "recebido", data_recebimento: data })
          .eq("receita_id", item.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("despesas")
          .update({ status: "pago", data_pagamento: data })
          .eq("despesa_id", item.id);
        if (error) throw error;
      }
      toast.success(
        `"${item.descricao}" marcado como ${
          item.tipo_lancamento === "receita" ? "recebido" : "pago"
        }.`,
      );
      queryClient.invalidateQueries({ queryKey: ["receitas"] });
      queryClient.invalidateQueries({ queryKey: ["despesas"] });
    } catch (e) {
      toast.error("Erro: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  const excluir = async (item: FinanceiroItem) => {
    if (!confirm(`Excluir "${item.descricao}"?`)) return;
    try {
      if (item.tipo_lancamento === "receita") {
        const { error } = await supabase.from("receitas").delete().eq("receita_id", item.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("despesas").delete().eq("despesa_id", item.id);
        if (error) throw error;
      }
      toast.success("Lançamento excluído.");
      queryClient.invalidateQueries({ queryKey: ["receitas"] });
      queryClient.invalidateQueries({ queryKey: ["despesas"] });
    } catch (e) {
      toast.error("Erro: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  const abrirNovo = () => {
    setEditingItem(null);
    setModalOpen(true);
  };

  const abrirEdicao = (item: FinanceiroItem) => {
    setEditingItem(item);
    setModalOpen(true);
  };

  const exportCSV = () => {
    if (lista.length === 0) {
      toast.error("Nenhum lançamento para exportar neste mês.");
      return;
    }
    const headers = [
      "Tipo",
      "Descrição",
      "Categoria",
      "Valor",
      "Situação",
      "Vencimento",
      "Liquidação",
      "Cliente/Fornecedor",
      "Ocorrência",
      "Observações",
    ];
    const linhas = lista.map((i) => [
      i.tipo_lancamento,
      `"${(i.descricao || "").replace(/"/g, '""')}"`,
      `"${(i.categoria || "").replace(/"/g, '""')}"`,
      Number(i.valor || 0).toFixed(2),
      rotuloSituacao(i, situacaoDe(i, hoje)),
      i.data_vencimento,
      i.data_liquidacao ?? "",
      `"${(i.cliente_ou_fornecedor ?? "").replace(/"/g, '""')}"`,
      ocorrenciaLabel(i),
      `"${(i.observacoes ?? "").replace(/"/g, '""')}"`,
    ]);
    const csv = [headers.join(","), ...linhas.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `financeiro_${chaveRef}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("CSV exportado.");
  };

  const nomeMes = `${MESES_NOME[ref.mes]} de ${ref.ano}`;

  return (
    <AppShell
      title="Financeiro"
      subtitle="Fluxo de caixa, contas a pagar e a receber"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={exportCSV}
            className="omni-btn omni-btn--secondary omni-btn--sm"
          >
            <Download /> Exportar CSV
          </button>
          <button
            type="button"
            onClick={abrirNovo}
            className="omni-btn omni-btn--primary omni-btn--sm"
          >
            <Plus /> Novo lançamento
          </button>
        </div>
      }
    >
      <div className="omni-stack-6 w-full *:min-w-0">
        {/* ═════ Mês visível — o único controle de período da página ═════ */}
        <section className="omni-card flex flex-wrap items-center justify-between gap-3 p-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => irParaMes(-1)}
              className="omni-btn omni-btn--secondary omni-btn--icon omni-btn--sm"
              title="Mês anterior"
            >
              <ChevronLeft />
              <span className="omni-sr">Mês anterior</span>
            </button>

            <div className="min-w-[168px] text-center">
              <p className="text-md font-bold leading-tight tracking-snug text-ink">{nomeMes}</p>
              <p className="omni-small">
                {doMes.length} {doMes.length === 1 ? "lançamento" : "lançamentos"}
              </p>
            </div>

            <button
              type="button"
              onClick={() => irParaMes(1)}
              className="omni-btn omni-btn--secondary omni-btn--icon omni-btn--sm"
              title="Próximo mês"
            >
              <ChevronRight />
              <span className="omni-sr">Próximo mês</span>
            </button>
          </div>

          {!noMesAtual && (
            <button
              type="button"
              onClick={() => setRef({ ano: agora.getFullYear(), mes: agora.getMonth() })}
              className="omni-btn omni-btn--quiet omni-btn--sm"
            >
              Voltar para {MESES_NOME[agora.getMonth()].toLowerCase()}
            </button>
          )}
        </section>

        {/* ═════ Resumo do mês ═════ */}
        <section className="omni-grid omni-grid-4" aria-label={`Resumo de ${nomeMes}`}>
          <Kpi
            label="Entrou"
            valor={fmtCurrency(resumo.entrouRealizado)}
            icone={<ArrowDownLeft className="size-3.5" />}
            rodape={
              resumo.aReceber > 0 ? (
                <>
                  <span className="num">{fmtCurrency(resumo.aReceber)}</span> ainda a receber
                </>
              ) : (
                "tudo recebido no mês"
              )
            }
          />
          <Kpi
            label="Saiu"
            valor={fmtCurrency(resumo.saiuRealizado)}
            icone={<ArrowUpRight className="size-3.5" />}
            rodape={
              resumo.aPagar > 0 ? (
                <>
                  <span className="num">{fmtCurrency(resumo.aPagar)}</span> ainda a pagar
                </>
              ) : (
                "tudo pago no mês"
              )
            }
          />
          <Kpi
            label="Sobrou"
            valor={fmtCurrency(resumo.saldoRealizado)}
            tom={resumo.saldoRealizado < 0 ? "negativo" : undefined}
            icone={<Wallet className="size-3.5" />}
            rodape={
              <>
                com o mês fechado:{" "}
                <span className={cn("num", resumo.saldoPrevisto < 0 && "text-danger")}>
                  {fmtCurrency(resumo.saldoPrevisto)}
                </span>
              </>
            }
          />
          <Kpi
            label="Contas atrasadas"
            valor={String(atrasados.length)}
            tom={atrasados.length > 0 ? "negativo" : undefined}
            icone={<AlertCircle className="size-3.5" />}
            rodape={
              atrasados.length === 0 ? (
                "nada vencido em aberto"
              ) : (
                <>
                  {totalAtrasado.aReceber > 0 && (
                    <>
                      <span className="num">{fmtCurrency(totalAtrasado.aReceber)}</span> a receber
                    </>
                  )}
                  {totalAtrasado.aReceber > 0 && totalAtrasado.aPagar > 0 && " · "}
                  {totalAtrasado.aPagar > 0 && (
                    <>
                      <span className="num">{fmtCurrency(totalAtrasado.aPagar)}</span> a pagar
                    </>
                  )}
                </>
              )
            }
          />
        </section>

        {/* ═════ Fluxo de caixa ═════ */}
        <section className="omni-card">
          <div className="omni-card__header">
            <div>
              <h2 className="omni-h4">Fluxo de caixa mês a mês</h2>
              <p className="omni-small mt-0.5">
                Por data de vencimento. Barras claras são meses futuros — ainda é previsão.
              </p>
            </div>
          </div>
          <div className="omni-card__body">
            <div className="omni-scroll-x scrollbar-slim">
              <div className="h-64 min-w-[620px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={fluxo} margin={{ left: 4, right: 8, top: 8 }} barGap={2}>
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
                      tickFormatter={(v) => fmtCompact(Number(v))}
                    />
                    <Tooltip
                      cursor={{ fill: "var(--omni-surface-2)" }}
                      contentStyle={TOOLTIP_STYLE}
                      labelStyle={{ color: "var(--omni-text)", fontWeight: 700 }}
                      formatter={(val: number | string, name: string) => [
                        fmtCurrency(Number(val)),
                        name,
                      ]}
                    />
                    <Bar dataKey="entradas" name="Entradas" radius={[4, 4, 0, 0]}>
                      {fluxo.map((d) => (
                        <Cell
                          key={d.key}
                          fill="var(--omni-chart-1)"
                          fillOpacity={d.futuro ? 0.4 : 1}
                        />
                      ))}
                    </Bar>
                    <Bar dataKey="saidas" name="Saídas" radius={[4, 4, 0, 0]}>
                      {fluxo.map((d) => (
                        <Cell
                          key={d.key}
                          fill="var(--omni-chart-2)"
                          fillOpacity={d.futuro ? 0.4 : 1}
                        />
                      ))}
                    </Bar>
                    <Line
                      type="monotone"
                      dataKey="saldo"
                      name="Saldo"
                      stroke="var(--omni-text-2)"
                      strokeWidth={2}
                      dot={{ r: 2.5, fill: "var(--omni-text-2)" }}
                      activeDot={{ r: 4 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="omni-small flex items-center gap-1.5">
                <span
                  className="size-2.5 rounded-full"
                  style={{ background: "var(--omni-chart-1)" }}
                  aria-hidden="true"
                />
                Entradas
              </span>
              <span className="omni-small flex items-center gap-1.5">
                <span
                  className="size-2.5 rounded-full"
                  style={{ background: "var(--omni-chart-2)" }}
                  aria-hidden="true"
                />
                Saídas
              </span>
              <span className="omni-small flex items-center gap-1.5">
                <span
                  className="h-0.5 w-4 rounded-full"
                  style={{ background: "var(--omni-text-2)" }}
                  aria-hidden="true"
                />
                Saldo do mês
              </span>
            </div>
          </div>
        </section>

        {/* ═════ Atenção + destino do dinheiro ═════ */}
        <div className="grid gap-4 lg:grid-cols-2 *:min-w-0">
          <section className="omni-card">
            <div className="omni-card__header">
              <div>
                <h2 className="omni-h4">Precisa de atenção</h2>
                <p className="omni-small mt-0.5">Vencidas em aberto e o que vence em 7 dias</p>
              </div>
              {atrasados.length > 0 && (
                <span className="omni-badge omni-badge--danger">{atrasados.length} em atraso</span>
              )}
            </div>

            {atrasados.length === 0 && proximos.length === 0 ? (
              <div className="omni-empty">
                <span className="omni-empty__art">
                  <CheckCircle2 />
                </span>
                <h4>Nada pendente por aqui</h4>
                <p>Nenhuma conta vencida em aberto e nada vencendo nos próximos sete dias.</p>
              </div>
            ) : (
              <div className="max-h-[420px] overflow-y-auto scrollbar-slim">
                {atrasados.length > 0 && (
                  <>
                    <p className="omni-eyebrow bg-surface-2 px-4 py-2 text-danger-fg">
                      Vencidas · {atrasados.length}
                    </p>
                    <ul>
                      {atrasados.slice(0, 8).map((item) => (
                        <LinhaPendencia
                          key={item.id}
                          item={item}
                          hoje={hoje}
                          onLiquidar={marcarLiquidado}
                        />
                      ))}
                    </ul>
                  </>
                )}

                {proximos.length > 0 && (
                  <>
                    <p className="omni-eyebrow bg-surface-2 px-4 py-2">
                      Próximos 7 dias · {proximos.length}
                    </p>
                    <ul>
                      {proximos.slice(0, 8).map((item) => (
                        <LinhaPendencia
                          key={item.id}
                          item={item}
                          hoje={hoje}
                          onLiquidar={marcarLiquidado}
                        />
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}
          </section>

          <section className="omni-card">
            <div className="omni-card__header">
              <div>
                <h2 className="omni-h4">Para onde foi o dinheiro</h2>
                <p className="omni-small mt-0.5">Despesas de {nomeMes} por categoria</p>
              </div>
              <span className="omni-badge omni-badge--outline num">
                {fmtCurrency(categorias.total)}
              </span>
            </div>

            <div className="omni-card__body">
              {categorias.linhas.length === 0 ? (
                <p className="omni-small">Nenhuma despesa lançada neste mês.</p>
              ) : (
                <ul className="omni-stack-2">
                  {categorias.linhas.map((linha) => (
                    <li key={linha.nome}>
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="truncate text-sm font-medium text-ink">{linha.nome}</span>
                        <span className="num shrink-0 text-sm text-ink-2">
                          {fmtCurrency(linha.valor)}
                          <span className="omni-muted"> · {Math.round(linha.pct)}%</span>
                        </span>
                      </div>
                      <div className="omni-progress mt-1.5">
                        <div
                          className="omni-progress__bar"
                          style={{ width: `${Math.max(linha.pct, 2)}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {custoFixo > 0 && (
                <div className="omni-alert omni-alert--info mt-4">
                  <Info className="omni-alert__icon" />
                  <div className="omni-alert__body">
                    <p className="omni-alert__title">
                      Custo fixo do mês: <span className="num">{fmtCurrency(custoFixo)}</span>
                    </p>
                    <p className="omni-alert__text">
                      Soma das despesas mensais recorrentes — o piso que a operação precisa cobrir
                      todo mês.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* ═════ Lançamentos do mês ═════ */}
        <section className="omni-table-wrap">
          <div className="omni-card__header flex-wrap gap-3">
            <div>
              <h2 className="omni-h4">Lançamentos de {nomeMes}</h2>
              <p className="omni-small mt-0.5">
                {lista.length} {lista.length === 1 ? "lançamento" : "lançamentos"} · ordenados por
                vencimento
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="omni-input-group w-full sm:w-60">
                <Search />
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar no mês"
                  aria-label="Buscar lançamento no mês"
                  className="omni-input"
                />
              </div>

              <div className="omni-btn-group" role="group" aria-label="Filtrar por tipo">
                {(
                  [
                    ["tudo", "Tudo"],
                    ["receita", "Entradas"],
                    ["despesa", "Saídas"],
                  ] as const
                ).map(([valor, rotulo]) => (
                  <button
                    key={valor}
                    type="button"
                    aria-pressed={lado === valor}
                    onClick={() => setLado(valor)}
                    className="omni-btn omni-btn--secondary omni-btn--sm"
                  >
                    {rotulo}
                  </button>
                ))}
              </div>

              <button
                type="button"
                aria-pressed={soAberto}
                onClick={() => setSoAberto((v) => !v)}
                className={cn(
                  "omni-btn omni-btn--secondary omni-btn--sm",
                  soAberto && "border-primary bg-primary-soft text-primary-soft-fg",
                )}
              >
                <CalendarClock /> Só em aberto
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="omni-stack-2 p-4">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="omni-skeleton h-row w-full" />
              ))}
            </div>
          ) : lista.length === 0 ? (
            <div className="omni-empty">
              <span className="omni-empty__art">
                <Wallet />
              </span>
              <h4>Nenhum lançamento em {nomeMes}</h4>
              <p>
                Use as setas acima para trocar de mês ou cadastre uma entrada ou saída para este
                período.
              </p>
              <button
                type="button"
                onClick={abrirNovo}
                className="omni-btn omni-btn--secondary omni-btn--sm"
              >
                <Plus /> Novo lançamento
              </button>
            </div>
          ) : (
            <>
              {/* Tabela no desktop */}
              <div className="omni-table-scroll hidden md:block">
                <table className="omni-table">
                  <thead>
                    <tr>
                      <th className="omni-th-num">Vencimento</th>
                      <th>Descrição</th>
                      <th>Categoria</th>
                      <th>Cliente / fornecedor</th>
                      <th>Ocorrência</th>
                      <th className="omni-th-num">Valor</th>
                      <th>Situação</th>
                      <th className="omni-th-num">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lista.map((item) => {
                      const isReceita = item.tipo_lancamento === "receita";
                      const situacao = situacaoDe(item, hoje);
                      return (
                        <tr key={item.id}>
                          <td className="omni-td-num">
                            {fmtDate(item.data_vencimento)}
                            {item.data_liquidacao && (
                              <p className="omni-small">baixa {fmtDiaMes(item.data_liquidacao)}</p>
                            )}
                          </td>

                          <td>
                            <div className="flex items-center gap-2.5">
                              <span
                                className={cn(
                                  "grid size-7 shrink-0 place-items-center rounded-sm",
                                  isReceita
                                    ? "bg-success-soft text-success"
                                    : "bg-danger-soft text-danger",
                                )}
                                aria-hidden="true"
                              >
                                {isReceita ? (
                                  <ArrowDownLeft className="size-3.5" />
                                ) : (
                                  <ArrowUpRight className="size-3.5" />
                                )}
                              </span>
                              <span className="omni-td-strong max-w-[260px] truncate">
                                {item.descricao}
                              </span>
                            </div>
                          </td>

                          <td className="text-ink-2">{item.categoria}</td>
                          <td className="text-ink-2">{item.cliente_ou_fornecedor || "—"}</td>

                          <td>
                            <span
                              className={cn(
                                "omni-badge",
                                item.tipo_sub === "recorrente"
                                  ? "omni-badge--info"
                                  : item.tipo_sub === "parcelada"
                                    ? "omni-badge--brand"
                                    : "omni-badge--outline",
                              )}
                            >
                              {item.tipo_sub === "recorrente" && <RefreshCw />}
                              {item.tipo_sub === "parcelada" && <Layers />}
                              {ocorrenciaLabel(item)}
                            </span>
                          </td>

                          <td className="omni-td-num">
                            <span
                              className={cn(
                                "font-semibold",
                                isReceita ? "text-success" : "text-danger",
                              )}
                            >
                              {isReceita ? "+" : "−"}
                              {fmtCurrency(item.valor)}
                            </span>
                          </td>

                          <td>
                            <span className={cn("omni-badge", BADGE_SITUACAO[situacao])}>
                              <IconeSituacao situacao={situacao} /> {rotuloSituacao(item, situacao)}
                            </span>
                          </td>

                          <td className="omni-td-actions">
                            <div className="inline-flex items-center gap-1">
                              {situacao !== "liquidado" && situacao !== "cancelado" && (
                                <button
                                  type="button"
                                  onClick={() => marcarLiquidado(item)}
                                  title={isReceita ? "Marcar como recebido" : "Marcar como pago"}
                                  className="omni-btn omni-btn--ghost omni-btn--icon omni-btn--sm text-success hover:bg-success-soft"
                                >
                                  <CheckCircle2 />
                                  <span className="omni-sr">
                                    {isReceita ? "Marcar como recebido" : "Marcar como pago"}
                                  </span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => abrirEdicao(item)}
                                className="omni-btn omni-btn--ghost omni-btn--icon omni-btn--sm"
                                title={`Editar ${item.descricao}`}
                              >
                                <Pencil />
                                <span className="omni-sr">Editar {item.descricao}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => excluir(item)}
                                className="omni-btn omni-btn--ghost omni-btn--icon omni-btn--sm text-danger hover:bg-danger-soft"
                                title={`Excluir ${item.descricao}`}
                              >
                                <Trash2 />
                                <span className="omni-sr">Excluir {item.descricao}</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Cartões no mobile */}
              <ul className="omni-stack-2 p-3 md:hidden">
                {lista.map((item) => (
                  <CardLancamento
                    key={item.id}
                    item={item}
                    hoje={hoje}
                    onLiquidar={marcarLiquidado}
                    onEditar={abrirEdicao}
                    onExcluir={excluir}
                  />
                ))}
              </ul>

              <div className="omni-table__foot">
                <span>
                  {lista.length} {lista.length === 1 ? "lançamento" : "lançamentos"} em {nomeMes}
                </span>
                <span className="num">Resultado do mês {fmtCurrency(resumo.saldoRealizado)}</span>
              </div>
            </>
          )}
        </section>
      </div>

      <ModalForm
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingItem(null);
        }}
        editingItem={editingItem}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ["receitas"] });
          queryClient.invalidateQueries({ queryKey: ["despesas"] });
        }}
      />
    </AppShell>
  );
}
