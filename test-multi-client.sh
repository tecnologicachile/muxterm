#!/bin/bash

echo "=== Prueba de Terminal Multi-Cliente ==="
echo ""
echo "Esta prueba verifica que las terminales se muestren correctamente cuando se acceden"
echo "desde múltiples clientes con diferentes tamaños de ventana."
echo ""
echo "Pasos de la prueba:"
echo "1. Abre http://localhost:3002 en una ventana del navegador (Cliente A)"
echo "2. Inicia sesión con test/test123"
echo "3. Crea una terminal y ejecuta algunos comandos (ls, pwd, etc.)"
echo "4. Anota el ID de la terminal desde la consola del navegador o la pestaña de red"
echo ""
echo "5. Abre otra ventana del navegador con un tamaño DIFERENTE (Cliente B)"
echo "6. Inicia sesión con la misma cuenta"
echo "7. La terminal debería aparecer sin distorsión"
echo ""
echo "Resultado esperado:"
echo "- El Cliente B debería ver el contenido de la terminal formateado correctamente"
echo "- Sin texto distorsionado o superpuesto"
echo "- La terminal debería redimensionarse para ajustarse a la ventana del Cliente B"
echo ""
echo "La corrección incluye:"
echo "- Redimensionamiento automático cuando se conecta un nuevo cliente"
echo "- Limpiar y redibujar después del redimensionamiento"
echo "- Retraso de 400ms para renderizado adecuado"
echo ""
echo "Presiona Enter para iniciar el servidor..."
read

# Iniciar el servidor
npm run dev