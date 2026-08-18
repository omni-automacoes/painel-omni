const { createClient } = require("./node_modules/@supabase/supabase-js");

const supabaseUrl = "https://evlccmkqzbjmoptfiurx.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV2bGNjbWtxemJqbW9wdGZpdXJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3MDc0MzcsImV4cCI6MjEwMTI4MzQzN30.JYePw9zg8w4-yYRB4dqbyxHkLith7JIm4VKVvDvOlyg";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function seedData() {
  console.log("Tentando inserir um lead falso para teste...");
  const { data: leadData, error: leadError } = await supabase
    .from('leads')
    .insert([
      { nome: "João Silva", empresa: "Tech Corp", status: "Aberto" }
    ])
    .select();
    
  if (leadError) {
    console.log("Erro ao inserir lead:", leadError.message);
  } else {
    console.log("Lead inserido com sucesso:", leadData);
    
    if (leadData && leadData.length > 0) {
      const leadId = leadData[0].id;
      console.log(`Tentando inserir mensagem para o lead ${leadId}...`);
      const { data: msgData, error: msgError } = await supabase
        .from('mensagens')
        .insert([
          { lead_id: leadId, conteudo: "Olá, gostaria de saber sobre o sistema Omni.", enviado_por_mim: false },
          { lead_id: leadId, conteudo: "Olá João! Claro, posso te ajudar. O que você gostaria de saber?", enviado_por_mim: true }
        ])
        .select();
        
      if (msgError) {
         console.log("Erro ao inserir mensagens:", msgError.message);
      } else {
         console.log("Mensagens inseridas com sucesso:", msgData);
      }
    }
  }
}

seedData();
