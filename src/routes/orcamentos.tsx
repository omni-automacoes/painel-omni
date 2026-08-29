import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";
import {
  Send,
  Sparkles,
  Bot,
  Calculator,
  History,
  FileText,
  Clock,
  DollarSign,
  HelpCircle,
  Cpu,
  Layers,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Copy,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Zap,
  ArrowRight,
  ShieldCheck,
  Star,
  Rocket,
  Check,
  MessageSquare,
  Search,
  UserPlus,
  UserCheck,
  ExternalLink,
  X,
  Link2,
  Unlink,
  Filter,
  Percent,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/orcamentos")({
  head: () => ({
    meta: [
      { title: "Orçamentos · Omni Automações" },
      {
        name: "description",
        content: "Gerador inteligente de orçamentos com IA, cálculo de cenários e propostas comerciais.",
      },
    ],
  }),
  component: OrcamentosPage,
});

const WEBHOOK_ORCAMENTOS = "https://n8n.omniautomacoes.com.br/webhook/731580fd-2c8f-4f9d-a16a-b35acd060e89";

/* ─── Interfaces ─── */
type CenarioOrcamento = {
  descricao: string;
  stack_utilizada?: string[];
  horas_estimadas?: number;
  setup?: number;
  mensalidade?: number;
};

type OpcoesOrcamento = {
  minimo?: CenarioOrcamento;
  ideal?: CenarioOrcamento;
  maximo?: CenarioOrcamento;
};

type LeadMinimal = {
  lead_id: string;
  lead_nome: string;
  lead_telefone?: string | null;
  lead_email?: string | null;
  lead_etapa_funil?: string | null;
  lead_valor?: number | null;
};

type OrcamentoRecord = {
  orcamento_id?: number | string;
  criado_em?: string;
  solicitacao_original: string;
  raciocinio_tecnico?: string;
  opcoes_orcamento?: OpcoesOrcamento;
  perguntas_comerciais?: string[];
  responsavel?: string;
  lead_id?: string | null;
  leads?: LeadMinimal | null;
  margem_lucro?: number | null;
};

function formatCurrency(val: number | string | null | undefined): string {
  if (val === null || val === undefined || val === "") return "R$ 0,00";
  const num = typeof val === "number" ? val : parseFloat(String(val));
  if (isNaN(num)) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(num);
}

function formatDate(dateStr?: string | null) {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return dateStr;
  }
}

function OrcamentosPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [promptText, setPromptText] = useState("");
  const [margemLucro, setMargemLucro] = useState<number | "">("");
  const [selectedLeadIdForNew, setSelectedLeadIdForNew] = useState<string>("");
  const [activeOrcamento, setActiveOrcamento] = useState<OrcamentoRecord | null>(null);
  
  /* Modal de Confirmação antes de Enviar */
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  /* Filtros do Histórico */
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"todos" | "sem_lead" | "com_lead">("todos");
  const [copied, setCopied] = useState(false);

  /* Modal de Atribuição de Lead */
  const [modalAssignOrcamento, setModalAssignOrcamento] = useState<OrcamentoRecord | null>(null);
  const [leadModalSearch, setLeadModalSearch] = useState("");

  /* Estado do Timer de Carregamento */
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  /* 1. Fetch Leads para o Seletor */
  const { data: leads = [] } = useQuery<LeadMinimal[]>({
    queryKey: ["leads_list_min"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("lead_id, lead_nome, lead_telefone, lead_email, lead_etapa_funil, lead_valor")
        .order("criado_em", { ascending: false });

      if (error) throw error;
      return (data || []) as LeadMinimal[];
    },
    enabled: !!user,
  });

  /* 2. Fetch Histórico de Orçamentos do Supabase com Join de Leads */
  const { data: orcamentos = [], isLoading: isLoadingHistory, isRefetching } = useQuery<OrcamentoRecord[]>({
    queryKey: ["orcamentos_list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orcamentos")
        .select("*, leads (lead_id, lead_nome, lead_telefone, lead_email, lead_etapa_funil, lead_valor)")
        .order("criado_em", { ascending: false });

      if (error) throw error;
      return (data || []) as OrcamentoRecord[];
    },
    enabled: !!user,
  });

  /* 3. Mutation para Atribuir ou Desvincular Lead */
  const assignLeadMutation = useMutation({
    mutationFn: async ({ orcamentoId, leadId }: { orcamentoId: number | string; leadId: string | null }) => {
      const { error } = await supabase
        .from("orcamentos")
        .update({ lead_id: leadId })
        .eq("orcamento_id", orcamentoId);

      if (error) throw error;
      return { orcamentoId, leadId };
    },
    onSuccess: ({ orcamentoId, leadId }) => {
      queryClient.invalidateQueries({ queryKey: ["orcamentos_list"] });

      if (activeOrcamento && String(activeOrcamento.orcamento_id) === String(orcamentoId)) {
        const foundLead = leads.find((l) => l.lead_id === leadId) || null;
        setActiveOrcamento((prev) => (prev ? { ...prev, lead_id: leadId, leads: foundLead } : null));
      }

      setModalAssignOrcamento(null);
      setLeadModalSearch("");

      if (leadId) {
        const foundLead = leads.find((l) => l.lead_id === leadId);
        toast.success(`Orçamento vinculado ao lead ${foundLead?.lead_nome || ""} com sucesso!`);
      } else {
        toast.info("Vínculo com o lead removido.");
      }
    },
    onError: (err: any) => {
      toast.error("Erro ao atribuir lead: " + err.message);
    },
  });

  /* 4. Mutation para Enviar ao Webhook e Aguardar Resposta */
  const sendOrcamentoMutation = useMutation({
    mutationFn: async (texto: string) => {
      const payload = {
        user_id: user?.id,
        user_nome: user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split("@")[0] || "Usuário Omni",
        user_email: user?.email,
        solicitacao: texto.trim(),
        margem_lucro: Number(margemLucro),
        lead_id: selectedLeadIdForNew || null,
        timestamp: new Date().toISOString(),
      };

      const response = await fetch(WEBHOOK_ORCAMENTOS, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`O webhook retornou status ${response.status}. Verifique a automação no n8n.`);
      }

      // Processar a resposta do Webhook
      const responseData = await response.json();
      return { responseData, solicitacaoOriginal: texto.trim(), leadId: selectedLeadIdForNew || null, margem: Number(margemLucro) };
    },
    onMutate: () => {
      // Iniciar timer de espera
      setElapsedSeconds(0);
      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    },
    onSuccess: async ({ responseData, solicitacaoOriginal, leadId, margem }) => {
      if (timerRef.current) clearInterval(timerRef.current);

      // Normalizar resposta (se vier como array ou objeto)
      let parsed = responseData;
      if (Array.isArray(responseData) && responseData.length > 0) {
        parsed = responseData[0];
      }

      const raciocinio_tecnico = parsed.raciocinio_tecnico || "";
      const opcoes_orcamento = parsed.orcamento || parsed.opcoes_orcamento || {};
      const perguntas_comerciais = Array.isArray(parsed.perguntas_comerciais)
        ? parsed.perguntas_comerciais
        : [];

      const matchedLead = leads.find((l) => l.lead_id === leadId) || null;

      const newRecord: OrcamentoRecord = {
        solicitacao_original: solicitacaoOriginal,
        raciocinio_tecnico,
        opcoes_orcamento,
        perguntas_comerciais,
        responsavel: user?.id,
        lead_id: leadId,
        leads: matchedLead,
        margem_lucro: margem,
        criado_em: new Date().toISOString(),
      };

      // Salvar no Supabase se o n8n não salvou automaticamente
      try {
        const { data: inserted, error: insertErr } = await supabase
          .from("orcamentos")
          .insert({
            solicitacao_original: newRecord.solicitacao_original,
            raciocinio_tecnico: newRecord.raciocinio_tecnico,
            opcoes_orcamento: newRecord.opcoes_orcamento,
            perguntas_comerciais: newRecord.perguntas_comerciais,
            responsavel: newRecord.responsavel,
            lead_id: newRecord.lead_id,
            margem_lucro: newRecord.margem_lucro,
          })
          .select("*, leads (lead_id, lead_nome, lead_telefone, lead_email, lead_etapa_funil, lead_valor)")
          .single();

        if (!insertErr && inserted) {
          newRecord.orcamento_id = inserted.orcamento_id;
          newRecord.leads = inserted.leads;
        }
      } catch (err) {
        console.warn("Aviso ao persistir no Supabase:", err);
      }

      setActiveOrcamento(newRecord);
      setPromptText("");
      setMargemLucro("");
      setSelectedLeadIdForNew("");
      queryClient.invalidateQueries({ queryKey: ["orcamentos_list"] });

      toast.success("Orçamento gerado com sucesso!", {
        description: "A análise técnica e os 3 cenários comerciais estão prontos.",
      });
    },
    onError: (err: any) => {
      if (timerRef.current) clearInterval(timerRef.current);
      toast.error("Erro ao gerar orçamento: " + (err.message || "Tente novamente"));
    },
  });

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  /* Validação pré-envio para abrir o modal de confirmação */
  const handlePreSend = () => {
    if (!promptText.trim()) {
      toast.warning("Por favor, descreva o projeto antes de enviar.");
      return;
    }

    if (
      margemLucro === "" ||
      isNaN(Number(margemLucro)) ||
      Number(margemLucro) < 0 ||
      Number(margemLucro) > 100
    ) {
      toast.warning("Por favor, especifique a margem de lucro entre 0% e 100% antes de prosseguir.");
      return;
    }

    setShowConfirmModal(true);
  };

  const handleConfirmAndSend = () => {
    setShowConfirmModal(false);
    sendOrcamentoMutation.mutate(promptText);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handlePreSend();
    }
  };

  /* Mensagem dinâmica de progresso com base no tempo decorrido */
  const getProgressStatus = (seconds: number) => {
    if (seconds < 18) {
      return {
        title: "Interpretando escopo e requisitos...",
        desc: "O modelo de IA está mapeando os fluxos, canais e integrações necessárias.",
        percent: Math.min(Math.round((seconds / 90) * 100), 25),
      };
    }
    if (seconds < 40) {
      return {
        title: "Dimensionando arquitetura técnica...",
        desc: "Avaliando custos de APIs, ferramentas (n8n, Supabase, WhatsApp) e volumetria.",
        percent: Math.min(Math.round((seconds / 90) * 100), 55),
      };
    }
    if (seconds < 70) {
      return {
        title: "Calculando cenários Mínimo, Ideal e Máximo...",
        desc: "Estimando horas de desenvolvimento, setup e custos com base na margem de lucro.",
        percent: Math.min(Math.round((seconds / 90) * 100), 80),
      };
    }
    return {
      title: "Formatando proposta e perguntas comerciais...",
      desc: "Finalizando o parecer técnico e preparando as perguntas estratégicas.",
      percent: Math.min(Math.round((seconds / 90) * 100), 98),
    };
  };

  /* Formatar texto para cópia */
  const copyFormattedProposal = (orc: OrcamentoRecord) => {
    const min = orc.opcoes_orcamento?.minimo;
    const ideal = orc.opcoes_orcamento?.ideal;
    const max = orc.opcoes_orcamento?.maximo;

    let text = `*PROPOSTA TÉCNICA E COMERCIAL · OMNI AUTOMAÇÕES*\n\n`;
    if (orc.leads?.lead_nome) {
      text += `*Cliente / Lead:* ${orc.leads.lead_nome}\n`;
    }
    if (orc.margem_lucro !== null && orc.margem_lucro !== undefined) {
      text += `*Margem de Lucro Aplicada:* ${orc.margem_lucro}%\n`;
    }
    text += `*Projeto:* ${orc.solicitacao_original}\n\n`;
    
    if (orc.raciocinio_tecnico) {
      text += `*Raciocínio Técnico:*\n${orc.raciocinio_tecnico}\n\n`;
    }

    text += `*══════ CENÁRIOS DE ORÇAMENTO ══════*\n\n`;

    if (min) {
      text += `*1. CENÁRIO MÍNIMO (MVP)*\n`;
      text += `• Setup: ${formatCurrency(min.setup)}\n`;
      text += `• Mensalidade: ${formatCurrency(min.mensalidade)}/mês\n`;
      text += `• Horas estimadas: ${min.horas_estimadas || "-"}h\n`;
      text += `• Escopo: ${min.descricao}\n\n`;
    }

    if (ideal) {
      text += `*2. CENÁRIO IDEAL (RECOMENDADO ⭐)*\n`;
      text += `• Setup: ${formatCurrency(ideal.setup)}\n`;
      text += `• Mensalidade: ${formatCurrency(ideal.mensalidade)}/mês\n`;
      text += `• Horas estimadas: ${ideal.horas_estimadas || "-"}h\n`;
      text += `• Escopo: ${ideal.descricao}\n\n`;
    }

    if (max) {
      text += `*3. CENÁRIO MÁXIMO (ENTERPRISE 🚀)*\n`;
      text += `• Setup: ${formatCurrency(max.setup)}\n`;
      text += `• Mensalidade: ${formatCurrency(max.mensalidade)}/mês\n`;
      text += `• Horas estimadas: ${max.horas_estimadas || "-"}h\n`;
      text += `• Escopo: ${max.descricao}\n\n`;
    }

    if (orc.perguntas_comerciais && orc.perguntas_comerciais.length > 0) {
      text += `*Perguntas de Alinhamento:*\n`;
      orc.perguntas_comerciais.forEach((p, idx) => {
        text += `${idx + 1}. ${p}\n`;
      });
    }

    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Proposta comercial formatada copiada com sucesso!");
    setTimeout(() => setCopied(false), 2500);
  };

  /* Contadores de Orçamentos */
  const { unassignedCount, assignedCount } = useMemo(() => {
    let unassigned = 0;
    let assigned = 0;
    orcamentos.forEach((o) => {
      if (!o.lead_id) unassigned++;
      else assigned++;
    });
    return { unassignedCount: unassigned, assignedCount: assigned };
  }, [orcamentos]);

  /* Filtragem no Histórico */
  const filteredHistory = useMemo(() => {
    return orcamentos.filter((o) => {
      if (statusFilter === "sem_lead" && o.lead_id) return false;
      if (statusFilter === "com_lead" && !o.lead_id) return false;

      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      return (
        o.solicitacao_original?.toLowerCase().includes(term) ||
        o.raciocinio_tecnico?.toLowerCase().includes(term) ||
        o.leads?.lead_nome?.toLowerCase().includes(term)
      );
    });
  }, [orcamentos, statusFilter, searchTerm]);

  /* Leads filtrados no modal de atribuição */
  const filteredLeadsForModal = useMemo(() => {
    if (!leadModalSearch.trim()) return leads;
    const term = leadModalSearch.toLowerCase();
    return leads.filter(
      (l) =>
        l.lead_nome?.toLowerCase().includes(term) ||
        l.lead_telefone?.toLowerCase().includes(term) ||
        l.lead_email?.toLowerCase().includes(term)
    );
  }, [leads, leadModalSearch]);

  const promptSuggestions = [
    "Automação de WhatsApp para imobiliária com agendamento de visitas no Google Calendar e qualificação de leads com IA.",
    "Integração de CRM com Nuvemshop e emissão de notas fiscais automáticas no Tiny ERP.",
    "Disparo em massa de mensagens com cupons de desconto para base de leads e dashboard visual de conversão e lucro.",
  ];

  const currentLoadingStatus = getProgressStatus(elapsedSeconds);
  const selectedLeadObject = leads.find((l) => l.lead_id === selectedLeadIdForNew);

  return (
    <AppShell
      title="Gerador de Orçamentos IA"
      subtitle="Dimensionamento técnico, esforço em horas e precificação em 3 cenários automáticos"
      actions={
        <div className="flex items-center gap-2">
          {unassignedCount > 0 && (
            <button
              type="button"
              onClick={() => setStatusFilter("sem_lead")}
              className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/15 px-3 py-2 text-xs font-extrabold text-amber-400 hover:bg-amber-500/25 transition-all animate-pulse"
            >
              <AlertTriangle className="size-3.5" />
              {unassignedCount} {unassignedCount === 1 ? "orçamento sem lead" : "orçamentos sem lead"}
            </button>
          )}

          <button
            type="button"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["orcamentos_list"] })}
            disabled={isRefetching}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-secondary/60 px-3.5 py-2 text-xs font-bold text-foreground hover:bg-secondary transition-all"
            title="Atualizar lista"
          >
            <RefreshCw className={cn("size-3.5", isRefetching && "animate-spin text-accent")} />
            Atualizar
          </button>
        </div>
      }
    >
      <div className="w-full space-y-8 pb-16">
        
        {/* ══════ 1. SESSÃO DO INPUT DE CHAT (PROMPT DO PROJETO) ══════ */}
        <section className="relative overflow-hidden rounded-2xl border border-accent/40 bg-gradient-to-br from-[#12122d]/95 via-[#161638]/90 to-[#0d0d26]/95 p-6 backdrop-blur-2xl shadow-2xl space-y-4">
          {/* Ambient Glow */}
          <div className="pointer-events-none absolute -right-20 -top-20 size-72 rounded-full bg-[#fba834]/15 blur-3xl" />

          <div className="flex flex-wrap items-center justify-between gap-4 relative z-10">
            <div className="flex items-center gap-2.5">
              <span className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-[#fba834] to-[#f7931e] text-[#0d0d26] shadow-md shadow-[#fba834]/20 font-black">
                <Sparkles className="size-5" />
              </span>
              <div>
                <h2 className="text-base font-extrabold text-foreground">Solicitar Novo Orçamento com IA</h2>
                <p className="text-xs text-muted-foreground">
                  Descreva o projeto, especifique a margem de lucro e selecione o lead para gerar os 3 cenários.
                </p>
              </div>
            </div>

            {/* Seletor Opcional de Lead no Envio */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1">
                <UserCheck className="size-3.5 text-accent" /> Vincular a Lead:
              </span>
              <select
                value={selectedLeadIdForNew}
                onChange={(e) => setSelectedLeadIdForNew(e.target.value)}
                className="rounded-xl border border-white/10 bg-[#12122d] px-3 py-1.5 text-xs text-foreground outline-none focus:border-accent/60 font-semibold cursor-pointer max-w-[200px] truncate"
                disabled={sendOrcamentoMutation.isPending}
              >
                <option value="">Nenhum (Atribuir depois)</option>
                {leads.map((l) => (
                  <option key={l.lead_id} value={l.lead_id}>
                    {l.lead_nome || l.lead_telefone || "Sem nome"} {l.lead_etapa_funil ? `(${l.lead_etapa_funil})` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Área de Texto do Chat */}
          <div className="relative z-10 space-y-3">
            <div className={cn(
              "relative rounded-2xl border bg-white/5 p-3.5 transition-all space-y-3",
              sendOrcamentoMutation.isPending ? "border-amber-500/50 opacity-60 pointer-events-none" : "border-white/10 focus-within:border-accent/70"
            )}>
              {/* Campo de Texto da Solicitação */}
              <textarea
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={4}
                placeholder="Descreva detalhadamente o projeto... Ex: 'Preciso de um fluxo no n8n para disparo em massa de cupons para 3.000 leads via WhatsApp e um dashboard com métricas de conversão e lucro...'"
                className="w-full bg-transparent px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/60 outline-none resize-none font-medium leading-relaxed"
                disabled={sendOrcamentoMutation.isPending}
              />

              {/* ══════ CAMPO OBRIGATÓRIO DE MARGEM DE LUCRO (0% A 100%) ══════ */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-3">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                    <Percent className="size-3.5 text-accent" />
                    <span>Margem de Lucro:</span>
                    <span className="text-red-400 font-black">*</span>
                  </div>

                  <div className="relative flex items-center">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={margemLucro}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "") {
                          setMargemLucro("");
                        } else {
                          const num = Math.min(100, Math.max(0, Number(val)));
                          setMargemLucro(num);
                        }
                      }}
                      placeholder="0 a 100"
                      className="w-24 rounded-xl border border-accent/40 bg-[#12122d] px-3 py-1.5 text-xs font-black text-accent outline-none focus:border-accent text-center placeholder:text-muted-foreground/50 placeholder:font-normal"
                      disabled={sendOrcamentoMutation.isPending}
                      required
                    />
                    <span className="absolute right-3 text-xs font-bold text-accent pointer-events-none">%</span>
                  </div>

                  {/* Botões Rápidos de Margem */}
                  <div className="flex items-center gap-1">
                    {[20, 30, 40, 50, 70, 100].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setMargemLucro(preset)}
                        className={cn(
                          "rounded-lg px-2 py-0.5 text-[10px] font-bold transition-all",
                          margemLucro === preset
                            ? "bg-accent text-[#0d0d26] shadow-sm font-black"
                            : "border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
                        )}
                      >
                        {preset}%
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handlePreSend}
                  disabled={sendOrcamentoMutation.isPending || !promptText.trim() || margemLucro === ""}
                  className="ml-auto inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#fba834] to-[#f7931e] px-6 py-2.5 text-xs font-bold text-[#0d0d26] shadow-lg shadow-[#fba834]/20 hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none"
                >
                  {sendOrcamentoMutation.isPending ? (
                    <>
                      <RefreshCw className="size-4 animate-spin" />
                      Processando com IA...
                    </>
                  ) : (
                    <>
                      <Send className="size-4" />
                      Gerar Orçamento
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Sugestões Rápidas de Prompt */}
            {!sendOrcamentoMutation.isPending && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-[11px] font-bold text-muted-foreground">Exemplos rápidos:</span>
                {promptSuggestions.map((sug, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setPromptText(sug)}
                    className="rounded-lg border border-white/5 bg-white/[0.03] px-2.5 py-1 text-[10px] text-slate-300 hover:border-accent/40 hover:bg-accent/10 hover:text-accent transition-all text-left truncate max-w-xs"
                    title={sug}
                  >
                    "{sug}"
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ══════ 2. TELA DE CARREGAMENTO EM TEMPO REAL (~2 MINUTOS) ══════ */}
        {sendOrcamentoMutation.isPending && (
          <section className="rounded-2xl border border-amber-500/40 bg-gradient-to-b from-[#161638]/95 to-[#0e0e28]/95 p-8 backdrop-blur-2xl shadow-2xl text-center space-y-6 animate-in fade-in duration-300">
            <div className="relative mx-auto size-20">
              <div className="absolute inset-0 rounded-full border-4 border-amber-500/20 animate-ping" />
              <div className="absolute inset-0 rounded-full border-4 border-t-amber-400 border-r-transparent border-b-amber-400 border-l-transparent animate-spin" />
              <div className="grid size-20 place-items-center rounded-full bg-secondary/80 backdrop-blur-md">
                <Bot className="size-9 text-amber-400 animate-pulse" />
              </div>
            </div>

            <div className="space-y-2 max-w-lg mx-auto">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-extrabold text-amber-400">
                <Sparkles className="size-3.5" /> IA Omni Analisando Projeto
              </span>
              <h3 className="text-lg font-black text-foreground">
                {currentLoadingStatus.title}
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {currentLoadingStatus.desc}
              </p>
              <p className="text-[11px] text-amber-400/80 font-medium">
                Tempo decorrido: <span className="font-mono font-bold text-white">{Math.floor(elapsedSeconds / 60)}:{(elapsedSeconds % 60).toString().padStart(2, "0")}</span> (tempo médio: ~1 a 2 minutos)
              </p>
            </div>

            {/* Barra de Progresso Estimada */}
            <div className="max-w-md mx-auto space-y-1.5">
              <div className="h-2 w-full overflow-hidden rounded-full bg-secondary border border-white/5">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-[#fba834] rounded-full transition-all duration-500"
                  style={{ width: `${currentLoadingStatus.percent}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>Margem aplicada: {margemLucro}%</span>
                <span>Aguardando resposta do n8n...</span>
              </div>
            </div>
          </section>
        )}

        {/* ══════ 3. EXIBIÇÃO VISUAL DO ORÇAMENTO GERADO / SELECIONADO ══════ */}
        {activeOrcamento && !sendOrcamentoMutation.isPending && (
          <section className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-300">
            
            {/* Header do Orçamento Ativo */}
            <div className={cn(
              "rounded-2xl border p-6 backdrop-blur-2xl shadow-xl flex flex-wrap items-center justify-between gap-4 transition-all",
              !activeOrcamento.lead_id
                ? "border-amber-500/50 bg-gradient-to-br from-[#12122d] to-amber-500/[0.08]"
                : "border-emerald-500/40 bg-gradient-to-br from-[#12122d] to-[#0f241a]/40"
            )}>
              <div className="space-y-2 flex-1 min-w-[280px]">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-0.5 text-xs font-black text-emerald-400">
                    <CheckCircle2 className="size-3.5" /> Orçamento Gerado
                  </span>
                  {activeOrcamento.orcamento_id && (
                    <span className="text-xs font-mono font-bold text-accent">
                      #ORC-{activeOrcamento.orcamento_id}
                    </span>
                  )}
                  {activeOrcamento.margem_lucro !== null && activeOrcamento.margem_lucro !== undefined && (
                    <span className="rounded-md border border-purple-500/40 bg-purple-500/15 px-2 py-0.5 text-[11px] font-black text-purple-300">
                      Margem: {activeOrcamento.margem_lucro}%
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    · {formatDate(activeOrcamento.criado_em)}
                  </span>

                  {/* ALERTA OU BADGE DE LEAD VINCULADO */}
                  {!activeOrcamento.lead_id ? (
                    <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/50 bg-amber-500/20 px-2.5 py-0.5 text-[11px] font-black text-amber-300 animate-pulse">
                      <AlertTriangle className="size-3.5 text-amber-400" />
                      ALERTA: Sem Lead Atribuído
                    </span>
                  ) : (
                    <Link
                      to="/lead/$leadId"
                      params={{ leadId: activeOrcamento.lead_id }}
                      className="inline-flex items-center gap-1.5 rounded-md border border-accent/40 bg-accent/15 px-2.5 py-0.5 text-[11px] font-bold text-accent hover:underline"
                    >
                      <UserCheck className="size-3.5" /> Lead: {activeOrcamento.leads?.lead_nome || "Ver Lead"}
                      <ExternalLink className="size-3" />
                    </Link>
                  )}
                </div>

                <h3 className="text-sm font-bold text-foreground">
                  "{activeOrcamento.solicitacao_original}"
                </h3>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {/* Botão de Atribuir / Trocar Lead */}
                {activeOrcamento.orcamento_id && (
                  <button
                    type="button"
                    onClick={() => setModalAssignOrcamento(activeOrcamento)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-all",
                      !activeOrcamento.lead_id
                        ? "border border-amber-500/60 bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 shadow-md shadow-amber-500/10"
                        : "border border-white/10 bg-secondary/60 text-muted-foreground hover:text-foreground hover:bg-secondary"
                    )}
                  >
                    <UserPlus className="size-3.5" />
                    {!activeOrcamento.lead_id ? "Atribuir Lead Agora" : "Trocar Lead"}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => copyFormattedProposal(activeOrcamento)}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#fba834] to-[#f7931e] px-4 py-2 text-xs font-bold text-[#0d0d26] shadow-md shadow-[#fba834]/20 hover:brightness-110 active:scale-95 transition-all"
                >
                  {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                  {copied ? "Copiado!" : "Copiar Proposta Comercial"}
                </button>
              </div>
            </div>

            {/* Raciocínio Técnico */}
            {activeOrcamento.raciocinio_tecnico && (
              <div className="rounded-2xl border border-border bg-card/90 p-6 backdrop-blur-2xl shadow-xl space-y-3">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-accent flex items-center gap-2">
                  <Cpu className="size-4" /> Raciocínio Técnico & Tomada de Decisão
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed font-sans whitespace-pre-wrap">
                  {activeOrcamento.raciocinio_tecnico}
                </p>
              </div>
            )}

            {/* ─── OS 3 CENÁRIOS COMPARATIVOS ─── */}
            <div className="grid gap-6 lg:grid-cols-3">
              
              {/* CENÁRIO 1: MÍNIMO */}
              {activeOrcamento.opcoes_orcamento?.minimo && (
                <div className="rounded-2xl border border-border bg-card/90 p-6 backdrop-blur-2xl shadow-xl space-y-5 flex flex-col justify-between hover:border-slate-400 transition-all">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-border pb-3">
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Cenário 01</span>
                        <h4 className="text-base font-extrabold text-foreground">Mínimo (MVP)</h4>
                      </div>
                      <span className="rounded-lg border border-slate-500/30 bg-slate-500/10 px-2.5 py-1 text-[10px] font-bold text-slate-300">
                        Econômico
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div className="rounded-xl border border-border/80 bg-secondary/40 p-3 flex items-center justify-between">
                        <span className="text-xs text-muted-foreground font-semibold">Valor Setup:</span>
                        <span className="text-sm font-black text-foreground">
                          {formatCurrency(activeOrcamento.opcoes_orcamento.minimo.setup)}
                        </span>
                      </div>
                      <div className="rounded-xl border border-border/80 bg-secondary/40 p-3 flex items-center justify-between">
                        <span className="text-xs text-muted-foreground font-semibold">Mensalidade:</span>
                        <span className="text-sm font-black text-foreground">
                          {formatCurrency(activeOrcamento.opcoes_orcamento.minimo.mensalidade)}<span className="text-[10px] font-normal text-muted-foreground">/mês</span>
                        </span>
                      </div>
                      {activeOrcamento.opcoes_orcamento.minimo.horas_estimadas && (
                        <div className="text-[11px] text-muted-foreground flex items-center justify-between px-1">
                          <span>Horas de desenvolvimento:</span>
                          <span className="font-bold text-foreground">{activeOrcamento.opcoes_orcamento.minimo.horas_estimadas}h</span>
                        </div>
                      )}
                    </div>

                    {/* Stack Utilizada */}
                    {activeOrcamento.opcoes_orcamento.minimo.stack_utilizada && (
                      <div className="space-y-1.5 pt-1">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">Stack:</span>
                        <div className="flex flex-wrap gap-1.5">
                          {activeOrcamento.opcoes_orcamento.minimo.stack_utilizada.map((st, i) => (
                            <span key={i} className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-slate-300">
                              {st}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Descrição */}
                    <p className="text-xs text-slate-300 leading-relaxed pt-2 border-t border-border/60">
                      {activeOrcamento.opcoes_orcamento.minimo.descricao}
                    </p>
                  </div>
                </div>
              )}

              {/* CENÁRIO 2: IDEAL (DESTAQUE RECOMENDADO ⭐) */}
              {activeOrcamento.opcoes_orcamento?.ideal && (
                <div className="relative rounded-2xl border-2 border-accent bg-gradient-to-b from-[#18183c] to-[#12122d] p-6 backdrop-blur-2xl shadow-2xl shadow-accent/10 space-y-5 flex flex-col justify-between scale-[1.02]">
                  {/* Badge Flutuante Recomendado */}
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-[#fba834] to-[#f7931e] px-3.5 py-1 text-[10px] font-black uppercase tracking-wider text-[#0d0d26] shadow-lg shadow-[#fba834]/30">
                      <Star className="size-3 fill-current" /> Recomendado Omni
                    </span>
                  </div>

                  <div className="space-y-4 pt-1">
                    <div className="flex items-center justify-between border-b border-accent/30 pb-3">
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-accent">Cenário 02</span>
                        <h4 className="text-base font-black text-foreground">Ideal (Escalável)</h4>
                      </div>
                      <span className="rounded-lg border border-accent/40 bg-accent/15 px-2.5 py-1 text-[10px] font-black text-accent">
                        Equilíbrio & ROI
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div className="rounded-xl border border-accent/40 bg-accent/10 p-3 flex items-center justify-between">
                        <span className="text-xs text-accent font-bold">Valor Setup:</span>
                        <span className="text-base font-black text-accent">
                          {formatCurrency(activeOrcamento.opcoes_orcamento.ideal.setup)}
                        </span>
                      </div>
                      <div className="rounded-xl border border-accent/40 bg-accent/10 p-3 flex items-center justify-between">
                        <span className="text-xs text-accent font-bold">Mensalidade:</span>
                        <span className="text-base font-black text-foreground">
                          {formatCurrency(activeOrcamento.opcoes_orcamento.ideal.mensalidade)}<span className="text-[10px] font-normal text-muted-foreground">/mês</span>
                        </span>
                      </div>
                      {activeOrcamento.opcoes_orcamento.ideal.horas_estimadas && (
                        <div className="text-[11px] text-muted-foreground flex items-center justify-between px-1">
                          <span>Horas de desenvolvimento:</span>
                          <span className="font-bold text-accent">{activeOrcamento.opcoes_orcamento.ideal.horas_estimadas}h</span>
                        </div>
                      )}
                    </div>

                    {/* Stack Utilizada */}
                    {activeOrcamento.opcoes_orcamento.ideal.stack_utilizada && (
                      <div className="space-y-1.5 pt-1">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-accent">Stack:</span>
                        <div className="flex flex-wrap gap-1.5">
                          {activeOrcamento.opcoes_orcamento.ideal.stack_utilizada.map((st, i) => (
                            <span key={i} className="rounded-md border border-accent/40 bg-accent/20 px-2 py-0.5 text-[10px] font-extrabold text-accent">
                              {st}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Descrição */}
                    <p className="text-xs text-slate-200 leading-relaxed pt-2 border-t border-accent/20">
                      {activeOrcamento.opcoes_orcamento.ideal.descricao}
                    </p>
                  </div>
                </div>
              )}

              {/* CENÁRIO 3: MÁXIMO (ENTERPRISE / PREMIUM) */}
              {activeOrcamento.opcoes_orcamento?.maximo && (
                <div className="rounded-2xl border border-purple-500/40 bg-gradient-to-b from-card to-purple-500/10 p-6 backdrop-blur-2xl shadow-xl space-y-5 flex flex-col justify-between hover:border-purple-400 transition-all">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-purple-500/30 pb-3">
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-purple-400">Cenário 03</span>
                        <h4 className="text-base font-extrabold text-foreground">Máximo (Enterprise)</h4>
                      </div>
                      <span className="rounded-lg border border-purple-500/40 bg-purple-500/20 px-2.5 py-1 text-[10px] font-extrabold text-purple-300">
                        <Rocket className="size-3 inline mr-1" /> Premium
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 p-3 flex items-center justify-between">
                        <span className="text-xs text-purple-300 font-semibold">Valor Setup:</span>
                        <span className="text-sm font-black text-purple-300">
                          {formatCurrency(activeOrcamento.opcoes_orcamento.maximo.setup)}
                        </span>
                      </div>
                      <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 p-3 flex items-center justify-between">
                        <span className="text-xs text-purple-300 font-semibold">Mensalidade:</span>
                        <span className="text-sm font-black text-foreground">
                          {formatCurrency(activeOrcamento.opcoes_orcamento.maximo.mensalidade)}<span className="text-[10px] font-normal text-muted-foreground">/mês</span>
                        </span>
                      </div>
                      {activeOrcamento.opcoes_orcamento.maximo.horas_estimadas && (
                        <div className="text-[11px] text-muted-foreground flex items-center justify-between px-1">
                          <span>Horas de desenvolvimento:</span>
                          <span className="font-bold text-purple-300">{activeOrcamento.opcoes_orcamento.maximo.horas_estimadas}h</span>
                        </div>
                      )}
                    </div>

                    {/* Stack Utilizada */}
                    {activeOrcamento.opcoes_orcamento.maximo.stack_utilizada && (
                      <div className="space-y-1.5 pt-1">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-400">Stack:</span>
                        <div className="flex flex-wrap gap-1.5">
                          {activeOrcamento.opcoes_orcamento.maximo.stack_utilizada.map((st, i) => (
                            <span key={i} className="rounded-md border border-purple-500/30 bg-purple-500/20 px-2 py-0.5 text-[10px] font-medium text-purple-200">
                              {st}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Descrição */}
                    <p className="text-xs text-slate-300 leading-relaxed pt-2 border-t border-purple-500/20">
                      {activeOrcamento.opcoes_orcamento.maximo.descricao}
                    </p>
                  </div>
                </div>
              )}

            </div>

            {/* Perguntas Comerciais */}
            {activeOrcamento.perguntas_comerciais && activeOrcamento.perguntas_comerciais.length > 0 && (
              <div className="rounded-2xl border border-amber-500/30 bg-card/90 p-6 backdrop-blur-2xl shadow-xl space-y-3">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                  <HelpCircle className="size-4" /> Perguntas Estratégicas de Alinhamento Comercial
                </h4>
                <div className="space-y-2">
                  {activeOrcamento.perguntas_comerciais.map((pergunta, i) => (
                    <div key={i} className="rounded-xl border border-border/80 bg-secondary/40 p-3.5 text-xs text-slate-200 flex items-start gap-2.5">
                      <span className="grid size-5 shrink-0 place-items-center rounded-full bg-amber-500/20 text-[10px] font-bold text-amber-400">
                        {i + 1}
                      </span>
                      <p className="leading-relaxed">{pergunta}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </section>
        )}

        {/* ══════ 4. HISTÓRICO DE ORÇAMENTOS GERADOS (SUPABASE) ══════ */}
        <section className="space-y-4 pt-4 border-t border-border/60">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-extrabold text-foreground flex items-center gap-2">
                <History className="size-5 text-accent" /> Histórico de Orçamentos Salvos
              </h3>
              <p className="text-xs text-muted-foreground">
                Orçamentos gerados com alerta para os que estão pendentes de vinculação com leads
              </p>
            </div>

            {/* Filtros e Busca */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Abas de Filtro de Status */}
              <div className="flex items-center gap-1 rounded-xl border border-border/80 bg-secondary/40 p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setStatusFilter("todos")}
                  className={cn(
                    "rounded-lg px-2.5 py-1 font-bold transition-all",
                    statusFilter === "todos" ? "bg-accent text-[#0d0d26] shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Todos ({orcamentos.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter("sem_lead")}
                  className={cn(
                    "rounded-lg px-2.5 py-1 font-bold transition-all flex items-center gap-1",
                    statusFilter === "sem_lead"
                      ? "bg-amber-500/30 text-amber-300 border border-amber-500/50"
                      : "text-amber-400/80 hover:text-amber-400"
                  )}
                >
                  <AlertTriangle className="size-3" />
                  Sem Lead ({unassignedCount})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter("com_lead")}
                  className={cn(
                    "rounded-lg px-2.5 py-1 font-bold transition-all",
                    statusFilter === "com_lead" ? "bg-emerald-500/30 text-emerald-300 border border-emerald-500/50" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Vinculados ({assignedCount})
                </button>
              </div>

              {/* Campo de Busca */}
              <div className="relative">
                <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar orçamento ou lead..."
                  className="rounded-xl border border-white/10 bg-secondary/40 pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-accent/60 w-48 sm:w-60"
                />
              </div>
            </div>
          </div>

          {isLoadingHistory ? (
            <div className="py-16 text-center space-y-3">
              <RefreshCw className="size-8 mx-auto animate-spin text-accent" />
              <p className="text-xs text-muted-foreground">Carregando histórico...</p>
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card/80 p-12 text-center space-y-3 backdrop-blur-2xl shadow-xl">
              <Calculator className="size-10 mx-auto text-muted-foreground/30" />
              <p className="text-sm font-bold text-foreground">Nenhum orçamento encontrado no filtro</p>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                {statusFilter === "sem_lead"
                  ? "Todos os orçamentos já estão vinculados a leads! Ótimo trabalho."
                  : "Utilize o campo no topo da página para gerar propostas técnicas com IA."}
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredHistory.map((orc) => {
                const isSelected = activeOrcamento?.orcamento_id === orc.orcamento_id;
                const ideal = orc.opcoes_orcamento?.ideal;
                const hasLead = !!orc.lead_id;

                return (
                  <div
                    key={orc.orcamento_id || Math.random()}
                    onClick={() => {
                      setActiveOrcamento(orc);
                      window.scrollTo({ top: 380, behavior: "smooth" });
                    }}
                    className={cn(
                      "rounded-2xl border p-4.5 backdrop-blur-2xl shadow-lg transition-all cursor-pointer space-y-3 text-left group relative overflow-hidden",
                      !hasLead
                        ? "border-amber-500/50 bg-gradient-to-br from-card to-amber-500/[0.06] hover:border-amber-400"
                        : isSelected
                        ? "border-accent bg-accent/10 shadow-accent/10 scale-[1.01]"
                        : "border-border bg-card/90 hover:border-accent/40 hover:bg-secondary/40"
                    )}
                  >
                    {/* Header do Card */}
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-black text-accent">
                          #ORC-{orc.orcamento_id}
                        </span>
                        {orc.margem_lucro !== null && orc.margem_lucro !== undefined && (
                          <span className="rounded px-1.5 py-0.2 text-[9px] font-black bg-purple-500/20 text-purple-300 border border-purple-500/30">
                            {orc.margem_lucro}%
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Clock className="size-3 text-muted-foreground" /> {formatDate(orc.criado_em)}
                      </span>
                    </div>

                    {/* ALERTA OU NOME DO LEAD */}
                    <div>
                      {!hasLead ? (
                        <div className="flex items-center justify-between gap-2 rounded-lg border border-amber-500/40 bg-amber-500/15 p-1.5 text-[11px] font-extrabold text-amber-300">
                          <span className="flex items-center gap-1">
                            <AlertTriangle className="size-3 text-amber-400 shrink-0 animate-pulse" />
                            Sem Lead Vinculado
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setModalAssignOrcamento(orc);
                            }}
                            className="rounded bg-amber-500/30 hover:bg-amber-500/50 text-amber-200 px-2 py-0.5 text-[10px] font-black transition-colors"
                          >
                            Atribuir
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-2 text-[11px]">
                          <span className="font-bold text-slate-300 truncate flex items-center gap-1">
                            <UserCheck className="size-3 text-emerald-400 shrink-0" />
                            {orc.leads?.lead_nome || "Lead associado"}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setModalAssignOrcamento(orc);
                            }}
                            className="text-[10px] text-muted-foreground hover:text-accent hover:underline shrink-0"
                            title="Trocar lead"
                          >
                            Alterar
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Texto da Solicitação */}
                    <p className="text-xs font-bold text-foreground line-clamp-2 leading-snug group-hover:text-accent transition-colors">
                      {orc.solicitacao_original}
                    </p>

                    {/* Setup e Mensalidade Ideal */}
                    {ideal && (
                      <div className="flex items-center justify-between border-t border-white/5 pt-2.5 text-xs">
                        <div>
                          <span className="text-[9px] text-muted-foreground uppercase font-bold block">Setup Ideal</span>
                          <span className="font-black text-foreground">{formatCurrency(ideal.setup)}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[9px] text-muted-foreground uppercase font-bold block">Mensalidade</span>
                          <span className="font-black text-accent">{formatCurrency(ideal.mensalidade)}/mês</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

      </div>

      {/* ══════ MODAL DE CONFIRMAÇÃO PRÉ-ENVIO AO WEBHOOK ══════ */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl border border-accent/50 bg-[#12122d]/98 backdrop-blur-2xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="grid size-9 place-items-center rounded-xl bg-accent/20 text-accent font-black">
                  <ShieldCheck className="size-5" />
                </span>
                <div>
                  <h3 className="text-sm font-extrabold text-foreground">Confirmar Solicitação de Orçamento</h3>
                  <p className="text-[11px] text-muted-foreground">Revise os parâmetros antes de enviar para a IA processar</p>
                </div>
              </div>
              <button
                onClick={() => setShowConfirmModal(false)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-white/10 transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Parâmetros a serem confirmados */}
            <div className="space-y-3">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5 space-y-1.5">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                  Escopo do Projeto:
                </span>
                <p className="text-xs text-slate-200 leading-relaxed max-h-32 overflow-y-auto whitespace-pre-wrap">
                  {promptText}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="rounded-xl border border-accent/40 bg-accent/10 p-3">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-accent block">
                    Margem de Lucro:
                  </span>
                  <p className="text-base font-black text-foreground mt-0.5">{margemLucro}%</p>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground block">
                    Lead Associado:
                  </span>
                  <p className="text-xs font-bold text-foreground mt-1 truncate">
                    {selectedLeadObject ? selectedLeadObject.lead_nome || selectedLeadObject.lead_telefone : "Nenhum (Avulso)"}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-[11px] text-amber-300 leading-snug flex items-start gap-2">
                <Clock className="size-4 shrink-0 text-amber-400 mt-0.5" />
                <span>
                  O processamento da IA leva cerca de <strong>1 a 2 minutos</strong>. Uma tela de carregamento será exibida enquanto os 3 cenários são calculados.
                </span>
              </div>
            </div>

            {/* Ações */}
            <div className="flex items-center justify-end gap-2.5 border-t border-white/10 pt-3">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-white/10 transition-colors"
              >
                Voltar e Ajustar
              </button>
              <button
                type="button"
                onClick={handleConfirmAndSend}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#fba834] to-[#f7931e] px-5 py-2 text-xs font-black text-[#0d0d26] shadow-lg shadow-[#fba834]/20 hover:brightness-110 active:scale-95 transition-all"
              >
                <Check className="size-4" />
                Confirmar e Enviar para IA
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════ MODAL DE ATRIBUIÇÃO DE LEAD ══════ */}
      {modalAssignOrcamento && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#12122d]/95 backdrop-blur-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-white/10 pb-3 shrink-0">
              <div className="flex items-center gap-2">
                <span className="grid size-8 place-items-center rounded-lg bg-accent/20 text-accent font-bold">
                  <UserPlus className="size-4" />
                </span>
                <div>
                  <h3 className="text-sm font-extrabold text-foreground">
                    Atribuir Lead ao Orçamento #{modalAssignOrcamento.orcamento_id}
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    Selecione o lead correspondente para associar a esta proposta
                  </p>
                </div>
              </div>
              <button
                onClick={() => setModalAssignOrcamento(null)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-white/10 transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Solicitação do Orçamento */}
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 text-xs text-muted-foreground leading-snug shrink-0 line-clamp-2">
              <span className="font-bold text-slate-300">Projeto: </span>
              {modalAssignOrcamento.solicitacao_original}
            </div>

            {/* Campo de Busca no Modal */}
            <div className="relative shrink-0">
              <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={leadModalSearch}
                onChange={(e) => setLeadModalSearch(e.target.value)}
                placeholder="Buscar lead por nome, telefone ou e-mail..."
                className="w-full rounded-xl border border-white/10 bg-white/5 pl-9 pr-3 py-2 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-accent/60"
                autoFocus
              />
            </div>

            {/* Lista de Leads */}
            <div className="space-y-2 overflow-y-auto pr-1 flex-1 min-h-[220px] max-h-[340px]">
              {filteredLeadsForModal.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  Nenhum lead encontrado com esse termo de busca.
                </div>
              ) : (
                filteredLeadsForModal.map((lead) => {
                  const isCurrent = modalAssignOrcamento.lead_id === lead.lead_id;

                  return (
                    <div
                      key={lead.lead_id}
                      onClick={() =>
                        assignLeadMutation.mutate({
                          orcamentoId: modalAssignOrcamento.orcamento_id!,
                          leadId: lead.lead_id,
                        })
                      }
                      className={cn(
                        "flex items-center justify-between gap-3 rounded-xl border p-3 cursor-pointer transition-all group",
                        isCurrent
                          ? "border-emerald-500/50 bg-emerald-500/10"
                          : "border-white/5 bg-white/[0.02] hover:border-accent/40 hover:bg-accent/5"
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-foreground group-hover:text-accent transition-colors truncate">
                            {lead.lead_nome || lead.lead_telefone || "Lead sem nome"}
                          </p>
                          {lead.lead_etapa_funil && (
                            <span className="rounded px-1.5 py-0.2 text-[9px] font-extrabold bg-secondary text-muted-foreground border border-white/5">
                              {lead.lead_etapa_funil}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                          {lead.lead_telefone || lead.lead_email || "Sem dados de contato adicionais"}
                        </p>
                      </div>

                      <div className="shrink-0 text-right">
                        {lead.lead_valor && (
                          <p className="text-xs font-black text-accent">{formatCurrency(lead.lead_valor)}</p>
                        )}
                        {isCurrent ? (
                          <span className="text-[10px] font-extrabold text-emerald-400 flex items-center gap-1 justify-end">
                            <Check className="size-3" /> Vinculado
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-accent opacity-0 group-hover:opacity-100 transition-opacity">
                            Selecionar ➔
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer do Modal */}
            <div className="flex items-center justify-between border-t border-white/10 pt-3 shrink-0">
              {modalAssignOrcamento.lead_id ? (
                <button
                  type="button"
                  onClick={() =>
                    assignLeadMutation.mutate({
                      orcamentoId: modalAssignOrcamento.orcamento_id!,
                      leadId: null,
                    })
                  }
                  className="text-xs font-bold text-red-400 hover:underline flex items-center gap-1"
                >
                  <Unlink className="size-3.5" /> Desvincular Lead Atual
                </button>
              ) : (
                <span className="text-[11px] text-muted-foreground">
                  Selecione um lead para vincular a esta proposta.
                </span>
              )}

              <button
                type="button"
                onClick={() => setModalAssignOrcamento(null)}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-bold text-muted-foreground hover:bg-white/10"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

    </AppShell>
  );
}
