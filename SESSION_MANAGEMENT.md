# Gestión de Sesiones - Nuevas Funcionalidades

## Funcionalidades Implementadas

### 1. Nombres de Sesión Personalizados
- Al crear una nueva sesión, puedes asignarle un nombre personalizado
- El nombre se muestra en la lista de sesiones
- Si no asignas un nombre, se usa el formato por defecto: "Session DD/MM/YYYY"

### 2. Editar Nombre de Sesión
- Haz clic en el icono de lápiz (✏️) en cualquier tarjeta de sesión
- Ingresa el nuevo nombre en el diálogo
- El cambio se guarda inmediatamente

### 3. Eliminar Sesión Individual
- Haz clic en el icono de papelera (🗑️) en la tarjeta de sesión
- Confirma la eliminación en el diálogo
- Esto cerrará todos los terminales de esa sesión

### 4. Eliminar Todas las Sesiones
- Aparece el botón "Delete All" cuando hay al menos una sesión
- Requiere confirmación
- Elimina todas las sesiones y cierra todos los terminales

### 5. Información Visual Mejorada
- Iconos según el tipo de layout:
  - 🖥️ Terminal único
  - ⬛⬜ División de paneles (2-3 paneles)
  - ⬛⬛⬜⬜ Cuadrícula (4 paneles)
- Información del layout (ej: "2 panels (split)", "4 panels (grid)")
- Fecha de creación y último acceso

## Cambios Técnicos

### Backend (servidor)
- Nuevos eventos Socket.IO:
  - `create-session`: Crea sesión con nombre
  - `update-session-name`: Actualiza nombre
  - `delete-session`: Elimina una sesión
  - `delete-all-sessions`: Elimina todas las sesiones
- SessionManager actualizado con métodos correspondientes
- Los terminales se cierran automáticamente al eliminar sesiones

### Frontend (cliente)
- SessionList mejorado con:
  - Botones de editar y eliminar por sesión
  - Botón "Delete All" global
  - Diálogos de confirmación
  - Manejo de eventos para actualizaciones en tiempo real
- TerminalView actualizado para crear sesiones con nombre

## Uso

### Crear Sesión con Nombre
1. Click en "New Session"
2. Ingresa un nombre descriptivo (opcional)
3. Click en "Create"

### Renombrar Sesión
1. Encuentra la sesión en la lista
2. Click en el icono de lápiz
3. Ingresa el nuevo nombre
4. Click en "Save"

### Eliminar Sesión
1. Click en el icono de papelera de la sesión
2. Confirma en el diálogo
3. La sesión y sus terminales se eliminarán

### Eliminar Todas las Sesiones
1. Click en "Delete All" (arriba a la derecha)
2. Confirma en el diálogo
3. Todas las sesiones se eliminarán

## Notas Importantes

- Los nombres de sesión se guardan en el servidor
- Al eliminar una sesión, todos sus terminales se cierran
- Las sesiones persisten entre reconexiones (mientras el servidor esté activo)
- Sin Redis habilitado, las sesiones se pierden al reiniciar el servidor