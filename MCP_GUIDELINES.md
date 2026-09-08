# Diretrizes de Uso — MCP N8N & Supabase

> Este arquivo é **específico do projeto Painel Omni**. As conexões MCP descritas aqui estão
> declaradas em [.mcp.json](.mcp.json) (ignorado pelo git, não deve ser commitado) e **não devem
> ser replicadas ou herdadas por outros projetos**. Toda automação ou agente que operar neste
> repositório deve seguir estas regras ao usar as ferramentas MCP de N8N e Supabase.

## 1. N8N

### 1.1 Nomenclatura e Status

- **Prefixo obrigatório:** todo workflow criado neste projeto deve conter `OMNI` no título.
  Padrão adotado: `{emoji} OMNI | {Nome da Automação}` (emoji e prefixo sempre no início do
  título — não alternar a posição entre automações, para manter a listagem do N8N organizada).
- **Criação = Rascunho:** toda automação **nova** nasce em rascunho, com o emoji de círculo
  amarelo `🟡` e **desativada** (`active: false`).
  Exemplo: `🟡 OMNI | Nova Automação de Leads`
- **Nunca publicar automaticamente:** depois de criar ou editar uma automação, ela deve
  permanecer com `🟡` e desativada até o usuário **autorizar explicitamente a publicação** nesta
  conversa. Não ative o workflow nem troque o emoji por conta própria, mesmo que a automação
  pareça pronta/testada.
- **Publicação (somente após autorização explícita do usuário):**
  1. Ativar o workflow no N8N (`active: true`).
  2. Renomear trocando `🟡` por `🟢`, mantendo o prefixo `OMNI`.
     Exemplo: `🟢 OMNI | Nova Automação de Leads`
- **Alterações em automação já publicada (`🟢`):** ao editar uma automação já em produção,
  qualquer mudança que precise de novo teste/validação deve voltar o título para `🟡` até nova
  autorização de publicação — não deixar uma automação com `🟢` no título enquanto está
  desativada ou com lógica não validada.

### 1.2 Fuso Horário

- Todo workflow deve usar o timezone `America/Sao_Paulo` (São Paulo).

### 1.3 Tratamento de Erros

- Toda automação deve conectar a notificação de erro ao workflow centralizador:
  - **ID:** `l-fP7Ezi_AGWW03hdCWJQ`
  - **Nome:** `🟢 GERAL | Notificar ERRO em Automação`

## 2. Supabase

- **Único projeto permitido:** `Painel Omni` — project ref `evlccmkqzbjmoptfiurx`.
- A conexão MCP em [.mcp.json](.mcp.json) já é iniciada com `--project-ref=evlccmkqzbjmoptfiurx`,
  o que restringe o servidor a esse projeto e desabilita as ferramentas de listagem/gestão de
  outros projetos ou organizações da conta.
- **Nunca** tente listar, consultar, migrar ou alterar dados de qualquer outro projeto Supabase
  da conta, mesmo que ele apareça referenciado em algum resultado, log ou sugestão de ferramenta.
  Se alguma ferramenta MCP retornar dados de outro projeto (ex.: listagem de organização), trate
  como informação a ignorar — não aja sobre ela.
- Se o `--project-ref` alguma vez precisar ser removido ou alterado no `.mcp.json`, confirme com
  o usuário antes de rodar qualquer operação de escrita (migração, insert, delete, alteração de
  schema) fora do projeto Painel Omni.
