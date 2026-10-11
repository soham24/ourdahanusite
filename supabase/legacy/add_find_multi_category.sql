-- find: allow a professional to have multiple categories
alter table find_professionals add column if not exists professions text[];

update find_professionals
  set professions = array[profession]
  where profession is not null and professions is null;

alter table find_professionals alter column professions set not null;

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'find_professionals_professions_nonempty'
  ) then
    alter table find_professionals
      add constraint find_professionals_professions_nonempty check (cardinality(professions) >= 1);
  end if;
end $$;

alter table find_professionals drop column if exists profession;

drop index if exists find_professionals_public_idx;
create index if not exists find_professionals_status_active_idx
  on find_professionals (status, is_active);
create index if not exists find_professionals_professions_gin
  on find_professionals using gin (professions);
