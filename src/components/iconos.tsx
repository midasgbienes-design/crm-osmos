const RUTAS: Record<string, React.ReactNode> = {
  inicio: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </>
  ),
  comercial: (
    <>
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M15 7h6v6" />
    </>
  ),
  igualas: (
    <>
      <path d="M21 12a9 9 0 01-15.5 6.3L3 16" />
      <path d="M3 21v-5h5" />
      <path d="M3 12a9 9 0 0115.5-6.3L21 8" />
      <path d="M21 3v5h-5" />
    </>
  ),
  comisiones: (
    <>
      <path d="M19 5L5 19" />
      <circle cx="7" cy="7" r="2.5" />
      <circle cx="17" cy="17" r="2.5" />
    </>
  ),
  compras: (
    <>
      <circle cx="9" cy="20" r="1.5" />
      <circle cx="18" cy="20" r="1.5" />
      <path d="M2 3h3l2.5 12h11.5l2-8H6.5" />
    </>
  ),
  suplidores: (
    <>
      <path d="M1 6h13v10H1z" />
      <path d="M14 10h4l3 3v3h-7" />
      <circle cx="5.5" cy="18" r="1.8" />
      <circle cx="17.5" cy="18" r="1.8" />
    </>
  ),
  cobros: (
    <>
      <path d="M12 3v18" />
      <path d="M17 7H9.5a3 3 0 000 6h5a3 3 0 010 6H6" />
    </>
  ),
  pagos: (
    <>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
      <path d="M6 15h4" />
    </>
  ),
  contabilidad: (
    <>
      <path d="M4 4h16v16H4z" />
      <path d="M4 9h16" />
      <path d="M9 9v11" />
    </>
  ),
  rrhh: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c0-3.5 3-5.5 6.5-5.5s6.5 2 6.5 5.5" />
      <circle cx="17.5" cy="9" r="2.5" />
      <path d="M17 14.5c2.5 0 4.5 1.5 4.5 4" />
    </>
  ),
};

export function Icono({ nombre, size = 18 }: { nombre: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {RUTAS[nombre]}
    </svg>
  );
}
