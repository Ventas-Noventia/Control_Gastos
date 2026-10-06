-- Ejecutar después de 04_responsables_estados_y_evidencias.sql.
-- Amplía solo la recurrencia de gastos; conserva datos, login y pendientes.
BEGIN;
ALTER TABLE public.control_schedules
  DROP CONSTRAINT IF EXISTS control_schedules_frequency_check;
ALTER TABLE public.control_schedules
  ADD CONSTRAINT control_schedules_frequency_check
  CHECK (frequency IN ('semanal','quincenal','mensual','bimestral','anual'));
ALTER TABLE public.control_schedules
  ADD COLUMN IF NOT EXISTS cycle_month int NOT NULL DEFAULT 1
  CHECK (cycle_month BETWEEN 1 AND 12);

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
  INSERT INTO public.control_schedules(expense_id,effective_date,amount_cents,frequency,week_day,month_day,half_day1,half_day2,cycle_month,active)
  VALUES(v_id,v_effective,(p_payload->>'amountCents')::bigint,p_payload->>'frequency',(p_payload->>'weekDay')::int,(p_payload->>'monthDay')::int,(p_payload->>'halfDay1')::int,(p_payload->>'halfDay2')::int,coalesce((p_payload->>'cycleMonth')::int,extract(month FROM v_effective)::int),(p_payload->>'active')::boolean)
  ON CONFLICT(expense_id,effective_date) DO UPDATE SET amount_cents=excluded.amount_cents,frequency=excluded.frequency,week_day=excluded.week_day,month_day=excluded.month_day,half_day1=excluded.half_day1,half_day2=excluded.half_day2,cycle_month=excluded.cycle_month,active=excluded.active;
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
      v_valid := CASE v_schedule.frequency
        WHEN 'semanal' THEN extract(dow FROM v_due)::int=v_schedule.week_day
        WHEN 'quincenal' THEN extract(day FROM v_due)::int IN (v_schedule.half_day1,least(v_schedule.half_day2,v_last))
        WHEN 'mensual' THEN extract(day FROM v_due)::int=least(v_schedule.month_day,v_last)
        WHEN 'bimestral' THEN extract(day FROM v_due)::int=least(v_schedule.month_day,v_last)
          AND mod(extract(month FROM v_due)::int-v_schedule.cycle_month,2)=0
        WHEN 'anual' THEN extract(day FROM v_due)::int=least(v_schedule.month_day,v_last)
          AND extract(month FROM v_due)::int=v_schedule.cycle_month
        ELSE false END;
      IF NOT v_valid THEN RAISE EXCEPTION 'La fecha no corresponde a un vencimiento.'; END IF;
      v_title := v_expense.title; v_category := v_expense.category;
    END IF;
  END IF;
  INSERT INTO public.control_movements(id,kind,title,category,amount_cents,date,source_type,source_id,due_date,note,recorded_by,evidence_path)
  VALUES(v_id,v_kind,v_title,v_category,v_amount,v_date,v_source,v_source_id,v_due,coalesce(p_payload->>'note',''),auth.uid(),v_evidence)
  ON CONFLICT(id) DO UPDATE SET title=excluded.title,category=excluded.category,amount_cents=excluded.amount_cents,date=excluded.date,note=excluded.note,recorded_by=excluded.recorded_by,evidence_path=excluded.evidence_path;
  RETURN v_id;
END $$;

NOTIFY pgrst, 'reload schema';
COMMIT;
