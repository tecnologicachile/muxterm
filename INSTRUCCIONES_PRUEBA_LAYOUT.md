# Instrucciones para Probar la Persistencia del Layout

## Pasos para la Prueba Manual

### 1. Crear una sesión con múltiples paneles

1. Abre tu navegador en `http://localhost:3003`
2. Inicia sesión con las credenciales: `test` / `test123`
3. Haz clic en "New Session" para crear una nueva sesión
4. Una vez en la vista de terminal:
   - Presiona `Ctrl+Shift+D` para dividir horizontalmente (2 paneles)
   - Presiona `Ctrl+Shift+S` para dividir verticalmente (3 paneles)
   - Presiona `Ctrl+Shift+D` otra vez para crear una cuadrícula (4 paneles)

### 2. Agregar contenido único a cada panel

En cada panel, escribe comandos diferentes para poder identificarlos después:
- Panel 1: `echo "Panel 1" && ls`
- Panel 2: `echo "Panel 2" && pwd`
- Panel 3: `echo "Panel 3" && date`
- Panel 4: `echo "Panel 4" && whoami`

### 3. Verificar que el layout se guarda

1. Haz clic en la flecha de retroceso para volver a la lista de sesiones
2. Observa que la sesión ahora muestra el tipo de layout:
   - Verás un icono diferente según el número de paneles
   - El texto dirá "2 panels (split)", "3 panels" o "4 panels (grid)"

### 4. Cerrar sesión completamente

1. Haz clic en el icono de logout (esquina superior derecha)
2. Serás redirigido a la página de login

### 5. Simular conexión desde otro dispositivo

Opciones:
- Abre una ventana de incógnito/privada
- Usa un navegador diferente
- Limpia las cookies y caché del navegador actual

### 6. Restaurar la sesión

1. Inicia sesión nuevamente con `test` / `test123`
2. En la lista de sesiones, busca la sesión que creaste
3. Identifícala por:
   - El icono de división o cuadrícula
   - El texto que indica el número de paneles
4. Haz clic en "Open" en esa sesión

### 7. Verificar la restauración

Deberías ver:
- ✅ El mismo número de paneles que creaste
- ✅ La misma distribución (horizontal, vertical o cuadrícula)
- ✅ El contenido de cada terminal preservado
- ✅ Puedes continuar trabajando en cada panel

## Verificación en los Logs

Mientras haces la prueba, puedes verificar en `server.log`:
```bash
tail -f server.log | grep -E "(layout|panel|Sending|Updating)"
```

Deberías ver mensajes como:
- `Updating session layout: [sessionId] { panels: [...] }`
- `Sending session layout: { type: 'grid', panels: [...] }`

## Limitaciones Actuales

1. **Sin Redis**: Los layouts se pierden si reinicias el servidor
2. **Proporciones fijas**: Los tamaños exactos de los paneles no se guardan
3. **Máximo 4 paneles**: No se pueden crear más de 4 paneles

## Troubleshooting

Si no funciona:
1. Verifica que el servidor esté corriendo: `ps aux | grep "node server"`
2. Verifica que el cliente esté corriendo: `ps aux | grep "vite"`
3. Revisa la consola del navegador para errores
4. Revisa `server.log` para mensajes de error