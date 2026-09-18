#!/bin/sh

set -e

echo ">>> Sincronizando dependencias (npm install)..."

npm install

echo ">>> Generando archivos internos de AdonisJS..."

node ace codegen

echo ">>> Aplicando migraciones de la base de datos..."

node ace migration:run --force

echo ">>> Iniciando servidor..."

exec npm run dev