#!/bin/bash

echo "=== Aplicando fix de persistencia de sesiones tmux ==="

# Hacer backup del archivo de servicio
if [ -f /etc/systemd/system/muxterm.service ]; then
    sudo cp /etc/systemd/system/muxterm.service /etc/systemd/system/muxterm.service.backup-$(date +%Y%m%d-%H%M%S)
    echo "✓ Backup creado"
else
    echo "⚠ Archivo de servicio no encontrado en /etc/systemd/system/muxterm.service"
    exit 1
fi

# Remover PrivateTmp=true
sudo sed -i '/PrivateTmp=true/d' /etc/systemd/system/muxterm.service
echo "✓ PrivateTmp=true removido"

# Recargar systemd
sudo systemctl daemon-reload
echo "✓ Configuración de systemd recargada"

echo ""
echo "=== Fix aplicado exitosamente ==="
echo "Las sesiones tmux ahora persistirán después de reiniciar el servicio."
echo "Para aplicar los cambios, reinicia el servicio con: sudo systemctl restart muxterm"