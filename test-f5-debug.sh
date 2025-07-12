#!/bin/bash

echo "=== Test Manual de F5 con Debug ==="
echo
echo "1. Abre http://localhost:3003 en tu navegador"
echo "2. Inicia sesión con test/test123"
echo "3. Conecta a una sesión"
echo "4. Ejecuta estos comandos:"
echo "   - clear"
echo "   - echo '=== ANTES DE F5 ==='"
echo "   - ls -la"
echo "   - date"
echo "5. Presiona F5 para recargar"
echo "6. Observa si el contenido se mantiene"
echo
echo "Mientras tanto, voy a monitorear los logs..."
echo
echo "Presiona Ctrl+C para terminar"
echo

# Monitorear logs en tiempo real
tail -f server.log | grep -E "(capture|buffer|Captured|Sending|restoreTerminal|Tmux session)"