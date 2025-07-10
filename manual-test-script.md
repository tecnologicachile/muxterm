# Script de Prueba Manual - 15 Iteraciones de Persistencia

## Configuración Inicial
1. Abre el navegador en `http://localhost:3003`
2. Login con `test` / `test123`

## Iteración 1: Terminal único con comando básico
```bash
# Crear sesión "Test1-Single"
# Ejecutar:
ls -la
# Desloguearse (click en icono logout)
# Volver a loguearse
# Abrir sesión "Test1-Single"
# Verificar: El comando ls -la y su salida deben estar visibles
```

## Iteración 2: División horizontal (2 paneles)
```bash
# Crear sesión "Test2-Horizontal"
# Presionar Ctrl+Shift+D
# Panel 1: echo "Panel 1: $(date)"
# Panel 2: pwd && echo "Panel 2 working"
# Desloguearse y volver
# Verificar: 2 paneles con sus comandos
```

## Iteración 3: División vertical con variables
```bash
# Crear sesión "Test3-Vertical"
# Presionar Ctrl+Shift+S
# Panel superior: export TEST_VAR="Top Panel" && echo $TEST_VAR
# Panel inferior: echo $USER && echo "Bottom Panel Active"
# Desloguearse y volver
# Verificar: 2 paneles verticales con contenido
```

## Iteración 4: Tres paneles con operaciones de archivo
```bash
# Crear sesión "Test4-ThreePanels"
# Ctrl+Shift+D, luego Ctrl+Shift+S
# Panel 1: echo "Test content" > /tmp/test4.txt && cat /tmp/test4.txt
# Panel 2: ls -la /tmp/test4.txt
# Panel 3: wc -l /tmp/test4.txt
# Desloguearse y volver
# Verificar: 3 paneles con información del archivo
```

## Iteración 5: Cuadrícula 4 paneles con monitoreo
```bash
# Crear sesión "Test5-Grid"
# Presionar Ctrl+Shift+D tres veces
# Panel 1: ps aux | grep node | head -3
# Panel 2: top -b -n 1 | head -5
# Panel 3: df -h | grep "/$"
# Panel 4: free -h | grep Mem
# Desloguearse y volver
# Verificar: 4 paneles con información del sistema
```

## Iteración 6: Comandos con pipes
```bash
# Crear sesión "Test6-Pipes"
# Ctrl+Shift+D
# Panel 1: ls -la | grep -E "^d" | wc -l
# Panel 2: echo -e "Line1\nLine2\nLine3" | grep Line | sort
# Desloguearse y volver
# Verificar: Salida de comandos con pipes preservada
```

## Iteración 7: Navegación de directorios
```bash
# Crear sesión "Test7-Directories"
# Ctrl+Shift+D, Ctrl+Shift+S
# Panel 1: cd /tmp && pwd && ls | head -3
# Panel 2: cd /etc && pwd && ls | grep host
# Panel 3: cd ~ && pwd && ls -la | grep bash
# Desloguearse y volver
# Verificar: Cada panel muestra su directorio
```

## Iteración 8: Historial de comandos
```bash
# Crear sesión "Test8-History"
# Ctrl+Shift+D
# Panel 1: 
  echo "Command 1"
  echo "Command 2"
  history | tail -3
# Panel 2: for i in 1 2 3; do echo "Loop $i"; done
# Desloguearse y volver
# Verificar: Historial y bucles visibles
```

## Iteración 9: Cuatro paneles con comandos variados
```bash
# Crear sesión "Test9-Varied"
# Ctrl+Shift+D tres veces
# Panel 1: echo $SHELL && echo "Shell info displayed"
# Panel 2: uname -a
# Panel 3: cat /etc/os-release | head -3
# Panel 4: uptime
# Desloguearse y volver
# Verificar: Información del sistema en cada panel
```

## Iteración 10: Panel activo
```bash
# Crear sesión "Test10-ActivePanel"
# Ctrl+Shift+D, Ctrl+Shift+S
# Panel 1: echo "Panel 0"
# Panel 2: echo "Panel 1"
# Panel 3: echo "Panel 2 - This should be active"
# Click en Panel 3 antes de salir
# Desloguearse y volver
# Verificar: Panel 3 tiene borde verde (activo)
```

## Iteración 11: Salida larga
```bash
# Crear sesión "Test11-LongOutput"
# Ctrl+Shift+D
# Panel 1: for i in {1..20}; do echo "Line $i of output"; done
# Panel 2: find /etc -name "*.conf" 2>/dev/null | head -10
# Desloguearse y volver
# Verificar: Toda la salida preservada
```

## Iteración 12: Salida con colores
```bash
# Crear sesión "Test12-Colors"
# Ctrl+Shift+D, Ctrl+Shift+S
# Panel 1: ls --color=always -la | head -5
# Panel 2: grep --color=always "root" /etc/passwd | head -3
# Panel 3: echo -e "\033[31mRed\033[0m \033[32mGreen\033[0m \033[34mBlue\033[0m"
# Desloguearse y volver
# Verificar: Colores preservados
```

## Iteración 13: Caracteres especiales
```bash
# Crear sesión "Test13-Unicode"
# Ctrl+Shift+D
# Panel 1: echo "Special chars: @#$%^&*() émojis: 🚀 🎯 ✅"
# Panel 2: echo "Quotes: \"double\" 'single' \`backtick\`"
# Desloguearse y volver
# Verificar: Caracteres especiales intactos
```

## Iteración 14: Variables de entorno
```bash
# Crear sesión "Test14-Environment"
# Ctrl+Shift+D tres veces
# Panel 1: export MY_VAR="Panel1" && echo "MY_VAR=$MY_VAR"
# Panel 2: alias ll="ls -la" && ll | head -3
# Panel 3: function greet() { echo "Hello $1"; } && greet "World"
# Panel 4: VAR_LIST=(one two three) && echo ${VAR_LIST[@]}
# Desloguearse y volver
# Verificar: Variables y funciones en salida
```

## Iteración 15: Prueba de estrés completa
```bash
# Crear sesión "Test15-StressTest"
# Ctrl+Shift+D tres veces (4 paneles)
# Panel 1:
echo "=== Panel 1: System Info ===" &&
date &&
whoami &&
pwd &&
echo "Terminal $TERM"

# Panel 2:
echo "=== Panel 2: Process List ===" &&
ps aux | grep -E "(node|chrome)" | head -5 &&
echo "Total processes: $(ps aux | wc -l)"

# Panel 3:
echo "=== Panel 3: File Operations ===" &&
touch /tmp/test15_{1..3}.txt &&
ls -la /tmp/test15_*.txt &&
echo "Files created successfully"

# Panel 4:
echo "=== Panel 4: Network Info ===" &&
hostname &&
echo "Timestamp: $(date +%s)" &&
echo "Random: $RANDOM"

# Click en Panel 3 para hacerlo activo
# Desloguearse y volver
# Verificar: 
# - 4 paneles con todo su contenido
# - Panel 3 con borde verde (activo)
# - Todos los comandos y salidas preservados
```

## Verificación Final

Después de todas las iteraciones:
1. En la lista de sesiones deberías ver 15 sesiones con diferentes layouts
2. Cada sesión debe mostrar el icono correcto según su distribución
3. Al abrir cualquier sesión, debe restaurarse exactamente como se dejó
4. Los comandos y su salida deben estar completamente preservados

## Notas Importantes

- Si un terminal muestra "Terminal not found", significa que el servidor se reinició
- Los layouts se guardan automáticamente al crear/modificar paneles
- El panel activo (borde verde) también se guarda
- Los colores ANSI y caracteres especiales se preservan en el buffer