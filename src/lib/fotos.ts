import { db, getMeta, type Foto } from './db'
import { guardar, actualizar } from './repo'
import { supabase } from './supabase'
import { uid } from './util'

/** Reduce la foto en el propio celular: ~100–200 KB en lugar de 3–5 MB. */
async function comprimir(file: Blob, maxLado: number, calidad: number): Promise<Blob> {
  let ancho: number, alto: number
  let dibujar: (ctx: CanvasRenderingContext2D, w: number, h: number) => void
  try {
    const bmp = await createImageBitmap(file)
    ancho = bmp.width; alto = bmp.height
    dibujar = (ctx, w, h) => { ctx.drawImage(bmp, 0, 0, w, h); bmp.close() }
  } catch {
    const url = URL.createObjectURL(file)
    const img = await new Promise<HTMLImageElement>((ok, mal) => {
      const i = new Image(); i.onload = () => ok(i); i.onerror = mal; i.src = url
    })
    ancho = img.naturalWidth; alto = img.naturalHeight
    dibujar = (ctx, w, h) => { ctx.drawImage(img, 0, 0, w, h); URL.revokeObjectURL(url) }
  }
  const esc = Math.min(1, maxLado / Math.max(ancho, alto))
  const w = Math.round(ancho * esc), h = Math.round(alto * esc)
  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  const ctx = canvas.getContext('2d')!
  dibujar(ctx, w, h)
  const aBlob = (tipo: string) => new Promise<Blob | null>(ok => canvas.toBlob(ok, tipo, calidad))
  let out = await aBlob('image/webp')
  // Safari no codifica WebP: cae a JPEG
  if (!out || out.type !== 'image/webp') out = await aBlob('image/jpeg')
  if (!out) throw new Error('No se pudo procesar la foto')
  return out
}

export interface DestinoFoto { tambo_id: string; vaca_id: string; examen_id?: string | null; hallazgo_id?: string | null }

/** Guarda la foto en el dispositivo al instante; se sube a la nube después. */
export async function tomarFoto(destino: DestinoFoto, archivo: File): Promise<Foto> {
  const [full, thumb] = await Promise.all([comprimir(archivo, 1280, 0.72), comprimir(archivo, 320, 0.6)])
  const id = uid()
  await db.blobs.put({ id, full, thumb })
  return guardar<Foto>('fotos', {
    id, ...destino, examen_id: destino.examen_id ?? null, hallazgo_id: destino.hallazgo_id ?? null,
    fecha: new Date().toISOString(), path: null, subida: 0
  })
}

export async function borrarFoto(f: Foto) {
  // -1 = borrar también de la nube en la próxima sincronización
  await actualizar('fotos', f.id, { deleted: true, subida: f.subida === 1 ? -1 : f.subida })
  await db.blobs.delete(f.id)
}

const ext = (b: Blob) => (b.type === 'image/webp' ? 'webp' : 'jpg')
const pathThumb = (path: string) => path.replace(/\.(\w+)$/, '_t.$1')

function conexionPermitida(soloWifi: boolean): boolean {
  if (!soloWifi) return true
  const c = (navigator as unknown as { connection?: { type?: string } }).connection
  if (!c?.type) return true // el navegador no informa el tipo: se permite
  return c.type === 'wifi' || c.type === 'ethernet'
}

/** Sube fotos pendientes y borra en la nube las eliminadas. Devuelve cuántas cambiaron. */
export async function subirFotos(): Promise<number> {
  if (!supabase) return 0
  const soloWifi = await getMeta('foto_solo_wifi', true)
  let cambios = 0

  const aBorrar = (await db.fotos.where('subida').equals(-1).toArray())
  for (const f of aBorrar) {
    if (f.path) await supabase.storage.from('fotos').remove([f.path, pathThumb(f.path)])
    await actualizar('fotos', f.id, { subida: -2 })
    cambios++
  }

  if (!conexionPermitida(soloWifi)) return cambios
  const pendientes = (await db.fotos.where('subida').equals(0).toArray()).filter(f => !f.deleted)
  for (const f of pendientes) {
    const b = await db.blobs.get(f.id)
    if (!b?.full) continue
    const path = `${f.tambo_id}/${f.id}.${ext(b.full)}`
    const r1 = await supabase.storage.from('fotos').upload(path, b.full, { upsert: true, contentType: b.full.type })
    if (r1.error) throw new Error('Fotos: ' + r1.error.message)
    const r2 = await supabase.storage.from('fotos').upload(pathThumb(path), b.thumb, { upsert: true, contentType: b.thumb.type })
    if (r2.error) throw new Error('Fotos: ' + r2.error.message)
    await actualizar('fotos', f.id, { subida: 1, path })
    await db.blobs.update(f.id, { full: null }) // libera espacio, queda la miniatura
    cambios++
  }
  return cambios
}

const cacheUrl = new Map<string, string>()

/** URL para mostrar: primero lo local, si no, enlace firmado de la nube. */
export async function urlFoto(f: Foto, tipo: 'thumb' | 'full'): Promise<string | null> {
  const clave = f.id + tipo
  if (cacheUrl.has(clave)) return cacheUrl.get(clave)!
  const b = await db.blobs.get(f.id)
  const local = tipo === 'full' ? (b?.full ?? null) : (b?.thumb ?? null)
  if (local) {
    const u = URL.createObjectURL(local)
    cacheUrl.set(clave, u)
    return u
  }
  if (f.path && supabase && navigator.onLine) {
    const p = tipo === 'thumb' ? pathThumb(f.path) : f.path
    const { data } = await supabase.storage.from('fotos').createSignedUrl(p, 60 * 60 * 6)
    if (data?.signedUrl) {
      cacheUrl.set(clave, data.signedUrl)
      return data.signedUrl
    }
  }
  if (tipo === 'full' && b?.thumb) return urlFoto(f, 'thumb')
  return null
}
