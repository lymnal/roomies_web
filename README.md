# Roomies

Shared-living coordination for roommates: split expenses with a proper ledger, assign tasks, invite roommates, and chat — all per household.

Next.js 15 (App Router) · React 19 · Tailwind · Supabase (Postgres + Auth + Realtime + Storage)

## Getting started

```bash
cp .env.example .env.local   # fill in the Supabase URL / keys
npm install
npm run dev                  # http://localhost:3000
```

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Public anon key (RLS applies) |
| `SUPABASE_SERVICE_ROLE_KEY` | for account deletion | Server-only. GoTrue soft-delete of the auth user; invite links work without it |
| `NEXT_PUBLIC_APP_URL` | no | Origin used in invitation links (defaults to the request origin) |

`npm run check` runs the type checker and the linter; `npm run build` produces the production bundle.

## How it fits together

- **Auth**: Supabase Auth (email/password + Google). The `on_auth_user_created` trigger creates the `profiles` row. The middleware validates the session on every request and redirects to `/login`; API routes re-check with `withAuth` / `withAuthParams` (`src/lib/supabase-server.ts`).
- **Households**: created with `web_create_household` (creator becomes admin, a join code is generated). Roommates join with the code (`join_household_by_code`) or an invitation link (`/invite?token=…`).
- **Money**: every expense, settlement and edit is posted to `ledger_entries` (immutable; corrections are reversal rows). Balances come from `get_household_balances_simple`. The RPCs the web app uses live in `supabase/migrations/20260905000100_web_ledger_rpcs.sql` and all check `auth.uid()` membership.
- **Tasks**: the `tasks` table (not the chores engine, which other clients use).
- **Chat**: `messages` table + Realtime.
- **Authorization**: RLS on every table, plus explicit checks in the API routes. `SECURITY DEFINER` functions are not executable by `anon` (except the invitation-token functions, where the token is the secret), and household-scoped ones assert membership (`web_assert_member`).
- **Account deletion**: financial rows reference profiles with NO ACTION, so deletion is a soft delete: `web_prepare_account_deletion()` anonymises the profile and detaches memberships, then the auth user is soft-deleted through the admin API.

### Layout

```
src/
├── app/                # routes (pages under (auth) and (dashboard), API under api/)
├── components/         # UI by feature
├── context/            # AuthContext, HouseholdContext (current household + switcher)
├── lib/
│   ├── supabase.ts         browser client
│   ├── supabase-server.ts  server client, withAuth, error helpers
│   ├── supabase-admin.ts   service-role client (server only)
│   ├── serializers.ts      DB rows → API shapes
│   ├── validation.ts       request body validation
│   ├── queries.ts          shared server reads
│   └── services/           client-side API wrappers
└── types/              # API types (camelCase)
supabase/migrations/    # SQL applied to the hosted project (keep in sync)
```

## Database changes

Apply new SQL through the Supabase MCP / SQL editor **and** add the file under `supabase/migrations/` so the repo stays the source of truth. Run the Supabase security advisor afterwards.

Two items can only be done in the Supabase dashboard: enable leaked-password protection (Authentication → Settings) and upgrade Postgres (Settings → Infrastructure).
