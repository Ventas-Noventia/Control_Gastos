# Noventia · Responsables, estados y evidencias

Esta actualización registra quién crea, modifica y finaliza cada pendiente, usando la sesión validada por Supabase. Agrega estados visibles para los gastos y evidencia opcional en el gasto y en sus pagos.

## Instalar sobre tu proyecto actual

1. Descomprime `Actualizacion_Responsables_Estados_Evidencias_Noventia.zip` y copia su contenido dentro de tu carpeta actual, junto a `pendientes.html`. Reemplaza los archivos coincidentes. El ZIP de actualización **no incluye `assets/js/config.js`**.
2. En el **SQL Editor de tu mismo proyecto de Supabase**, ejecuta completo `database/04_responsables_estados_y_evidencias.sql`.
3. Abre el sitio y recarga con **⌘ + Shift + R**. Si tienes una versión publicada, actualiza también sus archivos.

El SQL 04 conserva los pendientes, gastos, pagos, usuarios y saldos existentes. Se puede repetir. **No vuelvas a ejecutar el SQL 01 ni el 02.** Para una instalación nueva, usa la secuencia del LEEME. Esta mejora no requiere volver a publicar `control-admin`; la activación anterior de gestión de usuarios sigue siendo independiente.

## Responsables del pendiente

La lista muestra **Creó** y, al completarse, **Finalizó**. Haz clic en el nombre del pendiente para ver el detalle, la última modificación y la actividad con fechas y horas de Ciudad de México.

- El creador queda fijo aunque otro administrador lo edite.
- Una tarea con importe 0 se finaliza al seleccionar **Completado**.
- Un pendiente con importe se finaliza al registrar el pago que cubre todo el importe. Se atribuye al usuario que realizó esa operación.
- Corregir una nota de un pendiente ya pagado conserva a su finalizador.
- Editar o eliminar un pago puede reabrir el pendiente. La finalización anterior sigue en la actividad; una nueva finalización registra al usuario que la realiza.
- Cambiar el importe también puede completar o reabrir un pendiente, según sus pagos.
- Los nombres se conservan tal como estaban al realizar la operación, incluso si después se cambia el nombre o se elimina la cuenta.

La identidad, la fecha y la hora se asignan en la base de datos. No se selecciona un responsable en el formulario ni se aceptan nombres o identificadores de responsable enviados por el navegador.

Los registros anteriores muestran **Sin registro previo** donde no se conoce el usuario: la versión anterior no guardaba esos responsables. No se inventa un creador ni una fecha de finalización. Sus movimientos financieros se conservan y los cambios nuevos comienzan a registrarse al activar el SQL 04.

La actividad incluye creación, edición, finalización, reapertura, eliminación y registro, edición o eliminación de pagos. Muestra 25 eventos por página y permite cargar más. El rol consulta puede leer los responsables y la actividad, pero no modificarlos. El CSV de pendientes también incluye responsables y fechas.

## Estados del gasto

Cada vencimiento muestra su estado:

| Estado       | Condición                                                                              |
| ------------ | -------------------------------------------------------------------------------------- |
| A tiempo     | La fecha todavía no pasó y no tiene pagos.                                             |
| Vencido      | Pasó la fecha y todavía queda dinero por cubrir. También puede tener abonos parciales. |
| Pago parcial | Tiene abonos, queda saldo y la fecha todavía no pasó.                                  |
| Pagado       | Los pagos cubren el importe del vencimiento.                                           |

En **Mis gastos recurrentes**, la programación (activo, pausado o programado) aparece separada del **Estado del periodo**. Este último resume los vencimientos del rango seleccionado, indica cuántos están pagados y se puede filtrar. **Sin vencimiento** significa que ese gasto no vence en el periodo consultado.

Desde los vencimientos puedes **Registrar pago**, **Editar último pago** o **Eliminar último pago**, con confirmación. Para revisar todos los abonos, usa Cuadre. Los estados se actualizan con esas operaciones y la fecha; no se cambia un gasto a pagado sin registrar su salida de dinero.

El cuadre mantiene el saldo de caja basado en ingresos y pagos realizados. Lo que sigue sin pagarse aparece en **Por cubrir** y en la proyección. Cambiar o eliminar un pago recalcula ambos. Las consultas anteriores respetan su fecha de corte: un pago posterior no se cuenta en ese cierre.

## Evidencia opcional

Puedes adjuntar **PNG, JPG, WEBP o PDF de hasta 5 MB** al crear o editar un gasto fijo y al registrar o editar un pago, tanto de gastos fijos como de pendientes. Guardar sin archivo funciona normalmente.

- **Evidencia del gasto:** por ejemplo, contrato, recibo o documento del servicio. No registra un pago.
- **Evidencia del pago:** comprobante de la salida de dinero. Se muestra en el vencimiento y en Cuadre.
- **Ver evidencia:** abre una vista previa de imágenes o un enlace para abrir el PDF.
- **Quitar evidencia actual:** retira el archivo del registro; no altera su importe, estado ni saldo.

Los archivos se guardan en un depósito privado llamado `control-evidence`. Solo cuentas activas pueden solicitar su visualización; solo admin puede subir y vincular archivos. Los enlaces de visualización son temporales. La actividad de un pendiente conserva las referencias a comprobantes anteriores cuando se cambia o se retira su evidencia. Las subidas fallidas se limpian cuando los permisos lo permiten; la base impide borrar un archivo que sí quedó vinculado.

La exportación CSV indica si hay evidencia, sin publicar enlaces privados. El PDF del cuadre sigue siendo el reporte financiero; no incrusta las imágenes o los comprobantes.

## Comprobaciones

Se probaron dos administradores distintos, conservación del creador, atribución del cierre, cambios de importe, pagos parciales y totales, reaperturas, eliminación de cuentas, repetición del SQL, permisos de consulta y anónimo, protección del historial y reglas del depósito privado. Se verificaron formularios, evidencias opcionales, corrección de pagos y diseño en Chromium. Las pruebas locales simulan Auth y Storage; esta entrega no ejecuta la migración en tu Supabase.

Documentación oficial: [permisos de Storage](https://supabase.com/docs/guides/storage/security/access-control), [enlaces temporales](https://supabase.com/docs/reference/javascript/storage-from-createsignedurl).
