# painel-omni

Atue como um Especialista Sênior em UI/UX Design. O seu objetivo é projetar a interface e a estrutura de layout para um sistema web voltado para a gestão centralizada de pequenas empresas. 

O nome do sistema é **"Omni"**. 

Diretrizes Visuais e Paleta de Cores Obrigatória:

- Cor Primária/Base: #272757 (Dark Navy Blue)

- Cor de Destaque/Ação: #fba834 (Orange Navy)

- Textos e Elementos de Contraste: Preto e Branco

O design deve ser moderno, limpo (clean), com alto contraste para leitura e focado na facilidade de uso para usuários não-técnicos.

Estrutura Geral de Navegação (Layout Base):

O sistema deve possuir um menu de navegação constante (lateral ou superior) com os seguintes itens, na exata ordem: Visão Geral, Negócios, Atendimentos, Tarefas, Financeiro, Relatório Geral e Configurações. Especifique como o menu deve se comportar e onde a paleta de cores deve ser aplicada para guiar a atenção do usuário.

Detalhe o layout, a disposição dos elementos na tela, a hierarquia visual e os componentes de interface (cards, botões, tabelas, modais) para as seguintes páginas:

1. VISÃO GERAL (Dashboard)

- Layout da tela inicial.

- Estrutura para exibir métricas relevantes do sistema de forma rápida (cards de resumo).

- Sugira a disposição visual para equilibrar dados de vendas, tarefas e financeiro.

2. NEGÓCIOS (CRM/Vendas)

- Estrutura principal baseada em um quadro Kanban de ponta a ponta na tela.

- Como devem ser os cards de cada negócio dentro do Kanban.

- Onde devem ficar posicionados os filtros de pesquisa dos negócios.

- Estrutura da "Página do Negócio" interna (aberta ao clicar em um card), detalhando como dividir as informações do cliente e o histórico da negociação.

3. ATENDIMENTOS (Suporte/Relacionamento)

- Layout Master-Detail, inspirado no padrão "WhatsApp Web".

- Coluna lateral com o menu/lista de conversas.

- Área principal contendo a janela com a conversa completa (espelho da conversa entre atendimento e cliente).

- Posicionamento da área de digitação e envio de mensagens.

4. TAREFAS

- Layout para uma lista ou quadro de tarefas.

- Disposição dos filtros (por prioridade, data de vencimento e responsável).

- Indicadores visuais claros para os status: Pendente, Concluído e Em Andamento.

- Formulário ou modal lateral/flutuante para cadastro e edição de novas tarefas.

5. FINANCEIRO

- Estrutura principal exibindo Despesas e Receitas de forma clara.

- Layout para separação de visualização por mês.

- Posição e estilo do Gráfico Anual de resultados financeiros.

6. RELATÓRIO GERAL

- Layout limpo focado em visualização de dados.

- Onde e como exibir os relatórios de métricas importantes sobre operações e vendas (gráficos, tabelas de exportação, filtros de período).

7. CONFIGURAÇÕES

- Layout dividido em abas (tabs) ou seções verticais claras.

- Área 1: Informações do Usuário Logado (visualização e botões de edição).

- Área 2: Interface para gerenciamento/adição de novos usuários.

- Área 3: Interface para listagem, cadastro e edição de "Motivos de Perda" (para o funil de negócios).

Por favor, descreva a estrutura de layout de cada página detalhadamente. Não especifique ferramentas de código ou linguagens de programação, foque apenas na arquitetura de informação, comportamento da tela e na aplicação inteligente das 4 cores obrigatórias para criar uma experiência de usuário (UX) perfeita.

This project is built for **Omni**.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
