const { createClient } = require("./node_modules/@supabase/supabase-js");

const supabaseUrl = "https://evlccmkqzbjmoptfiurx.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV2bGNjbWtxemJqbW9wdGZpdXJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3MDc0MzcsImV4cCI6MjEwMTI4MzQzN30.JYePw9zg8w4-yYRB4dqbyxHkLith7JIm4VKVvDvOlyg";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkColumns() {
  const columnsToTest = ['nome', 'name', 'title', 'empresa', 'company', 'telefone', 'phone'];
  
  console.log("Testando colunas na tabela leads...");
  for (const col of columnsToTest) {
    const { error } = await supabase.from('leads').select(col).limit(1);
    if (!error) {
      console.log(`[SUCESSO] Coluna encontrada em leads: ${col}`);
    }
  }

  const msgColumns = ['conteudo', 'content', 'texto', 'text', 'message', 'lead_id', 'cliente_id', 'chat_id', 'enviado_por_mim', 'is_me', 'sender'];
  console.log("Testando colunas na tabela mensagens...");
  for (const col of msgColumns) {
    const { error } = await supabase.from('mensagens').select(col).limit(1);
    if (!error) {
      console.log(`[SUCESSO] Coluna encontrada em mensagens: ${col}`);
    }
  }
}

checkColumns();
