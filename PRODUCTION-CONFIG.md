# Configuración para Producción

## Variables de Entorno

### Desactivar sistemas de debug:

```bash
# NO establecer estas variables en producción:
# TRACE_PERSISTENCE=true        # Sistema de trazabilidad de persistencia
# TRACE_PERSISTENCE_FILE=true   # Guardar trazas en archivo
# DEBUG=muxterm:*              # Logs de debug generales
```

### Variables requeridas en producción:

```bash
# Base de datos
DB_HOST=localhost
DB_USER=muxterm
DB_PASSWORD=your_secure_password
DB_NAME=muxterm

# Sesión
SESSION_SECRET=your_secure_session_secret

# Puerto (opcional, por defecto 3001)
PORT=3001
```

## Instalación en Producción

1. Clonar el repositorio
2. Instalar dependencias: `npm install`
3. Compilar cliente: `npm run build`
4. Configurar variables de entorno (sin las de debug)
5. Iniciar: `npm start` o usar PM2

## Notas Importantes

- Los logs de trazabilidad (TRACE_PERSISTENCE) están DESACTIVADOS por defecto
- Los logger.debug() de desarrollo no afectan el rendimiento en producción
- El sistema funciona normalmente sin las variables de debug