-- Ejecutar después de 01. Se puede repetir en una instalación existente.
BEGIN;
ALTER TABLE public.control_profiles ADD COLUMN IF NOT EXISTS avatar_path text;
CREATE TABLE IF NOT EXISTS public.control_branding (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  name text NOT NULL DEFAULT 'Noventia' CHECK (char_length(trim(name)) BETWEEN 1 AND 60),
  logo_path text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.control_branding(id,name) VALUES(true,'Noventia') ON CONFLICT(id) DO NOTHING;
ALTER TABLE public.control_branding ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS control_branding_read ON public.control_branding;
CREATE POLICY control_branding_read ON public.control_branding FOR SELECT TO anon,authenticated USING(true);
REVOKE ALL ON public.control_branding FROM anon,authenticated;
GRANT SELECT(id,name,logo_path) ON public.control_branding TO anon,authenticated;
GRANT ALL ON public.control_profiles,public.control_branding TO service_role;

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES
 ('control-avatars','control-avatars',false,2097152,ARRAY['image/png','image/jpeg','image/webp']),
 ('control-branding','control-branding',true,2097152,ARRAY['image/png','image/jpeg','image/webp'])
ON CONFLICT(id) DO UPDATE SET public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
DROP POLICY IF EXISTS control_avatars_read ON storage.objects;
CREATE POLICY control_avatars_read ON storage.objects FOR SELECT TO authenticated
USING(bucket_id='control-avatars' AND (SELECT control_private.can_read())
 AND ((SELECT control_private.is_admin()) OR (storage.foldername(name))[1]=(SELECT auth.uid())::text));
-- No hay políticas de escritura para el navegador. La función protegida sube las imágenes.

CREATE OR REPLACE FUNCTION public.control_admin_apply_profile(
 p_actor uuid,p_id uuid,p_email text,p_name text,p_role text,p_active boolean,p_avatar_path text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(867530901);
 IF NOT EXISTS(SELECT 1 FROM public.control_profiles WHERE id=p_actor AND active AND role='admin') THEN
  RAISE EXCEPTION 'Solo un administrador activo puede administrar cuentas.' USING ERRCODE='42501';
 END IF;
 IF p_actor=p_id AND (p_role!='admin' OR NOT p_active) THEN
  RAISE EXCEPTION 'Tu propia cuenta conserva acceso de administrador.' USING ERRCODE='42501';
 END IF;
 IF p_role NOT IN ('admin','consulta') OR p_active IS NULL OR p_name IS NULL OR p_email IS NULL THEN
  RAISE EXCEPTION 'Datos de perfil no válidos.';
 END IF;
 IF p_avatar_path IS NOT NULL AND p_avatar_path !~ ('^'||p_id::text||'/[0-9a-f-]+\.(png|jpg|webp)$') THEN
  RAISE EXCEPTION 'Ruta de foto no válida.';
 END IF;
 UPDATE public.control_profiles SET email=lower(trim(p_email)),name=trim(p_name),role=p_role,active=p_active,avatar_path=p_avatar_path WHERE id=p_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'No se encontró el usuario.'; END IF;
END $$;
CREATE OR REPLACE FUNCTION public.control_admin_apply_brand(p_actor uuid,p_name text,p_logo_path text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(867530901);
 IF NOT EXISTS(SELECT 1 FROM public.control_profiles WHERE id=p_actor AND active AND role='admin') THEN
  RAISE EXCEPTION 'Solo un administrador activo puede cambiar la marca.' USING ERRCODE='42501';
 END IF;
 IF p_logo_path IS NOT NULL AND p_logo_path !~ '^brand/[0-9a-f-]+\.(png|jpg|webp)$' THEN RAISE EXCEPTION 'Ruta de logo no válida.'; END IF;
 UPDATE public.control_branding SET name=trim(p_name),logo_path=p_logo_path,updated_at=now() WHERE id=true;
 IF NOT FOUND THEN RAISE EXCEPTION 'No se encontró la configuración de marca.'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.control_admin_apply_profile(uuid,uuid,text,text,text,boolean,text),public.control_admin_apply_brand(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.control_admin_apply_profile(uuid,uuid,text,text,text,boolean,text),public.control_admin_apply_brand(uuid,text,text) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
