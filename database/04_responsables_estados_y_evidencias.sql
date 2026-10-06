-- Ejecuta este archivo completo en el mismo Supabase del proyecto.
-- Conserva los datos existentes. La identidad siempre procede de auth.uid().
BEGIN;

ALTER TABLE public.control_expenses ADD COLUMN IF NOT EXISTS evidence_path text;
ALTER TABLE public.control_movements ADD COLUMN IF NOT EXISTS evidence_path text;

ALTER TABLE public.control_tasks
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS created_by_name text,
  ADD COLUMN IF NOT EXISTS updated_by uuid,
  ADD COLUMN IF NOT EXISTS updated_by_name text,
  ADD COLUMN IF NOT EXISTS completed_by uuid,
  ADD COLUMN IF NOT EXISTS completed_by_name text,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS audit_completed boolean NOT NULL DEFAULT false;

-- Los UUID y nombres son históricos: no desaparecen al eliminar una cuenta.
CREATE TABLE IF NOT EXISTS public.control_task_activity (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  task_id uuid NOT NULL REFERENCES public.control_tasks(id),
  action text NOT NULL CHECK (action IN
    ('creado','editado','finalizado','reabierto','eliminado',
     'pago_registrado','pago_editado','pago_eliminado')),
  actor_id uuid NOT NULL,
  actor_name text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  details jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS control_task_activity_task
  ON public.control_task_activity(task_id,id DESC);
ALTER TABLE public.control_task_activity ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS control_task_activity_read ON public.control_task_activity;
CREATE POLICY control_task_activity_read ON public.control_task_activity
  FOR SELECT TO authenticated USING ((SELECT control_private.can_read()));
REVOKE ALL ON public.control_task_activity FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.control_task_activity TO authenticated;
REVOKE ALL ON SEQUENCE public.control_task_activity_id_seq FROM PUBLIC,anon,authenticated;

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('control-evidence','control-evidence',false,5242880,
  ARRAY['image/png','image/jpeg','image/webp','application/pdf'])
ON CONFLICT(id) DO UPDATE SET public=false,file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;
DROP POLICY IF EXISTS control_evidence_read ON storage.objects;
CREATE POLICY control_evidence_read ON storage.objects FOR SELECT TO authenticated
  USING(bucket_id='control-evidence' AND (SELECT control_private.can_read()));
DROP POLICY IF EXISTS control_evidence_insert ON storage.objects;
CREATE POLICY control_evidence_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK(bucket_id='control-evidence' AND (SELECT control_private.is_admin())
    AND split_part(name,'/',1)=(SELECT auth.uid())::text
    AND name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(png|jpg|webp|pdf)$');
-- Solo se limpian subidas propias que nunca quedaron ligadas a un registro.
-- Las evidencias históricas de un pago editado se conservan para su actividad.
DROP POLICY IF EXISTS control_evidence_cleanup ON storage.objects;
CREATE POLICY control_evidence_cleanup ON storage.objects FOR DELETE TO authenticated
  USING(bucket_id='control-evidence' AND (SELECT control_private.is_admin())
    AND split_part(name,'/',1)=(SELECT auth.uid())::text
    AND NOT EXISTS(SELECT 1 FROM public.control_expenses WHERE evidence_path=storage.objects.name)
    AND NOT EXISTS(SELECT 1 FROM public.control_movements WHERE evidence_path=storage.objects.name)
    AND NOT EXISTS(SELECT 1 FROM public.control_task_activity
      WHERE details->>'evidencePath'=storage.objects.name
        OR details->>'previousEvidencePath'=storage.objects.name));

CREATE OR REPLACE FUNCTION control_private.validate_evidence(p_path text,p_previous text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_path IS NULL OR p_path=p_previous THEN RETURN p_path; END IF;
  IF p_path !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(png|jpg|webp|pdf)$'
    OR split_part(p_path,'/',1)!=auth.uid()::text
    OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='control-evidence' AND name=p_path) THEN
    RAISE EXCEPTION 'La evidencia no es válida o no se terminó de subir.';
  END IF;
  RETURN p_path;
END $$;
REVOKE ALL ON FUNCTION control_private.validate_evidence(text,text) FROM PUBLIC,anon,authenticated;

-- Al repetir la migración no se inventan ni se reinician responsables.
DROP TRIGGER IF EXISTS control_task_audit_before ON public.control_tasks;
DROP TRIGGER IF EXISTS control_task_audit_after ON public.control_tasks;
DROP TRIGGER IF EXISTS control_task_payment_audit ON public.control_movements;
UPDATE public.control_tasks t SET audit_completed =
  (t.amount_cents=0 AND t.status='completado') OR
  (t.amount_cents>0 AND t.amount_cents<=coalesce((
    SELECT sum(m.amount_cents) FROM public.control_movements m
    WHERE m.kind='egreso' AND m.source_type='pendiente'
      AND m.source_id=t.id AND m.deleted_at IS NULL
  ),0));

CREATE OR REPLACE FUNCTION control_private.task_audit_before() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_actor uuid := auth.uid(); v_name text;
  v_now timestamptz := clock_timestamp(); v_closed boolean;
BEGIN
  PERFORM control_private.require_admin();
  SELECT name INTO STRICT v_name FROM public.control_profiles WHERE id=v_actor;
  v_closed := (NEW.amount_cents=0 AND NEW.status='completado') OR
    (NEW.amount_cents>0 AND NEW.amount_cents<=coalesce((
      SELECT sum(amount_cents) FROM public.control_movements
      WHERE kind='egreso' AND source_type='pendiente'
        AND source_id=NEW.id AND deleted_at IS NULL
    ),0));
  IF TG_OP='INSERT' THEN
    NEW.created_by := v_actor; NEW.created_by_name := v_name;
    NEW.created_at := v_now;
    NEW.completed_by := NULL; NEW.completed_by_name := NULL; NEW.completed_at := NULL;
    IF v_closed THEN
      NEW.completed_by := v_actor; NEW.completed_by_name := v_name; NEW.completed_at := v_now;
    END IF;
  ELSE
    NEW.created_by := OLD.created_by; NEW.created_by_name := OLD.created_by_name;
    NEW.created_at := OLD.created_at;
    NEW.completed_by := OLD.completed_by; NEW.completed_by_name := OLD.completed_by_name;
    NEW.completed_at := OLD.completed_at;
    IF v_closed AND NOT OLD.audit_completed THEN
      NEW.completed_by := v_actor; NEW.completed_by_name := v_name; NEW.completed_at := v_now;
    ELSIF NOT v_closed THEN
      NEW.completed_by := NULL; NEW.completed_by_name := NULL; NEW.completed_at := NULL;
    END IF;
  END IF;
  NEW.updated_by := v_actor; NEW.updated_by_name := v_name; NEW.updated_at := v_now;
  NEW.audit_completed := v_closed;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION control_private.task_audit_after() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_fields jsonb;
BEGIN
  IF TG_OP='INSERT' THEN
    INSERT INTO public.control_task_activity(task_id,action,actor_id,actor_name)
      VALUES(NEW.id,'creado',NEW.updated_by,NEW.updated_by_name);
    IF NEW.audit_completed THEN
      INSERT INTO public.control_task_activity(task_id,action,actor_id,actor_name)
        VALUES(NEW.id,'finalizado',NEW.updated_by,NEW.updated_by_name);
    END IF;
  ELSE
    SELECT coalesce(jsonb_agg(key ORDER BY key),'[]'::jsonb) INTO v_fields
      FROM jsonb_each(to_jsonb(NEW))
      WHERE key IN ('title','description','category','amount_cents','due_date','priority','status','links')
        AND value IS DISTINCT FROM to_jsonb(OLD)->key;
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
      INSERT INTO public.control_task_activity(task_id,action,actor_id,actor_name)
        VALUES(NEW.id,'eliminado',NEW.updated_by,NEW.updated_by_name);
    ELSIF jsonb_array_length(v_fields)>0 THEN
      INSERT INTO public.control_task_activity(task_id,action,actor_id,actor_name,details)
        VALUES(NEW.id,'editado',NEW.updated_by,NEW.updated_by_name,jsonb_build_object('fields',v_fields));
    END IF;
    IF OLD.audit_completed IS DISTINCT FROM NEW.audit_completed THEN
      INSERT INTO public.control_task_activity(task_id,action,actor_id,actor_name)
        VALUES(NEW.id,CASE WHEN NEW.audit_completed THEN 'finalizado' ELSE 'reabierto' END,
          NEW.updated_by,NEW.updated_by_name);
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION control_private.task_payment_audit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_row public.control_movements%ROWTYPE; v_actor uuid := auth.uid();
  v_name text; v_action text; v_details jsonb;
BEGIN
  IF TG_OP='DELETE' THEN v_row := OLD; ELSE v_row := NEW; END IF;
  IF v_row.kind!='egreso' OR v_row.source_type!='pendiente' THEN RETURN NULL; END IF;
  IF TG_OP='INSERT' AND v_row.deleted_at IS NOT NULL THEN RETURN NULL; END IF;
  IF TG_OP='UPDATE' THEN
    IF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NOT NULL THEN RETURN NULL; END IF;
    IF ROW(OLD.amount_cents,OLD.date,OLD.note,OLD.deleted_at,OLD.evidence_path)
      IS NOT DISTINCT FROM ROW(NEW.amount_cents,NEW.date,NEW.note,NEW.deleted_at,NEW.evidence_path) THEN
      RETURN NULL;
    END IF;
  END IF;
  PERFORM control_private.require_admin();
  SELECT name INTO STRICT v_name FROM public.control_profiles WHERE id=v_actor;
  PERFORM 1 FROM public.control_tasks WHERE id=v_row.source_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No se encontró el pendiente del pago.'; END IF;
  v_action := CASE
    WHEN TG_OP='DELETE' OR v_row.deleted_at IS NOT NULL THEN 'pago_eliminado'
    WHEN TG_OP='INSERT' THEN 'pago_registrado' ELSE 'pago_editado' END;
  v_details := jsonb_build_object('movementId',v_row.id,'amountCents',v_row.amount_cents,'date',v_row.date,
    'evidencePath',v_row.evidence_path);
  IF TG_OP='UPDATE' THEN
    v_details := v_details || jsonb_build_object('previousAmountCents',OLD.amount_cents,'previousDate',OLD.date,
      'previousEvidencePath',OLD.evidence_path);
  END IF;
  INSERT INTO public.control_task_activity(task_id,action,actor_id,actor_name,details)
    VALUES(v_row.source_id,v_action,v_actor,v_name,v_details);
  -- El trigger del pendiente detecta si este pago lo finaliza o lo reabre.
  UPDATE public.control_tasks SET updated_at=clock_timestamp() WHERE id=v_row.source_id;
  RETURN NULL;
END $$;

REVOKE ALL ON FUNCTION control_private.task_audit_before(),
  control_private.task_audit_after(),control_private.task_payment_audit()
  FROM PUBLIC,anon,authenticated;
CREATE TRIGGER control_task_audit_before BEFORE INSERT OR UPDATE ON public.control_tasks
  FOR EACH ROW EXECUTE FUNCTION control_private.task_audit_before();
CREATE TRIGGER control_task_audit_after AFTER INSERT OR UPDATE ON public.control_tasks
  FOR EACH ROW EXECUTE FUNCTION control_private.task_audit_after();
CREATE TRIGGER control_task_payment_audit AFTER INSERT OR UPDATE OR DELETE ON public.control_movements
  FOR EACH ROW EXECUTE FUNCTION control_private.task_payment_audit();

-- Las funciones de movimientos que siguen mantienen la validación original,
-- tomando primero el bloqueo del pendiente para serializar sus pagos.
CREATE OR REPLACE FUNCTION public.control_save_expense(p_payload jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid := coalesce(nullif(p_payload->>'id','')::uuid,gen_random_uuid()); v_start date; v_effective date; v_evidence text; v_previous text; v_today date := (now() AT TIME ZONE 'America/Mexico_City')::date;
BEGIN
  PERFORM control_private.require_admin();
  IF p_payload->>'id' IS NOT NULL THEN
    SELECT start_date,evidence_path INTO v_start,v_previous FROM public.control_expenses WHERE id=v_id AND deleted_at IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'El gasto ya no existe.'; END IF;
    v_effective := (p_payload->>'effectiveDate')::date;
    IF v_effective<v_today THEN RAISE EXCEPTION 'Los cambios se aplican desde hoy o una fecha futura.'; END IF;
  ELSE v_start := (p_payload->>'startDate')::date; v_effective := v_start; END IF;
  IF v_effective<v_start OR v_effective>'2100-12-31' THEN RAISE EXCEPTION 'La fecha de vigencia no es válida.'; END IF;
  v_evidence := control_private.validate_evidence(CASE WHEN p_payload ? 'evidencePath' THEN nullif(p_payload->>'evidencePath','') ELSE v_previous END,v_previous);
  INSERT INTO public.control_expenses(id,title,description,category,start_date,evidence_path)
  VALUES(v_id,trim(p_payload->>'title'),coalesce(p_payload->>'description',''),trim(p_payload->>'category'),v_start,v_evidence)
  ON CONFLICT(id) DO UPDATE SET title=excluded.title,description=excluded.description,category=excluded.category,evidence_path=excluded.evidence_path,updated_at=now();
  INSERT INTO public.control_schedules(expense_id,effective_date,amount_cents,frequency,week_day,month_day,half_day1,half_day2,active)
  VALUES(v_id,v_effective,(p_payload->>'amountCents')::bigint,p_payload->>'frequency',(p_payload->>'weekDay')::int,(p_payload->>'monthDay')::int,(p_payload->>'halfDay1')::int,(p_payload->>'halfDay2')::int,(p_payload->>'active')::boolean)
  ON CONFLICT(expense_id,effective_date) DO UPDATE SET amount_cents=excluded.amount_cents,frequency=excluded.frequency,week_day=excluded.week_day,month_day=excluded.month_day,half_day1=excluded.half_day1,half_day2=excluded.half_day2,active=excluded.active;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.control_save_movement(p_payload jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_id uuid := coalesce(nullif(p_payload->>'id','')::uuid,gen_random_uuid());
  v_kind text := p_payload->>'kind'; v_amount bigint := (p_payload->>'amountCents')::bigint;
  v_date date := (p_payload->>'date')::date; v_today date := (now() AT TIME ZONE 'America/Mexico_City')::date;
  v_title text := trim(p_payload->>'title'); v_category text := trim(p_payload->>'category');
  v_source text := 'manual'; v_evidence text; v_source_id uuid; v_due date; v_open date; v_last int; v_valid boolean;
  v_existing public.control_movements%ROWTYPE; v_schedule public.control_schedules%ROWTYPE; v_expense public.control_expenses%ROWTYPE;
BEGIN
  PERFORM control_private.require_admin();
  IF v_date>v_today THEN RAISE EXCEPTION 'Un movimiento realizado no puede tener fecha futura.'; END IF;
  IF v_kind NOT IN ('ingreso','egreso','saldo_inicial') THEN RAISE EXCEPTION 'El tipo de movimiento no es válido.'; END IF;
  -- Todos los pagos de un mismo pendiente toman primero este bloqueo.
  IF v_kind='egreso' AND p_payload->>'sourceType'='pendiente' THEN
    PERFORM 1 FROM public.control_tasks WHERE id=(p_payload->>'sourceId')::uuid FOR UPDATE;
  END IF;
  SELECT * INTO v_existing FROM public.control_movements WHERE id=v_id;
  IF FOUND AND v_existing.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'Este movimiento ya fue eliminado.'; END IF;
  IF v_existing.id IS NOT NULL AND v_existing.kind!=v_kind THEN RAISE EXCEPTION 'El tipo de movimiento no se puede cambiar.'; END IF;
  v_evidence := control_private.validate_evidence(CASE WHEN p_payload ? 'evidencePath' THEN nullif(p_payload->>'evidencePath','') ELSE v_existing.evidence_path END,v_existing.evidence_path);
  IF v_kind='saldo_inicial' THEN
    IF EXISTS(SELECT 1 FROM public.control_movements WHERE kind!='saldo_inicial' AND deleted_at IS NULL AND date<v_date) THEN RAISE EXCEPTION 'La apertura debe ser igual o anterior al primer movimiento.'; END IF;
    INSERT INTO public.control_movements(id,kind,title,category,amount_cents,date,source_type,note,recorded_by,singleton_key)
    VALUES(v_id,v_kind,'Saldo inicial','Saldo inicial',v_amount,v_date,'manual',coalesce(p_payload->>'note',''),auth.uid(),'opening')
    ON CONFLICT(singleton_key) DO UPDATE SET amount_cents=excluded.amount_cents,date=excluded.date,recorded_by=excluded.recorded_by,note=excluded.note;
    SELECT id INTO v_id FROM public.control_movements WHERE singleton_key='opening'; RETURN v_id;
  END IF;
  SELECT date INTO v_open FROM public.control_movements WHERE singleton_key='opening';
  IF v_date<v_open THEN RAISE EXCEPTION 'La fecha no puede ser anterior al saldo inicial.'; END IF;
  IF v_kind='egreso' THEN
    v_source := p_payload->>'sourceType'; v_source_id := (p_payload->>'sourceId')::uuid;
    IF v_source NOT IN ('pendiente','fijo') THEN RAISE EXCEPTION 'El origen del pago no es válido.'; END IF;
    IF v_source='fijo' THEN v_due := (p_payload->>'dueDate')::date; END IF;
    IF v_existing.id IS NOT NULL THEN
      IF v_existing.source_type!=v_source OR v_existing.source_id IS DISTINCT FROM v_source_id OR v_existing.due_date IS DISTINCT FROM v_due THEN RAISE EXCEPTION 'El origen del pago no se puede cambiar.'; END IF;
      v_title := v_existing.title; v_category := v_existing.category;
    ELSIF v_source='pendiente' THEN
      SELECT title,category INTO v_title,v_category FROM public.control_tasks WHERE id=v_source_id AND deleted_at IS NULL;
      IF NOT FOUND THEN RAISE EXCEPTION 'No se encontró el pendiente.'; END IF;
    ELSE
      SELECT * INTO v_expense FROM public.control_expenses WHERE id=v_source_id;
      IF NOT FOUND OR v_due IS NULL OR v_due<v_expense.start_date OR (v_expense.deleted_at IS NOT NULL AND v_due>=v_expense.deleted_at) THEN RAISE EXCEPTION 'El gasto no está vigente en esta fecha.'; END IF;
      SELECT * INTO v_schedule FROM public.control_schedules WHERE expense_id=v_source_id AND effective_date<=v_due ORDER BY effective_date DESC LIMIT 1;
      IF NOT FOUND OR NOT v_schedule.active THEN RAISE EXCEPTION 'No hay un vencimiento activo para esta fecha.'; END IF;
      v_last := extract(day FROM date_trunc('month',v_due)+interval '1 month - 1 day')::int;
      v_valid := CASE v_schedule.frequency WHEN 'semanal' THEN extract(dow FROM v_due)::int=v_schedule.week_day WHEN 'quincenal' THEN extract(day FROM v_due)::int IN (v_schedule.half_day1,least(v_schedule.half_day2,v_last)) ELSE extract(day FROM v_due)::int=least(v_schedule.month_day,v_last) END;
      IF NOT v_valid THEN RAISE EXCEPTION 'La fecha no corresponde a un vencimiento.'; END IF;
      v_title := v_expense.title; v_category := v_expense.category;
    END IF;
  END IF;
  INSERT INTO public.control_movements(id,kind,title,category,amount_cents,date,source_type,source_id,due_date,note,recorded_by,evidence_path)
  VALUES(v_id,v_kind,v_title,v_category,v_amount,v_date,v_source,v_source_id,v_due,coalesce(p_payload->>'note',''),auth.uid(),v_evidence)
  ON CONFLICT(id) DO UPDATE SET title=excluded.title,category=excluded.category,amount_cents=excluded.amount_cents,date=excluded.date,note=excluded.note,recorded_by=excluded.recorded_by,evidence_path=excluded.evidence_path;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.control_delete_record(p_table text,p_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM control_private.require_admin();
  CASE p_table
    WHEN 'tasks' THEN UPDATE public.control_tasks SET deleted_at=now() WHERE id=p_id;
    WHEN 'expenses' THEN UPDATE public.control_expenses SET deleted_at=(now() AT TIME ZONE 'America/Mexico_City')::date WHERE id=p_id;
    WHEN 'movements' THEN
      IF EXISTS(SELECT 1 FROM public.control_movements WHERE id=p_id AND kind='saldo_inicial') THEN RAISE EXCEPTION 'El saldo inicial se edita desde Cuadre.'; END IF;
      PERFORM 1 FROM public.control_tasks WHERE id=(
        SELECT source_id FROM public.control_movements
        WHERE id=p_id AND kind='egreso' AND source_type='pendiente'
      ) FOR UPDATE;
      UPDATE public.control_movements SET deleted_at=now() WHERE id=p_id;
    ELSE RAISE EXCEPTION 'Tipo de registro no válido.';
  END CASE;
END $$;
NOTIFY pgrst, 'reload schema';
COMMIT;
