const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "src/routes/atendimentos.tsx");
let content = fs.readFileSync(filePath, "utf8");

// 1. Remover blocos mock
content = content.replace(/\/\* ─── Mock Data ─── \*\/[\s\S]*?(?=\/\* ─── WhatsApp-style SVG wallpaper pattern ─── \*\/)/, "");

// 2. Substituir o state inicial em Atendimentos()
const stateTarget = `  /* State */
  const [active, setActive] = useState<number>(1);
  const [filterTab, setFilterTab] = useState(0);
  const [searchChat, setSearchChat] = useState("");
  const [showMsgSearch, setShowMsgSearch] = useState(false);
  const [msgSearchQuery, setMsgSearchQuery] = useState("");
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const [msgInput, setMsgInput] = useState("");
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState<{name: string; size: string; type: "doc"|"image"|"video"} | null>(null);
  const [typingChatId, setTypingChatId] = useState<number | null>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  const [chats, setChats] = useState<Chat[]>(mockChats);
  const [allMessages, setAllMessages] = useState<Record<number, Message[]>>(mockMessages);`;

const stateReplacement = `  /* State */
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
  const { data: leadsData = [] } = useQuery({
    queryKey: ['leads'],
    queryFn: async () => {
      const { data, error } = await supabase.from('leads').select('*').order('criado_em', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  /* React Query: Fetch Messages */
  const { data: mensagensData = [] } = useQuery({
    queryKey: ['mensagens'],
    queryFn: async () => {
      const { data, error } = await supabase.from('mensagens').select('*').order('criado_em', { ascending: true });
      if (error) throw error;
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
        time: \`\${date.getHours().toString().padStart(2, '0')}:\${date.getMinutes().toString().padStart(2, '0')}\`,
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
        avatarColor: AVATAR_COLORS[index % AVATAR_COLORS.length]
      };
    });
  }, [leadsData, allMessages]);
`;

content = content.replace(stateTarget, stateReplacement);

// 3. Substituir a Notification Simulation (remover setTimeout de mock)
const simulationTarget = `  /* ─── Notification simulation ─── */
  useEffect(() => {
    const interval = setInterval(() => {
      const otherChats = chats.filter((c) => c.id !== active);
      if (otherChats.length === 0) return;
      const randomChat = otherChats[Math.floor(Math.random() * otherChats.length)];
      const randomMsg = incomingPool[Math.floor(Math.random() * incomingPool.length)];
      const now = new Date();
      const timeStr = \`\${now.getHours().toString().padStart(2, "0")}:\${now.getMinutes().toString().padStart(2, "0")}\`;

      // Show typing indicator briefly
      setTypingChatId(randomChat.id);

      setTimeout(() => {
        setTypingChatId(null);

        // Add the message
        const newMsg: Message = {
          id: \`inc-\${Date.now()}\`,
          me: false,
          text: randomMsg,
          time: timeStr,
          readStatus: "delivered",
        };

        setAllMessages((prev) => ({
          ...prev,
          [randomChat.id]: [...(prev[randomChat.id] || []), newMsg],
        }));

        // Update chat preview and unread count
        setChats((prev) =>
          prev.map((c) =>
            c.id === randomChat.id
              ? { ...c, last: randomMsg, time: timeStr, unread: c.unread + 1 }
              : c,
          ),
        );

        // Toast notification
        toast(randomChat.name, {
          description: randomMsg.length > 60 ? randomMsg.slice(0, 60) + "…" : randomMsg,
          duration: 4000,
          icon: (
            <span
              className="grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold text-white"
              style={{ backgroundColor: randomChat.avatarColor }}
            >
              {randomChat.name.split(" ").map((n) => n[0]).join("")}
            </span>
          ),
        });
      }, 1500 + Math.random() * 1000);
    }, 18000 + Math.random() * 12000);

    return () => clearInterval(interval);
  }, [active, chats]);`;

const simulationReplacement = `  /* ─── Simulação desabilitada (usando dados reais agora) ─── */`;
content = content.replace(simulationTarget, simulationReplacement);

// 4. Update 'selectChat'
const selectChatTarget = `  const selectChat = (id: number) => {
    setActive(id);
    closeSearch();
    setShowInfoPanel(false);

    // Mark as read
    setChats((prev) =>
      prev.map((c) => (c.id === id ? { ...c, unread: 0 } : c)),
    );

    // Mark all incoming messages as read
    setAllMessages((prev) => ({
      ...prev,
      [id]: (prev[id] || []).map((m) =>
        !m.me ? { ...m, readStatus: "read" as ReadStatus } : m,
      ),
    }));
  };`;

const selectChatReplacement = `  const selectChat = (id: string) => {
    setActive(id);
    closeSearch();
    setShowInfoPanel(false);
  };`;
content = content.replace(selectChatTarget, selectChatReplacement);

// 5. Update 'sendMessage'
const sendMsgTarget = `  const sendMessage = () => {
    const text = msgInput.trim();
    if (!text && !pendingAttachment) return;

    const now = new Date();
    const timeStr = \`\${now.getHours().toString().padStart(2, "0")}:\${now.getMinutes().toString().padStart(2, "0")}\`;
    const newMsg: Message = {
      id: \`sent-\${Date.now()}\`,
      me: true,
      text: text || (pendingAttachment ? \`📎 \${pendingAttachment.name}\` : ""),
      time: timeStr,
      readStatus: "sent",
      attachment: pendingAttachment || undefined,
    };

    setAllMessages((prev) => ({
      ...prev,
      [active]: [...(prev[active] || []), newMsg],
    }));

    setChats((prev) =>
      prev.map((c) =>
        c.id === active
          ? { ...c, last: text || \`📎 \${pendingAttachment?.name}\`, time: timeStr }
          : c,
      ),
    );

    setMsgInput("");
    setPendingAttachment(null);

    // Simulate read status progression
    const msgId = newMsg.id;
    setTimeout(() => {
      setAllMessages((prev) => ({
        ...prev,
        [active]: (prev[active] || []).map((m) =>
          m.id === msgId ? { ...m, readStatus: "delivered" as ReadStatus } : m,
        ),
      }));
    }, 1200);

    setTimeout(() => {
      setAllMessages((prev) => ({
        ...prev,
        [active]: (prev[active] || []).map((m) =>
          m.id === msgId ? { ...m, readStatus: "read" as ReadStatus } : m,
        ),
      }));
    }, 3000);
  };`;

const sendMsgReplacement = `  /* Mutação: Enviar Mensagem Real */
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
    sendMessageMutation.mutate(text || (pendingAttachment ? \`📎 \${pendingAttachment.name}\` : ""));
    
    setMsgInput("");
    setPendingAttachment(null);
  };`;
content = content.replace(sendMsgTarget, sendMsgReplacement);

// 6. Typo in statusMap? "const statusMap: Record<number, string> = { 1: "Aberto", 2: "Pendente", 3: "Resolvido" };" is ok, but later the logic should be updated?
// Actually in the filter labels: filterTab is index.
// filterLabels = ["Todos", "Abertos", "Pendentes", "Resolvidos"];
// so 1 = Abertos -> "Aberto"

fs.writeFileSync(filePath, content);
console.log("Arquivo atendimentos.tsx refatorado com sucesso!");
