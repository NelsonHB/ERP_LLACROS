-- ============================================================
-- EZCUDO360 - CARGA DE 20 PRODUCTOS DE PRUEBA PARA PRUEBA SAC
-- Proveedor: erp.suppliers.id = 1 (PRUEBA SAC)
-- Stock inicial por producto: 100 unidades
-- Seguro para volver a ejecutar: no duplica productos ni
-- movimientos; si los códigos ya existen, no reinicia su stock.
-- Los costos y precios son valores ficticios para pruebas.
-- ============================================================

BEGIN;

-- 1) Confirmar que existe y está activo el proveedor esperado.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM erp.suppliers
    WHERE id = 1
      AND LOWER(BTRIM(business_name)) = 'prueba sac'
      AND active = TRUE
  ) THEN
    RAISE EXCEPTION 'No se encontró un proveedor activo PRUEBA SAC con id=1. No se realizó la carga.';
  END IF;
END
$$;

-- 2) Crear categorías tecnológicas únicamente si todavía no existen.
INSERT INTO erp.product_categories
  (name, description, active, created_at, updated_at)
SELECT v.name, v.description, TRUE, NOW(), NOW()
FROM (VALUES
  ('Periféricos', 'Teclados, mouse y dispositivos de entrada/salida.'),
  ('Accesorios', 'Accesorios y complementos para equipos informáticos.'),
  ('Componentes', 'Componentes internos para computadoras.'),
  ('Almacenamiento', 'Unidades y dispositivos para almacenar información.'),
  ('Redes y conectividad', 'Equipos y accesorios para conexión de redes.')
) AS v(name, description)
WHERE NOT EXISTS (
  SELECT 1
  FROM erp.product_categories c
  WHERE LOWER(BTRIM(c.name)) = LOWER(BTRIM(v.name))
);

-- 3) Preparar los datos de prueba en una tabla temporal.
CREATE TEMP TABLE seed_prueba_sac (
  code VARCHAR(50) PRIMARY KEY,
  category_name VARCHAR(150) NOT NULL,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  brand VARCHAR(100),
  model VARCHAR(100),
  unit VARCHAR(30) NOT NULL,
  sale_price NUMERIC(12,2) NOT NULL,
  initial_stock INTEGER NOT NULL,
  minimum_stock INTEGER NOT NULL,
  supplier_sku VARCHAR(100),
  reference_cost NUMERIC(12,2) NOT NULL
) ON COMMIT DROP;

INSERT INTO seed_prueba_sac
  (code, category_name, name, description, brand, model, unit,
   sale_price, initial_stock, minimum_stock, supplier_sku, reference_cost)
VALUES
  ('PSAC-001', 'Periféricos', 'Mouse óptico USB', 'Mouse alámbrico USB para computadora.', 'Genius', 'DX-120', 'UNIDAD', 29.90, 100, 5, 'PSAC-001', 18.00),
  ('PSAC-002', 'Periféricos', 'Mouse inalámbrico 2.4 GHz', 'Mouse inalámbrico con receptor USB.', 'Logitech', 'M170', 'UNIDAD', 49.90, 100, 5, 'PSAC-002', 32.00),
  ('PSAC-003', 'Periféricos', 'Teclado USB español', 'Teclado alámbrico con distribución en español.', 'Genius', 'KB-100', 'UNIDAD', 39.90, 100, 5, 'PSAC-003', 24.00),
  ('PSAC-004', 'Periféricos', 'Teclado mecánico RGB', 'Teclado mecánico para uso de escritorio y gaming.', 'Redragon', 'KUMARA', 'UNIDAD', 159.90, 100, 5, 'PSAC-004', 115.00),
  ('PSAC-005', 'Periféricos', 'Audífonos USB con micrófono', 'Auriculares con micrófono y conexión USB.', 'Logitech', 'H390', 'UNIDAD', 129.90, 100, 5, 'PSAC-005', 92.00),

  ('PSAC-006', 'Accesorios', 'Monitor LED 24 pulgadas', 'Monitor LED de escritorio de 24 pulgadas.', 'AOC', '24B1XH', 'UNIDAD', 499.90, 100, 5, 'PSAC-006', 420.00),
  ('PSAC-007', 'Accesorios', 'Webcam HD', 'Cámara web HD para videollamadas.', 'Logitech', 'C270', 'UNIDAD', 129.90, 100, 5, 'PSAC-007', 95.00),
  ('PSAC-008', 'Accesorios', 'Pad mouse tamaño XL', 'Alfombrilla extendida para mouse y teclado.', 'Genérico', 'PAD-XL', 'UNIDAD', 29.90, 100, 5, 'PSAC-008', 15.00),
  ('PSAC-009', 'Accesorios', 'Base refrigerante para laptop', 'Base con ventilación para computadora portátil.', 'Antryx', 'COOLPAD', 'UNIDAD', 69.90, 100, 5, 'PSAC-009', 42.00),
  ('PSAC-010', 'Accesorios', 'Parlantes USB 2.0', 'Par de parlantes multimedia con alimentación USB.', 'Micronics', 'SP-200', 'UNIDAD', 59.90, 100, 5, 'PSAC-010', 38.00),

  ('PSAC-011', 'Componentes', 'Memoria RAM DDR4 8 GB', 'Módulo de memoria RAM DDR4 de 8 GB.', 'Kingston', 'FURY-8GB', 'UNIDAD', 119.90, 100, 5, 'PSAC-011', 85.00),
  ('PSAC-012', 'Componentes', 'Memoria RAM DDR4 16 GB', 'Módulo de memoria RAM DDR4 de 16 GB.', 'Kingston', 'FURY-16GB', 'UNIDAD', 219.90, 100, 5, 'PSAC-012', 155.00),
  ('PSAC-013', 'Componentes', 'SSD SATA 480 GB', 'Unidad de estado sólido SATA de 480 GB.', 'Kingston', 'A400-480', 'UNIDAD', 159.90, 100, 5, 'PSAC-013', 115.00),
  ('PSAC-014', 'Componentes', 'SSD NVMe 1 TB', 'Unidad de estado sólido NVMe de 1 TB.', 'Kingston', 'NV2-1TB', 'UNIDAD', 299.90, 100, 5, 'PSAC-014', 240.00),
  ('PSAC-015', 'Componentes', 'Fuente de alimentación 550 W', 'Fuente de poder para computadora de escritorio.', 'Corsair', 'CV550', 'UNIDAD', 239.90, 100, 5, 'PSAC-015', 185.00),

  ('PSAC-016', 'Almacenamiento', 'Disco duro externo 1 TB', 'Unidad externa portátil de almacenamiento de 1 TB.', 'Seagate', 'EXP-1TB', 'UNIDAD', 239.90, 100, 5, 'PSAC-016', 180.00),
  ('PSAC-017', 'Almacenamiento', 'Memoria USB 64 GB', 'Memoria flash USB de 64 GB.', 'Kingston', 'DTSE9-64', 'UNIDAD', 29.90, 100, 5, 'PSAC-017', 18.00),
  ('PSAC-018', 'Almacenamiento', 'Tarjeta microSD 128 GB', 'Tarjeta de memoria microSD de 128 GB.', 'SanDisk', 'ULTRA-128', 'UNIDAD', 49.90, 100, 5, 'PSAC-018', 35.00),

  ('PSAC-019', 'Redes y conectividad', 'Router Wi-Fi AC1200', 'Router inalámbrico de doble banda para redes domésticas y pequeñas oficinas.', 'TP-Link', 'ARCHER-C6', 'UNIDAD', 149.90, 100, 5, 'PSAC-019', 110.00),
  ('PSAC-020', 'Redes y conectividad', 'Switch Ethernet 8 puertos', 'Switch de red Ethernet de 8 puertos.', 'TP-Link', 'TL-SG108', 'UNIDAD', 89.90, 100, 5, 'PSAC-020', 62.00);

-- 4) Crear solamente los productos que todavía no existan.
-- El stock se establece en 100 en el alta inicial.
CREATE TEMP TABLE created_prueba_sac (
  id BIGINT PRIMARY KEY,
  code VARCHAR(50) NOT NULL
) ON COMMIT DROP;

WITH inserted AS (
  INSERT INTO erp.products
    (category_id, code, name, description, brand, model, unit,
     sale_price, stock, minimum_stock, active, created_at, updated_at)
  SELECT
    c.id,
    d.code,
    d.name,
    d.description,
    d.brand,
    d.model,
    d.unit,
    d.sale_price,
    d.initial_stock,
    d.minimum_stock,
    TRUE,
    NOW(),
    NOW()
  FROM seed_prueba_sac d
  JOIN erp.product_categories c
    ON LOWER(BTRIM(c.name)) = LOWER(BTRIM(d.category_name))
  ORDER BY d.code
  ON CONFLICT (code) DO NOTHING
  RETURNING id, code
)
INSERT INTO created_prueba_sac (id, code)
SELECT id, code
FROM inserted;

-- 5) Registrar el movimiento de entrada únicamente para productos
-- creados en esta ejecución. La referencia AJUSTE está permitida
-- por las restricciones actuales de stock_movements.
INSERT INTO erp.stock_movements
  (product_id, movement_type, reference_type, reference_id,
   quantity_change, stock_before, stock_after, reason, user_id, created_at)
SELECT
  p.id,
  'ENTRADA',
  'AJUSTE',
  NULL,
  100,
  0,
  100,
  'Carga inicial de datos de prueba para proveedor PRUEBA SAC',
  NULL,
  NOW()
FROM created_prueba_sac p;

-- 6) Asociar los 20 productos al proveedor PRUEBA SAC.
-- Si el vínculo ya existe, actualiza SKU/costo de referencia sin duplicarlo.
INSERT INTO erp.supplier_products
  (supplier_id, product_id, supplier_sku, reference_cost,
   active, created_at, updated_at)
SELECT
  s.id,
  p.id,
  d.supplier_sku,
  d.reference_cost,
  TRUE,
  NOW(),
  NOW()
FROM seed_prueba_sac d
JOIN erp.products p
  ON p.code = d.code
JOIN erp.suppliers s
  ON s.id = 1
 AND LOWER(BTRIM(s.business_name)) = 'prueba sac'
ON CONFLICT (supplier_id, product_id)
DO UPDATE SET
  supplier_sku = EXCLUDED.supplier_sku,
  reference_cost = EXCLUDED.reference_cost,
  active = TRUE,
  updated_at = NOW();

-- 7) Resumen de verificación antes de confirmar.
SELECT
  COUNT(*) AS productos_asociados_a_prueba_sac,
  COUNT(*) FILTER (WHERE p.stock = 100) AS productos_con_stock_100,
  COUNT(*) FILTER (WHERE p.active = TRUE) AS productos_activos,
  COALESCE(SUM(p.stock), 0) AS unidades_totales_en_estos_20_productos
FROM seed_prueba_sac d
JOIN erp.products p ON p.code = d.code
JOIN erp.supplier_products sp ON sp.product_id = p.id
JOIN erp.suppliers s ON s.id = sp.supplier_id
WHERE s.id = 1;

-- 8) Listado final.
SELECT
  p.id,
  p.code,
  p.name,
  c.name AS categoria,
  p.sale_price AS precio_venta,
  sp.reference_cost AS costo_referencial,
  p.stock,
  s.business_name AS proveedor
FROM seed_prueba_sac d
JOIN erp.products p ON p.code = d.code
JOIN erp.product_categories c ON c.id = p.category_id
JOIN erp.supplier_products sp ON sp.product_id = p.id
JOIN erp.suppliers s ON s.id = sp.supplier_id
WHERE s.id = 1
ORDER BY p.code;

COMMIT;
