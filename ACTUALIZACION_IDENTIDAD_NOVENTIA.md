# Logo y colores de Noventia

Esta actualización incluye el PNG original que compartiste y aplica su paleta al login, navegación, botones, formularios, tarjetas, modales y reportes.

| Color       | Valor     | Uso                                                                         |
| ----------- | --------- | --------------------------------------------------------------------------- |
| Azul marino | `#002654` | Botones principales, navegación, tarjetas destacadas y base del login.      |
| Turquesa    | `#00B8D5` | Acentos, selecciones y detalles. Para texto se usa una variante más oscura. |
| Coral       | `#FE7555` | Detalles del login y acentos cálidos.                                       |

## Actualizar tu proyecto actual

1. Descomprime `Actualizacion_Logo_y_Paleta_Noventia.zip`.
2. Copia su contenido dentro de tu carpeta actual, donde están `login.html` y `usuarios.html`, y acepta reemplazar los archivos coincidentes.
3. Si usas un sitio publicado, actualiza también los HTML y la carpeta `assets/` en ese sitio.
4. Recarga en Chrome con **⌘ + Shift + R**.

El ZIP de actualización conserva tu `assets/js/config.js`. El cambio de identidad se aplica al copiar los archivos: no requiere cambios de base de datos ni desplegar otra función. La gestión de usuarios sigue usando `control-admin`, cuya activación está explicada en `ACTUALIZACION_USUARIOS_Y_MARCA.md`.

## Logo y personalización

El archivo original está en `assets/img/noventia-logo.png`. Se conserva intacto; los márgenes transparentes se ajustan únicamente en el CSS para que el logo se vea grande y proporcionado en el encabezado.

El logo aparece directamente desde el HTML y sirve como opción predeterminada si aún no está configurada la marca en Supabase. El panel blanco del login mantiene visibles las letras azules del archivo original.

En **Marca** puedes sustituirlo por otro logo. **Restaurar logo de Noventia** vuelve al archivo incluido. Si ya guardaste otro logo en Supabase, ese logo personalizado se conserva hasta que lo restaures desde Marca.

Los enlaces temporales de fotos de usuarios y la gestión de cuentas siguen separados de esta identidad visual.

Esta entrega se verificó en Chromium en escritorio, tableta y celular, incluyendo el menú de hamburguesa, formularios y logotipo. La conexión de las cuentas a tu Supabase real requiere la activación previa de `control-admin`.
