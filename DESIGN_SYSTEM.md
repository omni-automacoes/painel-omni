# Design System & Diretrizes de UI — Omni Automações

Este documento define o **Design System oficial da Omni Automações** para o Painel Omni e todos os sistemas internos derivados. Todos os novos componentes, páginas e dashboards devem seguir estas diretrizes visuais para manter consistência, sofisticação e alta usabilidade.

---

## 🎨 1. Paleta de Cores e Temas (Dark Theme Futuristic)

O tema oficial é essencialmente **Dark Futuristic / High-Tech Glassmorphism**, combinando tons escuros profundos com acentos em dourado/laranja vibrante.

| Elemento | Código HEX / Tailwind | Descrição / Aplicação |
| :--- | :--- | :--- |
| **Fundo Principal (Canvas)** | `#080819` ou `#0d0d26` | Fundo geral da aplicação e páginas. |
| **Card / Superfície (Glass)** | `#12122d`/80 ou `#16163a`/60 | Cards com `backdrop-blur-2xl` e bordas sutis. |
| **Acento Primário (Brand)** | `#fba834` | Botões primários, destaques, bordas de foco e ícones principais. |
| **Gradiente Primário** | `from-[#fba834] to-[#f7931e]` | Botões de ação e títulos destacados. |
| **Acento Secundário (Glow)** | `#272757` / `#1d1d4d` | Luzes difusas de fundo (*ambient glow*) e gradientes de apoio. |
| **Status Ativo / Sucesso** | `#10b981` (Emerald-500) | Badges de status operacionais, indicadores pulsantes e confirmações. |
| **Bordas e Divisores** | `border-white/10` ou `border-white/5` | Linhas finas e elegantes para separar seções sem sobrecarregar. |
| **Texto Primário** | `#ffffff` | Títulos, rótulos importantes e valores principais. |
| **Texto Secundário** | `text-white/70` ou `text-white/50` | Subtítulos, descrições breves e rótulos de campos. |

---

## 📐 2. Layout & Estrutura de Páginas (Preenchimento Total / Full-Width)

- **Preenchimento Total Obligatório (Full Width):** As páginas internas e dashboards **NÃO devem conter limitações arbitrárias de largura máxima** (como `max-w-6xl`, `max-w-4xl` ou `max-w-[1100px]`) que centralizam o conteúdo e geram grandes lacunas vazias nas laterais.
- **Aproveitamento de Tela:** O conteúdo deve ocupar 100% da largura útil disponível (`w-full`), expandindo-se de maneira fluida e responsiva.
- **Espaçamento e Margens:** Utilizar espaçamento padronizado em todas as rotas (`p-6` ou `p-8`) sem lacunas excessivas entre o menu lateral e o conteúdo da página.

---

## 🗂️ 3. Menu Lateral (Sidebar Navigation)

- **Estado Padrão:** O menu lateral sempre inicia **colapsado (recolhido)** por padrão (`w-[78px]`) para maximizar a área de trabalho.
- **Logo Oficial:** Utilização da logo oficial `/LOGO OMNI (1).png` (emblemática no estado colapsado e completa quando expandido).
- **Interatividade & Efeitos:**
  - Item Ativo: Indicador lateral em gradiente dourado (`#fba834`) com fundo translúcido suave.
  - Hover & Tooltips: Exibição de tooltips flutuantes suspensos ao passar o cursor sobre os ícones no estado recolhido.
  - Alternador de Expansão: Botão inferior com transição suave (`w-[250px]`).

---

## 🔤 4. Tipografia e Hierarquia Visual

- **Fonte Padrão:** Sans-serif moderna e limpa (`font-sans`, Inter / Plus Jakarta Sans).
- **Sem poluição visual:** Manter textos curtos, diretos e objetivos. Evitar blocos longos de texto.
- **Hierarquia:**
  - **Títulos de Impacto:** `font-extrabold tracking-tight` com gradiente de texto (`bg-clip-text text-transparent`).
  - **Cabeçalhos de Cards:** `font-bold text-white tracking-tight`.
  - **Rólutos / Labels:** `text-xs font-semibold text-white/70 uppercase` ou `tracking-wide`.

---

## 🌌 5. Efeitos Visuais & Ambient Lighting

1. **Ambient Glow (Luzes Difusas):**
   - Esferas suaves de iluminação no fundo usando `blur-[120px]` a `blur-[160px]`.
   - Laranja: `bg-[#fba834]/10` | Roxo/Índigo: `bg-[#272757]/40`.
2. **Grid Pattern Overlay:**
   - Textura sutil de pontos ou grade no background:  
     `bg-[radial-gradient(rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:24px_24px]`.
3. **Glassmorphism (Efeito Vidro Jateado):**
   - Containers principais com `bg-[#12122d]/80 backdrop-blur-2xl border border-white/10 shadow-2xl`.
   - Linha de brilho no topo do card (`h-[2px] bg-gradient-to-r from-transparent via-[#fba834]/60 to-transparent`).

---

## 🔐 6. Padrão de Autenticação & Telas de Login

Telas de login e portal de acesso devem seguir o modelo estabelecido em `/login`:

- **Split-Grid Layout (Desktop):** Lado esquerdo com branding, status do sistema e proposta visual; lado direito com o formulário em card glassmorphic.
- **Micro Status Indicators:** Badges visuais com luz pulsante (`animate-ping bg-emerald-400`) para indicar "100% Operacional".
- **Formulário Enxuto:**
  - Inputs com altura `h-12`, fundo escuro `#0a0a1e`/90, ícone prefixado à esquerda (`Mail`, `KeyRound`) que ganha a cor `#fba834` no foco.
  - Alternador de visibilidade de senha (ícone de olho).
  - Botão de ação largo em gradiente vibrante com ícone de seta (`ArrowRight`) com animação no hover (`group-hover:translate-x-1`).
  - Selo discreto de segurança no rodapé: `🔒 Ambiente Protegido & Autenticado`.

---

## 🧩 7. Componentes de UI Recomendados

### Botão Primário
```tsx
<button className="group relative flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#fba834] to-[#f7931e] px-4 font-bold text-[#0d0d26] transition-all duration-200 hover:brightness-110 active:scale-[0.99] shadow-lg shadow-[#fba834]/20 hover:shadow-[#fba834]/35">
  <span>Texto do Botão</span>
  <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
</button>
```

### Input de Formulário
```tsx
<div className="relative group/input">
  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40 group-focus-within/input:text-[#fba834] transition-colors">
    <Icon className="size-4" />
  </div>
  <input
    className="h-12 w-full rounded-xl border border-white/10 bg-[#0a0a1e]/90 pl-10 pr-4 text-sm text-white placeholder-white/25 outline-none transition-all focus:border-[#fba834] focus:ring-2 focus:ring-[#fba834]/20"
  />
</div>
```

### Badge de Status Ativo
```tsx
<span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
  <span className="relative flex h-2 w-2">
    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
  </span>
  100% Operacional
</span>
```

---

*Este guia é a referência obrigatória para todos os novos layouts e páginas desenvolvidas na Omni Automações.*
