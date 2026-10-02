# Actualización: menú superior y categorías seleccionables

Este paquete integra el menú superior y los selectores de categorías en todas las páginas del sistema.

## Aplicar la actualización

1. Descarga `Actualizacion_Menu_Superior_y_Categorias.zip` y descomprímelo.
2. Copia todo su contenido en la carpeta de tu proyecto donde está `login.html`. La carpeta `assets` del paquete debe combinarse con la carpeta `assets` de tu proyecto. Acepta reemplazar los archivos incluidos.
3. Si usas hosting, sube los archivos a esa misma ubicación de tu sitio.
4. Abre `pendientes.html` y recarga con **Cmd + Shift + R** en Mac o **Ctrl + Shift + R** en Windows/Linux.

El paquete incluye las páginas, JavaScript y CSS actualizados. Conserva el archivo `assets/js/config.js` de tu instalación y tus datos en Supabase: no incluye configuración ni scripts de base de datos.

## Comprobar el resultado

- El menú debe aparecer arriba, sin barra lateral. En tabletas y celulares aparece el botón de hamburguesa a la derecha del nombre del sistema. Haz clic para abrir o cerrar los enlaces; Escape también cierra el menú.
- En **Nuevo pendiente → Categoría** y **Nuevo gasto fijo → Categoría**, debes ver un desplegable con flecha. Al abrirlo aparecen Luz, Agua, Gas, Cuentas de ChatGPT, Renta bazar, Renta almacén, Limpieza y las demás categorías, hasta completar las 25 básicas.
- El filtro de Pendientes también incluye las 25 categorías, aunque la lista esté vacía.
- Para usar una categoría nueva, elige **+ Agregar nueva categoría…** al final del desplegable. El campo de escritura aparece únicamente al elegir esa opción. Guarda el registro para que la nueva categoría aparezca en la lista.

Si todavía aparece la barra lateral o un campo de texto como Categoría, verifica que abriste la carpeta que acabas de actualizar y que reemplazaste las páginas HTML además de la carpeta `assets`. El menú superior permite reconocer esta actualización al abrir el sistema.
