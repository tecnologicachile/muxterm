# Un solo estado por panel

Diseño corto, octubre 2026. Implementado junto con este documento.

## Problema

Tres indicadores medían cosas distintas: el círculo de la cabecera se
encendía si la pantalla del terminal cambió en los últimos 2 s (un cronómetro
lo enciende), el tinte verde si el transcript de Claude tiene un turno abierto,
y el ámbar si hay una pregunta o permiso. Se contradecían, y ninguno sabía de
agentes en segundo plano ni de un `npm run build` en un terminal sin Claude.

## Modelo

El servidor calcula un estado por panel, una vez por segundo, y lo publica por
socket (`claude-status`) como ya hacía para las sesiones Claude. El cliente
solo lo dibuja. Campos:

| Campo | Fuente | Significa |
|---|---|---|
| `command`, `commandSince` | tmux `pane_current_command` ≠ shell y ≠ `claude` | ejecutando ese programa desde esa hora |
| `busy`, `since` | transcript: prompt sin fin de turno | Claude trabaja en un pedido tuyo |
| `agents[]` | `<sesión>/subagents/*.jsonl` escritos en los últimos 45 s | agentes en segundo plano: nombre y desde cuándo |
| `waiting`, `permission` | transcript (pregunta/selector) o pantalla (permiso) | te necesita |
| `finishedAt`, `lastText` | transcript | último turno terminado |

Prioridad al dibujar, de mayor a menor: te necesita (ámbar) › Claude
trabajando (verde) › agentes en segundo plano (verde suave) › ejecutando
(gris) › reposo. El tooltip lo dice en palabras, con nombre y tiempo.

## Qué se retira

El detector por hash de pantalla (`capture-pane` de cada terminal cada 800 ms
en el servidor, `terminal-activity` por socket, `activityMap` en el cliente).
Era la fuente de los falsos positivos y una parte apreciable del coste fijo
de CPU de muxterm y tmux.

## Fuera de alcance

El `onActivityChange` que el componente Terminal recibe de ttyd se mantiene
como señal secundaria para terminales sin tmux (no hay ninguno hoy); no se
usa para el indicador.
