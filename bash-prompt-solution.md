# Solución del Prompt de Bash

## Problema
Cuando se ejecuta `ls`, el último elemento ("Vídeos") se concatena con el prompt siguiente, resultando en "Vídeosusuario@".

## Soluciones posibles:

### 1. Agregar salto de línea antes del prompt
```bash
# Prompt actual (aproximadamente):
PS1='\[\033[01;32m\]\u@\h\[\033[00m\]:\[\033[01;34m\]\w\[\033[00m\]\$ '

# Prompt modificado con salto de línea:
PS1='\n\[\033[01;32m\]\u@\h\[\033[00m\]:\[\033[01;34m\]\w\[\033[00m\]\$ '
```

### 2. Usar PROMPT_COMMAND para asegurar nueva línea
```bash
# Función que asegura una nueva línea antes del prompt
prompt_command() {
    # Verificar si el cursor no está al inicio de la línea
    local pos
    echo -en '\033[6n'
    read -sdR pos
    pos=${pos#*[}
    col=${pos%;*}
    if [ "$col" != "1" ]; then
        echo
    fi
}

PROMPT_COMMAND=prompt_command
```

### 3. Modificar en el PTY al crear la sesión
En el código del servidor, podríamos establecer estas variables al crear el terminal:

```javascript
const ptyProcess = pty.spawn(shell, [], {
  name: 'xterm-256color',
  cols: cols,
  rows: rows,
  cwd: process.env.HOME,
  env: {
    ...process.env,
    TERM: 'xterm-256color',
    PS1: '\\n\\[\\033[01;32m\\]\\u@\\h\\[\\033[00m\\]:\\[\\033[01;34m\\]\\w\\[\\033[00m\\]\\$ ',
    PROMPT_COMMAND: 'echo -en "\\033[6n"; read -sdR pos; pos=${pos#*[}; col=${pos%;*}; [ "$col" != "1" ] && echo'
  }
});
```

## Implicaciones:

### Ventajas:
1. **Solución definitiva**: Resolvería el problema de raíz
2. **Mejor experiencia**: El prompt siempre aparecería en una línea nueva
3. **Compatible**: Funcionaría con cualquier comando, no solo `ls`

### Desventajas:
1. **Cambio visual**: El prompt tendría una línea en blanco antes (puede ser molesto para algunos usuarios)
2. **Personalización perdida**: Si el usuario tiene su propio PS1 configurado, se sobrescribiría
3. **Portabilidad**: Diferentes shells (zsh, fish) tienen sintaxis diferentes

### Alternativa más elegante:
Usar el comando `tput` para manejar el posicionamiento del cursor:

```bash
# Agregar al final del .bashrc del usuario
export PS1='$(tput sgr0)\[\033[01;32m\]\u@\h\[\033[00m\]:\[\033[01;34m\]\w\[\033[00m\]\$ '
export PROMPT_COMMAND='tput sgr0'
```

Esto resetearía los atributos del terminal antes de mostrar el prompt.