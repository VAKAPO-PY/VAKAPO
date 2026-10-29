// Descarga todas las tablas de Supabase en un JSON compatible con "Ajustes → Importar respaldo".
// Uso: SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/backup.mjs salida.json
import { writeFileSync } from 'node:fs'

const URL_BASE = process.env.SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_KEY
const salida = process.argv[2] || 'respaldo.json'
if (!URL_BASE || !KEY) { console.error('Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY'); process.exit(1) }

const TABLAS = ['tambos', 'lotes', 'categorias', 'vacas', 'lesiones', 'items', 'tarifas', 'jornadas', 'examenes',
  'hallazgos', 'cargos', 'recetas', 'fotos', 'notas_prop', 'miembros', 'perfiles']
const headers = { apikey: KEY, Accept: 'application/json' }
if (KEY.startsWith('eyJ')) headers.Authorization = `Bearer ${KEY}`

const datos = {}
for (const t of TABLAS) {
  datos[t] = []
  for (let desde = 0; ; desde += 1000) {
    const r = await fetch(`${URL_BASE}/rest/v1/${t}?select=*&order=id&limit=1000&offset=${desde}`, { headers })
    if (!r.ok) throw new Error(`${t}: ${r.status} ${await r.text()}`)
    const filas = await r.json()
    datos[t].push(...filas)
    if (filas.length < 1000) break
  }
  console.log(`${t}: ${datos[t].length}`)
}
writeFileSync(salida, JSON.stringify({ app: 'vakapo', version: 1, fecha: new Date().toISOString(), datos }))
console.log('Respaldo listo:', salida)
