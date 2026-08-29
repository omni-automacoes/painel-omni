import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";
import {
  Users,
  Search,
  Plus,
  Building2,
  Phone,
  Mail,
  Calendar,
  DollarSign,
  TrendingUp,
  CreditCard,
  Edit2,
  Trash2,
  X,
  ExternalLink,
  MessageCircle,
  Clock,
  Sparkles,
  Download,
  AlertCircle,
  FileText,
  UserCheck,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/clientes")({
  head: () => ({
    meta: [
      { title: "Clientes · Omni Automações" },
      { name: "description", content: "Gestão e carteira de clientes ativos da Omni Automações." },
    ],
  }),
  component: ClientesPage,
});

/* ─── Types ─── */
export interface Cliente {
  cliente_id: string;
  lead_id?: string | null;
  nome: string;
  empresa?: string | null;
  telefone?: string | null;
  email?: string | null;
  documento?: string | null;
  valor_contrato: number;
  valor_recorrente: number;
  dia_vencimento: number;
  status: "ativo" | "inadimplente" | "pausado" | "cancelado";
  segmento?: string | null;
  observacoes?: string | null;
  data_inicio_contrato?: string | null;
  criado_em: string;
  atualizado_em?: string | null;
}

/* ─── Helpers ─── */
const fmtCurrency = (val: number | string | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(val) || 0);

const fmtDate = (d?: string | null) => {
  if (!d) return "—";
  try {
    const parts = d.split("-");
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  } catch {}
  return d;
};

/* ─── Modal Form Component ─── */
interface ClienteModalProps {
  open: boolean;
  onClose: () => void;
  cliente?: Cliente | null;
  onSaved: () => void;
}

function ClienteModal({ open, onClose, cliente, onSaved }: ClienteModalProps) {
  const [nome, setNome] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [documento, setDocumento] = useState("");
  const [valorContrato, setValorContrato] = useState("0,00");
  const [valorRecorrente, setValorRecorrente] = useState("0,00");
  const [diaVencimento, setDiaVencimento] = useState<number>(5);
  const [status, setStatus] = useState<Cliente["status"]>("ativo");
  const [segmento, setSegmento] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [saving, setSaving] = useState(false);

  useMemo(() => {
    if (!open) return;
    if (cliente) {
      setNome(cliente.nome || "");
      setEmpresa(cliente.empresa || "");
      setTelefone(cliente.telefone || "");
      setEmail(cliente.email || "");
      setDocumento(cliente.documento || "");
      setValorContrato(Number(cliente.valor_contrato || 0).toFixed(2).replace(".", ","));
      setValorRecorrente(Number(cliente.valor_recorrente || 0).toFixed(2).replace(".", ","));
      setDiaVencimento(cliente.dia_vencimento || 5);
      setStatus(cliente.status || "ativo");
      setSegmento(cliente.segmento || "");
      setObservacoes(cliente.observacoes || "");
    } else {
      setNome("");
      setEmpresa("");
      setTelefone("");
      setEmail("");
      setDocumento("");
      setValorContrato("0,00");
      setValorRecorrente("0,00");
      setDiaVencimento(5);
      setStatus("ativo");
      setSegmento("");
      setObservacoes("");
    }
  }, [open, cliente]);

  const numVal = (str: string) => parseFloat(str.replace(/\./g, "").replace(",", ".")) || 0;

  const handleSave = async () => {
    if (!nome.trim()) { toast.error("Informe o nome do cliente!"); return; }
    setSaving(true);
    try {
      const payload: Partial<Cliente> = {
        nome: nome.trim(),
        empresa: empresa.trim() || null,
        telefone: telefone.trim() || null,
        email: email.trim() || null,
        documento: documento.trim() || null,
        valor_contrato: numVal(valorContrato),
        valor_recorrente: numVal(valorRecorrente),
        dia_vencimento: Number(diaVencimento) || 5,
        status,
        segmento: segmento.trim() || null,
        observacoes: observacoes.trim() || null,
      };

      if (cliente) {
        const { error } = await supabase
          .from("clientes")
          .update(payload)
          .eq("cliente_id", cliente.cliente_id);
        if (error) throw error;
        toast.success("Cliente atualizado com sucesso!");
      } else {
        const { error } = await supabase
          .from("clientes")
          .insert([payload]);
        if (error) throw error;
        toast.success("Cliente cadastrado com sucesso!");
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#12122d]/95 backdrop-blur-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div>
            <h2 className="text-base font-extrabold text-foreground">
              {cliente ? "Editar Cliente" : "Novo Cliente"}
            </h2>
            <p className="text-xs text-muted-foreground">
              Ficha cadastral e dados contratuais do cliente
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-muted-foreground hover:bg-white/10 transition-colors">
            <X className="size-4" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Nome do Cliente / Contato *</label>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Dra. Livia / Grupo Auctus"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white outline-none focus:border-accent/60"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Empresa / Razão Social</label>
              <input
                value={empresa}
                onChange={(e) => setEmpresa(e.target.value)}
                placeholder="Ex: Auctus Tecnologia Ltda"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white outline-none focus:border-accent/60"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Segmento / Nicho</label>
              <input
                value={segmento}
                onChange={(e) => setSegmento(e.target.value)}
                placeholder="Ex: Saúde / E-commerce / SaaS"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white outline-none focus:border-accent/60"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">WhatsApp / Telefone</label>
              <input
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="Ex: 5512999999999"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white outline-none focus:border-accent/60"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">E-mail</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contato@cliente.com"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white outline-none focus:border-accent/60"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Valor Contrato (R$)</label>
              <input
                value={valorContrato}
                onChange={(e) => setValorContrato(e.target.value)}
                placeholder="0,00"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white outline-none focus:border-accent/60"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Mensalidade (MRR)</label>
              <input
                value={valorRecorrente}
                onChange={(e) => setValorRecorrente(e.target.value)}
                placeholder="0,00"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white outline-none focus:border-accent/60"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Dia Vencimento</label>
              <select
                value={diaVencimento}
                onChange={(e) => setDiaVencimento(Number(e.target.value))}
                className="w-full rounded-xl border border-white/10 bg-[#12122d] px-3 py-2 text-xs text-white outline-none focus:border-accent/60 cursor-pointer"
              >
                {[1, 5, 10, 15, 20, 25, 28, 30].map((d) => (
                  <option key={d} value={d}>Todo dia {d}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Status do Cliente</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="w-full rounded-xl border border-white/10 bg-[#12122d] px-3 py-2 text-xs text-white outline-none focus:border-accent/60 cursor-pointer"
            >
              <option value="ativo">Ativo (Em dia / Operando)</option>
              <option value="inadimplente">Inadimplente (Fatura em atraso)</option>
              <option value="pausado">Pausado (Temporariamente suspenso)</option>
              <option value="cancelado">Cancelado (Contrato encerrado)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Observações / Notas Internas</label>
            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={3}
              placeholder="Detalhes dos serviços contratados, escopo, acessos..."
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white outline-none focus:border-accent/60 resize-none"
            />
          </div>
        </div>

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
            {saving ? "Salvando..." : cliente ? "Salvar Alterações" : "Cadastrar Cliente"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Component ─── */
function ClientesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);

  const { data: clientes = [], isLoading } = useQuery({
    queryKey: ["clientes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("*")
        .order("criado_em", { ascending: false });
      if (error) {
        console.error("Erro ao buscar clientes:", error);
        return [];
      }
      return (data || []) as Cliente[];
    },
    enabled: !!user,
  });

  /* KPIs */
  const kpis = useMemo(() => {
    const total = clientes.length;
    const ativos = clientes.filter((c) => c.status === "ativo").length;
    const mrr = clientes.reduce((acc, c) => acc + (c.status === "ativo" ? Number(c.valor_recorrente || 0) : 0), 0);
    const totalContratos = clientes.reduce((acc, c) => acc + Number(c.valor_contrato || 0), 0);
    const ticketMedio = ativos > 0 ? (mrr / ativos) : 0;
    return { total, ativos, mrr, totalContratos, ticketMedio };
  }, [clientes]);

  /* Filtro */
  const filtered = useMemo(() => {
    return clientes.filter((c) => {
      if (statusFilter !== "todos" && c.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const nome = (c.nome || "").toLowerCase();
        const emp = (c.empresa || "").toLowerCase();
        const tel = (c.telefone || "").toLowerCase();
        const seg = (c.segmento || "").toLowerCase();
        if (!nome.includes(q) && !emp.includes(q) && !tel.includes(q) && !seg.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [clientes, statusFilter, search]);

  const excluirCliente = async (c: Cliente) => {
    if (!confirm(`Tem certeza que deseja excluir o cliente "${c.nome}"?`)) return;
    try {
      const { error } = await supabase.from("clientes").delete().eq("cliente_id", c.cliente_id);
      if (error) throw error;
      toast.success("Cliente removido com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
    } catch (e: any) {
      toast.error("Erro ao excluir: " + (e?.message || String(e)));
    }
  };

  const exportCSV = () => {
    if (filtered.length === 0) { toast.error("Nenhum cliente para exportar."); return; }
    const headers = ["Nome", "Empresa", "Telefone", "Email", "Valor Contrato", "MRR (Mensalidade)", "Dia Vencimento", "Status", "Segmento", "Data Início"];
    const rows = filtered.map((c) => [
      `"${(c.nome || "").replace(/"/g, '""')}"`,
      `"${(c.empresa || "").replace(/"/g, '""')}"`,
      c.telefone ?? "",
      c.email ?? "",
      Number(c.valor_contrato || 0).toFixed(2),
      Number(c.valor_recorrente || 0).toFixed(2),
      c.dia_vencimento || 5,
      c.status,
      `"${(c.segmento || "").replace(/"/g, '""')}"`,
      c.data_inicio_contrato ?? "",
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clientes_omni_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success("CSV exportado com sucesso!");
  };

  const statusMap: Record<string, { label: string; cls: string }> = {
    ativo: { label: "Ativo", cls: "text-emerald-400 bg-emerald-500/15 border-emerald-500/30" },
    inadimplente: { label: "Inadimplente", cls: "text-red-400 bg-red-500/15 border-red-500/30" },
    pausado: { label: "Pausado", cls: "text-amber-400 bg-amber-500/15 border-amber-500/30" },
    cancelado: { label: "Cancelado", cls: "text-slate-400 bg-slate-500/15 border-slate-500/30" },
  };

  return (
    <AppShell
      title="Carteira de Clientes"
      subtitle="Gestão de clientes fechados, contratos e recorrência ativa (MRR)"
      actions={
        <div className="flex gap-2">
          <button
            type="button"
            onClick={exportCSV}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-secondary/80 px-3.5 py-2 text-xs font-bold text-foreground hover:bg-secondary hover:border-accent/40 transition-all"
          >
            <Download className="size-4 text-accent" /> Exportar
          </button>
          <button
            type="button"
            onClick={() => { setEditingCliente(null); setModalOpen(true); }}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#fba834] to-[#f7931e] px-4 py-2 text-xs font-bold text-[#0d0d26] shadow-md shadow-[#fba834]/20 hover:brightness-110 transition-all"
          >
            <Plus className="size-4" /> Novo Cliente
          </button>
        </div>
      }
    >
      <div className="w-full space-y-6">

        {/* ══════ 1. CARDS DE KPIS DA CARTEIRA ══════ */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-emerald-500/20 bg-card/90 p-5 backdrop-blur-2xl shadow-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <UserCheck className="size-4" /> Clientes Ativos
              </span>
              <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400"><Users className="size-4" /></span>
            </div>
            <p className="text-2xl font-extrabold text-foreground">{kpis.ativos}</p>
            <p className="text-xs text-muted-foreground">
              {kpis.total} clientes no histórico total
            </p>
          </div>

          <div className="rounded-2xl border border-accent/30 bg-gradient-to-br from-card to-accent/10 p-5 backdrop-blur-2xl shadow-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-accent flex items-center gap-1.5">
                <TrendingUp className="size-4" /> MRR (Recorrência)
              </span>
              <span className="rounded-lg bg-accent/20 px-2 py-1 text-[10px] font-bold text-accent">Mensal</span>
            </div>
            <p className="text-2xl font-extrabold text-accent">{fmtCurrency(kpis.mrr)}</p>
            <p className="text-xs text-muted-foreground">
              Receita mensal garantida por contratos
            </p>
          </div>

          <div className="rounded-2xl border border-blue-500/20 bg-card/90 p-5 backdrop-blur-2xl shadow-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                <FileText className="size-4" /> Total em Contratos
              </span>
              <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400"><DollarSign className="size-4" /></span>
            </div>
            <p className="text-2xl font-extrabold text-foreground">{fmtCurrency(kpis.totalContratos)}</p>
            <p className="text-xs text-muted-foreground">
              Soma de projetos e setups fechados
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card/90 p-5 backdrop-blur-2xl shadow-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <CreditCard className="size-4 text-accent" /> Ticket Médio MRR
              </span>
              <span className="p-1.5 rounded-lg bg-white/5 text-muted-foreground"><Clock className="size-4" /></span>
            </div>
            <p className="text-2xl font-extrabold text-foreground">{fmtCurrency(kpis.ticketMedio)}</p>
            <p className="text-xs text-muted-foreground">
              Média por cliente ativo
            </p>
          </div>
        </div>

        {/* ══════ 2. BARRA DE BUSCA E FILTROS ══════ */}
        <div className="rounded-2xl border border-border bg-card/90 p-4 backdrop-blur-2xl shadow-xl flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por cliente, empresa, telefone ou segmento..."
              className="h-10 w-full rounded-xl border border-input bg-background pl-10 pr-3 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-accent/60"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 rounded-xl border border-input bg-background px-3 text-xs font-semibold text-foreground outline-none focus:border-accent/60 cursor-pointer"
            >
              <option value="todos">Todos os Status</option>
              <option value="ativo">Apenas Ativos</option>
              <option value="inadimplente">Inadimplentes</option>
              <option value="pausado">Pausados</option>
              <option value="cancelado">Cancelados</option>
            </select>
          </div>
        </div>

        {/* ══════ 3. TABELA DE CLIENTES ══════ */}
        <section className="overflow-hidden rounded-2xl border border-border bg-card/90 backdrop-blur-2xl shadow-xl">
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <div>
              <h3 className="text-base font-extrabold text-foreground">
                Clientes Cadastrados ({filtered.length})
              </h3>
              <p className="text-xs text-muted-foreground">
                Lista consolidada de clientes vindos do CRM e contratos diretos
              </p>
            </div>
          </div>

          {isLoading ? (
            <div className="py-16 text-center text-muted-foreground text-sm">Carregando carteira de clientes...</div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              <Users className="size-10 mx-auto text-muted-foreground/30" />
              <p className="text-sm font-semibold text-muted-foreground">Nenhum cliente encontrado com os filtros atuais</p>
              <p className="text-xs text-muted-foreground/60">
                Quando um Lead for marcado como "Ganho" no quadro de Negócios, ele virará um cliente automaticamente!
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-secondary/40 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border">
                  <tr>
                    <th className="px-5 py-3.5">Cliente</th>
                    <th className="px-5 py-3.5">Contato</th>
                    <th className="px-5 py-3.5">Contrato Inicial</th>
                    <th className="px-5 py-3.5">Recorrência (MRR)</th>
                    <th className="px-5 py-3.5">Dia Venc.</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5">Origem CRM</th>
                    <th className="px-5 py-3.5 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {filtered.map((c) => {
                    const st = statusMap[c.status] || statusMap["ativo"];
                    const cleanPhone = (c.telefone || "").replace(/\D/g, "");
                    const isAtivo = c.status === "ativo";

                    return (
                      <tr key={c.cliente_id} className="hover:bg-white/[0.02] transition-colors group">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent/15 text-accent font-extrabold text-xs">
                              {c.nome.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-semibold text-foreground text-xs leading-snug">{c.nome}</p>
                              {c.empresa && (
                                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                                  <Building2 className="size-3" /> {c.empresa}
                                </p>
                              )}
                              {c.segmento && (
                                <span className="inline-block mt-0.5 rounded px-1.5 py-0.2 text-[10px] font-semibold bg-white/5 text-muted-foreground">
                                  {c.segmento}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-3.5">
                          {c.telefone ? (
                            <a
                              href={`https://wa.me/${cleanPhone}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs text-foreground hover:text-accent font-medium transition-colors"
                            >
                              <Phone className="size-3 text-emerald-400" />
                              {c.telefone}
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                          {c.email && (
                            <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                              <Mail className="size-3" /> {c.email}
                            </p>
                          )}
                        </td>

                        <td className="px-5 py-3.5">
                          <span className="text-xs font-bold text-foreground">
                            {fmtCurrency(c.valor_contrato)}
                          </span>
                        </td>

                        <td className="px-5 py-3.5">
                          <span className={cn("text-xs font-extrabold", Number(c.valor_recorrente) > 0 ? "text-accent" : "text-muted-foreground")}>
                            {fmtCurrency(c.valor_recorrente)}
                          </span>
                        </td>

                        <td className="px-5 py-3.5">
                          <span className="text-xs font-semibold text-muted-foreground">
                            Todo dia {c.dia_vencimento || 5}
                          </span>
                        </td>

                        <td className="px-5 py-3.5">
                          <span className={cn("inline-flex items-center gap-1 rounded-lg border px-2.5 py-0.5 text-[10px] font-bold", st.cls)}>
                            {isAtivo && <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />}
                            {st.label}
                          </span>
                        </td>

                        <td className="px-5 py-3.5">
                          {c.lead_id ? (
                            <Link
                              to="/negocios"
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent hover:underline"
                            >
                              <ExternalLink className="size-3" /> Ver no Funil
                            </Link>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">Cadastro Direto</span>
                          )}
                        </td>

                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() => { setEditingCliente(c); setModalOpen(true); }}
                              className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
                              title="Editar Cliente"
                            >
                              <Edit2 className="size-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => excluirCliente(c)}
                              className="rounded-lg p-1.5 text-red-400 hover:bg-red-500/15 transition-colors"
                              title="Excluir Cliente"
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

      <ClienteModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingCliente(null); }}
        cliente={editingCliente}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ["clientes"] });
        }}
      />
    </AppShell>
  );
}
