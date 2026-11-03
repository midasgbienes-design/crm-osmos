import Link from "next/link";
import { etiqueta, tono, type Tono } from "@/lib/formato";

const TONO_CLASES: Record<Tono, string> = {
  ok: "bg-[#E3F4E8] text-[#1D6B3A]",
  warn: "bg-[#FFF4D6] text-[#7A5600]",
  bad: "bg-[#FDE7E7] text-[#A12020]",
  info: "bg-[#E0F3F5] text-[#005A66]",
  off: "bg-[#EEF0F4] text-osmos-muted",
};

export function Estado({ valor, texto }: { valor: unknown; texto?: string }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded px-2 py-0.5 text-xs font-bold ${TONO_CLASES[tono(valor)]}`}>
      {texto ?? etiqueta(valor)}
    </span>
  );
}

const SUB_TONO: Record<Tono, string> = {
  ok: "text-[#1D6B3A]",
  warn: "text-[#7A5600]",
  bad: "text-[#A12020]",
  info: "text-osmos-tealdark",
  off: "text-osmos-muted",
};

export function Kpi({ titulo, valor, detalle, tono: t = "off" }: { titulo: string; valor: string; detalle?: string; tono?: Tono }) {
  return (
    <div className="card flex flex-col gap-1 px-4 py-3.5">
      <span className="text-xs text-osmos-muted">{titulo}</span>
      <span className="text-2xl font-bold tabular-nums text-osmos-navy">{valor}</span>
      {detalle ? <span className={`text-xs font-semibold ${SUB_TONO[t]}`}>{detalle}</span> : null}
    </div>
  );
}

export function Encabezado({
  migas,
  titulo,
  descripcion,
  children,
}: {
  migas: { texto: string; href?: string }[];
  titulo: string;
  descripcion?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <nav aria-label="Ruta" className="text-xs text-osmos-muted">
        {migas.map((m, i) => (
          <span key={i}>
            {i > 0 ? "  /  " : ""}
            {m.href ? (
              <Link href={m.href} className="hover:underline">
                {m.texto}
              </Link>
            ) : (
              m.texto
            )}
          </span>
        ))}
      </nav>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h1 className="font-display text-[22px] leading-[30px] text-osmos-navy">{titulo}</h1>
          {descripcion ? <p className="text-sm text-osmos-muted">{descripcion}</p> : null}
        </div>
        {children ? <div className="flex flex-wrap gap-2">{children}</div> : null}
      </div>
    </div>
  );
}

export function Pestanas({ items, activa }: { items: { slug: string; nombre: string; href: string }[]; activa: string }) {
  return (
    <div role="tablist" className="flex flex-wrap gap-1 border-b border-osmos-line">
      {items.map((t) => {
        const on = t.slug === activa;
        return (
          <Link
            key={t.slug}
            href={t.href}
            role="tab"
            aria-selected={on}
            className={`flex h-[42px] items-center border-b-[3px] px-3.5 text-sm ${
              on ? "border-osmos-teal font-bold text-osmos-navy" : "border-transparent font-medium text-osmos-muted hover:text-osmos-navy"
            }`}
          >
            {t.nombre}
          </Link>
        );
      })}
    </div>
  );
}

export function Aviso({ children, tono: t = "info" }: { children: React.ReactNode; tono?: Tono }) {
  return <div className={`rounded-md px-3.5 py-2.5 text-sm ${TONO_CLASES[t]}`}>{children}</div>;
}
