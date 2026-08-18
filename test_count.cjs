const { createClient } = require("./node_modules/@supabase/supabase-js");

const supabaseUrl = "https://evlccmkqzbjmoptfiurx.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV2bGNjbWtxemJqbW9wdGZpdXJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3MDc0MzcsImV4cCI6MjEwMTI4MzQzN30.JYePw9zg8w4-yYRB4dqbyxHkLith7JIm4VKVvDvOlyg";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkData() {
  console.log("=== VERIFICANDO DADOS REAIS NA TABELA LEADS ===");
  const { data, error, count } = await supabase.from('leads').select('*', { count: 'exact' });
  console.log("Erro:", error?.message || "Nenhum erro");
  console.log("Total de linhas detectadas no banco (que podem ser lidas):", count);
  console.log("Dados:", data);
  
  console.log("\n=== VERIFICANDO DADOS REAIS NA TABELA MENSAGENS ===");
  const { data: mData, error: mError, count: mCount } = await supabase.from('mensagens').select('*', { count: 'exact' });
  console.log("Erro:", mError?.message || "Nenhum erro");
  console.log("Total de linhas detectadas no banco (que podem ser lidas):", mCount);
  console.log("Dados:", mData);
}

checkData();
