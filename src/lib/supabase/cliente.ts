"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

declare global {
  interface Window {
    OSMOS_CONFIG?: { supabaseUrl?: string; supabaseAnonKey?: string };
  }
}

let cliente: SupabaseClient | null = null;

export function configuracion() {
  const cfg = typeof window !== "undefined" ? window.OSMOS_CONFIG : undefined;
  const url = cfg?.supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = cfg?.supabaseAnonKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const valida = (url.startsWith("https://") || url.startsWith("http://localhost")) && key.length > 30 && !key.startsWith("PEGUE");
  return { url, key, valida };
}

// Cliente de Supabase del navegador. La sesión se guarda en el navegador y
// los permisos los aplica la base de datos (Row Level Security).
export function supabase(): SupabaseClient {
  if (cliente) return cliente;
  const { url, key } = configuracion();
  cliente = createClient(url || "https://sin-configurar.supabase.co", key || "sin-configurar", {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: "osmos-crm-sesion" },
  });
  return cliente;
}
