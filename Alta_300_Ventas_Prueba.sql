-- ============================================================
-- EZCUDO360 - CARGA DE 300 VENTAS SIMULADAS PARA PRUEBAS
-- Periodos: agosto, septiembre y octubre de 2026
-- Requiere:
--   * Proveedor PRUEBA SAC con ID 1
--   * 15 clientes activos como minimo
--   * 20 productos activos de PRUEBA SAC con precio > 0
--     y stock inicial >= 40 unidades
--   * Al menos un usuario en erp.users
--
-- IMPORTANTE:
--   * Registros FICTICIOS, no son ventas comerciales reales.
--   * 288 ventas COMPLETADAS y 12 ANULADAS.
--   * Las anuladas tienen detalle, pero NO pago ni salida de stock.
--   * Las ventas completadas descuentan stock y crean movimientos.
--   * sale_date contiene la fecha comercial simulada.
--   * created_at en stock_movements registra el momento real
--     de carga para no alterar la cronologia fisica del inventario.
--   * Seguro ante reejecucion: omite numeros SIM ya existentes.
--   * Toda la carga ocurre en una transaccion; ante error se revierte.
-- ============================================================

BEGIN;

CREATE TEMP TABLE sim_sales_lines (
    sale_index       integer NOT NULL,
    product_id       bigint NOT NULL,
    product_code     varchar(50) NOT NULL,
    product_name     varchar(150) NOT NULL,
    quantity         integer NOT NULL,
    unit_price       numeric(12,2) NOT NULL,
    line_subtotal    numeric(12,2) NOT NULL,
    stock_before     integer NOT NULL,
    stock_after      integer NOT NULL
) ON COMMIT DROP;

DO $$
DECLARE
    v_user_id             integer;
    v_customer_ids        bigint[];
    v_customer_count      integer;
    v_product_ids         bigint[];
    v_product_count       integer;

    v_now                 timestamptz := clock_timestamp();
    v_month_index         integer;
    v_month_sequence      integer;
    v_month_start         date;
    v_month_days          integer;
    v_sale_day            date;
    v_sale_date           timestamptz;
    v_sale_number         varchar(50);
    v_status              varchar(20);
    v_customer_id         bigint;

    v_line_count          integer;
    v_line                integer;
    v_quantity            integer;
    v_product_index       integer;
    v_candidate_index     integer;
    v_offset              integer;
    v_product_found       boolean;

    v_product_id          bigint;
    v_product_code        varchar(50);
    v_product_name        varchar(150);
    v_unit_price          numeric(12,2);
    v_stock_before        integer;
    v_stock_after         integer;
    v_line_subtotal       numeric(12,2);

    v_subtotal            numeric(12,2);
    v_discount            numeric(12,2);
    v_total               numeric(12,2);
    v_tax                 numeric(12,2);

    v_hour                integer;
    v_minute              integer;
    v_payment_method      varchar(30);
    v_amount_received     numeric(12,2);
    v_change_amount       numeric(12,2);

    v_sale_id             bigint;
    v_inserted            integer := 0;
    v_skipped             integer := 0;
    v_completed           integer := 0;
    v_cancelled           integer := 0;
BEGIN
    -- 1. Obtener un usuario real para cumplir la FK de sales.user_id.
    SELECT u.id
      INTO v_user_id
      FROM erp.users u
     ORDER BY u.id
     LIMIT 1;

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION
          'No existe ningun usuario en erp.users. No se insertaron ventas.';
    END IF;

    -- 2. Seleccionar hasta 15 clientes activos.
    SELECT array_agg(c.id ORDER BY c.id)
      INTO v_customer_ids
      FROM (
        SELECT id
          FROM erp.customers
         WHERE active = TRUE
         ORDER BY id
         LIMIT 15
      ) c;

    v_customer_count := COALESCE(array_length(v_customer_ids, 1), 0);

    IF v_customer_count < 15 THEN
        RAISE EXCEPTION
          'Se necesitan 15 clientes activos y solo se encontraron %. Ejecuta primero Alta_15_Clientes_Prueba.sql.',
          v_customer_count;
    END IF;

    -- 3. Seleccionar 20 productos de PRUEBA SAC (supplier_id = 1).
    --    El stock se comprueba y bloquea nuevamente al consumir cada unidad.
    SELECT array_agg(p.id ORDER BY p.id)
      INTO v_product_ids
      FROM (
        SELECT pr.id
          FROM erp.products pr
          JOIN erp.supplier_products sp
            ON sp.product_id = pr.id
         WHERE sp.supplier_id = 1
           AND sp.active = TRUE
           AND pr.active = TRUE
           AND pr.sale_price > 0
         ORDER BY pr.id
         LIMIT 20
      ) p;

    v_product_count := COALESCE(array_length(v_product_ids, 1), 0);

    IF v_product_count < 20 THEN
        RAISE EXCEPTION
          'Se necesitan 20 productos activos de PRUEBA SAC (ID 1) con precio mayor que cero. Se encontraron %. Verifica primero la carga de productos.',
          v_product_count;
    END IF;

    RAISE NOTICE 'Usuario asignado: %', v_user_id;
    RAISE NOTICE 'Clientes disponibles: %', v_customer_count;
    RAISE NOTICE 'Productos disponibles: %', v_product_count;
    RAISE NOTICE 'Generando 100 ventas por mes: agosto, septiembre y octubre de 2026.';

    -- 4. Generar 300 ventas: 100 por cada mes.
    FOR i IN 1..300 LOOP

        v_month_index := (i - 1) / 100;
        v_month_sequence := ((i - 1) % 100) + 1;

        v_month_start := CASE v_month_index
            WHEN 0 THEN DATE '2026-08-01'
            WHEN 1 THEN DATE '2026-09-01'
            ELSE DATE '2026-10-01'
        END;

        v_month_days := EXTRACT(
            DAY FROM (v_month_start + INTERVAL '1 month - 1 day')
        )::integer;

        -- Distribucion de fechas a lo largo de cada mes.
        v_sale_day := v_month_start
            + (((v_month_sequence - 1) * 7) % v_month_days);

        -- Horarios comerciales variados entre 08:00 y 18:59.
        v_hour := 8 + ((i * 7) % 11);
        v_minute := (i * 13) % 60;

        v_sale_date := (
            v_sale_day::timestamp
            + make_interval(hours => v_hour, mins => v_minute)
        ) AT TIME ZONE 'America/Lima';

        v_sale_number := 'SIM-'
            || to_char(v_month_start, 'YYYYMM')
            || '-'
            || lpad(v_month_sequence::text, 3, '0');

        -- Evitar duplicados si el archivo se vuelve a ejecutar.
        IF EXISTS (
            SELECT 1
              FROM erp.sales s
             WHERE s.sale_number = v_sale_number
        ) THEN
            v_skipped := v_skipped + 1;
            CONTINUE;
        END IF;

        v_status := CASE
            WHEN i % 25 = 0 THEN 'ANULADA'
            ELSE 'COMPLETADA'
        END;

        -- Asignacion rotativa entre los 15 clientes activos.
        v_customer_id := v_customer_ids[
            ((i - 1) % v_customer_count) + 1
        ];

        -- En promedio 1.33 lineas por venta; octubre tiene
        -- algunas lineas adicionales para simular mayor demanda.
        v_line_count := CASE
            WHEN v_month_index = 2 AND v_month_sequence % 4 = 0 THEN 2
            WHEN v_month_sequence % 3 = 0 THEN 2
            ELSE 1
        END;

        DELETE FROM pg_temp.sim_sales_lines
         WHERE sale_index = i;

        -- 5. Elegir productos y preparar el detalle.
        FOR v_line IN 1..v_line_count LOOP

            v_quantity := CASE
                WHEN v_month_index = 2 AND v_month_sequence % 5 = 0 THEN 2
                WHEN v_month_index = 1 AND v_month_sequence % 9 = 0 THEN 2
                WHEN (i + v_line) % 17 = 0 THEN 2
                ELSE 1
            END;

            -- Distribuye las ventas entre los 20 productos.
            v_product_index := (
                ((i - 1) * 3 + (v_line - 1) * 7)
                % v_product_count
            ) + 1;

            v_product_found := FALSE;

            -- Si el producto elegido no tiene stock suficiente,
            -- busca el siguiente producto disponible del mismo proveedor.
            FOR v_offset IN 0..(v_product_count - 1) LOOP
                v_candidate_index := (
                    (v_product_index - 1 + v_offset)
                    % v_product_count
                ) + 1;

                SELECT
                    p.id,
                    p.code,
                    p.name,
                    p.sale_price,
                    p.stock
                  INTO
                    v_product_id,
                    v_product_code,
                    v_product_name,
                    v_unit_price,
                    v_stock_before
                  FROM erp.products p
                 WHERE p.id = v_product_ids[v_candidate_index]
                 FOR UPDATE;

                IF v_stock_before >= v_quantity THEN
                    v_product_found := TRUE;
                    EXIT;
                END IF;
            END LOOP;

            IF NOT v_product_found THEN
                RAISE EXCEPTION
                  'Stock insuficiente para completar la carga. Se detuvo en la venta %.',
                  v_sale_number;
            END IF;

            v_line_subtotal := round(
                v_unit_price * v_quantity,
                2
            );

            IF v_status = 'COMPLETADA' THEN
                v_stock_after := v_stock_before - v_quantity;

                UPDATE erp.products
                   SET stock = v_stock_after,
                       updated_at = v_now
                 WHERE id = v_product_id;
            ELSE
                -- Venta anulada: no se descuenta stock.
                v_stock_after := v_stock_before;
            END IF;

            INSERT INTO pg_temp.sim_sales_lines (
                sale_index,
                product_id,
                product_code,
                product_name,
                quantity,
                unit_price,
                line_subtotal,
                stock_before,
                stock_after
            ) VALUES (
                i,
                v_product_id,
                v_product_code,
                v_product_name,
                v_quantity,
                v_unit_price,
                v_line_subtotal,
                v_stock_before,
                v_stock_after
            );
        END LOOP;

        -- 6. Calcular importes. total = subtotal - descuento,
        --    de acuerdo con las restricciones reales de erp.sales.
        SELECT round(COALESCE(sum(l.line_subtotal), 0), 2)
          INTO v_subtotal
          FROM pg_temp.sim_sales_lines l
         WHERE l.sale_index = i;

        v_discount := CASE
            WHEN i % 6 = 0 THEN round(v_subtotal * 0.10, 2)
            WHEN i % 4 = 0 THEN round(v_subtotal * 0.05, 2)
            WHEN i % 5 = 0 THEN round(v_subtotal * 0.03, 2)
            ELSE 0.00
        END;

        v_total := v_subtotal - v_discount;
        v_tax := round(v_total * 18 / 118, 2);

        -- 7. Crear cabecera de venta.
        INSERT INTO erp.sales (
            sale_number,
            customer_id,
            sale_date,
            subtotal,
            discount_amount,
            tax_amount,
            total,
            status,
            notes,
            created_at,
            updated_at,
            user_id
        ) VALUES (
            v_sale_number,
            v_customer_id,
            v_sale_date,
            v_subtotal,
            v_discount,
            v_tax,
            v_total,
            v_status,
            'VENTA SIMULADA PARA PRUEBAS DEL ERP. No corresponde a una operacion comercial real.',
            v_now,
            v_now,
            v_user_id
        )
        RETURNING id INTO v_sale_id;

        -- 8. Guardar detalle de productos.
        INSERT INTO erp.sale_details (
            sale_id,
            product_id,
            product_code,
            product_name,
            quantity,
            unit_price,
            subtotal,
            created_at
        )
        SELECT
            v_sale_id,
            l.product_id,
            l.product_code,
            l.product_name,
            l.quantity,
            l.unit_price,
            l.line_subtotal,
            v_now
          FROM pg_temp.sim_sales_lines l
         WHERE l.sale_index = i;

        IF v_status = 'COMPLETADA' THEN

            -- 9. Registrar salidas de almacen relacionadas con la venta.
            --    created_at es la fecha de carga real; reason conserva
            --    la fecha comercial historica simulada.
            INSERT INTO erp.stock_movements (
                product_id,
                movement_type,
                reference_type,
                reference_id,
                quantity_change,
                stock_before,
                stock_after,
                reason,
                user_id,
                created_at
            )
            SELECT
                l.product_id,
                'SALIDA',
                'VENTA',
                v_sale_id,
                -l.quantity,
                l.stock_before,
                l.stock_after,
                'Venta simulada ' || v_sale_number
                  || '; fecha comercial: '
                  || to_char(
                       v_sale_date AT TIME ZONE 'America/Lima',
                       'YYYY-MM-DD HH24:MI'
                     ),
                v_user_id,
                v_now
              FROM pg_temp.sim_sales_lines l
             WHERE l.sale_index = i;

            -- 10. Metodo de pago variado.
            v_payment_method := CASE (i % 5)
                WHEN 0 THEN 'EFECTIVO'
                WHEN 1 THEN 'YAPE'
                WHEN 2 THEN 'PLIN'
                WHEN 3 THEN 'TARJETA'
                ELSE 'TRANSFERENCIA'
            END;

            IF v_payment_method = 'EFECTIVO' THEN
                v_amount_received := v_total
                    + CASE WHEN i % 2 = 0 THEN 20.00 ELSE 50.00 END;
                v_change_amount := v_amount_received - v_total;
            ELSE
                v_amount_received := NULL;
                v_change_amount := NULL;
            END IF;

            -- 11. Registrar pago solo para ventas completadas.
            INSERT INTO erp.payments (
                sale_id,
                payment_method,
                amount,
                amount_received,
                change_amount,
                reference_number,
                created_at
            ) VALUES (
                v_sale_id,
                v_payment_method,
                v_total,
                v_amount_received,
                v_change_amount,
                CASE
                    WHEN v_payment_method = 'EFECTIVO' THEN NULL
                    ELSE 'SIM-' || v_sale_number
                END,
                v_sale_date
            );

            v_completed := v_completed + 1;
        ELSE
            -- Venta anulada: conserva cabecera y detalle para pruebas,
            -- pero no registra pago ni descuenta inventario.
            v_cancelled := v_cancelled + 1;
        END IF;

        v_inserted := v_inserted + 1;

    END LOOP;

    RAISE NOTICE '============================================';
    RAISE NOTICE 'CARGA DE VENTAS SIMULADAS FINALIZADA';
    RAISE NOTICE 'Nuevas ventas insertadas: %', v_inserted;
    RAISE NOTICE 'Ventas completadas: %', v_completed;
    RAISE NOTICE 'Ventas anuladas: %', v_cancelled;
    RAISE NOTICE 'Ventas omitidas por existir previamente: %', v_skipped;
    RAISE NOTICE 'Total objetivo: 300 (100 por mes)';
    RAISE NOTICE '============================================';
END $$;

COMMIT;

-- Resumen de ventas simuladas por mes y estado.
SELECT
    to_char(s.sale_date AT TIME ZONE 'America/Lima', 'YYYY-MM') AS periodo,
    s.status,
    COUNT(*) AS cantidad_ventas,
    ROUND(SUM(s.total), 2) AS importe_total,
    ROUND(SUM(s.discount_amount), 2) AS descuentos
FROM erp.sales s
WHERE s.sale_number LIKE 'SIM-%'
GROUP BY 1, s.status
ORDER BY 1, s.status;

-- Total de ventas simuladas existentes.
SELECT
    COUNT(*) AS total_ventas_simuladas,
    COUNT(*) FILTER (WHERE status = 'COMPLETADA') AS completadas,
    COUNT(*) FILTER (WHERE status = 'ANULADA') AS anuladas
FROM erp.sales
WHERE sale_number LIKE 'SIM-%';
