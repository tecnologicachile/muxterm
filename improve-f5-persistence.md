# Mejorando la Persistencia Visual con F5

## El Problema
Cuando refrescas con F5:
- La sesión tmux se mantiene ✓
- Pero el buffer visual de xterm.js se pierde ✗

## Soluciones Posibles

### 1. Aumentar el Buffer de Scrollback en xterm.js
```javascript
// En Terminal.jsx
const term = new Terminal({
  cursorBlink: true,
  fontSize: 14,
  fontFamily: 'Consolas, "Courier New", monospace',
  theme: { /* ... */ },
  scrollback: 10000, // Aumentar de 1000 (default) a 10000 líneas
});
```

### 2. Recuperar el Buffer de tmux al Reconectar
```javascript
// En terminal.js (servidor)
// Al reconectar, enviar comando para obtener el buffer
ptyProcess.write('tmux capture-pane -p -S -10000\r');
```

### 3. Implementar Persistencia del Buffer en el Cliente
```javascript
// Guardar buffer en sessionStorage antes de unload
window.addEventListener('beforeunload', () => {
  const buffer = term.buffer.active;
  sessionStorage.setItem(`terminal-buffer-${terminalId}`, serializeBuffer(buffer));
});

// Restaurar al cargar
const savedBuffer = sessionStorage.getItem(`terminal-buffer-${terminalId}`);
if (savedBuffer) {
  restoreBuffer(term, savedBuffer);
}
```

### 4. Solución Más Simple: Comando clear + history
Agregar un botón o atajo que ejecute:
```bash
clear && history -20
```
Esto mostraría los últimos comandos después de un refresh.

## Recomendación
La mejor experiencia es **no usar F5** y navegar usando los botones de la aplicación.
El F5 es más útil para desarrollo que para uso normal.