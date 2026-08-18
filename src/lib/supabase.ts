import { createClient } from "@supabase/supabase-js";

let supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://placeholder.supabase.co";
let supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "placeholder-key";

// Limpa qualquer sufixo desnecessário como /rest/v1/ que impeça a conexão correta do SDK
if (supabaseUrl && supabaseUrl !== "https://placeholder.supabase.co") {
  if (supabaseUrl.endsWith("/rest/v1/")) {
    supabaseUrl = supabaseUrl.replace("/rest/v1/", "");
  } else if (supabaseUrl.endsWith("/rest/v1")) {
    supabaseUrl = supabaseUrl.replace("/rest/v1", "");
  }

  // Garante que a URL termine sem barra para consistência
  if (supabaseUrl.endsWith("/")) {
    supabaseUrl = supabaseUrl.slice(0, -1);
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
