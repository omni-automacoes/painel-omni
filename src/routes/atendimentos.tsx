import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";
import {
  Search,
  Info,
  Check,
  CheckCheck,
  X,
  ChevronDown,
  ChevronUp,
  FileText,
  Image as ImageIcon,
  Video,
  Building2,
  Mail,
  PhoneCall,
  Bot,
  MessageCircle,
  MessagesSquare,
  ArrowDown,
  Maximize2,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/atendimentos")({
  head: () => ({
    meta: [
      { title: "Atendimentos · Central de conversas Omni" },
      {
        name: "description",
        content:
          "Central de atendimento do Omni com lista de conversas e histórico completo com o cliente.",
      },
      { property: "og:title", content: "Atendimentos · Central de conversas Omni" },
      {
        property: "og:description",
        content: "Visualize conversas e histórico de mensagens dos clientes.",
      },
    ],
  }),
  component: Atendimentos,
});

/* ─── Types ─── */
type ReadStatus = "sent" | "delivered" | "read";

interface Chat {
  id: string;
  name: string;
  company: string;
  last: string;
  time: string;
  unread: number;
  status: "Aberto" | "Pendente" | "Resolvido";
  online: boolean;
  phone: string;
  email: string;
  ativo_ia: boolean;
}

interface Message {
  id: string;
  me: boolean;
  text: string;
  time: string;
  rawDate: string;
  readStatus: ReadStatus;
  attachment?: { name: string; size: string; type: "doc" | "image" | "video" };
}

interface ParsedImageMessage {
  isImage: boolean;
  imageUrl?: string;
  description?: string;
  rawText: string;
}

/* Situação da conversa: cor sempre acompanhada de rótulo em texto. */
const STATUS_BADGE: Record<Chat["status"], string> = {
  Aberto: "omni-badge--info",
  Pendente: "omni-badge--warning",
  Resolvido: "omni-badge--success",
};

/* ─── Helpers de Formatação de Data / Hora estilo WhatsApp ─── */
function formatChatListTime(rawDate?: string): string {
  if (!rawDate) return "";
  const d = new Date(rawDate);
  if (isNaN(d.getTime())) return "";

  const now = new Date();
  const dDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const diffTime = nowDay.getTime() - dDay.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  } else if (diffDays === 1) {
    return "Ontem";
  } else if (diffDays > 1 && diffDays <= 6) {
    const weekDays = [
      "Domingo",
      "Segunda-feira",
      "Terça-feira",
      "Quarta-feira",
      "Quinta-feira",
      "Sexta-feira",
      "Sábado",
    ];
    return weekDays[d.getDay()];
  } else {
    return d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }
}

function formatMessageGroupDate(rawDate: string): string {
  if (!rawDate) return "Hoje";
  const d = new Date(rawDate);
  if (isNaN(d.getTime())) return "Hoje";

  const now = new Date();
  const dDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const diffTime = nowDay.getTime() - dDay.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return "Hoje";
  } else if (diffDays === 1) {
    return "Ontem";
  } else if (diffDays > 1 && diffDays <= 6) {
    const weekDays = [
      "Domingo",
      "Segunda-feira",
      "Terça-feira",
      "Quarta-feira",
      "Quinta-feira",
      "Sexta-feira",
      "Sábado",
    ];
    return weekDays[d.getDay()];
  } else {
    return d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }
}

/* ─── Parser para Mensagens com Imagem / Link ─── */
function parseImageMessage(text: string): ParsedImageMessage {
  if (!text) return { isImage: false, rawText: text };

  // Procura por (Link: https://...) ou Link: https://...
  const linkMatch = text.match(/Link:\s*(https?:\/\/[^\s\)]+)/i);

  if (linkMatch && linkMatch[1]) {
    const imageUrl = linkMatch[1];

    // Extrai a descrição após o sufixo ): ou :
    let description = "";
    const splitIndex = text.indexOf("):");
    if (splitIndex !== -1) {
      description = text.substring(splitIndex + 2).trim();
    } else {
      const altIndex = text.indexOf(imageUrl);
      if (altIndex !== -1) {
        const afterUrl = text.substring(altIndex + imageUrl.length);
        description = afterUrl.replace(/^\s*\)?:?\s*/, "").trim();
      }
    }

    return {
      isImage: true,
      imageUrl,
      description,
      rawText: text,
    };
  }

  // Fallback: URL direta de imagem
  const directUrlMatch = text.trim().match(/^(https?:\/\/[^\s]+)$/i);
  if (directUrlMatch && /\.(png|jpe?g|webp|gif|svg|bmp)(\?.*)?$/i.test(directUrlMatch[1])) {
    return {
      isImage: true,
      imageUrl: directUrlMatch[1],
      description: "",
      rawText: text,
    };
  }

  return { isImage: false, rawText: text };
}

/* ─── Component ─── */
function Atendimentos() {
  /* State */
  const { user } = useAuth();
  const [active, setActive] = useState<string | null>(null);
  const [filterTab, setFilterTab] = useState(0);
  const [searchChat, setSearchChat] = useState("");
  const [showMsgSearch, setShowMsgSearch] = useState(false);
  const [msgSearchQuery, setMsgSearchQuery] = useState("");
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [modalImageUrl, setModalImageUrl] = useState<string | null>(null);

  /* React Query: Fetch Leads (Chats) */
  const { data: leadsData = [], isLoading: isLoadingChats } = useQuery({
    queryKey: ["leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .order("criado_em", { ascending: false });
      if (error) {
        toast.error("Erro ao carregar leads: " + error.message);
        throw error;
      }
      return data;
    },
    enabled: !!user,
  });

  /* React Query: Fetch Messages */
  const { data: mensagensData = [] } = useQuery({
    queryKey: ["mensagens"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mensagens")
        .select("*")
        .order("criado_em", { ascending: true });
      if (error) {
        toast.error("Erro ao carregar mensagens: " + error.message);
        throw error;
      }
      return data;
    },
    enabled: !!user,
  });

  /* Derived State: allMessages */
  const allMessages = useMemo(() => {
    const grouped: Record<string, Message[]> = {};
    mensagensData.forEach((m: any) => {
      if (!grouped[m.lead_id]) grouped[m.lead_id] = [];
      const date = new Date(m.criado_em);
      const isClient = m.mensagem_origem === "Cliente";
      grouped[m.lead_id].push({
        id: m.mensagem_id,
        me: !isClient,
        text: m.mensagem_conteudo || "",
        time: isNaN(date.getTime())
          ? ""
          : date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        rawDate: m.criado_em || new Date().toISOString(),
        readStatus: "read",
      });
    });
    return grouped;
  }, [mensagensData]);

  /* Derived State: chats */
  const chats: Chat[] = useMemo(() => {
    return leadsData.map((lead: any) => {
      const leadMsgs = allMessages[lead.lead_id] || [];
      const lastMsg = leadMsgs.length > 0 ? leadMsgs[leadMsgs.length - 1] : null;

      let status: "Aberto" | "Pendente" | "Resolvido" = "Aberto";
      if (lead.lead_status === "Pendente") status = "Pendente";
      if (lead.lead_status === "Resolvido") status = "Resolvido";

      const lastDate = lastMsg ? lastMsg.rawDate : lead.criado_em;

      // Resumo limpo da última mensagem no menu lateral
      let lastTextSnippet = "Nenhuma mensagem ainda";
      if (lastMsg) {
        const parsed = parseImageMessage(lastMsg.text);
        if (parsed.isImage) {
          lastTextSnippet = "Imagem enviada";
        } else {
          lastTextSnippet = lastMsg.text;
        }
      }

      return {
        id: lead.lead_id,
        name: lead.lead_nome || "Sem Nome",
        company: lead.lead_empresa || "Contato Omni",
        last: lastTextSnippet,
        time: formatChatListTime(lastDate),
        unread: 0,
        status: status,
        online: false,
        phone: lead.lead_telefone || "",
        email: lead.lead_email || "",
        ativo_ia: lead.ativo_ia === true,
      };
    });
  }, [leadsData, allMessages]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const msgSearchRef = useRef<HTMLInputElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const messages = active ? allMessages[active] || [] : [];
  const chat = chats.find((c) => c.id === active);

  /* Agrupamento de Mensagens por Data */
  const messageGroups = useMemo(() => {
    const groups: { dateLabel: string; msgs: Message[] }[] = [];
    let currentLabel = "";
    let currentGroup: Message[] = [];

    messages.forEach((m) => {
      const label = formatMessageGroupDate(m.rawDate);
      if (label !== currentLabel) {
        if (currentGroup.length > 0) {
          groups.push({ dateLabel: currentLabel, msgs: currentGroup });
        }
        currentLabel = label;
        currentGroup = [m];
      } else {
        currentGroup.push(m);
      }
    });

    if (currentGroup.length > 0) {
      groups.push({ dateLabel: currentLabel, msgs: currentGroup });
    }

    return groups;
  }, [messages]);

  /* ─── Filters ─── */
  const filterLabels = ["Todos", "Abertos", "Pendentes", "Resolvidos"];
  const statusMap: Record<number, string> = { 1: "Aberto", 2: "Pendente", 3: "Resolvido" };

  const filteredChats = chats.filter((c) => {
    const matchesFilter = filterTab === 0 || c.status === statusMap[filterTab];
    const matchesSearch =
      searchChat === "" ||
      c.name.toLowerCase().includes(searchChat.toLowerCase()) ||
      c.company.toLowerCase().includes(searchChat.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const totalUnread = chats.reduce((sum, c) => sum + c.unread, 0);

  /* ─── Message search ─── */
  const matchingIndices = useMemo(() => {
    if (!msgSearchQuery.trim()) return [];
    const q = msgSearchQuery.toLowerCase();
    return messages
      .map((m: Message, i: number) => (m.text.toLowerCase().includes(q) ? i : -1))
      .filter((i: number) => i !== -1);
  }, [messages, msgSearchQuery]);

  useEffect(() => {
    setHighlightIdx(matchingIndices.length > 0 ? 0 : -1);
  }, [matchingIndices]);

  useEffect(() => {
    if (highlightIdx >= 0 && matchingIndices[highlightIdx] !== undefined) {
      const el = document.getElementById(`msg-${matchingIndices[highlightIdx]}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlightIdx, matchingIndices]);

  /* ─── Scroll helpers ─── */
  const scrollToBottom = useCallback((behavior: ScrollBehavior = "instant") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  useEffect(() => {
    if (active) {
      scrollToBottom();
    }
  }, [active, scrollToBottom]);

  useEffect(() => {
    if (active) {
      scrollToBottom("smooth");
    }
  }, [active ? allMessages[active]?.length : 0, scrollToBottom]);

  /* Scroll position tracking for "scroll to bottom" button */
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const onScroll = () => {
      const diff = container.scrollHeight - container.scrollTop - container.clientHeight;
      setShowScrollBtn(diff > 200);
    };
    container.addEventListener("scroll", onScroll);
    return () => container.removeEventListener("scroll", onScroll);
  }, [active]);

  /* Focus search input */
  useEffect(() => {
    if (showMsgSearch) msgSearchRef.current?.focus();
  }, [showMsgSearch]);

  /* ─── Handlers ─── */
  const navigateSearch = (dir: 1 | -1) => {
    if (matchingIndices.length === 0) return;
    setHighlightIdx((prev) => {
      const next = prev + dir;
      if (next < 0) return matchingIndices.length - 1;
      if (next >= matchingIndices.length) return 0;
      return next;
    });
  };

  const closeSearch = () => {
    setShowMsgSearch(false);
    setMsgSearchQuery("");
    setHighlightIdx(-1);
  };

  const selectChat = (id: string) => {
    setActive(id);
    closeSearch();
    setShowInfoPanel(false);
  };

  /* Highlight text helper */
  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    let idx = lowerText.indexOf(lowerQuery);
    while (idx !== -1) {
      if (idx > lastIndex) parts.push(text.slice(lastIndex, idx));
      parts.push(
        <mark
          key={idx}
          className="rounded-xs bg-accent-soft px-0.5 font-semibold text-accent-soft-fg"
        >
          {text.slice(idx, idx + query.length)}
        </mark>,
      );
      lastIndex = idx + query.length;
      idx = lowerText.indexOf(lowerQuery, lastIndex);
    }
    if (lastIndex < text.length) parts.push(text.slice(lastIndex));
    return <>{parts}</>;
  };

  /* Read status icon */
  const ReadIcon = ({ status }: { status: ReadStatus }) => {
    switch (status) {
      case "sent":
        return <Check className="size-3.5 text-ink-faint" />;
      case "delivered":
        return <CheckCheck className="size-3.5 text-ink-faint" />;
      case "read":
        return <CheckCheck className="size-3.5 text-info" />;
    }
  };

  /* Initials helper */
  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  return (
    <AppShell
      title="Atendimentos"
      subtitle={`${chats.length} ${chats.length === 1 ? "conversa" : "conversas"}${totalUnread > 0 ? ` · ${totalUnread} não lidas` : ""}`}
      flush
    >
      <div className="flex h-full overflow-hidden bg-bg font-sans text-ink">
        {/* ══════ Lista de conversas ══════ */}
        <section
          className="flex w-[340px] shrink-0 flex-col border-r border-line bg-surface sm:w-[380px]"
          aria-label="Conversas"
        >
          <div className="flex flex-col gap-3 border-b border-line px-3 py-4">
            <div className="omni-field">
              <label className="omni-label" htmlFor="chat-search-input">
                Buscar conversa
              </label>
              <div className="omni-input-group">
                <Search />
                <input
                  id="chat-search-input"
                  value={searchChat}
                  onChange={(e) => setSearchChat(e.target.value)}
                  placeholder="Nome do cliente ou empresa"
                  className="omni-input"
                />
              </div>
            </div>

            <div className="omni-tabs scrollbar-slim" role="tablist" aria-label="Filtrar conversas">
              {filterLabels.map((f, i) => (
                <button
                  key={f}
                  id={`filter-btn-${f.toLowerCase()}`}
                  type="button"
                  role="tab"
                  aria-selected={filterTab === i}
                  onClick={() => setFilterTab(i)}
                  className="omni-tab text-sm"
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <ul className="omni-list flex-1 overflow-y-auto scrollbar-slim">
            {isLoadingChats ? (
              [0, 1, 2, 3, 4, 5].map((i) => (
                <li key={i} className="px-4 py-3">
                  <div className="omni-skeleton h-12 w-full" />
                </li>
              ))
            ) : filteredChats.length === 0 ? (
              <li>
                <div className="omni-empty">
                  <span className="omni-empty__art">
                    <MessagesSquare />
                  </span>
                  <h4>Nenhuma conversa aqui</h4>
                  <p>Ajuste a busca ou volte para a aba "Todos" para ver todos os contatos.</p>
                </div>
              </li>
            ) : (
              filteredChats.map((c) => (
                <li key={c.id}>
                  <button
                    id={`chat-item-${c.id}`}
                    type="button"
                    aria-current={c.id === active ? "true" : undefined}
                    onClick={() => selectChat(c.id)}
                    className={cn(
                      "omni-list__item w-full cursor-pointer text-left transition-colors duration-[var(--omni-dur-fast)]",
                      c.id === active && "bg-primary-soft hover:bg-primary-soft",
                    )}
                  >
                    <span className="omni-avatar omni-avatar--lg" aria-hidden="true">
                      {getInitials(c.name)}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-sm font-semibold text-ink">{c.name}</span>
                        <span className="num shrink-0 text-xs text-ink-3">{c.time}</span>
                      </span>

                      <span className="block truncate text-xs text-ink-3">{c.company}</span>

                      <span className="mt-1 flex items-center justify-between gap-2">
                        <span className="truncate text-xs text-ink-3">{c.last}</span>
                        {c.unread > 0 && (
                          <span className="omni-badge omni-badge--brand shrink-0">{c.unread}</span>
                        )}
                      </span>
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </section>

        {/* ══════ Conversa ══════ */}
        <section className="relative flex min-w-0 flex-1 flex-col">
          {chat ? (
            <>
              <header className="flex items-center gap-3 border-b border-line bg-surface px-5 py-3">
                <span className="omni-avatar" aria-hidden="true">
                  {getInitials(chat.name)}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-md font-semibold leading-tight text-ink">
                    {chat.name}
                  </p>
                  <p className="flex items-center gap-2 truncate text-xs text-ink-3">
                    {chat.company}
                    <span className={cn("omni-badge", STATUS_BADGE[chat.status])}>
                      {chat.status}
                    </span>
                  </p>
                </div>

                <button
                  id="btn-msg-search"
                  type="button"
                  aria-pressed={showMsgSearch}
                  onClick={() => {
                    setShowMsgSearch((v) => !v);
                    if (showMsgSearch) closeSearch();
                  }}
                  className={cn(
                    "omni-btn omni-btn--ghost omni-btn--icon omni-btn--sm",
                    showMsgSearch && "bg-surface-3 text-ink",
                  )}
                  title="Buscar nesta conversa"
                >
                  <Search />
                  <span className="omni-sr">Buscar nesta conversa</span>
                </button>

                <button
                  id="btn-info"
                  type="button"
                  aria-pressed={showInfoPanel}
                  onClick={() => setShowInfoPanel((v) => !v)}
                  className={cn(
                    "omni-btn omni-btn--ghost omni-btn--icon omni-btn--sm",
                    showInfoPanel && "bg-surface-3 text-ink",
                  )}
                  title="Dados do contato"
                >
                  <Info />
                  <span className="omni-sr">Dados do contato</span>
                </button>
              </header>

              {showMsgSearch && (
                <div className="flex items-center gap-3 border-b border-line bg-surface-2 px-5 py-2.5">
                  <label className="omni-label shrink-0 text-xs" htmlFor="msg-search-input">
                    Buscar na conversa
                  </label>
                  <input
                    ref={msgSearchRef}
                    id="msg-search-input"
                    value={msgSearchQuery}
                    onChange={(e) => setMsgSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") navigateSearch(e.shiftKey ? -1 : 1);
                      if (e.key === "Escape") closeSearch();
                    }}
                    placeholder="Palavra ou frase"
                    className="omni-input flex-1"
                  />
                  <span className="num shrink-0 text-xs text-ink-3" aria-live="polite">
                    {msgSearchQuery.trim()
                      ? matchingIndices.length > 0
                        ? `${highlightIdx + 1} de ${matchingIndices.length}`
                        : "Nenhum resultado"
                      : ""}
                  </span>
                  <button
                    type="button"
                    onClick={() => navigateSearch(-1)}
                    className="omni-btn omni-btn--ghost omni-btn--icon omni-btn--sm"
                    disabled={matchingIndices.length === 0}
                  >
                    <ChevronUp />
                    <span className="omni-sr">Resultado anterior</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => navigateSearch(1)}
                    className="omni-btn omni-btn--ghost omni-btn--icon omni-btn--sm"
                    disabled={matchingIndices.length === 0}
                  >
                    <ChevronDown />
                    <span className="omni-sr">Próximo resultado</span>
                  </button>
                  <button
                    type="button"
                    onClick={closeSearch}
                    className="omni-btn omni-btn--ghost omni-btn--icon omni-btn--sm"
                  >
                    <X />
                    <span className="omni-sr">Fechar busca</span>
                  </button>
                </div>
              )}

              <div
                ref={messagesContainerRef}
                className="relative flex-1 overflow-y-auto bg-bg-subtle scrollbar-slim"
              >
                <div className="flex flex-col gap-4 px-4 py-6 sm:px-8">
                  {messages.length === 0 ? (
                    <div className="omni-empty">
                      <span className="omni-empty__art">
                        <MessageCircle />
                      </span>
                      <h4>Nenhuma mensagem nesta conversa</h4>
                      <p>Assim que o cliente responder pelo WhatsApp, o histórico aparece aqui.</p>
                    </div>
                  ) : (
                    messageGroups.map((group, groupIdx) => (
                      <div key={groupIdx} className="flex flex-col gap-3">
                        <div className="flex justify-center py-1">
                          <span className="omni-badge omni-badge--outline bg-surface">
                            {group.dateLabel}
                          </span>
                        </div>

                        {group.msgs.map((m) => {
                          const i = messages.findIndex((msg) => msg.id === m.id);
                          const isHighlighted =
                            highlightIdx >= 0 && matchingIndices[highlightIdx] === i;
                          const isMatch = matchingIndices.includes(i);
                          const parsedImage = parseImageMessage(m.text);

                          return (
                            <div
                              key={m.id}
                              id={`msg-${i}`}
                              className={cn("flex", m.me ? "justify-end" : "justify-start")}
                            >
                              <div
                                className={cn(
                                  "relative max-w-[85%] rounded-lg border p-3 text-sm leading-relaxed sm:max-w-[70%]",
                                  m.me
                                    ? "border-primary-soft bg-primary-soft"
                                    : "border-line bg-surface",
                                  isHighlighted && "border-focus shadow-md",
                                )}
                              >
                                {m.attachment && (
                                  <div className="mb-2.5 flex items-center gap-3 rounded-md border border-line bg-surface-2 p-2.5">
                                    <span className="grid size-9 place-items-center rounded-sm bg-surface-3 text-ink-2">
                                      {m.attachment.type === "image" ? (
                                        <ImageIcon className="size-4" />
                                      ) : m.attachment.type === "video" ? (
                                        <Video className="size-4" />
                                      ) : (
                                        <FileText className="size-4" />
                                      )}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-xs font-semibold text-ink">
                                        {m.attachment.name}
                                      </p>
                                      <p className="num omni-small">{m.attachment.size}</p>
                                    </div>
                                  </div>
                                )}

                                {parsedImage.isImage && parsedImage.imageUrl ? (
                                  <div className="flex flex-col gap-2.5">
                                    <div className="group relative overflow-hidden rounded-md border border-line">
                                      <img
                                        src={parsedImage.imageUrl}
                                        alt="Imagem enviada na conversa"
                                        loading="lazy"
                                        className="max-h-[340px] w-auto max-w-full cursor-pointer rounded-md object-contain"
                                        onClick={() => setModalImageUrl(parsedImage.imageUrl!)}
                                      />
                                      <button
                                        type="button"
                                        onClick={() => setModalImageUrl(parsedImage.imageUrl!)}
                                        className="omni-btn omni-btn--secondary omni-btn--icon omni-btn--sm absolute bottom-2.5 right-2.5"
                                        title="Ampliar imagem"
                                      >
                                        <Maximize2 />
                                        <span className="omni-sr">Ampliar imagem</span>
                                      </button>
                                    </div>

                                    {parsedImage.description && (
                                      <div className="omni-card omni-card--inset p-3">
                                        <p className="omni-eyebrow flex items-center gap-1.5">
                                          <Sparkles className="size-3" /> Descrição gerada pela IA
                                        </p>
                                        <p className="mt-1.5 text-sm leading-relaxed text-ink-2">
                                          {parsedImage.description}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <p className="whitespace-pre-wrap break-words pr-14 text-ink">
                                    {isMatch ? highlightText(m.text, msgSearchQuery) : m.text}
                                  </p>
                                )}

                                <span className="num float-right -mb-1 ml-2 mt-1 flex items-center gap-1 text-2xs text-ink-3">
                                  {m.time}
                                  {m.me && <ReadIcon status={m.readStatus} />}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {showScrollBtn && (
                  <button
                    type="button"
                    onClick={() => scrollToBottom("smooth")}
                    className="omni-btn omni-btn--secondary omni-btn--icon absolute bottom-4 right-6 z-[var(--omni-z-sticky)] rounded-full shadow-md"
                  >
                    <ArrowDown />
                    <span className="omni-sr">Ir para a última mensagem</span>
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="flex min-w-0 flex-1 items-center justify-center bg-bg-subtle p-8">
              <div className="omni-empty">
                <span className="omni-empty__art">
                  <MessagesSquare />
                </span>
                <h4>Escolha uma conversa</h4>
                <p>
                  Selecione um contato na lista ao lado para ver todo o histórico de mensagens
                  trocadas com ele.
                </p>
                <p className="omni-status">
                  <span className="omni-dot omni-dot--success omni-dot--pulse" />
                  Central de visualização ativa
                </p>
              </div>
            </div>
          )}
        </section>

        {/* ══════ Dados do contato ══════ */}
        {showInfoPanel && chat && (
          <section
            className="flex w-[300px] shrink-0 flex-col overflow-y-auto border-l border-line bg-surface scrollbar-slim"
            aria-label="Dados do contato"
          >
            <div className="flex items-center gap-3 border-b border-line px-4 py-3">
              <button
                type="button"
                onClick={() => setShowInfoPanel(false)}
                className="omni-btn omni-btn--ghost omni-btn--icon omni-btn--sm"
              >
                <X />
                <span className="omni-sr">Fechar painel</span>
              </button>
              <h2 className="omni-h5">Dados do contato</h2>
            </div>

            <div className="flex flex-col items-center gap-2 border-b border-line px-4 py-6 text-center">
              <span className="omni-avatar size-16 text-md" aria-hidden="true">
                {getInitials(chat.name)}
              </span>
              <div>
                <p className="text-md font-semibold text-ink">{chat.name}</p>
                <p className="omni-small">{chat.company}</p>
              </div>
              <span className={cn("omni-badge", STATUS_BADGE[chat.status])}>{chat.status}</span>
            </div>

            <div className="p-4">
              <h3 className="omni-eyebrow mb-3">Dados cadastrais</h3>
              <dl className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-sm bg-surface-3 text-ink-2">
                    <Building2 className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <dt className="omni-small">Empresa</dt>
                    <dd className="truncate text-sm font-medium text-ink">{chat.company}</dd>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-sm bg-surface-3 text-ink-2">
                    <PhoneCall className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <dt className="omni-small">Telefone</dt>
                    <dd className="num truncate text-sm font-medium text-ink">
                      {chat.phone || "Não informado"}
                    </dd>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-sm bg-surface-3 text-ink-2">
                    <Mail className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <dt className="omni-small">E-mail</dt>
                    <dd className="truncate text-sm font-medium text-ink">
                      {chat.email || "Não informado"}
                    </dd>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-sm bg-surface-3 text-ink-2">
                    <Bot className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <dt className="omni-small">Atendimento por IA</dt>
                    <dd>
                      <span
                        className={cn(
                          "omni-badge",
                          chat.ativo_ia ? "omni-badge--success" : "omni-badge--outline",
                        )}
                      >
                        {chat.ativo_ia ? "Ativo" : "Inativo"}
                      </span>
                    </dd>
                  </div>
                </div>
              </dl>
            </div>
          </section>
        )}
      </div>

      {/* Modal de imagem em tamanho real */}
      {modalImageUrl && (
        <div
          className="omni-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Imagem em tamanho real"
        >
          <div className="flex max-h-[90vh] w-auto max-w-5xl flex-col items-center gap-4">
            <img
              src={modalImageUrl}
              alt="Imagem da conversa em tamanho real"
              className="max-h-[76vh] w-auto max-w-full rounded-lg border border-line object-contain shadow-lg"
            />

            <div className="flex gap-2">
              <a
                href={modalImageUrl}
                target="_blank"
                rel="noreferrer"
                className="omni-btn omni-btn--secondary omni-btn--sm"
              >
                <ExternalLink /> Abrir em nova aba
              </a>
              <button
                type="button"
                onClick={() => setModalImageUrl(null)}
                className="omni-btn omni-btn--primary omni-btn--sm"
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
