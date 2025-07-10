#!/bin/bash

# Script de inicialización para tmux en WebSSH
# Asegura que la terminal esté lista y limpia

# Limpiar la pantalla
clear

# Configurar el prompt para evitar problemas
export PS1='$ '

# Asegurar que el terminal esté en modo interactivo
export TERM=xterm-256color

# Ejecutar bash en modo interactivo
exec /bin/bash --login