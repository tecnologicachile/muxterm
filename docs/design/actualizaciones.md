# Actualizaciones: análisis y diseño objetivo

Octubre 2026. Análisis del mecanismo actual y lo que haría falta para que
muxterm se actualice solo en una base instalada grande (cientos de miles o
millones de equipos) sin romperlos ni depender de un servidor que no es
nuestro.

## Cómo funciona hoy

- Cada instalación, 60 s después de arrancar y luego cada 6 h, ejecuta
  `git ls-remote --tags` contra GitHub y compara la última etiqueta `vX.Y.Z`
  con la versión de su `package.json` (`server/update-checker.js`).
- Si hay una etiqueta mayor y el administrador dejó activo el interruptor,
  `checkAutoUpdate` lanza `scripts/update-independent.sh`, que llama a
  `update.sh --yes`: `git stash`, `git fetch`, `git checkout main`,
  `git reset --hard origin/main`, `npm install`, build del cliente en el
  propio equipo, `systemctl restart muxterm`.
- No hay comprobación posterior ni vuelta atrás automática; el log va a
  `logger -t muxterm-update`.

Funciona para un puñado de instalaciones propias. A escala tiene estos
problemas, en orden de gravedad.

## Qué falla a escala

1. **Instala `main`, no la versión.** La etiqueta solo sirve de disparador;
   lo que se despliega es `origin/main` en ese instante, que puede llevar
   commits posteriores a la etiqueta, a medio hacer, o rotos. Dos equipos que
   se actualizan con una hora de diferencia pueden quedar con código
   distinto bajo el mismo número de versión. No hay reproducibilidad ni forma
   de saber qué tiene cada usuario.
2. **Compila en el equipo del usuario.** `npm install` del servidor y del
   cliente, y `vite build`, en cada máquina: minutos de CPU, cientos de MB de
   descargas de npm por instalación, dependencia de que el registro de npm y
   GitHub estén disponibles en ese momento, y fallos distintos en cada combi-
   nación de Node, distro y arquitectura. Ya pasó esta semana: un
   `package-lock.json` desincronizado rompía `npm ci` y nadie lo supo hasta
   probar en limpio. Multiplicado por millones, cada actualización es una
   lotería.
3. **Sin verificación de integridad ni firma.** Se confía en HTTPS a GitHub
   y en `curl | bash`. Si la cuenta o el repositorio se ven comprometidos,
   cada instalación ejecuta lo que haya en `main` a las 6 h, como root en la
   mayoría de los casos (el instalador deja el servicio como root). Para un
   producto que abre terminales, esto es lo primero que un auditor marcará.
4. **Sin salud ni vuelta atrás.** Si la versión nueva no arranca (una
   dependencia nativa que no compila, una migración que falla), el servicio
   queda caído y nada lo repara. A escala, "queda caído" son miles de
   usuarios sin su terminal a la vez.
5. **Todos a la vez.** Un `git ls-remote` por instalación cada 6 h es
   tolerable, pero cuando sale una versión, todas las instalaciones la
   descargan y compilan en la misma ventana de 6 h: picos contra GitHub y
   npm, y si la versión tiene un defecto lo sufren todos antes de que nadie
   pueda frenarlo. No hay despliegue escalonado ni interruptor de emergencia.
6. **Acoplado a GitHub y a git.** El equipo del usuario necesita `git`, el
   clon completo, acceso a github.com y a registry.npmjs.org. Hay redes
   corporativas donde eso no existe, y si cambiamos de forja o de cuenta,
   todas las instalaciones quedan huérfanas.
7. **Permisos difusos.** El script reinicia el servicio con `systemctl`;
   solo funciona porque el servicio corre como root. Con un usuario de
   servicio sin privilegios (que es lo correcto) el actualizador actual deja
   de funcionar.

## Diseño objetivo

El principio: **una versión es un artefacto cerrado, firmado y probado; el
equipo del usuario no compila nada, solo descarga, verifica, cambia un enlace
y comprueba que arrancó**.

### 1. Lanzamiento (del lado nuestro)

- Una etiqueta `vX.Y.Z` dispara CI (GitHub Actions). CI compila el cliente,
  instala dependencias de producción y empaqueta
  `muxterm-X.Y.Z-linux-<arch>.tar.gz` (servidor + `client/dist` +
  `node_modules` de producción; sin guacd ni ttyd, que son del sistema). Una
  por arquitectura (x64, arm64).
- CI publica el paquete como asset del release con `SHA256SUMS` y una firma
  (minisign o cosign; la clave pública va embebida en el código y en el
  instalador).
- CI publica también la imagen Docker con la misma etiqueta.
- CI actualiza un **manifiesto** estático por canal:
  `https://updates.muxterm.app/stable.json` (o un asset del release servido
  por CDN) con: versión, URL del paquete por arquitectura, hash, firma,
  versión mínima desde la que se puede saltar, porcentaje de despliegue
  (`rollout`), fecha y resumen de cambios.
- Canales: `stable` (por defecto), `beta`. El administrador elige en
  Configuración.

### 2. Comprobación (del lado del usuario)

- Cada instalación tiene un `install_id` aleatorio generado una vez (no
  identifica a nadie; sirve para el escalonado).
- Comprueba el manifiesto cada 6 h **con jitter** (± 1 h aleatorio) y 1–5
  minutos tras arrancar, nunca en el mismo segundo que las demás. Una sola
  petición HTTPS a un archivo estático en CDN: coste cero para nosotros y
  para GitHub, aunque sean millones.
- Aplica solo si `versión > actual`, `actual ≥ versión mínima`, y
  `hash(install_id) mod 100 < rollout`. Así una versión sale al 5 %, luego
  25 %, luego 100 %, y si aparece un defecto se baja `rollout` a 0 en el
  manifiesto y nadie más la recibe. Ese es el interruptor de emergencia.

### 3. Aplicación

- Descarga el paquete a `releases/X.Y.Z.tmp`, verifica SHA256 y firma; si
  falla, borra y registra. Nada se ejecuta sin firma válida.
- Descomprime en `/opt/muxterm/releases/X.Y.Z/`. El servicio apunta a
  `/opt/muxterm/current` (enlace simbólico). Datos, `.env`, `certs/` y
  `data/` viven fuera de `releases/` y no se tocan.
- Migraciones de base de datos: en el arranque, idempotentes y con número de
  esquema; una versión nueva nunca borra columnas, solo añade (lo que ya
  hacemos con `CREATE TABLE IF NOT EXISTS`).
- Cambia el enlace `current` → `X.Y.Z` y reinicia. Esto no necesita root si
  el usuario de servicio es dueño de `/opt/muxterm` y la unidad tiene
  `Restart=always` y un `ExecReload`; el actualizador termina el proceso y
  systemd lo levanta.
- **Comprobación de salud**: 30 s después, `GET /api/health` tiene que
  responder con la versión nueva. Si no, vuelve el enlace a la anterior,
  reinicia, marca la versión como fallida (no la reintenta) y lo registra.
  Conserva las dos últimas versiones; borra las anteriores.
- Avisa en la interfaz antes (si hay sesiones activas: "se actualizará en X
  min, guarda tu trabajo") y después (qué cambió), con la opción de posponer
  hasta una hora.

### 4. Lo que se mantiene

- El interruptor de administrador (por defecto activado solo para
  `stable`), el botón "actualizar ahora", y el toast actual.
- El camino git (`git pull` + build) solo para quien instaló desde el código
  (`MUXTERM_DEV=1` o `.git` presente): desarrolladores y contribuidores.
- `update.sh` como herramienta manual para ese caso, no como mecanismo.

### 5. Instalador

- Pasa a ser un envoltorio del mismo mecanismo: instala dependencias del
  sistema (ttyd, guacd, tmux), crea el usuario de servicio y la unidad, y
  llama al actualizador para traer la última versión firmada. Así instalar y
  actualizar son el mismo código y se prueban juntos.
- `curl | bash` se queda como atajo, pero el script publica su hash y la
  documentación ofrece el paquete `.deb`/`.rpm` (CI puede generarlos con
  `nfpm`) para quien no quiere ejecutar scripts remotos.

## Estado (10-oct-2026)

- Entrega 1 hecha: `.github/workflows/release.yml`, `scripts/package-release.sh`,
  `sign-release.sh`, `make-manifest.sh`, `release/allowed_signers`.
- Entrega 2 hecha: `server/updater.js` + `server/paths.js` + `scripts/boot-guard.sh`.
  Probada en un LXC con el esquema `home/releases/<v>` + `home/current`:
  actualización automática y manual 1.1.61 → 1.1.62 con confirmación de
  salud; una 1.1.63 rota a propósito cae dos veces y el guardián de arranque
  devuelve `current` a 1.1.62 en segundos y la marca como fallida; el
  siguiente chequeo la rechaza aunque el manifiesto la anuncie.
- Un detalle que el diseño original no contemplaba y las pruebas sí: la
  vuelta atrás no puede depender del código de la versión nueva (si muere en
  la primera línea, su actualizador nunca corre). De ahí el guardián en
  `home/bin`, ejecutado por `ExecStartPre` desde fuera de `releases/`.
- Entrega 3 hecha: `install.sh` descarga y verifica el paquete firmado con la
  clave pública embebida y lo deja en `releases/<v>` + `current` (si no hay
  paquete publicado cae al clon de siempre); como root crea el usuario de
  servicio `muxterm`; la unidad lleva `MUXTERM_HOME` y `ExecStartPre` al
  guardián. `scripts/migrate-to-packages.sh` pasa una instalación clonada al
  esquema nuevo y vuelve atrás si la salud no responde. Probado en un Debian
  12 limpio (CT 136): servicio activo como `muxterm`, `current` →
  `releases/1.1.62`, login correcto.
- Entrega 4 hecha: el manifiesto vive en la rama `channels` (`stable.json`,
  `beta.json`, con `.sig`), escrita por CI en cada etiqueta; una etiqueta con
  guion (`v1.2.0-beta.1`) va al canal beta. El actualizador lee el canal de
  `updateChannel`; con clientes conectados anuncia la versión y espera dos
  minutos (`update-available` con `scheduledAt`), con `POST
  /api/updater/postpone` se aplaza una hora; sin clientes aplica de
  inmediato. `scripts/set-rollout.sh <canal> <porcentaje> <clave>` cambia el
  porcentaje del manifiesto publicado. En Settings, el panel "Versión y
  actualizaciones" muestra versión, canal, última comprobación, disponible,
  última vuelta atrás, y los botones Buscar / Actualizar / Posponer. Probado
  en el CT 135: con un navegador conectado programó 1.1.63 a dos minutos,
  posponer devolvió +1 h, al reiniciar sin clientes la aplicó al instante y
  el guardián la devolvió a 1.1.62.
- Pendiente: primera etiqueta real (`v1.1.62`) que cree la rama `channels`;
  hasta entonces el instalador cae al clon y el panel muestra el 404 del
  manifiesto. Producción (Node 22) sigue en modo checkout a propósito.

## Entregas

1. **Artefactos firmados en CI** (sin cambiar aún el cliente): workflow que
   en cada etiqueta construye, firma y publica paquete, sumas y manifiesto.
   Verificable a mano. Es también el primer workflow del repo.
2. **Nuevo actualizador en el servidor** (`server/updater.js`): manifiesto,
   jitter, rollout, descarga, verificación, `releases/` + `current`, salud y
   vuelta atrás. Convive con el actual detrás de una bandera hasta probarlo
   en los LXC de prueba (133, y uno nuevo que arranque desde una versión
   vieja).
3. **Instalador como envoltorio** del actualizador, usuario de servicio,
   unidad con `Restart=always`. Probado en Debian, Ubuntu y LXC sin
   privilegios como esta semana.
4. **Despliegue escalonado y canal beta** en el manifiesto, interfaz de
   aviso previo y changelog.

Cada entrega se puede publicar sola. La 1 no cambia nada en los equipos de
los usuarios; la 2 es la que importa y la que hay que probar más.

## Riesgos y decisiones abiertas

- **Dominio del manifiesto.** Un dominio propio (`updates.muxterm.app`) nos
  desacopla de GitHub, pero hay que pagarlo y mantenerlo; un asset de
  release en GitHub servido por su CDN es gratis y suficiente mientras el
  proyecto viva en GitHub. Empezaría por GitHub con la URL configurable.
- **Clave de firma.** Dónde vive y quién la rota. Mínimo: una clave de
  minisign en un secreto de CI y copia fuera de línea; la pública en el
  código. Si se pierde la privada, hay que rotar con una versión firmada
  por la vieja que traiga la nueva.
- **Dependencias nativas** (`better-sqlite3`, `node-pty`) van compiladas en
  el paquete por arquitectura y versión de Node; hay que fijar la versión de
  Node que el instalador pone (hoy la que traiga NodeSource, 24 en las
  pruebas) y compilar los paquetes contra esa.
- **Usuarios con cambios locales** en `/opt/muxterm` (como teníamos nosotros
  hasta hoy): el nuevo esquema los ignora porque cada versión es un
  directorio nuevo. Hay que decirlo en el changelog de la versión que haga
  el cambio.
