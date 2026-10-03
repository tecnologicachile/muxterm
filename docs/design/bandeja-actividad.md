# Bandeja de actividad de sesiones Claude

Diseño, octubre 2026. Pendiente de validación antes de escribir código.

## Problema

Con diez o más sesiones de Claude Code trabajando a la vez, la pregunta al
volver de una interrupción es "qué pasó mientras no estaba y qué espera por
mí". Hoy muxterm responde con tres señales por terminal (punto en la pestaña,
tinte en la cabecera, línea de estado) que hay que recorrer panel por panel, y
el estado "visto" vive en memoria del navegador (`unseen` en
`TerminalView.jsx`): se pierde al recargar y no existe en el otro dispositivo.
Marcas una sesión como vista, te vas, vuelves y ya no sabes cuál era.

## Principio

Un registro de eventos por sesión es la única fuente de verdad. Las pestañas,
las cabeceras, la bandeja y cualquier vista futura se derivan de él. No se
agrega un cuarto indicador: se reemplaza el cálculo disperso por uno solo.

## Modelo

### Evento

Una fila por hecho relevante de una sesión Claude. Solo sesiones Claude; un
terminal genérico no tiene eventos con sentido.

| Campo | Tipo | Nota |
|---|---|---|
| `id` | integer | autoincrement |
| `user_id` | integer | dueño del terminal |
| `terminal_id` | text | la sesión |
| `kind` | text | ver tabla siguiente |
| `ts` | text ISO | del transcript (`ev.ts`), no del servidor |
| `summary` | text ≤ 300 | lo que se muestra en la lista |
| `ref` | text | `uuid` del evento de transcript, para deduplicar |
| `seen_at` | text ISO o null | null = pendiente |
| `resolved_at` | text ISO o null | solo para `waiting`/`permission`: cuándo dejó de esperar |

Tipos de evento y qué los dispara (todo sale de `transcript.parseLine`, que
`claude-status.js` ya consume):

| `kind` | Disparador | `summary` |
|---|---|---|
| `prompt` | `kind === 'prompt'` | primeras 300 letras del prompt |
| `done` | `kind === 'turn'` sin `reason` o `reason === 'away'` | último `text` no narración del turno |
| `interrupted` | `turn` con `reason === 'interrupted'` | "Interrumpido" |
| `waiting` | `tool` en `WAITING_TOOLS` sin resultado | la pregunta (`input.question`) o "Plan listo para revisar" |
| `permission` | `readPermission` devuelve algo nuevo | título del permiso |
| `error` | `result` con `ok === false` en un `command`, o `text` que empieza por "Error" (afinar en implementación) | el texto |

`prompt` entra al registro para dar contexto ("qué le pedí") pero nace con
`seen_at` puesto: nadie necesita que se le avise de lo que escribió. Las
narraciones (`narration: true`) no generan evento; son ruido para este fin.

### Resolución

`waiting` y `permission` son los únicos eventos con estado: cuando llega el
`result` del tool, o el permiso desaparece de la pantalla, se escribe
`resolved_at`. Un evento resuelto sale de "Esperando por ti" aunque nadie lo
haya marcado visto.

### Visto

`seen_at` se escribe por evento, en el servidor, desde cualquier dispositivo.
Tres formas de marcar:

- Clic en la entrada de la bandeja (marca esa).
- Seleccionar el panel con el terminal visible (marca todos los de esa
  sesión hasta ese instante; es lo que hoy hace `unseen` en memoria).
- "Marcar todo como visto" en la cabecera de la bandeja.

Retención: 7 días o 500 eventos por sesión, lo que llegue antes; los
`waiting`/`permission` no resueltos no se borran. Limpieza en el mismo tick
horario que ya limpia `credential_cache`.

## Servidor

### `server/claude-activity.js` (nuevo)

Sustituye la parte de estado de `claude-status.js`, que pasa a ser una vista
derivada: `busy` = hay `prompt` posterior al último `done`; `waiting` = hay
`waiting`/`permission` sin `resolved_at`; `lastText` = `summary` del último
`done`. El tailer (un solo `tick` por segundo sobre todas las sesiones, como
hoy) deja de mutar un `Map` y pasa a escribir filas; la deduplicación por
`ref` hace idempotente el arranque (`readTail` reprocesa la cola del archivo
sin duplicar).

Emisión por socket al dueño, mismo patrón que `emit()` actual:

- `activity:new` `{ event }` al insertar.
- `activity:update` `{ id, seen_at, resolved_at }` al cambiar.
- `claude-status` se mantiene con el mismo payload para no tocar las
  pestañas en la primera entrega; se calcula desde el registro.

### API

| Ruta | Qué |
|---|---|
| `GET /api/activity?since=&limit=&terminalId=` | lista paginada, más nuevo primero |
| `GET /api/activity/pending` | `waiting`/`permission` sin resolver + `done`/`error` sin ver, agrupado por sesión |
| `POST /api/activity/seen` `{ ids }` o `{ terminalId, until }` | marca visto |
| `POST /api/activity/seen-all` | todo lo del usuario |

Autenticación como el resto (`authenticateToken`, filtra por `user_id`).

### Base de datos

Tabla `claude_activity` en `db/database.js`, índices
`(user_id, ts DESC)` y `(terminal_id, ref)` único. Migración: crear si no
existe, como las demás tablas. Sin migración de datos: el registro arranca
vacío y se llena con la cola de cada transcript al primer `readTail`.

## Cliente

### Bandeja

Un panel lateral derecho (escritorio) o una vista a pantalla completa desde
el drawer (móvil), con un botón fijo en la barra superior que muestra el
contador de pendientes. Dos bloques:

1. **Esperando por ti.** `waiting` y `permission` sin resolver. Siempre
   arriba, fondo ámbar como el tinte actual de "necesita respuesta". Cada
   entrada: nombre del panel, la pregunta, hace cuánto. Clic → abre el panel
   en modo conversación con el selector o el permiso a la vista (ya existe la
   lógica que empuja al panel al responder un picker).
2. **Actividad.** Cronológica, lo más nuevo arriba, `done`, `error`,
   `interrupted` y, atenuados, `prompt`. Agrupado por día. Entrada: nombre
   del panel, resumen, hora. Punto a la izquierda si no está visto. Clic →
   selecciona el panel y marca visto.

Filtros: por sesión (chips con los nombres de los paneles que tienen
eventos) y "solo pendientes". Búsqueda de texto no en la primera entrega.

### Indicadores existentes

El punto ámbar de la pestaña y el tinte de la cabecera dejan de calcularse
con `unseen` en memoria y pasan a `hayEventosNoVistos(terminalId)` sobre el
registro recibido por socket. Comportamiento idéntico al de hoy para quien no
abra la bandeja, pero ahora sobrevive a la recarga y es el mismo en el
teléfono.

### Móvil

El contador va en la barra superior junto al menú. La bandeja es la primera
pantalla útil al abrir la PWA tras un rato: si hay pendientes, un toque te
deja en el panel que espera. Las entradas tienen altura táctil (44 px) y el
texto se corta a dos líneas.

## Qué no entra en la primera entrega

- Resumen diario generado por Claude ("qué hicieron las 12 sesiones").
- Notificaciones push cuando una sesión espera: el registro deja el gancho
  listo (`activity:new` con `kind === 'waiting'`), la entrega va aparte.
- Métricas de tiempo por proyecto.
- Eventos de terminales no Claude.

Las cuatro se construyen sobre el mismo registro sin cambiar el modelo.

## Entregas

1. Registro y tailer: tabla, `claude-activity.js`, `claude-status` derivado.
   Sin UI nueva; se verifica que pestañas y cabeceras se comportan igual y
   que `/api/activity` devuelve lo esperado. Despliegue en LXC (150).
2. Bandeja de escritorio con los dos bloques y "marcar visto".
3. Móvil y filtros.

Cada entrega es desplegable por sí sola; la 1 no cambia nada visible.

## Riesgos

- **Doble tailer.** Hoy `claude-sessions.watch` (modo conversación) y
  `claude-status.tick` leen cada transcript por separado. El registro se
  alimenta solo del segundo; no se unifican en esta entrega para no tocar el
  modo conversación. Coste: leer dos veces los mismos bytes, que ya ocurre.
- **Transcripts de 100+ MB.** `readTail` solo mira los últimos 2 MB; una
  sesión larguísima arranca con pocos eventos históricos. Aceptable: la
  bandeja es para lo reciente.
- **Permisos.** Se leen de pantalla (`readPermission`), no del transcript;
  si cambia el dibujo del prompt en Claude Code, el evento `permission` deja
  de generarse. Es la misma fragilidad que hoy, no una nueva.
