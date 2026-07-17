# ADR 0001 — Contabilización SAP: formato de NIT, importes por impuesto y bloqueo de CeCo

## Estado

Parcialmente resuelto. Dos bugs reales de payload corregidos en código; queda
un bloqueo pendiente del lado de SAP QA (no es un bug nuestro).

## Contexto

Al aprobar una legalización en `/gestor`, el front arma el documento SAP
(`buildSapContabilizacionPayload`, `apps/web/src/features/legalizacion/lib/sap.ts`)
y lo envía vía `POST /api/contabilizacion` (`apps/api/src/lib/server/sap.ts`,
`postContabilizacion`).

El `POST` a SAP (`.../TRA-FIN-ContabilizacionLegados/FI/Contabilizacion`)
responde `200 OK` con un `req_id` y advertencias (`tipo: "W"`), pero SAP
procesa la contabilización de forma **asíncrona**. Para saber si realmente se
contabilizó hay que consultar `GET /api/contabilizacion?numDocExterno=...`
(`getContabilizacion`), cuya respuesta trae `documentos[]` (más reciente
primero) con `status: "OK"` + `num_doc` si tuvo éxito, o `status` de error
(visto en QA: `"EI"`, `"ED"`) + `mensajes` (tipo `"E"`) si falló.

## Bug 1 (RESUELTO) — El NIT de persona jurídica necesita el dígito de verificación CONCATENADO, sin guion

Primeros intentos con NIT `900064236` (persona jurídica, `tipo_id: "CO1N"`)
fallaban con:

```
"Error numero de identificacion 900064236 con tipo de identificación CO1N no existe"
```

Se probó agregar el dígito de verificación (DV, algoritmo módulo 11 de la
DIAN) con guion: `"900064236-0"`. **Mismo error, sin cambios.** Solo al enviar
el NIT + DV **concatenados sin separador** (`"9000642360"`) el error de
identificación desapareció por completo. Conclusión: SAP compara
`n_identificacion` contra la llave de datos maestros como un solo número, sin
guion.

Fix aplicado en `formatNitForSap` (`apps/web/src/features/legalizacion/lib/sap.ts`):
NIT de persona jurídica (PJ) se envía como `${nit}${dv}` (sin guion) en
`n_identificacion`, `numero_id`, `asignacion` y `referencia_1`. Persona natural
(cédula) no lleva DV y se envía tal cual.

**Nota**: el caso de persona natural con NIT `20993427` ("El acreedor 20993427
CF01 no existe.") se probó ANTES de este hallazgo y no se ha reintentado desde
entonces. Si vuelve a fallar tras el fix, sí sería un problema de datos
maestros genuino (cédula no registrada), ya que las cédulas no llevan DV DIAN.

## Bug 2 (RESUELTO) — Las líneas de `ctas_de_mayor` deben llevar el TOTAL del concepto (base + impuesto), no solo la base

Con el NIT ya corregido, apareció un nuevo error:

```
"Interfase RW: Saldo en moneda de transacción" ... "852.865- COP"
"Error no genero documento contable en SAP $."
```

`852.865` es exactamente `716.300 (IVA 19%) + 136.565 (INC 8%)` — el
documento quedaba descuadrado por el valor de los impuestos. Causa: cada
posición de `ctas_de_mayor` llevaba solo la **base gravada** del concepto
(`importes_ctas_de_mayor.importe_moneda_documento`), asumiendo que SAP
calculaba el impuesto automáticamente a partir de `indicador_iva`. **SAP NO
hace ese cálculo automático en `clave_contabilizacion: "40"`**: cada posición
debe llevar el TOTAL del concepto (base + su impuesto), igual a como aparece
la columna "Total" en la factura original (p.ej. "ALOJAMIENTO GRAVADO ...
Total 4.486.300,00").

Fix aplicado en `buildTaxLines` (`apps/web/src/features/legalizacion/lib/sap.ts`):
cada `TaxLine.importe` ahora es `base + valor` del impuesto correspondiente,
no solo la base. La suma de todas las posiciones de `ctas_de_mayor` ahora
cuadra exactamente con el total del acreedor.

## Problema 3 (PENDIENTE, no es bug nuestro) — CeCo bloqueado para la fecha de contabilización

Con los dos bugs anteriores corregidos, el intento más reciente en QA falló
con un error distinto:

```
"El CeCo CFMA/10104000 está bloqueado el 17.07.2026 para contab. primarias."
```

Esto es un bloqueo de configuración/periodo en SAP (el centro de costo no
acepta contabilizaciones primarias en esa fecha), no algo que el payload
pueda evitar. `fecha_contabilizacion` se manda como la fecha de hoy
(`apps/web/src/features/legalizacion/lib/sap.ts`, `formatSapDate`).

## Decisión

1. Los dos bugs de payload (Bug 1 y Bug 2) quedan **corregidos en código**.
2. El front sigue **detectando y mostrando** el error real de SAP (vía
   `interpretSapConsulta` en `apps/api/src/lib/server/sap.ts`) en vez de
   fallar en silencio. La legalización queda marcada como fallida y el gestor
   puede reintentar.
3. El bloqueo del CeCo (Problema 3) **no se investiga ni se corrige** en esta
   iteración — es una configuración de SAP QA (periodo/CeCo), no del payload.
   Se documenta acá para no perder el contexto.

## Consecuencias

- Falta reconfirmar en QA que una factura completa (persona jurídica CON los
  dos fixes) llegue a `status: "OK"` + `num_doc` una vez el CeCo deje de estar
  bloqueado (o probando con un CeCo/fecha distintos).
- Falta reintentar el caso de persona natural (NIT 20993427) para confirmar si
  su "acreedor no existe" sigue siendo un problema de datos maestros genuino
  o si también era de formato.
- El equipo de integraciones/SAP debe confirmar por qué el CeCo `10104000`
  está bloqueado para `17.07.2026` (periodo cerrado, configuración pendiente,
  o restricción específica de QA).

## Referencias

- `apps/web/src/features/legalizacion/lib/sap.ts` — `formatNitForSap`,
  `nitCheckDigit`, `buildTaxLines`, arma el payload SAP.
- `apps/api/src/lib/server/sap.ts` — `postContabilizacion`, `getContabilizacion`,
  `interpretSapConsulta`.
- `apps/api/src/routes/contabilizacion.ts` — expone `sapEstado`/`sapErrores`.
- `apps/web/src/features/legalizacion/GestorPage.tsx` — flujo de aprobación
  (`handleApprove`) y el historial de decisiones.
