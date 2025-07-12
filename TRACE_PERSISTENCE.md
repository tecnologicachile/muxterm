# Sistema de Trace de Persistencia

El sistema `TRACE_PERSISTENCE` es una herramienta de debugging diseñada para rastrear problemas de persistencia de contenido en terminales, especialmente útil para diagnosticar problemas con F5/refresh.

## Activación

### En el Servidor

```bash
# Activar trace básico (solo consola)
TRACE_PERSISTENCE=true node server/index.js

# Activar trace con archivo de log
TRACE_PERSISTENCE=true TRACE_PERSISTENCE_FILE=true node server/index.js

# Con otras variables de entorno
TRACE_PERSISTENCE=true LOG_LEVEL=debug node server/index.js
```

### En el Cliente

Desde la consola del navegador:

```javascript
// Activar trace
window.enablePersistenceTrace()

// Desactivar trace
window.disablePersistenceTrace()

// Verificar estado
window.persistenceTracer.enabled
```

## Qué información captura

### Flujo de Captura de Buffer (Servidor)

1. **CAPTURE:START** - Inicio de captura de buffer
2. **TMUX_CAPTURE_START** - Comando tmux ejecutado
3. **BUFFER:CAPTURED_FROM_TMUX** - Buffer capturado con preview
4. **CAPTURE:CREATING_TERMINAL** - Creación/restauración de terminal
5. **BUFFER:BUFFER_STORED** - Buffer almacenado temporalmente
6. **CAPTURE:COMPLETE** - Resumen del proceso

### Flujo de Envío (Servidor → Cliente)

1. **CLIENT:CHECKING_BUFFER_TO_SEND** - Verificación de buffer disponible
2. **BUFFER:RETURNING_CAPTURED** - Buffer recuperado del almacenamiento
3. **BUFFER:SENDING_TO_CLIENT** - Envío al cliente via socket
4. **CLIENT:BUFFER_SENT** - Confirmación de envío

### Flujo de Recepción (Cliente)

1. **INIT:RESTORE_EXISTING_TERMINAL** - Solicitud de restauración
2. **SOCKET:terminal-restored** - Evento recibido
3. **SOCKET:terminal-output** - Datos recibidos
4. **BUFFER:RECEIVED_FROM_SERVER** - Buffer procesado
5. **TERMINAL:DATA_WRITTEN** - Datos escritos en xterm

## Formato de Salida

```
HH:MM:SS [TRACE:CATEGORY] ACTION - key1:value1 | key2:value2
```

Ejemplo:
```
14:23:45 [TRACE:CAPTURE] START - terminalId:abc123 | sessionId:def456
14:23:45 [TRACE:BUFFER] CAPTURED_FROM_TMUX - length:2456 | preview:usuario@host:~$ ls\\n...
14:23:46 [TRACE:CLIENT] BUFFER_SENT - terminalId:abc123 | bufferLength:2456
```

## Información del Buffer

Para cada buffer se muestra:
- **length**: Tamaño total en caracteres
- **preview**: Primeros 100 caracteres
- **lastChars**: Últimos 50 caracteres
- **hasContent**: Si tiene contenido no vacío

## Diagnóstico de Problemas Comunes

### Buffer no se preserva después de F5

Buscar en los logs:
1. ¿Se captura el buffer? (`CAPTURED_FROM_TMUX`)
2. ¿Se almacena? (`BUFFER_STORED`)
3. ¿Se envía al cliente? (`SENDING_TO_CLIENT`)
4. ¿Se recibe en el cliente? (`RECEIVED_FROM_SERVER`)
5. ¿Se escribe en el terminal? (`DATA_WRITTEN`)

### Contenido incorrecto

Verificar:
- Preview del buffer en cada etapa
- Longitud del buffer (¿cambia?)
- Timing entre eventos

### Problemas de timing

El trace incluye timestamps y elapsed time:
- `elapsed: 125ms` - Tiempo desde el inicio de captura
- `age: 1200ms` - Edad del buffer capturado
- `delay: 100ms` - Delays intencionales

## Archivo de Log

Si `TRACE_PERSISTENCE_FILE=true`, se genera `trace-persistence.log` con:
- Todos los eventos de trace
- Formato idéntico a la consola
- Se reinicia con cada ejecución del servidor

## Comparación de Buffers

El sistema puede comparar buffers para detectar diferencias:
```javascript
// En el cliente
window.persistenceTracer.compareContent(before, after, 'F5_COMPARISON')
```

Muestra:
- Longitudes antes/después
- Si son idénticos
- Primera posición donde difieren
- Contexto de la diferencia

## Desactivación

El trace está diseñado para ser temporal:
- No afecta el rendimiento cuando está desactivado
- No se incluye en logs de producción
- Se puede activar/desactivar sin reiniciar

## Ejemplo de Uso Completo

```bash
# Terminal 1 - Servidor con trace
TRACE_PERSISTENCE=true TRACE_PERSISTENCE_FILE=true LOG_LEVEL=debug node server/index.js

# Terminal 2 - Ver logs en tiempo real
tail -f trace-persistence.log | grep -E "BUFFER|CAPTURE"

# En el navegador
1. Abrir consola (F12)
2. window.enablePersistenceTrace()
3. Crear sesión y escribir comandos
4. Presionar F5
5. Observar los traces en consola
```

## Tips

1. Activar trace ANTES de reproducir el problema
2. Usar grep para filtrar categorías específicas
3. Comparar timestamps para identificar delays
4. Verificar preview del buffer en cada etapa
5. El trace del cliente y servidor se complementan

---

Este sistema es una herramienta de desarrollo. NO usar en producción.