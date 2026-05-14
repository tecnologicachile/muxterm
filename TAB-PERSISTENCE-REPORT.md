# Tab Persistence Report — MuxTerm v1.1.61

## Objetivo

Evitar que los terminales se reconecten al cambiar entre windows/tabs. Actualmente al cambiar de window, los terminales se desmontan y al volver muestran "Connecting" antes de reconectarse.

## Lo que se intentó

### Intento 1: `display: none` en PanelManagers inactivos

**Cambio en `TerminalView.jsx`**: en vez de filtrar paneles por `activeWindowId`, renderizar TODOS los PanelManagers (uno por window) y ocultar los inactivos con `display: none`.

```jsx
// Antes (v1.1.60.1)
panels={panels.filter(p => (p.windowId || 'w1') === activeWindowId)}

// Intento: renderizar todos
{windows.map(win => (
  <Box sx={{ display: isActive ? 'flex' : 'none', flex: 1, ... }}>
    <PanelManager panels={winPanels} ... />
  </Box>
))}
```

**Problema**: al cambiar de window, los terminales del PanelManager que pasa de `display: none` a `flex` no recalculan correctamente sus dimensiones. Los iframes/terminales se ven distorsionados.

**Fix intentado**: disparar `window.dispatchEvent(new Event('resize'))` 150ms después del cambio de window. No funcionó — los terminales que están en proceso de carga no responden al resize.

**Fix intentado 2**: dos resize, a 150ms y 400ms. Mismo problema.

### Intento 2: `position: absolute; left: -9999px` en vez de `display: none`

Mantener los PanelManagers inactivos posicionados fuera de pantalla en vez de ocultos, para que mantengan dimensiones.

**Problema**: al cargar la página, el header aparecía y desaparecía brevemente (flicker). Además, el problema de distorsión persistía.

### Intento 3: Stacking con z-index

Todos los PanelManagers con `position: absolute; inset: 0`, el activo con `z-index: 1`, inactivos con `z-index: 0`.

```jsx
<Box sx={{ position: 'relative' }}>
  {windows.map((win, idx) => (
    <Box sx={{ position: 'absolute', inset: 0, zIndex: isActive ? 1 : 0 }}>
      <PanelManager ... />
    </Box>
  ))}
</Box>
```

**Problema**: misma distorsión visual. Al parecer los iframes dentro de PanelManagers ocultos no mantienen su estado correcto.

## Estado actual (v1.1.61)

Se revirtió al comportamiento original: solo se renderiza el PanelManager de la ventana activa. Al cambiar de window, los terminales se desmontan y reconectan.

El código está en `fb1ab9e` en `main`.

## Código relevante

- **`client/src/components/TerminalView.jsx`**: línea ~1190, el filtro `panels.filter(p => (p.windowId || 'w1') === activeWindowId)`.
- **`client/src/components/PanelManager.jsx`**: usa `PanelGroup` de `react-resizable-panels`, que requiere dimensiones correctas.
- **`client/src/components/Terminal.jsx`**: renderiza el iframe de ttyd. Recibe `terminalId`, `panelId`.

## Arquitectura relevante

- Cada terminal es un `<iframe>` que contiene xterm.js (servido por ttyd vía socket UNIX).
- Los iframes se conectan a tmux sessions vía ttyd.
- Al desmontar un iframe, la conexión WebSocket se cierra → ttyd muere → hay que reconectar.
- PanelManager usa `react-resizable-panels` para el layout de paneles (PanelGroup, Panel, PanelResizeHandle).

## Ideas para futuros intentos

1. **`visibility: hidden` en vez de `display: none`**: el elemento mantiene su espacio en el layout pero no se ve. Esto requiere que el contenedor padre tenga dimensiones fijas.

2. **No depender de PanelGroup para paneles ocultos**: renderizar los PanelManagers inactivos como hijos directos del contenedor, fuera del PanelGroup activo, cada uno con dimensiones fijas.

3. **Mantener la conexión WebSocket viva aunque el componente React se desmonte**: mover el estado de conexión a un store global (Zustand, Context). El componente Terminal sería solo una "vista" de una conexión que persiste. Al cambiar de window, la conexión sigue viva, solo cambia qué componente la muestra.

4. **Usar `requestAnimationFrame` + `ResizeObserver`**: en vez de timeouts fijos, esperar al próximo frame de animación y observar cambios de tamaño reales.

5. **Simplificar PanelManager**: si el problema es `react-resizable-panels`, considerar alternativas más simples que soporten mejor el show/hide de paneles.
