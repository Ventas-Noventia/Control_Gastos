# Actualización: categorías predeterminadas y personalizadas

Ahora puedes elegir entre 25 categorías básicas, incluidas **Luz**, **Agua**, **Gas**, **Cuentas de ChatGPT**, **Renta bazar**, **Renta almacén** y **Limpieza**.

Las 25 opciones también aparecen en el filtro **Todas las categorías** de la página Pendientes, aunque todavía no hayas registrado pendientes. Los formularios usan un desplegable visible.

## Aplicar a tu instalación actual

1. Descomprime `Actualizacion_Categorias.zip`.
2. Copia su contenido dentro de la carpeta de tu proyecto, donde están `pendientes.html` y `gastos-fijos.html`. Acepta reemplazar los archivos existentes.
3. Si usas hosting, sube esos archivos a la misma ubicación de tu sitio.
4. Abre el sistema y recarga con **Ctrl + Shift + R** (Windows/Linux) o **Cmd + Shift + R** (macOS).

Este paquete conserva la conexión que tienes en `assets/js/config.js`: no incluye ese archivo ni scripts SQL. No necesitas repetir la configuración de Supabase. Los registros y permisos actuales se mantienen en tu base de datos.

## Elegir o agregar una categoría

1. Abre **Nuevo pendiente**, **Nuevo gasto fijo** o **Registrar ingreso**.
2. En **Categoría**, abre el desplegable: ahí aparecen las 25 categorías básicas y las categorías que ya has usado.
3. Si necesitas otra, selecciona **+ Agregar nueva categoría…** al final de la lista. Aparecerá el campo **Nueva categoría** para escribir su nombre.
4. Guarda el registro. La categoría se guardará con él y aparecerá en los desplegables de los demás formularios al cargarlos o usar **Actualizar**.

Los administradores pueden guardar registros. Las cuentas de consulta conservan acceso de lectura. Los formularios siguen abriéndose en modales y permiten editar las categorías de registros existentes.
