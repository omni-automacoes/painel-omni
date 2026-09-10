import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Plus,
  Search,
  Download,
  Calendar,
  DollarSign,
  CheckCircle2,
  Clock,
  AlertCircle,
  Pencil,
  Trash2,
  X,
  Building2,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Layers,
  ChevronLeft,
  ChevronRight,
  Info,
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

export const Route = createFileRoute("/financeiro")({
  head: () => ({
    meta: [
      { title: "Financeiro · Omni Automações" },
      {
        name: "description",
        content: "Controle de receitas e despesas empresariais da Omni Automações.",
      },
    ],
  }),
  component: Financeiro,
});

/* ─── Types ─── */
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

/* ─── Constantes de Meses ─── */
const MESES = [
  { idx: 0, abrev: "Jan", nome: "Janeiro" },
  { idx: 1, abrev: "Fev", nome: "Fevereiro" },
  { idx: 2, abrev: "Mar", nome: "Março" },
  { idx: 3, abrev: "Abr", nome: "Abril" },
  { idx: 4, abrev: "Mai", nome: "Maio" },
  { idx: 5, abrev: "Jun", nome: "Junho" },
  { idx: 6, abrev: "Jul", nome: "Julho" },
  { idx: 7, abrev: "Ago", nome: "Agosto" },
  { idx: 8, abrev: "Set", nome: "Setembro" },
  { idx: 9, abrev: "Out", nome: "Outubro" },
  { idx: 10, abrev: "Nov", nome: "Novembro" },
  { idx: 11, abrev: "Dez", nome: "Dezembro" },
];

const ANOS_DISPONIVEIS = [2024, 2025, 2026, 2027];

/* ─── Categorias ─── */
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

/* Situação do lançamento: cor sempre acompanhada de rótulo e ícone. */
const STATUS_CONFIG: Record<string, { label: string; badge: string; icon: React.ReactNode }> = {
  recebido: { label: "Recebido", badge: "omni-badge--success", icon: <CheckCircle2 /> },
  pago: { label: "Pago", badge: "omni-badge--success", icon: <CheckCircle2 /> },
  pendente: { label: "Pendente", badge: "omni-badge--warning", icon: <Clock /> },
  atrasado: { label: "Atrasado", badge: "omni-badge--danger", icon: <AlertCircle /> },
  cancelado: { label: "Cancelado", badge: "omni-badge--outline", icon: <X /> },
};

/* ─── Helpers ─── */
const fmtCurrency = (val: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(val) || 0);

const fmtDate = (d?: string | null) => {
  if (!d) return "—";
  try {
    const parts = d.split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
  } catch {
    // fallback
  }
  return d;
};

const todayISO = () => new Date().toISOString().split("T")[0];
const firstOfMonthISO = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-01`;
};

function addMonthsToDate(dateStr: string, monthsToAdd: number): string {
  try {
    const parts = dateStr.split("-").map(Number);
    if (parts.length === 3) {
      const target = new Date(parts[0], parts[1] - 1 + monthsToAdd, parts[2] || 1);
      const year = target.getFullYear();
      const month = String(target.getMonth() + 1).padStart(2, "0");
      const day = String(target.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
  } catch {
    // fallback
  }
  return dateStr;
}

function tipoLabel(item: FinanceiroItem) {
  if (item.tipo_lancamento === "receita") {
    return item.tipo_sub === "recorrente" ? "Recorrente" : "Pontual";
  }
  if (item.tipo_sub === "parcelada") return `Parcelada ${item.extra ?? ""}`;
  if (item.tipo_sub === "recorrente") return "Recorrente";
  return "Pontual";
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

/* ─── Main Component ─── */
function Financeiro() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-11

  /* Estados de Filtro de Mês e Ano */
  const [selectedYear, setSelectedYear] = useState<number | "todos">(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number | "todos">(currentMonth);
  const [dateBasis, setDateBasis] = useState<"vencimento" | "competencia" | "liquidacao">(
    "vencimento",
  );

  /* Estados de Filtro Geral */
  const [search, setSearch] = useState("");
  const [filterTipo, setFilterTipo] = useState<"todos" | "receita" | "despesa">("todos");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<FinanceiroItem | null>(null);

  /* Queries com fallback seguro */
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

  /* Unify into flat list */
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

    return [...rs, ...ds].sort((a, b) =>
      (b.data_vencimento || "").localeCompare(a.data_vencimento || ""),
    );
  }, [receitas, despesas]);

  /* Contador de transações por mês no ano selecionado */
  const monthCounters = useMemo(() => {
    const counts: Record<number, number> = {};
    MESES.forEach((m) => {
      counts[m.idx] = 0;
    });

    const targetYear = selectedYear === "todos" ? null : selectedYear;

    allItems.forEach((i) => {
      let dateStr = i.data_vencimento;
      if (dateBasis === "competencia") dateStr = i.data_competencia || i.data_vencimento;
      else if (dateBasis === "liquidacao") dateStr = i.data_liquidacao || i.data_vencimento;

      if (!dateStr) return;
      const d = new Date(dateStr + "T12:00:00");
      if (isNaN(d.getTime())) return;

      if (targetYear === null || d.getFullYear() === targetYear) {
        const m = d.getMonth();
        counts[m] = (counts[m] || 0) + 1;
      }
    });

    return counts;
  }, [allItems, selectedYear, dateBasis]);

  /* Helper para navegar meses */
  const handlePrevMonth = () => {
    if (selectedMonth === "todos") {
      setSelectedMonth(11);
      if (typeof selectedYear === "number") setSelectedYear(selectedYear - 1);
    } else if (selectedMonth === 0) {
      setSelectedMonth(11);
      if (typeof selectedYear === "number") setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === "todos") {
      setSelectedMonth(0);
      if (typeof selectedYear === "number") setSelectedYear(selectedYear + 1);
    } else if (selectedMonth === 11) {
      setSelectedMonth(0);
      if (typeof selectedYear === "number") setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  /* Filtro aplicado */
  const filtered = useMemo(() => {
    return allItems.filter((item) => {
      let targetDateStr = item.data_vencimento;
      if (dateBasis === "competencia") {
        targetDateStr = item.data_competencia || item.data_vencimento;
      } else if (dateBasis === "liquidacao") {
        targetDateStr = item.data_liquidacao || item.data_vencimento;
      }

      if (targetDateStr) {
        const d = new Date(targetDateStr + "T12:00:00");
        if (!isNaN(d.getTime())) {
          const itemYear = d.getFullYear();
          const itemMonth = d.getMonth();

          if (selectedYear !== "todos" && itemYear !== Number(selectedYear)) {
            return false;
          }

          if (selectedMonth !== "todos" && itemMonth !== Number(selectedMonth)) {
            return false;
          }
        }
      }

      if (filterTipo !== "todos" && item.tipo_lancamento !== filterTipo) return false;
      if (filterStatus !== "todos" && item.status !== filterStatus) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const desc = (item.descricao || "").toLowerCase();
        const cat = (item.categoria || "").toLowerCase();
        const cli = (item.cliente_ou_fornecedor || "").toLowerCase();
        if (!desc.includes(q) && !cat.includes(q) && !cli.includes(q)) return false;
      }
      return true;
    });
  }, [allItems, selectedYear, selectedMonth, dateBasis, filterTipo, filterStatus, search]);

  /* Detecta se existem lançamentos no mês selecionado em outro ano */
  const otherYearsWithData = useMemo(() => {
    if (selectedMonth === "todos" || filtered.length > 0) return [];
    const foundYears = new Set<number>();
    allItems.forEach((i) => {
      let dateStr = i.data_vencimento;
      if (dateBasis === "competencia") dateStr = i.data_competencia || i.data_vencimento;
      else if (dateBasis === "liquidacao") dateStr = i.data_liquidacao || i.data_vencimento;
      if (!dateStr) return;
      const d = new Date(dateStr + "T12:00:00");
      if (!isNaN(d.getTime())) {
        if (d.getMonth() === selectedMonth && d.getFullYear() !== selectedYear) {
          foundYears.add(d.getFullYear());
        }
      }
    });
    return Array.from(foundYears).sort();
  }, [allItems, selectedMonth, selectedYear, filtered.length, dateBasis]);

  /* KPIs do período filtrado */
  const kpis = useMemo(() => {
    let rRecebido = 0;
    let rPendente = 0;
    let dPago = 0;
    let dPendente = 0;

    filtered.forEach((i) => {
      const v = Number(i.valor) || 0;
      if (i.tipo_lancamento === "receita") {
        if (i.status === "recebido") rRecebido += v;
        else if (i.status === "pendente" || i.status === "atrasado") rPendente += v;
      } else {
        if (i.status === "pago") dPago += v;
        else if (i.status === "pendente" || i.status === "atrasado") dPendente += v;
      }
    });
    const saldo = rRecebido - dPago;
    const margem = rRecebido > 0 ? ((saldo / rRecebido) * 100).toFixed(1) : "0";
    return { rRecebido, rPendente, dPago, dPendente, saldo, margem };
  }, [filtered]);

  /* Dados do gráfico comparativo */
  const chartData = useMemo(() => {
    const map: Record<string, { Receitas: number; Despesas: number }> = {};
    MESES.forEach((m) => {
      map[m.abrev] = { Receitas: 0, Despesas: 0 };
    });

    const targetYear = selectedYear === "todos" ? currentYear : selectedYear;

    allItems.forEach((item) => {
      if (item.status === "cancelado") return;

      let dateStr = item.data_vencimento;
      if (dateBasis === "competencia") dateStr = item.data_competencia || item.data_vencimento;
      else if (dateBasis === "liquidacao") dateStr = item.data_liquidacao || item.data_vencimento;

      if (!dateStr) return;
      const d = new Date(dateStr + "T12:00:00");
      if (isNaN(d.getTime())) return;
      if (d.getFullYear() !== targetYear) return;

      const m = MESES[d.getMonth()].abrev;
      const v = Number(item.valor) || 0;
      if (item.tipo_lancamento === "receita" && item.status === "recebido") {
        map[m].Receitas += v;
      }
      if (item.tipo_lancamento === "despesa" && item.status === "pago") {
        map[m].Despesas += v;
      }
    });

    return MESES.map((m) => ({
      m: m.abrev,
      Receitas: Math.round(map[m.abrev].Receitas),
      Despesas: Math.round(map[m.abrev].Despesas),
    }));
  }, [allItems, selectedYear, dateBasis, currentYear]);

  /* Ações */
  const marcarLiquidado = async (item: FinanceiroItem) => {
    const today = todayISO();
    try {
      if (item.tipo_lancamento === "receita") {
        const { error } = await supabase
          .from("receitas")
          .update({ status: "recebido", data_recebimento: today })
          .eq("receita_id", item.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("despesas")
          .update({ status: "pago", data_pagamento: today })
          .eq("despesa_id", item.id);
        if (error) throw error;
      }
      toast.success(
        `"${item.descricao}" marcado como ${item.tipo_lancamento === "receita" ? "recebido" : "pago"}!`,
      );
      queryClient.invalidateQueries({ queryKey: ["receitas"] });
      queryClient.invalidateQueries({ queryKey: ["despesas"] });
    } catch (e: any) {
      toast.error("Erro: " + (e?.message || String(e)));
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
      toast.success("Lançamento excluído!");
      queryClient.invalidateQueries({ queryKey: ["receitas"] });
      queryClient.invalidateQueries({ queryKey: ["despesas"] });
    } catch (e: any) {
      toast.error("Erro: " + (e?.message || String(e)));
    }
  };

  const exportCSV = () => {
    if (filtered.length === 0) {
      toast.error("Nenhum dado para exportar com os filtros atuais.");
      return;
    }
    const headers = [
      "Tipo",
      "Descrição",
      "Categoria",
      "Valor",
      "Status",
      "Vencimento",
      "Competência",
      "Liquidação",
      "Cliente/Fornecedor",
      "Sub-tipo",
      "Observações",
    ];
    const rows = filtered.map((i) => [
      i.tipo_lancamento,
      `"${(i.descricao || "").replace(/"/g, '""')}"`,
      `"${(i.categoria || "").replace(/"/g, '""')}"`,
      Number(i.valor || 0).toFixed(2),
      i.status,
      i.data_vencimento,
      i.data_competencia,
      i.data_liquidacao ?? "",
      `"${(i.cliente_ou_fornecedor ?? "").replace(/"/g, '""')}"`,
      i.tipo_sub,
      `"${(i.observacoes ?? "").replace(/"/g, '""')}"`,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const nomePeriodo =
      selectedMonth === "todos"
        ? `Ano_${selectedYear}`
        : `${MESES[selectedMonth as number].nome}_${selectedYear}`;
    a.download = `financeiro_omni_${nomePeriodo}_${todayISO()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success("CSV exportado com sucesso!");
  };

  const periodoTextoAtivo = useMemo(() => {
    if (selectedMonth === "todos" && selectedYear === "todos") return "todo o histórico";
    if (selectedMonth === "todos") return `o ano de ${selectedYear}`;
    if (selectedYear === "todos") return `${MESES[selectedMonth as number].nome} (todos os anos)`;
    return `${MESES[selectedMonth as number].nome} de ${selectedYear}`;
  }, [selectedMonth, selectedYear]);

  const baseTexto =
    dateBasis === "vencimento"
      ? "vencimento"
      : dateBasis === "competencia"
        ? "competência"
        : "liquidação";

  return (
    <AppShell
      title="Financeiro"
      subtitle={`Receitas, despesas e fluxo de caixa de ${periodoTextoAtivo}`}
      actions={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={exportCSV}
            className="omni-btn omni-btn--secondary omni-btn--sm"
          >
            <Download /> Exportar CSV
          </button>
          <button
            type="button"
            onClick={() => {
              setEditingItem(null);
              setModalOpen(true);
            }}
            className="omni-btn omni-btn--primary omni-btn--sm"
          >
            <Plus /> Novo lançamento
          </button>
        </div>
      }
    >
      <div className="omni-stack-6 w-full">
        {/* ══════ 1. Período ══════ */}

        <section className="omni-card">
          <div className="omni-card__header flex-wrap gap-3 py-3">
            <span className="flex items-center gap-2 text-sm font-medium text-ink-2">
              <Calendar className="size-4 text-ink-3" /> Período
              <span className="omni-badge omni-badge--brand">{periodoTextoAtivo}</span>
            </span>

            <div className="flex flex-wrap items-center gap-3">
              <div className="omni-btn-group" role="group" aria-label="Navegar meses">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  title="Mês anterior"
                  className="omni-btn omni-btn--secondary omni-btn--sm"
                >
                  <ChevronLeft />
                  <span className="omni-sr">Mês anterior</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedMonth(currentMonth);
                    setSelectedYear(currentYear);
                  }}
                  className="omni-btn omni-btn--secondary omni-btn--sm"
                >
                  Hoje
                </button>
                <button
                  type="button"
                  onClick={handleNextMonth}
                  title="Próximo mês"
                  className="omni-btn omni-btn--secondary omni-btn--sm"
                >
                  <ChevronRight />
                  <span className="omni-sr">Próximo mês</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <label className="omni-label text-xs" htmlFor="filtro-ano">
                  Ano
                </label>
                <select
                  id="filtro-ano"
                  value={selectedYear}
                  onChange={(e) => {
                    const v = e.target.value;
                    setSelectedYear(v === "todos" ? "todos" : Number(v));
                  }}
                  className="omni-select w-auto"
                >
                  {ANOS_DISPONIVEIS.map((ano) => (
                    <option key={ano} value={ano}>
                      {ano}
                    </option>
                  ))}
                  <option value="todos">Todos os anos</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <label className="omni-label text-xs" htmlFor="filtro-base">
                  Base
                </label>
                <select
                  id="filtro-base"
                  value={dateBasis}
                  onChange={(e) => setDateBasis(e.target.value as any)}
                  className="omni-select w-auto"
                >
                  <option value="vencimento">Vencimento</option>
                  <option value="competencia">Competência</option>
                  <option value="liquidacao">Liquidação</option>
                </select>
              </div>
            </div>
          </div>

          <div className="omni-scroll-x flex items-center gap-1.5 p-3 scrollbar-slim">
            <button
              type="button"
              aria-pressed={selectedMonth === "todos"}
              onClick={() => setSelectedMonth("todos")}
              className={cn(
                "omni-btn omni-btn--secondary omni-btn--sm shrink-0",
                selectedMonth === "todos" && "border-primary bg-primary-soft text-primary-soft-fg",
              )}
            >
              Ano todo
            </button>

            {MESES.map((m) => {
              const isSelected = selectedMonth === m.idx;
              const isThisCurrentMonth = m.idx === currentMonth && selectedYear === currentYear;
              const count = monthCounters[m.idx] || 0;

              return (
                <button
                  key={m.idx}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setSelectedMonth(m.idx)}
                  className={cn(
                    "omni-btn omni-btn--secondary omni-btn--sm shrink-0",
                    isSelected && "border-primary bg-primary-soft text-primary-soft-fg",
                  )}
                >
                  {m.abrev}
                  {isThisCurrentMonth && !isSelected && (
                    <span className="omni-badge omni-badge--info">hoje</span>
                  )}
                  {count > 0 && <span className="num opacity-70">{count}</span>}
                </button>
              );
            })}
          </div>
        </section>

        {/* ══════ 2. Indicadores do período ══════ */}

        <section className="omni-grid omni-grid-4" aria-label="Indicadores do período">
          <div className="omni-card">
            <div className="omni-stat">
              <span className="omni-stat__label flex items-center gap-1.5">
                <TrendingUp className="size-3.5" /> Receitas recebidas
              </span>
              <p className="omni-stat__value">{fmtCurrency(kpis.rRecebido)}</p>
              <p className="omni-stat__foot">
                <span className="num">{fmtCurrency(kpis.rPendente)}</span> ainda a receber
              </p>
            </div>
          </div>

          <div className="omni-card">
            <div className="omni-stat">
              <span className="omni-stat__label flex items-center gap-1.5">
                <TrendingDown className="size-3.5" /> Despesas pagas
              </span>
              <p className="omni-stat__value">{fmtCurrency(kpis.dPago)}</p>
              <p className="omni-stat__foot">
                <span className="num">{fmtCurrency(kpis.dPendente)}</span> ainda a pagar
              </p>
            </div>
          </div>

          <div className="omni-card">
            <div className="omni-stat">
              <span className="omni-stat__label flex items-center gap-1.5">
                <Building2 className="size-3.5" /> Resultado
              </span>
              <p className={cn("omni-stat__value", kpis.saldo < 0 && "text-danger")}>
                {fmtCurrency(kpis.saldo)}
              </p>
              <p className="omni-stat__foot">
                <span
                  className={cn(
                    "omni-badge",
                    kpis.saldo >= 0 ? "omni-badge--success" : "omni-badge--danger",
                  )}
                >
                  {kpis.saldo >= 0 ? "No azul" : "No vermelho"}
                </span>
                <span className="num">{String(kpis.margem).replace(".", ",")}% de margem</span>
              </p>
            </div>
          </div>

          <div className="omni-card">
            <div className="omni-stat">
              <span className="omni-stat__label flex items-center gap-1.5">
                <Clock className="size-3.5" /> Pendências
              </span>
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="omni-small">A receber</p>
                  <p className="num text-lg font-bold text-ink">{fmtCurrency(kpis.rPendente)}</p>
                </div>
                <div className="text-right">
                  <p className="omni-small">A pagar</p>
                  <p className="num text-lg font-bold text-ink">{fmtCurrency(kpis.dPendente)}</p>
                </div>
              </div>
              <p className="omni-stat__foot">
                <DollarSign className="size-3.5" /> Em aberto no período
              </p>
            </div>
          </div>
        </section>

        {/* ══════ 3. Busca e filtros ══════ */}

        <div className="omni-card">
          <div className="omni-card__body flex flex-wrap items-end gap-4 py-4">
            <div className="omni-field min-w-[240px] flex-1">
              <label className="omni-label" htmlFor="busca-lancamento">
                Buscar lançamento
              </label>
              <div className="omni-input-group">
                <Search />
                <input
                  id="busca-lancamento"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Descrição, categoria, cliente ou fornecedor"
                  className="omni-input"
                />
              </div>
            </div>

            <div className="omni-field w-full sm:w-52">
              <label className="omni-label" htmlFor="filtro-tipo">
                Tipo
              </label>
              <select
                id="filtro-tipo"
                value={filterTipo}
                onChange={(e) => setFilterTipo(e.target.value as any)}
                className="omni-select"
              >
                <option value="todos">Receitas e despesas</option>
                <option value="receita">Apenas receitas</option>
                <option value="despesa">Apenas despesas</option>
              </select>
            </div>

            <div className="omni-field w-full sm:w-52">
              <label className="omni-label" htmlFor="filtro-situacao">
                Situação
              </label>
              <select
                id="filtro-situacao"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="omni-select"
              >
                <option value="todos">Todas as situações</option>
                <option value="recebido">Recebidos</option>
                <option value="pago">Pagos</option>
                <option value="pendente">Pendentes</option>
                <option value="atrasado">Atrasados</option>
                <option value="cancelado">Cancelados</option>
              </select>
            </div>
          </div>
        </div>

        {/* ══════ 4. Fluxo de caixa mensal ══════ */}

        <section className="omni-card">
          <div className="omni-card__header">
            <div>
              <h2 className="omni-h4">
                Fluxo de caixa mensal em {selectedYear === "todos" ? currentYear : selectedYear}
              </h2>
              <p className="omni-small mt-0.5">
                Receitas recebidas e despesas pagas, por {baseTexto}
              </p>
            </div>
          </div>
          <div className="omni-card__body">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ left: 4, right: 8, top: 4 }} barGap={2}>
                  <CartesianGrid
                    stroke="var(--omni-chart-grid)"
                    strokeDasharray="3 3"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="m"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "var(--omni-text-3)", fontSize: 11 }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={64}
                    tick={{ fill: "var(--omni-text-3)", fontSize: 10 }}
                    tickFormatter={(v) => `R$ ${(Number(v) / 1000).toFixed(0)} mil`}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--omni-surface-2)" }}
                    contentStyle={TOOLTIP_STYLE}
                    labelStyle={{ color: "var(--omni-text)", fontWeight: 700 }}
                    formatter={(val: any, name: any) => [fmtCurrency(Number(val)), name]}
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
                  <Bar dataKey="Receitas" fill="var(--omni-chart-1)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Despesas" fill="var(--omni-chart-2)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        {/* ══════ 5. Lançamentos ══════ */}

        <section className="omni-table-wrap">
          <div className="omni-card__header">
            <div>
              <h2 className="omni-h4">Lançamentos de {periodoTextoAtivo}</h2>
              <p className="omni-small mt-0.5">Filtrados por data de {baseTexto}</p>
            </div>
            <span className="omni-badge omni-badge--outline">{filtered.length}</span>
          </div>

          {otherYearsWithData.length > 0 && (
            <div className="p-5 pb-0">
              <div className="omni-alert omni-alert--info">
                <Info className="omni-alert__icon" />
                <div className="omni-alert__body">
                  <p className="omni-alert__title">
                    Há lançamentos de {MESES[selectedMonth as number].nome} em outro ano
                  </p>
                  <p className="omni-alert__text">
                    Encontramos registros em {otherYearsWithData.join(", ")}. Troque o ano para
                    vê-los.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {otherYearsWithData.map((ano) => (
                      <button
                        key={ano}
                        type="button"
                        onClick={() => setSelectedYear(ano)}
                        className="omni-btn omni-btn--secondary omni-btn--sm"
                      >
                        Ver {MESES[selectedMonth as number].abrev}/{ano}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="omni-table-scroll">
            <table className="omni-table">
              <thead>
                <tr>
                  <th className="omni-th-num">Vencimento</th>
                  <th>Descrição</th>
                  <th>Categoria</th>
                  <th>Ocorrência</th>
                  <th>Cliente / fornecedor</th>
                  <th className="omni-th-num">Valor</th>
                  <th>Situação</th>
                  <th className="omni-th-num">Ações</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  [0, 1, 2, 3, 4, 5].map((i) => (
                    <tr key={i}>
                      <td colSpan={8} className="p-0">
                        <div className="omni-skeleton h-row w-full rounded-none" />
                      </td>
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-0">
                      <div className="omni-empty">
                        <span className="omni-empty__art">
                          <DollarSign />
                        </span>
                        <h4>Nenhum lançamento em {periodoTextoAtivo}</h4>
                        <p>
                          Escolha outro mês na barra acima ou cadastre uma entrada ou saída para
                          este período.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingItem(null);
                            setModalOpen(true);
                          }}
                          className="omni-btn omni-btn--secondary omni-btn--sm"
                        >
                          <Plus /> Novo lançamento
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((item) => {
                    const isReceita = item.tipo_lancamento === "receita";
                    const st = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.pendente;
                    const isLiquidado = item.status === "recebido" || item.status === "pago";
                    return (
                      <tr key={item.id} className="group">
                        <td className="omni-td-num">
                          {fmtDate(item.data_vencimento)}
                          {item.data_liquidacao && (
                            <p className="omni-small">liquidado {fmtDate(item.data_liquidacao)}</p>
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
                            <span className="omni-td-strong max-w-[240px] truncate">
                              {item.descricao}
                            </span>
                          </div>
                        </td>

                        <td className="text-ink-2">{item.categoria}</td>

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
                            {tipoLabel(item)}
                          </span>
                        </td>

                        <td className="text-ink-2">{item.cliente_ou_fornecedor || "—"}</td>

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
                          <span className={cn("omni-badge", st.badge)}>
                            {st.icon} {st.label}
                          </span>
                        </td>

                        <td className="omni-td-actions">
                          <div className="inline-flex items-center gap-1">
                            {!isLiquidado && item.status !== "cancelado" && (
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
                              onClick={() => {
                                setEditingItem(item);
                                setModalOpen(true);
                              }}
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
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="omni-table__foot">
            <span>
              {filtered.length} {filtered.length === 1 ? "lançamento" : "lançamentos"} em{" "}
              {periodoTextoAtivo}
            </span>
            <span className="num">Resultado {fmtCurrency(kpis.saldo)}</span>
          </div>
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
