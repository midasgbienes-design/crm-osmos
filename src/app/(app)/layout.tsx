import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { cerrarSesion } from "@/app/login/acciones";
import { Menu } from "@/components/menu";
import { etiqueta } from "@/lib/formato";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase.from("perfiles").select("nombre, rol").eq("id", user.id).maybeSingle();
  const nombre = perfil?.nombre ?? user.email ?? "Usuario";
  const iniciales = nombre
    .split(/\s+/)
    .map((p: string) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex flex-wrap items-center gap-x-5 gap-y-3 bg-osmos-navy px-5 py-2.5 text-white">
        <Link href="/" className="flex items-center gap-3.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/osmos-wordmark-blanco.png" alt="Osmos" className="h-auto w-[104px]" />
          <span className="hidden h-6 w-px bg-[#3A5A9A] sm:block" />
          <span className="hidden text-[13px] text-[#C9D3E8] sm:block">Sistema de gestión empresarial</span>
        </Link>
        <div className="ml-auto flex items-center gap-3">
          <span className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-osmos-teal text-[13px] font-bold">{iniciales}</span>
          <span className="flex flex-col leading-4">
            <span className="text-[13px] font-semibold">{nombre}</span>
            <span className="text-xs text-[#C9D3E8]">{etiqueta(perfil?.rol ?? "consulta")}</span>
          </span>
          <form action={cerrarSesion}>
            <button type="submit" className="ml-2 h-9 rounded-md border border-[#3A5A9A] px-3 text-[13px] hover:bg-osmos-navy2">
              Salir
            </button>
          </form>
        </div>
      </header>

      {perfil?.rol === "consulta" ? (
        <div className="bg-osmos-yellow px-5 py-2 text-sm font-semibold text-osmos-navy">
          Su usuario aún no tiene un rol asignado. Pida al administrador que le asigne uno para ver la información.
        </div>
      ) : null}

      <div className="flex flex-1 flex-col md:flex-row">
        <Menu />
        <main className="flex min-w-0 flex-1 flex-col gap-4 px-4 pb-10 pt-5 md:px-6">{children}</main>
      </div>

      <footer className="flex flex-wrap gap-x-5 gap-y-1 border-t border-osmos-line bg-white px-5 py-2 text-xs text-osmos-muted">
        <span>Moneda: Peso dominicano (DOP)</span>
        <span className="ml-auto">Osmos Tecnología del Agua · Santiago, República Dominicana</span>
      </footer>
    </div>
  );
}
