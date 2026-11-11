-- ============================================================
-- EZCUDO360 - CARGA DE 15 CLIENTES FICTICIOS PARA PRUEBAS
-- Tabla: erp.customers
-- Proposito: probar busqueda DNI/RUC, POS e historial de ventas.
-- Seguro para reejecutar: omite documentos que ya existan.
-- IMPORTANTE: datos totalmente ficticios; no usar para SUNAT.
-- ============================================================

BEGIN;

WITH clientes_prueba (
    document_type,
    document_number,
    name,
    phone,
    email,
    address,
    active
) AS (
    VALUES
      ('DNI', '90000001', 'Carlos Mendoza Quispe',       '987650001', 'carlos.mendoza@example.test',       'Av. Real 100, Huancayo, Junin', TRUE),
      ('DNI', '90000002', 'Andrea Flores Rojas',          '987650002', 'andrea.flores@example.test',        'Jr. Lima 215, Huancayo, Junin', TRUE),
      ('DNI', '90000003', 'Luis Torres Salazar',          '987650003', 'luis.torres@example.test',          'Av. Ferrocarril 320, Huancayo, Junin', TRUE),
      ('DNI', '90000004', 'Mariana Castro Huaman',        '987650004', 'mariana.castro@example.test',       'Jr. Arequipa 145, El Tambo, Junin', TRUE),
      ('DNI', '90000005', 'Diego Ramirez Paredes',        '987650005', 'diego.ramirez@example.test',        'Av. Huancavelica 510, Huancayo, Junin', TRUE),
      ('DNI', '90000006', 'Valeria Rojas Medina',          '987650006', 'valeria.rojas@example.test',        'Jr. Ancash 225, Chilca, Junin', TRUE),
      ('DNI', '90000007', 'Jorge Poma Cardenas',           '987650007', 'jorge.poma@example.test',           'Av. Mariscal Castilla 760, El Tambo, Junin', TRUE),
      ('DNI', '90000008', 'Daniela Vega Huayta',           '987650008', 'daniela.vega@example.test',         'Jr. Cajamarca 180, Huancayo, Junin', TRUE),
      ('DNI', '90000009', 'Miguel Chavez Soto',            '987650009', 'miguel.chavez@example.test',        'Av. Giraldez 415, Huancayo, Junin', TRUE),
      ('DNI', '90000010', 'Camila Espinoza Leon',          '987650010', 'camila.espinoza@example.test',      'Jr. Puno 290, Chilca, Junin', TRUE),
      ('RUC', '20990000001', 'INVERSIONES TECNOLOGICAS ANDINAS S.A.C.', '987650011', 'ventas@inversionesandinas.example.test', 'Av. Huancavelica 850, Huancayo, Junin', TRUE),
      ('RUC', '20990000002', 'COMERCIAL DEL CENTRO S.R.L.',              '987650012', 'contacto@comercialcentro.example.test',  'Jr. Ica 430, Huancayo, Junin', TRUE),
      ('RUC', '20990000003', 'SOLUCIONES DIGITALES DEL VALLE S.A.C.',    '987650013', 'ventas@solucionesvalle.example.test',     'Av. Daniel Alcides Carrion 620, El Tambo, Junin', TRUE),
      ('RUC', '20990000004', 'DISTRIBUIDORA ELECTRONICA MANTARO S.A.C.','987650014', 'contacto@electroncamantaro.example.test', 'Carretera Central 1200, San Agustin de Cajas, Junin', TRUE),
      ('RUC', '20990000005', 'SERVICIOS INFORMATICOS HUANCAYO E.I.R.L.','987650015', 'administracion@servicioshuancayo.example.test', 'Jr. Ayacucho 350, Huancayo, Junin', TRUE)
), insertados AS (
    INSERT INTO erp.customers (
        document_type,
        document_number,
        name,
        phone,
        email,
        address,
        active
    )
    SELECT
        document_type,
        document_number,
        name,
        phone,
        email,
        address,
        active
    FROM clientes_prueba
    ON CONFLICT (document_number) DO NOTHING
    RETURNING id
)
SELECT COUNT(*) AS clientes_nuevos_insertados
FROM insertados;

-- Mostrar los 15 registros previstos y su estado final.
SELECT
    id,
    document_type,
    document_number,
    name,
    phone,
    email,
    active
FROM erp.customers
WHERE document_number IN (
    '90000001', '90000002', '90000003', '90000004', '90000005',
    '90000006', '90000007', '90000008', '90000009', '90000010',
    '20990000001', '20990000002', '20990000003', '20990000004', '20990000005'
)
ORDER BY document_type, document_number;

COMMIT;
