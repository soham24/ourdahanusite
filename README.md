# OurDahanu

A website for one town: a directory where every business gets its own
subdomain, plus a jobs board, a professionals directory, appointment booking,
and online ordering paid straight into each business's own account.

It runs **[ourdahanu.in](https://ourdahanu.in)** for Dahanu, Maharashtra
(65 businesses, around 500 residents signed up), and it is built so you can
run the same thing for your town: OurPune, OurNashik, OurWherever.

---

## 1. Try it on your computer

You need **Node.js 24** and **Docker**. No accounts, no keys.

```bash
git clone https://github.com/soham24/ourdahanusite.git ourtown
cd ourtown
npm install
npm run setup     # starts a local database with sample data, writes .env.local
npm run dev
```

Open <http://localhost:3000>. You get the full site with sample businesses,
events and tradespeople.

To sign in as admin: go to `/login`, type `admin@example.com` under
"Local development only", then click the link in the local inbox at
<http://127.0.0.1:54324>.

Something not working? Run **`npm run doctor`**. It checks your setup and
tells you what to fix, in plain words.

<details>
<summary>No Docker?</summary>

Use a free [Supabase](https://supabase.com) project instead: paste the files in
`supabase/migrations/` into its SQL editor in filename order (then
`supabase/seed.sql` for sample data), copy `.env.local.example` to
`.env.local`, and fill in the project's URL, anon key and service-role key.
Signing in that way needs Google set up first: [SETUP.md](SETUP.md), steps 1–5.
</details>

## 2. Make it your town

Three files, then one check:

1. **[`src/lib/site-config.ts`](src/lib/site-config.ts)**: the name, town,
   domain and nearby places. Every page, email and link reads from here.

   ```ts
   name: 'OurDahanu',        // -> 'OurPune'
   town: 'Dahanu',           // -> 'Pune'
   domain: 'ourdahanu.in',   // -> 'ourpune.in'
   ```

   Then run **`npm run sync:proxy`**, which copies the new domain into the
   subdomain routing (Next.js can't read it from the config).

2. **[`src/content/local.ts`](src/content/local.ts)**: your town's emergency
   numbers, flood zones and contact details. **Do this one carefully**: a
   wrong emergency number is the worst bug this site can have.

3. **The rest of the local content**: guides, the homepage team, the about
   page and a few others. [SETUP.md step 8](SETUP.md) lists every file.

Then run **`npm run doctor`** again. On a copy with its own domain, it lists
anything still carrying Dahanu's content, and fails while the emergency
numbers are still Dahanu's.

## 3. Put it online

**On Vercel** (easiest):

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fsoham24%2Fourdahanusite&project-name=our-town&repository-name=our-town&integration-ids=oac_VqOgBHqhEoFTPzGkPd7L0iH6&env=NEXT_PUBLIC_SITE_URL%2CADMIN_EMAIL%2CCRON_SECRET&envDescription=Your%20site%20address%20%28use%20https%3A%2F%2F%3Cproject%3E.vercel.app%20until%20you%20add%20a%20domain%29%2C%20the%20Google%20email%20that%20becomes%20the%20first%20admin%2C%20and%20any%20long%20random%20string%20for%20the%20scheduled%20jobs.&envLink=https%3A%2F%2Fgithub.com%2Fsoham24%2Fourdahanusite%2Fblob%2Fmain%2FSETUP.md%23step-4-set-environment-variables)

The button copies this repository, creates a Supabase database for it, asks
for three values and deploys. Then:

1. **Load the database tables:** `npm run db:link -- --project-ref <id>`,
   then `npm run db:push` (or paste `supabase/migrations/` into the SQL
   editor).
2. **Turn on Google sign-in** in Supabase (SETUP.md steps 3 and 6).
3. **Check it:** `vercel env pull .env.local`, then `npm run doctor`.

**Anywhere else**, with Docker:

```bash
docker compose --env-file .env.local up --build -d
```

[SETUP.md → Hosting without Vercel](SETUP.md#hosting-without-vercel) covers
the scheduled jobs and business subdomains.

**Optional services** (payments with Razorpay, email with Resend, Telegram,
WhatsApp, analytics) each switch on when their keys are set, and nothing
breaks without them. `.env.local.example` lists every setting with a comment;
[SETUP.md](SETUP.md) walks through each service.

---

## Reference

### Commands

```bash
npm run setup        # local database + sample data, and .env.local to match
npm run dev          # development server
npm run doctor       # check your setup and leftover Dahanu content; changes nothing
npm run sync:proxy   # after changing `domain` in site-config.ts

npm test             # unit and security tests
npm run test:e2e     # browser smoke test (needs `npm start` running)
npm run build        # production build
npm run lint         # eslint
npx tsc --noEmit     # types

npm run db:reset     # local database back to migrations + sample data
npm run db:stop      # stop the local database
npm run db:link -- --project-ref <id>   # point at a hosted Supabase project
npm run db:push      # apply new migrations to it
```

### Docs

| Read | When |
|---|---|
| [SETUP.md](SETUP.md) | Setting up a real deployment, step by step |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Before changing how something works |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Before opening a pull request |
| [docs/EMAIL-AND-NOTIFICATIONS.md](docs/EMAIL-AND-NOTIFICATIONS.md) | Setting up email, Telegram or WhatsApp |
| [docs/DATABASE-MIGRATIONS.md](docs/DATABASE-MIGRATIONS.md) | Changing the database, or applying changes automatically |
| [SECURITY.md](SECURITY.md) | Reporting a vulnerability (privately, please) |

### How it is built

**Next.js 16** · **React 19** · **Tailwind v4** · **Supabase** (Postgres,
Auth, Storage) · **Razorpay** · **Vercel**

> ⚠️ Next.js 16 differs from earlier versions in ways that catch people out;
> read [AGENTS.md](AGENTS.md) first. The most common one: `export const
> dynamic` is not allowed.

- **Business subdomains.** `bakery.ourdahanu.in` is served by the same app;
  [`src/proxy.ts`](src/proxy.ts) routes it. `find.`, `jobs.` and
  `appointments.` are separate products with their own layout.
- **Sign-in** is Google through Supabase (plus email sign-in against a local
  database only).
- **Data access.** The anon key is public by design; row level security
  policies are what protect the data.
- **Database.** The schema lives in `supabase/migrations/`, applied in order.
  Change it by adding a new file, never by editing one that has shipped.
- **Checks.** CI runs types, lint, tests, a production build, a browser smoke
  test, Lighthouse (accessibility, best practices and SEO must stay at 90 or
  above) and a Docker build.

## Licence

[MIT](LICENSE) © Soham Railkar.

The code is open. The name "OurDahanu", the logo, and the live site's content
(business listings, reviews, photos and guides) are not covered by the licence.
Build your own town's; don't copy ours.
