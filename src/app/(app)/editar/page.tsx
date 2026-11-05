"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabase/cliente";
import { useDatos } from "@/lib/usar-datos";
import { buscarModulo, rutaSeccion } from "@/lib/modulos";
import { FORMULARIOS, creadoTexto, nuevoTexto } from "@/lib/formularios";
import { Editor, leerValores, rellenar, type Opciones } from "@/components/editor";
import { Aviso, Encabezado } from "@/components/ui";
import { Cargando } from "@/components/mensajes";
import { useSesion } from "@/components/sesion";
import Link from "next/link";

// Mensajes de la base de datos traducidos para el usuario.
function explicar(msg: string) {
  if (msg.includes("vendedor_interno_es_empleado")) return "Un vendedor interno debe estar vinculado a un empleado. Regístrelo primero en Recursos Humanos o elija tipo Externo.";
  if (msg.includes("duplicate key")) return "Ya existe un registro con ese código o número.";
  if (msg.includes("row-level security") || msg.includes("permission denied")) return "Su rol no tiene permiso para guardar en esta sección.";
  if (msg.includes("violates check constraint")) return `Hay un valor que no es válido: ${msg}`;
  if (msg.includes("null value")) return `Falta un dato obligatorio: ${msg}`;
  return msg;
}

export default function EditarRegistro() {
  const router = useRouter();
  const sp = useSearchParams();
  const clave = sp.get("f") ?? "";
  const id = sp.get("id");
  const volver = sp.get("volver");
  const formulario = FORMULARIOS[clave];
  const [modulo, seccion] = clave.split("/");
  const m = buscarModulo(modulo);
  const s = m?.secciones.find((x) => x.slug === seccion);
  const [error, setError] = useState<string | null>(null);
  const { perfil } = useSesion();

  const { datos, error: errCarga, cargando } = useDatos(async () => {
    if (!formulario) return null;
    const sb = supabase();
    const relaciones = formulario.campos.filter((c) => c.tipo === "relacion" && c.relacion);
    const resultados = await Promise.all(
      relaciones.map(async (c) => {
        const r = c.relacion!;
        let q = sb.from(r.tabla).select(r.select).limit(1000);
        if (r.filtro) q = q.eq(r.filtro[0], r.filtro[1]);
        if (r.orden) q = q.order(r.orden);
        const { data } = await q;
        return [c.campo, ((data ?? []) as unknown as Record<string, unknown>[]).map((f) => ({ id: String(f.id), texto: rellenar(r.etiqueta, f) }))] as const;
      }),
    );
    const opciones: Opciones = Object.fromEntries(resultados);
    let fila: Record<string, unknown> | null = null;
    if (id) {
      const { data, error } = await sb.from(formulario.tabla).select("*").eq("id", id).maybeSingle();
      if (error) throw new Error(error.message);
      fila = data;
    } else {
      // Valores precargados por la dirección, ej. ?cliente_id=...
      const pre: Record<string, unknown> = {};
      for (const c of formulario.campos) {
        const v = sp.get(c.campo);
        if (v !== null) pre[c.campo] = v;
      }
      fila = Object.keys(pre).length ? pre : null;
    }
    return { opciones, fila };
  }, [clave, id]);

  if (!formulario) return <Aviso tono="bad">Formulario no encontrado.</Aviso>;

  const listado = m && s ? rutaSeccion(m, s) : "/";
  const regresar = () => (volver ? router.push(volver) : router.back());

  const guardar = async (f: FormData) => {
    setError(null);
    const valores = leerValores(formulario.campos, f, !id);
    const sb = supabase();
    const r = id
      ? await sb.from(formulario.tabla).update(valores).eq("id", id).select("id").maybeSingle()
      : await sb.from(formulario.tabla).insert(valores).select("id").single();
    if (r.error || !r.data) {
      setError(explicar(r.error?.message ?? "No se guardó. Es posible que su rol no tenga permiso."));
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const nuevoId = String(r.data.id);
    const destino = volver || formulario.despues?.(nuevoId) || listado;
    const sep = destino.includes("?") ? "&" : "?";
    router.push(`${destino}${sep}ok=${encodeURIComponent(id ? "Cambios guardados." : creadoTexto(formulario))}`);
  };

  const titulo = id ? `Editar ${formulario.singular}` : nuevoTexto(formulario);

  return (
    <>
      <Encabezado
        migas={[
          { texto: "Osmos ERP", href: "/" },
          ...(m ? [{ texto: m.nombre, href: `/${m.slug}/` }] : []),
          ...(s ? [{ texto: s.nombre, href: listado }] : []),
          { texto: id ? "Editar" : "Nuevo" },
        ]}
        titulo={titulo.charAt(0).toUpperCase() + titulo.slice(1)}
        descripcion="Los campos con * son obligatorios."
      >
        {id && perfil?.rol === "admin" && formulario.tabla !== "empresa" ? (
          <Link href={`/configuracion/auditoria/?registro=${id}`} className="btn-secondary">Historial de cambios</Link>
        ) : null}
      </Encabezado>
      {error ? <Aviso tono="bad">{error}</Aviso> : null}
      {errCarga ? <Aviso tono="bad">{errCarga}</Aviso> : null}
      {cargando && !datos ? (
        <Cargando />
      ) : id && !datos?.fila ? (
        <Aviso tono="warn">Registro no encontrado o sin permiso para verlo.</Aviso>
      ) : (
        <Editor formulario={formulario} inicial={datos?.fila ?? null} opciones={datos?.opciones ?? {}} onGuardar={guardar} onCancelar={regresar} />
      )}
    </>
  );
}
