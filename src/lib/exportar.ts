import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { db, vivos, type Cargo } from './db'
import { pataCorto, pezunaNombre, zonaNombre } from './anatomia'
import { pct, type DatosReporte } from './reportes'
import { fechaCorta, gs, hoy, mesNombre, ordenNumero } from './util'

const VERDE: [number, number, number] = [22, 101, 52]
const nombreArchivo = (partes: string[], ext: string) =>
  'VAKAPO_' + partes.map(p => p.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '-')).join('_') + '.' + ext
const valor = (c: Cargo) => Number(c.cantidad) * Number(c.precio_unit)

function encabezado(doc: jsPDF, titulo: string, lineas: string[]): number {
  doc.setFillColor(...VERDE)
  doc.rect(0, 0, 210, 24, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16)
  doc.text('VAKAPO', 14, 15)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11)
  doc.text(titulo, 196, 15, { align: 'right' })
  doc.setTextColor(30, 30, 30)
  let y = 33
  doc.setFontSize(10)
  for (const l of lineas) { doc.text(l, 14, y); y += 5.5 }
  return y + 2
}
const finY = (doc: jsPDF) => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
const estiloTabla = { headStyles: { fillColor: VERDE }, styles: { fontSize: 9, cellPadding: 2 }, margin: { left: 14, right: 14 } }

async function datosJornada(jid: string) {
  const j = await db.jornadas.get(jid)
  if (!j) throw new Error('Jornada no encontrada')
  const t = await db.tambos.get(j.tambo_id)
  const exs = vivos(await db.examenes.where('jornada_id').equals(jid).toArray())
  const cargos = vivos(await db.cargos.where('jornada_id').equals(jid).toArray())
  const hs = vivos(await db.hallazgos.where('tambo_id').equals(j.tambo_id).toArray()).filter(h => exs.some(e => e.id === h.examen_id))
  const recetas = vivos(await db.recetas.where('tambo_id').equals(j.tambo_id).toArray()).filter(r => exs.some(e => e.id === r.examen_id))
  const vacas = new Map(vivos(await db.vacas.where('tambo_id').equals(j.tambo_id).toArray()).map(v => [v.id, v]))
  const num = (vid: string) => vacas.get(vid)?.numero ?? '?'
  exs.sort((a, b) => ordenNumero(num(a.vaca_id), num(b.vaca_id)))
  return { j, t, exs, cargos, hs, recetas, num }
}

export async function cuentaJornadaPDF(jid: string) {
  const { j, t, exs, cargos, hs, recetas, num } = await datosJornada(jid)
  const doc = new jsPDF()
  const total = cargos.reduce((s, c) => s + valor(c), 0)
  let y = encabezado(doc, 'Cuenta de jornada', [
    `Tambo: ${t?.nombre ?? ''}`, `Fecha: ${fechaCorta(j.fecha)}${j.operador ? '   Operador: ' + j.operador : ''}`, `Vacas atendidas: ${exs.length}`
  ])
  const body: (string | number)[][] = []
  for (const e of exs) {
    const cs = cargos.filter(c => c.examen_id === e.id)
    cs.forEach((c, i) => body.push([i === 0 ? num(e.vaca_id) : '', c.descripcion, c.cantidad, gs(c.precio_unit), gs(valor(c))]))
    if (!cs.length) body.push([num(e.vaca_id), 'Sin cobro', '', '', gs(0)])
  }
  for (const c of cargos.filter(c => !c.examen_id)) body.push(['Jornada', c.descripcion, c.cantidad, gs(c.precio_unit), gs(valor(c))])
  autoTable(doc, {
    ...estiloTabla, startY: y, head: [['Vaca', 'Concepto', 'Cant.', 'Precio unit.', 'Subtotal']], body,
    foot: [['', '', '', 'TOTAL', gs(total)]], footStyles: { fillColor: [235, 240, 232], textColor: 20, fontStyle: 'bold' },
    columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } }
  })
  y = finY(doc) + 10
  const det = exs.map(e => {
    const h = hs.filter(x => x.examen_id === e.id && x.nivel > 0)
    const r = recetas.filter(x => x.examen_id === e.id)
    return [
      num(e.vaca_id),
      e.preventivo && !h.length ? 'Recorte preventivo' : h.map(x => `${x.codigo} ${x.grado} (${pataCorto(x.pata)}${x.pezuna ? ' ' + pezunaNombre(x.pezuna).slice(0, 3) : ''} Z${x.zona})`).join(', ') || 'Sin lesión',
      r.map(x => `${x.medicamento} ${x.dosis ?? ''} ${x.via ?? ''}`.trim()).join('; '),
      e.revision_fecha ? fechaCorta(e.revision_fecha) : ''
    ]
  })
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.text('Detalle sanitario', 14, y)
  autoTable(doc, { ...estiloTabla, startY: y + 3, head: [['Vaca', 'Hallazgos', 'Receta', 'Revisión']], body: det })
  doc.save(nombreArchivo([t?.nombre ?? 'tambo', 'jornada', j.fecha], 'pdf'))
}

export async function cuentaJornadaExcel(jid: string) {
  const { j, t, exs, cargos, hs, recetas, num } = await datosJornada(jid)
  const wb = XLSX.utils.book_new()
  const cuenta = cargos.map(c => ({
    Vaca: c.vaca_id ? num(c.vaca_id) : 'Jornada', Concepto: c.descripcion, Tipo: c.tipo, Cantidad: Number(c.cantidad),
    'Precio unit. (Gs)': Number(c.precio_unit), 'Subtotal (Gs)': valor(c)
  }))
  cuenta.push({ Vaca: '', Concepto: 'TOTAL', Tipo: '', Cantidad: 0, 'Precio unit. (Gs)': 0, 'Subtotal (Gs)': cargos.reduce((s, c) => s + valor(c), 0) } as never)
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(cuenta), 'Cuenta')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(hs.map(h => ({
    Vaca: num(h.vaca_id), Pata: pataCorto(h.pata), Pezuña: pezunaNombre(h.pezuna), Zona: h.zona, 'Zona nombre': zonaNombre(h.zona),
    Lesión: h.codigo, Grado: h.grado, Nivel: h.nivel
  }))), 'Hallazgos')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(exs.map(e => ({
    Vaca: num(e.vaca_id), Preventivo: e.preventivo ? 'Sí' : '', Revisión: e.revision_fecha ?? '', Observaciones: e.notas ?? ''
  }))), 'Vacas')
  if (recetas.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(recetas.map(r => ({
    Vaca: num(r.vaca_id), Medicamento: r.medicamento, Dosis: r.dosis, Vía: r.via, Duración: r.duracion, Veterinario: r.veterinario, Indicaciones: r.indicaciones
  }))), 'Recetas')
  XLSX.writeFile(wb, nombreArchivo([t?.nombre ?? 'tambo', 'jornada', j.fecha], 'xlsx'))
}

async function svgAPng(svg: SVGSVGElement): Promise<string | null> {
  try {
    const xml = new XMLSerializer().serializeToString(svg)
    const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }))
    const img = await new Promise<HTMLImageElement>((ok, mal) => { const i = new Image(); i.onload = () => ok(i); i.onerror = mal; i.src = url })
    const c = document.createElement('canvas')
    c.width = 728; c.height = 1060
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height)
    ctx.drawImage(img, 0, 0, c.width, c.height)
    URL.revokeObjectURL(url)
    return c.toDataURL('image/png')
  } catch { return null }
}

export async function reportePDF(d: DatosReporte, tambo: string, filtros: string, svg: SVGSVGElement | null) {
  const doc = new jsPDF()
  let y = encabezado(doc, 'Reporte de salud podal', [`Tambo: ${tambo}`, `Período y filtros: ${filtros}`, `Generado: ${fechaCorta(hoy())}`])
  autoTable(doc, {
    ...estiloTabla, startY: y, head: [['Vacas examinadas', 'Con lesión', '% con lesión', 'Jornadas', 'Costo total']],
    body: [[d.examinadas, d.conLesion, d.examinadas ? pct(d.conLesion / d.examinadas) : '-', d.jornadas, gs(d.costoTotal)]]
  })
  y = finY(doc) + 8
  const img = svg ? await svgAPng(svg) : null
  if (img) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.text('Mapa de calor (zonas con más lesiones)', 14, y)
    doc.addImage(img, 'PNG', 14, y + 3, 62, 90)
    autoTable(doc, {
      ...estiloTabla, startY: y + 3, margin: { left: 84, right: 14 }, head: [['Lesión', 'Vacas', 'Prevalencia', 'Registros']],
      body: d.porLesion.filter(l => l.vacas > 0).map(l => [`${l.codigo} - ${l.nombre}`, l.vacas, pct(l.prevalencia), l.hallazgos])
    })
    y = Math.max(finY(doc), y + 96) + 8
  } else {
    autoTable(doc, {
      ...estiloTabla, startY: y, head: [['Lesión', 'Vacas', 'Prevalencia', 'Registros']],
      body: d.porLesion.filter(l => l.vacas > 0).map(l => [`${l.codigo} - ${l.nombre}`, l.vacas, pct(l.prevalencia), l.hallazgos])
    })
    y = finY(doc) + 8
  }
  const top = d.porLesion.filter(l => l.vacas > 0).slice(0, 4).map(l => l.codigo)
  if (d.porMes.length) {
    autoTable(doc, {
      ...estiloTabla, startY: y, head: [['Mes', 'Vacas', '% con lesión', ...top]],
      body: d.porMes.map(m => [mesNombre(m.mes), m.examinadas, pct(m.examinadas ? m.conLesion / m.examinadas : 0), ...top.map(c => pct(m.examinadas ? (m.porCodigo[c] ?? 0) / m.examinadas : 0))])
    })
    y = finY(doc) + 8
  }
  if (d.porLote.length) {
    autoTable(doc, { ...estiloTabla, startY: y, head: [['Lote', 'Vacas', 'Con lesión', 'Prevalencia', 'Lesión principal']], body: d.porLote.map(l => [l.lote, l.examinadas, l.conLesion, pct(l.prevalencia), l.principal]) })
    y = finY(doc) + 8
  }
  autoTable(doc, {
    ...estiloTabla, startY: y, head: [['Costos', 'Total']],
    body: [...Object.entries(d.costoPorTipo).map(([k, v]) => [k === 'cargo_fijo' ? 'Cargos fijos' : k === 'servicio' ? 'Servicios' : 'Productos', gs(v)]), ['TOTAL', gs(d.costoTotal)]]
  })
  y = finY(doc) + 8
  if (d.porJornada.length) {
    autoTable(doc, { ...estiloTabla, startY: y, head: [['Jornada', 'Vacas', 'Total']], body: d.porJornada.map(j => [fechaCorta(j.jornada.fecha), j.vacas, gs(j.total)]) })
  }
  doc.addPage()
  y = encabezado(doc, 'Detalle de hallazgos', [`Tambo: ${tambo}`, filtros])
  const ex = new Map(d.examenes.map(e => [e.id, e]))
  autoTable(doc, {
    ...estiloTabla, startY: y, head: [['Fecha', 'Vaca', 'Pata', 'Pezuña', 'Zona', 'Lesión', 'Grado']],
    body: d.hallazgos.filter(h => h.nivel > 0)
      .sort((a, b) => (ex.get(a.examen_id)?.fecha ?? '').localeCompare(ex.get(b.examen_id)?.fecha ?? '') || ordenNumero(d.vacas.get(a.vaca_id)?.numero ?? '', d.vacas.get(b.vaca_id)?.numero ?? ''))
      .map(h => [fechaCorta(h.fecha), d.vacas.get(h.vaca_id)?.numero ?? '?', pataCorto(h.pata), pezunaNombre(h.pezuna), h.zona, h.codigo, h.grado])
  })
  doc.save(nombreArchivo([tambo, 'reporte', hoy()], 'pdf'))
}

export async function reporteExcel(d: DatosReporte, tambo: string, filtros: string) {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
    { Dato: 'Tambo', Valor: tambo }, { Dato: 'Filtros', Valor: filtros },
    { Dato: 'Vacas examinadas', Valor: d.examinadas }, { Dato: 'Vacas con lesión', Valor: d.conLesion },
    { Dato: '% con lesión', Valor: d.examinadas ? Math.round((d.conLesion / d.examinadas) * 1000) / 10 : 0 },
    { Dato: 'Jornadas', Valor: d.jornadas }, { Dato: 'Costo total (Gs)', Valor: d.costoTotal }
  ]), 'Resumen')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(d.porLesion.map(l => ({
    Código: l.codigo, Lesión: l.nombre, Vacas: l.vacas, 'Prevalencia %': Math.round(l.prevalencia * 1000) / 10, Registros: l.hallazgos,
    Normal: l.niveles[0], Leve: l.niveles[1], Moderado: l.niveles[2], Grave: l.niveles[3]
  }))), 'Prevalencia')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(d.porMes.map(m => ({
    Mes: m.mes, Examinadas: m.examinadas, 'Con lesión': m.conLesion, ...Object.fromEntries(Object.entries(m.porCodigo).map(([k, v]) => [k, v]))
  }))), 'Por mes')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(d.porLote.map(l => ({
    Lote: l.lote, Examinadas: l.examinadas, 'Con lesión': l.conLesion, 'Prevalencia %': Math.round(l.prevalencia * 1000) / 10, Principal: l.principal
  }))), 'Por lote')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(d.hallazgos.map(h => ({
    Fecha: hoy(new Date(h.fecha)), Vaca: d.vacas.get(h.vaca_id)?.numero ?? '', Pata: pataCorto(h.pata), Pezuña: pezunaNombre(h.pezuna),
    Zona: h.zona, 'Zona nombre': zonaNombre(h.zona), Código: h.codigo, Lesión: d.lesiones.get(h.codigo)?.nombre ?? '', Grado: h.grado, Nivel: h.nivel
  }))), 'Hallazgos')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(d.cargos.map(c => ({
    Fecha: c.fecha.length > 10 ? hoy(new Date(c.fecha)) : c.fecha, Vaca: c.vaca_id ? d.vacas.get(c.vaca_id)?.numero ?? '' : 'Jornada',
    Concepto: c.descripcion, Tipo: c.tipo, Cantidad: Number(c.cantidad), 'Precio unit. (Gs)': Number(c.precio_unit), 'Subtotal (Gs)': valor(c)
  }))), 'Costos')
  XLSX.writeFile(wb, nombreArchivo([tambo, 'reporte', hoy()], 'xlsx'))
}
