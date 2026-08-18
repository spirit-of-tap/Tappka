-- Custom SQL migration file, put your code below! --

-- Keep mutable document metadata timestamps consistent with the rest of the app.
drop trigger if exists team_documents_updated_at_trigger on public.team_documents;

create trigger team_documents_updated_at_trigger
before update on public.team_documents
for each row
execute function public.handle_updated_at();
