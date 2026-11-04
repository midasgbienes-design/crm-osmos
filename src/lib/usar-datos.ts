"use client";

import { useCallback, useEffect, useState } from "react";

// Carga datos al abrir la pantalla y permite recargarlos después de una acción.
export function useDatos<T>(cargar: () => Promise<T>, deps: unknown[] = []) {
  const [datos, setDatos] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const ejecutar = useCallback(cargar, deps);

  const recargar = useCallback(async () => {
    setCargando(true);
    try {
      setDatos(await ejecutar());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCargando(false);
    }
  }, [ejecutar]);

  useEffect(() => {
    recargar();
  }, [recargar]);

  return { datos, error, cargando, recargar };
}

// Convierte la respuesta de Supabase en datos o en un error legible.
export function o<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data as T;
}
