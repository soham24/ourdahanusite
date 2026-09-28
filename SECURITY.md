# Security Policy

## Reporting a vulnerability

**Please do not open a public issue for a security problem.**

Report it privately through GitHub's
[Report a vulnerability](https://github.com/soham24/ourdahanusite/security/advisories/new)
form, which opens a draft advisory only the maintainers can see.

Please include what you found, the steps to reproduce it, and what an attacker
could do with it. You will get an acknowledgement within a few days. Once a fix
is out, you are welcome to write about it, and you will be credited in the
advisory unless you would rather not be.

OurDahanu is run by one person for one town, so there is no bounty programme —
but reports are genuinely appreciated and taken seriously.

## Scope

This repository is the code behind the live site at ourdahanu.in, which holds
real accounts, real businesses and real payments.

**In scope:** anything in this repository — the Next.js app, the server
actions, the API routes, the SQL migrations under `supabase/`, and the row
level security policies they define.

**Please do not**, while testing against ourdahanu.in:

- access, modify or delete data belonging to anyone else
- run automated scanners, load tests, or anything that degrades the service
- attempt social engineering against users, business owners or staff
- make real payments or place real orders to demonstrate a flaw

Test against your own local instance wherever possible; `README.md` has the
setup. If a finding genuinely cannot be shown without touching production, say
so in the report and stop before causing any effect.

## What is already known

Some things look like findings but are deliberate, and are documented so you
do not spend time on them:

- **`NEXT_PUBLIC_SUPABASE_ANON_KEY` is public.** It ships in the browser
  bundle by design. Row level security, not the key, is the access boundary.
  A way to read or write data the RLS policies should have refused *is* a
  finding, and an important one.
- **`public_profiles` exposes the id, display name and avatar of every
  account.** That is what puts a name on a review. The underlying `profiles`
  table is restricted to each user's own row.
- **Business subdomains serve the main app.** `anything.ourdahanu.in` is the
  same deployment; only the business page is rewritten.
