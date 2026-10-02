-- Control: proyecto NUEVO de Supabase. Ejecuta este archivo una vez en SQL Editor.
-- Las contraseñas las administra Supabase Auth; nunca se guardan en estas tablas.
BEGIN;
CREATE SCHEMA IF NOT EXISTS control_private;
REVOKE ALL ON SCHEMA control_private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA control_private TO authenticated;

CREATE TABLE public.control_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  role text NOT NULL DEFAULT 'consulta' CHECK (role IN ('admin','consulta')),
  active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE FUNCTION control_private.handle_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.control_profiles(id,email,name,role,active)
  VALUES (NEW.id,lower(NEW.email),left(coalesce(nullif(trim(NEW.raw_user_meta_data->>'name'),''),split_part(NEW.email,'@',1)),120),'consulta',false);
  RETURN NEW;
END $$;
CREATE TRIGGER control_new_user AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION control_private.handle_user();
-- También incorpora cuentas que existieran antes de ejecutar el esquema.
INSERT INTO public.control_profiles(id,email,name)
SELECT id,lower(email),left(coalesce(nullif(trim(raw_user_meta_data->>'name'),''),split_part(email,'@',1)),120)
FROM auth.users WHERE email IS NOT NULL ON CONFLICT(id) DO NOTHING;

CREATE FUNCTION control_private.is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS(SELECT 1 FROM public.control_profiles WHERE id=(SELECT auth.uid()) AND active AND role='admin');
$$;
CREATE FUNCTION control_private.can_read() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS(SELECT 1 FROM public.control_profiles WHERE id=(SELECT auth.uid()) AND active);
$$;
CREATE FUNCTION control_private.require_admin() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT control_private.is_admin() THEN RAISE EXCEPTION 'Solo el administrador puede modificar datos.' USING ERRCODE='42501'; END IF;
END $$;
CREATE FUNCTION control_private.valid_links(value jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE WHEN jsonb_typeof(value)!='array' THEN false ELSE
    jsonb_array_length(value)<=3 AND NOT EXISTS(
      SELECT 1 FROM jsonb_array_elements(value) AS x
      WHERE jsonb_typeof(x)!='string' OR (x#>>'{}') !~ '^https?://[^[:space:]]+$'
      OR char_length(x#>>'{}')>2048 OR (x#>>'{}') ~ '^https?://[^/]*@'
    ) END;
$$;
CREATE TABLE public.control_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (char_length(trim(title)) BETWEEN 1 AND 160),
  description text NOT NULL DEFAULT '' CHECK (char_length(description)<=2000),
  category text NOT NULL CHECK (char_length(trim(category)) BETWEEN 1 AND 80),
  amount_cents bigint NOT NULL CHECK (amount_cents BETWEEN 0 AND 100000000000),
  due_date date NOT NULL CHECK (due_date BETWEEN '2000-01-01' AND '2100-12-31'),
  priority text NOT NULL CHECK (priority IN ('alta','media','baja')),
  status text NOT NULL CHECK (status IN ('pendiente','en_proceso','completado')),
  links jsonb NOT NULL DEFAULT '[]' CHECK (control_private.valid_links(links)),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz,
  CHECK (status!='completado' OR amount_cents=0)
);
CREATE INDEX control_tasks_due ON public.control_tasks(due_date);
CREATE TABLE public.control_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (char_length(trim(title)) BETWEEN 1 AND 160),
  description text NOT NULL DEFAULT '' CHECK (char_length(description)<=2000),
  category text NOT NULL CHECK (char_length(trim(category)) BETWEEN 1 AND 80),
  start_date date NOT NULL CHECK (start_date BETWEEN '2000-01-01' AND '2100-12-31'),
  updated_at timestamptz NOT NULL DEFAULT now(), deleted_at date
);
CREATE TABLE public.control_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), expense_id uuid NOT NULL REFERENCES public.control_expenses(id),
  effective_date date NOT NULL, amount_cents bigint NOT NULL CHECK (amount_cents BETWEEN 1 AND 100000000000),
  frequency text NOT NULL CHECK (frequency IN ('semanal','quincenal','mensual')),
  week_day int NOT NULL CHECK (week_day BETWEEN 0 AND 6), month_day int NOT NULL CHECK (month_day BETWEEN 1 AND 31),
  half_day1 int NOT NULL CHECK (half_day1 BETWEEN 1 AND 15), half_day2 int NOT NULL CHECK (half_day2 BETWEEN 16 AND 31),
  active boolean NOT NULL DEFAULT true, UNIQUE(expense_id,effective_date)
);
CREATE TABLE public.control_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('ingreso','egreso','saldo_inicial')),
  title text NOT NULL CHECK (char_length(trim(title)) BETWEEN 1 AND 160),
  category text NOT NULL CHECK (char_length(trim(category)) BETWEEN 1 AND 80),
  amount_cents bigint NOT NULL CHECK (abs(amount_cents)<=100000000000 AND (kind='saldo_inicial' OR amount_cents>0)),
  date date NOT NULL CHECK (date BETWEEN '2000-01-01' AND '2100-12-31'),
  source_type text NOT NULL CHECK (source_type IN ('manual','pendiente','fijo')),
  source_id uuid, due_date date, note text NOT NULL DEFAULT '' CHECK (char_length(note)<=2000),
  recorded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz,
  singleton_key text UNIQUE,
  CHECK ((kind='egreso' AND source_type IN ('pendiente','fijo') AND source_id IS NOT NULL AND (source_type!='fijo' OR due_date IS NOT NULL)) OR (kind!='egreso' AND source_type='manual' AND source_id IS NULL)),
  CHECK ((kind='saldo_inicial' AND singleton_key='opening') OR (kind!='saldo_inicial' AND singleton_key IS NULL))
);
CREATE INDEX control_movements_date ON public.control_movements(date);
CREATE INDEX control_movements_source ON public.control_movements(source_type,source_id,due_date);

ALTER TABLE public.control_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY control_profiles_read ON public.control_profiles FOR SELECT TO authenticated
USING (id=(SELECT auth.uid()) OR (SELECT control_private.is_admin()));
ALTER TABLE public.control_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.control_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.control_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.control_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY control_tasks_read ON public.control_tasks FOR SELECT TO authenticated USING ((SELECT control_private.can_read()));
CREATE POLICY control_expenses_read ON public.control_expenses FOR SELECT TO authenticated USING ((SELECT control_private.can_read()));
CREATE POLICY control_schedules_read ON public.control_schedules FOR SELECT TO authenticated USING ((SELECT control_private.can_read()));
CREATE POLICY control_movements_read ON public.control_movements FOR SELECT TO authenticated USING ((SELECT control_private.can_read()));
-- Incluso admin modifica mediante funciones validadas y transaccionales.
REVOKE ALL ON public.control_profiles,public.control_tasks,public.control_expenses,public.control_schedules,public.control_movements FROM anon,authenticated;
GRANT SELECT ON public.control_profiles,public.control_tasks,public.control_expenses,public.control_schedules,public.control_movements TO authenticated;

CREATE FUNCTION public.control_save_task(p_payload jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid := coalesce(nullif(p_payload->>'id','')::uuid,gen_random_uuid());
BEGIN
  PERFORM control_private.require_admin();
  IF p_payload->>'id' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.control_tasks WHERE id=v_id AND deleted_at IS NULL) THEN RAISE EXCEPTION 'El pendiente ya no existe.'; END IF;
  INSERT INTO public.control_tasks(id,title,description,category,amount_cents,due_date,priority,status,links)
  VALUES(v_id,trim(p_payload->>'title'),coalesce(p_payload->>'description',''),trim(p_payload->>'category'),(p_payload->>'amountCents')::bigint,(p_payload->>'dueDate')::date,p_payload->>'priority',p_payload->>'status',coalesce(p_payload->'links','[]'::jsonb))
  ON CONFLICT(id) DO UPDATE SET title=excluded.title,description=excluded.description,category=excluded.category,amount_cents=excluded.amount_cents,due_date=excluded.due_date,priority=excluded.priority,status=excluded.status,links=excluded.links,updated_at=now();
  RETURN v_id;
END $$;

CREATE FUNCTION public.control_save_expense(p_payload jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid := coalesce(nullif(p_payload->>'id','')::uuid,gen_random_uuid()); v_start date; v_effective date; v_today date := (now() AT TIME ZONE 'America/Mexico_City')::date;
BEGIN
  PERFORM control_private.require_admin();
  IF p_payload->>'id' IS NOT NULL THEN
    SELECT start_date INTO v_start FROM public.control_expenses WHERE id=v_id AND deleted_at IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'El gasto ya no existe.'; END IF;
    v_effective := (p_payload->>'effectiveDate')::date;
    IF v_effective<v_today THEN RAISE EXCEPTION 'Los cambios se aplican desde hoy o una fecha futura.'; END IF;
  ELSE v_start := (p_payload->>'startDate')::date; v_effective := v_start; END IF;
  IF v_effective<v_start OR v_effective>'2100-12-31' THEN RAISE EXCEPTION 'La fecha de vigencia no es válida.'; END IF;
  INSERT INTO public.control_expenses(id,title,description,category,start_date)
  VALUES(v_id,trim(p_payload->>'title'),coalesce(p_payload->>'description',''),trim(p_payload->>'category'),v_start)
  ON CONFLICT(id) DO UPDATE SET title=excluded.title,description=excluded.description,category=excluded.category,updated_at=now();
  INSERT INTO public.control_schedules(expense_id,effective_date,amount_cents,frequency,week_day,month_day,half_day1,half_day2,active)
  VALUES(v_id,v_effective,(p_payload->>'amountCents')::bigint,p_payload->>'frequency',(p_payload->>'weekDay')::int,(p_payload->>'monthDay')::int,(p_payload->>'halfDay1')::int,(p_payload->>'halfDay2')::int,(p_payload->>'active')::boolean)
  ON CONFLICT(expense_id,effective_date) DO UPDATE SET amount_cents=excluded.amount_cents,frequency=excluded.frequency,week_day=excluded.week_day,month_day=excluded.month_day,half_day1=excluded.half_day1,half_day2=excluded.half_day2,active=excluded.active;
  RETURN v_id;
END $$;

CREATE FUNCTION public.control_save_movement(p_payload jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_id uuid := coalesce(nullif(p_payload->>'id','')::uuid,gen_random_uuid());
  v_kind text := p_payload->>'kind'; v_amount bigint := (p_payload->>'amountCents')::bigint;
  v_date date := (p_payload->>'date')::date; v_today date := (now() AT TIME ZONE 'America/Mexico_City')::date;
  v_title text := trim(p_payload->>'title'); v_category text := trim(p_payload->>'category');
  v_source text := 'manual'; v_source_id uuid; v_due date; v_open date; v_last int; v_valid boolean;
  v_existing public.control_movements%ROWTYPE; v_schedule public.control_schedules%ROWTYPE; v_expense public.control_expenses%ROWTYPE;
BEGIN
  PERFORM control_private.require_admin();
  IF v_date>v_today THEN RAISE EXCEPTION 'Un movimiento realizado no puede tener fecha futura.'; END IF;
  IF v_kind NOT IN ('ingreso','egreso','saldo_inicial') THEN RAISE EXCEPTION 'El tipo de movimiento no es válido.'; END IF;
  SELECT * INTO v_existing FROM public.control_movements WHERE id=v_id;
  IF FOUND AND v_existing.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'Este movimiento ya fue eliminado.'; END IF;
  IF v_existing.id IS NOT NULL AND v_existing.kind!=v_kind THEN RAISE EXCEPTION 'El tipo de movimiento no se puede cambiar.'; END IF;
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
  INSERT INTO public.control_movements(id,kind,title,category,amount_cents,date,source_type,source_id,due_date,note,recorded_by)
  VALUES(v_id,v_kind,v_title,v_category,v_amount,v_date,v_source,v_source_id,v_due,coalesce(p_payload->>'note',''),auth.uid())
  ON CONFLICT(id) DO UPDATE SET title=excluded.title,category=excluded.category,amount_cents=excluded.amount_cents,date=excluded.date,note=excluded.note,recorded_by=excluded.recorded_by;
  RETURN v_id;
END $$;

CREATE FUNCTION public.control_delete_record(p_table text,p_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM control_private.require_admin();
  CASE p_table
    WHEN 'tasks' THEN UPDATE public.control_tasks SET deleted_at=now() WHERE id=p_id;
    WHEN 'expenses' THEN UPDATE public.control_expenses SET deleted_at=(now() AT TIME ZONE 'America/Mexico_City')::date WHERE id=p_id;
    WHEN 'movements' THEN
      IF EXISTS(SELECT 1 FROM public.control_movements WHERE id=p_id AND kind='saldo_inicial') THEN RAISE EXCEPTION 'El saldo inicial se edita desde Cuadre.'; END IF;
      UPDATE public.control_movements SET deleted_at=now() WHERE id=p_id;
    ELSE RAISE EXCEPTION 'Tipo de registro no válido.';
  END CASE;
END $$;
CREATE FUNCTION public.control_manage_profile(p_id uuid,p_name text,p_role text,p_active boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(867530901);
  PERFORM control_private.require_admin();
  IF p_id=auth.uid() THEN RAISE EXCEPTION 'Tu propia cuenta se conserva como administrador.'; END IF;
  IF p_role NOT IN ('admin','consulta') THEN RAISE EXCEPTION 'Rol no válido.'; END IF;
  UPDATE public.control_profiles SET name=trim(p_name),role=p_role,active=p_active WHERE id=p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'No se encontró el usuario.'; END IF;
END $$;
-- Sin escritura directa, un usuario de consulta no puede elevar su rol.
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA control_private FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION control_private.is_admin(),control_private.can_read() TO authenticated;
REVOKE ALL ON FUNCTION public.control_save_task(jsonb),public.control_save_expense(jsonb),public.control_save_movement(jsonb),public.control_delete_record(text,uuid),public.control_manage_profile(uuid,text,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.control_save_task(jsonb),public.control_save_expense(jsonb),public.control_save_movement(jsonb),public.control_delete_record(text,uuid),public.control_manage_profile(uuid,text,text,boolean) TO authenticated;
COMMIT;
