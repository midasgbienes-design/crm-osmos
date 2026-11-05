"use client";

import { useState } from "react";
import { clienteAislado, supabase } from "@/lib/supabase/cliente";
import { useDatos } from "@/lib/usar-datos";
import { formatoFecha } from "@/lib/formato";
import { Aviso, Encabezado, Estado } from "@/components/ui";
import { Cargando } from "@/components/mensajes";
import { useSesion } from "@/components/sesion";

type Usuario = { id: string; nombre: string; email: string | null; rol: string; activo: boolean; creado: string; ultimo_acceso: string | null; confirmado: boolean; vendedor: string | null; empleado: string | null };

const ROLES: [string, string, string][] = [
  ["admin", "Administrador", "Todo el sistema, usuarios y configuración"],
  ["gerencia", "Gerencia", "Todo el sistema y los tableros, sin configurar usuarios"],
  ["ventas", "Ventas", "Prospectos, clientes, cotizaciones, igualas"],
  ["vendedor_externo", "Vendedor externo", "Solo sus propios prospectos y clientes"],
  ["tecnico", "Técnico", "Órdenes de servicio, visitas e inventario"],
  ["cobros", "Cobros", "Facturas, recibos, cobranza y NCF"],
  ["pagos", "Pagos", "Cuentas por pagar y pagos a suplidores"],
  ["compras", "Compras", "Compras, suplidores y catálogo"],
  ["almacen", "Almacén", "Inventario y recepciones"],
  ["contabilidad", "Contabilidad", "Contabilidad, comisiones, impuestos y tableros"],
  ["rrhh", "Recursos Humanos", "Colaboradores, nómina y ausencias"],
  ["consulta", "Sin acceso (consulta)", "Puede entrar pero no ve información"],
];
const nombreRol = (r: string) => ROLES.find(([v]) => v === r)?.[1] ?? r;

function explicar(msg: string) {
  const m = msg.toLowerCase();
  if (m.includes("already registered") || m.includes("already exists")) return "Ya existe un usuario con ese correo.";
  if (m.includes("password")) return "La contraseña debe tener al menos 8 caracteres (Supabase puede exigir letras y números).";
  if (m.includes("signups not allowed") || m.includes("signup is disabled")) return "Supabase tiene desactivado el registro de usuarios. En Supabase → Authentication → Sign In / Providers, active «Allow new users to sign up», o cree el usuario desde Authentication → Users.";
  if (m.includes("rate limit")) return "Supabase limitó los envíos de correo por ahora. Intente en unos minutos.";
  if (m.includes("propio rol")) return "No puede quitarse su propio rol de administrador ni desactivar su usuario.";
  return msg;
}

export default function Usuarios() {
  const { perfil, usuario: yo } = useSesion();
  const [aviso, setAviso] = useState<{ tono: "ok" | "bad" | "warn"; texto: string } | null>(null);
  const [creando, setCreando] = useState(false);
  const [mostrarAlta, setMostrarAlta] = useState(false);
  const { datos, error, cargando, recargar } = useDatos(async () => {
    const { data, error } = await supabase().rpc("usuarios_sistema");
    if (error) throw new Error(error.message);
    return (data ?? []) as Usuario[];
  }, []);

  if (perfil?.rol !== "admin") return <Aviso tono="warn">Solo el administrador puede gestionar usuarios.</Aviso>;

  const cambiar = async (u: Usuario, cambios: Partial<Pick<Usuario, "rol" | "activo" | "nombre">>) => {
    setAviso(null);
    const { error } = await supabase().from("perfiles").update(cambios).eq("id", u.id);
    if (error) setAviso({ tono: "bad", texto: explicar(error.message) });
    else setAviso({ tono: "ok", texto: `${u.nombre}: ${cambios.rol ? `ahora tiene el rol ${nombreRol(cambios.rol)}` : cambios.activo === false ? "usuario desactivado" : "usuario activado"}.` });
    recargar();
  };

  const enlaceClave = async (u: Usuario) => {
    if (!u.email) return;
    const { error } = await supabase().auth.resetPasswordForEmail(u.email, { redirectTo: `${window.location.origin}/cuenta/?recuperar=1` });
    setAviso(error ? { tono: "bad", texto: explicar(error.message) } : { tono: "ok", texto: `Se envió a ${u.email} un enlace para crear una contraseña nueva.` });
  };

  const crear = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formulario = e.currentTarget;
    const f = new FormData(formulario);
    const email = String(f.get("email")).trim().toLowerCase();
    const nombre = String(f.get("nombre")).trim();
    const rol = String(f.get("rol"));
    if ((datos ?? []).some((u) => u.email?.toLowerCase() === email)) {
      setAviso({ tono: "bad", texto: "Ya existe un usuario con ese correo." });
      return;
    }
    setCreando(true);
    setAviso(null);
    try {
      const { data, error } = await clienteAislado().auth.signUp({ email, password: String(f.get("clave")), options: { data: { nombre } } });
      if (error) throw new Error(error.message);
      const id = data.user?.id;
      if (!id || (data.user?.identities && data.user.identities.length === 0)) throw new Error("already registered");
      // El perfil lo crea la base de datos al registrar el usuario; aquí se le asigna el rol.
      let asignado = false;
      for (let i = 0; i < 5 && !asignado; i++) {
        const r = await supabase().from("perfiles").update({ rol, nombre }).eq("id", id).select("id");
        asignado = !r.error && (r.data ?? []).length > 0;
        if (!asignado) await new Promise((ok) => setTimeout(ok, 600));
      }
      formulario.reset();
      setMostrarAlta(false);
      setAviso({
        tono: asignado ? "ok" : "warn",
        texto: asignado
          ? `Usuario creado: ${email} con rol ${nombreRol(rol)}. ${data.session ? "Ya puede entrar con la contraseña temporal." : "Debe confirmar su correo con el enlace que le envió Supabase antes de entrar."} Pídale que cambie la contraseña en «Mi cuenta».`
          : `Se creó ${email}, pero no se pudo asignar el rol. Búsquelo en la lista y asígnelo.`,
      });
      recargar();
    } catch (err) {
      setAviso({ tono: "bad", texto: explicar(err instanceof Error ? err.message : String(err)) });
    } finally {
      setCreando(false);
    }
  };

  return (
    <>
      <Encabezado
        migas={[{ texto: "Osmos ERP", href: "/" }, { texto: "Configuración", href: "/configuracion/" }, { texto: "Usuarios y roles" }]}
        titulo="Usuarios y roles"
        descripcion="Cada persona entra con su correo. El rol decide qué ve y qué puede modificar; la base de datos lo hace cumplir."
      >
        <button type="button" onClick={() => setMostrarAlta((v) => !v)} className="btn-primary">{mostrarAlta ? "Cerrar" : "Nuevo usuario"}</button>
      </Encabezado>

      {aviso ? <Aviso tono={aviso.tono}>{aviso.texto}</Aviso> : null}
      {error ? <Aviso tono="bad">{error}</Aviso> : null}

      {mostrarAlta ? (
        <form onSubmit={crear} className="card grid max-w-4xl grid-cols-1 gap-4 p-5 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="u-nombre">Nombre *</label>
            <input id="u-nombre" name="nombre" required className="input" />
          </div>
          <div>
            <label className="label" htmlFor="u-email">Correo *</label>
            <input id="u-email" name="email" type="email" required className="input" />
          </div>
          <div>
            <label className="label" htmlFor="u-clave">Contraseña temporal *</label>
            <input id="u-clave" name="clave" type="text" minLength={8} required autoComplete="off" className="input" />
            <p className="mt-1 text-xs text-osmos-muted">Mínimo 8 caracteres. Entréguela en persona; la persona la cambia en «Mi cuenta».</p>
          </div>
          <div>
            <label className="label" htmlFor="u-rol">Rol *</label>
            <select id="u-rol" name="rol" required defaultValue="ventas" className="input">
              {ROLES.map(([v, t, d]) => <option key={v} value={v}>{t} · {d}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <button type="submit" disabled={creando} className="btn-primary h-10">{creando ? "Creando…" : "Crear usuario"}</button>
          </div>
        </form>
      ) : null}

      <section className="card flex flex-col">
        {cargando && !datos ? <div className="p-4"><Cargando /></div> : null}
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-[#F7F9FC]">
                <th className="th">Usuario</th><th className="th">Rol</th><th className="th">Vinculado a</th><th className="th">Último acceso</th><th className="th">Estado</th><th className="th"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {(datos ?? []).map((u) => {
                const soyYo = u.id === yo.id;
                return (
                  <tr key={u.id} className={u.activo ? "" : "opacity-60"}>
                    <td className="td">
                      <span className="flex flex-col">
                        <strong>{u.nombre}{soyYo ? " (usted)" : ""}</strong>
                        <span className="text-xs text-osmos-muted">{u.email}</span>
                      </span>
                    </td>
                    <td className="td">
                      <label className="sr-only" htmlFor={`rol-${u.id}`}>Rol de {u.nombre}</label>
                      <select id={`rol-${u.id}`} value={u.rol} disabled={soyYo} onChange={(e) => cambiar(u, { rol: e.target.value })} className="input w-auto min-w-[170px]">
                        {ROLES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                      </select>
                    </td>
                    <td className="td text-xs">{[u.vendedor && `Vendedor: ${u.vendedor}`, u.empleado && `Empleado: ${u.empleado}`].filter(Boolean).join(" · ") || "—"}</td>
                    <td className="td">{u.ultimo_acceso ? formatoFecha(u.ultimo_acceso) : u.confirmado ? "Nunca" : "Correo sin confirmar"}</td>
                    <td className="td"><Estado valor={u.activo ? "activo" : "inactivo"} /></td>
                    <td className="td">
                      <span className="flex justify-end gap-3">
                        {u.email ? <button type="button" onClick={() => enlaceClave(u)} className="font-bold text-osmos-navy2 underline">Enviar enlace de contraseña</button> : null}
                        {!soyYo ? (
                          <button type="button" onClick={() => cambiar(u, { activo: !u.activo })} className="font-bold text-osmos-navy2 underline">{u.activo ? "Desactivar" : "Activar"}</button>
                        ) : null}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card p-4 text-sm">
        <h2 className="mb-2 font-bold text-osmos-navy">Qué puede hacer cada rol</h2>
        <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
          {ROLES.map(([v, t, d]) => (
            <div key={v} className="flex gap-2"><dt className="min-w-[140px] font-semibold">{t}</dt><dd className="text-osmos-muted">{d}</dd></div>
          ))}
        </dl>
        <p className="mt-3 text-xs text-osmos-muted">Para que un vendedor vea sus comisiones o un técnico su asistencia, vincule su usuario en la ficha del vendedor o del colaborador (campo «Usuario del sistema»).</p>
      </section>
    </>
  );
}
