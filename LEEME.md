# Noventia · Pendientes y gastos

Proyecto independiente con **HTML, CSS y JavaScript**, Bootstrap 5 y base de datos PostgreSQL en Supabase. Cada módulo tiene su propia página y su propio archivo JavaScript. El login usa correo y contraseña con Supabase Auth.

El proyecto viene listo para configurar tu base de datos. No incluye cuentas, contraseñas ni credenciales de un proyecto ya conectado.

## Instalación

### 1. Crea la base de datos

1. Crea un proyecto nuevo en [Supabase](https://supabase.com/dashboard).
2. Abre **SQL Editor** y ejecuta todo el archivo `database/01_esquema_y_permisos.sql` una sola vez.
3. Espera a que termine correctamente. El script crea las tablas, las funciones, los permisos y el disparador que registra el perfil de cada cuenta nueva.

Usa un proyecto nuevo para este sistema. El script no borra tablas existentes, pero tampoco es una migración para ejecutarse repetidamente.

### 2. Configura la conexión

En el panel de tu proyecto copia la **Project URL** y la **Publishable key**; también funciona la clave pública `anon` de proyectos que usan las claves anteriores.

Edita `assets/js/config.js`:

```js
export const SUPABASE_URL = "https://TU_PROYECTO.supabase.co";
export const SUPABASE_ANON_KEY = "TU_CLAVE_PUBLICA";
export const APP_NAME = "Noventia";
```

La clave del navegador debe ser pública: **publishable o anon**. Las claves `service_role` y `sb_secret_…` son privadas y nunca deben ponerse en HTML o JavaScript del navegador. Los permisos de cada usuario se aplican en PostgreSQL.

### 3. Crea la primera cuenta admin

1. En Supabase entra a **Authentication → Users → Add user**.
2. Crea un usuario con tu correo y una contraseña. Marca el correo como confirmado si el panel ofrece esa opción.
3. Abre `database/02_activar_administrador.sql` y sustituye `TU_CORREO_ADMIN@empresa.com` por ese correo.
4. Ejecuta ese archivo en SQL Editor. Comprueba que la consulta final muestra `role = admin` y `active = true`.

El registro público no forma parte de este sistema. Desactiva las altas públicas en la configuración de Authentication de Supabase y crea las cuentas desde **Usuarios** después de activar la función descrita en el siguiente paso. Las cuentas creadas directamente en Auth comienzan desactivadas y con rol consulta. Desde Usuarios, el administrador asigna su rol y estado al crearlas.

### 4. Activa usuarios, fotos y marca

Ejecuta `database/03_usuarios_fotos_y_marca.sql` y publica la Edge Function `control-admin` siguiendo los pasos 2 y 3 de **[ACTUALIZACION_USUARIOS_Y_MARCA.md](ACTUALIZACION_USUARIOS_Y_MARCA.md)**. Es código JavaScript que se ejecuta en Supabase; permite administrar cuentas y contraseñas sin poner claves privadas en el navegador.

### 5. Activa responsables y evidencias

Ejecuta completo `database/04_responsables_estados_y_evidencias.sql`. Registra los responsables desde la sesión y crea el depósito privado de evidencias. Para actualizar una instalación existente, sigue **[ACTUALIZACION_RESPONSABLES_ESTADOS_Y_EVIDENCIAS.md](ACTUALIZACION_RESPONSABLES_ESTADOS_Y_EVIDENCIAS.md)**.

### 6. Activa periodos bimestrales y anuales

Ejecuta `database/05_periodos_gastos.sql` después de la migración 04. Consulta [ACTUALIZACION_PERIODOS_GASTOS.md](ACTUALIZACION_PERIODOS_GASTOS.md) para actualizar una instalación existente.

### 7. Abre la aplicación

1. Descomprime el ZIP completo y abre su carpeta en Visual Studio Code.
2. Con una extensión de servidor estático como **Live Server**, abre `login.html`.
3. Ingresa con el correo y la contraseña del administrador que creaste.

También puedes usar cualquier servidor estático. Si ya tienes Python instalado, ejecuta desde la carpeta del proyecto:

```sh
python -m http.server 8000
```

Y abre `http://localhost:8000/login.html`. En algunos equipos el comando es `python3`.

Los módulos JavaScript necesitan que las páginas se sirvan por HTTP o HTTPS; abrir los HTML con doble clic como `file://` no basta. El sistema necesita internet para Supabase y las librerías de Bootstrap. El sitio no requiere compilación ni un servidor propio de Node, PHP o Python en producción; usa Supabase para la base y la función de usuarios. El CLI se usa solo para publicar esa función: puedes subir la carpeta a un hosting estático con HTTPS.

## Identidad de Noventia

La paleta usa los colores del logo: azul marino `#002654`, turquesa `#00B8D5` y coral `#FE7555`. El azul se utiliza en botones y navegación, el turquesa en acentos y selecciones, y el coral en detalles. Las superficies claras y los tonos de texto mantienen la lectura legible.

El PNG original se conserva intacto en `assets/img/noventia-logo.png`. El logo aparece desde el HTML, incluido el login, aunque todavía no se haya configurado la marca en la base de datos. Sus márgenes transparentes se ajustan con una ventana de CSS. Para aplicar solo esta identidad a un proyecto existente, sigue `ACTUALIZACION_IDENTIDAD_NOVENTIA.md`.

## Usuarios y permisos

| Rol      | Puede hacer                                                                                                                                                                                |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Admin    | Crear, editar y eliminar pendientes, gastos fijos, ingresos y pagos; editar el saldo inicial; crear, editar y eliminar cuentas y contraseñas; personalizar la marca; consultar y exportar. |
| Consulta | Ver pendientes, gastos fijos, ingresos y cuadre; consultar periodos; exportar CSV e imprimir el cuadre.                                                                                    |

Para agregar a otra persona, entra a **Usuarios → Nuevo usuario**. Escribe nombre, correo, contraseña y confirmación, elige admin o consulta y, si quieres, sube una foto. Puedes crear la cuenta activa o desactivada. El correo se confirma al crearla; no se envían invitaciones.

Usa el lápiz para editar nombre, correo, foto, rol, acceso o contraseña. Al editar, deja la contraseña vacía para conservarla; la anterior nunca se muestra. La papelera elimina la cuenta después de confirmar y conserva sus movimientos financieros. Tu propia cuenta puede editar sus datos, pero conserva el acceso de administrador y no puede eliminarse desde aquí.

El logo original de Noventia ya viene incluido. En **Marca** puedes reemplazarlo, restaurarlo y cambiar el nombre de la empresa. Se muestran en el login y en el encabezado de todas las páginas. El menú de usuarios y marca es exclusivo de admin.

Pendientes muestra quién creó el registro y quién lo finalizó. Su detalle incluye la última modificación y un historial de actividad con el usuario y la hora de cada operación. Estos datos se generan desde la sesión en la base de datos. Los nombres históricos se conservan al editar o eliminar cuentas; los registros anteriores a la actualización muestran **Sin registro previo** donde no se conoce al responsable.

## Módulos

| Página              | Funcionalidad                                                                                                                                                    |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `login.html`        | Inicio de sesión con correo y contraseña.                                                                                                                        |
| `pendientes.html`   | Compras y compromisos con categoría seleccionable o nueva, importe, fecha, prioridad, estado, notas y hasta tres enlaces de compra. CRUD, pagos parciales y CSV. |
| `gastos-fijos.html` | Gastos semanales, quincenales o mensuales, vencimientos, pagos, pausas y cambios de costo con fecha de vigencia.                                                 |
| `ingresos.html`     | Entradas de dinero recibidas, fechas, notas, filtros, edición, eliminación y CSV.                                                                                |
| `cuadre.html`       | Saldo inicial, ingresos, pagos, compromisos, saldo de caja y proyección por periodo. CSV e impresión/PDF.                                                        |
| `usuarios.html`     | Creación, edición y eliminación de cuentas, fotos, contraseñas y permisos.                                                                                       |
| `marca.html`        | Nombre y logo compartidos para el login y los encabezados.                                                                                                       |

Las categorías predeterminadas son Luz, Agua, Gas, Internet, Telefonía, Cuentas de ChatGPT, Renta bazar, Renta almacén, Renta vivienda, Papelería, Insumos, Mantenimiento, Transporte, Combustible, Seguridad, Impuestos, Seguros, Servicios, Inmuebles, Despensa, Limpieza, Tecnología, Sueldos, Suscripciones y Otros.

En **Categoría**, abre el desplegable para ver las 25 categorías básicas y las categorías que ya has usado. Para usar un nombre nuevo, elige **+ Agregar nueva categoría…** al final de la lista y escribe en **Nueva categoría**. Al guardar un pendiente, gasto fijo o ingreso, su categoría queda en la base de datos y aparece en los desplegables de todos los formularios, incluso después de recargar. Al editar un registro se conserva su categoría actual. Para aplicar esta mejora a una instalación existente, sigue `ACTUALIZACION_CATEGORIAS.md`.

El menú se encuentra en la parte superior. En pantallas a partir de 1200 px muestra los enlaces horizontales; en tabletas y celulares, usa el botón de hamburguesa para abrirlos y cerrarlos. También puedes cerrar el menú con Escape. Para actualizar una instalación existente con este diseño y los selectores, sigue `ACTUALIZACION_MENU_SUPERIOR.md`.

La captura se abre en modales desde **Nuevo pendiente**, **Nuevo gasto fijo** y **Registrar ingreso**. Los botones aparecen visibles; para el rol consulta quedan deshabilitados con una explicación. En la lista vacía de pendientes también puedes usar **Agregar mi primer pendiente**. Para actualizar una instalación ya conectada, sigue `ACTUALIZACION.md`.

## Cómo funciona el cuadre

1. Registra en **Cuadre → Saldo inicial** el dinero disponible en la fecha en que empiezas a llevar el control. Si ya hay movimientos, la apertura debe tener una fecha igual o anterior al primer movimiento.
2. Registra ingresos cuando realmente recibas el dinero.
3. Registra los pagos desde Pendientes o desde los vencimientos de Gastos fijos. Puedes registrar pagos parciales y editar o eliminar un pago desde Cuadre.
4. Consulta una semana, una quincena, un mes o un rango personalizado de hasta 366 días.

El **saldo final de caja** es saldo anterior + apertura del periodo + ingresos recibidos − pagos realizados. Los pendientes y gastos programados se muestran por separado; el **saldo después de cubrir lo pendiente** descuenta los compromisos que siguen abiertos en el rango consultado. Los compromisos anteriores al rango elegido no se suman a esa proyección.

El saldo anterior incluye los movimientos de fechas anteriores. Los pagos posteriores al cierre de una consulta no se cuentan como pagados en ese corte. Los importes se guardan como centavos enteros; la moneda de esta versión es MXN.

Las semanas van de lunes a domingo. Las quincenas de consulta son del 1 al 15 y del 16 al último día del mes. Para cada gasto quincenal puedes escoger un día de cada mitad. Si un vencimiento mensual o de la segunda quincena está configurado para el día 31 y el mes termina antes, se usa el último día de ese mes. La fecha de hoy usa la zona `America/Mexico_City`, igual que las validaciones de PostgreSQL.

Al editar un gasto fijo, el costo, la periodicidad y la pausa se guardan con vigencia desde hoy o una fecha futura. Los vencimientos anteriores conservan la configuración anterior. El nombre y la categoría se actualizan en el catálogo; los pagos ya registrados conservan su concepto y categoría. Un cambio guardado con la misma fecha de vigencia sustituye la configuración de esa fecha.

Eliminar un pendiente o un gasto lo retira del catálogo activo. Sus pagos realizados permanecen en el cuadre. Eliminar un ingreso o un pago recalcula los saldos.

En Gastos fijos, cada vencimiento muestra **A tiempo**, **Vencido**, **Pago parcial** o **Pagado**. Un abono incompleto después del vencimiento sigue apareciendo como vencido. El catálogo separa la programación del gasto y el estado de sus vencimientos en el periodo consultado. Puedes filtrar ese estado y editar o eliminar el último pago directamente desde sus vencimientos; Cuadre permite revisar todos los pagos.

Al crear o editar un gasto o un pago puedes adjuntar una evidencia opcional en PNG, JPG, WEBP o PDF, de hasta 5 MB. Se guarda de forma privada y se abre desde **Ver evidencia**. Una evidencia por sí sola no registra dinero ni cambia el estado. El CSV indica su existencia sin exportar enlaces privados.

Un pendiente con importe mayor que cero se completa al cubrirlo con pagos. Para una tarea sin costo, usa importe 0 y cambia el estado a Completado.

## Exportación

- **CSV:** se abre en Excel, LibreOffice y otras hojas de cálculo. Pendientes e Ingresos exportan los resultados filtrados; Gastos fijos exporta el catálogo filtrado; Cuadre exporta resumen, movimientos y compromisos del rango seleccionado.
- **PDF:** en Cuadre pulsa **Imprimir / PDF** y elige **Guardar como PDF** en el diálogo del navegador. La impresión incluye movimientos y compromisos.

## Archivos y organización

Cada página carga su módulo en `assets/js/`. El CSS común está en `assets/css/styles.css`. Los módulos `auth.js`, `database.js`, `ui.js` y `finanzas.js` comparten autenticación, acceso a datos, controles y cálculos. La conexión editable vive en `config.js`. El código JavaScript de la función protegida está separado en `supabase/functions/control-admin/`. La migración 03 agrega las fotos y la marca sin borrar los datos existentes.

No hay React, TypeScript ni archivos de compilación. El frontend no necesita instalar paquetes; para publicar la función de usuarios se usa el CLI de Supabase. Bootstrap 5.3.8, Bootstrap Icons 1.13.1 y Supabase JS 2 se cargan desde CDN.

Los módulos `task-activity.js` y `evidence.js` separan la actividad de pendientes y los comprobantes del resto de las páginas. El SQL 04 agrega sus datos y permisos sin borrar información anterior.

## Comprobaciones realizadas

Se verificaron los cálculos de recurrencia, años bisiestos, historial de costos, cortes por fecha, arrastre de saldo, pagos parciales y reversión. La prueba JavaScript incluida se puede ejecutar, de manera opcional, con Node 22 o superior:

```sh
node tests/finanzas.test.mjs
```

El SQL también se ejecutó en PostgreSQL mediante PGlite, simulando las identidades de Supabase, para comprobar el esquema, los perfiles, las restricciones y los permisos de admin, consulta y anónimo. También se probaron la migración 03, el bloqueo de sesiones y roles, la creación y actualización de credenciales, las fotos, la eliminación y la conservación de movimientos. Auth y Storage se simularon en las pruebas; no se desplegó en tu Supabase real. La conexión de este ZIP se realiza con los pasos de instalación anteriores.

## Si algo no carga

| Mensaje o síntoma                              | Qué revisar                                                                                      |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Falta configurar Supabase                      | Completa URL y clave pública en `assets/js/config.js`.                                           |
| No se pudo cargar tu perfil o leer una tabla   | Revisa que el primer SQL terminó correctamente y que usas el mismo proyecto en la configuración. |
| Cuenta desactivada o pendiente de autorización | Activa el perfil desde Usuarios, o ejecuta el segundo SQL para la primera cuenta admin.          |
| Correo sin confirmar                           | Confirma el correo en Supabase Auth.                                                             |
| No se pudo ingresar                            | Revisa correo, contraseña, conexión y el proveedor Email en Authentication.                      |
| La página no ejecuta el JavaScript             | Abre mediante un servidor HTTP/HTTPS, no con doble clic en el HTML.                              |

Si el formulario de Usuarios o Marca no puede guardar, sigue la tabla de ayuda de `ACTUALIZACION_USUARIOS_Y_MARCA.md`.

Documentación oficial: [Supabase JS](https://supabase.com/docs/reference/javascript/installing), [inicio de sesión con contraseña](https://supabase.com/docs/reference/javascript/auth-signinwithpassword), [permisos RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Bootstrap](https://getbootstrap.com/docs/5.3/getting-started/introduction/).
