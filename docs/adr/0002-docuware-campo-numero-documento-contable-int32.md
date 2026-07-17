# ADR 0002 — Archivado DocuWare: bugs de payload + campo Int32 que no soporta números de documento SAP reales

## Estado

Resuelto (con workaround explícito para los campos Int — ver Problemas 4 y 5).
Verificado end-to-end contra QA con un número de documento SAP real y un monto
real en formato colombiano.

## Contexto

Al aprobar una legalización en `/gestor`, tras contabilizar en SAP, el front
archiva cada soporte en DocuWare vía el gateway Comfama
(`archiveDocument`/`archiveDocToDocuware`, `apps/api/src/lib/server/docuware.ts`
+ `apps/web/src/features/legalizacion/GestorPage.tsx`).

El endpoint es `POST .../TRA-SC-GestionDocumentos/api/documento/almacenardocumentobytearray`.

## Bug 1 (RESUELTO) — Falta el campo `nombreDocumento`

El primer intento fallaba con:

```
"El documento no tiene nombre!."
```

Se probó envolver la parte `documento` en un `Blob` con `filename` (multipart
estándar), pero el error persistió idéntico. Comparando contra un curl de
referencia que sí funciona (`codigoerror: 0`), se descubrió que el gateway no
lee el nombre del `filename` de la parte multipart: **exige un campo de
formulario separado llamado `nombreDocumento`**, que no se estaba enviando.

Fix aplicado en `archiveDocument` (`apps/api/src/lib/server/docuware.ts`):
se agrega `form.append("nombreDocumento", input.fileName)`.

## Bug 2 (RESUELTO) — `documento` debe ir como texto base64 plano, no como Blob binario

Relacionado con el bug 1: el intento de arreglarlo envolviendo `documento` en
un `Blob` con los bytes decodificados (`new Blob([bytes])`, como sugería un
comentario heredado de la migración) producía el mismo error de nombre, y
luego un `NullReferenceException` genérico. El curl de referencia confirma
que `documento` va como **campo de texto normal** con el base64 crudo
(`--form 'documento="JVB..."'`), igual que antes de intentar "arreglarlo" con
Blob. El endpoint `almacenardocumentobytearray` decodifica el base64
internamente en el servidor .NET; no espera el binario ya decodificado desde
el cliente.

Fix aplicado: `form.append("documento", normalizeBase64(input.fileBase64))`
como string, sin Blob ni filename en esa parte.

## Bug 3 (RESUELTO) — `documentId` no se extraía de la respuesta (doble JSON-encoding)

Con los dos bugs anteriores corregidos, el archivado ya devolvía
`codigoerror: 0` (éxito), pero `documentId` salía `null` en nuestra respuesta
pese a que el gateway sí devuelve `dwdocid`. Causa: el gateway responde con el
body **doblemente codificado como JSON** — el texto crudo de la respuesta es
una cadena JSON que a su vez contiene el objeto real (`"{\"codigoerror\":0,...}"`).
Un solo `JSON.parse` produce un `string`, no un objeto, así que
`extractDocumentId` (que solo recorre objetos) nunca encontraba nada.

Fix aplicado en `parseBody` (`apps/api/src/lib/server/docuware.ts`): si el
primer `JSON.parse` da como resultado un `string`, se intenta parsear una
segunda vez para desanidarlo. También se agregó `dwdocid` a `ID_KEYS` (la
clave real que usa este endpoint, distinta de las genéricas que ya cubríamos).

## Problema 4 (WORKAROUND aplicado) — El campo `NUMERO_DE_DOCUMENTO_CONTABLE` está tipado como Int32 y no soporta números de documento SAP reales

Con los tres bugs anteriores resueltos, el archivado funcionaba end-to-end
**solo si `numeroDocumentoSap` era un número pequeño** (probado con `"45000"`
→ `codigoerror: 0`, `dwdocid` asignado). Con un número de documento SAP
**real** (`"6000025360"`, el que efectivamente devuelve la contabilización en
QA — ver ADR 0001), el archivado fallaba con:

```
"No se pudo almacenar el documento. Mensaje Original: 422 Unprocessable Entity
(The value '6000025360' field 'NUMERO_DE_DOCUMENTO_CONTABLE' could not be
converted to type 'Int'. The reason is: Value was either too large or too
small for an Int32.)"
```

`6.000.025.360` supera el máximo de un entero de 32 bits (`2.147.483.647`).
Los números de documento SAP reales observados en QA (`6000025359`,
`6000025360`) están consistentemente en el rango de ~6 mil millones, es decir
**este bloqueo ocurría en el 100% de los archivados reales**, no era un caso
aislado. El campo está definido como `Int32` en el archivador de DocuWare del
lado de Comfama, no es algo que el payload pudiera evitar sin tocar el valor.

**Decisión de negocio explícita**: en vez de bloquear el archivado mientras
Comfama ajusta el tipo del campo, se **recorta** `NUMERO_DE_DOCUMENTO_CONTABLE`
a sus últimos 9 dígitos (`truncateForInt32Field`, `apps/api/src/lib/server/docuware.ts`)
— 9 dígitos (`999.999.999`) siempre caben en un Int32. `IDDOCUMENTO_SAP` (texto,
sin este límite) sigue recibiendo el número completo sin recortar, así que el
número real de documento SAP no se pierde, solo queda truncado en el campo
Int32 del archivador. Verificado con el número real `6000025360` → `codigoerror: 0`,
`dwdocid` asignado.

De paso, los campos que la app no tenía forma de poblar con datos reales
(`LIBRO_DE_CAJA`, `CODIGO_DEL_TIPO_DOCUMENTAL`, `DESCRIPCION_TIPO_DOCUMENTAL`,
`DIGITADOR`, `USUARIO_SAP`, `NRODOCUMENTO`, `IDENTIFICADOR_SAP`) pasaron de ir
vacíos a rellenarse con **datos aleatorios no vacíos** (`randomPlaceholders`),
por si el archivador los trata como obligatorios — decisión de negocio para
priorizar velocidad de entrega (hackathon) sobre esperar la fuente real de
cada campo.

## Problema 5 (WORKAROUND aplicado) — El campo `VALOR_DE_COMPROBANTE` también es Int y rechaza el formato colombiano

Con el Problema 4 resuelto, el siguiente intento con un monto real falló con:

```
"No se pudo almacenar el documento. Mensaje Original: 422 Unprocessable Entity
(The value '6.329.928,00' field 'VALOR_DE_COMPROBANTE' could not be converted
to type 'Int'. The reason is: Input string was not in a correct format.)"
```

Mismo patrón que el Problema 4 pero por formato, no por rango: `VALOR_DE_COMPROBANTE`
también es un campo Int, y se le enviaba el monto tal como lo extrae la IA —
formato colombiano con punto de miles y coma decimal (`"6.329.928,00"`), que
.NET no reconoce como número.

**Fix aplicado**: `parseAmountToInt` (`apps/api/src/lib/server/docuware.ts`)
limpia el formato colombiano (quita puntos de miles, cambia la coma decimal
por punto) y redondea a entero plano antes de enviarlo, espejando la lógica
de `parseAmount` del store del frontend. Verificado con el monto real
`"6.329.928,00"` → `codigoerror: 0`, `dwdocid` asignado.

## Decisión

1. Los tres bugs de payload (1, 2 y 3) quedan **corregidos en código**.
2. Los Problemas 4 y 5 se resuelven con **workarounds explícitos**: recorte a
   9 dígitos de `NUMERO_DE_DOCUMENTO_CONTABLE`, conversión de formato
   colombiano a entero plano en `VALOR_DE_COMPROBANTE`, y placeholders
   aleatorios en los campos sin fuente real. Son decisiones de negocio
   conscientes (priorizar shipeo rápido), no descuidos — el equipo de
   Comfama/DocuWare debería igual ajustar el tipo del campo
   `NUMERO_DE_DOCUMENTO_CONTABLE` (a texto o Int64/BigInt) para no perder
   dígitos del número real, y definir de dónde deberían salir los campos hoy
   aleatorios.
3. El archivado sigue siendo **no bloqueante**: si DocuWare rechaza el
   documento por cualquier otro motivo, la aprobación en SAP y el resto del
   flujo continúan; el error queda visible en el historial (Gestor y
   `/history`) con el mensaje real de DocuWare.

## Consecuencias

- `NUMERO_DE_DOCUMENTO_CONTABLE` queda **truncado** en DocuWare (solo los
  últimos 9 dígitos del número real de SAP); el número completo sigue
  disponible en `IDDOCUMENTO_SAP` y en el propio store de la app
  (`sapContabilizacion.numeroDocumento`), así que no hay pérdida de dato fuera
  de ese campo específico del archivador.
- `VALOR_DE_COMPROBANTE` queda como entero **sin decimales** (los centavos, si
  los hubiera, se pierden por redondeo) — aceptable para montos en pesos
  colombianos, que no suelen manejar fracciones de peso.
- Los 7 campos con placeholder aleatorio (ver Problema 4) no reflejan datos
  reales de negocio; si en el futuro el archivador exige trazabilidad real en
  esos campos (p. ej. auditorías), hay que reemplazar `randomPlaceholders()`
  por fuentes reales (usuario SAP autenticado, digitador, tipo documental
  real, etc.).
- El equipo de integraciones/DocuWare debería igual confirmar el cambio de
  tipo de `NUMERO_DE_DOCUMENTO_CONTABLE` (y revisar si otros campos numéricos
  del archivador tienen el mismo problema de formato/rango) para eliminar la
  necesidad de estos workarounds.

## Referencias

- `apps/api/src/lib/server/docuware.ts` — `archiveDocument`, `parseBody`,
  `extractDocumentId`, `buildCampos`.
- `apps/web/src/features/legalizacion/GestorPage.tsx` — `archiveDocToDocuware`,
  flujo de aprobación (`handleApprove`).
- [ADR 0001](./0001-sap-acreedor-esporadico-no-registrado.md) — origen del
  número de documento SAP real usado para reproducir este bloqueo.
