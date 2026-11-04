-- Typo- and diacritics-tolerant training session search.
--
-- `unaccent()` is STABLE (it reads a text search dictionary), so it cannot be
-- used inside an index expression or relied on for a stable comparison as-is.
-- The wrapper below pins the dictionary, which makes it IMMUTABLE.
create extension if not exists unaccent with schema public;

create or replace function public.immutable_unaccent(p_text text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select public.unaccent('public.unaccent'::regdictionary, p_text)
$$;

-- A session matches when every word of the query is either a substring of
-- topic/description/published preparation or close enough (pg_trgm word
-- similarity) to one of its words. That makes "priprava", "připrva" and
-- "pripravva" all find "Příprava a reflexe".
create or replace function public.search_training_sessions(p_query text)
returns setof uuid
language sql
stable
security invoker
set search_path = ''
as $$
  with params as (
    select nullif(btrim(public.immutable_unaccent(lower(p_query))), '') as query_text
  ),
  docs as (
    select
      s.id,
      public.immutable_unaccent(lower(
        coalesce(s.topic, '') || ' ' ||
        coalesce(s.description, '') || ' ' ||
        coalesce(p.content_text, '')
      )) as haystack
    from public.training_sessions s
    left join public.training_session_preparations p
      on p.training_session_id = s.id and p.published_at is not null
    where s.removed_at is null
  ),
  tokens as (
    select distinct regexp_split_to_table(params.query_text, '\s+') as token
    from params
    where params.query_text is not null
  )
  select d.id
  from docs d
  where exists (select 1 from tokens)
    and not exists (
      select 1
      from tokens t
      where t.token <> ''
        and d.haystack not like '%' || replace(replace(replace(t.token, '\', '\\'), '%', '\%'), '_', '\_') || '%'
        and public.word_similarity(t.token, d.haystack) < 0.45
    );
$$;

grant execute on function public.search_training_sessions(text) to authenticated;
