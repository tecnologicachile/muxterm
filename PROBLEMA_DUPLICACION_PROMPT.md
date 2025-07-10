# Problema de Duplicación de Prompt en Terminal Web SSH

## Contexto del Proyecto
Sistema de terminal web basado en:
- **Backend**: Node.js + Express + Socket.io + node-pty
- **Frontend**: React + Material-UI + xterm.js
- **Funcionalidad**: Terminal SSH accesible vía navegador web con soporte para múltiples paneles

## Problema Específico

### Descripción
Al refrescar la página del navegador (F5), el prompt del terminal se duplica en el buffer, mostrando:

**Antes del refresh:**
```
usuario@usuario-Standard-PC-i440FX-PIIX-1996:~$ ls
cursor.deb  Descargas  Documentos  Escritorio  Imágenes  Música  Plantillas  proyectos  Público  snap  Vídeos
usuario@usuario-Standard-PC-i440FX-PIIX-1996:~$ 
```

**Después del refresh:**
```
usuario@usuario-Standard-PC-i440FX-PIIX-1996:~$ ls
cursor.deb  Descargas  Documentos  Escritorio  Imágenes  Música  Plantillas  proyectos  Público  snap  Vídeosusuario@usuario-Standard-PC-i440FX-PIIX-usuario@usuario-Standard-PC-i440FX-PIIX-1996:~$ 
```

### Patrón del Problema
1. La palabra "Vídeos" se concatena con "usuario@" formando "Vídeosusuario@"
2. El prompt completo se duplica: `usuario@usuario-Standard-PC-i440FX-PIIX-usuario@usuario-Standard-PC-i440FX-PIIX-1996:~$`
3. Ocurre específicamente cuando:
   - Se usa split horizontal de paneles
   - Se refresca la página
   - El Terminal 1 (que tiene la salida del comando `ls`) es el afectado

### Estado Actual
- **Terminal 2**: ✅ Funciona correctamente sin duplicación
- **Terminal 1**: ❌ Presenta el problema de duplicación

## Archivos Clave

### 1. `/home/usuario/proyectos/webssh/server/terminal.js`
- Clase `TerminalManager` que gestiona los terminales
- Función `getTerminalBuffer(terminalId)` en línea 172 - responsable de devolver el buffer del terminal
- El buffer se almacena en `terminal.buffer[]` como array de chunks

### 2. `/home/usuario/proyectos/webssh/server/index.js`
- Socket.io handlers
- En línea 181 se llama a `getTerminalBuffer()` cuando se restaura un terminal
- Maneja eventos como 'restore-terminal', 'terminal-input', etc.

### 3. Frontend (React)
- Usa xterm.js para renderizar el terminal
- Al refrescar, solicita restaurar el estado del terminal vía Socket.io

## Soluciones Intentadas (22 iteraciones)

1. **Limpieza en tiempo real** - Parcialmente efectiva
2. **Limpieza agresiva con regex** - No resolvió completamente
3. **Prevención de duplicados** - Terminal 2 solucionado
4. **Separación de "Vídeos" y "usuario"** - No funcionó consistentemente

## Lo que Necesitas Hacer

### 1. Identificar la Causa Raíz
- ¿Por qué "Vídeos" se pega con el siguiente prompt?
- ¿Por qué ocurre la duplicación solo en Terminal 1?
- ¿Es un problema de codificación de caracteres?
- ¿Hay algún carácter invisible o secuencia ANSI?

### 2. Implementar una Solución Definitiva
El código actual en `getTerminalBuffer()` intenta limpiar pero no funciona:

```javascript
// Esto NO está funcionando correctamente:
fullBuffer = fullBuffer.replace(/Vídeosusuario@/g, 'Vídeos\nusuario@');
```

### 3. Requisitos de la Solución
- Debe ser genérica (funcionar con cualquier nombre de usuario/host)
- No debe afectar el contenido legítimo del terminal
- Debe preservar la salida de comandos correctamente
- Debe manejar caracteres especiales (ñ, í, é, etc.)

### 4. Para Probar tu Solución
Usa el test de Playwright:
```bash
cd /home/usuario/proyectos/webssh
npm test -- tests/iter22-test.spec.js
```

El test:
1. Crea una sesión
2. Ejecuta `ls`
3. Divide el panel horizontalmente
4. Refresca la página
5. Verifica si hay duplicación

### 5. Logs de Depuración
El código actual imprime logs con prefijo `[ITER22]`. Puedes ver los logs del servidor mientras ejecutas los tests.

## Resultado Esperado
Después del refresh, el buffer debe mostrar:
```
usuario@usuario-Standard-PC-i440FX-PIIX-1996:~$ ls
cursor.deb  Descargas  Documentos  Escritorio  Imágenes  Música  Plantillas  proyectos  Público  snap  Vídeos
usuario@usuario-Standard-PC-i440FX-PIIX-1996:~$ 
```

Sin duplicación del prompt y con "Vídeos" correctamente separado del siguiente prompt.

## Nota Importante
El servidor debe reiniciarse después de cambios en el código:
```bash
pkill -f "node index.js" && sleep 2 && cd /home/usuario/proyectos/webssh/server && node index.js &
```

¡Buena suerte resolviendo este problema!