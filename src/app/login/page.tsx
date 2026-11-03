import { iniciarSesion } from "./acciones";

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center bg-osmos-navy px-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow-xl">
        <div className="mb-6 flex flex-col items-start gap-3">
          <div className="rounded-md bg-osmos-navy px-4 py-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/osmos-wordmark-blanco.png" alt="Osmos" className="h-auto w-28" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-osmos-navy">Sistema de gestión empresarial</h1>
            <p className="text-sm text-osmos-muted">Ingrese con su usuario de Osmos.</p>
          </div>
        </div>
        <form action={iniciarSesion} className="flex flex-col gap-4">
          <div>
            <label htmlFor="email" className="label">
              Correo electrónico
            </label>
            <input id="email" name="email" type="email" required autoComplete="email" className="input" />
          </div>
          <div>
            <label htmlFor="password" className="label">
              Contraseña
            </label>
            <input id="password" name="password" type="password" required autoComplete="current-password" className="input" />
          </div>
          {error ? <p className="rounded-md bg-[#FDE7E7] px-3 py-2 text-sm text-[#A12020]">{error}</p> : null}
          <button type="submit" className="btn-primary h-11">
            Entrar
          </button>
        </form>
        <p className="mt-6 text-xs text-osmos-muted">
          ¿No tiene usuario? Solicítelo al administrador del sistema.
        </p>
      </div>
    </main>
  );
}
