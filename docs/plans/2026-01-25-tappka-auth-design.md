# Tappka Authentication System Design

**Date:** 2026-01-25  
**Status:** Approved  
**Author:** Claude + User collaboration

## Overview

Tappka is a student portal for Tiimiakatemia Prague (TAP) students. This design covers the authentication and verification system that allows students, coaches, and admins to access the platform.

## User Roles

| Role | Description | Team Required |
|------|-------------|---------------|
| Student | Regular TAP student | Yes |
| Team Leader | Leads a team company (tymova firma) | Yes |
| Coach | Program coach/mentor | No |
| Admin | Full system access, user management | No |

## Authentication Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Landing    │     │  Register    │     │    Login     │
│   Page (/)   │────▶│  /auth/      │────▶│   Success    │
│              │     │  sign-up     │     │              │
└──────────────┘     └──────────────┘     └──────┬───────┘
                                                  │
                                                  ▼
                                          ┌──────────────┐
                                          │  Is user     │
                                          │  verified?   │
                                          └──────┬───────┘
                                                 │
                              ┌──────────────────┼──────────────────┐
                              │ NO               │                  │ YES
                              ▼                  │                  ▼
                     ┌──────────────┐            │         ┌──────────────┐
                     │   /verify    │            │         │  /dashboard  │
                     │  Enter school│            │         │              │
                     │    email     │            │         └──────────────┘
                     └──────┬───────┘            │
                            │                    │
                            ▼                    │
                     ┌──────────────┐            │
                     │ Email in pre-│            │
                     │ registered?  │            │
                     └──────┬───────┘            │
                            │ YES                │
                            ▼                    │
                     ┌──────────────┐            │
                     │ Send code to │            │
                     │ school email │            │
                     └──────┬───────┘            │
                            │                    │
                            ▼                    │
                     ┌──────────────┐            │
                     │ Enter code   │────────────┘
                     │ → Verified!  │
                     └──────────────┘
```

### Flow Description

1. **Registration** - User registers with personal email (Gmail, etc.), password, full name, role, and team (if applicable)
2. **Login** - User logs in with personal email
3. **Verification Check** - System checks if user is verified
4. **School Email Verification** - Unverified users must:
   - Enter their school email (@pef.czu.cz)
   - System checks if email is in pre-registered list
   - If valid, sends 6-digit verification code
   - User enters code to complete verification
5. **Access Granted** - Verified users access the dashboard

## Database Schema

### Tables

#### `profiles`
Extended user info linked to Supabase auth.users

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | UUID (PK, FK → auth.users.id) | No | Links to Supabase auth |
| full_name | TEXT | No | User's display name |
| role | ENUM ('student', 'team_leader', 'coach', 'admin') | No | User role |
| team_id | UUID (FK → teams.id) | Yes | Assigned team (students/team leaders only) |
| is_verified | BOOLEAN | No | School email verified? Default: false |
| school_email | TEXT | Yes | Verified school email |
| locale | TEXT | No | Preferred language ('cs', 'en'). Default: 'cs' |
| created_at | TIMESTAMPTZ | No | Registration time |
| updated_at | TIMESTAMPTZ | No | Last update time |

#### `teams`
Team companies (tymove firmy)

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | UUID (PK) | No | Team identifier |
| name | TEXT | No | Team name |
| year | INTEGER | No | Cohort year (1, 2, 3) |
| is_active | BOOLEAN | No | Still active team? Default: true |
| created_at | TIMESTAMPTZ | No | Creation time |

#### `pre_registered_emails`
Admin-imported student list from Excel

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | UUID (PK) | No | Record identifier |
| email | TEXT (unique) | No | School email from Excel |
| team_id | UUID (FK → teams.id) | No | Assigned team |
| role | ENUM | No | Expected role |
| full_name | TEXT | Yes | Name from Excel (optional) |
| claimed_by | UUID (FK → profiles.id) | Yes | User who claimed this email |
| claimed_at | TIMESTAMPTZ | Yes | When claimed |
| created_at | TIMESTAMPTZ | No | Import time |

#### `verification_codes`
Temporary codes for school email verification

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | UUID (PK) | No | Code identifier |
| user_id | UUID (FK → profiles.id) | No | Who requested |
| school_email | TEXT | No | Email to verify |
| code | TEXT | No | 6-digit code |
| expires_at | TIMESTAMPTZ | No | Code expiration (10-15 min) |
| attempts | INTEGER | No | Failed attempts count. Default: 0 |
| used | BOOLEAN | No | Already used? Default: false |
| created_at | TIMESTAMPTZ | No | Creation time |

### Database Trigger

On new user signup (auth.users insert), automatically create a profile record:

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role, is_verified, created_at, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'student'),
    FALSE,
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

## UI Screens

### 1. Landing Page (`/`)

Minimal design with Tappka branding:
- Tappka logo/name
- Subtitle: "Studentsky portal Tiimiakatemia"
- Login form (email, password)
- "Prihlasit se" button (TAP Red)
- "Nemas ucet? Zaregistrovat se" link
- Language toggle (CZ/EN)

### 2. Registration Page (`/auth/sign-up`)

Form fields:
- Full name (required)
- Email (required) - personal email for login
- Password (required)
- Role dropdown (required): Student, Team Leader, Coach, Admin
- Team dropdown (required if Student/Team Leader): List of active teams
- "Zaregistrovat se" button
- "Uz mas ucet? Prihlasit se" link

### 3. Verification Page (`/verify`)

**Step 1: Enter school email**
- Heading: "Overeni skolniho emailu"
- Explanation text
- School email input
- "Odeslat overovaci kod" button

**Step 2: Enter code**
- Heading: "Zadej overovaci kod"
- Show target email
- 6-digit code input (individual boxes)
- "Overit" button
- "Neprisel kod? Poslat znovu" link with cooldown

## Route Structure

### Public Routes (no auth required)
- `/` - Landing page (redirects if logged in)
- `/auth/sign-up` - Registration
- `/auth/forgot-password` - Password reset request
- `/auth/update-password` - Set new password

### Semi-Protected Routes (auth required, verification optional)
- `/verify` - School email verification

### Protected Routes (auth + verification required)
- `/dashboard` - Main dashboard
- `/admin/*` - Admin-only pages

## Internationalization (i18n)

Support for Czech (default) and English:
- Auto-detect browser language
- Manual toggle available
- Store preference in user profile (locale field)

## API Endpoints

### `POST /api/verify/send-code`
Send verification code to school email.

**Request:**
```json
{
  "school_email": "jan.novak@pef.czu.cz"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Code sent"
}
```

**Errors:**
- 400: Email not in pre-registered list
- 400: Email already claimed
- 429: Too many requests (rate limit)

### `POST /api/verify/check-code`
Validate verification code.

**Request:**
```json
{
  "school_email": "jan.novak@pef.czu.cz",
  "code": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "verified": true
}
```

**Errors:**
- 400: Invalid code
- 400: Code expired
- 400: Too many attempts

## Security Considerations

1. **Rate limiting** - Max 3 code requests per hour per user
2. **Code expiration** - Codes expire after 15 minutes
3. **Attempt limiting** - Max 5 failed attempts per code
4. **Email validation** - Only pre-registered school emails accepted
5. **RLS policies** - Row-level security on all tables

## Out of Scope (Future)

- Admin Excel import UI
- Room reservation system
- Essay storage
- Meeting management
- Admin dashboard for user management
