<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Uso das Ferramentas MCP (N8N e Supabase)

Ao usar as conexões MCP deste projeto (declaradas em [.mcp.json](.mcp.json)) para criar/editar
automações no N8N ou consultar/alterar dados no Supabase, siga estritamente as regras do arquivo
[MCP_GUIDELINES.md](MCP_GUIDELINES.md) — em especial: nunca publicar/ativar uma automação N8N sem
autorização explícita do usuário, e nunca acessar no Supabase nenhum projeto além do `Painel Omni`
(`evlccmkqzbjmoptfiurx`).

## Diretrizes de Lançamentos Financeiros & Validação de Dados

- **Confirmação Obrigatória em Casos de Dúvida:** Sempre que houver qualquer dúvida ou ambiguidade sobre dados financeiros (como classificação de lançamento recorrente vs pontual, datas exatas de vencimento/recebimento, status pago vs pendente, ou valores de clientes/fornecedores), **pergunte e confirme diretamente com o usuário antes de cadastrar**, nunca assumindo dados por conta própria.
- **Projeção de Recorrências:** Ao cadastrar receitas ou despesas recorrentes, manter o agrupamento por `recorrente_grupo_id` e a projeção automática mensal (12 meses por padrão), respeitando o status do mês inicial e marcando os meses futuros como `pendente`.

## Diretrizes Visuais & Design System (UI/UX)

Ao criar ou editar qualquer tela, componente ou dashboard nos sistemas internos da Omni Automações, siga estritamente as especificações do arquivo [DESIGN_SYSTEM.md](file:///c:/Users/rodri/Documents/OMNI%20AUTOMA%C3%87%C3%95ES/SISTEMAS%20%28SAAS%29/PAINEL%20OMNI/painel-omni/DESIGN_SYSTEM.md):

- **Tema:** Dark Futuristic / High-Tech Glassmorphism (`#080819` / `#0d0d26`).
- **Acento Primário:** Dourado/Laranja `#fba834` (Gradiente: `from-[#fba834] to-[#f7931e]`).
- **Layout Obrigatório (Full Width):** As páginas devem preencher 100% da largura útil disponível (`w-full`), sem contêineres com `max-w-6xl` ou `max-w-4xl` que gerem margens/lacunas vazias.
- **Sidebar:** Inicia colapsado por padrão (`w-[78px]`), com logo oficial, tooltips e alternador de expansão.
- **Componentes:** Visual enxuto, direto e sem acúmulo de texto. Utilização de glassmorphism (`backdrop-blur-2xl bg-[#12122d]/80 border-white/10`), luzes difusas de fundo (*ambient glow*) e badges de status operacionais com indicador pulsante (`animate-ping bg-emerald-400`).
