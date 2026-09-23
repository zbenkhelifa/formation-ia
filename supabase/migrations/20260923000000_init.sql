-- =====================================================================
-- Formation IA 30 jours — schéma initial
-- Tables : profiles, courses, lessons, purchases, progress
-- Accès : un élève voit les leçons d'une formation seulement s'il l'a achetée
--         (ou si la leçon est en aperçu gratuit). L'admin voit et modifie tout.
-- =====================================================================

-- ---------- Profils (1 ligne par utilisateur Supabase Auth) ----------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text,
  is_admin    boolean not null default false,
  created_at  timestamptz not null default now()
);

-- Crée automatiquement le profil à l'inscription
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, lower(new.email))
  on conflict (id) do nothing;
  -- rattache les achats faits avant la création du compte
  update public.purchases
     set user_id = new.id
   where user_id is null
     and lower(email) = lower(new.email);
  return new;
end;
$$;

-- ---------- Formations ----------
create table if not exists public.courses (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique,
  title            text not null,
  subtitle         text,
  description_md   text,
  price_cents      integer not null default 0 check (price_cents >= 0),
  currency         text not null default 'eur',
  stripe_price_id  text,                 -- price_xxx créé dans Stripe
  published        boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ---------- Leçons ----------
create table if not exists public.lessons (
  id               uuid primary key default gen_random_uuid(),
  course_id        uuid not null references public.courses(id) on delete cascade,
  position         integer not null,     -- = numéro du jour
  title            text not null,
  summary          text,
  content_md       text,
  video_url        text,                 -- YouTube non répertorié, Bunny, Vimeo…
  is_free_preview  boolean not null default false,
  published        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (course_id, position)
);
create index if not exists lessons_course_idx on public.lessons(course_id, position);

-- ---------- Achats (écrits uniquement par le webhook Stripe) ----------
create table if not exists public.purchases (
  id                 uuid primary key default gen_random_uuid(),
  course_id          uuid not null references public.courses(id) on delete restrict,
  user_id            uuid references auth.users(id) on delete set null,
  email              text not null,
  stripe_session_id  text unique,
  stripe_customer_id text,
  amount_cents       integer,
  currency           text,
  status             text not null default 'paid' check (status in ('paid','refunded')),
  created_at         timestamptz not null default now()
);
create index if not exists purchases_email_idx on public.purchases(lower(email));
create index if not exists purchases_user_idx on public.purchases(user_id);

-- Le trigger est créé après la table purchases (il la met à jour)
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Progression ----------
create table if not exists public.progress (
  user_id       uuid not null references auth.users(id) on delete cascade,
  lesson_id     uuid not null references public.lessons(id) on delete cascade,
  completed_at  timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

-- ---------- updated_at automatique ----------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists courses_touch on public.courses;
create trigger courses_touch before update on public.courses
  for each row execute function public.touch_updated_at();
drop trigger if exists lessons_touch on public.lessons;
create trigger lessons_touch before update on public.lessons
  for each row execute function public.touch_updated_at();

-- =====================================================================
-- Fonctions d'accès
-- =====================================================================
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.has_access(p_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or exists (
    select 1 from public.purchases p
     where p.course_id = p_course_id
       and p.status = 'paid'
       and (
         p.user_id = auth.uid()
         or lower(p.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
       )
  );
$$;

-- Programme public (titres + résumés) pour la page de vente, sans le contenu
create or replace function public.course_outline(p_slug text)
returns table (lesson_id uuid, "position" integer, title text, summary text, is_free_preview boolean)
language sql
stable
security definer
set search_path = public
as $$
  select l.id, l.position, l.title, l.summary, l.is_free_preview
    from public.lessons l
    join public.courses c on c.id = l.course_id
   where c.slug = p_slug
     and c.published
     and l.published
   order by l.position;
$$;

grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.has_access(uuid) to anon, authenticated;
grant execute on function public.course_outline(text) to anon, authenticated;

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table public.profiles  enable row level security;
alter table public.courses   enable row level security;
alter table public.lessons   enable row level security;
alter table public.purchases enable row level security;
alter table public.progress  enable row level security;

-- profiles : chacun voit/modifie son profil (sauf is_admin), l'admin voit tout
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid());

-- Empêche un utilisateur de se promouvoir admin lui-même
revoke update on public.profiles from authenticated;
grant update (full_name) on public.profiles to authenticated;

-- courses : formations publiées visibles par tous, admin = tout
drop policy if exists courses_select on public.courses;
create policy courses_select on public.courses
  for select using (published or public.is_admin());

drop policy if exists courses_admin_write on public.courses;
create policy courses_admin_write on public.courses
  for all using (public.is_admin()) with check (public.is_admin());

-- lessons : contenu lisible si aperçu gratuit ou formation achetée
drop policy if exists lessons_select on public.lessons;
create policy lessons_select on public.lessons
  for select using (
    public.is_admin()
    or (
      published
      and exists (select 1 from public.courses c where c.id = course_id and c.published)
      and (is_free_preview or public.has_access(course_id))
    )
  );

drop policy if exists lessons_admin_write on public.lessons;
create policy lessons_admin_write on public.lessons
  for all using (public.is_admin()) with check (public.is_admin());

-- purchases : l'acheteur voit ses achats ; écriture réservée au service_role (webhook)
drop policy if exists purchases_select on public.purchases;
create policy purchases_select on public.purchases
  for select using (
    user_id = auth.uid()
    or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    or public.is_admin()
  );

-- progress : chacun gère sa progression
drop policy if exists progress_select on public.progress;
create policy progress_select on public.progress
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists progress_insert on public.progress;
create policy progress_insert on public.progress
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.lessons l
       where l.id = lesson_id
         and (l.is_free_preview or public.has_access(l.course_id))
    )
  );

drop policy if exists progress_delete on public.progress;
create policy progress_delete on public.progress
  for delete using (user_id = auth.uid());
