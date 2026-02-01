
We're gonna be creating this schema with a few changes

## Database Schema (Supabase Migrations)

Three tables with RLS policies managed entirely in Supabase:

1. **`users`** - Custom table to sync with auth.users (Google OAuth)
2. **`profiles`** - User profile data with role and team membership
3. **`teams`** - Team information

Use MODDATETIME extension to set the `updated_at` column on every update.

```sql
-- Role enum for profiles
create type public.profile_role as enum ('student', 'team_leader', 'coach', 'admin');

-- Teams table
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  picture text,
  color text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Profiles table (pre-created by admin, linked to user after verification)
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  picture text,  -- defaults to Google profile picture on link
  user_id uuid unique references auth.users(id) on delete set null,  -- linked after OTP verification
  work_email text unique not null,
  role public.profile_role not null default 'student',
  team_id uuid references public.teams(id) on delete set null,
  phone_number text,
  personal_email text,
  date_of_birth date,
  removed_access timestamptz,  -- null = active, set = revoked
  removed_access_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  constraint valid_czu_domain check (
    work_email like '%@studenti.czu.cz' or work_email like '%@pef.czu.cz'
  )
);


-- Indexes for common queries
create index profiles_user_id_idx on public.profiles(user_id);
create index profiles_work_email_idx on public.profiles(work_email);
create index profiles_team_id_idx on public.profiles(team_id);
```

### Entity Relationships

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│   auth.users    │       │    profiles     │       │     teams       │
│  (Supabase)     │       │                 │       │                 │
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ id (uuid)       │◄──┐   │ id (uuid)       │   ┌──►│ id (uuid)       │
│ email (google)  │   │   │ name            │   │   │ name            │
│ ...auth fields  │   └───│ user_id (1:1)   │   │   │ picture         │
└─────────────────┘       │ work_email      │   │   │ color           │
                          │ role (enum)     │   │   │ created_at      │
                          │ team_id (n:1)───┼───┘   │ updated_at      │
                          │ picture         │       └─────────────────┘
                          │ phone_number    │
                          │ personal_email  │
                          │ date_of_birth   │
                          │ removed_access  │
                          │ removed_access_by│──┐
                          │ created_at      │  │
                          │ updated_at      │  │
                          └─────────────────┘  │
                                    ▲          │
                                    └──────────┘ (self-reference)
```


The changes are:

users will not be the existing auth. table but a new one

it will have:

user id
google email
suggested work email
google profile picture
google full name
last otp sent at

make it realtime

make sure that all updated at fields in the whole database work

---

---


Now I need you to make sure that on user creation all of the data gets filled out into users:
google email
full name
google picture

---

---


make sure to apply all migrations using mcp locally

---

---


error saving new user. Use mcp to figure out why

---

---


Good. Now the state in @components/verify-email-form.tsx . I would like to get it from the supabase db.

Make sure to send an update including the suggested_work_email (the email that the otp is sent to) and the timestampt to when it was sent to the db.

Sync down the state and do not save it locally anymore use realtime.

if the otp timestamp doesnt exist or is older than 3600 seconds set the user into email typing mode with prefilled suggested_work_email (if that exists). If its younger than 3600 user is in otp mode



---

---


it doesnt switch me to otp mode

---