/*
 * Página de erro do SSR: é servida quando o próprio app não consegue subir, então
 * não pode importar o CSS da aplicação. Os valores abaixo são cópia literal dos
 * tokens de src/styles/omni-tokens.css — este é o único arquivo do projeto, além
 * do próprio arquivo de tokens, onde uma cor aparece escrita.
 */
export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>Esta página não abriu · Omni</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700&display=swap"
    />
    <style>
      :root {
        color-scheme: light;
        --omni-bg: #f7f8fa;
        --omni-surface: #ffffff;
        --omni-border: #e3e6ec;
        --omni-border-strong: #ccd1da;
        --omni-text: #1a2030;
        --omni-text-2: #565f6b;
        --omni-primary: #272757;
        --omni-primary-hover: #33336e;
        --omni-primary-fg: #ffffff;
        --omni-focus: #4646b8;
        --omni-radius-md: 8px;
        --omni-font: "Montserrat", "Segoe UI", system-ui, -apple-system, Arial, sans-serif;
      }
      @media (prefers-color-scheme: dark) {
        :root {
          color-scheme: dark;
          --omni-bg: #0b0f1a;
          --omni-surface: #121826;
          --omni-border: #242e42;
          --omni-border-strong: #35415a;
          --omni-text: #e9edf4;
          --omni-text-2: #a6b0c2;
          --omni-primary: #6161c2;
          --omni-primary-hover: #7373cd;
          --omni-focus: #8b8bd0;
        }
      }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 1.5rem;
        background: var(--omni-bg);
        color: var(--omni-text);
        font-family: var(--omni-font);
        font-size: 14px;
        line-height: 1.5;
        -webkit-font-smoothing: antialiased;
      }
      .card { max-width: 34rem; width: 100%; text-align: center; }
      .eyebrow {
        margin: 0 0 0.5rem;
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--omni-text-2);
      }
      h1 { margin: 0 0 0.75rem; font-size: 20px; font-weight: 700; letter-spacing: -0.01em; }
      p { margin: 0 0 1.5rem; color: var(--omni-text-2); }
      .actions { display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; }
      a, button {
        display: inline-flex;
        align-items: center;
        height: 38px;
        padding: 0 1rem;
        border-radius: var(--omni-radius-md);
        border: 1px solid var(--omni-border-strong);
        background: var(--omni-surface);
        color: var(--omni-text);
        font: inherit;
        font-weight: 600;
        text-decoration: none;
        cursor: pointer;
      }
      .primary {
        background: var(--omni-primary);
        border-color: var(--omni-primary);
        color: var(--omni-primary-fg);
      }
      .primary:hover { background: var(--omni-primary-hover); border-color: var(--omni-primary-hover); }
      a:focus-visible, button:focus-visible { outline: 2px solid var(--omni-focus); outline-offset: 2px; }
    </style>
  </head>
  <body>
    <div class="card">
      <p class="eyebrow">Falha ao carregar</p>
      <h1>Esta página não abriu</h1>
      <p>
        A tentativa de carregar o painel falhou. Recarregue a página — se o erro continuar,
        volte para a visão geral e tente de novo a partir de lá.
      </p>
      <div class="actions">
        <button class="primary" onclick="location.reload()">Recarregar</button>
        <a href="/">Ir para a visão geral</a>
      </div>
    </div>
  </body>
</html>`;
}
