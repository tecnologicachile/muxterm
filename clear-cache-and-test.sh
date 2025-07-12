#!/bin/bash

echo "=== Limpiando caché y probando MuxTerm ==="
echo

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}1. Instrucciones para limpiar caché del navegador:${NC}"
echo "   - Chrome/Edge: Ctrl+Shift+Delete → Seleccionar 'Cached images and files' → Clear data"
echo "   - Firefox: Ctrl+Shift+Delete → Seleccionar 'Cache' → Clear Now"
echo "   - O usa modo incógnito/privado: Ctrl+Shift+N (Chrome) o Ctrl+Shift+P (Firefox)"
echo

echo -e "${YELLOW}2. Alternativa - Forzar recarga sin caché:${NC}"
echo "   - Abre http://localhost:3003"
echo "   - Presiona: Ctrl+Shift+R (o Cmd+Shift+R en Mac)"
echo

echo -e "${YELLOW}3. Verificando que los servidores estén corriendo...${NC}"

# Check backend
if curl -s http://localhost:3002/api/auth/verify > /dev/null; then
    echo -e "   ${GREEN}✓ Backend funcionando${NC}"
else
    echo "   ✗ Backend no responde - iniciando..."
    node server/index.js > server.log 2>&1 &
    sleep 3
fi

# Check frontend
if curl -s http://localhost:3003 > /dev/null; then
    echo -e "   ${GREEN}✓ Frontend funcionando${NC}"
else
    echo "   ✗ Frontend no responde - iniciando..."
    cd client && npm start > ../client.log 2>&1 &
    cd ..
    sleep 5
fi

echo
echo -e "${GREEN}4. URLs para probar:${NC}"
echo "   - Frontend: http://localhost:3003"
echo "   - Backend: http://localhost:3002"
echo

echo -e "${YELLOW}5. Para ver los logs en tiempo real:${NC}"
echo "   - Backend: tail -f server.log"
echo "   - Frontend: tail -f client.log"
echo

echo -e "${GREEN}✓ Todo listo. Abre el navegador en modo incógnito y prueba de nuevo.${NC}"