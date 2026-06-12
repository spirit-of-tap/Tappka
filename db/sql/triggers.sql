-- Current-state reference for all app-owned triggers (public tables + auth.users).
-- NOT applied automatically. To change a trigger:
--   1. Edit it here.
--   2. pnpm db:generate:custom  (creates an empty migration)
--   3. Paste a DROP TRIGGER IF EXISTS ... ; CREATE TRIGGER statement into that migration.
-- Extracted from the live schema on 2026-06-12.

CREATE TRIGGER link_user_to_profile_trigger AFTER UPDATE OF email ON auth.users FOR EACH ROW WHEN (((old.email)::text IS DISTINCT FROM (new.email)::text)) EXECUTE FUNCTION link_user_to_profile();

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_auth_user();

CREATE TRIGGER set_verified_work_email_on_change_trigger AFTER UPDATE OF email, email_change ON auth.users FOR EACH ROW WHEN ((((old.email)::text IS DISTINCT FROM (new.email)::text) OR ((old.email_change)::text IS DISTINCT FROM (new.email_change)::text))) EXECUTE FUNCTION set_verified_work_email_on_change();

CREATE TRIGGER validate_czu_email_domain_trigger BEFORE UPDATE OF email, email_change ON auth.users FOR EACH ROW EXECUTE FUNCTION validate_czu_email_domain_trigger();

CREATE TRIGGER book_comments_updated_at_trigger BEFORE UPDATE ON public.book_comments FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER books_protect_approved_trigger BEFORE UPDATE ON public.books FOR EACH ROW EXECUTE FUNCTION protect_approved_book();

CREATE TRIGGER books_updated_at_trigger BEFORE UPDATE ON public.books FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER essay_comments_updated_at_trigger BEFORE UPDATE ON public.essay_comments FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER essay_views_after_insert_trigger AFTER INSERT ON public.essay_views FOR EACH ROW EXECUTE FUNCTION handle_essay_view_insert();

CREATE TRIGGER essay_votes_change_trigger AFTER INSERT OR DELETE ON public.essay_votes FOR EACH ROW EXECUTE FUNCTION handle_essay_vote_change();

CREATE TRIGGER essays_updated_at_trigger BEFORE UPDATE ON public.essays FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER broadcast_profile_link_change_trigger AFTER UPDATE OF user_id ON public.profiles FOR EACH ROW WHEN (((old.user_id IS NULL) AND (new.user_id IS NOT NULL))) EXECUTE FUNCTION broadcast_profile_link_change();

CREATE TRIGGER enforce_picture_only_update BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION validate_picture_only_update();

CREATE TRIGGER profiles_updated_at_trigger BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER update_reservations_updated_at BEFORE UPDATE ON public.reservations FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER team_reading_lists_updated_at_trigger BEFORE UPDATE ON public.team_reading_lists FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER teams_updated_at_trigger BEFORE UPDATE ON public.teams FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER broadcast_verified_work_email_change_trigger AFTER UPDATE OF verified_work_email ON public.users FOR EACH ROW WHEN ((old.verified_work_email IS DISTINCT FROM new.verified_work_email)) EXECUTE FUNCTION broadcast_verified_work_email_change();

CREATE TRIGGER users_update_restriction_trigger BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION handle_user_update_restriction();

CREATE TRIGGER users_updated_at_trigger BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
