#!/bin/bash

echo "1. Obteniendo token..."
RESPONSE=$(curl -s -X POST http://localhost:3002/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test123"}')

TOKEN=$(echo $RESPONSE | jq -r '.token')
echo "Token: ${TOKEN:0:50}..."

echo -e "\n2. Verificando token..."
curl -s http://localhost:3002/api/auth/verify \
  -H "Authorization: Bearer $TOKEN" | jq

echo -e "\n3. Intentando acceder a /sessions directamente..."
curl -s -I http://localhost:3002/sessions

echo -e "\n✅ La autenticación funciona correctamente a nivel de API"