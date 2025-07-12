# Funcionalidad de Renombrar Sesiones - Visual

## Cómo se ve en la interfaz:

### 1. Tarjeta de Sesión
```
┌─────────────────────────────────────┐
│ 📁 Mi Sesión de Prueba             │
│                                     │
│ Host: localhost                     │
│ Usuario: test                       │
│ Última vez: hace 2 minutos          │
│                                     │
│ [🔌 Connect] [✏️ Edit] [🗑️ Delete]  │
└─────────────────────────────────────┘
```

### 2. Al hacer clic en el ícono ✏️ (Edit):
```
┌─────────────────────────────────────┐
│        Edit Session Name            │
├─────────────────────────────────────┤
│                                     │
│ Session Name:                       │
│ ┌─────────────────────────────────┐ │
│ │ Mi Sesión de Prueba             │ │
│ └─────────────────────────────────┘ │
│                                     │
│     [Cancel]        [Save]          │
└─────────────────────────────────────┘
```

### 3. Después de cambiar el nombre:
```
┌─────────────────────────────────────┐
│ 📁 Sesión Renombrada               │
│                                     │
│ Host: localhost                     │
│ Usuario: test                       │
│ Última vez: hace 1 minuto           │
│                                     │
│ [🔌 Connect] [✏️ Edit] [🗑️ Delete]  │
└─────────────────────────────────────┘
```

## Ubicación del botón Edit:
El botón de editar (✏️) está en la parte inferior de cada tarjeta de sesión, 
entre los botones de Connect y Delete.

