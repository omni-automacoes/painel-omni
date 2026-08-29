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
  User,
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
  avatarColor: string;
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

/* ─── Avatar color palette ─── */
const AVATAR_COLORS = [
  "#fba834", // brand gold
  "#8b5cf6", // purple
  "#10b981", // emerald
  "#3b82f6", // blue
  "#ec4899", // pink
  "#f97316", // orange
  "#6366f1", // indigo
  "#14b8a6", // teal
];

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
  const { data: leadsData = [] } = useQuery({
    queryKey: ['leads'],
    queryFn: async () => {
      const { data, error } = await supabase.from('leads').select('*').order('criado_em', { ascending: false });
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
    queryKey: ['mensagens'],
    queryFn: async () => {
      const { data, error } = await supabase.from('mensagens').select('*').order('criado_em', { ascending: true });
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
      const isClient = m.mensagem_origem === 'Cliente';
      grouped[m.lead_id].push({
        id: m.mensagem_id,
        me: !isClient,
        text: m.mensagem_conteudo || '',
        time: isNaN(date.getTime())
          ? ""
          : date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        rawDate: m.criado_em || new Date().toISOString(),
        readStatus: "read"
      });
    });
    return grouped;
  }, [mensagensData]);

  /* Derived State: chats */
  const chats: Chat[] = useMemo(() => {
    return leadsData.map((lead: any, index: number) => {
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
          lastTextSnippet = "📷 [Imagem enviada]";
        } else {
          lastTextSnippet = lastMsg.text;
        }
      }

      return {
        id: lead.lead_id,
        name: lead.lead_nome || 'Sem Nome',
        company: lead.lead_empresa || "Contato Omni",
        last: lastTextSnippet,
        time: formatChatListTime(lastDate),
        unread: 0,
        status: status,
        online: false,
        phone: lead.lead_telefone || "",
        email: lead.lead_email || "",
        avatarColor: AVATAR_COLORS[index % AVATAR_COLORS.length],
        ativo_ia: lead.ativo_ia === true
      };
    });
  }, [leadsData, allMessages]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const msgSearchRef = useRef<HTMLInputElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const messages = active ? (allMessages[active] || []) : [];
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
        <mark key={idx} className="rounded bg-accent/40 text-foreground px-0.5 font-semibold">
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
        return <Check className="size-3.5 text-muted-foreground" />;
      case "delivered":
        return <CheckCheck className="size-3.5 text-muted-foreground" />;
      case "read":
        return <CheckCheck className="size-3.5 text-accent" />;
    }
  };

  /* Initials helper */
  const getInitials = (name: string) =>
    name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  return (
    <AppShell title="Atendimentos" subtitle={`${chats.length} conversas${totalUnread > 0 ? ` · ${totalUnread} não lidas` : ""}`} flush>
      <div className="flex h-[calc(100vh-4rem)] bg-background text-foreground font-sans overflow-hidden">
        
        {/* ══════ LEFT SIDEBAR: CHAT LIST ══════ */}
        <section className="flex w-[340px] sm:w-[380px] shrink-0 flex-col border-r border-border bg-card/90 backdrop-blur-xl">
          
          {/* Search + Filters */}
          <div className="border-b border-border p-3.5 space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                id="chat-search-input"
                value={searchChat}
                onChange={(e) => setSearchChat(e.target.value)}
                placeholder="Pesquisar conversa ou cliente..."
                className="h-10 w-full rounded-xl border border-input bg-background pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-all focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
              {filterLabels.map((f, i) => (
                <button
                  key={f}
                  id={`filter-btn-${f.toLowerCase()}`}
                  onClick={() => setFilterTab(i)}
                  className={cn(
                    "rounded-xl px-3 py-1.5 text-xs font-semibold transition-all duration-200 whitespace-nowrap",
                    filterTab === i
                      ? "bg-gradient-to-r from-[#fba834] to-[#f7931e] text-[#0d0d26] font-bold shadow-md shadow-[#fba834]/20"
                      : "bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground border border-border/50",
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* List of Chats */}
          <ul className="flex-1 overflow-y-auto scrollbar-slim divide-y divide-border/40">
            {filteredChats.map((c) => (
              <li key={c.id}>
                <button
                  id={`chat-item-${c.id}`}
                  onClick={() => selectChat(c.id)}
                  className={cn(
                    "flex w-full gap-3.5 px-4 py-3.5 text-left transition-all duration-150 relative group",
                    c.id === active
                      ? "bg-accent/15 border-l-4 border-l-accent"
                      : "hover:bg-secondary/60",
                  )}
                >
                  {/* Avatar */}
                  <span className="relative shrink-0">
                    <span
                      className="grid size-12 place-items-center rounded-2xl text-sm font-bold text-white shadow-md border border-border"
                      style={{ backgroundColor: c.avatarColor }}
                    >
                      {getInitials(c.name)}
                    </span>
                    {c.online && (
                      <span className="absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full border-2 border-card bg-emerald-500" />
                    )}
                  </span>

                  {/* Info */}
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-bold text-foreground group-hover:text-accent transition-colors">
                        {c.name}
                      </span>
                      <span
                        className={cn(
                          "shrink-0 text-[11px] font-medium",
                          c.unread > 0 ? "text-accent font-bold" : "text-muted-foreground",
                        )}
                      >
                        {c.time}
                      </span>
                    </span>

                    <span className="block truncate text-xs text-muted-foreground font-medium">
                      {c.company}
                    </span>

                    <span className="mt-1 flex items-center justify-between gap-2">
                      <span className="truncate text-xs text-muted-foreground">
                        {c.last}
                      </span>
                      {c.unread > 0 && (
                        <span className="grid size-5 shrink-0 animate-pulse place-items-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground shadow-sm">
                          {c.unread}
                        </span>
                      )}
                    </span>
                  </span>
                </button>
              </li>
            ))}

            {filteredChats.length === 0 && (
              <li className="px-4 py-12 text-center space-y-2">
                <MessagesSquare className="size-8 text-muted-foreground/40 mx-auto" />
                <p className="text-sm text-muted-foreground font-medium">Nenhuma conversa encontrada.</p>
              </li>
            )}
          </ul>
        </section>

        {/* ══════ CENTER: CHAT AREA ══════ */}
        <section className={cn("flex min-w-0 flex-1 flex-col relative", showInfoPanel && "border-r border-border")}>
          {chat ? (
            <>
              {/* Chat Header */}
              <header className="flex items-center gap-3.5 border-b border-border bg-card/90 px-5 py-3 backdrop-blur-xl z-10">
                {/* Avatar */}
                <span className="relative shrink-0">
                  <span
                    className="grid size-10 place-items-center rounded-xl text-xs font-bold text-white shadow-md border border-border"
                    style={{ backgroundColor: chat.avatarColor }}
                  >
                    {getInitials(chat.name)}
                  </span>
                  {chat.online && (
                    <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-card bg-emerald-500" />
                  )}
                </span>

                {/* Name & Subtitle */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-bold text-foreground leading-tight">{chat.name}</p>
                  <p className="truncate text-xs text-muted-foreground font-medium">
                    {chat.company} · <span className={chat.online ? "text-emerald-500 font-semibold" : "text-muted-foreground"}>{chat.online ? "Online" : chat.status}</span>
                  </p>
                </div>

                {/* Actions */}
                <button
                  id="btn-msg-search"
                  onClick={() => {
                    setShowMsgSearch((v) => !v);
                    if (showMsgSearch) closeSearch();
                  }}
                  className={cn(
                    "grid size-9 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
                    showMsgSearch && "bg-accent/20 text-accent",
                  )}
                  title="Pesquisar mensagens"
                >
                  <Search className="size-4" />
                </button>

                <button
                  id="btn-info"
                  onClick={() => setShowInfoPanel((v) => !v)}
                  className={cn(
                    "grid size-9 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
                    showInfoPanel && "bg-accent/20 text-accent",
                  )}
                  title="Informações do contato"
                >
                  <Info className="size-4" />
                </button>
              </header>

              {/* Message Search Bar */}
              <div
                className={cn(
                  "overflow-hidden border-b border-border bg-card/90 backdrop-blur-xl transition-all duration-200 z-10",
                  showMsgSearch ? "max-h-14 opacity-100" : "max-h-0 opacity-0",
                )}
              >
                <div className="flex items-center gap-2.5 px-4 py-2.5">
                  <Search className="size-4 shrink-0 text-muted-foreground" />
                  <input
                    ref={msgSearchRef}
                    id="msg-search-input"
                    value={msgSearchQuery}
                    onChange={(e) => setMsgSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") navigateSearch(e.shiftKey ? -1 : 1);
                      if (e.key === "Escape") closeSearch();
                    }}
                    placeholder="Pesquisar mensagens nesta conversa…"
                    className="h-9 flex-1 rounded-xl border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-accent"
                  />
                  {matchingIndices.length > 0 && (
                    <span className="shrink-0 text-xs text-muted-foreground font-semibold">
                      {highlightIdx + 1}/{matchingIndices.length}
                    </span>
                  )}
                  {matchingIndices.length === 0 && msgSearchQuery.trim() && (
                    <span className="shrink-0 text-xs text-muted-foreground">0 resultados</span>
                  )}
                  <button
                    onClick={() => navigateSearch(-1)}
                    className="grid size-7 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-30"
                    disabled={matchingIndices.length === 0}
                  >
                    <ChevronUp className="size-4" />
                  </button>
                  <button
                    onClick={() => navigateSearch(1)}
                    className="grid size-7 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-30"
                    disabled={matchingIndices.length === 0}
                  >
                    <ChevronDown className="size-4" />
                  </button>
                  <button
                    onClick={closeSearch}
                    className="grid size-7 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              </div>

              {/* Messages Area */}
              <div
                ref={messagesContainerRef}
                className="relative flex-1 overflow-y-auto scrollbar-slim bg-background/50"
              >
                {/* Background Ambient Glow */}
                <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-accent/5 rounded-full blur-[140px] pointer-events-none" />
                <div className="absolute inset-0 bg-[radial-gradient(rgba(0,0,0,0.04)_1px,transparent_1px)] dark:bg-[radial-gradient(rgba(255,255,255,0.03)_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />

                <div className="relative space-y-4 px-4 sm:px-8 py-6">
                  {messageGroups.map((group, groupIdx) => (
                    <div key={groupIdx} className="space-y-3">
                      {/* Date Divider Badge */}
                      <div className="flex justify-center py-2">
                        <span className="rounded-full bg-card border border-border px-4 py-1 text-xs font-semibold text-muted-foreground backdrop-blur-md shadow-sm">
                          {group.dateLabel}
                        </span>
                      </div>

                      {/* Messages of this day */}
                      {group.msgs.map((m) => {
                        const i = messages.findIndex((msg) => msg.id === m.id);
                        const isHighlighted = highlightIdx >= 0 && matchingIndices[highlightIdx] === i;
                        const isMatch = matchingIndices.includes(i);
                        const parsedImage = parseImageMessage(m.text);

                        return (
                          <div
                            key={m.id}
                            id={`msg-${i}`}
                            className={cn(
                              "flex transition-all duration-200",
                              m.me ? "justify-end" : "justify-start",
                            )}
                          >
                            <div
                              className={cn(
                                "relative max-w-[85%] sm:max-w-[70%] rounded-2xl p-3 sm:p-3.5 text-sm leading-relaxed shadow-sm backdrop-blur-md transition-all duration-200",
                                m.me
                                  ? "rounded-tr-none bg-accent/20 border border-accent/30 text-foreground"
                                  : "rounded-tl-none bg-card border border-border text-card-foreground",
                                isHighlighted && "ring-2 ring-accent shadow-xl scale-[1.01]",
                                isMatch && !isHighlighted && "ring-1 ring-accent/50",
                              )}
                            >
                              {/* Attachment Preview (if doc/file attachment) */}
                              {m.attachment && (
                                <div className="mb-2.5 flex items-center gap-3 rounded-xl bg-secondary/80 p-2.5 border border-border">
                                  <span className="grid size-9 place-items-center rounded-lg bg-accent/20 text-accent">
                                    {m.attachment.type === "image" ? <ImageIcon className="size-4" /> :
                                     m.attachment.type === "video" ? <Video className="size-4" /> :
                                     <FileText className="size-4" />}
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-xs font-semibold text-foreground">{m.attachment.name}</p>
                                    <p className="text-[10px] text-muted-foreground">{m.attachment.size}</p>
                                  </div>
                                </div>
                              )}

                              {/* Renderizado de Imagem ou Texto */}
                              {parsedImage.isImage && parsedImage.imageUrl ? (
                                <div className="space-y-2.5 my-0.5">
                                  {/* Imagem responsiva */}
                                  <div className="relative group overflow-hidden rounded-xl border border-border/80 bg-black/40 shadow-md">
                                    <img
                                      src={parsedImage.imageUrl}
                                      alt="Imagem do lead"
                                      loading="lazy"
                                      className="max-h-[340px] w-auto max-w-full object-contain rounded-xl transition-transform duration-300 group-hover:scale-[1.01] cursor-pointer"
                                      onClick={() => setModalImageUrl(parsedImage.imageUrl!)}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => setModalImageUrl(parsedImage.imageUrl!)}
                                      className="absolute bottom-2.5 right-2.5 p-2 rounded-xl bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-md hover:bg-black/80"
                                      title="Expandir imagem"
                                    >
                                      <Maximize2 className="size-4" />
                                    </button>
                                  </div>

                                  {/* Caixa da Descrição da IA */}
                                  {parsedImage.description && (
                                    <div className="rounded-xl bg-secondary/80 border border-border/70 p-3 space-y-1 backdrop-blur-sm">
                                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-accent uppercase tracking-wider">
                                        <Sparkles className="size-3.5" />
                                        <span>Descrição da Imagem (IA)</span>
                                      </div>
                                      <p className="text-xs text-foreground/90 leading-relaxed font-medium">
                                        {parsedImage.description}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <p className="pr-14 whitespace-pre-wrap break-words text-foreground font-medium">
                                  {isMatch ? highlightText(m.text, msgSearchQuery) : m.text}
                                </p>
                              )}

                              {/* Time + Status */}
                              <span className="float-right -mb-1 ml-2 mt-1 flex items-center gap-1 text-[10px] text-muted-foreground font-medium">
                                {m.time}
                                {m.me && <ReadIcon status={m.readStatus} />}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}

                  <div ref={messagesEndRef} />
                </div>

                {/* Scroll to Bottom Button */}
                {showScrollBtn && (
                  <button
                    onClick={() => scrollToBottom("smooth")}
                    className="absolute bottom-4 right-6 z-20 grid size-10 place-items-center rounded-full bg-card border border-border text-foreground shadow-xl transition-all hover:bg-accent hover:text-[#0d0d26]"
                  >
                    <ArrowDown className="size-5" />
                  </button>
                )}
              </div>
            </>
          ) : (
            /* EMPTY STATE WHEN NO CHAT IS SELECTED */
            <div className="relative flex min-w-0 flex-1 flex-col items-center justify-center bg-background p-8 text-center overflow-hidden">
              {/* Background Glow */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-accent/5 rounded-full blur-[140px] pointer-events-none" />
              <div className="absolute inset-0 bg-[radial-gradient(rgba(0,0,0,0.03)_1px,transparent_1px)] dark:bg-[radial-gradient(rgba(255,255,255,0.03)_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />

              <div className="relative z-10 flex flex-col items-center max-w-md space-y-4">
                <div className="p-5 rounded-3xl bg-card border border-border backdrop-blur-2xl shadow-2xl text-accent">
                  <MessagesSquare className="size-10" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-xl font-extrabold text-foreground tracking-tight">
                    Central de Atendimentos Omni
                  </h3>
                  <p className="text-sm text-muted-foreground font-medium leading-relaxed">
                    Selecione uma conversa na lista ao lado para visualizar o histórico de mensagens em tempo real.
                  </p>
                </div>
                <div className="pt-2">
                  <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                    </span>
                    Central de Visualização Ativa
                  </span>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* ══════ RIGHT: CONTACT INFO PANEL ══════ */}
        {showInfoPanel && chat && (
          <section className="flex w-[320px] shrink-0 flex-col overflow-y-auto border-l border-border bg-card/90 backdrop-blur-2xl scrollbar-slim animate-in slide-in-from-right-4 fade-in-0 duration-200">
            {/* Panel Header */}
            <div className="flex items-center gap-3 border-b border-border px-4 py-3.5">
              <button
                onClick={() => setShowInfoPanel(false)}
                className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <X className="size-4" />
              </button>
              <p className="text-sm font-bold text-foreground">Informações do Contato</p>
            </div>

            {/* Avatar & Name */}
            <div className="flex flex-col items-center border-b border-border px-4 py-6 text-center">
              <span
                className="grid size-20 place-items-center rounded-2xl text-2xl font-bold text-white shadow-xl border border-border"
                style={{ backgroundColor: chat.avatarColor }}
              >
                {getInitials(chat.name)}
              </span>
              <p className="mt-3 text-base font-bold text-foreground">{chat.name}</p>
              <p className="text-xs text-muted-foreground font-medium">{chat.company}</p>
              <div className="mt-2 flex items-center gap-1.5">
                <span
                  className={cn(
                    "size-2 rounded-full",
                    chat.online ? "bg-emerald-500" : "bg-muted-foreground/30",
                  )}
                />
                <span className="text-xs text-muted-foreground font-medium">
                  {chat.online ? "Online agora" : "Offline"}
                </span>
              </div>
            </div>

            {/* Details */}
            <div className="border-b border-border p-4 space-y-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Dados Cadastrais
              </p>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="grid size-8 place-items-center rounded-xl bg-secondary text-accent border border-border">
                    <Building2 className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] text-muted-foreground font-medium uppercase">Empresa</p>
                    <p className="text-xs font-semibold text-foreground truncate">{chat.company}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="grid size-8 place-items-center rounded-xl bg-secondary text-accent border border-border">
                    <PhoneCall className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] text-muted-foreground font-medium uppercase">Telefone</p>
                    <p className="text-xs font-semibold text-foreground truncate">{chat.phone || "Não informado"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="grid size-8 place-items-center rounded-xl bg-secondary text-accent border border-border">
                    <Mail className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] text-muted-foreground font-medium uppercase">Email</p>
                    <p className="text-xs font-semibold text-foreground truncate">{chat.email || "Não informado"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="grid size-8 place-items-center rounded-xl bg-secondary text-accent border border-border">
                    <MessageCircle className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] text-muted-foreground font-medium uppercase">Status</p>
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold bg-accent/15 text-accent">
                      {chat.status}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="grid size-8 place-items-center rounded-xl bg-secondary text-accent border border-border">
                    <User className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] text-muted-foreground font-medium uppercase">Automação IA</p>
                    <span className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
                      chat.ativo_ia ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground"
                    )}>
                      {chat.ativo_ia ? "Ativa" : "Inativa"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

          </section>
        )}
      </div>

      {/* Modal Lightbox de Imagem */}
      {modalImageUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 sm:p-6 animate-in fade-in-0 duration-200">
          <div className="relative max-w-5xl max-h-[90vh] flex flex-col items-center">
            {/* Fechar */}
            <button
              onClick={() => setModalImageUrl(null)}
              className="absolute -top-12 right-0 p-2 text-white/70 hover:text-white transition-colors"
              title="Fechar (Esc)"
            >
              <X className="size-6" />
            </button>

            {/* Imagem Zoom */}
            <img
              src={modalImageUrl}
              alt="Imagem em tamanho real"
              className="max-h-[80vh] w-auto max-w-full rounded-2xl object-contain shadow-2xl border border-white/10"
            />

            {/* Botão de download / link original */}
            <div className="mt-4 flex gap-3">
              <a
                href={modalImageUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-accent text-[#0d0d26] font-bold text-xs shadow-lg hover:brightness-110 transition-all"
              >
                <ExternalLink className="size-4" />
                Abrir em Nova Aba
              </a>
              <button
                onClick={() => setModalImageUrl(null)}
                className="px-4 py-2 rounded-xl bg-white/10 text-white font-semibold text-xs hover:bg-white/20 transition-all"
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
