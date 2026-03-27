# Plan: Eliminar Sesiones + SSH por Panel

## Resumen

Refactorizar muxterm para eliminar el concepto de "sesiones" y reemplazarlo con un workspace unico por usuario. Cada terminal (panel) puede ser local o SSH de forma independiente.

**Arquitectura actual:**
```
User → Sessions → Panels/Terminals (SSH a nivel de sesion)
```

**Arquitectura objetivo:**
```
User → Workspace unico → Terminals ilimitados (SSH por terminal individual)
       max 8 visibles, resto minimizados
```

---

## Fase 1: Base de datos - Nuevo esquema workspace

**Objetivo:** Crear tabla `workspace_layouts` vinculada a usuario (no a sesion), y modificar `terminals` para que referencien `user_id` en vez de `session_id`. Mantener tablas viejas temporalmente.

### Cambios en `db/database.js`

1. **Nueva tabla `workspace_layouts`** (reemplaza `session_layouts`):
```sql
CREATE TABLE IF NOT EXISTS workspace_layouts (
  user_id INTEGER PRIMARY KEY,
  layout TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

2. **Modificar tabla `terminals`** - agregar `user_id`, hacer `session_id` nullable, agregar `ssh_connection_id`:
```sql
ALTER TABLE terminals ADD COLUMN user_id INTEGER REFERENCES users(id);
ALTER TABLE terminals ADD COLUMN ssh_connection_id INTEGER REFERENCES ssh_connections(id);
```

3. **Nuevas funciones en database.js:**
   - `saveWorkspaceLayout(userId, layout)` - UPSERT en workspace_layouts
   - `getWorkspaceLayout(userId)` - SELECT de workspace_layouts
   - `createTerminalForUser(id, userId, panelId, sshConnectionId)` - INSERT terminal con user_id
   - `findTerminalsByUserId(userId)` - SELECT terminals WHERE user_id
   - `deleteTerminalByUser(terminalId, userId)` - DELETE con validacion de user_id

4. **Mantener** funciones de ssh_connections sin cambios (ya estan vinculadas a user_id)

### Verificacion
- [ ] Tabla workspace_layouts existe
- [ ] Terminals puede tener user_id y ssh_connection_id
- [ ] Funciones CRUD del workspace funcionan
- [ ] ssh_connections sin cambios

---

## Fase 2: Server - Reemplazar logica de sesiones por workspace

**Objetivo:** Modificar `server/index.js` para usar workspace por usuario en vez de sesiones.

### Cambios en `server/index.js`

1. **Eliminar eventos de sesion:**
   - `create-session`
   - `get-sessions`
   - `delete-session`
   - `delete-all-sessions`
   - `get-session-layout`
   - `update-session-layout`
   - `update-session-name`
   - `restore-session`

2. **Nuevos eventos de workspace:**
   - `get-workspace` → retorna layout del usuario (panels, minimized, activePanel)
   - `update-workspace` → guarda layout del usuario
   - `create-terminal` → modificar para recibir `{ sshConnectionId }` (sin sessionId), crear terminal vinculado a user_id
   - `close-terminal` → modificar para validar ownership por user_id
   - `restore-terminal` → modificar para no requerir sessionId

3. **Modificar `create-terminal` (linea 418-452):**
   - Ya no recibe `sessionId`
   - Recibe opcionalmente `sshConnectionId`
   - Usa `socket.userId` para vincular terminal al usuario
   - Si `sshConnectionId` presente: `database.getSshConnection(sshConnectionId)` para obtener config SSH
   - Pasa config SSH a `ttydManager.createTerminal()`

4. **Simplificar conexion socket (linea 396-411):**
   - Al conectar, enviar workspace layout en vez de lista de sesiones
   - `socket.emit('workspace', database.getWorkspaceLayout(socket.userId))`

### Cambios en `server/session.js`
- Este archivo se puede **eliminar completamente** o reducir a funciones utilitarias

### Verificacion
- [ ] Login + socket connection devuelve workspace layout
- [ ] create-terminal funciona sin sessionId
- [ ] create-terminal con sshConnectionId conecta via SSH
- [ ] close-terminal valida ownership
- [ ] update-workspace persiste layout

---

## Fase 3: Cliente - Ruta directa login → terminal

**Objetivo:** Eliminar SessionList, redirigir login directamente al workspace de terminales.

### Cambios en routing (`App.jsx`)

1. **Eliminar ruta `/sessions`**
2. **Cambiar ruta `/terminal/:sessionId` → `/workspace`** (sin parametros)
3. **Login exitoso → navegar a `/workspace`**
4. **Ruta `/` → redirigir a `/workspace` si autenticado**

### Eliminar `SessionList.jsx`
- Este componente se elimina completamente

### Cambios en `TerminalView.jsx` (renombrar a `WorkspaceView.jsx` o mantener)

1. **Eliminar dependencia de `sessionId` y `searchParams`:**
   - Ya no extrae `sessionId` de URL
   - Ya no extrae `sshConnectionId` de query params

2. **Cargar workspace al montar:**
   ```javascript
   useEffect(() => {
     if (socket) {
       socket.emit('get-workspace');
       socket.on('workspace', (data) => {
         if (data && data.panels) {
           setPanels(data.panels);
           setActivePanel(data.activePanel);
           setMinimizedPanels(data.minimizedPanels || []);
           // calcular terminalCounter
         } else {
           // crear panel inicial
         }
       });
     }
   }, [socket]);
   ```

3. **Guardar workspace al cambiar panels:**
   ```javascript
   useEffect(() => {
     if (socket && panels.length > 0) {
       socket.emit('update-workspace', {
         panels, activePanel, minimizedPanels
       });
     }
   }, [panels, activePanel, minimizedPanels]);
   ```

4. **Boton "+ Terminal" abre dialogo con opcion Local/SSH:**
   - Local: crea terminal directamente
   - SSH: muestra selector de conexion SSH guardada o formulario para nueva
   - Cada panel almacena su propio `sshConnectionId` en el objeto panel

5. **Eliminar limite de 8 paneles totales** - solo 8 visibles, sin limite de minimizados

### Cambios en `PanelManager.jsx`
- Ya no recibe `sessionId` ni `sshConnectionId` como props
- Cada panel tiene su propio `sshConnectionId` en `panel.sshConnectionId`

### Cambios en `Terminal.jsx`
- Ya no recibe `sessionId` como prop obligatorio
- Recibe `sshConnectionId` del panel individual: `panel.sshConnectionId`
- `create-terminal` payload: `{ sshConnectionId }` (sin sessionId)

### Verificacion
- [ ] Login redirige directo a workspace
- [ ] No existe ruta /sessions
- [ ] Workspace carga layout del usuario
- [ ] Nuevo terminal local funciona
- [ ] Nuevo terminal SSH funciona con conexion seleccionada
- [ ] Minimizar/restaurar funciona sin limite
- [ ] Layout persiste al recargar

---

## Fase 4: Dialogo "New Terminal" con SSH

**Objetivo:** Crear un dialogo para el boton "+ Terminal" que permita elegir Local o SSH.

### Nuevo componente o dialogo en `TerminalView.jsx`

1. **Dialogo con dos tabs:** "Local" | "SSH"

2. **Tab Local:** Solo boton "Create" (crea terminal local inmediatamente)

3. **Tab SSH:**
   - Dropdown con conexiones SSH guardadas del usuario
   - Opcion "New connection" con formulario: host, port, username, password
   - Boton "Connect" que:
     a. Si es nueva conexion: emite `create-ssh-connection` primero, luego crea terminal
     b. Si es existente: crea terminal con `sshConnectionId`

4. **El panel creado almacena `sshConnectionId`** en su objeto:
   ```javascript
   const newPanel = {
     id: uuidv4(),
     terminalId: null,
     name: `Terminal ${terminalCounter}`,
     sshConnectionId: selectedSshId || null  // null = local
   };
   ```

### Verificacion
- [ ] Dialogo aparece al hacer click en "+ Terminal"
- [ ] Tab Local crea terminal local
- [ ] Tab SSH lista conexiones guardadas
- [ ] Tab SSH permite crear nueva conexion
- [ ] Terminal SSH se conecta correctamente
- [ ] Panel muestra indicador de SSH vs Local

---

## Fase 5: Limpieza y migracion

**Objetivo:** Eliminar codigo muerto y migrar datos existentes.

### Eliminar archivos
- `server/session.js` (si ya no se usa)
- `client/src/components/SessionList.jsx`

### Limpiar DB
- Migrar layouts existentes de `session_layouts` a `workspace_layouts`
- Migrar terminals existentes: copiar `session.user_id` a `terminal.user_id`
- Opcionalmente: DROP tables `sessions`, `session_layouts` despues de migrar

### Limpiar imports y codigo muerto
- Eliminar todas las referencias a sessionId en el cliente
- Eliminar rutas de API de sesiones en el server
- Actualizar AppHeader si muestra info de sesion

### Verificacion final
- [ ] No hay referencias a "session" en el codigo activo (excepto express-session para auth)
- [ ] Todos los tests pasan
- [ ] Login → workspace funciona end-to-end
- [ ] SSH por panel funciona
- [ ] Layout persiste al recargar
- [ ] Multi-usuario funciona (cada user ve su workspace)
- [ ] Deploy a testing (192.168.10.150) exitoso

---

## Archivos afectados

| Archivo | Accion |
|---------|--------|
| `db/database.js` | Modificar: nuevas tablas y funciones |
| `server/index.js` | Modificar: reemplazar eventos de sesion |
| `server/session.js` | Eliminar |
| `client/src/App.jsx` | Modificar: nuevas rutas |
| `client/src/components/SessionList.jsx` | Eliminar |
| `client/src/components/TerminalView.jsx` | Modificar: workspace sin sessionId |
| `client/src/components/PanelManager.jsx` | Modificar: SSH por panel |
| `client/src/components/Terminal.jsx` | Modificar: sin sessionId |
| `client/src/components/AppHeader.jsx` | Modificar: sin nombre de sesion |

## Orden de ejecucion

Fase 1 → Fase 2 → Fase 3 → Fase 4 → Fase 5

Cada fase se puede deployar y testear de forma independiente en 192.168.10.150:3002.
