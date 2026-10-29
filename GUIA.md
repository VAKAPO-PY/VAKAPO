# VAKAPO · Guía

## Esta instalación

| Pieza | Dónde |
|---|---|
| App (para usar y compartir) | https://vakapo-py.github.io/VAKAPO/ |
| Código | https://github.com/VAKAPO-PY/VAKAPO |
| Base de datos, usuarios y fotos | Supabase · proyecto `vakapo` (São Paulo, plan Free) |

Todo funciona con planes gratuitos. Cada cambio que se sube a la rama `main` se compila y publica solo (GitHub Actions → rama `gh-pages`).

## Primer uso

1. Abrir la app en el celular → **Crear cuenta**.
2. **La primera cuenta creada es administrador.** Crear la propia antes de compartir la dirección.
3. Ajustes → *Productos y servicios*: cargar los precios generales (guaraníes).
4. Crear el primer tambo → Configuración del tambo: lotes y precios propios de ese tambo.

## Usuarios

- **Otro podólogo/veterinario:** crea su cuenta en la app → Ajustes → *Usuarios y permisos* → rol **Administrador**.
- **Propietario o encargado:** crea su cuenta → Ajustes → *Usuarios y permisos* → marcar su tambo. Solo ve ese tambo y solo puede dejar notas y avisos.

## Instalar en el celular

- **Android (Chrome):** abrir la dirección → menú ⋮ → **Instalar app**.
- **iPhone (Safari):** Compartir → **Agregar a inicio**.

Después de entrar una vez con internet, funciona sin señal.

## Uso sin señal

- Cada toque se graba en el equipo al instante. Si se cierra la app o se apaga el equipo, al reabrir vuelve al mismo punto.
- Arriba a la derecha: *Al día*, *N pend.* (esperando señal) o *Sin señal*. Se sube solo al volver la conexión.
- Fotos: se achican en el celular (~150 KB). Con *Subir fotos solo con WiFi* no gastan datos móviles.
- No cerrar sesión con registros pendientes (la app avisa).
- Varios equipos pueden registrar a la vez en el mismo tambo sin pisarse.

## Mantenimiento automático

- **Mantener Supabase activo** (cada 3 días): evita que el plan gratuito pause la base por inactividad.
- **Respaldo**: Ajustes → *Descargar respaldo (JSON)* en cualquier momento. Opcional: respaldo semanal automático cifrado — requiere cargar en GitHub (Settings → Secrets and variables → Actions) los secrets `SUPABASE_SERVICE_KEY` (clave secreta de Supabase) y `BACKUP_CLAVE` (contraseña inventada).
- Si GitHub desactiva una tarea programada: pestaña **Actions** → elegir la tarea → *Enable workflow*.

### Restaurar un respaldo semanal

```bash
openssl enc -d -aes-256-cbc -pbkdf2 -in vakapo-respaldo-FECHA.json.gz.enc -out respaldo.json.gz -pass pass:TU_BACKUP_CLAVE
gunzip respaldo.json.gz
```

Luego en la app: Ajustes → **Importar respaldo**.

## Límites del plan gratuito

| Recurso | Límite | Equivale a |
|---|---|---|
| Base de datos | 500 MB | Años de registros para varios tambos |
| Fotos | 1 GB | ~6.000 fotos comprimidas |
| Pausa por inactividad | 7 días | Evitada por la tarea automática |

## Configuración técnica

- `.env.production`: dirección de Supabase y su clave **publicable** (pensada para ir en la app; los datos los protegen el login y las reglas de acceso). Nunca poner ahí la clave secreta.
- `supabase/schema.sql`: tablas, reglas de acceso y fotos. Se puede volver a ejecutar sin romper nada (Supabase → SQL Editor).
- GitHub Pages: Settings → Pages → *Deploy from a branch* → `gh-pages` / `(root)`.

## Para programadores

```bash
npm install
npm run dev      # http://localhost:5173 (usa .env.local si existe; si no, modo local sin nube)
npm run build
```

- React 18 + TypeScript + Vite, PWA con `vite-plugin-pwa`.
- Base local: IndexedDB con Dexie (`src/lib/db.ts`). Sincronización: `src/lib/sync.ts`.
- Catálogo ICAR inicial: `src/lib/seed.ts`. Zonas y diagrama: `src/lib/anatomia.ts`, `src/components/Diagrama.tsx`.
