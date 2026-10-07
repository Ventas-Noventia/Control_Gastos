# Avisos de vencimiento y detalle de indicadores

## Instalación sobre la versión de periodos

1. Copia el contenido del ZIP de actualización sobre la carpeta del proyecto.
2. Si publicas el proyecto, sube también los archivos actualizados.
3. Recarga con **Cmd + Shift + R**.

Esta actualización no requiere una nueva migración SQL ni volver a desplegar `control-admin`. Usa la base ya instalada, incluida la migración 05 para periodos de gastos. El parche conserva `assets/js/config.js` y no incluye cambios de login o autenticación.

## Avisos

En Pendientes, Gastos fijos y Cuadre aparece un aviso cuando hay registros abiertos vencidos, con vencimiento hoy o dentro de los próximos 7 días. La lista se ordena por fecha y, a igualdad de fecha, por prioridad alta. En Cuadre incluye ambos tipos; en las otras páginas muestra los registros de esa sección.

El aviso usa la fecha real de Ciudad de México y pagos realizados hasta hoy; no cambia al consultar otro periodo histórico o futuro. Los registros eliminados, los pendientes completados y los pagos cubiertos no aparecen. Un pendiente sin importe puede seguir requiriendo atención hasta que se finalice. Los pagos parciales mantienen el aviso por el saldo faltante. Las programaciones pausadas no generan nuevos vencimientos; sus vencimientos anteriores sin cubrir pueden seguir apareciendo.

El botón **Ver vencimientos** muestra la lista completa. En Pendientes, **Ver pendiente** abre su detalle; **Dar prioridad**, disponible solo para administradores, abre la edición con prioridad alta seleccionada. Hay que **guardar** para aplicar el cambio; cancelar conserva la prioridad anterior. Los gastos se priorizan por cercanía del vencimiento; no se añade un campo de prioridad a los gastos.

Los avisos son dentro de la aplicación: aparecen al abrirla y se actualizan al guardar, pagar, actualizar o volver a la ventana. Si queda abierta al cambiar de día, se recalculan con la nueva fecha. No envían correos ni notificaciones del navegador.

## Indicadores interactivos

Cada tarjeta relevante tiene **Ver detalle** y abre un modal con búsqueda y páginas de 20 registros. Las cifras y listas conservan el alcance que indica cada tarjeta, aunque el filtro de la tabla principal sea diferente.

| Página       | Indicadores con detalle                                                     |
| ------------ | --------------------------------------------------------------------------- |
| Pendientes   | Activos, por cubrir, fuera de fecha y completados                           |
| Gastos fijos | Gastos registrados, programado, pagado de lo programado y por cubrir        |
| Ingresos     | Ingresos del mes, entradas del mes y total de la consulta                   |
| Cuadre       | Saldo al inicio, ingresos recibidos, pagos realizados y saldo final de caja |
| Usuarios     | Usuarios registrados, administradores activos y cuentas de consulta activas |

En Cuadre también puedes abrir el detalle de **Programado**, **Por cubrir** y **Ver cálculo** del saldo proyectado. Los saldos muestran los movimientos que los forman, con egresos negativos; el saldo proyectado explica saldo final menos compromisos por cubrir. Es informativo y no registra pagos.

Las cuentas de consulta pueden ver indicadores y avisos financieros sin editar. Usuarios mantiene el acceso exclusivo de administradores. Las listas vacías muestran un mensaje; al cerrar se vuelve al botón que abrió el modal cuando sigue disponible.

## Validación local

`node tests/finanzas.test.mjs` comprueba los cálculos existentes; `node tests/alertas.test.mjs` verifica el límite de 7 días, pagos parciales y totales, registros completados/eliminados, programación pausada y recurrencia bimestral. Las pruebas de navegador validan los modales, cifras, búsqueda, paginación, teclado, prioridad, permisos y adaptación a móvil con un servicio de prueba; no usan tu cuenta real de Supabase.
