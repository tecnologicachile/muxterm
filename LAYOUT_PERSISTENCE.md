# Persistencia de Layout de Paneles

## Descripción

La aplicación ahora guarda automáticamente la distribución de los paneles de terminal (layout) y la restaura cuando te conectas desde otro navegador o PC. Esto significa que puedes:

1. Crear una distribución específica de terminales (dividir horizontal/vertical)
2. Cerrar el navegador o desconectarte
3. Conectarte desde otro dispositivo
4. Ver exactamente la misma distribución de paneles con el contenido de cada terminal preservado

## Cómo funciona

### Guardado automático
- Cada vez que creas un nuevo panel (split) o cambias el panel activo, el layout se guarda automáticamente
- El layout incluye:
  - La posición y ID de cada panel
  - El terminal asociado a cada panel
  - El panel actualmente activo
  - El tipo de distribución (single, horizontal, vertical-right, grid)

### Restauración automática
- Cuando abres una sesión existente, el sistema:
  1. Carga el layout guardado del servidor
  2. Recrea todos los paneles en las mismas posiciones
  3. Restaura el contenido de cada terminal
  4. Activa el último panel que estaba activo

## Características técnicas

### Cliente (React)
- `TerminalView.jsx` ahora incluye:
  - Hook `useEffect` para cargar el layout al montar el componente
  - Hook `useEffect` para guardar el layout cuando cambia
  - Eventos Socket.IO: `get-session-layout`, `update-session-layout`, `session-layout`

### Servidor (Node.js)
- `SessionManager` almacena el layout como parte de la sesión
- Nuevos manejadores de eventos:
  - `get-session-layout`: Devuelve el layout guardado
  - `update-session-layout`: Actualiza el layout en memoria
- El layout se persiste junto con la información de la sesión

### Estructura del Layout
```javascript
{
  panels: [
    {
      id: "uuid-panel-1",
      terminalId: "uuid-terminal-1",
      sessionId: "uuid-session"
    },
    // ... más paneles
  ],
  activePanel: "uuid-panel-1",
  type: "horizontal" // single, horizontal, vertical-right, grid
}
```

## Limitaciones actuales

1. **Sin Redis**: Como Redis está deshabilitado temporalmente, los layouts se pierden si el servidor se reinicia
2. **Máximo 4 paneles**: La aplicación soporta hasta 4 paneles en una distribución de cuadrícula
3. **Distribución fija**: Los tamaños de los paneles se restauran pero no las proporciones exactas personalizadas

## Pruebas

Para probar la funcionalidad:

1. Abre la aplicación y crea una sesión
2. Divide la pantalla en múltiples paneles (Ctrl+Shift+D/S)
3. Escribe comandos diferentes en cada terminal
4. Cierra el navegador completamente
5. Abre un nuevo navegador (o usa modo incógnito)
6. Inicia sesión con las mismas credenciales
7. Abre la misma sesión
8. Deberías ver la misma distribución con el contenido preservado

## Mejoras futuras

1. Habilitar Redis para persistencia real entre reinicios del servidor
2. Guardar las proporciones exactas de los paneles redimensionados
3. Permitir guardar y cargar layouts predefinidos
4. Sincronización en tiempo real del layout entre múltiples clientes conectados