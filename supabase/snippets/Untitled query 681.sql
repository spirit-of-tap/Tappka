-- Query 2: Test that user CANNOT update other fields
-- First, capture original values
select
  id,
  google_email,
  google_full_name,
  suggested_work_email,
  last_otp_sent_at
from public.users
where auth_user_id = (select auth.uid());

-- Then attempt to update multiple fields (should only allow suggested_work_email)
-- The trigger will revert google_email and google_full_name changes
update public.users
set
  suggested_work_email = 'another-test@studenti.czu.cz',
  google_email = 'hacked@gmail.com',
  google_full_name = 'Hacked Name'
where auth_user_id = (select auth.uid())
returning
  id,
  google_email,
  google_full_name,
  suggested_work_email,
  last_otp_sent_at;

-- Finally, verify the values to confirm restrictions worked
-- google_email and google_full_name should be unchanged from the first query
select
  id,
  google_email,
  google_full_name,
  suggested_work_email,
  last_otp_sent_at
from public.users
where auth_user_id = (select auth.uid());