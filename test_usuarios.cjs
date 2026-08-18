const { createClient } = require("./node_modules/@supabase/supabase-js");

const supabaseUrl = "https://evlccmkqzbjmoptfiurx.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV2bGNjbWtxemJqbW9wdGZpdXJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3MDc0MzcsImV4cCI6MjEwMTI4MzQzN30.JYePw9zg8w4-yYRB4dqbyxHkLith7JIm4VKVvDvOlyg";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkUsuarios() {
  const { count, error } = await supabase.from('usuarios').select('*', { count: 'exact' });
  console.log("Usuarios count:", count, error);
}

checkUsuarios();
