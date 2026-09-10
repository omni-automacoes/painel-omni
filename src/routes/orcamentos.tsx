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
  Clock,
  HelpCircle,
  Cpu,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Copy,
  RefreshCw,
  ShieldCheck,
  Star,
  Check,
  Search,
  UserPlus,
  UserCheck,
  ExternalLink,
  X,
  Unlink,
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
        content:
          "Gerador inteligente de orçamentos com IA, cálculo de cenários e propostas comerciais.",
      },
    ],
  }),
  component: OrcamentosPage,
});

const WEBHOOK_ORCAMENTOS =
  "https://n8n.omniautomacoes.com.br/webhook/731580fd-2c8f-4f9d-a16a-b35acd060e89";

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
  respostas_perguntas_comerciais?: (string | null)[] | null;
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

/* Cartão de um dos três cenários gerados pela IA. */
function CenarioCard({
  ordem,
  titulo,
  etiqueta,
  destaque,
  cenario,
}: {
  ordem: string;
  titulo: string;
  etiqueta: string;
  destaque?: boolean;
  cenario: CenarioOrcamento;
}) {
  return (
    <div className={cn("omni-card relative flex flex-col", destaque && "border-primary shadow-md")}>
      {destaque && (
        <span className="omni-badge omni-badge--brand absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap">
          <Star /> Recomendado
        </span>
      )}

      <div className="omni-card__header">
        <div>
          <p className="omni-eyebrow">{ordem}</p>
          <h3 className="omni-h4 mt-0.5">{titulo}</h3>
        </div>
        <span className="omni-badge omni-badge--outline">{etiqueta}</span>
      </div>

      <div className="omni-card__body flex flex-1 flex-col gap-4">
        <dl className="omni-card omni-card--inset">
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <dt className="text-sm text-ink-2">Setup</dt>
            <dd className="num text-sm font-bold text-ink">{formatCurrency(cenario.setup)}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 border-t border-line-subtle px-4 py-3">
            <dt className="text-sm text-ink-2">Mensalidade</dt>
            <dd className="num text-sm font-bold text-ink">
              {formatCurrency(cenario.mensalidade)}
              <span className="text-xs font-normal text-ink-3">/mês</span>
            </dd>
          </div>
          {cenario.horas_estimadas ? (
            <div className="flex items-center justify-between gap-4 border-t border-line-subtle px-4 py-3">
              <dt className="text-sm text-ink-2">Horas de desenvolvimento</dt>
              <dd className="num text-sm font-bold text-ink">{cenario.horas_estimadas} h</dd>
            </div>
          ) : null}
        </dl>

        {cenario.stack_utilizada && cenario.stack_utilizada.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="omni-eyebrow">Stack</span>
            <div className="flex flex-wrap gap-1.5">
              {cenario.stack_utilizada.map((st, i) => (
                <span key={i} className="omni-badge omni-badge--outline">
                  {st}
                </span>
              ))}
            </div>
          </div>
        )}

        <p className="border-t border-line-subtle pt-3 text-sm leading-relaxed text-ink-2">
          {cenario.descricao}
        </p>
      </div>
    </div>
  );
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

  /* Respostas do Comercial às Perguntas Estratégicas (rascunho local por índice da pergunta) */
  const [respostaDrafts, setRespostaDrafts] = useState<Record<number, string>>({});

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
  const {
    data: orcamentos = [],
    isLoading: isLoadingHistory,
    isRefetching,
  } = useQuery<OrcamentoRecord[]>({
    queryKey: ["orcamentos_list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orcamentos")
        .select(
          "*, leads (lead_id, lead_nome, lead_telefone, lead_email, lead_etapa_funil, lead_valor)",
        )
        .order("criado_em", { ascending: false });

      if (error) throw error;
      return (data || []) as OrcamentoRecord[];
    },
    enabled: !!user,
  });

  /* 3. Mutation para Atribuir ou Desvincular Lead */
  const assignLeadMutation = useMutation({
    mutationFn: async ({
      orcamentoId,
      leadId,
    }: {
      orcamentoId: number | string;
      leadId: string | null;
    }) => {
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
        setActiveOrcamento((prev) =>
          prev ? { ...prev, lead_id: leadId, leads: foundLead } : null,
        );
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

  /* 3.1 Mutation para o Comercial Salvar a Resposta de uma Pergunta Estratégica */
  const saveRespostaMutation = useMutation({
    mutationFn: async ({
      orcamentoId,
      index,
      resposta,
      respostasAtuais,
      totalPerguntas,
    }: {
      orcamentoId: number | string;
      index: number;
      resposta: string;
      respostasAtuais: (string | null)[];
      totalPerguntas: number;
    }) => {
      const novasRespostas = [...respostasAtuais];
      while (novasRespostas.length < totalPerguntas) novasRespostas.push(null);
      novasRespostas[index] = resposta.trim() || null;

      const { error } = await supabase
        .from("orcamentos")
        .update({ respostas_perguntas_comerciais: novasRespostas })
        .eq("orcamento_id", orcamentoId);

      if (error) throw error;
      return { orcamentoId, novasRespostas };
    },
    onSuccess: ({ orcamentoId, novasRespostas }) => {
      queryClient.invalidateQueries({ queryKey: ["orcamentos_list"] });
      setActiveOrcamento((prev) =>
        prev && String(prev.orcamento_id) === String(orcamentoId)
          ? { ...prev, respostas_perguntas_comerciais: novasRespostas }
          : prev,
      );
      toast.success("Resposta salva com sucesso!");
    },
    onError: (err: any) => {
      toast.error("Erro ao salvar resposta: " + err.message);
    },
  });

  /* 4. Mutation para Enviar ao Webhook e Aguardar Resposta */
  const sendOrcamentoMutation = useMutation({
    mutationFn: async (texto: string) => {
      const payload = {
        user_id: user?.id,
        user_nome:
          user?.user_metadata?.full_name ||
          user?.user_metadata?.name ||
          user?.email?.split("@")[0] ||
          "Usuário Omni",
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
        throw new Error(
          `O webhook retornou status ${response.status}. Verifique a automação no n8n.`,
        );
      }

      // Processar a resposta do Webhook
      const responseData = await response.json();
      return {
        responseData,
        solicitacaoOriginal: texto.trim(),
        leadId: selectedLeadIdForNew || null,
        margem: Number(margemLucro),
      };
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
          .select(
            "*, leads (lead_id, lead_nome, lead_telefone, lead_email, lead_etapa_funil, lead_valor)",
          )
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

  /* Limpa os rascunhos de resposta ao trocar de orçamento ativo */
  useEffect(() => {
    setRespostaDrafts({});
  }, [activeOrcamento?.orcamento_id]);

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
      toast.warning(
        "Por favor, especifique a margem de lucro entre 0% e 100% antes de prosseguir.",
      );
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
        title: "Interpretando escopo e requisitos",
        desc: "O modelo está mapeando os fluxos, canais e integrações necessárias.",
        percent: Math.min(Math.round((seconds / 90) * 100), 25),
      };
    }
    if (seconds < 40) {
      return {
        title: "Dimensionando a arquitetura técnica",
        desc: "Avaliando custos de APIs, ferramentas (n8n, Supabase, WhatsApp) e volumetria.",
        percent: Math.min(Math.round((seconds / 90) * 100), 55),
      };
    }
    if (seconds < 70) {
      return {
        title: "Calculando os cenários mínimo, ideal e máximo",
        desc: "Estimando horas de desenvolvimento, setup e custos com base na margem de lucro.",
        percent: Math.min(Math.round((seconds / 90) * 100), 80),
      };
    }
    return {
      title: "Formatando a proposta e as perguntas comerciais",
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
        l.lead_email?.toLowerCase().includes(term),
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
      title="Orçamentos"
      subtitle="Dimensionamento técnico, esforço em horas e preço em três cenários"
      actions={
        <div className="flex items-center gap-2">
          {unassignedCount > 0 && (
            <button
              type="button"
              onClick={() => setStatusFilter("sem_lead")}
              className="omni-btn omni-btn--secondary omni-btn--sm"
            >
              <AlertTriangle />
              {unassignedCount} sem negócio
            </button>
          )}

          <button
            type="button"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["orcamentos_list"] })}
            disabled={isRefetching}
            className="omni-btn omni-btn--secondary omni-btn--sm"
            title="Atualizar lista"
          >
            <RefreshCw className={cn(isRefetching && "animate-spin")} />
            Atualizar
          </button>
        </div>
      }
    >
      <div className="omni-stack-6 w-full">
        {/* ══════ 1. Solicitar orçamento ══════ */}

        <section className="omni-card">
          <div className="omni-card__header">
            <div>
              <h2 className="omni-h4 flex items-center gap-2">
                <Sparkles className="size-4 text-ink-3" /> Solicitar novo orçamento
              </h2>
              <p className="omni-small mt-0.5">
                Descreva o projeto, informe a margem e vincule o negócio para gerar os três
                cenários.
              </p>
            </div>
          </div>

          <div className="omni-card__body omni-stack">
            <div className="omni-field">
              <label className="omni-label" htmlFor="orc-prompt">
                Escopo do projeto <span className="omni-req">*</span>
              </label>
              <textarea
                id="orc-prompt"
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={4}
                placeholder="Ex.: fluxo no n8n para disparo de cupons a 3.000 leads no WhatsApp, com painel de conversão."
                className="omni-textarea"
                disabled={sendOrcamentoMutation.isPending}
              />
              <p className="omni-hint">Enter envia; Shift + Enter quebra a linha.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="omni-field">
                <label className="omni-label" htmlFor="orc-margem">
                  Margem de lucro (%) <span className="omni-req">*</span>
                </label>
                <div className="omni-input-group">
                  <Percent />
                  <input
                    id="orc-margem"
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
                    className="omni-input num"
                    disabled={sendOrcamentoMutation.isPending}
                    required
                  />
                </div>
                <div className="omni-btn-group" role="group" aria-label="Margens sugeridas">
                  {[20, 30, 40, 50, 70, 100].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      aria-pressed={margemLucro === preset}
                      onClick={() => setMargemLucro(preset)}
                      className="omni-btn omni-btn--secondary omni-btn--sm"
                    >
                      {preset}%
                    </button>
                  ))}
                </div>
              </div>

              <div className="omni-field">
                <label className="omni-label" htmlFor="orc-lead">
                  Negócio vinculado
                </label>
                <select
                  id="orc-lead"
                  value={selectedLeadIdForNew}
                  onChange={(e) => setSelectedLeadIdForNew(e.target.value)}
                  className="omni-select"
                  disabled={sendOrcamentoMutation.isPending}
                >
                  <option value="">Nenhum — atribuir depois</option>
                  {leads.map((l) => (
                    <option key={l.lead_id} value={l.lead_id}>
                      {l.lead_nome || l.lead_telefone || "Sem nome"}{" "}
                      {l.lead_etapa_funil ? `(${l.lead_etapa_funil})` : ""}
                    </option>
                  ))}
                </select>
                <p className="omni-hint">
                  Sem vínculo, o orçamento entra no histórico marcado como pendente.
                </p>
              </div>
            </div>

            {!sendOrcamentoMutation.isPending && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="omni-small">Exemplos:</span>
                {promptSuggestions.map((sug, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setPromptText(sug)}
                    className="omni-btn omni-btn--quiet omni-btn--sm max-w-xs"
                    title={sug}
                  >
                    <span className="block min-w-0 truncate">{sug}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="omni-card__footer">
            <button
              type="button"
              onClick={handlePreSend}
              disabled={sendOrcamentoMutation.isPending || !promptText.trim() || margemLucro === ""}
              data-loading={sendOrcamentoMutation.isPending ? "true" : undefined}
              className="omni-btn omni-btn--primary"
            >
              <Send /> Gerar orçamento
            </button>
          </div>
        </section>

        {/* ══════ 2. Processando ══════ */}

        {sendOrcamentoMutation.isPending && (
          <section className="omni-card">
            <div className="omni-card__body flex flex-col items-center gap-5 py-10 text-center">
              <span className="grid size-14 place-items-center rounded-full bg-primary-soft text-primary-soft-fg">
                <Bot className="size-7" />
              </span>

              <div className="flex max-w-lg flex-col gap-2">
                <p className="omni-eyebrow">IA analisando o projeto</p>
                <h2 className="omni-h3">{currentLoadingStatus.title}</h2>
                <p className="omni-p mx-auto">{currentLoadingStatus.desc}</p>
              </div>

              <div className="w-full max-w-md">
                <div
                  className="omni-progress"
                  role="progressbar"
                  aria-valuenow={currentLoadingStatus.percent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="omni-progress__bar"
                    style={{ width: `${currentLoadingStatus.percent}%` }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-ink-3">
                  <span className="num">
                    {Math.floor(elapsedSeconds / 60)}:
                    {(elapsedSeconds % 60).toString().padStart(2, "0")} decorridos
                  </span>
                  <span className="num">Margem de {margemLucro}% · leva 1 a 2 minutos</span>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ══════ 3. Orçamento ativo ══════ */}

        {activeOrcamento && !sendOrcamentoMutation.isPending && (
          <section className="omni-stack-6">
            <div className="omni-card">
              <div className="omni-card__body flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-[280px] flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="omni-badge omni-badge--success">
                      <CheckCircle2 /> Orçamento gerado
                    </span>
                    {activeOrcamento.orcamento_id && (
                      <span className="omni-code">ORC-{activeOrcamento.orcamento_id}</span>
                    )}
                    {activeOrcamento.margem_lucro !== null &&
                      activeOrcamento.margem_lucro !== undefined && (
                        <span className="omni-badge omni-badge--brand">
                          Margem {activeOrcamento.margem_lucro}%
                        </span>
                      )}
                    <span className="num omni-small">{formatDate(activeOrcamento.criado_em)}</span>

                    {!activeOrcamento.lead_id ? (
                      <span className="omni-badge omni-badge--warning">
                        <AlertTriangle /> Sem negócio vinculado
                      </span>
                    ) : (
                      <Link
                        to="/lead/$leadId"
                        params={{ leadId: activeOrcamento.lead_id }}
                        className="omni-link inline-flex items-center gap-1.5"
                      >
                        <UserCheck className="size-3.5" />
                        {activeOrcamento.leads?.lead_nome || "Ver negócio"}
                        <ExternalLink className="size-3" />
                      </Link>
                    )}
                  </div>

                  <p className="mt-2 text-sm font-medium leading-relaxed text-ink">
                    {activeOrcamento.solicitacao_original}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {activeOrcamento.orcamento_id && (
                    <button
                      type="button"
                      onClick={() => setModalAssignOrcamento(activeOrcamento)}
                      className="omni-btn omni-btn--secondary omni-btn--sm"
                    >
                      <UserPlus />
                      {!activeOrcamento.lead_id ? "Vincular negócio" : "Trocar negócio"}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => copyFormattedProposal(activeOrcamento)}
                    className="omni-btn omni-btn--secondary omni-btn--sm"
                  >
                    {copied ? <Check /> : <Copy />}
                    {copied ? "Copiado" : "Copiar proposta"}
                  </button>
                </div>
              </div>
            </div>

            {activeOrcamento.raciocinio_tecnico && (
              <div className="omni-card">
                <div className="omni-card__header py-3">
                  <h2 className="omni-eyebrow flex items-center gap-1.5">
                    <Cpu className="size-3.5" /> Raciocínio técnico
                  </h2>
                </div>
                <div className="omni-card__body">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-2">
                    {activeOrcamento.raciocinio_tecnico}
                  </p>
                </div>
              </div>
            )}

            {/* Três cenários */}
            <div className="grid items-start gap-6 lg:grid-cols-3">
              {activeOrcamento.opcoes_orcamento?.minimo && (
                <CenarioCard
                  ordem="Cenário 01"
                  titulo="Mínimo (MVP)"
                  etiqueta="Econômico"
                  cenario={activeOrcamento.opcoes_orcamento.minimo}
                />
              )}
              {activeOrcamento.opcoes_orcamento?.ideal && (
                <CenarioCard
                  ordem="Cenário 02"
                  titulo="Ideal"
                  etiqueta="Equilibrado"
                  destaque
                  cenario={activeOrcamento.opcoes_orcamento.ideal}
                />
              )}
              {activeOrcamento.opcoes_orcamento?.maximo && (
                <CenarioCard
                  ordem="Cenário 03"
                  titulo="Máximo (Enterprise)"
                  etiqueta="Completo"
                  cenario={activeOrcamento.opcoes_orcamento.maximo}
                />
              )}
            </div>

            {/* Perguntas comerciais */}
            {activeOrcamento.perguntas_comerciais &&
              activeOrcamento.perguntas_comerciais.length > 0 && (
                <div className="omni-card">
                  <div className="omni-card__header">
                    <div>
                      <h2 className="omni-h4 flex items-center gap-2">
                        <HelpCircle className="size-4 text-ink-3" /> Perguntas de alinhamento
                      </h2>
                      <p className="omni-small mt-0.5">
                        As respostas ficam salvas junto ao orçamento para o time técnico consultar.
                      </p>
                    </div>
                  </div>

                  <div className="omni-card__body omni-stack">
                    {activeOrcamento.perguntas_comerciais.map((pergunta, i) => {
                      const totalPerguntas = activeOrcamento.perguntas_comerciais!.length;
                      const respostaSalva =
                        activeOrcamento.respostas_perguntas_comerciais?.[i] || "";
                      const draft = respostaDrafts[i] ?? respostaSalva;
                      const isAnswered = !!respostaSalva.trim();
                      const isDirty = draft.trim() !== respostaSalva.trim();
                      const orcamentoId = activeOrcamento.orcamento_id;

                      return (
                        <div key={i} className="omni-card omni-card--inset">
                          <div className="omni-card__body flex flex-col gap-3">
                            <div className="flex items-start gap-3">
                              <span className="omni-avatar omni-avatar--sm num" aria-hidden="true">
                                {i + 1}
                              </span>
                              <p className="text-sm font-semibold leading-relaxed text-ink">
                                {pergunta}
                              </p>
                            </div>

                            <div className="omni-field pl-9">
                              <label className="omni-sr" htmlFor={`resposta-${i}`}>
                                Resposta do comercial para a pergunta {i + 1}
                              </label>
                              <textarea
                                id={`resposta-${i}`}
                                value={draft}
                                onChange={(e) =>
                                  setRespostaDrafts((prev) => ({ ...prev, [i]: e.target.value }))
                                }
                                rows={2}
                                placeholder="Resposta do comercial sobre este ponto"
                                className="omni-textarea"
                              />

                              <div className="flex items-center justify-between gap-2">
                                <span
                                  className={cn(
                                    "omni-badge",
                                    isAnswered ? "omni-badge--success" : "omni-badge--warning",
                                  )}
                                >
                                  {isAnswered ? <CheckCircle2 /> : <AlertCircle />}
                                  {isAnswered ? "Respondida" : "Aguardando resposta"}
                                </span>

                                <button
                                  type="button"
                                  disabled={
                                    !isDirty || !orcamentoId || saveRespostaMutation.isPending
                                  }
                                  onClick={() =>
                                    saveRespostaMutation.mutate({
                                      orcamentoId: orcamentoId!,
                                      index: i,
                                      resposta: draft,
                                      respostasAtuais:
                                        activeOrcamento.respostas_perguntas_comerciais || [],
                                      totalPerguntas,
                                    })
                                  }
                                  className="omni-btn omni-btn--secondary omni-btn--sm"
                                >
                                  <Check /> Salvar resposta
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
          </section>
        )}

        {/* ══════ 4. Histórico ══════ */}

        <section className="omni-stack">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="omni-h3 flex items-center gap-2">
                <History className="size-5 text-ink-3" /> Histórico de orçamentos
              </h2>
              <p className="omni-small mt-0.5">
                Propostas já geradas, com destaque para as que ainda não têm negócio vinculado.
              </p>
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <div className="omni-btn-group" role="group" aria-label="Filtrar histórico">
                <button
                  type="button"
                  aria-pressed={statusFilter === "todos"}
                  onClick={() => setStatusFilter("todos")}
                  className="omni-btn omni-btn--secondary omni-btn--sm"
                >
                  Todos ({orcamentos.length})
                </button>
                <button
                  type="button"
                  aria-pressed={statusFilter === "sem_lead"}
                  onClick={() => setStatusFilter("sem_lead")}
                  className="omni-btn omni-btn--secondary omni-btn--sm"
                >
                  Sem negócio ({unassignedCount})
                </button>
                <button
                  type="button"
                  aria-pressed={statusFilter === "com_lead"}
                  onClick={() => setStatusFilter("com_lead")}
                  className="omni-btn omni-btn--secondary omni-btn--sm"
                >
                  Vinculados ({assignedCount})
                </button>
              </div>

              <div className="omni-field w-full sm:w-64">
                <label className="omni-sr" htmlFor="busca-orcamento">
                  Buscar orçamento
                </label>
                <div className="omni-input-group">
                  <Search />
                  <input
                    id="busca-orcamento"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar orçamento ou negócio"
                    className="omni-input"
                  />
                </div>
              </div>
            </div>
          </div>

          {isLoadingHistory ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="omni-skeleton h-40 w-full" />
              ))}
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="omni-card">
              <div className="omni-empty">
                <span className="omni-empty__art">
                  <Calculator />
                </span>
                <h4>Nenhum orçamento neste filtro</h4>
                <p>
                  {statusFilter === "sem_lead"
                    ? "Todos os orçamentos já estão vinculados a um negócio."
                    : "Use o formulário no topo da página para gerar a primeira proposta."}
                </p>
              </div>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredHistory.map((orc) => {
                const isSelected = activeOrcamento?.orcamento_id === orc.orcamento_id;
                const ideal = orc.opcoes_orcamento?.ideal;
                const hasLead = !!orc.lead_id;

                return (
                  <button
                    key={orc.orcamento_id || Math.random()}
                    type="button"
                    onClick={() => {
                      setActiveOrcamento(orc);
                      window.scrollTo({ top: 380, behavior: "smooth" });
                    }}
                    className={cn(
                      "omni-card group flex cursor-pointer flex-col gap-3 p-4 text-left transition-colors duration-[var(--omni-dur-fast)] ease-omni",
                      isSelected ? "border-primary" : "hover:border-line-strong",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="omni-code">ORC-{orc.orcamento_id}</span>
                      <span className="num omni-small flex items-center gap-1">
                        <Clock className="size-3" /> {formatDate(orc.criado_em)}
                      </span>
                    </div>

                    {!hasLead ? (
                      <span className="omni-badge omni-badge--warning self-start">
                        <AlertTriangle /> Sem negócio vinculado
                      </span>
                    ) : (
                      <span className="omni-badge omni-badge--success self-start">
                        <UserCheck /> {orc.leads?.lead_nome || "Negócio vinculado"}
                      </span>
                    )}

                    <p className="line-clamp-2 text-sm font-medium leading-snug text-ink">
                      {orc.solicitacao_original}
                    </p>

                    {ideal && (
                      <div className="mt-auto flex items-end justify-between border-t border-line-subtle pt-3">
                        <div>
                          <p className="omni-small">Setup ideal</p>
                          <p className="num text-sm font-semibold text-ink">
                            {formatCurrency(ideal.setup)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="omni-small">Mensalidade</p>
                          <p className="num text-sm font-semibold text-ink">
                            {formatCurrency(ideal.mensalidade)}/mês
                          </p>
                        </div>
                      </div>
                    )}

                    {orc.margem_lucro !== null && orc.margem_lucro !== undefined && (
                      <span className="omni-badge omni-badge--outline self-start">
                        Margem {orc.margem_lucro}%
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* ══════ Modal: confirmar envio ══════ */}
      {showConfirmModal && (
        <div
          className="omni-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-modal-confirmar"
        >
          <div className="omni-modal w-full max-w-[560px]">
            <div className="omni-modal__header">
              <div>
                <h2 id="titulo-modal-confirmar" className="omni-h4 flex items-center gap-2">
                  <ShieldCheck className="size-4 text-ink-3" /> Confirmar solicitação
                </h2>
                <p className="omni-small mt-1">Revise os parâmetros antes de enviar para a IA.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="omni-btn omni-btn--ghost omni-btn--icon omni-btn--sm"
              >
                <X />
                <span className="omni-sr">Fechar</span>
              </button>
            </div>

            <div className="omni-modal__body omni-stack">
              <div className="omni-card omni-card--inset">
                <div className="omni-card__body">
                  <p className="omni-eyebrow">Escopo do projeto</p>
                  <p className="mt-2 max-h-32 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-ink-2 scrollbar-slim">
                    {promptText}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="omni-card omni-card--inset">
                  <div className="omni-stat p-4">
                    <span className="omni-stat__label">Margem de lucro</span>
                    <p className="num text-xl font-bold text-ink">{margemLucro}%</p>
                  </div>
                </div>
                <div className="omni-card omni-card--inset">
                  <div className="omni-stat p-4">
                    <span className="omni-stat__label">Negócio vinculado</span>
                    <p className="truncate text-sm font-semibold text-ink">
                      {selectedLeadObject
                        ? selectedLeadObject.lead_nome || selectedLeadObject.lead_telefone
                        : "Nenhum"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="omni-alert omni-alert--info">
                <Clock className="omni-alert__icon" />
                <div className="omni-alert__body">
                  <p className="omni-alert__title">O processamento leva de 1 a 2 minutos</p>
                  <p className="omni-alert__text">
                    Uma tela de acompanhamento aparece enquanto os três cenários são calculados. Não
                    feche a página.
                  </p>
                </div>
              </div>
            </div>

            <div className="omni-modal__footer">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="omni-btn omni-btn--ghost"
              >
                Voltar e ajustar
              </button>
              <button
                type="button"
                onClick={handleConfirmAndSend}
                className="omni-btn omni-btn--primary"
              >
                <Check /> Enviar para a IA
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════ Modal: vincular negócio ══════ */}
      {modalAssignOrcamento && (
        <div
          className="omni-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-modal-vincular"
        >
          <div className="omni-modal flex max-h-[90vh] w-full max-w-[560px] flex-col">
            <div className="omni-modal__header shrink-0">
              <div>
                <h2 id="titulo-modal-vincular" className="omni-h4">
                  Vincular negócio ao ORC-{modalAssignOrcamento.orcamento_id}
                </h2>
                <p className="omni-small mt-1">Escolha o negócio correspondente a esta proposta.</p>
              </div>
              <button
                type="button"
                onClick={() => setModalAssignOrcamento(null)}
                className="omni-btn omni-btn--ghost omni-btn--icon omni-btn--sm"
              >
                <X />
                <span className="omni-sr">Fechar</span>
              </button>
            </div>

            <div className="omni-modal__body omni-stack min-h-0 flex-1 overflow-hidden">
              <p className="line-clamp-2 text-sm text-ink-3">
                <span className="font-semibold text-ink-2">Projeto: </span>
                {modalAssignOrcamento.solicitacao_original}
              </p>

              <div className="omni-field">
                <label className="omni-sr" htmlFor="busca-lead-modal">
                  Buscar negócio
                </label>
                <div className="omni-input-group">
                  <Search />
                  <input
                    id="busca-lead-modal"
                    value={leadModalSearch}
                    onChange={(e) => setLeadModalSearch(e.target.value)}
                    placeholder="Nome, telefone ou e-mail"
                    className="omni-input"
                    autoFocus
                  />
                </div>
              </div>

              <div className="min-h-[200px] flex-1 overflow-y-auto scrollbar-slim">
                {filteredLeadsForModal.length === 0 ? (
                  <div className="omni-empty">
                    <h4>Nenhum negócio encontrado</h4>
                    <p>Ajuste o termo da busca ou cadastre o negócio na tela de Negócios.</p>
                  </div>
                ) : (
                  <div className="omni-list">
                    {filteredLeadsForModal.map((lead) => {
                      const isCurrent = modalAssignOrcamento.lead_id === lead.lead_id;

                      return (
                        <button
                          key={lead.lead_id}
                          type="button"
                          onClick={() =>
                            assignLeadMutation.mutate({
                              orcamentoId: modalAssignOrcamento.orcamento_id!,
                              leadId: lead.lead_id,
                            })
                          }
                          className="omni-list__item w-full cursor-pointer text-left"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="truncate text-sm font-medium text-ink">
                                {lead.lead_nome || lead.lead_telefone || "Negócio sem nome"}
                              </p>
                              {lead.lead_etapa_funil && (
                                <span className="omni-badge omni-badge--outline shrink-0">
                                  {lead.lead_etapa_funil}
                                </span>
                              )}
                            </div>
                            <p className="omni-small truncate">
                              {lead.lead_telefone || lead.lead_email || "Sem dados de contato"}
                            </p>
                          </div>

                          <div className="shrink-0 text-right">
                            {lead.lead_valor ? (
                              <p className="num text-sm font-semibold text-ink">
                                {formatCurrency(lead.lead_valor)}
                              </p>
                            ) : null}
                            {isCurrent && (
                              <span className="omni-badge omni-badge--success">
                                <Check /> Vinculado
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="omni-modal__footer shrink-0 justify-between">
              {modalAssignOrcamento.lead_id ? (
                <button
                  type="button"
                  onClick={() =>
                    assignLeadMutation.mutate({
                      orcamentoId: modalAssignOrcamento.orcamento_id!,
                      leadId: null,
                    })
                  }
                  className="omni-btn omni-btn--quiet omni-btn--sm text-danger"
                >
                  <Unlink /> Desvincular negócio
                </button>
              ) : (
                <span className="omni-small">Escolha um negócio na lista acima.</span>
              )}

              <button
                type="button"
                onClick={() => setModalAssignOrcamento(null)}
                className="omni-btn omni-btn--ghost"
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
