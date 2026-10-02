# Actualización: botones y modales de captura

La actualización agrega botones de captura visibles en Pendientes, Gastos fijos e Ingresos. Un administrador puede usarlos para abrir los formularios en modales. En una lista vacía de pendientes también aparece **Agregar mi primer pendiente**; en gastos aparece **Agregar mi primer gasto fijo**.

El modal de pendientes permite guardar nombre, categoría libre, importe, fecha límite, prioridad, estado, notas y hasta tres enlaces de compra. Incluye cancelación, cierre con Escape y enfoque inicial en el nombre.

Los botones quedan deshabilitados para el rol consulta, con una explicación en pantalla. Al actualizar o volver a enfocar la aplicación, la interfaz vuelve a comprobar el perfil actual y actualiza sus controles. Las restricciones de PostgreSQL siguen aplicándose a todas las operaciones.

## Instalar sobre tu proyecto conectado

1. Descomprime `Actualizacion_Boton_y_Modales.zip`.
2. Copia su contenido dentro de tu carpeta actual, donde están `login.html` y `pendientes.html`, aceptando reemplazar los archivos existentes. Si tu descompresor crea una carpeta externa, copia los archivos de dentro: no coloques esa carpeta externa dentro del proyecto.
3. Conserva tu `assets/js/config.js`. El ZIP de actualización no incluye ese archivo ni los SQL, y conserva la configuración que ya usas.
4. Con tu servidor estático abierto, recarga el navegador. En Mac puedes usar **⌘ + Shift + R**; en Windows, **Ctrl + F5**.
5. Entra a **Pendientes** y pulsa **Nuevo pendiente** o **Agregar mi primer pendiente**. Guarda un registro y comprueba que permanece al recargar.

Esta actualización se aplica a los archivos del sitio. No requiere ejecutar nuevamente el esquema SQL ni volver a crear tu cuenta. Mantiene los registros que ya guardaste en Supabase.

Si los botones aparecen deshabilitados y el encabezado dice **Consulta**, esa es la función registrada para esa cuenta. La captura requiere un perfil activo con rol **admin**. Un administrador puede cambiar el rol desde Usuarios; la configuración de la primera cuenta se encuentra en `database/02_activar_administrador.sql` del proyecto completo.

El archivo `Control_Pendientes_Gastos_HTML.zip` también contiene el proyecto completo actualizado. Para una instalación nueva, sigue `LEEME.md`; para tu instalación ya conectada, usa el ZIP de actualización anterior.
