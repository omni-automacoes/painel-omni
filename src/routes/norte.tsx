import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarClock,
  Check,
  ChevronRight,
  Compass,
  Minus,
  Pencil,
  Plus,
  Scissors,
  Sprout,
  Trophy,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/norte")({
  head: () => ({
    meta: [
      { title: "Norte 2026 · Omni Automações" },
      {
        name: "description",
        content:
          "Objetivos do planejamento estratégico até dezembro de 2026: onde estamos e o que atacar.",
      },
    ],
  }),
  component: NortePage,
});

/* ─────────────────────────────────────────────────────────────────────────
 * Tipos
 * ───────────────────────────────────────────────────────────────────────── */
type Pessoa = "rodrigo" | "pedro";
type Semaforo = "verde" | "amarelo" | "vermelho";
type Medicao = "auto" | "manual_valor" | "manual_check";
type Unidade = "brl" | "qtd" | "pct" | "nps";

interface Meta {
  meta_id: string;
  chave: string;
  titulo: string;
  descricao: string | null;
  frente: "empresa" | "comercial" | "operacional";
  responsaveis: Pessoa[];
  medicao: Medicao;
  unidade: Unidade;
  meta_valor: number;
  valor_manual: number;
  data_inicio: string;
  data_fim: string;
  concluida: boolean;
  semaforo: Semaforo | null;
  dificuldade: string | null;
  recompensa: string | null;
  observacao: string | null;
  ordem: number;
}

interface Semente {
  semente_id: string;
  nome: string;
  hipotese: string | null;
  prioridade: "alta" | "media" | "baixa";
  status: "aguardando" | "ativa" | "validada" | "cortada";
  conversas_qualificadas: number;
  clientes_fechados: number;
  meta_conversas: number;
  meta_clientes: number;
  prazo_dias: number;
  iniciada_em: string | null;
  encerrada_em: string | null;
  ordem: number;
}

interface Entrega {
  entrega_id: string;
  cliente_nome: string;
  descricao: string | null;
  prazo_acordado: string;
  entregue_em: string | null;
}

interface Nps {
  nps_id: string;
  cliente_nome: string;
  nota: number;
  data: string;
}

interface Foco {
  foco_id: string;
  pessoa: Pessoa;
  texto: string;
  concluido: boolean;
  ordem: number;
  criado_em: string;
}

interface Receita {
  valor: number | null;
  status: string | null;
  data_recebimento: string | null;
  data_competencia: string;
}

interface Lead {
  lead_nome: string | null;
  lead_status: string | null;
  lead_origem: string | null;
  criado_em: string;
}

/* ─────────────────────────────────────────────────────────────────────────
 * Constantes e helpers
 * ───────────────────────────────────────────────────────────────────────── */
const FIM_DO_CICLO = "2026-12-31";
const MAX_FOCOS_ABERTOS = 3;

/* Quem é quem no login. Qualquer outro e-mail cai na visão do Rodrigo. */
const PESSOA_POR_EMAIL: Record<string, Pessoa> = {
  "automacoesomni@gmail.com": "rodrigo",
  "pedro.omniautomacoes@gmail.com": "pedro",
};

const PESSOAS: Record<Pessoa, { nome: string; frente: string }> = {
  rodrigo: { nome: "Rodrigo", frente: "Operacional · Comercial" },
  pedro: { nome: "Pedro", frente: "Comercial" },
};

const SEMAFORO_UI: Record<Semaforo | "neutro", { dot: string; badge: string; label: string }> = {
  verde: { dot: "omni-dot--success", badge: "omni-badge--success", label: "No esperado" },
  amarelo: { dot: "omni-dot--warning", badge: "omni-badge--warning", label: "Atenção" },
  vermelho: { dot: "omni-dot--danger", badge: "omni-badge--danger", label: "Fora dos trilhos" },
  neutro: { dot: "", badge: "omni-badge--outline", label: "Sem dados" },
};

const fmtMoeda = (v: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(Number(v) || 0);

const fmtData = (iso?: string | null) => {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y.slice(2)}`;
};

const isoDe = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const diasEntre = (de: string, ate: string) =>
  Math.round(
    (new Date(`${ate}T12:00:00`).getTime() - new Date(`${de}T12:00:00`).getTime()) / 86400000,
  );

const fmtValor = (v: number, unidade: Unidade) => {
  if (unidade === "brl") return fmtMoeda(v);
  if (unidade === "pct") return `${Math.round(v)}%`;
  return String(Math.round(v));
};

/* Próximos rituais do plano: check-in semanal (sexta 22h30) e encontro
   mensal de resultados (último dia do mês, 21h). */
function proximosRituais(agora: Date) {
  const sexta = new Date(agora);
  sexta.setHours(22, 30, 0, 0);
  const delta = (5 - agora.getDay() + 7) % 7;
  sexta.setDate(sexta.getDate() + delta);
  if (sexta.getTime() < agora.getTime()) sexta.setDate(sexta.getDate() + 7);

  let mensal = new Date(agora.getFullYear(), agora.getMonth() + 1, 0, 21, 0, 0, 0);
  if (mensal.getTime() < agora.getTime()) {
    mensal = new Date(agora.getFullYear(), agora.getMonth() + 2, 0, 21, 0, 0, 0);
  }

  const emDias = (d: Date) => diasEntre(isoDe(agora), isoDe(d));
  return {
    semanal: { data: sexta, dias: emDias(sexta) },
    mensal: { data: mensal, dias: emDias(mensal) },
  };
}

const rotuloDias = (dias: number) =>
  dias === 0 ? "hoje" : dias === 1 ? "amanhã" : `em ${dias} dias`;

/* ─────────────────────────────────────────────────────────────────────────
 * Cálculo das metas
 * Tudo que dá para medir pelo sistema é medido aqui; o resto vem do que a
 * própria página registra.
 * ───────────────────────────────────────────────────────────────────────── */
interface Progresso {
  atual: number;
  alvo: number;
  pct: number; // 0-100, já limitado
  concluida: boolean;
  semDados: boolean;
  detalhe: ReactNode;
  semaforo: Semaforo | "neutro";
}

interface Contexto {
  hoje: string;
  receitas: Receita[];
  leads: Lead[];
  sementes: Semente[];
  entregas: Entrega[];
  nps: Nps[];
}

function calcularProgresso(meta: Meta, ctx: Contexto): Progresso {
  const alvo = Number(meta.meta_valor) || 1;
  let atual = 0;
  let semDados = false;
  let detalhe: ReactNode = null;

  if (meta.medicao === "manual_check") {
    atual = meta.concluida ? 1 : 0;
  } else if (meta.medicao === "manual_valor") {
    atual = Number(meta.valor_manual) || 0;
  } else {
    switch (meta.chave) {
      case "faturamento": {
        atual = ctx.receitas.reduce((soma, r) => {
          if (r.status !== "recebido") return soma;
          const data = (r.data_recebimento || r.data_competencia || "").slice(0, 10);
          if (data < meta.data_inicio || data > meta.data_fim) return soma;
          return soma + (Number(r.valor) || 0);
        }, 0);
        const falta = Math.max(alvo - atual, 0);
        const mesesRestantes = Math.max(diasEntre(ctx.hoje, meta.data_fim) / 30.4, 0.5);
        detalhe =
          falta > 0 ? (
            <>
              Faltam <span className="num">{fmtMoeda(falta)}</span> ·{" "}
              <span className="num">{fmtMoeda(falta / mesesRestantes)}</span>/mês até dezembro
            </>
          ) : (
            "Meta batida"
          );
        break;
      }
      case "novos_clientes": {
        const ganhos = ctx.leads.filter(
          (l) => l.lead_status === "Ganho" && (l.criado_em || "").slice(0, 10) >= meta.data_inicio,
        );
        atual = ganhos.length;
        detalhe =
          ganhos.length > 0
            ? ganhos
                .map((l) => l.lead_nome || "Sem nome")
                .slice(0, 3)
                .join(" · ") + (ganhos.length > 3 ? ` +${ganhos.length - 3}` : "")
            : `Nenhum negócio ganho desde ${fmtData(meta.data_inicio)}`;
        break;
      }
      case "produto_validado": {
        const validadas = ctx.sementes.filter((s) => s.status === "validada");
        const ativas = ctx.sementes.filter((s) => s.status === "ativa");
        atual = validadas.length;
        detalhe =
          validadas.length > 0
            ? validadas.map((s) => s.nome).join(" · ")
            : ativas.length > 0
              ? `${ativas.length} ${ativas.length === 1 ? "semente ativa" : "sementes ativas"}`
              : "Nenhuma semente ativa";
        break;
      }
      case "prazo_entrega": {
        const avaliadas = ctx.entregas.filter((e) => e.entregue_em || e.prazo_acordado < ctx.hoje);
        const noPrazo = avaliadas.filter((e) => e.entregue_em && e.entregue_em <= e.prazo_acordado);
        semDados = avaliadas.length === 0;
        atual = semDados ? 0 : (noPrazo.length / avaliadas.length) * 100;
        detalhe = semDados
          ? "Registre a primeira entrega"
          : `${noPrazo.length} de ${avaliadas.length} no prazo`;
        break;
      }
      case "nps": {
        const notas = ctx.nps;
        semDados = notas.length === 0;
        if (!semDados) {
          const promotores = notas.filter((n) => n.nota >= 9).length;
          const detratores = notas.filter((n) => n.nota <= 6).length;
          atual = ((promotores - detratores) / notas.length) * 100;
          detalhe = `${notas.length} ${notas.length === 1 ? "resposta" : "respostas"} · ${promotores} promotores · ${detratores} detratores`;
        } else {
          detalhe = "Registre a primeira nota";
        }
        break;
      }
    }
  }

  const concluida = meta.medicao === "manual_check" ? meta.concluida : !semDados && atual >= alvo;
  const pct = Math.max(0, Math.min(100, (atual / alvo) * 100));

  return {
    atual,
    alvo,
    pct,
    concluida,
    semDados,
    detalhe,
    semaforo: calcularSemaforo(meta, { atual, alvo, concluida, semDados }, ctx.hoje),
  };
}

/* Verde/amarelo/vermelho do board de status. Metas numéricas comparam o
   avanço com o ritmo esperado pelo calendário; NPS e prazo comparam com o
   alvo direto. Um semáforo salvo na meta sempre vence o cálculo. */
function calcularSemaforo(
  meta: Meta,
  p: { atual: number; alvo: number; concluida: boolean; semDados: boolean },
  hoje: string,
): Semaforo | "neutro" {
  if (meta.semaforo) return meta.semaforo;
  if (p.concluida) return "verde";
  if (p.semDados) return "neutro";

  const razao = p.atual / p.alvo;
  if (meta.unidade === "pct" || meta.unidade === "nps") {
    return razao >= 1 ? "verde" : razao >= 0.8 ? "amarelo" : "vermelho";
  }
  if (meta.medicao === "manual_check") return "amarelo";

  const total = Math.max(diasEntre(meta.data_inicio, meta.data_fim), 1);
  const decorrido = Math.min(Math.max(diasEntre(meta.data_inicio, hoje), 0), total);
  const ritmo = decorrido / total;
  if (razao >= ritmo * 0.85) return "verde";
  if (razao >= ritmo * 0.5) return "amarelo";
  return "vermelho";
}

/* ─────────────────────────────────────────────────────────────────────────
 * Dados
 * ───────────────────────────────────────────────────────────────────────── */
function useTabela<T>(
  chave: string,
  tabela: string,
  colunas: string,
  habilitado: boolean,
  ordem?: string,
) {
  return useQuery<T[]>({
    queryKey: ["norte", chave],
    queryFn: async () => {
      let consulta = supabase.from(tabela).select(colunas);
      if (ordem) consulta = consulta.order(ordem, { ascending: true });
      const { data, error } = await consulta;
      if (error) {
        console.error(`Erro ao buscar ${tabela}:`, error);
        return [];
      }
      return (data || []) as T[];
    },
    enabled: habilitado,
  });
}

/* Toda mutação da página segue o mesmo contrato: executa, invalida tudo do
   Norte e avisa por toast. */
function useAcao<TVars>(executar: (vars: TVars) => Promise<void>, sucesso?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: executar,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["norte"] });
      if (sucesso) toast.success(sucesso);
    },
    onError: (err: Error) => toast.error("Não foi possível salvar: " + err.message),
  });
}

const lancar = ({ error }: { error: { message: string } | null }) => {
  if (error) throw new Error(error.message);
};

/* ─────────────────────────────────────────────────────────────────────────
 * Blocos visuais
 * ───────────────────────────────────────────────────────────────────────── */
function Ponto({ semaforo, className }: { semaforo: Semaforo | "neutro"; className?: string }) {
  return (
    <span
      className={cn("omni-dot", SEMAFORO_UI[semaforo].dot, className)}
      title={SEMAFORO_UI[semaforo].label}
      aria-label={SEMAFORO_UI[semaforo].label}
    />
  );
}

/* Barra com a marca do ritmo esperado: onde a barra deveria estar hoje. */
function Barra({
  pct,
  ritmo,
  semaforo,
  className,
}: {
  pct: number;
  ritmo?: number;
  semaforo: Semaforo | "neutro";
  className?: string;
}) {
  const tom =
    semaforo === "verde"
      ? "omni-progress--success"
      : semaforo === "amarelo"
        ? "omni-progress--warning"
        : semaforo === "vermelho"
          ? "omni-progress--danger"
          : "";
  return (
    <div className={cn("omni-progress relative", tom, className)}>
      <div className="omni-progress__bar" style={{ width: `${Math.max(pct, pct > 0 ? 2 : 0)}%` }} />
      {ritmo !== undefined && ritmo > 0 && ritmo < 100 && (
        <span
          className="absolute top-0 h-full w-0.5 bg-ink/60"
          style={{ left: `${ritmo}%` }}
          title="Ritmo esperado para hoje"
          aria-hidden="true"
        />
      )}
    </div>
  );
}

function Modal({
  titulo,
  subtitulo,
  onClose,
  children,
  rodape,
  onSubmit,
}: {
  titulo: string;
  subtitulo?: string;
  onClose: () => void;
  children: ReactNode;
  rodape: ReactNode;
  onSubmit: (e: FormEvent) => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="omni-modal-backdrop" role="dialog" aria-modal="true" aria-label={titulo}>
      <div className="omni-modal w-full max-w-[520px]">
        <div className="omni-modal__header">
          <div>
            <h2 className="omni-h4">{titulo}</h2>
            {subtitulo && <p className="omni-small mt-1">{subtitulo}</p>}
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
        <form onSubmit={onSubmit}>
          <div className="omni-modal__body omni-stack">{children}</div>
          <div className="omni-modal__footer">{rodape}</div>
        </form>
      </div>
    </div>
  );
}

/* ─── Meta da empresa (card) ─── */
function CartaoMeta({
  meta,
  progresso,
  onEditar,
}: {
  meta: Meta;
  progresso: Progresso;
  onEditar: () => void;
}) {
  const valorTexto =
    meta.medicao === "manual_check"
      ? progresso.concluida
        ? "Concluído"
        : "Em aberto"
      : `${fmtValor(progresso.atual, meta.unidade)} / ${fmtValor(progresso.alvo, meta.unidade)}`;

  return (
    <button
      type="button"
      onClick={onEditar}
      className={cn(
        "omni-card group flex w-full min-w-0 flex-col gap-3 p-4 text-left",
        "transition-colors duration-[var(--omni-dur-fast)] ease-omni hover:border-line-strong",
        progresso.concluida && "border-success/40",
      )}
    >
      <div className="flex items-start gap-2.5">
        <Ponto semaforo={progresso.semaforo} className="mt-1.5" />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-semibold leading-snug text-ink">{meta.titulo}</p>
          <p className="omni-small truncate">{progresso.detalhe || meta.descricao}</p>
        </div>
        {progresso.concluida ? (
          <span className="omni-badge omni-badge--success shrink-0">
            <Check /> Feito
          </span>
        ) : (
          <Pencil
            className="mt-0.5 size-3.5 shrink-0 text-ink-faint opacity-0 transition-opacity group-hover:opacity-100"
            aria-hidden="true"
          />
        )}
      </div>

      <div>
        <p
          className={cn(
            "num text-lg font-extrabold tracking-tight",
            progresso.concluida ? "text-success-fg" : "text-ink",
          )}
        >
          {valorTexto}
        </p>
        <Barra pct={progresso.pct} semaforo={progresso.semaforo} className="mt-1.5" />
      </div>

      <div className="flex items-center gap-2 text-2xs text-ink-3">
        {meta.dificuldade && (
          <span className="omni-badge omni-badge--outline">{meta.dificuldade}</span>
        )}
        {meta.recompensa && (
          <span className="flex min-w-0 items-center gap-1">
            <Trophy className="size-3 shrink-0" aria-hidden="true" />
            <span className="min-w-0 truncate">{meta.recompensa}</span>
          </span>
        )}
      </div>
    </button>
  );
}

/* ─── Meta individual (linha) ─── */
function LinhaMeta({
  meta,
  progresso,
  acao,
  onEditar,
}: {
  meta: Meta;
  progresso: Progresso;
  acao?: ReactNode;
  onEditar: () => void;
}) {
  const valorTexto =
    meta.medicao === "manual_check"
      ? progresso.concluida
        ? "Concluído"
        : "Em aberto"
      : meta.unidade === "nps"
        ? progresso.semDados
          ? "—"
          : `${Math.round(progresso.atual)} / ${Math.round(progresso.alvo)}`
        : `${fmtValor(progresso.atual, meta.unidade)} / ${fmtValor(progresso.alvo, meta.unidade)}`;

  return (
    <li className="flex items-center gap-3 py-3">
      <Ponto semaforo={progresso.semaforo} />
      <button type="button" onClick={onEditar} className="min-w-0 flex-1 text-left">
        <div className="flex items-baseline justify-between gap-3">
          <span className="truncate text-sm font-medium text-ink">{meta.titulo}</span>
          <span
            className={cn(
              "num shrink-0 text-sm font-semibold",
              progresso.concluida ? "text-success-fg" : "text-ink",
            )}
          >
            {valorTexto}
          </span>
        </div>
        <Barra pct={progresso.pct} semaforo={progresso.semaforo} className="mt-1.5" />
        <p className="omni-small mt-1 truncate">{progresso.detalhe || meta.descricao}</p>
      </button>
      {acao}
    </li>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * Página
 * ───────────────────────────────────────────────────────────────────────── */
function NortePage() {
  const { user } = useAuth();
  const logado = !!user;
  const agora = new Date();
  const hoje = isoDe(agora);

  const pessoaLogada: Pessoa = PESSOA_POR_EMAIL[(user?.email || "").toLowerCase()] || "rodrigo";
  const [pessoa, setPessoa] = useState<Pessoa>(pessoaLogada);
  useEffect(() => setPessoa(pessoaLogada), [pessoaLogada]);

  const { data: metas = [], isLoading } = useTabela<Meta>(
    "metas",
    "plano_metas",
    "*",
    logado,
    "ordem",
  );
  const { data: sementes = [] } = useTabela<Semente>(
    "sementes",
    "plano_sementes",
    "*",
    logado,
    "ordem",
  );
  const { data: entregas = [] } = useTabela<Entrega>(
    "entregas",
    "plano_entregas",
    "entrega_id, cliente_nome, descricao, prazo_acordado, entregue_em",
    logado,
    "prazo_acordado",
  );
  const { data: nps = [] } = useTabela<Nps>(
    "nps",
    "plano_nps",
    "nps_id, cliente_nome, nota, data",
    logado,
  );
  const { data: focos = [] } = useTabela<Foco>("focos", "plano_focos", "*", logado, "ordem");
  const { data: receitas = [] } = useTabela<Receita>(
    "receitas",
    "receitas",
    "valor, status, data_recebimento, data_competencia",
    logado,
  );
  const { data: leads = [] } = useTabela<Lead>(
    "leads",
    "leads",
    "lead_nome, lead_status, lead_origem, criado_em",
    logado,
  );

  const ctx: Contexto = { hoje, receitas, leads, sementes, entregas, nps };
  const progresso = useMemo(() => {
    const mapa = new Map<string, Progresso>();
    metas.forEach((m) => mapa.set(m.meta_id, calcularProgresso(m, ctx)));
    return mapa;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metas, receitas, leads, sementes, entregas, nps, hoje]);

  const faturamento = metas.find((m) => m.chave === "faturamento");
  const objetivos = metas.filter((m) => m.chave !== "faturamento" && m.frente !== "operacional");
  const metasDaPessoa = metas.filter((m) => m.responsaveis.includes(pessoa));

  const diasRestantes = Math.max(diasEntre(hoje, FIM_DO_CICLO), 0);
  const rituais = proximosRituais(agora);

  const placar = useMemo(() => {
    const contagem = { verde: 0, amarelo: 0, vermelho: 0, concluidas: 0 };
    metas.forEach((m) => {
      const p = progresso.get(m.meta_id);
      if (!p) return;
      if (p.concluida) contagem.concluidas += 1;
      else if (p.semaforo !== "neutro") contagem[p.semaforo] += 1;
    });
    return contagem;
  }, [metas, progresso]);

  /* ── Modais ── */
  const [metaEmEdicao, setMetaEmEdicao] = useState<Meta | null>(null);
  const [modalEntrega, setModalEntrega] = useState(false);
  const [modalNps, setModalNps] = useState(false);

  /* ── Ações ── */
  const salvarMeta = useAcao(async (dados: Partial<Meta> & { meta_id: string }) => {
    const { meta_id, ...resto } = dados;
    lancar(
      await supabase
        .from("plano_metas")
        .update({ ...resto, atualizado_em: new Date().toISOString() })
        .eq("meta_id", meta_id),
    );
  }, "Meta atualizada");

  const salvarSemente = useAcao(async (dados: Partial<Semente> & { semente_id: string }) => {
    const { semente_id, ...resto } = dados;
    lancar(
      await supabase
        .from("plano_sementes")
        .update({ ...resto, atualizado_em: new Date().toISOString() })
        .eq("semente_id", semente_id),
    );
  });

  const criarFoco = useAcao(async (texto: string) => {
    const ordem = focos.filter((f) => f.pessoa === pessoa).length;
    lancar(await supabase.from("plano_focos").insert([{ pessoa, texto, ordem }]));
  });

  const alternarFoco = useAcao(async (foco: Foco) => {
    lancar(
      await supabase
        .from("plano_focos")
        .update({
          concluido: !foco.concluido,
          concluido_em: foco.concluido ? null : new Date().toISOString(),
        })
        .eq("foco_id", foco.foco_id),
    );
  });

  const removerFoco = useAcao(async (focoId: string) => {
    lancar(await supabase.from("plano_focos").delete().eq("foco_id", focoId));
  });

  const criarEntrega = useAcao(async (dados: Omit<Entrega, "entrega_id">) => {
    lancar(await supabase.from("plano_entregas").insert([dados]));
  }, "Entrega registrada");

  const concluirEntrega = useAcao(async (entregaId: string) => {
    lancar(
      await supabase
        .from("plano_entregas")
        .update({ entregue_em: hoje })
        .eq("entrega_id", entregaId),
    );
  }, "Entrega concluída hoje");

  const criarNps = useAcao(
    async (dados: { cliente_nome: string; nota: number; comentario: string | null }) => {
      lancar(await supabase.from("plano_nps").insert([{ ...dados, data: hoje }]));
    },
    "Nota registrada",
  );

  /* ── Sementes ── */
  const ativarSemente = (s: Semente) => {
    const ativas = sementes.filter((x) => x.status === "ativa").length;
    if (ativas >= 2) {
      toast.error(
        "Já existem 2 sementes ativas — o plano prevê 2 por ciclo. Valide ou corte uma antes.",
      );
      return;
    }
    salvarSemente.mutate({
      semente_id: s.semente_id,
      status: "ativa",
      iniciada_em: hoje,
      encerrada_em: null,
    });
  };

  const focosDaPessoa = focos.filter((f) => f.pessoa === pessoa);
  const focosAbertos = focosDaPessoa.filter((f) => !f.concluido);
  const focosFeitos = focosDaPessoa.filter((f) => f.concluido);
  const entregasAbertas = entregas.filter((e) => !e.entregue_em);

  const ritmoFaturamento = faturamento
    ? Math.min(
        100,
        Math.max(
          0,
          (diasEntre(faturamento.data_inicio, hoje) /
            Math.max(diasEntre(faturamento.data_inicio, faturamento.data_fim), 1)) *
            100,
        ),
      )
    : 0;
  const pFat = faturamento ? progresso.get(faturamento.meta_id) : undefined;

  return (
    <AppShell
      title="Norte 2026"
      subtitle="Onde estamos e o que atacar até dezembro"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <span className="omni-badge omni-badge--outline h-7 gap-1.5 px-2.5">
            <CalendarClock />
            Check-in {rotuloDias(rituais.semanal.dias)} · sex 22h30
          </span>
          <span className="omni-badge omni-badge--outline h-7 gap-1.5 px-2.5">
            <Compass />
            Encontro mensal {rotuloDias(rituais.mensal.dias)} ·{" "}
            {fmtData(isoDe(rituais.mensal.data))} 21h
          </span>
        </div>
      }
    >
      <div className="omni-stack-6 w-full *:min-w-0">
        {/* ═════ 1. A Omni: meta financeira do ciclo ═════ */}
        <section className="omni-card overflow-hidden" aria-label="Meta financeira do ciclo">
          <div className="h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent" />
          <div className="grid gap-6 p-5 lg:grid-cols-[1fr_auto] lg:items-end lg:p-6">
            <div className="min-w-0">
              <p className="omni-eyebrow">Objetivo da Omni · até 31/12</p>
              {isLoading || !faturamento || !pFat ? (
                <div className="omni-skeleton mt-3 h-12 w-64" />
              ) : (
                <>
                  <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="num text-3xl font-extrabold tracking-tight text-ink lg:text-4xl">
                      {fmtMoeda(pFat.atual)}
                    </span>
                    <span className="text-md text-ink-3">
                      de <span className="num font-semibold text-ink-2">{fmtMoeda(pFat.alvo)}</span>{" "}
                      faturados
                    </span>
                    <span className={cn("omni-badge", SEMAFORO_UI[pFat.semaforo].badge)}>
                      {SEMAFORO_UI[pFat.semaforo].label}
                    </span>
                  </div>
                  <Barra
                    pct={pFat.pct}
                    ritmo={ritmoFaturamento}
                    semaforo={pFat.semaforo}
                    className="mt-4 h-2.5"
                  />
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                    <p className="omni-small">{pFat.detalhe}</p>
                    <button
                      type="button"
                      onClick={() => setMetaEmEdicao(faturamento)}
                      className="omni-btn omni-btn--quiet omni-btn--sm"
                    >
                      Ajustar
                    </button>
                  </div>
                </>
              )}
            </div>

            <div className="flex gap-6 lg:flex-col lg:items-end lg:gap-3 lg:text-right">
              <div>
                <p className="num text-2xl font-extrabold tracking-tight text-ink">
                  {diasRestantes}
                </p>
                <p className="omni-small">dias até o fim do ciclo</p>
              </div>
              <div className="flex items-center gap-3 text-xs font-semibold">
                <span className="flex items-center gap-1.5 text-ink-2">
                  <span className="omni-dot omni-dot--success" /> {placar.verde + placar.concluidas}
                </span>
                <span className="flex items-center gap-1.5 text-ink-2">
                  <span className="omni-dot omni-dot--warning" /> {placar.amarelo}
                </span>
                <span className="flex items-center gap-1.5 text-ink-2">
                  <span className="omni-dot omni-dot--danger" /> {placar.vermelho}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ═════ 2. Objetivos até dezembro ═════ */}
        <section aria-label="Objetivos da Omni">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="omni-h4">O que precisa ser verdade em dezembro</h2>
            <p className="omni-small">
              <span className="num">{placar.concluidas}</span> de{" "}
              <span className="num">{metas.length}</span> concluídos
            </p>
          </div>
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="omni-skeleton h-32 w-full" />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 *:min-w-0">
              {objetivos.map((meta) => (
                <CartaoMeta
                  key={meta.meta_id}
                  meta={meta}
                  progresso={progresso.get(meta.meta_id)!}
                  onEditar={() => setMetaEmEdicao(meta)}
                />
              ))}
            </div>
          )}
        </section>

        {/* ═════ 3. Visão individual ═════ */}
        <section aria-label="Visão individual">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <h2 className="omni-h4">Meu papel</h2>
              <span className="omni-small hidden sm:inline">{PESSOAS[pessoa].frente}</span>
            </div>
            <div className="omni-tabs" role="tablist" aria-label="Pessoa">
              {(Object.keys(PESSOAS) as Pessoa[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  role="tab"
                  aria-selected={pessoa === p}
                  onClick={() => setPessoa(p)}
                  className="omni-tab"
                >
                  {PESSOAS[p].nome}
                  {p === pessoaLogada && <span className="omni-sr"> (você)</span>}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[3fr_2fr] *:min-w-0">
            {/* Metas da pessoa */}
            <div className="omni-card">
              <div className="omni-card__header">
                <div>
                  <h3 className="omni-h5">Metas de {PESSOAS[pessoa].nome}</h3>
                  <p className="omni-small mt-0.5">{PESSOAS[pessoa].frente} · até dez/2026</p>
                </div>
              </div>
              <div className="px-5">
                {metasDaPessoa.length === 0 ? (
                  <p className="omni-small py-6">Nenhuma meta atribuída.</p>
                ) : (
                  <ul className="divide-y divide-line-subtle">
                    {metasDaPessoa.map((meta) => (
                      <LinhaMeta
                        key={meta.meta_id}
                        meta={meta}
                        progresso={progresso.get(meta.meta_id)!}
                        onEditar={() => setMetaEmEdicao(meta)}
                        acao={
                          meta.chave === "prazo_entrega" ? (
                            <button
                              type="button"
                              onClick={() => setModalEntrega(true)}
                              className="omni-btn omni-btn--secondary omni-btn--sm shrink-0"
                            >
                              <Plus /> Entrega
                            </button>
                          ) : meta.chave === "nps" ? (
                            <button
                              type="button"
                              onClick={() => setModalNps(true)}
                              className="omni-btn omni-btn--secondary omni-btn--sm shrink-0"
                            >
                              <Plus /> Nota
                            </button>
                          ) : undefined
                        }
                      />
                    ))}
                  </ul>
                )}
              </div>

              {/* Entregas em aberto — só fazem sentido para quem carrega o operacional */}
              {pessoa === "rodrigo" && entregasAbertas.length > 0 && (
                <div className="border-t border-line-subtle px-5 py-3">
                  <p className="omni-eyebrow mb-2">Entregas em aberto</p>
                  <ul className="omni-stack-2">
                    {entregasAbertas.map((e) => {
                      const atrasada = e.prazo_acordado < hoje;
                      const dias = diasEntre(hoje, e.prazo_acordado);
                      return (
                        <li key={e.entrega_id} className="flex items-center gap-3">
                          <Ponto
                            semaforo={atrasada ? "vermelho" : dias <= 3 ? "amarelo" : "verde"}
                          />
                          <span className="min-w-0 flex-1 truncate text-sm text-ink">
                            {e.cliente_nome}
                            {e.descricao && <span className="text-ink-3"> · {e.descricao}</span>}
                          </span>
                          <span
                            className={cn(
                              "num shrink-0 text-xs",
                              atrasada ? "font-semibold text-danger-fg" : "text-ink-3",
                            )}
                          >
                            {atrasada
                              ? `${Math.abs(dias)}d atrasada`
                              : dias === 0
                                ? "vence hoje"
                                : `${dias}d`}
                          </span>
                          <button
                            type="button"
                            onClick={() => concluirEntrega.mutate(e.entrega_id)}
                            className="omni-btn omni-btn--ghost omni-btn--icon omni-btn--sm shrink-0"
                            title="Marcar entregue hoje"
                          >
                            <Check />
                            <span className="omni-sr">Marcar entregue hoje</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>

            {/* Foco agora */}
            <div className="omni-card flex flex-col">
              <div className="omni-card__header">
                <div>
                  <h3 className="omni-h5">Foco agora</h3>
                  <p className="omni-small mt-0.5">
                    No máximo {MAX_FOCOS_ABERTOS} frentes abertas · revisado no check-in
                  </p>
                </div>
                <span className="num text-sm font-semibold text-ink-2">
                  {focosAbertos.length}/{MAX_FOCOS_ABERTOS}
                </span>
              </div>
              <div className="omni-card__body flex flex-1 flex-col gap-3">
                {focosAbertos.length === 0 && (
                  <p className="omni-small">
                    Sem foco definido. O que você vai atacar esta semana?
                  </p>
                )}
                <ul className="omni-stack-2">
                  {focosAbertos.map((f) => (
                    <li key={f.foco_id} className="group flex items-start gap-2.5">
                      <label className="omni-check flex-1 items-start">
                        <input
                          type="checkbox"
                          checked={false}
                          onChange={() => alternarFoco.mutate(f)}
                          aria-label={`Concluir: ${f.texto}`}
                        />
                        <span className="text-sm leading-snug text-ink">{f.texto}</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => removerFoco.mutate(f.foco_id)}
                        className="omni-btn omni-btn--ghost omni-btn--icon omni-btn--sm shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100"
                        title="Remover"
                      >
                        <X />
                        <span className="omni-sr">Remover foco</span>
                      </button>
                    </li>
                  ))}
                </ul>

                <NovoFoco
                  bloqueado={focosAbertos.length >= MAX_FOCOS_ABERTOS}
                  salvando={criarFoco.isPending}
                  onCriar={(texto) => criarFoco.mutate(texto)}
                />

                {focosFeitos.length > 0 && (
                  <details className="mt-auto pt-2">
                    <summary className="omni-small cursor-pointer select-none">
                      {focosFeitos.length} {focosFeitos.length === 1 ? "concluído" : "concluídos"}
                    </summary>
                    <ul className="mt-2 omni-stack-2">
                      {focosFeitos
                        .slice(-5)
                        .reverse()
                        .map((f) => (
                          <li key={f.foco_id} className="flex items-center gap-2.5">
                            <label className="omni-check flex-1">
                              <input
                                type="checkbox"
                                checked
                                onChange={() => alternarFoco.mutate(f)}
                              />
                              <span className="text-sm text-ink-3 line-through">{f.texto}</span>
                            </label>
                          </li>
                        ))}
                    </ul>
                  </details>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ═════ 4. Sementes ═════ */}
        <section className="omni-card" aria-label="Sementes em teste">
          <div className="omni-card__header">
            <div>
              <h2 className="omni-h4 flex items-center gap-2">
                <Sprout className="size-4 text-success" aria-hidden="true" /> Sementes
              </h2>
              <p className="omni-small mt-0.5">
                2 ativas por ciclo · corte ou avanço: 8 conversas qualificadas, 1 cliente fechado,
                45 dias
              </p>
            </div>
            <span className="num text-sm font-semibold text-ink-2">
              {sementes.filter((s) => s.status === "ativa").length}/2 ativas
            </span>
          </div>
          <ul className="divide-y divide-line-subtle px-5">
            {sementes.map((s) => (
              <LinhaSemente
                key={s.semente_id}
                semente={s}
                hoje={hoje}
                onAtivar={() => ativarSemente(s)}
                onAjustar={(campo, delta) =>
                  salvarSemente.mutate({
                    semente_id: s.semente_id,
                    [campo]: Math.max(0, s[campo] + delta),
                  })
                }
                onValidar={() =>
                  salvarSemente.mutate({
                    semente_id: s.semente_id,
                    status: "validada",
                    encerrada_em: hoje,
                  })
                }
                onCortar={() =>
                  salvarSemente.mutate({
                    semente_id: s.semente_id,
                    status: "cortada",
                    encerrada_em: hoje,
                  })
                }
                onReabrir={() =>
                  salvarSemente.mutate({
                    semente_id: s.semente_id,
                    status: "aguardando",
                    iniciada_em: null,
                    encerrada_em: null,
                  })
                }
              />
            ))}
          </ul>
        </section>
      </div>

      {/* ═════ Modais ═════ */}
      {metaEmEdicao && (
        <ModalMeta
          meta={metaEmEdicao}
          progresso={progresso.get(metaEmEdicao.meta_id)}
          salvando={salvarMeta.isPending}
          onClose={() => setMetaEmEdicao(null)}
          onSalvar={(dados) =>
            salvarMeta.mutate(
              { meta_id: metaEmEdicao.meta_id, ...dados },
              { onSuccess: () => setMetaEmEdicao(null) },
            )
          }
        />
      )}

      {modalEntrega && (
        <ModalEntrega
          hoje={hoje}
          salvando={criarEntrega.isPending}
          onClose={() => setModalEntrega(false)}
          onSalvar={(dados) =>
            criarEntrega.mutate(dados, { onSuccess: () => setModalEntrega(false) })
          }
        />
      )}

      {modalNps && (
        <ModalNps
          salvando={criarNps.isPending}
          onClose={() => setModalNps(false)}
          onSalvar={(dados) => criarNps.mutate(dados, { onSuccess: () => setModalNps(false) })}
        />
      )}
    </AppShell>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * Semente (linha)
 * ───────────────────────────────────────────────────────────────────────── */
const PRIORIDADE_UI = {
  alta: { label: "Alta", badge: "omni-badge--brand" },
  media: { label: "Média", badge: "omni-badge--outline" },
  baixa: { label: "Baixa", badge: "omni-badge--outline" },
} as const;

const STATUS_SEMENTE_UI = {
  aguardando: { label: "Aguardando", badge: "omni-badge--outline" },
  ativa: { label: "Ativa", badge: "omni-badge--success" },
  validada: { label: "Validada", badge: "omni-badge--success" },
  cortada: { label: "Cortada", badge: "omni-badge--danger" },
} as const;

function Contador({
  rotulo,
  valor,
  alvo,
  onAjustar,
}: {
  rotulo: string;
  valor: number;
  alvo: number;
  onAjustar?: (delta: number) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="omni-small">{rotulo}</span>
      <span
        className={cn("num text-sm font-semibold", valor >= alvo ? "text-success-fg" : "text-ink")}
      >
        {valor}/{alvo}
      </span>
      {onAjustar && (
        <span className="omni-btn-group ml-1">
          <button
            type="button"
            onClick={() => onAjustar(-1)}
            className="omni-btn omni-btn--ghost omni-btn--icon omni-btn--sm"
            title={`Remover 1 de ${rotulo}`}
          >
            <Minus />
            <span className="omni-sr">Remover 1</span>
          </button>
          <button
            type="button"
            onClick={() => onAjustar(1)}
            className="omni-btn omni-btn--ghost omni-btn--icon omni-btn--sm"
            title={`Somar 1 em ${rotulo}`}
          >
            <Plus />
            <span className="omni-sr">Somar 1</span>
          </button>
        </span>
      )}
    </div>
  );
}

function LinhaSemente({
  semente: s,
  hoje,
  onAtivar,
  onAjustar,
  onValidar,
  onCortar,
  onReabrir,
}: {
  semente: Semente;
  hoje: string;
  onAtivar: () => void;
  onAjustar: (campo: "conversas_qualificadas" | "clientes_fechados", delta: number) => void;
  onValidar: () => void;
  onCortar: () => void;
  onReabrir: () => void;
}) {
  const ativa = s.status === "ativa";
  const encerrada = s.status === "validada" || s.status === "cortada";
  const diasRestantes = s.iniciada_em ? s.prazo_dias - diasEntre(s.iniciada_em, hoje) : null;
  const prontaParaValidar =
    s.conversas_qualificadas >= s.meta_conversas && s.clientes_fechados >= s.meta_clientes;

  return (
    <li
      className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 py-3", encerrada && "opacity-60")}
    >
      <div className="min-w-0 flex-1 basis-56">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "truncate text-sm font-semibold",
              encerrada && s.status === "cortada" ? "text-ink-3 line-through" : "text-ink",
            )}
          >
            {s.nome}
          </span>
          <span className={cn("omni-badge", PRIORIDADE_UI[s.prioridade].badge)}>
            {PRIORIDADE_UI[s.prioridade].label}
          </span>
        </div>
        <p className="omni-small mt-0.5 truncate" title={s.hipotese || undefined}>
          {s.hipotese}
        </p>
      </div>

      {ativa && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <Contador
            rotulo="conversas"
            valor={s.conversas_qualificadas}
            alvo={s.meta_conversas}
            onAjustar={(d) => onAjustar("conversas_qualificadas", d)}
          />
          <Contador
            rotulo="fechados"
            valor={s.clientes_fechados}
            alvo={s.meta_clientes}
            onAjustar={(d) => onAjustar("clientes_fechados", d)}
          />
          {diasRestantes !== null && (
            <span
              className={cn(
                "num text-sm font-semibold",
                diasRestantes < 0
                  ? "text-danger-fg"
                  : diasRestantes <= 7
                    ? "text-warning-fg"
                    : "text-ink-2",
              )}
            >
              {diasRestantes < 0
                ? `${Math.abs(diasRestantes)}d além do prazo`
                : `${diasRestantes}d`}
            </span>
          )}
        </div>
      )}

      <div className="flex shrink-0 items-center gap-2">
        {s.status === "aguardando" && (
          <button
            type="button"
            onClick={onAtivar}
            className="omni-btn omni-btn--secondary omni-btn--sm"
          >
            Ativar
          </button>
        )}
        {ativa && (
          <>
            <button
              type="button"
              onClick={onValidar}
              className={cn(
                "omni-btn omni-btn--sm",
                prontaParaValidar ? "omni-btn--primary" : "omni-btn--secondary",
              )}
              title="Sinal real de demanda: passou no critério"
            >
              <Check /> Validar
            </button>
            <button
              type="button"
              onClick={onCortar}
              className="omni-btn omni-btn--ghost omni-btn--sm text-danger-fg"
              title="Zero sinal de compra desqualifica a semente"
            >
              <Scissors /> Cortar
            </button>
          </>
        )}
        {encerrada && (
          <>
            <span className={cn("omni-badge", STATUS_SEMENTE_UI[s.status].badge)}>
              {STATUS_SEMENTE_UI[s.status].label} · {fmtData(s.encerrada_em)}
            </span>
            <button
              type="button"
              onClick={onReabrir}
              className="omni-btn omni-btn--quiet omni-btn--sm"
            >
              Reabrir
            </button>
          </>
        )}
      </div>
    </li>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * Foco: campo de criação inline
 * ───────────────────────────────────────────────────────────────────────── */
function NovoFoco({
  bloqueado,
  salvando,
  onCriar,
}: {
  bloqueado: boolean;
  salvando: boolean;
  onCriar: (texto: string) => void;
}) {
  const [texto, setTexto] = useState("");

  if (bloqueado) {
    return <p className="omni-hint">Limite atingido. Conclua um foco para abrir outro.</p>;
  }

  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const limpo = texto.trim();
        if (!limpo) return;
        onCriar(limpo);
        setTexto("");
      }}
    >
      <input
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Novo foco…"
        className="omni-input h-control-sm min-h-0 text-sm"
        maxLength={140}
        aria-label="Novo foco"
      />
      <button
        type="submit"
        disabled={salvando || !texto.trim()}
        className="omni-btn omni-btn--secondary omni-btn--icon omni-btn--sm shrink-0"
        title="Adicionar foco"
      >
        <ChevronRight />
        <span className="omni-sr">Adicionar</span>
      </button>
    </form>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * Modais
 * ───────────────────────────────────────────────────────────────────────── */
function ModalMeta({
  meta,
  progresso,
  salvando,
  onClose,
  onSalvar,
}: {
  meta: Meta;
  progresso?: Progresso;
  salvando: boolean;
  onClose: () => void;
  onSalvar: (dados: Partial<Meta>) => void;
}) {
  const [valorManual, setValorManual] = useState(String(meta.valor_manual ?? 0));
  const [concluida, setConcluida] = useState(meta.concluida);
  const [semaforo, setSemaforo] = useState<Semaforo | "">(meta.semaforo || "");
  const [dataInicio, setDataInicio] = useState(meta.data_inicio);
  const [observacao, setObservacao] = useState(meta.observacao || "");

  const auto = meta.medicao === "auto";

  return (
    <Modal
      titulo={meta.titulo}
      subtitulo={meta.descricao || undefined}
      onClose={onClose}
      onSubmit={(e) => {
        e.preventDefault();
        onSalvar({
          valor_manual: Number(valorManual) || 0,
          concluida,
          semaforo: semaforo || null,
          data_inicio: dataInicio,
          observacao: observacao.trim() || null,
        });
      }}
      rodape={
        <>
          <button type="button" onClick={onClose} className="omni-btn omni-btn--ghost">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={salvando}
            data-loading={salvando ? "true" : undefined}
            className="omni-btn omni-btn--primary"
          >
            Salvar
          </button>
        </>
      }
    >
      {auto && progresso && (
        <div className="omni-alert omni-alert--info">
          <div className="omni-alert__body">
            <p className="omni-alert__title">Calculado pelo sistema</p>
            <p className="omni-alert__text">
              {meta.chave === "faturamento" && "Receitas com status recebido dentro da janela."}
              {meta.chave === "novos_clientes" &&
                "Negócios com status Ganho criados dentro da janela."}
              {meta.chave === "produto_validado" && "Sementes marcadas como validadas."}
              {meta.chave === "prazo_entrega" &&
                "Entregas registradas nesta página, entregues até o prazo acordado."}
              {meta.chave === "nps" && "Notas registradas nesta página (promotores − detratores)."}
            </p>
          </div>
        </div>
      )}

      {meta.medicao === "manual_valor" && (
        <div className="omni-field">
          <label className="omni-label" htmlFor="meta-valor">
            Valor atual {meta.unidade === "brl" ? "(R$)" : ""}
          </label>
          <input
            id="meta-valor"
            type="number"
            min={0}
            step={meta.unidade === "brl" ? "0.01" : "1"}
            value={valorManual}
            onChange={(e) => setValorManual(e.target.value)}
            className="omni-input num"
            autoFocus
          />
          <p className="omni-hint">Meta: {fmtValor(Number(meta.meta_valor), meta.unidade)}</p>
        </div>
      )}

      {meta.medicao === "manual_check" && (
        <label className="omni-switch">
          <input
            type="checkbox"
            checked={concluida}
            onChange={(e) => setConcluida(e.target.checked)}
          />
          <span className="text-sm text-ink">
            {concluida ? "Concluído" : "Marcar como concluído"}
          </span>
        </label>
      )}

      {auto && (meta.chave === "faturamento" || meta.chave === "novos_clientes") && (
        <div className="omni-field">
          <label className="omni-label" htmlFor="meta-inicio">
            Contar a partir de
          </label>
          <input
            id="meta-inicio"
            type="date"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
            className="omni-input num"
          />
        </div>
      )}

      <div className="omni-field">
        <label className="omni-label" htmlFor="meta-semaforo">
          Semáforo
        </label>
        <select
          id="meta-semaforo"
          value={semaforo}
          onChange={(e) => setSemaforo(e.target.value as Semaforo | "")}
          className="omni-select"
        >
          <option value="">Automático (pelo ritmo)</option>
          <option value="verde">Verde — dentro do esperado</option>
          <option value="amarelo">Amarelo — atenção, sem ação ainda</option>
          <option value="vermelho">Vermelho — decisão no próximo encontro</option>
        </select>
      </div>

      <div className="omni-field">
        <label className="omni-label" htmlFor="meta-obs">
          Observação
        </label>
        <textarea
          id="meta-obs"
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          rows={2}
          placeholder="Contexto curto para o próximo encontro"
          className="omni-textarea min-h-0"
        />
      </div>
    </Modal>
  );
}

function ModalEntrega({
  hoje,
  salvando,
  onClose,
  onSalvar,
}: {
  hoje: string;
  salvando: boolean;
  onClose: () => void;
  onSalvar: (dados: Omit<Entrega, "entrega_id">) => void;
}) {
  const [cliente, setCliente] = useState("");
  const [descricao, setDescricao] = useState("");
  const [prazo, setPrazo] = useState(hoje);
  const [entregueEm, setEntregueEm] = useState("");

  return (
    <Modal
      titulo="Registrar entrega"
      subtitulo="Prazo acordado com o cliente x data real"
      onClose={onClose}
      onSubmit={(e) => {
        e.preventDefault();
        if (!cliente.trim()) {
          toast.error("Informe o cliente.");
          return;
        }
        onSalvar({
          cliente_nome: cliente.trim(),
          descricao: descricao.trim() || null,
          prazo_acordado: prazo,
          entregue_em: entregueEm || null,
        });
      }}
      rodape={
        <>
          <button type="button" onClick={onClose} className="omni-btn omni-btn--ghost">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={salvando}
            data-loading={salvando ? "true" : undefined}
            className="omni-btn omni-btn--primary"
          >
            Registrar
          </button>
        </>
      }
    >
      <div className="omni-field">
        <label className="omni-label" htmlFor="entrega-cliente">
          Cliente <span className="omni-req">*</span>
        </label>
        <input
          id="entrega-cliente"
          value={cliente}
          onChange={(e) => setCliente(e.target.value)}
          className="omni-input"
          placeholder="Ex.: Visi Marketing"
          autoFocus
        />
      </div>
      <div className="omni-field">
        <label className="omni-label" htmlFor="entrega-desc">
          O que foi combinado
        </label>
        <input
          id="entrega-desc"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          className="omni-input"
          placeholder="Ex.: CRM em produção"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="omni-field">
          <label className="omni-label" htmlFor="entrega-prazo">
            Prazo acordado <span className="omni-req">*</span>
          </label>
          <input
            id="entrega-prazo"
            type="date"
            value={prazo}
            onChange={(e) => setPrazo(e.target.value)}
            className="omni-input num"
            required
          />
        </div>
        <div className="omni-field">
          <label className="omni-label" htmlFor="entrega-real">
            Entregue em
          </label>
          <input
            id="entrega-real"
            type="date"
            value={entregueEm}
            onChange={(e) => setEntregueEm(e.target.value)}
            className="omni-input num"
          />
          <p className="omni-hint">Deixe vazio se ainda está em andamento.</p>
        </div>
      </div>
    </Modal>
  );
}

function ModalNps({
  salvando,
  onClose,
  onSalvar,
}: {
  salvando: boolean;
  onClose: () => void;
  onSalvar: (dados: { cliente_nome: string; nota: number; comentario: string | null }) => void;
}) {
  const [cliente, setCliente] = useState("");
  const [nota, setNota] = useState<number | null>(null);
  const [comentario, setComentario] = useState("");

  return (
    <Modal
      titulo="Registrar nota NPS"
      subtitulo="De 0 a 10, o quanto o cliente indicaria a Omni?"
      onClose={onClose}
      onSubmit={(e) => {
        e.preventDefault();
        if (!cliente.trim() || nota === null) {
          toast.error("Informe o cliente e a nota.");
          return;
        }
        onSalvar({ cliente_nome: cliente.trim(), nota, comentario: comentario.trim() || null });
      }}
      rodape={
        <>
          <button type="button" onClick={onClose} className="omni-btn omni-btn--ghost">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={salvando}
            data-loading={salvando ? "true" : undefined}
            className="omni-btn omni-btn--primary"
          >
            Registrar
          </button>
        </>
      }
    >
      <div className="omni-field">
        <label className="omni-label" htmlFor="nps-cliente">
          Cliente <span className="omni-req">*</span>
        </label>
        <input
          id="nps-cliente"
          value={cliente}
          onChange={(e) => setCliente(e.target.value)}
          className="omni-input"
          placeholder="Ex.: Grupo Auctus"
          autoFocus
        />
      </div>
      <div className="omni-field">
        <span className="omni-label">
          Nota <span className="omni-req">*</span>
        </span>
        <div className="grid grid-cols-11 gap-1" role="radiogroup" aria-label="Nota de 0 a 10">
          {Array.from({ length: 11 }, (_, i) => i).map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={nota === n}
              onClick={() => setNota(n)}
              className={cn(
                "num grid h-9 place-items-center rounded-md border text-sm font-semibold transition-colors",
                nota === n
                  ? n >= 9
                    ? "border-success bg-success-soft text-success-fg"
                    : n <= 6
                      ? "border-danger bg-danger-soft text-danger-fg"
                      : "border-warning bg-warning-soft text-warning-fg"
                  : "border-line bg-surface text-ink-2 hover:border-line-strong",
              )}
            >
              {n}
            </button>
          ))}
        </div>
        <p className="omni-hint">0–6 detrator · 7–8 neutro · 9–10 promotor</p>
      </div>
      <div className="omni-field">
        <label className="omni-label" htmlFor="nps-coment">
          Comentário
        </label>
        <textarea
          id="nps-coment"
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          rows={2}
          className="omni-textarea min-h-0"
          placeholder="O que o cliente disse"
        />
      </div>
    </Modal>
  );
}
