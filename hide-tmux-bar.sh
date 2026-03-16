#!/bin/bash
# Script para deshabilitar TODAS las características de tmux en sesiones WebSSH

echo "Deshabilitando completamente tmux en todas las sesiones WebSSH..."

# Listar todas las sesiones de tmux que comienzan con webssh_
tmux_sessions=$(tmux -L muxterm ls 2>/dev/null | grep "^webssh_" | cut -d: -f1)

if [ -z "$tmux_sessions" ]; then
    echo "No se encontraron sesiones tmux activas"
else
    for session in $tmux_sessions; do
        echo "Procesando sesión: $session"
        # Aplicar TODA la configuración para hacer tmux invisible
        tmux -L muxterm send-keys -t "$session" "tmux -L muxterm set-option -g status off" C-m
        tmux -L muxterm send-keys -t "$session" "tmux -L muxterm set-option -g prefix None" C-m
        tmux -L muxterm send-keys -t "$session" "tmux -L muxterm unbind-key -a" C-m
        tmux -L muxterm send-keys -t "$session" "tmux -L muxterm set-option -g mouse off" C-m
        tmux -L muxterm send-keys -t "$session" "tmux -L muxterm set-option -g visual-activity off" C-m
        tmux -L muxterm send-keys -t "$session" "tmux -L muxterm set-option -g visual-bell off" C-m
        tmux -L muxterm send-keys -t "$session" "tmux -L muxterm set-option -g bell-action none" C-m
    done
    echo "Completado - tmux ahora es completamente invisible"
fi