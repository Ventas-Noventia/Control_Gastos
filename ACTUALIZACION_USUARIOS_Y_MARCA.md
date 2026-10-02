# Noventia · Usuarios, fotos, contraseñas y logo

Esta actualización agrega **Usuarios → Nuevo usuario** y **Marca**. Sigue usando HTML, CSS y JavaScript con Bootstrap. Las cuentas se crean y se eliminan de Supabase Auth mediante una Edge Function escrita en JavaScript, que verifica la sesión y el rol admin antes de actuar.

## Si ya tienes el proyecto conectado

### 1. Copia los archivos

Descomprime `Actualizacion_Usuarios_y_Marca_Noventia.zip` y copia su contenido dentro de tu carpeta actual, al mismo nivel que `usuarios.html`. Acepta reemplazar los archivos coincidentes.

La actualización **no incluye `assets/js/config.js`**, para conservar tu URL y tu clave pública. Tampoco incluye los SQL 01 y 02: no necesitas volver a crear las tablas ni reactivar tu cuenta admin.

### 2. Ejecuta el SQL nuevo

En tu mismo proyecto de Supabase, abre **SQL Editor**, pega todo el contenido de `database/03_usuarios_fotos_y_marca.sql` y ejecútalo.

Este archivo agrega el campo de foto, la marca compartida y dos depósitos de imágenes. Se puede volver a ejecutar sin borrar cuentas, datos financieros ni el logo ya guardado.

### 3. Publica la función protegida

En tu Mac abre Terminal **dentro de la carpeta del proyecto**, donde está la carpeta `supabase/`. Con Node.js instalado, ejecuta:

```sh
npx supabase login
npx supabase functions deploy control-admin --project-ref TU_PROJECT_REF --use-api
```

En el segundo comando sustituye `TU_PROJECT_REF` por el identificador real de tu proyecto Supabase. Puedes copiarlo del panel de tu proyecto; normalmente también es la parte anterior a `.supabase.co` en la URL de conexión.

El primer comando inicia la sesión del CLI de Supabase. La opción `--use-api` publica sin requerir Docker en tu Mac. El segundo publica el código de `supabase/functions/control-admin/`. Esta activación se hace una sola vez por proyecto; al actualizar después el código de esa función, repite el segundo comando.

El archivo `supabase/config.toml` incluido selecciona la entrada `index.js`. Aunque `verify_jwt` está en `false`, **la función comprueba siempre el token con `auth.getUser()` y exige un perfil admin activo en la base de datos**. Esto permite las claves públicas actuales de Supabase sin confiar en el rol enviado por el navegador. Los RPC internos vuelven a comprobar el administrador al guardar.

Supabase proporciona en la función las variables de entorno `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`. Esta última es privada, vive únicamente en el servidor de Supabase y nunca debe copiarse a `config.js` ni subirse como credencial al repositorio. Los archivos incluidos no contienen ninguna clave privada.

### 4. Recarga la aplicación

Abre **Usuarios** con tu cuenta admin. Si sigues viendo la pantalla anterior, recarga sin caché: **⌘ + Shift + R** en Chrome para Mac. Si usas un sitio publicado, sube también los HTML y `assets/` actualizados a ese sitio.

Ya no necesitas ir al panel de Supabase para crear cada usuario. El primer administrador se conserva como está.

## Crear usuarios

1. Entra a **Usuarios → Nuevo usuario**.
2. Escribe nombre y correo. Este correo se usará para iniciar sesión.
3. Elige **Consulta** o **Administrador** y activa o desactiva su acceso.
4. Asigna y confirma una contraseña de al menos 8 caracteres. El máximo es 72 bytes: los caracteres especiales pueden ocupar más de un byte.
5. Opcionalmente selecciona una foto PNG, JPG o WEBP de hasta 2 MB.
6. Pulsa **Crear usuario**. La cuenta se crea con el correo confirmado; comparte sus datos de acceso con esa persona por el medio que prefieras.

No se envían correos de invitación desde esta función. No hay registro público en la aplicación.

## Editar o eliminar

- **Lápiz:** cambia nombre, correo de acceso, foto, rol, estado o contraseña.
- **Contraseña vacía al editar:** conserva la contraseña anterior. Las contraseñas actuales no se consultan ni se muestran.
- **Quitar foto actual:** vuelve a mostrar las iniciales.
- **Acceso desactivado:** bloquea las consultas y las escrituras de esa cuenta, incluso si tenía una sesión abierta.
- **Papelera:** abre una confirmación y elimina la cuenta de Auth y su perfil. Los pendientes, gastos, ingresos y pagos se conservan; los movimientos vinculados dejan de referenciar esa cuenta.

Puedes editar tus propios datos, foto y contraseña. Tu propia cuenta no puede eliminarse, desactivarse ni cambiar a consulta desde esta página. La gestión de cuentas y de la marca está disponible para administradores.

## Cargar el logo de Noventia

Abre **Marca** desde el menú superior. Selecciona el archivo original del logo en PNG, JPG o WEBP, de hasta 2 MB, y pulsa **Guardar marca**. El PNG puede tener fondo transparente. También puedes editar el nombre o restaurar el logo original de Noventia.

El logo aparece en el login y en el encabezado de todas las páginas. Se guarda en Supabase y se comparte entre los usuarios; abre o recarga las otras páginas para ver el cambio. Las fotos de usuarios se guardan en un depósito privado y se muestran mediante enlaces temporales. El depósito del logo es público para mostrarlo antes de iniciar sesión.

Esta entrega ya incluye el logo original de Noventia en `assets/img/noventia-logo.png`. Se muestra directamente en el login y en los encabezados; no necesitas subirlo a Supabase. Marca permite sustituirlo por otro logo y restaurar el original.

## Si no puedes guardar

| Mensaje                                                | Revisión                                                                                       |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| Ejecuta el SQL 03                                      | Ejecuta el archivo 03 completo en el mismo proyecto usado por `config.js`.                     |
| No se pudo conectar con la gestión de usuarios         | Publica `control-admin` y revisa que el identificador del proyecto sea el correcto.            |
| Solo un administrador activo puede administrar cuentas | Ingresa con un perfil `admin` y `active = true`. El rol consulta no gestiona usuarios.         |
| Ese correo ya está registrado                          | Usa otro correo o edita la cuenta existente.                                                   |
| La contraseña no cumple las reglas de Supabase Auth    | Revisa la longitud y las reglas de contraseña de Authentication.                               |
| No se pudo subir la imagen                             | Revisa que se ejecutó el SQL 03, que el formato está permitido y que pesa como máximo 2 MB.    |
| La operación no se pudo completar                      | Actualiza la lista antes de reintentar; los errores indican cuando hubo una operación parcial. |

La entrega se comprobó en Chromium y PostgreSQL local con servicios Auth y Storage simulados. La conexión a tu Supabase real requiere ejecutar el SQL 03 y publicar la función; no se publicó en tu cuenta desde esta sesión.

Documentación oficial: [crear cuentas desde un servidor](https://supabase.com/docs/reference/javascript/auth-admin-createuser), [cambiar correo y contraseña](https://supabase.com/docs/reference/javascript/auth-admin-updateuserbyid), [eliminar cuentas](https://supabase.com/docs/reference/javascript/auth-admin-deleteuser), [configurar una entrada JavaScript](https://supabase.com/docs/guides/functions/function-configuration), [publicar Edge Functions](https://supabase.com/docs/guides/functions/deploy), [variables privadas](https://supabase.com/docs/guides/functions/secrets).
