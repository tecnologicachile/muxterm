#!/bin/bash

echo "=== Test Manual de Renombrar Sesiones ==="
echo
echo "Abriendo MuxTerm en el navegador..."
echo

# Detectar comando para abrir navegador
if command -v xdg-open > /dev/null; then
    xdg-open http://localhost:3002
elif command -v open > /dev/null; then
    open http://localhost:3002
else
    echo "No se pudo abrir el navegador automáticamente."
    echo "Por favor, abre manualmente: http://localhost:3002"
fi

echo "INSTRUCCIONES PARA PROBAR:"
echo "========================="
echo
echo "1. Inicia sesión:"
echo "   - Usuario: test"
echo "   - Contraseña: test123"
echo
echo "2. Si no tienes sesiones, crea una nueva:"
echo "   - Haz clic en 'Create New Session'"
echo "   - Nombre: Mi Sesión de Prueba"
echo "   - Host: localhost"
echo "   - Usuario: test"
echo "   - Contraseña: test"
echo
echo "3. Para renombrar una sesión:"
echo "   - Busca el ícono de LÁPIZ (✏️) en la tarjeta de sesión"
echo "   - Haz clic en él"
echo "   - Cambia el nombre en el diálogo que aparece"
echo "   - Haz clic en 'Save' o presiona Enter"
echo
echo "4. Verifica:"
echo "   - El nombre debe cambiar inmediatamente"
echo "   - Si refrescas la página (F5), el nuevo nombre debe persistir"
echo
echo "✓ La funcionalidad está lista para probar!"