# Plan: Soporte RDP en MuxTerm

## Fase 0: Hallazgos de investigacion

### Stack tecnologico confirmado

```
React (guacamole-common-js)
  --> WebSocket
    --> guacamole-lite (Node.js proxy, misma instancia Express)
      --> TCP :4822
        --> guacd (daemon Guacamole)
          --> RDP al host destino
```

### Paquetes npm confirmados
- **Server**: `guacamole-lite` v1.2.0 - proxy WebSocket que conecta a guacd
- **Client**: `guacamole-common-js` v1.5.0 - canvas-based display + input handling

### guacd (daemon)
- Puerto default: **4822**
- Docker: `docker run -d -p 4822:4822 guacamole/guacd`
- Nativo: requiere `freerdp2-dev`, `libcairo2-dev`, build from source

### Diferencia clave con ttyd
- ttyd usa **iframe** con su propio HTML
- Guacamole usa **canvas** renderizado directamente en el DOM via `client.getDisplay().getElement()`
- No hay iframe — el componente RDP renderiza un canvas directamente dentro del panel

### APIs confirmadas

**Server (guacamole-lite):**
```javascript
const GuacamoleLite = require('guacamole-lite');
const guacServer = new GuacamoleLite(
  { server: httpServer },           // WebSocket attached to Express server
  { host: '127.0.0.1', port: 4822 }, // guacd address
  { crypt: { cypher: 'AES-256-CBC', key: '32-byte-secret-key-here!!!!!!!!' } }
);
```

**Token encryption (server-side):**
```javascript
const tokenObject = {
  connection: {
    type: "rdp",
    settings: {
      hostname: "10.0.0.12",
      username: "Administrator",
      password: "password",
      "ignore-cert": true,
      "security": "any"
    }
  }
};
// Encrypt with AES-256-CBC, send to client as base64
```

**Client (guacamole-common-js):**
```javascript
const tunnel = new Guacamole.WebSocketTunnel('ws://server/guacamole/');
const client = new Guacamole.Client(tunnel);
document.getElementById('display').appendChild(client.getDisplay().getElement());
client.connect(`token=${encodeURIComponent(encryptedToken)}`);

// Scaling
const display = client.getDisplay();
display.scale(containerWidth / display.getWidth());

// Input
const mouse = new Guacamole.Mouse(display.getElement());
mouse.onEach(['mousedown','mouseup','mousemove'], e => client.sendMouseState(e.state));
const keyboard = new Guacamole.Keyboard(document);
keyboard.onkeydown = keysym => client.sendKeyEvent(1, keysym);
keyboard.onkeyup = keysym => client.sendKeyEvent(0, keysym);
```

---

## Fase 1: Instalar guacd en servidor de testing

**Objetivo:** guacd corriendo en 192.168.10.150 escuchando en puerto 4822.

### Pasos
1. SSH a 192.168.10.150
2. Instalar Docker si no esta disponible, o instalar guacd nativo
3. Correr `docker run -d --name guacd -p 4822:4822 guacamole/guacd`
4. Verificar: `nc -z localhost 4822 && echo OK`

### Verificacion
- [ ] `docker ps` muestra guacd corriendo
- [ ] Puerto 4822 accesible localmente

---

## Fase 2: Server - Integrar guacamole-lite

**Objetivo:** guacamole-lite proxy corriendo dentro del server Express existente.

### Cambios

1. **Instalar dependencia**: `npm install guacamole-lite`

2. **Nuevo archivo `server/guacamole-manager.js`:**
   - Constructor: recibe httpServer, configura GuacamoleLite
   - Metodo `createToken(rdpConfig)`: encrypta token con AES-256-CBC
   - Metodo `getWebSocketPath()`: retorna path del WebSocket (/guacamole/)

3. **Modificar `server/index.js`:**
   - Importar guacamole-manager
   - Inicializar con el httpServer existente
   - Nuevo socket event `create-rdp-token`:
     - Recibe `{ rdpConnectionId }` o `{ host, port, username, password }`
     - Busca config en DB si es rdpConnectionId
     - Genera token encriptado
     - Emite `rdp-token-created` con `{ token, wsUrl }`

4. **Modificar `db/database.js`:**
   - Nueva tabla `rdp_connections` (similar a ssh_connections):
     ```sql
     CREATE TABLE IF NOT EXISTS rdp_connections (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       user_id INTEGER NOT NULL,
       name TEXT NOT NULL,
       host TEXT NOT NULL,
       port INTEGER DEFAULT 3389,
       username TEXT NOT NULL,
       password TEXT,
       domain TEXT,
       created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
       FOREIGN KEY (user_id) REFERENCES users(id)
     );
     ```
   - CRUD functions: createRdpConnection, getRdpConnections, getRdpConnection, deleteRdpConnection

### Verificacion
- [ ] `npm install guacamole-lite` exitoso
- [ ] guacamole-manager.js carga sin errores
- [ ] Token se genera y se puede desencriptar
- [ ] Server arranca sin errores

---

## Fase 3: Client - Componente RdpViewer

**Objetivo:** Componente React que renderiza un escritorio RDP dentro de un panel.

### Instalar dependencia
`cd client && npm install guacamole-common-js`

### Nuevo archivo `client/src/components/RdpViewer.jsx`

Componente que:
1. Recibe props: `{ rdpConnectionId, isActive, panelId, onActivityChange }`
2. Al montar: emite `create-rdp-token` al socket con rdpConnectionId
3. Recibe `rdp-token-created` con token y wsUrl
4. Crea `Guacamole.WebSocketTunnel` y `Guacamole.Client`
5. Appends `client.getDisplay().getElement()` a un div ref
6. Configura mouse y keyboard input
7. Implementa 3 modos de display:
   - **Fit**: `display.scale(Math.min(containerW/displayW, containerH/displayH))`
   - **Stretch**: CSS `transform: scale(scaleX, scaleY)` en el canvas
   - **Native**: sin escala, overflow scroll
8. ResizeObserver en el container para re-escalar al cambiar tamano del panel
9. Al desmontar: `client.disconnect()`, cleanup keyboard/mouse

### Patron a seguir
- Similar a Terminal.jsx pero sin iframe
- El canvas de Guacamole se renderiza directamente en un div
- Mismo patron de activity tracking

### Verificacion
- [ ] Componente importa y renderiza sin errores
- [ ] Canvas aparece en el panel
- [ ] Conexion RDP se establece
- [ ] Mouse y teclado funcionan
- [ ] Resize ajusta la escala

---

## Fase 4: Client - Integrar RDP en PanelManager y dialogo

**Objetivo:** Los paneles pueden ser Local, SSH o RDP. El dialogo New Terminal incluye tab RDP.

### Cambios en panel object
```javascript
panel = {
  id: string,
  terminalId: string,       // null para RDP
  name: string,
  type: 'local' | 'ssh' | 'rdp',  // NUEVO
  sshConnectionId: number,  // para SSH
  rdpConnectionId: number   // NUEVO, para RDP
}
```

### Cambios en PanelManager.jsx
- Condicional en renderTerminal:
  ```jsx
  {panel.type === 'rdp' ? (
    <RdpViewer
      rdpConnectionId={panel.rdpConnectionId}
      isActive={isActive}
      panelId={panel.id}
      onActivityChange={handleActivityChange}
    />
  ) : (
    <Terminal ... />
  )}
  ```

### Cambios en TerminalView.jsx (dialogo New Terminal)
- Tercer tab: **Local Terminal | SSH Connection | RDP Connection**
- Tab RDP:
  - Dropdown de conexiones RDP guardadas
  - Formulario: Host, Port (3389), Username, Password, Domain (opcional)
  - Selector de display mode: Fit | Stretch | Native
- Al crear: panel.type = 'rdp', panel.rdpConnectionId = id

### Cambios en server/index.js
- Nuevos socket events:
  - `get-rdp-connections` → lista conexiones RDP del usuario
  - `create-rdp-connection` → crea nueva conexion RDP en DB
  - `delete-rdp-connection` → elimina conexion RDP

### Verificacion
- [ ] Tab RDP aparece en dialogo
- [ ] Conexiones guardadas se listan
- [ ] Nueva conexion se guarda en DB
- [ ] Panel RDP se crea y renderiza
- [ ] Modo Fit/Stretch/Native funciona
- [ ] Sidebar muestra paneles RDP correctamente

---

## Fase 5: Display modes y controles

**Objetivo:** Botones de control en el header del panel RDP para cambiar modo de display.

### Controles en panel header (solo para type='rdp')
- Boton Fit (icono aspect ratio)
- Boton Stretch (icono expand)
- Boton Native (icono 1:1)
- El modo seleccionado se guarda en panel.displayMode y persiste en workspace

### Clipboard bidireccional
- Ctrl+C en remoto → clipboard local
- Ctrl+V local → clipboard remoto
- Usar `client.createClipboardStream()` y `client.onclipboard`

### Verificacion
- [ ] 3 botones visibles en header de panel RDP
- [ ] Cambiar modo actualiza la escala inmediatamente
- [ ] Modo persiste al recargar
- [ ] Clipboard funciona en ambas direcciones

---

## Fase 6: Verificacion final y limpieza

### Tests end-to-end
- [ ] Login → workspace
- [ ] Crear terminal local → funciona
- [ ] Crear terminal SSH → funciona
- [ ] Crear terminal RDP → funciona
- [ ] Minimizar panel RDP → aparece en sidebar
- [ ] Restaurar panel RDP → reconecta
- [ ] Resize panel → display se ajusta
- [ ] Cerrar panel RDP → desconecta limpiamente
- [ ] Multi-usuario → cada user ve sus conexiones
- [ ] Deploy a testing exitoso

### Archivos nuevos
| Archivo | Proposito |
|---------|-----------|
| `server/guacamole-manager.js` | Proxy WebSocket + token encryption |
| `client/src/components/RdpViewer.jsx` | Componente React para display RDP |

### Archivos modificados
| Archivo | Cambio |
|---------|--------|
| `db/database.js` | Tabla rdp_connections + CRUD |
| `server/index.js` | Socket events para RDP |
| `client/src/components/PanelManager.jsx` | Render condicional Terminal/RdpViewer |
| `client/src/components/TerminalView.jsx` | Tab RDP en dialogo, panel.type |
| `package.json` | Dependencia guacamole-lite |
| `client/package.json` | Dependencia guacamole-common-js |

### Orden de ejecucion
Fase 1 → 2 → 3 → 4 → 5 → 6
