-- 1. Crea la cuenta en Supabase: Authentication > Users > Add user.
-- 2. Cambia el correo de abajo por el de esa cuenta.
-- 3. Ejecuta este SQL desde SQL Editor. No contiene ni modifica la contraseña.
UPDATE public.control_profiles
SET role='admin',active=true,name='Administrador'
WHERE email=lower('TU_CORREO_ADMIN@empresa.com');
-- Debe mostrar exactamente tu usuario. Si no aparece, revisa el correo.
SELECT id,email,name,role,active FROM public.control_profiles
WHERE email=lower('TU_CORREO_ADMIN@empresa.com');
