-- weekly_store_rankings: 店舗別週間ランキング（同一 guest は自己ベストのみ保持）
create table if not exists public.weekly_store_rankings (
  store_id text not null,
  week_key text not null,
  guest_id text not null,
  nickname text not null,
  best_score_yen integer not null check (best_score_yen >= 0 and best_score_yen <= 300000),
  best_run_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint weekly_store_rankings_guest_id_chk
    check (guest_id ~ '^guest-[0-9]{6}$'),
  constraint weekly_store_rankings_nickname_len_chk
    check (char_length(nickname) between 1 and 20),
  primary key (store_id, week_key, guest_id)
);

-- all_time_best_scores: ゲストごとの歴代自己ベスト
create table if not exists public.all_time_best_scores (
  guest_id text primary key,
  nickname text not null,
  best_score_yen integer not null check (best_score_yen >= 0 and best_score_yen <= 300000),
  achieved_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint all_time_best_scores_guest_id_chk
    check (guest_id ~ '^guest-[0-9]{6}$'),
  constraint all_time_best_scores_nickname_len_chk
    check (char_length(nickname) between 1 and 20)
);

-- 表示専用ビュー（RLS尊重）
create or replace view public.all_time_best_scores_top
with (security_invoker = true)
as
select
  guest_id,
  nickname,
  best_score_yen as score_yen,
  achieved_at
from public.all_time_best_scores;

-- updated_at 自動更新
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_weekly_store_rankings_touch on public.weekly_store_rankings;
create trigger trg_weekly_store_rankings_touch
before update on public.weekly_store_rankings
for each row execute function public.touch_updated_at();

drop trigger if exists trg_all_time_best_scores_touch on public.all_time_best_scores;
create trigger trg_all_time_best_scores_touch
before update on public.all_time_best_scores
for each row execute function public.touch_updated_at();

-- 公開テーブルなので RLS を有効化
alter table public.weekly_store_rankings enable row level security;
alter table public.all_time_best_scores enable row level security;

-- 参照のみ許可。更新は RPC 関数経由に限定する。
drop policy if exists weekly_store_rankings_select_all on public.weekly_store_rankings;
create policy weekly_store_rankings_select_all
on public.weekly_store_rankings
for select
to anon, authenticated
using (true);

drop policy if exists weekly_store_rankings_insert_all on public.weekly_store_rankings;
drop policy if exists weekly_store_rankings_update_all on public.weekly_store_rankings;

drop policy if exists all_time_best_scores_select_all on public.all_time_best_scores;
create policy all_time_best_scores_select_all
on public.all_time_best_scores
for select
to anon, authenticated
using (true);

grant select on public.all_time_best_scores_top to anon, authenticated;

drop policy if exists all_time_best_scores_insert_all on public.all_time_best_scores;
drop policy if exists all_time_best_scores_update_all on public.all_time_best_scores;

-- 匿名クライアントはテーブル直更新を禁止し、RPC経由のみ許可
revoke insert, update, delete on public.weekly_store_rankings from anon, authenticated;
revoke insert, update, delete on public.all_time_best_scores from anon, authenticated;

-- 復元用PIN（平文は保存しない）
create extension if not exists pgcrypto;

create table if not exists public.guest_recovery_credentials (
  guest_id text primary key,
  pin_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_guest_recovery_credentials_touch on public.guest_recovery_credentials;
create trigger trg_guest_recovery_credentials_touch
before update on public.guest_recovery_credentials
for each row execute function public.touch_updated_at();

alter table public.guest_recovery_credentials enable row level security;
drop policy if exists guest_recovery_credentials_select_none on public.guest_recovery_credentials;
create policy guest_recovery_credentials_select_none
on public.guest_recovery_credentials
for select
to anon, authenticated
using (false);

revoke all on public.guest_recovery_credentials from anon, authenticated;

-- スコア送信を一箇所に集約。自己ベスト更新のみ受理し、同点は先達者優先。
create or replace function public.submit_score(
  p_store_id text,
  p_guest_id text,
  p_nickname text,
  p_score_yen integer
)
returns table (
  guest_id text,
  nickname text,
  score_yen integer,
  achieved_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_week_key text;
  v_score integer;
  v_nickname text;
  v_guest_id text;
  v_store_id text;
begin
  v_guest_id := left(trim(coalesce(p_guest_id, '')), 64);
  if char_length(v_guest_id) = 0 then
    raise exception 'invalid guest id';
  end if;
  -- カジュアル運用向け: 端末ごとの既存ID互換を優先し、制御文字のみ拒否する
  if v_guest_id ~ '[[:cntrl:]]' then
    raise exception 'invalid guest id';
  end if;
  if p_score_yen is null or p_score_yen < 0 or p_score_yen > 300000 then
    raise exception 'invalid score';
  end if;
  v_store_id := left(trim(coalesce(p_store_id, '')), 64);
  if char_length(v_store_id) = 0 then
    v_store_id := 'store-default';
  end if;
  v_score := p_score_yen;
  v_nickname := left(regexp_replace(trim(coalesce(p_nickname, '')), '[[:cntrl:]]', '', 'g'), 20);
  if char_length(v_nickname) = 0 then
    v_nickname := 'ゲスト' || right(regexp_replace(v_guest_id, '[^0-9A-Za-z]', '', 'g'), 4);
  end if;
  v_week_key := to_char(v_now, 'IYYY') || '-W' || to_char(v_now, 'IW');

  insert into public.weekly_store_rankings (
    store_id,
    week_key,
    guest_id,
    nickname,
    best_score_yen,
    best_run_at
  ) values (
    v_store_id,
    v_week_key,
    v_guest_id,
    v_nickname,
    v_score,
    v_now
  )
  on conflict on constraint weekly_store_rankings_pkey
  do update set
    nickname = excluded.nickname,
    best_score_yen = greatest(
      public.weekly_store_rankings.best_score_yen,
      excluded.best_score_yen
    ),
    best_run_at = case
      when excluded.best_score_yen > public.weekly_store_rankings.best_score_yen
      then excluded.best_run_at
      else public.weekly_store_rankings.best_run_at
    end;

  insert into public.all_time_best_scores (
    guest_id,
    nickname,
    best_score_yen,
    achieved_at
  ) values (
    v_guest_id,
    v_nickname,
    v_score,
    v_now
  )
  on conflict on constraint all_time_best_scores_pkey
  do update set
    nickname = excluded.nickname,
    best_score_yen = greatest(
      public.all_time_best_scores.best_score_yen,
      excluded.best_score_yen
    ),
    achieved_at = case
      when excluded.best_score_yen > public.all_time_best_scores.best_score_yen
      then excluded.achieved_at
      else public.all_time_best_scores.achieved_at
    end;

  return query
  select
    t.guest_id,
    t.nickname,
    t.best_score_yen as score_yen,
    t.achieved_at
  from public.all_time_best_scores t
  order by t.best_score_yen desc, t.achieved_at asc
  limit 1;
end;
$$;

grant execute on function public.submit_score(text, text, text, integer) to anon, authenticated;

create or replace function public.set_recovery_pin(
  p_guest_id text,
  p_new_pin text,
  p_current_pin text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_guest_id text;
  v_new_pin text;
  v_current_pin text;
  v_existing_hash text;
  v_next_hash text;
begin
  v_guest_id := left(trim(coalesce(p_guest_id, '')), 64);
  if char_length(v_guest_id) = 0 or v_guest_id ~ '[[:cntrl:]]' then
    raise exception 'invalid guest id';
  end if;
  v_new_pin := trim(coalesce(p_new_pin, ''));
  if v_new_pin !~ '^[0-9]{4,6}$' then
    raise exception 'invalid pin';
  end if;
  v_current_pin := trim(coalesce(p_current_pin, ''));

  select c.pin_hash into v_existing_hash
  from public.guest_recovery_credentials c
  where c.guest_id = v_guest_id;

  if v_existing_hash is not null then
    if v_current_pin !~ '^[0-9]{4,6}$' then
      raise exception 'current pin required';
    end if;
    if v_existing_hash <> encode(digest(v_current_pin, 'sha256'), 'hex') then
      raise exception 'current pin mismatch';
    end if;
  end if;

  v_next_hash := encode(digest(v_new_pin, 'sha256'), 'hex');
  insert into public.guest_recovery_credentials (guest_id, pin_hash)
  values (v_guest_id, v_next_hash)
  on conflict on constraint guest_recovery_credentials_pkey
  do update set
    pin_hash = excluded.pin_hash,
    updated_at = now();

  return true;
end;
$$;

grant execute on function public.set_recovery_pin(text, text, text) to anon, authenticated;

create or replace function public.verify_recovery_pin(
  p_guest_id text,
  p_pin text
)
returns table (
  is_valid boolean,
  nickname text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_guest_id text;
  v_pin text;
  v_hash text;
begin
  v_guest_id := left(trim(coalesce(p_guest_id, '')), 64);
  v_pin := trim(coalesce(p_pin, ''));
  if char_length(v_guest_id) = 0 or v_guest_id ~ '[[:cntrl:]]' then
    return query select false, null::text;
    return;
  end if;
  if v_pin !~ '^[0-9]{4,6}$' then
    return query select false, null::text;
    return;
  end if;

  select c.pin_hash into v_hash
  from public.guest_recovery_credentials c
  where c.guest_id = v_guest_id;

  if v_hash is null then
    return query select false, null::text;
    return;
  end if;

  if v_hash <> encode(digest(v_pin, 'sha256'), 'hex') then
    return query select false, null::text;
    return;
  end if;

  return query
  select
    true,
    (
      select a.nickname
      from public.all_time_best_scores a
      where a.guest_id = v_guest_id
      limit 1
    );
end;
$$;

grant execute on function public.verify_recovery_pin(text, text) to anon, authenticated;
