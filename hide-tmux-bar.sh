#!/bin/bash
# Script para deshabilitar TODAS las características de tmux en sesiones WebSSH

echo "Deshabilitando completamente tmux en todas las sesiones WebSSH..."

# Listar todas las sesiones de tmux que comienzan con webssh_
tmux_sessions=$(tmux ls 2>/dev/null | grep "^webssh_" | cut -d: -f1)

if [ -z "$tmux_sessions" ]; then
    echo "No se encontraron sesiones tmux activas"
else
    for session in $tmux_sessions; do
        echo "Procesando sesión: $session"
        # Aplicar TODA la configuración para hacer tmux invisible
        tmux send-keys -t "$session" "tmux set-option -g status off" C-m
        tmux send-keys -t "$session" "tmux set-option -g prefix None" C-m
        tmux send-keys -t "$session" "tmux unbind-key -a" C-m
        tmux send-keys -t "$session" "tmux set-option -g mouse off" C-m
        tmux send-keys -t "$session" "tmux set-option -g visual-activity off" C-m
        tmux send-keys -t "$session" "tmux set-option -g visual-bell off" C-m
        tmux send-keys -t "$session" "tmux set-option -g bell-action none" C-m
    done
    echo "Completado - tmux ahora es completamente invisible"
fi