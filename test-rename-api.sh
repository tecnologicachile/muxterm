#!/bin/bash

echo "=== Test de Funcionalidad de Renombrar Sesiones ==="
echo

# Colores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 1. Verificar que el servidor esté corriendo
echo -n "1. Verificando servidor... "
if curl -s http://localhost:3002 > /dev/null; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗ Servidor no está corriendo${NC}"
    exit 1
fi

# 2. Login para obtener cookie de sesión
echo -n "2. Iniciando sesión... "
LOGIN_RESPONSE=$(curl -s -c cookies.txt -X POST http://localhost:3002/api/login \
    -H "Content-Type: application/json" \
    -d '{"username":"test","password":"test123"}' \
    -w "\nHTTP_STATUS:%{http_code}")

HTTP_STATUS=$(echo "$LOGIN_RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)

if [ "$HTTP_STATUS" = "200" ]; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗ Error en login (HTTP $HTTP_STATUS)${NC}"
    exit 1
fi

# 3. Obtener lista de sesiones
echo -n "3. Obteniendo sesiones... "
SESSIONS=$(curl -s -b cookies.txt http://localhost:3002/api/sessions)
echo -e "${GREEN}✓${NC}"

# 4. Mostrar sesiones existentes
echo -e "\n${YELLOW}Sesiones existentes:${NC}"
echo "$SESSIONS" | jq -r '.[] | "- ID: \(.id) | Nombre: \(.name)"' 2>/dev/null || echo "$SESSIONS"

echo -e "\n${YELLOW}Instrucciones para probar renombrado:${NC}"
echo "1. Abre http://localhost:3002 en tu navegador"
echo "2. Inicia sesión con test/test123"
echo "3. En cada tarjeta de sesión verás tres íconos:"
echo "   - Conectar (enchufe)"
echo "   - ${GREEN}Editar (lápiz) ← Haz clic aquí${NC}"
echo "   - Eliminar (papelera)"
echo "4. Se abrirá un diálogo para cambiar el nombre"
echo "5. Escribe el nuevo nombre y haz clic en 'Save'"

# Limpiar
rm -f cookies.txt

echo -e "\n${GREEN}✓ La funcionalidad de renombrar está lista para probar${NC}"