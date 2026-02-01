
edit @.cursor/plans/work_email_auth_system_467a2b18.plan.md  plan to not use supabase or jwt for verifying the profile. Only use supabase for the auth and database

---

---


The database will have this structure:

User
- uid
- google email adress
- other useful stuff for users (as in the users from auth)

Profile:
- id
- Name
- Picture (by default link to googleusercontent)
- edge 1to1 user once verified
- work email
- role (enum: student, team_leader, coach, admin)
- edge n-to-1 team
- phone_number
- personal email
- date of birth
- removed access (datetime)
- removed access by (Profile 1to1 edge)

Team:
- team id
- team picture
- team name
- team color


make sure all of them have created at and updated at

---

---


make sure business logic is in nextjs

---