-- Este script se ejecuta automáticamente al crear el contenedor de Postgres
-- local (vía docker-entrypoint-initdb.d en docker-compose.yml). Crea un
-- esquema separado para cada app, así las tablas de master-admin y las
-- del erp no se mezclan dentro de la misma base "postgres".
-- Solo hace falta correrlo a mano si en algún momento usas una base
-- externa distinta a la local (ver DOCUMENTACION.md).

CREATE SCHEMA IF NOT EXISTS master_admin AUTHORIZATION postgres;
CREATE SCHEMA IF NOT EXISTS erp AUTHORIZATION postgres;

-- (Opcional) Si usas un rol de base de datos distinto al de postgres:
-- GRANT ALL ON SCHEMA master_admin TO postgres;
-- GRANT ALL ON SCHEMA erp TO postgres;
