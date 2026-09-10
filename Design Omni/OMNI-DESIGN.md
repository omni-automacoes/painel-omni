# OMNI DESIGN SYSTEM — Guia de implementação

> **Para a IA que está lendo este arquivo:** este é o padrão visual obrigatório da
> **Omni Automações**. Ele não é uma sugestão de estilo — é uma especificação.
> Todo valor de cor, tamanho, raio e espaçamento usado na interface tem que sair
> daqui. Não invente tons "parecidos", não arredonde números, não troque a fonte.
> Se algo que você precisa não existe neste documento, use o token mais próximo e
> avise o usuário — não crie um valor novo por conta própria.

Versão 1.0 · Montserrat · tema claro (padrão) + escuro · densidade confortável.

---

## 1. Como aplicar este padrão

Existem três cenários. Identifique qual é o seu antes de escrever código.

### Cenário A — os arquivos CSS vieram junto

Se a pasta do projeto contém `omni-tokens.css` e `omni-components.css`,
**eles são a fonte da verdade.** Importe os dois e use as classes `omni-*`.
Não recrie nada que já existe neles e não sobrescreva os valores.

```html
<link rel="stylesheet" href="css/omni-tokens.css">
<link rel="stylesheet" href="css/omni-components.css">
<link rel="stylesheet"
  href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700;800&display=swap">
<body class="omni"> ... </body>
```

### Cenário B — só este arquivo `.md` foi fornecido

Gere você mesmo o `omni-tokens.css` copiando **literalmente** o bloco da seção 4
deste documento, e construa os componentes seguindo o contrato da seção 5.
Os valores da seção 4 são exatos: copie, não redigite.

### Cenário C — projeto React com Tailwind

Importe `omni-tokens.css` no entrypoint de CSS e use o preset
`tailwind/omni-preset.js`, que mapeia os mesmos tokens para classes utilitárias
(`bg-primary`, `text-ink-2`, `border-line`, `rounded-lg`, `h-control`…).

```js
// tailwind.config.js
import omni from './tailwind/omni-preset.js'
export default { presets: [omni], content: ['./src/**/*.{ts,tsx}'] }
```

Se o projeto usa outra biblioteca de componentes (shadcn/ui, MUI, Chakra),
**não troque a biblioteca** — reconfigure o tema dela para apontar para estes
tokens e ajuste altura, raio e peso de fonte conforme a seção 5.

---

## 2. As oito regras inegociáveis

São elas que fazem sistemas diferentes parecerem o mesmo produto.

1. **Nenhum hex solto no código.** Toda cor sai de um token `--omni-*`.
   Um `#fff` ou `#333` escrito à mão em um componente é um bug.
2. **Uma ação primária por tela.** O resto é secundário, fantasma ou link.
3. **Laranja `#fba834` no máximo uma vez por tela, sempre com texto escuro.**
   Branco sobre laranja dá 1,95:1 e reprova qualquer critério de acessibilidade.
4. **Estado nunca é só cor.** Sempre cor + rótulo, e ícone quando for crítico.
5. **Números sempre `tabular-nums`**, e alinhados à direita quando estão em coluna.
6. **Cor de série segue a entidade, não a posição no ranking.** Se um filtro muda
   a ordem, as cores dos que sobraram não podem trocar.
7. **Nunca dois eixos Y no mesmo gráfico.** Duas medidas de escalas diferentes
   viram dois gráficos, ou são indexadas a uma base comum.
8. **Separação por borda de 1px, não por sombra.** Sombra só no que flutua
   (menu, popover, modal, aviso flutuante).

---

## 3. Identidade

| Elemento | Valor | Papel no sistema |
|---|---|---|
| Navy | `#272757` | Ação primária, texto de marca |
| Riviera | `#63b4d8` | Informação, gráficos, estados neutros positivos |
| Laranja | `#fba834` | Acento raro: CTA comercial, aviso |
| Titânio | `#565f6b` | Texto secundário |
| Tipografia | **Montserrat** 300–800 | Única família do sistema |

**Sobre a Agency FB:** é fonte de sistema Windows, sem licença web. Em Mac,
celular ou Linux o navegador a substituiria silenciosamente por outra, quebrando
o padrão. **Não use Agency FB em interface.** Ela continua válida para peças
gráficas e impressos, fora da web.

**Hierarquia é feita por peso e tamanho, não por família.** Títulos em 700/800,
interface em 400/500, rótulos em caixa alta 600 com `letter-spacing: 0.08em`.

---

## 4. Tokens (copiar literalmente)

Este é o conteúdo exato de `omni-tokens.css`. Se você precisar gerar o arquivo,
copie este bloco inteiro, sem alterar nenhum valor.

```css

/* =========================================================================
   OMNI DESIGN SYSTEM — Tokens
   Fonte da verdade de cor, tipografia, espaçamento, raio, elevação e motion.
   Versão 1.0 · Montserrat · tema claro (padrão) + escuro
   -------------------------------------------------------------------------
   Como usar:
     <link rel="stylesheet" href="css/omni-tokens.css">
     <link rel="stylesheet" href="css/omni-components.css">
   Regra de ouro: componentes NUNCA usam hex direto. Sempre var(--omni-*).
   ========================================================================= */

/* -------------------------------------------------------------------------
   1. RAMPAS DE MARCA (valores brutos, iguais nos dois temas)
   ------------------------------------------------------------------------- */
:root {
  /* Indigo — derivado do Navy da marca (#272757 = indigo-850) */
  --omni-indigo-50:  #f4f4fb;
  --omni-indigo-100: #e9e9f6;
  --omni-indigo-200: #d0d0ec;
  --omni-indigo-300: #b0b0de;
  --omni-indigo-400: #8b8bd0;
  --omni-indigo-500: #6161c2;
  --omni-indigo-600: #4646b8;
  --omni-indigo-700: #363691;
  --omni-indigo-800: #2f2f6f;
  --omni-indigo-850: #272757; /* NAVY DA MARCA */
  --omni-indigo-900: #1e1e46;
  --omni-indigo-950: #15152f;

  /* Sky — derivado do Riviera da marca (#63b4d8 = sky-400) */
  --omni-sky-50:  #f2f9fd;
  --omni-sky-100: #e5f4fa;
  --omni-sky-200: #c9e6f3;
  --omni-sky-300: #9fd2e8;
  --omni-sky-400: #63b4d8; /* RIVIERA DA MARCA */
  --omni-sky-500: #3ba0cb;
  --omni-sky-600: #1189c0;
  --omni-sky-700: #176e94;
  --omni-sky-800: #175874;
  --omni-sky-900: #144154;
  --omni-sky-950: #0e2b38;

  /* Amber — derivado do Laranja da marca (#fba834 = amber-400) */
  --omni-amber-50:  #fef9f0;
  --omni-amber-100: #fdf1dd;
  --omni-amber-200: #fbe0b3;
  --omni-amber-300: #fcc86f;
  --omni-amber-400: #fba834; /* LARANJA DA MARCA */
  --omni-amber-500: #ef9310;
  --omni-amber-600: #d98a12;
  --omni-amber-700: #a86a12;
  --omni-amber-800: #7d5013;
  --omni-amber-900: #573912;
  --omni-amber-950: #3a260c;

  /* Slate — derivado do Titânio da marca (#565f6b = slate-700) */
  --omni-slate-50:  #f7f8fa;
  --omni-slate-100: #eef0f4;
  --omni-slate-200: #e0e3ea;
  --omni-slate-300: #ccd1da;
  --omni-slate-400: #a3abb9;
  --omni-slate-500: #7f8897;
  --omni-slate-600: #6b7484;
  --omni-slate-700: #565f6b; /* TITÂNIO DA MARCA */
  --omni-slate-800: #3f4753;
  --omni-slate-850: #2e353f;
  --omni-slate-900: #1f242e;
  --omni-slate-950: #141922;

  /* Apoio semântico */
  --omni-green-100: #e4f6ec;
  --omni-green-300: #7fd3aa;
  --omni-green-500: #2a9d67;
  --omni-green-600: #17985c;
  --omni-green-700: #1a7a50;
  --omni-green-900: #10402c;

  --omni-red-100: #fdeaeb;
  --omni-red-300: #f0a3a8;
  --omni-red-500: #d9505a;
  --omni-red-600: #c72933;
  --omni-red-700: #a01f28;
  --omni-red-900: #4c1418;

  --omni-violet-500: #a855c9;
  --omni-violet-600: #a466cf;
  --omni-teal-500:   #0e9594;
  --omni-teal-600:   #12a09d;
}

/* -------------------------------------------------------------------------
   2. TOKENS SEMÂNTICOS — TEMA CLARO (padrão)
   ------------------------------------------------------------------------- */
:root {
  color-scheme: light;

  /* Superfícies */
  --omni-bg:            #f7f8fa;
  --omni-bg-subtle:     #eef0f4;
  --omni-surface:       #ffffff;
  --omni-surface-2:     #f7f8fa;
  --omni-surface-3:     #eef0f4;
  --omni-surface-inset: #f2f4f7;
  --omni-overlay:       rgba(20, 25, 34, 0.45);

  /* Bordas */
  --omni-border:        #e3e6ec;
  --omni-border-subtle: #eef0f4;
  --omni-border-strong: #ccd1da;

  /* Texto */
  --omni-text:          #1a2030;
  --omni-text-2:        #565f6b;
  --omni-text-3:        #6b7484;
  --omni-text-faint:    #98a1b0;
  --omni-text-inverse:  #ffffff;
  --omni-text-link:     #363691;

  /* Ação primária — Navy da marca */
  --omni-primary:        #272757;
  --omni-primary-hover:  #33336e;
  --omni-primary-active: #1e1e46;
  --omni-primary-fg:     #ffffff;
  --omni-primary-soft:   #eeeef8;
  --omni-primary-soft-fg:#363691;
  --omni-primary-ring:   rgba(54, 54, 145, 0.30);

  /* Acento — Laranja da marca (uso raro: CTA e destaque) */
  --omni-accent:         #fba834;
  --omni-accent-hover:   #ef9310;
  --omni-accent-active:  #d98a12;
  --omni-accent-fg:      #3a260c; /* texto escuro: branco sobre laranja reprova AA */
  --omni-accent-soft:    #fdf1dd;
  --omni-accent-soft-fg: #a86a12;

  /* Status */
  --omni-success:      #1a7a50;
  --omni-success-soft: #e4f6ec;
  --omni-success-fg:   #14603f;
  --omni-warning:      #a86a12;
  --omni-warning-soft: #fdf1dd;
  --omni-warning-fg:   #7d5013;
  --omni-danger:       #c72933;
  --omni-danger-hover: #a01f28;
  --omni-danger-soft:  #fdeaeb;
  --omni-danger-fg:    #a01f28;
  --omni-info:         #1189c0;
  --omni-info-soft:    #e5f4fa;
  --omni-info-fg:      #176e94;

  /* Foco */
  --omni-focus: #4646b8;

  /* Elevação — deliberadamente discreta; a borda é o separador principal */
  --omni-shadow-xs: 0 1px 2px rgba(26, 32, 48, 0.04);
  --omni-shadow-sm: 0 1px 2px rgba(26, 32, 48, 0.05), 0 1px 3px rgba(26, 32, 48, 0.04);
  --omni-shadow-md: 0 2px 4px rgba(26, 32, 48, 0.05), 0 6px 16px rgba(26, 32, 48, 0.07);
  --omni-shadow-lg: 0 8px 24px rgba(26, 32, 48, 0.10), 0 2px 6px rgba(26, 32, 48, 0.05);

  /* Gráficos — paleta categórica validada (Δ CVD e contraste conferidos) */
  --omni-chart-1: #4646b8; /* indigo   — marca */
  --omni-chart-2: #d98a12; /* âmbar    — marca */
  --omni-chart-3: #1189c0; /* riviera  — marca */
  --omni-chart-4: #2a9d67; /* verde */
  --omni-chart-5: #a855c9; /* violeta */
  --omni-chart-6: #c72933; /* vermelho */
  --omni-chart-7: #0e9594; /* teal */
  --omni-chart-grid: #eef0f4;
  --omni-chart-axis: #ccd1da;
  --omni-chart-surface: #ffffff;

  /* Rampa sequencial (magnitude contínua) — hue único indigo */
  --omni-seq-1: #e9e9f6;
  --omni-seq-2: #c4c4e6;
  --omni-seq-3: #9494d3;
  --omni-seq-4: #6161c2;
  --omni-seq-5: #4646b8;
  --omni-seq-6: #363691;
  --omni-seq-7: #272757;

  /* Rampa divergente (polaridade) — âmbar ← neutro → indigo */
  --omni-div-neg-2: #d98a12;
  --omni-div-neg-1: #fbe0b3;
  --omni-div-mid:   #e3e6ec;
  --omni-div-pos-1: #b0b0de;
  --omni-div-pos-2: #4646b8;
}

/* -------------------------------------------------------------------------
   3. TOKENS SEMÂNTICOS — TEMA ESCURO
   Definido em dois escopos: preferência do SO e escolha explícita do usuário.
   ------------------------------------------------------------------------- */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    color-scheme: dark;

    --omni-bg:            #0b0f1a;
    --omni-bg-subtle:     #0f1421;
    --omni-surface:       #121826;
    --omni-surface-2:     #18202f;
    --omni-surface-3:     #1e2739;
    --omni-surface-inset: #0e131f;
    --omni-overlay:       rgba(5, 8, 14, 0.65);

    --omni-border:        #242e42;
    --omni-border-subtle: #1a2231;
    --omni-border-strong: #35415a;

    --omni-text:          #e9edf4;
    --omni-text-2:        #a6b0c2;
    --omni-text-3:        #8b95a8;
    --omni-text-faint:    #6b7688;
    --omni-text-inverse:  #0b0f1a;
    --omni-text-link:     #b0b0de;

    --omni-primary:        #6161c2;
    --omni-primary-hover:  #7373cd;
    --omni-primary-active: #4646b8;
    --omni-primary-fg:     #ffffff;
    --omni-primary-soft:   #1d2140;
    --omni-primary-soft-fg:#b0b0de;
    --omni-primary-ring:   rgba(139, 139, 208, 0.40);

    --omni-accent:         #fba834;
    --omni-accent-hover:   #fcc86f;
    --omni-accent-active:  #ef9310;
    --omni-accent-fg:      #2a1a05;
    --omni-accent-soft:    #33240d;
    --omni-accent-soft-fg: #fcc86f;

    --omni-success:      #17985c;
    --omni-success-soft: #10281f;
    --omni-success-fg:   #7fd3aa;
    --omni-warning:      #d98a12;
    --omni-warning-soft: #2e2109;
    --omni-warning-fg:   #fcc86f;
    --omni-danger:       #d9505a;
    --omni-danger-hover: #e4737b;
    --omni-danger-soft:  #2e1418;
    --omni-danger-fg:    #f0a3a8;
    --omni-info:         #3ba0cb;
    --omni-info-soft:    #0f2836;
    --omni-info-fg:      #9fd2e8;

    --omni-focus: #8b8bd0;

    --omni-shadow-xs: 0 1px 2px rgba(0, 0, 0, 0.35);
    --omni-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.40), 0 1px 3px rgba(0, 0, 0, 0.30);
    --omni-shadow-md: 0 2px 4px rgba(0, 0, 0, 0.40), 0 6px 16px rgba(0, 0, 0, 0.45);
    --omni-shadow-lg: 0 8px 28px rgba(0, 0, 0, 0.55), 0 2px 6px rgba(0, 0, 0, 0.40);

    --omni-chart-1: #6a6ad4;
    --omni-chart-2: #bd811a;
    --omni-chart-3: #2f93c6;
    --omni-chart-4: #17985c;
    --omni-chart-5: #a466cf;
    --omni-chart-6: #d9505a;
    --omni-chart-7: #12a09d;
    --omni-chart-grid: #1e2739;
    --omni-chart-axis: #35415a;
    --omni-chart-surface: #121826;

    --omni-seq-1: #1d2140;
    --omni-seq-2: #2b2f63;
    --omni-seq-3: #3a3e88;
    --omni-seq-4: #4d4faa;
    --omni-seq-5: #6161c2;
    --omni-seq-6: #8b8bd0;
    --omni-seq-7: #b0b0de;

    --omni-div-neg-2: #bd811a;
    --omni-div-neg-1: #573912;
    --omni-div-mid:   #2e353f;
    --omni-div-pos-1: #3a3e88;
    --omni-div-pos-2: #6a6ad4;
  }
}

:root[data-theme="dark"] {
  color-scheme: dark;

  --omni-bg:            #0b0f1a;
  --omni-bg-subtle:     #0f1421;
  --omni-surface:       #121826;
  --omni-surface-2:     #18202f;
  --omni-surface-3:     #1e2739;
  --omni-surface-inset: #0e131f;
  --omni-overlay:       rgba(5, 8, 14, 0.65);

  --omni-border:        #242e42;
  --omni-border-subtle: #1a2231;
  --omni-border-strong: #35415a;

  --omni-text:          #e9edf4;
  --omni-text-2:        #a6b0c2;
  --omni-text-3:        #8b95a8;
  --omni-text-faint:    #6b7688;
  --omni-text-inverse:  #0b0f1a;
  --omni-text-link:     #b0b0de;

  --omni-primary:        #6161c2;
  --omni-primary-hover:  #7373cd;
  --omni-primary-active: #4646b8;
  --omni-primary-fg:     #ffffff;
  --omni-primary-soft:   #1d2140;
  --omni-primary-soft-fg:#b0b0de;
  --omni-primary-ring:   rgba(139, 139, 208, 0.40);

  --omni-accent:         #fba834;
  --omni-accent-hover:   #fcc86f;
  --omni-accent-active:  #ef9310;
  --omni-accent-fg:      #2a1a05;
  --omni-accent-soft:    #33240d;
  --omni-accent-soft-fg: #fcc86f;

  --omni-success:      #17985c;
  --omni-success-soft: #10281f;
  --omni-success-fg:   #7fd3aa;
  --omni-warning:      #d98a12;
  --omni-warning-soft: #2e2109;
  --omni-warning-fg:   #fcc86f;
  --omni-danger:       #d9505a;
  --omni-danger-hover: #e4737b;
  --omni-danger-soft:  #2e1418;
  --omni-danger-fg:    #f0a3a8;
  --omni-info:         #3ba0cb;
  --omni-info-soft:    #0f2836;
  --omni-info-fg:      #9fd2e8;

  --omni-focus: #8b8bd0;

  --omni-shadow-xs: 0 1px 2px rgba(0, 0, 0, 0.35);
  --omni-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.40), 0 1px 3px rgba(0, 0, 0, 0.30);
  --omni-shadow-md: 0 2px 4px rgba(0, 0, 0, 0.40), 0 6px 16px rgba(0, 0, 0, 0.45);
  --omni-shadow-lg: 0 8px 28px rgba(0, 0, 0, 0.55), 0 2px 6px rgba(0, 0, 0, 0.40);

  --omni-chart-1: #6a6ad4;
  --omni-chart-2: #bd811a;
  --omni-chart-3: #2f93c6;
  --omni-chart-4: #17985c;
  --omni-chart-5: #a466cf;
  --omni-chart-6: #d9505a;
  --omni-chart-7: #12a09d;
  --omni-chart-grid: #1e2739;
  --omni-chart-axis: #35415a;
  --omni-chart-surface: #121826;

  --omni-seq-1: #1d2140;
  --omni-seq-2: #2b2f63;
  --omni-seq-3: #3a3e88;
  --omni-seq-4: #4d4faa;
  --omni-seq-5: #6161c2;
  --omni-seq-6: #8b8bd0;
  --omni-seq-7: #b0b0de;

  --omni-div-neg-2: #bd811a;
  --omni-div-neg-1: #573912;
  --omni-div-mid:   #2e353f;
  --omni-div-pos-1: #3a3e88;
  --omni-div-pos-2: #6a6ad4;
}

/* -------------------------------------------------------------------------
   4. TIPOGRAFIA
   Família única: Montserrat. Hierarquia por peso, tamanho e tracking.
   ------------------------------------------------------------------------- */
:root {
  --omni-font: "Montserrat", "Segoe UI", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif;
  --omni-font-mono: "SFMono-Regular", "JetBrains Mono", Consolas, "Liberation Mono", monospace;

  --omni-text-2xs: 0.6875rem; /* 11px — micro rótulos */
  --omni-text-xs:  0.75rem;   /* 12px — legendas, meta */
  --omni-text-sm:  0.8125rem; /* 13px — texto denso, tabela */
  --omni-text-base:0.875rem;  /* 14px — padrão de interface */
  --omni-text-md:  1rem;      /* 16px — corpo de leitura */
  --omni-text-lg:  1.125rem;  /* 18px — subtítulo */
  --omni-text-xl:  1.25rem;   /* 20px — título de seção */
  --omni-text-2xl: 1.5rem;    /* 24px — título de página */
  --omni-text-3xl: 1.875rem;  /* 30px — KPI grande */
  --omni-text-4xl: 2.5rem;    /* 40px — display */
  --omni-text-5xl: 3.5rem;    /* 56px — hero */

  --omni-weight-light:     300;
  --omni-weight-regular:   400;
  --omni-weight-medium:    500;
  --omni-weight-semibold:  600;
  --omni-weight-bold:      700;
  --omni-weight-extrabold: 800;

  --omni-leading-tight:   1.15;
  --omni-leading-snug:    1.3;
  --omni-leading-normal:  1.5;
  --omni-leading-relaxed: 1.65;

  --omni-tracking-tight:  -0.02em;
  --omni-tracking-snug:   -0.01em;
  --omni-tracking-normal: 0;
  --omni-tracking-wide:   0.04em;
  --omni-tracking-label:  0.08em; /* rótulos em caixa alta */
}

/* -------------------------------------------------------------------------
   5. ESPAÇAMENTO, RAIO, TAMANHOS E MOTION
   Grade base de 4px. Densidade: confortável.
   ------------------------------------------------------------------------- */
:root {
  --omni-space-0: 0;
  --omni-space-1: 0.25rem;  /*  4 */
  --omni-space-2: 0.5rem;   /*  8 */
  --omni-space-3: 0.75rem;  /* 12 */
  --omni-space-4: 1rem;     /* 16 */
  --omni-space-5: 1.25rem;  /* 20 */
  --omni-space-6: 1.5rem;   /* 24 */
  --omni-space-8: 2rem;     /* 32 */
  --omni-space-10: 2.5rem;  /* 40 */
  --omni-space-12: 3rem;    /* 48 */
  --omni-space-16: 4rem;    /* 64 */
  --omni-space-20: 5rem;    /* 80 */
  --omni-space-24: 6rem;    /* 96 */

  --omni-radius-xs:   4px;
  --omni-radius-sm:   6px;
  --omni-radius-md:   8px;
  --omni-radius-lg:   10px; /* padrão de cards e campos */
  --omni-radius-xl:   14px;
  --omni-radius-2xl:  20px;
  --omni-radius-full: 999px;

  --omni-control-sm: 32px;
  --omni-control-md: 38px; /* padrão */
  --omni-control-lg: 44px;
  --omni-row-height: 44px; /* linha de tabela — densidade confortável */
  --omni-sidebar-w:  248px;
  --omni-topbar-h:   60px;
  --omni-container:  1240px;
  --omni-prose:      68ch;

  --omni-border-width: 1px;

  --omni-dur-fast: 120ms;
  --omni-dur-base: 180ms;
  --omni-dur-slow: 280ms;
  --omni-ease: cubic-bezier(0.2, 0, 0.13, 1);
  --omni-ease-out: cubic-bezier(0.16, 1, 0.3, 1);

  --omni-z-base: 1;
  --omni-z-sticky: 100;
  --omni-z-dropdown: 200;
  --omni-z-overlay: 300;
  --omni-z-modal: 310;
  --omni-z-toast: 400;
  --omni-z-tooltip: 500;
}

@media (prefers-reduced-motion: reduce) {
  :root {
    --omni-dur-fast: 1ms;
    --omni-dur-base: 1ms;
    --omni-dur-slow: 1ms;
  }
}

```

---

## 5. Contrato de componentes

Use estes nomes de classe. Um projeto que renomeia as classes deixa de ser
compatível com os outros.

### Base

| Classe | O que faz |
|---|---|
| `body.omni` ou `.omni-root` | Aplica fundo, cor, fonte e antialiasing |
| `.omni-sr` | Texto só para leitor de tela |
| `:focus-visible` | Contorno de 2px em `--omni-focus`, offset 2px — **nunca remover** |

### Tipografia

`.omni-display` (56/800) · `.omni-h1` (40/800) · `.omni-h2` (24/700) ·
`.omni-h3` (20/700) · `.omni-h4` (16/600) · `.omni-h5` (14/600) ·
`.omni-eyebrow` (11/600 caixa alta) · `.omni-lead` (16/1.65) · `.omni-p` ·
`.omni-small` (12) · `.omni-muted` · `.omni-strong` · `.omni-num` (tabular) ·
`.omni-link` · `.omni-code` · `.omni-kbd` · `.omni-divider`

### Layout

`.omni-stack` (coluna, gap 16) · `.omni-stack-2` · `.omni-stack-6` ·
`.omni-row` · `.omni-row-tight` · `.omni-spread` (space-between) ·
`.omni-grid` + `.omni-grid-2|3|4` · `.omni-scroll-x`

Layout de aplicação: `.omni-app` › `.omni-app__side` + `.omni-app__main` ›
`.omni-app__top` + `.omni-app__content`.

### Botões — altura 38px, raio 8px

```html
<button class="omni-btn omni-btn--primary">Publicar</button>
```

| Variação | Quando usar |
|---|---|
| `--primary` | A única ação principal da tela |
| `--secondary` | Ações comuns, borda + fundo de superfície |
| `--accent` | CTA comercial. Laranja com texto escuro. Máximo um por tela |
| `--ghost` | Ações de apoio, cancelar, ícone isolado |
| `--danger` | Só o que destrói dados |
| `--quiet` | Parece link, ocupa espaço de botão |

Modificadores: `--sm` (32px) · `--lg` (44px) · `--icon` (quadrado) · `--block`.
Estados: `disabled` · `data-loading="true"` (mostra spinner, esconde o texto).
Agrupamento: `.omni-btn-group` com `aria-pressed` no item ativo.

### Formulários — campo 38px, raio 8px

`.omni-field` › `.omni-label` (+ `.omni-req` para obrigatório) › campo ›
`.omni-hint` ou `.omni-error`.

Campos: `.omni-input` · `.omni-select` · `.omni-textarea` ·
`.omni-input-group` (ícone à esquerda ou `.omni-suffix` à direita) ·
`.omni-check` · `.omni-radio-item` · `.omni-switch`.

Erro: `aria-invalid="true"` no campo + `.omni-error` com ícone.
**O texto do erro diz como resolver**, nunca "ocorreu um erro".

### Cards — raio 10px, borda 1px, sombra `xs`

`.omni-card` (+ `--flat` sem sombra · `--raised` para o que flutua ·
`--inset` para bloco de apoio dentro de outro card) ›
`.omni-card__header` · `.omni-card__body` · `.omni-card__footer`.

**Nem tudo é card.** Card marca um objeto que existe de verdade. Agrupamento
interno usa só espaço e uma linha divisória.

### Indicadores (KPI)

`.omni-stat` › `.omni-stat__label` (caixa alta 11px) ·
`.omni-stat__value` (30px/800, tabular) · `.omni-stat__foot`.
Variação: `.omni-trend--up|--down|--flat`.

**A seta nunca aparece sozinha** — sempre com o número da variação e o período
comparado ("+12,4% vs. ontem"). "Subiu" sem referência não informa nada.

### Tabelas — linha 44px, texto 13px

`.omni-table-wrap` › `.omni-table-scroll` › `.omni-table`.
Células: `.omni-td-strong` (identidade da linha) · `.omni-td-num` (direita,
tabular) · `.omni-td-actions`. Cabeçalho: `.omni-th-num` · `.omni-th-sort`
com `aria-sort`. Rodapé: `.omni-table__foot` com contagem + `.omni-pagination`.

Estados obrigatórios de toda tabela: **carregando** (`.omni-skeleton` com a
mesma altura de linha, para a página não pular) e **vazio** (`.omni-empty`,
dizendo o que fazer, não só que está vazio).

### Status, badges e tags

`.omni-badge` + `--success|--warning|--danger|--info|--brand|--accent|--outline`.
`.omni-status` com `.omni-dot` (+ `--pulse` para "executando agora").
`.omni-tag` (removível). `.omni-avatar` (+`--sm`/`--lg`), `.omni-avatar-group`,
`.omni-user`.

### Avisos

`.omni-alert` + `--info|--success|--warning|--danger`, com
`__icon` · `__body` · `__title` · `__text`. Barra colorida de 3px à esquerda.

### Navegação

`.omni-tabs`/`.omni-tab` (`aria-selected`) · `.omni-breadcrumb` (`aria-current`) ·
`.omni-nav` (+ `.omni-nav__group`, `aria-current="page"` no item ativo) ·
`.omni-pagination`/`.omni-page` · `.omni-menu` (+`__item`, `__sep`, `__label`,
`__item--danger`).

### Feedback

`.omni-modal-backdrop` › `.omni-modal` (raio 14px) ·
`.omni-toast` · `.omni-tooltip` · `.omni-progress`/`__bar` ·
`.omni-skeleton` · `.omni-spinner` · `.omni-empty`.

**O botão do modal nomeia a ação** ("Excluir definitivamente"), nunca "OK".

### Listas e histórico

`.omni-list`/`__item` para coleções curtas onde tabela seria exagero.
`.omni-timeline`/`__item`/`__mark`/`__body` para o que aconteceu, em ordem,
com horário exato.

---

## 6. Gráficos

Sete cores categóricas **em ordem fixa**. Foram validadas para deuteranopia,
protanopia e tritanopia e para contraste com o fundo, nos dois temas.
Reordenar quebra a validação.

| Slot | Token | Claro | Escuro | Hue |
|---|---|---|---|---|
| 1 | `--omni-chart-1` | `#4646b8` | `#6a6ad4` | indigo (marca) |
| 2 | `--omni-chart-2` | `#d98a12` | `#bd811a` | âmbar (marca) |
| 3 | `--omni-chart-3` | `#1189c0` | `#2f93c6` | riviera (marca) |
| 4 | `--omni-chart-4` | `#2a9d67` | `#17985c` | verde |
| 5 | `--omni-chart-5` | `#a855c9` | `#a466cf` | violeta |
| 6 | `--omni-chart-6` | `#c72933` | `#d9505a` | vermelho |
| 7 | `--omni-chart-7` | `#0e9594` | `#12a09d` | teal |

A partir da 8ª série: agrupe em **"Outros"** ou use pequenos múltiplos.
Nunca gere uma cor nova.

**Magnitude contínua** (mapa de calor, escala): rampa `--omni-seq-1..7`,
um tom só, claro → escuro. Nunca arco-íris.
**Polaridade** (acima/abaixo de uma meta): `--omni-div-*`, âmbar ← neutro → indigo.
**Status** (`--omni-success`, `--omni-warning`, `--omni-danger`, `--omni-info`)
é reservado: nunca vira cor de série.

Regras de desenho:
- Traço de linha 2px; ponto de dado ≥ 8px; barra com raio 4px no topo;
  folga de 2px entre segmentos empilhados e entre barras vizinhas.
- Grade recessiva em `--omni-chart-grid`; eixo em `--omni-chart-axis`.
- Texto do gráfico usa os tokens de texto, **nunca a cor da série**.
- Duas séries ou mais: legenda sempre presente. Série única: o título já nomeia
  o dado, não precisa de legenda.
- Rótulo direto em alguns pontos-chave, nunca um número em cima de cada ponto.
- Todo gráfico em HTML tem hover com tooltip. Só o KPI sem plotagem não tem.

---

## 7. Padrões de tela

**Painel interno** — menu lateral 248px, barra superior 60px, conteúdo com
padding 20px. Abre com a linha de KPIs, depois alertas que exigem ação, depois
tabelas. Densidade alta, jargão técnico permitido ("webhook", "p95", "fila").

**Portal do cliente** — mesmos tokens, menos densidade, sem jargão. Fale em
"tarefas feitas por robô" e "tempo devolvido à equipe", não em "execuções" e
"throughput". Card `--inset` no lugar de tabela quando forem poucos números.

**Página comercial** — tipografia grande, muito respiro, **um** CTA em laranja.
Nada de hero de altura de tela inteira: dimensione pelo conteúdo.

---

## 8. Texto da interface

- Escreva do lado de quem usa: a pessoa gerencia **alertas**, não "config de webhook".
- Voz ativa. O botão diz o que acontece ("Publicar"), e a confirmação usa o
  particípio ("Publicado").
- Erro explica o que houve **e como resolver**. Sem desculpas, sem vaguidão.
- Números em pt-BR: `18.427`, `99,2%`, `1,8 s`, `1.240 h`.
- Datas por extenso quando houver espaço: "7 de setembro", "há 12 s".

---

## 9. Checklist de conformidade

Antes de dizer que terminou, verifique cada item. Se algum falhar, corrija
antes de entregar.

- [ ] Nenhum valor de cor literal (`#`, `rgb(`, `hsl(`) fora de `omni-tokens.css`.
- [ ] A página funciona nos **três estados de tema**: claro, escuro por
      preferência do sistema, e escuro por `data-theme="dark"`.
- [ ] `body` (ou o contêiner raiz) tem `background` vindo de token — fundo
      transparente herda o tema errado do host.
- [ ] Montserrat carregada do Google Fonts, com pilha de fallback declarada.
- [ ] Uma única ação primária por tela.
- [ ] Laranja aparece no máximo uma vez por tela, sempre com texto escuro.
- [ ] Todo estado tem rótulo em texto, não só cor.
- [ ] Colunas numéricas alinhadas à direita e com `tabular-nums`.
- [ ] Toda tabela tem estado de carregamento e estado vazio.
- [ ] Todo campo tem rótulo visível; erros dizem como resolver.
- [ ] `:focus-visible` visível em tudo que é focável.
- [ ] Conteúdo largo (tabela, gráfico, código) rola dentro do próprio contêiner —
      a página nunca rola na horizontal.
- [ ] Gráficos usam a ordem fixa das séries e respeitam a regra de eixo único.
- [ ] `prefers-reduced-motion` respeitado.
- [ ] Nada essencial depende de rolagem ou animação para aparecer.

---

## 10. Ao terminar

Diga ao usuário, em uma lista curta:
1. quais telas/componentes foram refeitos;
2. qualquer ponto em que você precisou improvisar por falta de token — e qual
   token usou no lugar;
3. o que ficou fora do padrão e por quê.

Se o projeto tiver componentes que não existem neste guia, descreva-os ao
usuário para que entrem na próxima versão do design system da Omni.
