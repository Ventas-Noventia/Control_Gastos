# Periodos de gastos fijos y ayuda sobre las fechas

## Actualizar tu instalación

1. Copia el contenido del ZIP de actualización sobre la carpeta de tu proyecto. Conserva tu `assets/js/config.js`: el parche no lo incluye.
2. En Supabase → SQL Editor ejecuta completo `database/05_periodos_gastos.sql`. Requiere la migración 04 de responsables y evidencias ya instalada. Es repetible y conserva tus registros.
3. Si el proyecto está publicado, sube los archivos actualizados. Recarga con **Cmd + Shift + R**.

No ejecutes nuevamente el esquema 01 ni la activación 02 en una instalación existente. No necesitas volver a desplegar `control-admin`.

## Frecuencias y fechas

- **Quincenal:** dos pagos por mes, en los días de cada quincena que elijas; no equivale a cada 15 días exactos.
- **Mensual:** un pago cada mes, en el día elegido.
- **Bimestral:** un pago cada dos meses, en el día elegido. El mes de referencia determina el ciclo: enero/marzo/mayo… o febrero/abril/junio…; se repite también al cambiar de año.
- **Anual:** un pago al año en el mes y día elegidos.
- **Semanal:** sigue disponible y mantiene las programaciones existentes.

**Inicio** es desde cuándo pueden generarse vencimientos. **Fecha límite** es el día de pago de cada vencimiento, no una fecha de fin del gasto. Por ejemplo: un gasto inicia el 5 de enero, con día de pago 20 y frecuencia bimestral desde enero; vence el 20 de enero, el 20 de marzo y así sucesivamente. Si inicia el 25 de enero, su primer vencimiento será el 20 de marzo.

Los botones de información en el modal explican la diferencia al pasar el cursor, enfocarlos con el teclado o tocarlos. El botón de cierre oculta la ayuda junto con el modal.

Si el día no existe, se usa el último día del mes: un pago anual de febrero con día 29 vence el 28 en años no bisiestos y el 29 en años bisiestos. Las ediciones usan **Aplicar cambios desde** y conservan los vencimientos y costos anteriores.

En **Gastos fijos** puedes consultar vencimientos por quincena, mes, bimestre o año; semana sigue disponible. Los bimestres de consulta son enero–febrero, marzo–abril, etc. El calendario de pagos depende del mes de referencia del gasto, aunque el bimestre consultado sea otro. El cuadre incluye los nuevos vencimientos dentro de los rangos que ya ofrece, incluido su rango personalizado; registrar/editar/eliminar pagos conserva el cálculo de caja, estados y saldos pendientes.

Los periodos de Pendientes y la autenticación no cambian. El parche no incluye `login.html`, `login.js`, `auth.js` ni `config.js`.
