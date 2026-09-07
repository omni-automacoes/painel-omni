import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

async function main() {
  // Na Vercel o Nitro gera a saida em .vercel/output (preset proprio da plataforma),
  // entao esse pos-build especifico do Hostinger nao se aplica e deve ser pulado.
  if (process.env.VERCEL) {
    console.log("\n⏭️  [Hostinger Build] Build rodando na Vercel — pulando geracao de arquivos para Hostinger.");
    return;
  }

  console.log("\n📦 [Hostinger Build] Gerando arquivos estáticos para publicação na Hostinger...");

  const rootDir = process.cwd();
  const serverFilePath = path.resolve(rootDir, ".output/server/index.mjs");
  const publicDir = path.resolve(rootDir, ".output/public");
  const distHostingerDir = path.resolve(rootDir, "dist-hostinger");

  if (!fs.existsSync(serverFilePath)) {
    console.error("❌ Servidor Nitro não encontrado em .output/server/index.mjs");
    process.exit(1);
  }

  // 1. Carregar servidor Nitro para renderizar o HTML completo do TanStack Start
  const nitroApp = await import(pathToFileURL(serverFilePath).href);
  const req = new Request("http://localhost/");
  const res = await nitroApp.default.fetch(req, {});
  const htmlContent = await res.text();

  if (!htmlContent || htmlContent.length < 500) {
    console.error("❌ Falha ao obter HTML renderizado do TanStack Start");
    process.exit(1);
  }

  // 2. Escrever index.html em .output/public
  const indexHtmlPath = path.resolve(publicDir, "index.html");
  fs.writeFileSync(indexHtmlPath, htmlContent, "utf-8");
  console.log(`✅ [1/3] Arquivo index.html gerado com sucesso em .output/public/index.html (${htmlContent.length} bytes)`);

  // 3. Escrever .htaccess em .output/public
  const htaccessContent = `<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
`;
  const htaccessPath = path.resolve(publicDir, ".htaccess");
  fs.writeFileSync(htaccessPath, htaccessContent, "utf-8");
  console.log("✅ [2/3] Arquivo .htaccess criado em .output/public/.htaccess");

  // 4. Copiar toda a pasta .output/public para dist-hostinger na raiz do projeto
  if (fs.existsSync(distHostingerDir)) {
    fs.rmSync(distHostingerDir, { recursive: true, force: true });
  }
  fs.cpSync(publicDir, distHostingerDir, { recursive: true });
  console.log("✅ [3/3] Pasta 'dist-hostinger' criada na raiz do projeto contendo TODOS os arquivos prontos para subir na Hostinger!");

  console.log("\n🎉 [SUCESSO] Build concluído com sucesso!");
  console.log("👉 Agora você pode compactar os arquivos de 'dist-hostinger' (ou '.output/public') e fazer o upload para a Hostinger!\n");
}

main().catch((err) => {
  console.error("❌ Erro ao preparar build para Hostinger:", err);
  process.exit(1);
});
