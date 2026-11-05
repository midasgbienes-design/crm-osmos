"use client";

import { supabase } from "@/lib/supabase/cliente";

export type AvisoFila = {
  categoria: string; prioridad: number; titulo: string; detalle: string | null; fecha: string | null; monto: number | null;
  enlace: string | null; cliente: string | null; telefono: string | null; email: string | null; registro_id: string;
};

export async function cargarAvisos() {
  const { data, error } = await supabase().rpc("avisos");
  if (error) throw new Error(error.message);
  return ((data ?? []) as AvisoFila[]).sort((a, b) => a.prioridad - b.prioridad || String(a.fecha).localeCompare(String(b.fecha)));
}

