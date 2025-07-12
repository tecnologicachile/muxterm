#!/bin/bash

# Script rápido para crear releases de prueba (solo crea el tag en GitHub)

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}=== Quick Release (Solo Tag) ===${NC}"
echo ""
echo -e "${YELLOW}NOTA: Este script solo crea el tag para probar el sistema de actualizaciones${NC}"
echo -e "${YELLOW}      No modifica archivos locales${NC}"
echo ""

# Obtener tags existentes
echo "Tags existentes:"
git tag -l "v*" | tail -5
echo ""

read -p "Nueva versión (sin 'v', ej: 1.0.1): " VERSION

if [ -z "$VERSION" ]; then
    echo -e "${RED}Error: Debes especificar una versión${NC}"
    exit 1
fi

echo ""
read -p "Mensaje de release (ej: 'Test de sistema de actualizaciones'): " MESSAGE

if [ -z "$MESSAGE" ]; then
    MESSAGE="Release v$VERSION"
fi

echo ""
echo -e "${YELLOW}=== Resumen ===${NC}"
echo -e "Tag: ${GREEN}v$VERSION${NC}"
echo -e "Mensaje: $MESSAGE"
echo ""

read -p "¿Crear tag? (s/n): " CONFIRM
if [ "$CONFIRM" != "s" ] && [ "$CONFIRM" != "S" ]; then
    echo "Cancelado"
    exit 0
fi

# Crear y pushear el tag
git tag -a "v$VERSION" -m "$MESSAGE"
git push origin "v$VERSION"

echo ""
echo -e "${GREEN}✓ Tag v$VERSION creado!${NC}"
echo ""
echo "En unos segundos, el sistema detectará la nueva versión."
echo "Para eliminar este tag de prueba más tarde:"
echo -e "${YELLOW}git tag -d v$VERSION && git push origin :refs/tags/v$VERSION${NC}"