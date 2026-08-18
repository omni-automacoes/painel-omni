const { createClient } = require("./node_modules/@supabase/supabase-js");

const supabaseUrl = "https://evlccmkqzbjmoptfiurx.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV2bGNjbWtxemJqbW9wdGZpdXJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3MDc0MzcsImV4cCI6MjEwMTI4MzQzN30.JYePw9zg8w4-yYRB4dqbyxHkLith7JIm4VKVvDvOlyg";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testConnection() {
  const tables = [
    "clientes", "clients", "contatos", "contacts",
    "mensagens", "messages", "conversas", "conversations",
    "atendimentos", "chats", "chat_messages", "usuarios", "users",
    "leads", "tickets", "kanban", "negocios", "tarefas", "financeiro",
    "profiles", "accounts", "organizations", "atendimento", "mensagem",
    "contato", "cliente"
  ];
  
  for (const t of tables) {
    const { data, error } = await supabase.from(t).select('*').limit(1);
    if (error && error.message.includes("Could not find the table")) {
        // Doesn't exist
    } else {
        console.log(`TABLE EXISTS: ${t}`, error ? error.message : "Data: " + JSON.stringify(data));
    }
  }
}

testConnection();
