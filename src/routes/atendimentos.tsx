import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";
import {
  Search,
  Paperclip,
  Send,

  Info,
  Check,
  CheckCheck,
  X,
  ChevronDown,
  ChevronUp,
  Mic,
  FileText,
  Image as ImageIcon,
  Video,
  Smile,
  MoreVertical,
  ArrowDown,
  Clock,
  Building2,
  Mail,
  PhoneCall,
  User,
  MessageCircle,
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
        content: "Responda clientes em um layout de conversas rápido e organizado.",
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
  readStatus: ReadStatus;
  attachment?: { name: string; size: string; type: "doc" | "image" | "video" };
}

/* ─── Avatar color palette ─── */
const AVATAR_COLORS = [
  "oklch(0.55 0.15 285)",  // purple
  "oklch(0.55 0.14 155)",  // green
  "oklch(0.55 0.16 25)",   // red-orange
  "oklch(0.55 0.14 210)",  // blue
  "oklch(0.55 0.15 330)",  // pink
  "oklch(0.55 0.14 80)",   // amber
  "oklch(0.55 0.15 250)",  // indigo
  "oklch(0.55 0.14 130)",  // teal
];

/* ─── WhatsApp-style SVG wallpaper pattern ─── */
const chatBgStyle: React.CSSProperties = {
  backgroundImage: `url("data:image/svg+xml,%3Csvg width='400' height='400' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3Cpattern id='p' patternUnits='userSpaceOnUse' width='50' height='50'%3E%3Ccircle cx='25' cy='25' r='1.2' fill='%23272757' opacity='0.035'/%3E%3Ccircle cx='0' cy='0' r='0.8' fill='%23272757' opacity='0.025'/%3E%3Ccircle cx='50' cy='50' r='0.8' fill='%23272757' opacity='0.025'/%3E%3Ccircle cx='12' cy='37' r='0.6' fill='%23272757' opacity='0.02'/%3E%3Ccircle cx='37' cy='12' r='0.6' fill='%23272757' opacity='0.02'/%3E%3C/pattern%3E%3C/defs%3E%3Crect width='400' height='400' fill='url(%23p)'/%3E%3C/svg%3E")`,
  backgroundColor: "oklch(0.955 0.008 285)",
};

/* ─── Component ─── */
function Atendimentos() {
  /* State */
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [active, setActive] = useState<string | null>(null);
  const [filterTab, setFilterTab] = useState(0);
  const [searchChat, setSearchChat] = useState("");
  const [showMsgSearch, setShowMsgSearch] = useState(false);
  const [msgSearchQuery, setMsgSearchQuery] = useState("");
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const [msgInput, setMsgInput] = useState("");
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState<{name: string; size: string; type: "doc"|"image"|"video"} | null>(null);
  const [typingChatId, setTypingChatId] = useState<string | null>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  /* React Query: Fetch Leads (Chats) */
  const { data: leadsData = [], error: leadsError, refetch: refetchLeads } = useQuery({
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
  const { data: mensagensData = [], error: mensagensError, refetch: refetchMensagens } = useQuery({
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

  useEffect(() => {
    if (user && leadsData && mensagensData) {
      console.log("Supabase Auth User ID:", user.id);
      console.log("Leads carregados:", leadsData.length);
      console.log("Mensagens carregadas:", mensagensData.length);
      
      if (leadsData.length === 0) {
        toast.info("A query de leads retornou 0 resultados. A RLS pode estar bloqueando ou a tabela está vazia.");
      }
    }
  }, [user, leadsData, mensagensData]);

  /* Debug Function: Add Test Lead */
  const handleDebugAddLead = async () => {
    if (!user) return toast.error("Sem usuário logado!");
    toast.loading("Criando lead de teste...");
    const { data, error } = await supabase.from("leads").insert([
      { 
        lead_nome: "Lead Teste UI", 
        user_id: user.id,
        lead_status: "Aberto",
        lead_telefone: "5511999999999" // Adicionado para evitar erro NOT NULL do banco
      }
    ]);
    toast.dismiss();
    if (error) {
      toast.error("Erro ao inserir: " + error.message);
    } else {
      toast.success("Lead inserido com sucesso!");
      refetchLeads();
    }
  };

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
        time: `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`,
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

      return {
        id: lead.lead_id,
        name: lead.lead_nome || 'Sem Nome',
        company: "Contato Omni",
        last: lastMsg ? lastMsg.text : "Nova conversa...",
        time: lastMsg ? lastMsg.time : "",
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const attachMenuRef = useRef<HTMLDivElement>(null);

  const messages = allMessages[active] || [];
  const chat = chats.find((c) => c.id === active);

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
      .map((m, i) => (m.text.toLowerCase().includes(q) ? i : -1))
      .filter((i) => i !== -1);
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
    scrollToBottom();
  }, [active, scrollToBottom]);

  useEffect(() => {
    scrollToBottom("smooth");
  }, [allMessages[active]?.length, scrollToBottom]);

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
  }, []);

  /* Focus search input */
  useEffect(() => {
    if (showMsgSearch) msgSearchRef.current?.focus();
  }, [showMsgSearch]);

  /* Close attachment menu on outside click */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target as Node)) {
        setShowAttachMenu(false);
      }
    };
    if (showAttachMenu) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showAttachMenu]);

  /* ─── Simulação desabilitada (usando dados reais agora) ─── */

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

  /* Mutação: Enviar Mensagem Real */
  const sendMessageMutation = useMutation({
    mutationFn: async (text: string) => {
      if (!user) throw new Error("Não autenticado");
      const { error } = await supabase.from('mensagens').insert([
        {
          lead_id: active,
          user_id: user.id,
          mensagem_origem: "Usuário",
          mensagem_conteudo: text,
        }
      ]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mensagens'] });
    },
    onError: (err: any) => {
      toast.error("Erro ao enviar: " + err.message);
    }
  });

  const sendMessage = () => {
    if (!active) return;
    const text = msgInput.trim();
    if (!text && !pendingAttachment) return;
    
    // Atualiza optimisticamente a UI (local state não existe mais daquele jeito, o react query cuida)
    // Então chamamos a mutation para persistir no banco real
    sendMessageMutation.mutate(text || (pendingAttachment ? `📎 ${pendingAttachment.name}` : ""));
    
    setMsgInput("");
    setPendingAttachment(null);
  };

  const handleFileSelect = (type: "doc" | "image" | "video") => {
    setShowAttachMenu(false);
    const accept =
      type === "doc" ? ".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv" :
      type === "image" ? "image/*" :
      "video/*";
    if (fileInputRef.current) {
      fileInputRef.current.accept = accept;
      fileInputRef.current.click();
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const sizeKb = Math.round(file.size / 1024);
    const sizeStr = sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${sizeKb} KB`;
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    const type: "doc" | "image" | "video" =
      ["jpg","jpeg","png","gif","webp","svg","bmp"].includes(ext) ? "image" :
      ["mp4","webm","mov","avi","mkv"].includes(ext) ? "video" : "doc";
    setPendingAttachment({ name: file.name, size: sizeStr, type });
    e.target.value = "";
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
        <mark key={idx} className="rounded-sm bg-accent/50 px-0.5 text-inherit">
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
        return <Check className="size-[15px] text-muted-foreground/60" />;
      case "delivered":
        return <CheckCheck className="size-[15px] text-muted-foreground/60" />;
      case "read":
        return <CheckCheck className="size-[15px] text-[oklch(0.6_0.16_230)]" />;
    }
  };

  /* Initials helper */
  const getInitials = (name: string) =>
    name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  return (
    <AppShell title="Atendimentos" subtitle={`${chats.length} conversas${totalUnread > 0 ? ` · ${totalUnread} não lidas` : ""}`} flush>
      <div className="flex h-[calc(100vh-4rem)]">
        {/* ══════ LEFT SIDEBAR ══════ */}
        <section className="flex w-[360px] shrink-0 flex-col border-r border-border bg-card">
          {/* Search + filters */}
          <div className="border-b border-border px-3 pb-3 pt-3">
            <div className="flex items-center gap-2 mb-2">
              <button 
                onClick={handleDebugAddLead}
                className="w-full bg-accent text-accent-foreground py-1 px-2 text-xs font-bold rounded hover:bg-accent/80"
              >
                + DEBUG: Inserir Lead de Teste
              </button>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                id="chat-search-input"
                value={searchChat}
                onChange={(e) => setSearchChat(e.target.value)}
                placeholder="Pesquisar ou começar uma nova conversa"
                className="h-9 w-full rounded-lg border-0 bg-secondary pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-accent/30"
              />
            </div>
            <div className="mt-2.5 flex gap-1.5">
              {filterLabels.map((f, i) => (
                <button
                  key={f}
                  id={`filter-btn-${f.toLowerCase()}`}
                  onClick={() => setFilterTab(i)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-semibold transition-all duration-200",
                    filterTab === i
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground",
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Chat list */}
          <ul className="flex-1 overflow-y-auto scrollbar-slim">
            {filteredChats.map((c) => (
              <li key={c.id}>
                <button
                  id={`chat-item-${c.id}`}
                  onClick={() => selectChat(c.id)}
                  className={cn(
                    "flex w-full gap-3 border-b border-border/50 px-3 py-3 text-left transition-all duration-150",
                    c.id === active
                      ? "bg-primary-soft border-l-[3px] border-l-accent"
                      : "hover:bg-secondary/60",
                  )}
                >
                  {/* Avatar */}
                  <span className="relative">
                    <span
                      className="grid size-[50px] shrink-0 place-items-center rounded-full text-sm font-bold text-white"
                      style={{ backgroundColor: c.avatarColor }}
                    >
                      {getInitials(c.name)}
                    </span>
                    {/* Online indicator */}
                    {c.online && (
                      <span className="absolute bottom-0 right-0 size-3.5 rounded-full border-2 border-card bg-[oklch(0.7_0.18_145)]" />
                    )}
                  </span>

                  {/* Content */}
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[15px] font-semibold leading-tight">
                        {c.name}
                      </span>
                      <span
                        className={cn(
                          "shrink-0 text-[11px]",
                          c.unread > 0 ? "font-semibold text-accent" : "text-muted-foreground",
                        )}
                      >
                        {c.time}
                      </span>
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {c.company}
                    </span>
                    <span className="mt-0.5 flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1 truncate text-[13px] text-muted-foreground">
                        {/* Show typing indicator or last message */}
                        {typingChatId === c.id ? (
                          <span className="text-accent italic text-xs">digitando…</span>
                        ) : (
                          <>
                            {c.id === active && <CheckCheck className="size-4 shrink-0 text-[oklch(0.6_0.16_230)]" />}
                            {c.last}
                          </>
                        )}
                      </span>
                      {c.unread > 0 && (
                        <span className="grid size-[22px] shrink-0 animate-pulse place-items-center rounded-full bg-accent text-[11px] font-bold text-accent-foreground shadow-sm">
                          {c.unread}
                        </span>
                      )}
                    </span>
                  </span>
                </button>
              </li>
            ))}
            {filteredChats.length === 0 && (
              <li className="px-4 py-8 text-center text-sm text-muted-foreground">
                Nenhuma conversa encontrada.
              </li>
            )}
          </ul>
        </section>

        {/* ══════ CENTER: CHAT AREA ══════ */}
        <section className={cn("flex min-w-0 flex-1 flex-col", showInfoPanel && "border-r border-border")}>
          {chat ? (
            <>
              {/* Chat header */}
              <header className="flex items-center gap-3 border-b border-border bg-card px-4 py-2">
                {/* Avatar */}
                <span className="relative">
                  <span
                    className="grid size-10 place-items-center rounded-full text-sm font-bold text-white"
                    style={{ backgroundColor: chat.avatarColor }}
                  >
                    {getInitials(chat.name)}
                  </span>
                  {chat.online && (
                    <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-card bg-[oklch(0.7_0.18_145)]" />
                  )}
                </span>

                {/* Name & info */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-bold leading-tight">{chat.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {typingChatId === active ? (
                      <span className="text-accent font-medium">digitando…</span>
                    ) : (
                      <>{chat.company} · {chat.online ? <span className="text-[oklch(0.6_0.16_145)]">online</span> : chat.status}</>
                    )}
                  </p>
                </div>

                {/* Header actions */}
                <button
                  id="btn-msg-search"
                  onClick={() => {
                    setShowMsgSearch((v) => !v);
                    if (showMsgSearch) closeSearch();
                  }}
                  className={cn(
                    "grid size-10 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
                    showMsgSearch && "bg-secondary text-foreground",
                  )}
                  title="Pesquisar mensagens"
                >
                  <Search className="size-[18px]" />
                </button>

                <button
                  id="btn-info"
                  onClick={() => setShowInfoPanel((v) => !v)}
                  className={cn(
                    "grid size-10 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
                    showInfoPanel && "bg-secondary text-foreground",
                  )}
                  title="Informações do contato"
                >
                  <Info className="size-[18px]" />
                </button>
                <button
                  id="btn-criar-negocio"
                  className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent/90"
                >
                  Criar negócio
                </button>
              </header>
            </>
          ) : (
            <header className="flex h-[57px] items-center gap-3 border-b border-border bg-card px-4 py-2">
              <p className="text-sm text-muted-foreground">Selecione uma conversa</p>
            </header>
          )}

          {/* Message search bar */}
          <div
            className={cn(
              "overflow-hidden border-b border-border bg-card transition-all duration-200",
              showMsgSearch ? "max-h-14 opacity-100" : "max-h-0 opacity-0",
            )}
          >
            <div className="flex items-center gap-2 px-4 py-2">
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
                placeholder="Pesquisar mensagens…"
                className="h-8 flex-1 rounded-md border-0 bg-secondary px-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-accent/30"
              />
              {matchingIndices.length > 0 && (
                <span className="shrink-0 text-xs text-muted-foreground">
                  {highlightIdx + 1}/{matchingIndices.length}
                </span>
              )}
              {matchingIndices.length === 0 && msgSearchQuery.trim() && (
                <span className="shrink-0 text-xs text-muted-foreground">
                  0 resultados
                </span>
              )}
              <button
                onClick={() => navigateSearch(-1)}
                className="grid size-7 place-items-center rounded text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-40"
                disabled={matchingIndices.length === 0}
              >
                <ChevronUp className="size-4" />
              </button>
              <button
                onClick={() => navigateSearch(1)}
                className="grid size-7 place-items-center rounded text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-40"
                disabled={matchingIndices.length === 0}
              >
                <ChevronDown className="size-4" />
              </button>
              <button
                onClick={closeSearch}
                className="grid size-7 place-items-center rounded text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          {/* Messages area */}
          <div
            ref={messagesContainerRef}
            className="relative flex-1 overflow-y-auto scrollbar-slim"
            style={chatBgStyle}
          >
            {/* Gradient overlay */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/[0.02] to-transparent" />

            <div className="relative space-y-1 px-[7%] py-4">
              {/* Date label */}
              <div className="flex justify-center py-2">
                <span className="rounded-lg bg-card/90 px-3 py-1 text-[11px] font-medium text-muted-foreground shadow-sm backdrop-blur-sm">
                  Hoje
                </span>
              </div>

              {messages.map((m, i) => {
                const isHighlighted = highlightIdx >= 0 && matchingIndices[highlightIdx] === i;
                const isMatch = matchingIndices.includes(i);

                return (
                  <div
                    key={m.id}
                    id={`msg-${i}`}
                    className={cn(
                      "flex transition-all duration-300",
                      m.me ? "justify-end" : "justify-start",
                    )}
                  >
                    <div
                      className={cn(
                        "relative max-w-[65%] rounded-lg px-3 py-1.5 text-[14.2px] leading-[19px] shadow-sm transition-all duration-300",
                        m.me
                          ? "rounded-tr-none bg-[oklch(0.88_0.04_120)] text-card-foreground"
                          : "rounded-tl-none bg-card text-card-foreground",
                        isHighlighted && "ring-2 ring-accent shadow-md scale-[1.01]",
                        isMatch && !isHighlighted && "ring-1 ring-accent/40",
                      )}
                    >
                      {/* Bubble tail */}
                      <span
                        className={cn(
                          "absolute top-0 size-0",
                          m.me
                            ? "-right-2 border-l-[8px] border-t-[8px] border-l-transparent border-t-[oklch(0.88_0.04_120)]"
                            : "-left-2 border-r-[8px] border-t-[8px] border-r-transparent border-t-card",
                        )}
                      />

                      {/* Attachment preview inside bubble */}
                      {m.attachment && (
                        <div className="mb-1.5 flex items-center gap-2 rounded-md bg-black/5 px-2.5 py-2">
                          <span className="grid size-8 place-items-center rounded-lg bg-accent/20 text-accent">
                            {m.attachment.type === "image" ? <ImageIcon className="size-4" /> :
                             m.attachment.type === "video" ? <Video className="size-4" /> :
                             <FileText className="size-4" />}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-medium">{m.attachment.name}</p>
                            <p className="text-[10px] text-muted-foreground">{m.attachment.size}</p>
                          </div>
                        </div>
                      )}

                      {/* Message text (supports multiline) */}
                      <p className="pr-16 whitespace-pre-wrap break-words">
                        {isMatch ? highlightText(m.text, msgSearchQuery) : m.text}
                      </p>

                      {/* Timestamp + read receipt */}
                      <span className="float-right -mb-1 ml-2 mt-1 flex items-center gap-1 text-[11px] text-muted-foreground/70">
                        {m.time}
                        {m.me && <ReadIcon status={m.readStatus} />}
                      </span>
                    </div>
                  </div>
                );
              })}

              {/* Typing indicator */}
              {typingChatId === active && (
                <div className="flex justify-start">
                  <div className="relative rounded-lg rounded-tl-none bg-card px-4 py-3 shadow-sm">
                    <span className="-left-2 absolute top-0 size-0 border-r-[8px] border-t-[8px] border-r-transparent border-t-card" />
                    <div className="flex items-center gap-1.5">
                      <span className="size-2 animate-bounce rounded-full bg-muted-foreground/50" style={{ animationDelay: "0ms" }} />
                      <span className="size-2 animate-bounce rounded-full bg-muted-foreground/50" style={{ animationDelay: "150ms" }} />
                      <span className="size-2 animate-bounce rounded-full bg-muted-foreground/50" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Scroll to bottom button */}
            {showScrollBtn && (
              <button
                onClick={() => scrollToBottom("smooth")}
                className="absolute bottom-4 right-6 z-10 grid size-10 place-items-center rounded-full bg-card text-muted-foreground shadow-lg transition-all hover:bg-secondary hover:text-foreground"
              >
                <ArrowDown className="size-5" />
                {chats.find(c => c.id === active)?.unread ? (
                  <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground">
                    {chats.find(c => c.id === active)?.unread}
                  </span>
                ) : null}
              </button>
            )}
          </div>

          {/* Attachment preview bar */}
          {pendingAttachment && (
            <div className="flex items-center gap-3 border-t border-border bg-card px-4 py-2">
              <span className="grid size-10 place-items-center rounded-lg bg-accent/10 text-accent">
                {pendingAttachment.type === "image" ? <ImageIcon className="size-5" /> :
                 pendingAttachment.type === "video" ? <Video className="size-5" /> :
                 <FileText className="size-5" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{pendingAttachment.name}</p>
                <p className="text-xs text-muted-foreground">{pendingAttachment.size}</p>
              </div>
              <button
                onClick={() => setPendingAttachment(null)}
                className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
          )}

          {/* Footer — message input */}
          <footer className="border-t border-border bg-card px-4 py-2.5">
            <div className="flex items-end gap-2">

              {/* Attachment button */}
              <div className="relative" ref={attachMenuRef}>
                <button
                  id="btn-attach"
                  onClick={() => setShowAttachMenu((v) => !v)}
                  className={cn(
                    "grid size-[42px] shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
                    showAttachMenu && "bg-secondary text-foreground",
                  )}
                  title="Anexar arquivo"
                >
                  <Paperclip className="size-[22px] rotate-45" />
                </button>

                {/* Attachment popup menu */}
                {showAttachMenu && (
                  <div className="absolute bottom-14 left-0 z-30 flex flex-col gap-1 rounded-xl bg-card p-2 shadow-pop border border-border min-w-[200px] animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2">
                    <button
                      id="attach-document"
                      onClick={() => handleFileSelect("doc")}
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-secondary"
                    >
                      <span className="grid size-9 place-items-center rounded-full bg-[oklch(0.55_0.14_285)] text-white">
                        <FileText className="size-4" />
                      </span>
                      Documento
                    </button>
                    <button
                      id="attach-image"
                      onClick={() => handleFileSelect("image")}
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-secondary"
                    >
                      <span className="grid size-9 place-items-center rounded-full bg-[oklch(0.55_0.16_230)] text-white">
                        <ImageIcon className="size-4" />
                      </span>
                      Imagem
                    </button>
                    <button
                      id="attach-video"
                      onClick={() => handleFileSelect("video")}
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-secondary"
                    >
                      <span className="grid size-9 place-items-center rounded-full bg-[oklch(0.55_0.14_155)] text-white">
                        <Video className="size-4" />
                      </span>
                      Vídeo
                    </button>
                  </div>
                )}
              </div>

              {/* Hidden file input */}
              <input ref={fileInputRef} type="file" className="hidden" onChange={onFileChange} />

              {/* Message input */}
              <div className="relative min-w-0 flex-1">
                <textarea
                  id="msg-input"
                  rows={1}
                  value={msgInput}
                  onChange={(e) => setMsgInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder="Digite uma mensagem"
                  className="max-h-[120px] min-h-[42px] w-full resize-none rounded-lg border-0 bg-secondary px-4 py-2.5 text-[15px] outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-accent/20"
                />
              </div>

              {/* Send / Mic button */}
              {msgInput.trim() || pendingAttachment ? (
                <button
                  id="btn-send"
                  onClick={sendMessage}
                  className="grid size-[42px] shrink-0 place-items-center rounded-full bg-accent text-accent-foreground transition-all duration-200 hover:bg-accent/90 hover:shadow-md active:scale-95"
                  title="Enviar mensagem"
                >
                  <Send className="size-5" />
                </button>
              ) : (
                <button
                  id="btn-mic"
                  className="grid size-[42px] shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  title="Gravar áudio"
                >
                  <Mic className="size-[22px]" />
                </button>
              )}
            </div>
          </footer>
        </section>

        {/* ══════ RIGHT: CONTACT INFO PANEL ══════ */}
        {showInfoPanel && chat && (
          <section className="flex w-[340px] shrink-0 flex-col overflow-y-auto border-l border-border bg-card scrollbar-slim animate-in slide-in-from-right-4 fade-in-0 duration-200">
            {/* Panel header */}
            <div className="flex items-center gap-3 border-b border-border px-4 py-3">
              <button
                onClick={() => setShowInfoPanel(false)}
                className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <X className="size-4" />
              </button>
              <p className="text-sm font-semibold">Informações do contato</p>
            </div>

            {/* Avatar & name section */}
            <div className="flex flex-col items-center border-b border-border px-4 py-6">
              <span
                className="grid size-[80px] place-items-center rounded-full text-2xl font-bold text-white shadow-md"
                style={{ backgroundColor: chat.avatarColor }}
              >
                {getInitials(chat.name)}
              </span>
              <p className="mt-3 text-lg font-bold">{chat.name}</p>
              <p className="text-sm text-muted-foreground">{chat.company}</p>
              <div className="mt-1.5 flex items-center gap-1.5">
                <span
                  className={cn(
                    "size-2 rounded-full",
                    chat.online ? "bg-[oklch(0.7_0.18_145)]" : "bg-muted-foreground/40",
                  )}
                />
                <span className="text-xs text-muted-foreground">
                  {chat.online ? "Online agora" : "Offline"}
                </span>
              </div>
            </div>

            {/* Contact details */}
            <div className="border-b border-border px-4 py-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Informações
              </p>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="grid size-9 place-items-center rounded-lg bg-secondary text-muted-foreground">
                    <Building2 className="size-4" />
                  </span>
                  <div>
                    <p className="text-xs text-muted-foreground">Empresa</p>
                    <p className="text-sm font-medium">{chat.company}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="grid size-9 place-items-center rounded-lg bg-secondary text-muted-foreground">
                    <PhoneCall className="size-4" />
                  </span>
                  <div>
                    <p className="text-xs text-muted-foreground">Telefone</p>
                    <p className="text-sm font-medium">{chat.phone}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="grid size-9 place-items-center rounded-lg bg-secondary text-muted-foreground">
                    <Mail className="size-4" />
                  </span>
                  <div>
                    <p className="text-xs text-muted-foreground">Email</p>
                    <p className="text-sm font-medium">{chat.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="grid size-9 place-items-center rounded-lg bg-secondary text-muted-foreground">
                    <MessageCircle className="size-4" />
                  </span>
                  <div>
                    <p className="text-xs text-muted-foreground">Status</p>
                    <span className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
                      chat.status === "Aberto" && "bg-accent/15 text-accent",
                      chat.status === "Pendente" && "bg-[oklch(0.9_0.08_68)] text-[oklch(0.5_0.15_68)]",
                      chat.status === "Resolvido" && "bg-[oklch(0.92_0.05_155)] text-[oklch(0.45_0.14_155)]",
                    )}>
                      {chat.status}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="grid size-9 place-items-center rounded-lg bg-secondary text-muted-foreground">
                    <User className="size-4" />
                  </span>
                  <div>
                    <p className="text-xs text-muted-foreground">Automação IA</p>
                    <span className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
                      chat.ativo_ia ? "bg-[oklch(0.55_0.14_155)]/15 text-[oklch(0.55_0.14_155)]" : "bg-muted text-muted-foreground"
                    )}>
                      {chat.ativo_ia ? "Ativo" : "Inativo"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Shared media section */}
            <div className="border-b border-border px-4 py-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Mídias compartilhadas
              </p>
              <div className="grid grid-cols-3 gap-1.5">
                {[1, 2, 3].map((n) => (
                  <div
                    key={n}
                    className="aspect-square rounded-lg bg-secondary flex items-center justify-center text-muted-foreground/30"
                  >
                    <ImageIcon className="size-6" />
                  </div>
                ))}
              </div>
              <button className="mt-2 w-full text-center text-xs font-medium text-accent hover:underline">
                Ver todos →
              </button>
            </div>

            {/* Quick actions */}
            <div className="px-4 py-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Ações rápidas
              </p>
              <div className="space-y-1.5">
                <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-secondary">
                  <User className="size-4 text-muted-foreground" />
                  Ver perfil completo
                </button>
                <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-secondary">
                  <Clock className="size-4 text-muted-foreground" />
                  Histórico de atendimentos
                </button>
                <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10">
                  <X className="size-4" />
                  Encerrar conversa
                </button>
              </div>
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}
