# ADR 0002 — Archivado DocuWare: bugs de payload (resueltos) + campo Int32 que no soporta números de documento SAP reales

## Estado

Parcialmente resuelto. Tres bugs reales de payload corregidos en código; queda
un bloqueo pendiente de configuración del archivador en DocuWare QA (no es un
bug nuestro).

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

## Problema 4 (PENDIENTE, no es bug nuestro) — El campo `NUMERO_DE_DOCUMENTO_CONTABLE` está tipado como Int32 y no soporta números de documento SAP reales

Con los tres bugs anteriores resueltos, el archivado funciona end-to-end
**solo si `numeroDocumentoSap` es un número pequeño** (probado con `"45000"`
→ `codigoerror: 0`, `dwdocid` asignado). Con un número de documento SAP
**real** (`"6000025360"`, el que efectivamente devuelve la contabilización en
QA — ver ADR 0001), el archivado falla con:

```
"No se pudo almacenar el documento. Mensaje Original: 422 Unprocessable Entity
(The value '6000025360' field 'NUMERO_DE_DOCUMENTO_CONTABLE' could not be
converted to type 'Int'. The reason is: Value was either too large or too
small for an Int32.)"
```

`6.000.025.360` supera el máximo de un entero de 32 bits (`2.147.483.647`).
Los números de documento SAP reales observados en QA (`6000025359`,
`6000025360`) están consistentemente en el rango de ~6 mil millones, es decir
**este bloqueo ocurrirá en el 100% de los archivados reales**, no es un caso
aislado. El campo está definido como `Int32` en el archivador de DocuWare del
lado de Comfama; no es algo que el payload pueda evitar sin corromper el dato
real (truncar o reformatear el número de documento SAP sería falsificar
información contable).

## Decisión

1. Los tres bugs de payload (1, 2 y 3) quedan **corregidos en código**.
2. El Problema 4 **no se corrige en el código de la app**: cambiar el número
   real de documento SAP para que quepa en un Int32 falsificaría el dato. Se
   documenta acá para que el equipo de Comfama/DocuWare ajuste el tipo del
   campo `NUMERO_DE_DOCUMENTO_CONTABLE` en el archivador (a texto o a un
   entero de mayor precisión, p. ej. Int64/BigInt).
3. El archivado sigue siendo **no bloqueante**: si DocuWare rechaza el
   documento por este motivo, la aprobación en SAP y el resto del flujo
   continúan; el error queda visible en el historial (Gestor y `/history`)
   con el mensaje real de DocuWare.

## Consecuencias

- Mientras el campo siga tipado como Int32, **ningún archivado real
  tendrá éxito** en QA — solo se pudo confirmar el resto del flujo con un
  número de documento de prueba pequeño.
- El equipo de integraciones/DocuWare debe confirmar el cambio de tipo del
  campo `NUMERO_DE_DOCUMENTO_CONTABLE` (y verificar si `IDDOCUMENTO_SAP`, que
  recibe el mismo valor, tiene el mismo problema — no se pudo confirmar
  porque el fallo ocurre en el primer campo numérico de la lista).
- Cuando se resuelva, reverificar el flujo completo contra QA con un número
  de documento SAP real (`/gestor` → aprobar → contabilizar → archivar →
  `dwdocid` real).

## Referencias

- `apps/api/src/lib/server/docuware.ts` — `archiveDocument`, `parseBody`,
  `extractDocumentId`, `buildCampos`.
- `apps/web/src/features/legalizacion/GestorPage.tsx` — `archiveDocToDocuware`,
  flujo de aprobación (`handleApprove`).
- [ADR 0001](./0001-sap-acreedor-esporadico-no-registrado.md) — origen del
  número de documento SAP real usado para reproducir este bloqueo.
