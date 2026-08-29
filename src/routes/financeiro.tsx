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
  User,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
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
      { name: "description", content: "Controle de receitas e despesas empresariais da Omni Automações." },
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

  useEffect(() => {
    if (!open) return;
    if (editingItem) {
      setTipoLancamento(editingItem.tipo_lancamento);
      setDescricao(editingItem.descricao || "");
      setCategoria(editingItem.categoria || CATEGORIAS_RECEITA[0]);
      setValor(Number(editingItem.valor || 0).toFixed(2).replace(".", ","));
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
    if (!descricao.trim()) { toast.error("Informe a descrição!"); return; }
    if (numValor() <= 0) { toast.error("Informe um valor válido!"); return; }
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
          const { error } = await supabase.from("receitas").update(payload).eq("receita_id", editingItem.id);
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
              observacoes: observacoes ? `${observacoes}${i > 0 ? ` (Mês ${i + 1}/${mesesProjecao})` : ""}` : (i > 0 ? `Projeção automática recorrência (${i + 1}/${mesesProjecao})` : null),
            });
          }
          const { error } = await supabase.from("receitas").insert(rowsToInsert);
          if (error) throw error;
          toast.success(`Receita recorrente criada e projetada para os próximos ${mesesProjecao} meses!`);
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
          const { error } = await supabase.from("despesas").update(payload).eq("despesa_id", editingItem.id);
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
              observacoes: observacoes ? `${observacoes}${i > 0 ? ` (Mês ${i + 1}/${mesesProjecao})` : ""}` : (i > 0 ? `Projeção automática recorrência (${i + 1}/${mesesProjecao})` : null),
            });
          }
          const { error } = await supabase.from("despesas").insert(rowsToInsert);
          if (error) throw error;
          toast.success(`Despesa recorrente criada e projetada para os próximos ${mesesProjecao} meses!`);
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
              observacoes: observacoes ? `${observacoes} (Parcela ${i + 1}/${totalParcelas})` : `Parcela ${i + 1}/${totalParcelas}`,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#12122d]/95 backdrop-blur-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div>
            <h2 className="text-base font-extrabold text-foreground">
              {editingItem ? "Editar Lançamento" : "Novo Lançamento"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {tipoLancamento === "receita" ? "Entrada financeira (Receita)" : "Saída financeira (Despesa)"}
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-muted-foreground hover:bg-white/10 transition-colors">
            <X className="size-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Tipo de Lançamento */}
          <div className="grid grid-cols-2 gap-2">
            {(["receita", "despesa"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTipoLancamento(t)}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-xl border py-2.5 text-xs font-bold transition-all",
                  tipoLancamento === t
                    ? t === "receita"
                      ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-400"
                      : "border-red-500/50 bg-red-500/15 text-red-400"
                    : "border-white/10 bg-white/5 text-muted-foreground hover:border-white/20"
                )}
              >
                {t === "receita" ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}
                {t === "receita" ? "Receita (+)" : "Despesa (-)"}
              </button>
            ))}
          </div>

          {/* Sub-tipo */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Tipo de Ocorrência</label>
            <div className="flex gap-2 flex-wrap">
              {(tipoLancamento === "receita" ? ["pontual", "recorrente"] : ["pontual", "recorrente", "parcelada"]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTipoSub(t)}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-xs font-semibold capitalize transition-all",
                    tipoSub === t
                      ? "border-accent/50 bg-accent/15 text-accent"
                      : "border-white/10 bg-white/5 text-muted-foreground hover:border-accent/30"
                  )}
                >
                  {t === "parcelada" ? "Parcelada" : t === "recorrente" ? "Recorrente (Mensal)" : "Pontual (Única)"}
                </button>
              ))}
            </div>
          </div>

          {/* Destaque informativo de Recorrência */}
          {tipoSub === "recorrente" && !editingItem && (
            <div className="rounded-xl border border-accent/30 bg-accent/10 p-3 text-xs space-y-2">
              <div className="flex items-center gap-1.5 text-accent font-bold">
                <Sparkles className="size-4" />
                <span>Projeção Automática de Recorrência</span>
              </div>
              <p className="text-muted-foreground text-[11px] leading-relaxed">
                Este lançamento se repetirá mês a mês. O 1º mês terá o status definido abaixo, e os meses seguintes serão gerados automaticamente como <strong className="text-foreground">Pendente</strong>.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <span className="text-[11px] font-semibold text-foreground">Projetar para:</span>
                <select
                  value={mesesProjecao}
                  onChange={(e) => setMesesProjecao(Number(e.target.value))}
                  className="rounded-lg border border-accent/40 bg-[#12122d] px-2 py-1 text-xs font-bold text-accent outline-none cursor-pointer"
                >
                  <option value={6}>Próximos 6 meses</option>
                  <option value={12}>Próximos 12 meses (1 ano)</option>
                  <option value={24}>Próximos 24 meses (2 anos)</option>
                </select>
              </div>
            </div>
          )}

          {/* Parcelas (somente parcelada) */}
          {tipoSub === "parcelada" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Parcela Atual</label>
                <input
                  type="number"
                  min={1}
                  value={parcelaAtual}
                  onChange={(e) => setParcelaAtual(Number(e.target.value) || 1)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white outline-none focus:border-accent/60"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Total de Parcelas</label>
                <input
                  type="number"
                  min={1}
                  value={totalParcelas}
                  onChange={(e) => setTotalParcelas(Number(e.target.value) || 1)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white outline-none focus:border-accent/60"
                />
              </div>
            </div>
          )}

          {/* Descrição */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Descrição *</label>
            <input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder={tipoLancamento === "receita" ? "Ex: Mensalidade Painel Omni - Cliente Rex" : "Ex: Pagamento Murilo - Salário"}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white outline-none focus:border-accent/60"
            />
          </div>

          {/* Categoria + Valor */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Categoria *</label>
              <select
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#12122d] px-3 py-2 text-xs text-white outline-none focus:border-accent/60"
              >
                {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                {tipoSub === "parcelada" ? "Valor por Parcela (R$) *" : tipoSub === "recorrente" ? "Valor Mensal (R$) *" : "Valor (R$) *"}
              </label>
              <input
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="0,00"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white outline-none focus:border-accent/60"
              />
            </div>
          </div>

          {/* Cliente / Fornecedor */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
              <User className="inline size-3 mr-1" />
              {tipoLancamento === "receita" ? "Cliente" : "Fornecedor / Colaborador"}
            </label>
            <input
              value={clienteOuFornecedor}
              onChange={(e) => setClienteOuFornecedor(e.target.value)}
              placeholder={tipoLancamento === "receita" ? "Ex: Auto Center Rex" : "Ex: Murilo / Meta Platforms"}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white outline-none focus:border-accent/60"
            />
          </div>

          {/* Status */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
              Status do 1º Mês
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-[#12122d] px-3 py-2 text-xs text-white outline-none focus:border-accent/60"
            >
              {(tipoLancamento === "receita"
                ? [["pendente", "Pendente"], ["recebido", "Recebido"], ["atrasado", "Atrasado"], ["cancelado", "Cancelado"]]
                : [["pendente", "Pendente"], ["pago", "Pago"], ["atrasado", "Atrasado"], ["cancelado", "Cancelado"]]
              ).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>

          {/* Datas */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Competência Inicial</label>
              <input
                type="date"
                value={dataCompetencia}
                onChange={(e) => setDataCompetencia(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white outline-none focus:border-accent/60"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Vencimento Inicial *</label>
              <input
                type="date"
                value={dataVencimento}
                onChange={(e) => setDataVencimento(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white outline-none focus:border-accent/60"
              />
            </div>
          </div>

          {isLiquidado && (
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                Data de {tipoLancamento === "receita" ? "Recebimento" : "Pagamento"}
              </label>
              <input
                type="date"
                value={dataLiquidacao}
                onChange={(e) => setDataLiquidacao(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white outline-none focus:border-accent/60"
              />
            </div>
          )}

          {/* Observações */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Observações</label>
            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={2}
              placeholder="Notas internas..."
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white outline-none focus:border-accent/60 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-white/10 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-white/10 transition-all"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-xl bg-gradient-to-r from-[#fba834] to-[#f7931e] px-5 py-2 text-xs font-bold text-[#0d0d26] shadow-md shadow-[#fba834]/20 hover:brightness-110 transition-all disabled:opacity-50"
          >
            {saving ? "Salvando..." : editingItem ? "Atualizar" : "Criar Lançamento"}
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
  const [dateBasis, setDateBasis] = useState<"vencimento" | "competencia" | "liquidacao">("vencimento");

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
      const { data, error } = await supabase.from("receitas").select("*").order("data_vencimento", { ascending: false });
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
      const { data, error } = await supabase.from("despesas").select("*").order("data_vencimento", { ascending: false });
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
      extra: d.tipo === "parcelada" && d.parcela_atual && d.total_parcelas ? `${d.parcela_atual}/${d.total_parcelas}` : null,
      recorrente_grupo_id: d.recorrente_grupo_id,
      observacoes: d.observacoes,
      raw: d,
    }));

    return [...rs, ...ds].sort((a, b) => (b.data_vencimento || "").localeCompare(a.data_vencimento || ""));
  }, [receitas, despesas]);

  /* Contador de transações por mês no ano selecionado */
  const monthCounters = useMemo(() => {
    const counts: Record<number, number> = {};
    MESES.forEach((m) => { counts[m.idx] = 0; });

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
    MESES.forEach((m) => { map[m.abrev] = { Receitas: 0, Despesas: 0 }; });

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
        const { error } = await supabase.from("receitas").update({ status: "recebido", data_recebimento: today }).eq("receita_id", item.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("despesas").update({ status: "pago", data_pagamento: today }).eq("despesa_id", item.id);
        if (error) throw error;
      }
      toast.success(`"${item.descricao}" marcado como ${item.tipo_lancamento === "receita" ? "recebido" : "pago"}!`);
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
    if (filtered.length === 0) { toast.error("Nenhum dado para exportar com os filtros atuais."); return; }
    const headers = ["Tipo", "Descrição", "Categoria", "Valor", "Status", "Vencimento", "Competência", "Liquidação", "Cliente/Fornecedor", "Sub-tipo", "Observações"];
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
    const nomePeriodo = selectedMonth === "todos" ? `Ano_${selectedYear}` : `${MESES[selectedMonth as number].nome}_${selectedYear}`;
    a.download = `financeiro_omni_${nomePeriodo}_${todayISO()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success("CSV exportado com sucesso!");
  };

  const statusConfig: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
    recebido: { label: "Recebido", cls: "text-emerald-400 bg-emerald-500/15 border-emerald-500/30", icon: <CheckCircle2 className="size-3" /> },
    pago: { label: "Pago", cls: "text-emerald-400 bg-emerald-500/15 border-emerald-500/30", icon: <CheckCircle2 className="size-3" /> },
    pendente: { label: "Pendente", cls: "text-amber-400 bg-amber-500/15 border-amber-500/30", icon: <Clock className="size-3" /> },
    atrasado: { label: "Atrasado", cls: "text-red-400 bg-red-500/15 border-red-500/30", icon: <AlertCircle className="size-3" /> },
    cancelado: { label: "Cancelado", cls: "text-slate-400 bg-slate-500/15 border-slate-500/30", icon: <X className="size-3" /> },
  };

  const periodoTextoAtivo = useMemo(() => {
    if (selectedMonth === "todos" && selectedYear === "todos") return "Todo o Histórico Geral";
    if (selectedMonth === "todos") return `Ano Todo de ${selectedYear}`;
    if (selectedYear === "todos") return `Mês de ${MESES[selectedMonth as number].nome} (Todos os Anos)`;
    return `${MESES[selectedMonth as number].nome} de ${selectedYear}`;
  }, [selectedMonth, selectedYear]);

  return (
    <AppShell
      title="Financeiro Empresarial"
      subtitle={`Controle de receitas, despesas e fluxo de caixa · ${periodoTextoAtivo}`}
      actions={
        <div className="flex gap-2">
          <button
            type="button"
            onClick={exportCSV}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-secondary/80 px-3.5 py-2 text-xs font-bold text-foreground hover:bg-secondary hover:border-accent/40 transition-all"
          >
            <Download className="size-4 text-accent" /> Exportar CSV
          </button>
          <button
            type="button"
            onClick={() => { setEditingItem(null); setModalOpen(true); }}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#fba834] to-[#f7931e] px-4 py-2 text-xs font-bold text-[#0d0d26] shadow-md shadow-[#fba834]/20 hover:brightness-110 transition-all"
          >
            <Plus className="size-4" /> Novo Lançamento
          </button>
        </div>
      }
    >
      <div className="w-full space-y-6">

        {/* ══════ 1. NAVEGADOR E SELETOR COMPLETO DE MESES E ANOS ══════ */}
        <section className="rounded-2xl border border-border bg-card/90 p-4 backdrop-blur-2xl shadow-xl space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-3">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-accent">
                <Calendar className="size-4 text-accent" />
                Período Selecionado:
              </span>
              <span className="rounded-lg bg-accent/15 border border-accent/30 px-2.5 py-1 text-xs font-extrabold text-accent">
                {periodoTextoAtivo}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center rounded-xl border border-border bg-secondary/50 p-0.5">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  title="Mês Anterior"
                  className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedMonth(currentMonth);
                    setSelectedYear(currentYear);
                  }}
                  className="px-2.5 py-1 text-[11px] font-bold text-foreground hover:text-accent transition-colors"
                >
                  Hoje
                </button>
                <button
                  type="button"
                  onClick={handleNextMonth}
                  title="Próximo Mês"
                  className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase">Ano:</span>
                <select
                  value={selectedYear}
                  onChange={(e) => {
                    const v = e.target.value;
                    setSelectedYear(v === "todos" ? "todos" : Number(v));
                  }}
                  className="h-8 rounded-xl border border-input bg-background px-2.5 text-xs font-bold text-foreground outline-none focus:border-accent/60 cursor-pointer"
                >
                  {ANOS_DISPONIVEIS.map((ano) => (
                    <option key={ano} value={ano}>{ano}</option>
                  ))}
                  <option value="todos">Todos os Anos</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase">Base:</span>
                <select
                  value={dateBasis}
                  onChange={(e) => setDateBasis(e.target.value as any)}
                  className="h-8 rounded-xl border border-input bg-background px-2.5 text-xs font-bold text-foreground outline-none focus:border-accent/60 cursor-pointer"
                  title="Selecione qual data utilizar para o filtro mensal"
                >
                  <option value="vencimento">Data de Vencimento</option>
                  <option value="competencia">Data de Competência</option>
                  <option value="liquidacao">Data de Liquidação (Pago/Recebido)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 scrollbar-none">
            <button
              type="button"
              onClick={() => setSelectedMonth("todos")}
              className={cn(
                "rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all whitespace-nowrap shrink-0",
                selectedMonth === "todos"
                  ? "bg-gradient-to-r from-[#fba834] to-[#f7931e] text-[#0d0d26] shadow-md shadow-[#fba834]/25"
                  : "border border-border bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              Ano Todo ({selectedYear})
            </button>

            {MESES.map((m) => {
              const isSelected = selectedMonth === m.idx;
              const isThisCurrentMonth = m.idx === currentMonth && selectedYear === currentYear;
              const count = monthCounters[m.idx] || 0;

              return (
                <button
                  key={m.idx}
                  type="button"
                  onClick={() => setSelectedMonth(m.idx)}
                  className={cn(
                    "rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 shrink-0",
                    isSelected
                      ? "bg-gradient-to-r from-[#fba834] to-[#f7931e] text-[#0d0d26] shadow-md shadow-[#fba834]/25"
                      : "border border-border bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground hover:border-accent/30"
                  )}
                >
                  <span>{m.abrev}</span>
                  {isThisCurrentMonth && !isSelected && (
                    <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" title="Mês Atual" />
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* ══════ 2. CARDS DE KPIS DO MÊS SELECIONADO ══════ */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-emerald-500/20 bg-card/90 p-5 backdrop-blur-2xl shadow-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-500 flex items-center gap-1.5">
                <TrendingUp className="size-4" /> Receitas
              </span>
              <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500"><ArrowDownLeft className="size-4" /></span>
            </div>
            <p className="text-2xl font-extrabold text-foreground">{fmtCurrency(kpis.rRecebido)}</p>
            <p className="text-xs text-muted-foreground flex justify-between">
              <span className="text-emerald-500 font-semibold">↑ Recebidas</span>
              <span>{fmtCurrency(kpis.rPendente)} pendente</span>
            </p>
          </div>

          <div className="rounded-2xl border border-red-500/20 bg-card/90 p-5 backdrop-blur-2xl shadow-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-red-400 flex items-center gap-1.5">
                <TrendingDown className="size-4" /> Despesas
              </span>
              <span className="p-1.5 rounded-lg bg-red-500/10 text-red-400"><ArrowUpRight className="size-4" /></span>
            </div>
            <p className="text-2xl font-extrabold text-foreground">{fmtCurrency(kpis.dPago)}</p>
            <p className="text-xs text-muted-foreground flex justify-between">
              <span className="text-red-400 font-semibold">↑ Pagas</span>
              <span>{fmtCurrency(kpis.dPendente)} pendente</span>
            </p>
          </div>

          <div className="rounded-2xl border border-accent/30 bg-gradient-to-br from-card to-accent/10 p-5 backdrop-blur-2xl shadow-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-accent flex items-center gap-1.5">
                <Building2 className="size-4" /> Resultado
              </span>
              <span className="rounded-lg bg-accent/20 px-2 py-1 text-[10px] font-bold text-accent">{kpis.margem}% margem</span>
            </div>
            <p className={cn("text-2xl font-extrabold", kpis.saldo >= 0 ? "text-accent" : "text-red-400")}>
              {fmtCurrency(kpis.saldo)}
            </p>
            <p className="text-xs text-muted-foreground">
              Lucro de {periodoTextoAtivo}
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card/90 p-5 backdrop-blur-2xl shadow-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Clock className="size-4 text-accent" /> Pendências
              </span>
              <DollarSign className="size-5 text-accent/50" />
            </div>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-bold">A Receber</p>
                <p className="text-lg font-extrabold text-emerald-400">{fmtCurrency(kpis.rPendente)}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-muted-foreground uppercase font-bold">A Pagar</p>
                <p className="text-lg font-extrabold text-red-400">{fmtCurrency(kpis.dPendente)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* ══════ 3. BARRA DE BUSCA E FILTROS ADICIONAIS ══════ */}
        <div className="rounded-2xl border border-border bg-card/90 p-4 backdrop-blur-2xl shadow-xl flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por descrição, categoria, cliente ou fornecedor..."
              className="h-10 w-full rounded-xl border border-input bg-background pl-10 pr-3 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-accent/60"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={filterTipo}
              onChange={(e) => setFilterTipo(e.target.value as any)}
              className="h-10 rounded-xl border border-input bg-background px-3 text-xs font-semibold text-foreground outline-none focus:border-accent/60 cursor-pointer"
            >
              <option value="todos">Todos os Tipos (Receitas + Despesas)</option>
              <option value="receita">Apenas Receitas (+)</option>
              <option value="despesa">Apenas Despesas (-)</option>
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="h-10 rounded-xl border border-input bg-background px-3 text-xs font-semibold text-foreground outline-none focus:border-accent/60 cursor-pointer"
            >
              <option value="todos">Todos os Status</option>
              <option value="recebido">Recebidos</option>
              <option value="pago">Pagos</option>
              <option value="pendente">Pendentes</option>
              <option value="atrasado">Atrasados</option>
              <option value="cancelado">Cancelados</option>
            </select>
          </div>
        </div>

        {/* ══════ 4. GRÁFICO COMPARATIVO ANUAL ══════ */}
        <section className="rounded-2xl border border-border bg-card/90 p-6 backdrop-blur-2xl shadow-xl space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-sm font-extrabold text-foreground">
                Fluxo de Caixa Mensal ({selectedYear === "todos" ? currentYear : selectedYear})
              </h3>
              <p className="text-xs text-muted-foreground">
                Comparativo de receitas recebidas vs despesas pagas mês a mês
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs font-bold">
              <span className="flex items-center gap-1.5 text-emerald-400"><span className="size-2.5 rounded-full bg-emerald-500" /> Receitas (R$)</span>
              <span className="flex items-center gap-1.5 text-red-400"><span className="size-2.5 rounded-full bg-red-500" /> Despesas (R$)</span>
            </div>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ left: -10, right: 10, top: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="m" tickLine={false} axisLine={false} fontSize={11} stroke="#64748b" />
                <YAxis tickLine={false} axisLine={false} fontSize={11} stroke="#64748b" />
                <Tooltip
                  cursor={{ fill: "rgba(255,255,255,0.03)" }}
                  contentStyle={{ backgroundColor: "#12122d", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", fontSize: 12, color: "#fff" }}
                  formatter={(val: any) => fmtCurrency(Number(val))}
                />
                <Bar dataKey="Receitas" fill="#10b981" radius={[5, 5, 0, 0]} />
                <Bar dataKey="Despesas" fill="#f43f5e" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* ══════ 5. TABELA DE LANÇAMENTOS DO MÊS FILTRADO ══════ */}
        <section className="overflow-hidden rounded-2xl border border-border bg-card/90 backdrop-blur-2xl shadow-xl">
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <div>
              <h3 className="text-base font-extrabold text-foreground">
                Lançamentos · {periodoTextoAtivo} ({filtered.length})
              </h3>
              <p className="text-xs text-muted-foreground">
                Entradas e saídas filtradas por {dateBasis === "vencimento" ? "vencimento" : dateBasis === "competencia" ? "competência" : "data de liquidação"}
              </p>
            </div>
          </div>

          {/* Destaque inteligente se houver dados em outro ano para o mesmo mês */}
          {otherYearsWithData.length > 0 && (
            <div className="m-6 rounded-xl border border-accent/40 bg-accent/10 p-4 text-xs flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-foreground">
                <Sparkles className="size-4 text-accent shrink-0" />
                <span>
                  Existem lançamentos em <strong>{MESES[selectedMonth as number].nome}</strong> no ano de <strong>{otherYearsWithData.join(", ")}</strong>!
                </span>
              </div>
              <div className="flex gap-2">
                {otherYearsWithData.map((ano) => (
                  <button
                    key={ano}
                    type="button"
                    onClick={() => setSelectedYear(ano)}
                    className="rounded-lg bg-gradient-to-r from-[#fba834] to-[#f7931e] px-3.5 py-1.5 text-xs font-bold text-[#0d0d26] shadow-sm hover:brightness-110 transition-all"
                  >
                    Ver {MESES[selectedMonth as number].abrev}/{ano}
                  </button>
                ))}
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="py-16 text-center text-muted-foreground text-sm">Carregando lançamentos...</div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              <DollarSign className="size-10 mx-auto text-muted-foreground/30" />
              <p className="text-sm font-semibold text-muted-foreground">
                Nenhum lançamento encontrado em {periodoTextoAtivo}
              </p>
              <p className="text-xs text-muted-foreground/60">
                Selecione outro mês na barra superior ou clique em "+ Novo Lançamento" para cadastrar.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-secondary/40 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border">
                  <tr>
                    <th className="px-5 py-3.5">Vencimento</th>
                    <th className="px-5 py-3.5">Descrição</th>
                    <th className="px-5 py-3.5">Categoria</th>
                    <th className="px-5 py-3.5">Tipo</th>
                    <th className="px-5 py-3.5">Cliente/Fornecedor</th>
                    <th className="px-5 py-3.5 text-right">Valor</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {filtered.map((item) => {
                    const isReceita = item.tipo_lancamento === "receita";
                    const st = statusConfig[item.status] ?? statusConfig["pendente"];
                    const isLiquidado = item.status === "recebido" || item.status === "pago";
                    return (
                      <tr key={item.id} className="hover:bg-white/[0.02] transition-colors group">
                        <td className="px-5 py-3.5">
                          <span className="text-xs font-semibold text-foreground">{fmtDate(item.data_vencimento)}</span>
                          {item.data_liquidacao && (
                            <p className="text-[10px] text-muted-foreground">↳ liquidado {fmtDate(item.data_liquidacao)}</p>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <span className={cn("shrink-0 rounded-lg p-1.5", isReceita ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-400")}>
                              {isReceita ? <ArrowDownLeft className="size-3.5" /> : <ArrowUpRight className="size-3.5" />}
                            </span>
                            <span className="font-semibold text-foreground text-xs leading-snug max-w-[220px] truncate">{item.descricao}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="text-xs text-muted-foreground">{item.categoria}</span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={cn("inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] font-bold",
                            item.tipo_sub === "recorrente" ? "border-blue-500/30 bg-blue-500/10 text-blue-400" :
                            item.tipo_sub === "parcelada" ? "border-purple-500/30 bg-purple-500/10 text-purple-400" :
                            "border-slate-500/20 bg-slate-500/10 text-slate-400"
                          )}>
                            {item.tipo_sub === "recorrente" && <RefreshCw className="size-2.5" />}
                            {item.tipo_sub === "parcelada" && <Layers className="size-2.5" />}
                            {tipoLabel(item)}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="text-xs text-muted-foreground">{item.cliente_ou_fornecedor || "—"}</span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <span className={cn("text-sm font-extrabold", isReceita ? "text-emerald-400" : "text-red-400")}>
                            {isReceita ? "+" : "-"}{fmtCurrency(item.valor)}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={cn("inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] font-bold", st.cls)}>
                            {st.icon} {st.label}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {!isLiquidado && item.status !== "cancelado" && (
                              <button
                                type="button"
                                onClick={() => marcarLiquidado(item)}
                                title={isReceita ? "Marcar como Recebido" : "Marcar como Pago"}
                                className="rounded-lg p-1.5 text-emerald-400 hover:bg-emerald-500/15 transition-colors"
                              >
                                <CheckCircle2 className="size-4" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => { setEditingItem(item); setModalOpen(true); }}
                              className="rounded-lg p-1.5 text-muted-foreground hover:bg-white/10 transition-colors"
                            >
                              <Pencil className="size-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => excluir(item)}
                              className="rounded-lg p-1.5 text-red-400 hover:bg-red-500/15 transition-colors"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <ModalForm
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingItem(null); }}
        editingItem={editingItem}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ["receitas"] });
          queryClient.invalidateQueries({ queryKey: ["despesas"] });
        }}
      />
    </AppShell>
  );
}
