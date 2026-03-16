#!/bin/bash
# Script para arreglar problemas de login después de las pruebas

echo "🔧 Arreglando problemas de login..."

# 1. Matar todos los procesos node
echo "1. Deteniendo procesos..."
pkill -f "node server" 2>/dev/null
pkill -f "vite" 2>/dev/null
pkill -f "nodemon" 2>/dev/null
sleep 2

# 2. Limpiar puerto 3002
echo "2. Liberando puerto 3002..."
lsof -ti:3002 | xargs kill -9 2>/dev/null
sleep 1

# 3. Limpiar sesiones tmux huérfanas (opcional)
echo "3. Limpiando sesiones tmux..."
tmux -L muxterm ls 2>/dev/null | grep "webssh_" | cut -d: -f1 | xargs -I {} tmux -L muxterm kill-session -t {} 2>/dev/null

# 4. Reiniciar servicios
echo "4. Reiniciando servicios..."
cd /home/usuario/proyectos/webssh

# Iniciar servidor
node server/index.js > server.log 2>&1 &
SERVER_PID=$!
echo "   Server PID: $SERVER_PID"

# Esperar a que el servidor inicie
sleep 3

# Iniciar cliente
cd client && npm start > ../client.log 2>&1 &
CLIENT_PID=$!
echo "   Client PID: $CLIENT_PID"

sleep 3

# 5. Verificar que todo funcione
echo "5. Verificando servicios..."
if curl -s http://localhost:3002/api/auth/verify > /dev/null; then
    echo "✅ Servidor funcionando correctamente"
else
    echo "❌ Error: El servidor no responde"
    exit 1
fi

echo ""
echo "✅ Todo listo! Puedes hacer login en http://localhost:3003"
echo "   Usuario: test"
echo "   Contraseña: test123"
echo ""
echo "Para detener los servicios: kill $SERVER_PID $CLIENT_PID"