#!/bin/bash

# Script para crear una nueva release de MuxTerm

# Colores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== MuxTerm Release Creator ===${NC}"
echo ""

# Verificar que estamos en la rama main
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
    echo -e "${RED}Error: Debes estar en la rama 'main' para crear una release${NC}"
    echo "Rama actual: $CURRENT_BRANCH"
    exit 1
fi

# Verificar que no hay cambios sin commitear
if ! git diff-index --quiet HEAD --; then
    echo -e "${RED}Error: Hay cambios sin commitear${NC}"
    echo "Por favor, commitea o descarta los cambios antes de crear una release"
    git status --short
    exit 1
fi

# Obtener la versión actual del package.json
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo -e "Versión actual: ${YELLOW}v$CURRENT_VERSION${NC}"
echo ""

# Sugerir próxima versión
IFS='.' read -ra VERSION_PARTS <<< "$CURRENT_VERSION"
MAJOR=${VERSION_PARTS[0]}
MINOR=${VERSION_PARTS[1]}
PATCH=${VERSION_PARTS[2]}

NEXT_PATCH="$MAJOR.$MINOR.$((PATCH + 1))"
NEXT_MINOR="$MAJOR.$((MINOR + 1)).0"
NEXT_MAJOR="$((MAJOR + 1)).0.0"

echo "Sugerencias de versión:"
echo "  1) Patch (correcciones): v$NEXT_PATCH"
echo "  2) Minor (nuevas características): v$NEXT_MINOR"
echo "  3) Major (cambios importantes): v$NEXT_MAJOR"
echo "  4) Personalizada"
echo ""

read -p "Selecciona una opción (1-4): " VERSION_CHOICE

case $VERSION_CHOICE in
    1)
        NEW_VERSION=$NEXT_PATCH
        ;;
    2)
        NEW_VERSION=$NEXT_MINOR
        ;;
    3)
        NEW_VERSION=$NEXT_MAJOR
        ;;
    4)
        read -p "Ingresa la nueva versión (sin 'v'): " NEW_VERSION
        ;;
    *)
        echo -e "${RED}Opción inválida${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "Nueva versión: ${GREEN}v$NEW_VERSION${NC}"
echo ""

# Pedir changelog
echo "Ingresa los cambios para esta versión (termina con una línea vacía):"
echo "Ejemplo: - Agregada característica X"
echo ""

CHANGELOG=""
while IFS= read -r line; do
    [ -z "$line" ] && break
    CHANGELOG="${CHANGELOG}- ${line}\n"
done

if [ -z "$CHANGELOG" ]; then
    echo -e "${RED}Error: Debes ingresar al menos un cambio${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}=== Resumen de la Release ===${NC}"
echo -e "Versión: ${GREEN}v$NEW_VERSION${NC}"
echo -e "Cambios:"
echo -e "$CHANGELOG"
echo ""

read -p "¿Confirmar creación de release? (s/n): " CONFIRM
if [ "$CONFIRM" != "s" ] && [ "$CONFIRM" != "S" ]; then
    echo "Release cancelada"
    exit 0
fi

echo ""
echo "Actualizando package.json..."

# Actualizar version en package.json
npm version $NEW_VERSION --no-git-tag-version

# Actualizar version en client/package.json
cd client
npm version $NEW_VERSION --no-git-tag-version
cd ..

# Actualizar version en VersionIndicator.jsx
sed -i "s/const CURRENT_VERSION = '.*'/const CURRENT_VERSION = '$NEW_VERSION'/" client/src/components/VersionIndicator.jsx

# Commit de los cambios
git add package.json client/package.json client/src/components/VersionIndicator.jsx
git commit -m "Bump version to $NEW_VERSION"

# Crear y push del tag
echo ""
echo "Creando tag v$NEW_VERSION..."
git tag -a "v$NEW_VERSION" -m "Release v$NEW_VERSION

$CHANGELOG"

# Push cambios y tag
echo ""
echo "Publicando cambios..."
git push origin main
git push origin "v$NEW_VERSION"

echo ""
echo -e "${GREEN}✓ Release v$NEW_VERSION creada exitosamente!${NC}"
echo ""
echo "La release aparecerá en GitHub en unos momentos."
echo "Los usuarios verán la notificación de actualización automáticamente."
echo ""
echo "Para crear las notas de release en GitHub:"
echo "1. Ve a https://github.com/tecnologicachile/muxterm/releases/new"
echo "2. Selecciona el tag v$NEW_VERSION"
echo "3. Título: v$NEW_VERSION"
echo "4. Pega este changelog:"
echo -e "$CHANGELOG"