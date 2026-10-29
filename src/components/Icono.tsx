const P: Record<string, string> = {
  atras: 'M15 6l-6 6 6 6',
  sig: 'M9 6l6 6-6 6',
  mas: 'M12 5v14M5 12h14',
  menos: 'M5 12h14',
  check: 'M5 12l5 5L20 7',
  x: 'M18 6L6 18M6 6l12 12',
  camara: 'M5 7h2l2-3h6l2 3h2a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9a2 2 0 012-2zM12 17a4 4 0 100-8 4 4 0 000 8z',
  nube: 'M7 18a4.6 4.4 0 010-9 5 4.5 0 0111 2h1a3.5 3.5 0 010 7H7z',
  nubeOff: 'M3 3l18 18M18 18H7a4.6 4.4 0 01-.9-8.7M9.3 6.1A5 4.5 0 0118 11h1a3.5 3.5 0 012.1 6.3',
  refrescar: 'M20 11A8.1 8.1 0 004.5 9M4 5v4h4M4 13a8.1 8.1 0 0015.5 2M20 19v-4h-4',
  campana: 'M10 5a2 2 0 114 0 7 7 0 014 6v3a4 4 0 002 3H4a4 4 0 002-3v-3a7 7 0 014-6M9 17v1a3 3 0 006 0v-1',
  grafico: 'M3 3v18h18M7 16v-4M11 16V8M15 16v-6M19 16V5',
  ajustes: 'M10.3 4.3c.4-1.8 3-1.8 3.4 0a1.7 1.7 0 002.6 1.1c1.5-.9 3.3.8 2.4 2.4a1.7 1.7 0 001 2.5c1.8.5 1.8 3 0 3.5a1.7 1.7 0 00-1 2.6c.9 1.5-.9 3.3-2.4 2.4a1.7 1.7 0 00-2.6 1c-.4 1.8-3 1.8-3.4 0a1.7 1.7 0 00-2.6-1c-1.5.9-3.3-.9-2.4-2.4a1.7 1.7 0 00-1-2.6c-1.8-.4-1.8-3 0-3.4a1.7 1.7 0 001-2.6c-.9-1.5.9-3.3 2.4-2.4a1.7 1.7 0 002.6-1.1zM12 15a3 3 0 100-6 3 3 0 000 6z',
  granja: 'M3 21h18M5 21V10l7-6 7 6v11M9 21v-6h6v6M10 10h4',
  basura: 'M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 002 2h8a2 2 0 002-2l1-12M9 7V4h6v3',
  buscar: 'M10 17a7 7 0 100-14 7 7 0 000 14zM21 21l-6-6',
  editar: 'M4 20h4L18.5 9.5a2.8 2.8 0 00-4-4L4 16v4M13.5 6.5l4 4',
  descargar: 'M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 11l5 5 5-5M12 4v12',
  calendario: 'M4 7a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V7zM16 3v4M8 3v4M4 11h16',
  nota: 'M8 9h8M8 13h6M18 4a3 3 0 013 3v8a3 3 0 01-3 3h-5l-5 3v-3H6a3 3 0 01-3-3V7a3 3 0 013-3h12z',
  usuario: 'M12 11a4 4 0 100-8 4 4 0 000 8zM6 21v-2a4 4 0 014-4h4a4 4 0 014 4v2',
  usuarios: 'M9 11a4 4 0 100-8 4 4 0 000 8zM3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2M16 3.1a4 4 0 010 7.8M21 21v-2a4 4 0 00-3-3.9',
  lista: 'M9 6h11M9 12h11M9 18h11M5 6v.01M5 12v.01M5 18v.01',
  receta: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2M9 12h6M9 16h6',
  reloj: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 3',
  alerta: 'M12 9v4M12 17h.01M10.2 3.9L2.4 17.5A2 2 0 004.1 20.5h15.8a2 2 0 001.7-3L13.8 3.9a2 2 0 00-3.6 0z',
  candado: 'M5 11h14v10H5zM8 11V7a4 4 0 018 0v4',
  dinero: 'M3 7h18v10H3zM12 15a3 3 0 100-6 3 3 0 000 6zM6 10v.01M18 14v.01',
  pezuna: 'M11 4C8 3 5 5 5 10c0 4 2 8 5 10 1 .6 1.5 0 1.5-1V5zM13 4c3-1 6 1 6 6 0 4-2 8-5 10-1 .6-1.5 0-1.5-1V5z'
}

export function Icono({ n, size = 24, stroke = 2 }: { n: keyof typeof P | string; size?: number; stroke?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={P[n] ?? ''} />
    </svg>
  )
}
