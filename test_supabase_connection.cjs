/**
 * Teste de conexão com o Supabase
 * Verifica se as tabelas usuarios, mensagens e leads estão acessíveis
 */
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = "https://evlccmkqzbjmoptfiurx.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV2bGNjbWtxemJqbW9wdGZpdXJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3MDc0MzcsImV4cCI6MjEwMTI4MzQzN30.JYePw9zg8w4-yYRB4dqbyxHkLith7JIm4VKVvDvOlyg";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testConnection() {
  console.log("=".repeat(60));
  console.log("  TESTE DE CONEXAO COM SUPABASE");
  console.log("=".repeat(60));
  console.log(`\nURL: ${SUPABASE_URL}`);
  console.log(`Anon Key: ${SUPABASE_ANON_KEY.substring(0, 30)}...`);
  console.log("");

  // 1. Testar conectividade basica (health check)
  console.log("[1/4] Testando conectividade basica...");
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.log(`  ❌ Erro de conectividade: ${error.message}`);
    } else {
      console.log(`  ✅ Conexao com Supabase estabelecida com sucesso!`);
      console.log(`  -> Sessao ativa: ${data.session ? "Sim" : "Nao (anon key, sem login)"}`);
    }
  } catch (err) {
    console.log(`  ❌ Falha na conexao: ${err.message}`);
    return;
  }

  // 2. Testar tabela USUARIOS
  console.log("\n[2/4] Testando tabela 'usuarios'...");
  try {
    const { data, error, count } = await supabase
      .from("usuarios")
      .select("*", { count: "exact" });

    if (error) {
      if (error.code === "PGRST301" || error.message.includes("JWT") || error.message.includes("RLS")) {
        console.log(`  ⚠️  RLS ativa - Acesso negado sem autenticacao (ESPERADO)`);
        console.log(`  -> Codigo: ${error.code} | Mensagem: ${error.message}`);
      } else {
        console.log(`  ❌ Erro: ${error.code} - ${error.message}`);
      }
    } else {
      console.log(`  ✅ Tabela 'usuarios' acessivel!`);
      console.log(`  -> Linhas retornadas: ${data ? data.length : 0}`);
      if (data && data.length > 0) {
        console.log(`  -> Colunas: ${Object.keys(data[0]).join(", ")}`);
        console.log(`  -> Primeiro usuario: ${data[0].user_nome || "N/A"}`);
      }
    }
  } catch (err) {
    console.log(`  ❌ Excecao: ${err.message}`);
  }

  // 3. Testar tabela LEADS
  console.log("\n[3/4] Testando tabela 'leads'...");
  try {
    const { data, error } = await supabase
      .from("leads")
      .select("*");

    if (error) {
      if (error.code === "PGRST301" || error.message.includes("JWT") || error.message.includes("RLS")) {
        console.log(`  ⚠️  RLS ativa - Acesso negado sem autenticacao (ESPERADO)`);
        console.log(`  -> Codigo: ${error.code} | Mensagem: ${error.message}`);
      } else {
        console.log(`  ❌ Erro: ${error.code} - ${error.message}`);
      }
    } else {
      console.log(`  ✅ Tabela 'leads' acessivel!`);
      console.log(`  -> Linhas retornadas: ${data ? data.length : 0}`);
      if (data && data.length > 0) {
        console.log(`  -> Colunas: ${Object.keys(data[0]).join(", ")}`);
        console.log(`  -> Primeiro lead: ${data[0].lead_nome || "N/A"}`);
      }
    }
  } catch (err) {
    console.log(`  ❌ Excecao: ${err.message}`);
  }

  // 4. Testar tabela MENSAGENS
  console.log("\n[4/4] Testando tabela 'mensagens'...");
  try {
    const { data, error } = await supabase
      .from("mensagens")
      .select("*");

    if (error) {
      if (error.code === "PGRST301" || error.message.includes("JWT") || error.message.includes("RLS")) {
        console.log(`  ⚠️  RLS ativa - Acesso negado sem autenticacao (ESPERADO)`);
        console.log(`  -> Codigo: ${error.code} | Mensagem: ${error.message}`);
      } else {
        console.log(`  ❌ Erro: ${error.code} - ${error.message}`);
      }
    } else {
      console.log(`  ✅ Tabela 'mensagens' acessivel!`);
      console.log(`  -> Linhas retornadas: ${data ? data.length : 0}`);
      if (data && data.length > 0) {
        console.log(`  -> Colunas: ${Object.keys(data[0]).join(", ")}`);
        console.log(`  -> Primeira mensagem: "${(data[0].mensagem_conteudo || "").substring(0, 50)}"`);
      }
    }
  } catch (err) {
    console.log(`  ❌ Excecao: ${err.message}`);
  }

  console.log("\n" + "=".repeat(60));
  console.log("  TESTE FINALIZADO");
  console.log("=".repeat(60));
}

testConnection().catch(console.error);
