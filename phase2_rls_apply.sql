-- =============================================================================
-- phase2_rls_apply.sql  (v2.2)
-- VLUX Phase 2 RLS 強化適用 SQL
-- =============================================================================
-- 実行順:
--   begin -> A.カラム追加 -> B.関数 -> C.関数権限 -> D.整合性制約 ->
--   E.トリガ -> F.ポリシー削除 -> G〜K.ポリシー作成 -> commit
-- 注意: このSQL適用 = β投入 OK ではない。
--      Express JWT 認証ミドルウェア導入 + Service Role 段階解消が別途必要。
-- =============================================================================

begin;

-- =============================================================================
-- A. カラム追加（関数が参照するため最先頭）
-- =============================================================================

alter table public.patients
  add column if not exists deleted_at    timestamptz,
  add column if not exists deleted_by    uuid references auth.users(id),
  add column if not exists delete_reason text;

alter table public.visits
  add column if not exists updated_at    timestamptz default now(),
  add column if not exists updated_by    uuid references auth.users(id),
  add column if not exists deleted_at    timestamptz,
  add column if not exists deleted_by    uuid references auth.users(id),
  add column if not exists delete_reason text;

alter table public.health_data
  add column if not exists deleted_at    timestamptz,
  add column if not exists deleted_by    uuid references auth.users(id),
  add column if not exists delete_reason text;

alter table public.staffs
  add column if not exists user_id uuid references auth.users(id);


-- =============================================================================
-- B. ヘルパー関数（SECURITY DEFINER でメンバーシップ判定 + 各種トリガ関数）
-- =============================================================================

-- B-1. 自院アクセス判定（owner または active staff）
create or replace function public.vlux_can_access_clinic(target_clinic_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select
    target_clinic_id is not null
    and auth.uid() is not null
    and (
      exists (
        select 1 from public.clinics
         where id = target_clinic_id and owner_id = auth.uid()
      )
      or exists (
        select 1 from public.staffs
         where clinic_id = target_clinic_id
           and user_id  = auth.uid()
           and is_active = true
      )
    );
$$;
comment on function public.vlux_can_access_clinic(uuid) is
  '現 auth.uid() が target_clinic_id の owner または active staff か (SECURITY DEFINER)';

-- B-2. 患者本人判定
create or replace function public.vlux_owns_patient(target_patient_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select
    target_patient_id is not null
    and auth.uid() is not null
    and exists (
      select 1 from public.patients
       where id = target_patient_id
         and user_id = auth.uid()
         and deleted_at is null
    );
$$;
comment on function public.vlux_owns_patient(uuid) is
  '現 auth.uid() が target_patient_id の本人か (SECURITY DEFINER)';

-- B-3. 患者の担当院メンバー判定
create or replace function public.vlux_can_access_patient(target_patient_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select
    target_patient_id is not null
    and auth.uid() is not null
    and exists (
      select 1 from public.patients p
       where p.id = target_patient_id
         and p.deleted_at is null
         and public.vlux_can_access_clinic(p.clinic_id)
    );
$$;
comment on function public.vlux_can_access_patient(uuid) is
  '現 auth.uid() が target_patient_id の担当院メンバーか (SECURITY DEFINER)';

-- B-4. visits 更新監査トリガ用
create or replace function public.vlux_set_updated_audit()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

-- B-5. 論理削除監査トリガ用（deleted_by を auth.uid() で強制上書き）
create or replace function public.vlux_set_deleted_audit()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if (old.deleted_at is null) and (new.deleted_at is not null) then
    new.deleted_by := auth.uid();
  end if;
  return new;
end;
$$;
comment on function public.vlux_set_deleted_audit() is
  'deleted_at が NULL→NOT NULL に遷移する時点で deleted_by を auth.uid() で強制上書き';

-- B-6. visits identity 不変トリガ
create or replace function public.vlux_prevent_visit_identity_change()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.clinic_id is distinct from old.clinic_id then
    raise exception
      'visits.clinic_id の変更は禁止されています (old=%, new=%)',
      old.clinic_id, new.clinic_id
      using errcode = '42501';
  end if;
  if new.patient_id is distinct from old.patient_id then
    raise exception
      'visits.patient_id の変更は禁止されています (old=%, new=%)',
      old.patient_id, new.patient_id
      using errcode = '42501';
  end if;
  return new;
end;
$$;
comment on function public.vlux_prevent_visit_identity_change() is
  'visits の clinic_id / patient_id 変更を BEFORE UPDATE で拒否';

-- B-7. health_data identity 不変トリガ
create or replace function public.vlux_prevent_health_data_identity_change()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.patient_id is distinct from old.patient_id then
    raise exception
      'health_data.patient_id の変更は禁止されています (old=%, new=%)',
      old.patient_id, new.patient_id
      using errcode = '42501';
  end if;
  if new.recorded_date is distinct from old.recorded_date then
    raise exception
      'health_data.recorded_date の変更は禁止されています (old=%, new=%)',
      old.recorded_date, new.recorded_date
      using errcode = '42501';
  end if;
  if new.source is distinct from old.source then
    raise exception
      'health_data.source の変更は禁止されています (old=%, new=%)',
      old.source, new.source
      using errcode = '42501';
  end if;
  return new;
end;
$$;
comment on function public.vlux_prevent_health_data_identity_change() is
  'health_data の patient_id / recorded_date / source 変更を BEFORE UPDATE で拒否';

-- B-8. patients clinic 不変トリガ（Phase 1 院間移管なし）
create or replace function public.vlux_prevent_patient_clinic_change()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.clinic_id is distinct from old.clinic_id then
    raise exception
      'patients.clinic_id の変更は禁止されています (old=%, new=%)。Phase 1 では院間移管をサポートしません',
      old.clinic_id, new.clinic_id
      using errcode = '42501';
  end if;
  return new;
end;
$$;
comment on function public.vlux_prevent_patient_clinic_change() is
  'patients.clinic_id の変更を BEFORE UPDATE で拒否。Phase 1 院間移管なし';


-- =============================================================================
-- C. SECURITY DEFINER 関数の権限（public REVOKE -> authenticated/service_role GRANT）
-- =============================================================================

revoke all on function public.vlux_can_access_clinic(uuid)  from public;
revoke all on function public.vlux_owns_patient(uuid)        from public;
revoke all on function public.vlux_can_access_patient(uuid)  from public;

grant execute on function public.vlux_can_access_clinic(uuid)  to authenticated, service_role;
grant execute on function public.vlux_owns_patient(uuid)        to authenticated, service_role;
grant execute on function public.vlux_can_access_patient(uuid)  to authenticated, service_role;


-- =============================================================================
-- D. health_data 整合性制約（UNIQUE INDEX + source CHECK）
-- =============================================================================

create unique index if not exists health_data_patient_date_source_uidx
  on public.health_data(patient_id, recorded_date, source);

alter table public.health_data
  drop constraint if exists health_data_source_check;
alter table public.health_data
  add constraint health_data_source_check
  check (source is not null and source in ('healthkit', 'googlefit', 'manual_clinic'));


-- =============================================================================
-- E. トリガ設定（v1 残骸の防御的掃除 + v2.2 のトリガ作成）
-- =============================================================================

-- E-0. v1 で出ていた可能性のある旧トリガ名の防御的 DROP
drop trigger if exists set_updated_audit on public.visits;

-- E-1. visits（3 本: identity 不変 -> 更新監査 -> 論理削除監査）
drop trigger if exists tg_visits_01_prevent_identity_change on public.visits;
create trigger tg_visits_01_prevent_identity_change
  before update on public.visits
  for each row execute function public.vlux_prevent_visit_identity_change();

drop trigger if exists tg_visits_02_set_updated_audit on public.visits;
create trigger tg_visits_02_set_updated_audit
  before update on public.visits
  for each row execute function public.vlux_set_updated_audit();

drop trigger if exists tg_visits_03_set_deleted_audit on public.visits;
create trigger tg_visits_03_set_deleted_audit
  before update on public.visits
  for each row execute function public.vlux_set_deleted_audit();

-- E-2. patients（2 本: clinic_id 不変 -> 論理削除監査）
drop trigger if exists tg_patients_00_prevent_clinic_change on public.patients;
create trigger tg_patients_00_prevent_clinic_change
  before update on public.patients
  for each row execute function public.vlux_prevent_patient_clinic_change();

drop trigger if exists tg_patients_01_set_deleted_audit on public.patients;
create trigger tg_patients_01_set_deleted_audit
  before update on public.patients
  for each row execute function public.vlux_set_deleted_audit();

-- E-3. health_data（2 本: identity 不変 -> 論理削除監査）
drop trigger if exists tg_health_data_00_prevent_identity_change on public.health_data;
create trigger tg_health_data_00_prevent_identity_change
  before update on public.health_data
  for each row execute function public.vlux_prevent_health_data_identity_change();

drop trigger if exists tg_health_data_01_set_deleted_audit on public.health_data;
create trigger tg_health_data_01_set_deleted_audit
  before update on public.health_data
  for each row execute function public.vlux_set_deleted_audit();


-- =============================================================================
-- F. 既存ポリシー + 新ポリシー名の事前 DROP（完全冪等化）
-- =============================================================================

-- F-1. 旧（設計SQL #1）の撤去
drop policy if exists "院オーナーのみ参照可"                on public.clinics;
drop policy if exists "院オーナーのみ更新可"                on public.clinics;
drop policy if exists "自院の患者のみ参照可"                on public.patients;
drop policy if exists "自院の患者のみ更新可"                on public.patients;
drop policy if exists "自院に患者を登録可"                  on public.patients;
drop policy if exists "患者本人は自分を参照可"              on public.patients;
drop policy if exists "自院の来院記録のみ参照可"            on public.visits;
drop policy if exists "自院に来院記録を登録可"              on public.visits;
drop policy if exists "患者本人は自分の来院記録を参照可"    on public.visits;
drop policy if exists "患者本人は自分の健康データを参照可"  on public.health_data;
drop policy if exists "患者本人は自分の健康データを登録可"  on public.health_data;
drop policy if exists "担当医院は患者の健康データを参照可"  on public.health_data;

-- F-2. 新ポリシー名も先に DROP（再実行時の衝突回避）
drop policy if exists "院オーナーは自院を参照可"                  on public.clinics;
drop policy if exists "院オーナーは自院を新規登録可"              on public.clinics;
drop policy if exists "院オーナーは自院を更新可"                  on public.clinics;

drop policy if exists "自院メンバーは患者を参照可"                on public.patients;
drop policy if exists "患者本人は自分を参照可"                    on public.patients;
drop policy if exists "自院メンバーは患者を登録可"                on public.patients;
drop policy if exists "自院メンバーは患者を更新可"                on public.patients;

drop policy if exists "自院メンバーは来院記録を参照可"            on public.visits;
drop policy if exists "患者本人は自分の来院記録を参照可"          on public.visits;
drop policy if exists "自院メンバーは来院記録を登録可"            on public.visits;
drop policy if exists "自院メンバーは来院記録を更新可"            on public.visits;

drop policy if exists "患者本人は自分の健康データを参照可"        on public.health_data;
drop policy if exists "自院メンバーは患者の健康データを参照可"    on public.health_data;
drop policy if exists "患者本人は自分の健康データを登録可"        on public.health_data;
drop policy if exists "自院メンバーは患者の健康データを手動登録可" on public.health_data;
drop policy if exists "患者本人は自分の健康データを更新可"        on public.health_data;
drop policy if exists "自院メンバーは患者の健康データを手動更新可" on public.health_data;

drop policy if exists "自院メンバーはスタッフを参照可"            on public.staffs;
drop policy if exists "院オーナーはスタッフを登録可"              on public.staffs;
drop policy if exists "院オーナーはスタッフを更新可"              on public.staffs;


-- =============================================================================
-- G. clinics ポリシー
-- =============================================================================

create policy "院オーナーは自院を参照可"
  on public.clinics for select
  to authenticated
  using (owner_id is not null and owner_id = auth.uid());

create policy "院オーナーは自院を新規登録可"
  on public.clinics for insert
  to authenticated
  with check (owner_id is not null and owner_id = auth.uid());

create policy "院オーナーは自院を更新可"
  on public.clinics for update
  to authenticated
  using       (owner_id is not null and owner_id = auth.uid())
  with check  (owner_id is not null and owner_id = auth.uid());


-- =============================================================================
-- H. patients ポリシー
-- =============================================================================

create policy "自院メンバーは患者を参照可"
  on public.patients for select
  to authenticated
  using (deleted_at is null and public.vlux_can_access_clinic(clinic_id));

create policy "患者本人は自分を参照可"
  on public.patients for select
  to authenticated
  using (deleted_at is null and user_id is not null and user_id = auth.uid());

create policy "自院メンバーは患者を登録可"
  on public.patients for insert
  to authenticated
  with check (public.vlux_can_access_clinic(clinic_id));

create policy "自院メンバーは患者を更新可"
  on public.patients for update
  to authenticated
  using      (deleted_at is null and public.vlux_can_access_clinic(clinic_id))
  with check (public.vlux_can_access_clinic(clinic_id));
-- 注: clinic_id 付け替えは tg_patients_00_prevent_clinic_change で禁止


-- =============================================================================
-- I. visits ポリシー
-- =============================================================================

create policy "自院メンバーは来院記録を参照可"
  on public.visits for select
  to authenticated
  using (deleted_at is null and public.vlux_can_access_clinic(clinic_id));

create policy "患者本人は自分の来院記録を参照可"
  on public.visits for select
  to authenticated
  using (deleted_at is null and public.vlux_owns_patient(patient_id));

create policy "自院メンバーは来院記録を登録可"
  on public.visits for insert
  to authenticated
  with check (public.vlux_can_access_clinic(clinic_id));

create policy "自院メンバーは来院記録を更新可"
  on public.visits for update
  to authenticated
  using      (deleted_at is null and public.vlux_can_access_clinic(clinic_id))
  with check (public.vlux_can_access_clinic(clinic_id));
-- 注: clinic_id / patient_id 付け替えは tg_visits_01_prevent_identity_change で禁止


-- =============================================================================
-- J. health_data ポリシー
-- =============================================================================

-- SELECT
create policy "患者本人は自分の健康データを参照可"
  on public.health_data for select
  to authenticated
  using (deleted_at is null and public.vlux_owns_patient(patient_id));

create policy "自院メンバーは患者の健康データを参照可"
  on public.health_data for select
  to authenticated
  using (deleted_at is null and public.vlux_can_access_patient(patient_id));

-- INSERT
create policy "患者本人は自分の健康データを登録可"
  on public.health_data for insert
  to authenticated
  with check (
    source in ('healthkit', 'googlefit')
    and public.vlux_owns_patient(patient_id)
  );

create policy "自院メンバーは患者の健康データを手動登録可"
  on public.health_data for insert
  to authenticated
  with check (
    source = 'manual_clinic'
    and public.vlux_can_access_patient(patient_id)
  );

-- UPDATE
create policy "患者本人は自分の健康データを更新可"
  on public.health_data for update
  to authenticated
  using (
    deleted_at is null
    and source in ('healthkit', 'googlefit')
    and public.vlux_owns_patient(patient_id)
  )
  with check (
    source in ('healthkit', 'googlefit')
    and public.vlux_owns_patient(patient_id)
  );

create policy "自院メンバーは患者の健康データを手動更新可"
  on public.health_data for update
  to authenticated
  using (
    deleted_at is null
    and source = 'manual_clinic'
    and public.vlux_can_access_patient(patient_id)
  )
  with check (
    source = 'manual_clinic'
    and public.vlux_can_access_patient(patient_id)
  );
-- 注: patient_id / recorded_date / source 付け替えは
--     tg_health_data_00_prevent_identity_change で禁止


-- =============================================================================
-- K. staffs ポリシー（既存 service_role_all は維持）
-- TODO[Phase 2.x]: role 別ポリシー（owner/staff/reception）に分割予定
-- =============================================================================

create policy "自院メンバーはスタッフを参照可"
  on public.staffs for select
  to authenticated
  using (public.vlux_can_access_clinic(clinic_id));

create policy "院オーナーはスタッフを登録可"
  on public.staffs for insert
  to authenticated
  with check (
    clinic_id in (
      select id from public.clinics
       where owner_id = auth.uid() and owner_id is not null
    )
  );

create policy "院オーナーはスタッフを更新可"
  on public.staffs for update
  to authenticated
  using (
    clinic_id in (
      select id from public.clinics
       where owner_id = auth.uid() and owner_id is not null
    )
  )
  with check (
    clinic_id in (
      select id from public.clinics
       where owner_id = auth.uid() and owner_id is not null
    )
  );


commit;
