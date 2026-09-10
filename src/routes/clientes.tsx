import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";
import {
  Users,
  Search,
  Plus,
  Building2,
  Phone,
  Mail,
  DollarSign,
  TrendingUp,
  CreditCard,
  Edit2,
  Trash2,
  X,
  ExternalLink,
  Download,
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

/* Situação do contrato: cor sempre acompanhada de rótulo em texto. */
const STATUS_MAP: Record<Cliente["status"], { label: string; badge: string }> = {
  ativo: { label: "Ativo", badge: "omni-badge--success" },
  inadimplente: { label: "Inadimplente", badge: "omni-badge--danger" },
  pausado: { label: "Pausado", badge: "omni-badge--warning" },
  cancelado: { label: "Cancelado", badge: "omni-badge--outline" },
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
  const [nomeInvalido, setNomeInvalido] = useState(false);

  useMemo(() => {
    if (!open) return;
    setNomeInvalido(false);
    if (cliente) {
      setNome(cliente.nome || "");
      setEmpresa(cliente.empresa || "");
      setTelefone(cliente.telefone || "");
      setEmail(cliente.email || "");
      setDocumento(cliente.documento || "");
      setValorContrato(
        Number(cliente.valor_contrato || 0)
          .toFixed(2)
          .replace(".", ","),
      );
      setValorRecorrente(
        Number(cliente.valor_recorrente || 0)
          .toFixed(2)
          .replace(".", ","),
      );
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
    if (!nome.trim()) {
      setNomeInvalido(true);
      toast.error("Informe o nome do cliente!");
      return;
    }
    setNomeInvalido(false);
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
        const { error } = await supabase.from("clientes").insert([payload]);
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
    <div
      className="omni-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-modal-cliente"
    >
      <div className="omni-modal w-full max-w-[620px]">
        <div className="omni-modal__header">
          <div>
            <h2 id="titulo-modal-cliente" className="omni-h4">
              {cliente ? "Editar cliente" : "Novo cliente"}
            </h2>
            <p className="omni-small mt-1">Ficha cadastral e dados do contrato</p>
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
          <div className="omni-field">
            <label className="omni-label" htmlFor="cliente-nome">
              Nome do cliente ou contato <span className="omni-req">*</span>
            </label>
            <input
              id="cliente-nome"
              value={nome}
              onChange={(e) => {
                setNome(e.target.value);
                if (e.target.value.trim()) setNomeInvalido(false);
              }}
              aria-invalid={nomeInvalido || undefined}
              placeholder="Ex.: Dra. Livia / Grupo Auctus"
              className="omni-input"
            />
            {nomeInvalido && (
              <p className="omni-error">Digite o nome do cliente para poder salvar a ficha.</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="omni-field">
              <label className="omni-label" htmlFor="cliente-empresa">
                Empresa / razão social
              </label>
              <input
                id="cliente-empresa"
                value={empresa}
                onChange={(e) => setEmpresa(e.target.value)}
                placeholder="Ex.: Auctus Tecnologia Ltda"
                className="omni-input"
              />
            </div>
            <div className="omni-field">
              <label className="omni-label" htmlFor="cliente-segmento">
                Segmento
              </label>
              <input
                id="cliente-segmento"
                value={segmento}
                onChange={(e) => setSegmento(e.target.value)}
                placeholder="Ex.: Saúde, e-commerce, SaaS"
                className="omni-input"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="omni-field">
              <label className="omni-label" htmlFor="cliente-telefone">
                WhatsApp / telefone
              </label>
              <input
                id="cliente-telefone"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="Ex.: 5512999999999"
                className="omni-input"
              />
              <p className="omni-hint">Use DDI + DDD, sem espaços, para abrir a conversa direto.</p>
            </div>
            <div className="omni-field">
              <label className="omni-label" htmlFor="cliente-email">
                E-mail
              </label>
              <input
                id="cliente-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contato@cliente.com"
                className="omni-input"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="omni-field">
              <label className="omni-label" htmlFor="cliente-contrato">
                Valor do contrato (R$)
              </label>
              <input
                id="cliente-contrato"
                value={valorContrato}
                onChange={(e) => setValorContrato(e.target.value)}
                placeholder="0,00"
                className="omni-input num"
              />
            </div>
            <div className="omni-field">
              <label className="omni-label" htmlFor="cliente-mrr">
                Mensalidade (R$)
              </label>
              <input
                id="cliente-mrr"
                value={valorRecorrente}
                onChange={(e) => setValorRecorrente(e.target.value)}
                placeholder="0,00"
                className="omni-input num"
              />
            </div>
            <div className="omni-field">
              <label className="omni-label" htmlFor="cliente-vencimento">
                Dia do vencimento
              </label>
              <select
                id="cliente-vencimento"
                value={diaVencimento}
                onChange={(e) => setDiaVencimento(Number(e.target.value))}
                className="omni-select"
              >
                {[1, 5, 10, 15, 20, 25, 28, 30].map((d) => (
                  <option key={d} value={d}>
                    Todo dia {d}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="omni-field">
            <label className="omni-label" htmlFor="cliente-status">
              Situação do cliente
            </label>
            <select
              id="cliente-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="omni-select"
            >
              <option value="ativo">Ativo — em dia e operando</option>
              <option value="inadimplente">Inadimplente — fatura em atraso</option>
              <option value="pausado">Pausado — temporariamente suspenso</option>
              <option value="cancelado">Cancelado — contrato encerrado</option>
            </select>
          </div>

          <div className="omni-field">
            <label className="omni-label" htmlFor="cliente-obs">
              Observações internas
            </label>
            <textarea
              id="cliente-obs"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={3}
              placeholder="Escopo contratado, acessos, combinados com o cliente…"
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
            {cliente ? "Salvar alterações" : "Cadastrar cliente"}
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
    const mrr = clientes.reduce(
      (acc, c) => acc + (c.status === "ativo" ? Number(c.valor_recorrente || 0) : 0),
      0,
    );
    const totalContratos = clientes.reduce((acc, c) => acc + Number(c.valor_contrato || 0), 0);
    const ticketMedio = ativos > 0 ? mrr / ativos : 0;
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
    if (filtered.length === 0) {
      toast.error("Nenhum cliente para exportar.");
      return;
    }
    const headers = [
      "Nome",
      "Empresa",
      "Telefone",
      "Email",
      "Valor Contrato",
      "MRR (Mensalidade)",
      "Dia Vencimento",
      "Status",
      "Segmento",
      "Data Início",
    ];
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

  const temFiltro = search.trim().length > 0 || statusFilter !== "todos";

  return (
    <AppShell
      title="Carteira de clientes"
      subtitle="Contratos fechados, mensalidades e situação de cada cliente"
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
              setEditingCliente(null);
              setModalOpen(true);
            }}
            className="omni-btn omni-btn--primary omni-btn--sm"
          >
            <Plus /> Novo cliente
          </button>
        </div>
      }
    >
      <div className="omni-stack-6 w-full">
        {/* ══════ 1. Indicadores da carteira ══════ */}

        <section className="omni-grid omni-grid-4" aria-label="Indicadores da carteira">
          <div className="omni-card">
            <div className="omni-stat">
              <span className="omni-stat__label flex items-center gap-1.5">
                <UserCheck className="size-3.5" /> Clientes ativos
              </span>
              <p className="omni-stat__value">{kpis.ativos}</p>
              <p className="omni-stat__foot">
                <Users className="size-3.5" /> {kpis.total} no histórico total
              </p>
            </div>
          </div>

          <div className="omni-card">
            <div className="omni-stat">
              <span className="omni-stat__label flex items-center gap-1.5">
                <TrendingUp className="size-3.5" /> MRR da carteira
              </span>
              <p className="omni-stat__value">{fmtCurrency(kpis.mrr)}</p>
              <p className="omni-stat__foot">Receita mensal garantida por contrato</p>
            </div>
          </div>

          <div className="omni-card">
            <div className="omni-stat">
              <span className="omni-stat__label flex items-center gap-1.5">
                <FileText className="size-3.5" /> Total em contratos
              </span>
              <p className="omni-stat__value">{fmtCurrency(kpis.totalContratos)}</p>
              <p className="omni-stat__foot">
                <DollarSign className="size-3.5" /> Projetos e implantações fechadas
              </p>
            </div>
          </div>

          <div className="omni-card">
            <div className="omni-stat">
              <span className="omni-stat__label flex items-center gap-1.5">
                <CreditCard className="size-3.5" /> Ticket médio
              </span>
              <p className="omni-stat__value">{fmtCurrency(kpis.ticketMedio)}</p>
              <p className="omni-stat__foot">Mensalidade média por cliente ativo</p>
            </div>
          </div>
        </section>

        {/* ══════ 2. Busca e filtros ══════ */}

        <div className="omni-card">
          <div className="omni-card__body flex flex-wrap items-end gap-4 py-4">
            <div className="omni-field min-w-[240px] flex-1">
              <label className="omni-label" htmlFor="busca-cliente">
                Buscar cliente
              </label>
              <div className="omni-input-group">
                <Search />
                <input
                  id="busca-cliente"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Nome, empresa, telefone ou segmento"
                  className="omni-input"
                />
              </div>
            </div>

            <div className="omni-field w-full sm:w-56">
              <label className="omni-label" htmlFor="filtro-status">
                Situação
              </label>
              <select
                id="filtro-status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="omni-select"
              >
                <option value="todos">Todas as situações</option>
                <option value="ativo">Apenas ativos</option>
                <option value="inadimplente">Inadimplentes</option>
                <option value="pausado">Pausados</option>
                <option value="cancelado">Cancelados</option>
              </select>
            </div>
          </div>
        </div>

        {/* ══════ 3. Tabela de clientes ══════ */}

        <section className="omni-table-wrap">
          <div className="omni-card__header">
            <div>
              <h2 className="omni-h4">Clientes cadastrados</h2>
              <p className="omni-small mt-0.5">Vindos do funil comercial e de cadastro direto</p>
            </div>
          </div>

          <div className="omni-table-scroll">
            <table className="omni-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Contato</th>
                  <th className="omni-th-num">Contrato</th>
                  <th className="omni-th-num">Mensalidade</th>
                  <th className="omni-th-num">Vencimento</th>
                  <th>Situação</th>
                  <th>Origem</th>
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
                          <Users />
                        </span>
                        <h4>
                          {temFiltro
                            ? "Nenhum cliente com esses filtros"
                            : "Nenhum cliente cadastrado"}
                        </h4>
                        <p>
                          {temFiltro
                            ? "Limpe a busca ou escolha “Todas as situações” para ver a carteira inteira."
                            : "Cadastre um cliente aqui, ou marque um negócio como ganho no funil para ele entrar na carteira."}
                        </p>
                        {!temFiltro && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCliente(null);
                              setModalOpen(true);
                            }}
                            className="omni-btn omni-btn--secondary omni-btn--sm"
                          >
                            <Plus /> Cadastrar cliente
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((c) => {
                    const st = STATUS_MAP[c.status] || STATUS_MAP.ativo;
                    const cleanPhone = (c.telefone || "").replace(/\D/g, "");

                    return (
                      <tr key={c.cliente_id} className="group">
                        <td>
                          <div className="omni-user">
                            <span className="omni-avatar" aria-hidden="true">
                              {c.nome.substring(0, 2).toUpperCase()}
                            </span>
                            <div className="min-w-0">
                              <p className="omni-user__name truncate">{c.nome}</p>
                              {c.empresa && (
                                <p className="omni-user__meta flex items-center gap-1 truncate">
                                  <Building2 className="size-3" /> {c.empresa}
                                </p>
                              )}
                              {c.segmento && (
                                <span className="omni-badge omni-badge--outline mt-1">
                                  {c.segmento}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        <td>
                          {c.telefone ? (
                            <a
                              href={`https://wa.me/${cleanPhone}`}
                              target="_blank"
                              rel="noreferrer"
                              className="omni-link num inline-flex items-center gap-1.5"
                            >
                              <Phone className="size-3" />
                              {c.telefone}
                            </a>
                          ) : (
                            <span className="text-ink-faint">—</span>
                          )}
                          {c.email && (
                            <p className="omni-small mt-0.5 flex items-center gap-1 truncate">
                              <Mail className="size-3" /> {c.email}
                            </p>
                          )}
                        </td>

                        <td className="omni-td-num">{fmtCurrency(c.valor_contrato)}</td>

                        <td className="omni-td-num">
                          {Number(c.valor_recorrente) > 0 ? (
                            <span className="font-semibold">{fmtCurrency(c.valor_recorrente)}</span>
                          ) : (
                            <span className="text-ink-faint">—</span>
                          )}
                        </td>

                        <td className="omni-td-num">Dia {c.dia_vencimento || 5}</td>

                        <td>
                          <span className={cn("omni-badge", st.badge)}>{st.label}</span>
                        </td>

                        <td>
                          {c.lead_id ? (
                            <Link
                              to="/negocios"
                              className="omni-link inline-flex items-center gap-1"
                            >
                              <ExternalLink className="size-3" /> Funil
                            </Link>
                          ) : (
                            <span className="omni-small">Cadastro direto</span>
                          )}
                        </td>

                        <td className="omni-td-actions">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCliente(c);
                                setModalOpen(true);
                              }}
                              className="omni-btn omni-btn--ghost omni-btn--icon omni-btn--sm"
                              title={`Editar ${c.nome}`}
                            >
                              <Edit2 />
                              <span className="omni-sr">Editar {c.nome}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => excluirCliente(c)}
                              className="omni-btn omni-btn--ghost omni-btn--icon omni-btn--sm text-danger hover:bg-danger-soft"
                              title={`Excluir ${c.nome}`}
                            >
                              <Trash2 />
                              <span className="omni-sr">Excluir {c.nome}</span>
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
              {filtered.length} de {clientes.length}{" "}
              {clientes.length === 1 ? "cliente" : "clientes"}
            </span>
            {filtered.length > 0 && (
              <span className="num">
                Início do contrato mais recente: {fmtDate(filtered[0]?.data_inicio_contrato)}
              </span>
            )}
          </div>
        </section>
      </div>

      <ClienteModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingCliente(null);
        }}
        cliente={editingCliente}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ["clientes"] });
        }}
      />
    </AppShell>
  );
}
