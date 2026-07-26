-- Custom SQL migration file, put your code below! --

-- Refresh updated_at on public.feedback on update (admin archive/respond actions),
-- matching the pattern used by essay_comments/book_comments.
drop trigger if exists feedback_updated_at_trigger on public.feedback;

create trigger feedback_updated_at_trigger
before update on public.feedback
for each row execute function public.handle_updated_at();