# Roomies - Project Guidelines

## Northstar Vision

**Roomies** is a household management suite designed to make shared living pleasant and conflict-free. The app helps roommates coordinate expenses, chores, and communication with transparency and fairness at its core.

### Core Principles
1. **Fairness First** - Every feature should promote equitable sharing of costs and responsibilities
2. **Transparency** - All financial and chore data should be visible to household members
3. **Simplicity** - Keep the UX lean; avoid feature bloat that complicates the roommate experience
4. **Reliability** - Financial data must be accurate; the ledger is the source of truth
5. **Mobile-Ready** - Design all features to work seamlessly on mobile devices

### Target Scale
- Medium scale: 100-1,000 households
- Optimize for households of 2-6 members

---

## Architecture Overview

### Tech Stack
- **Frontend**: Next.js 15 (App Router), React 19, TailwindCSS (dark mode via `next-themes`, class strategy)
- **Backend**: Next.js Route Handlers + Supabase (Postgres, Auth, Realtime, Storage)
- **Database**: Supabase project `utpjefooygaqdhpgzxjy` ("roomiesapp"), Postgres 17.6, Free plan. RLS on every table.

### Source of truth for the schema
The hosted database is the truth; **every change goes through `supabase/migrations/*.sql`** (apply via the Supabase MCP `apply_migration` or the SQL editor, then commit the file). Run the security advisor after DDL.

### Directory Structure
```
src/
├── app/
│   ├── (auth)/            login, register, forgot-password, reset-password
│   ├── (dashboard)/       dashboard, expenses, tasks, chat, invitations, households/[id], profile, settings
│   ├── api/               route handlers (see "API conventions")
│   ├── auth/callback/     PKCE code exchange
│   └── invite/            public invitation landing page
├── components/            UI by feature (dashboard, expenses, tasks, invitations, chat, ui)
├── context/               AuthContext (session), HouseholdContext (current household + switcher)
├── lib/
│   ├── supabase.ts            browser client
│   ├── supabase-server.ts     server client, withAuth/withAuthParams, requireMembership, error helpers
│   ├── supabase-admin.ts      service-role client (server only, needs SUPABASE_SERVICE_ROLE_KEY)
│   ├── serializers.ts         DB rows (snake_case) → API shapes (camelCase, src/types)
│   ├── validation.ts          request-body validation (throws HttpError 400)
│   ├── queries.ts             shared server reads
│   ├── chat.ts                messages + realtime
│   └── services/              client-side wrappers around /api
└── types/index.ts         the API contract
```

### Key database objects used by the web app
| Object | Purpose |
|---|---|
| `web_create_household(name, address)` | creates household + admin membership + join code |
| `join_household_by_code(code)` | join with a code (replaces the leaky "view by join code" policy) |
| `web_regenerate_join_code(id)` | admins rotate the code |
| `web_create_expense / web_update_expense / web_delete_expense` | atomic expense + splits + ledger entries; edits/deletes post reversal rows |
| `web_settle_split(split_id, settled)` | marks a share paid/unpaid and records the settlement in the ledger |
| `create_settlement_simple(...)` | direct "A paid B" settlement (existing, has checks) |
| `get_household_balances_simple(id)` | ledger balances (existing, has checks) |
| `get_invitation_by_token / respond_to_invitation_by_token` | invite-link flows for visitors without a session (anon-callable; the token is the secret) |
| `web_prepare_account_deletion()` | soft account deletion: detach memberships, anonymise profile; API then soft-deletes the auth user |
| `web_assert_member(household_id)` | guard inserted into every household-scoped SECURITY DEFINER function |
| `on_auth_user_created → handle_new_user()` | creates `profiles`; **never insert profiles from the app** |

Tables the web app touches directly (under RLS): `households`, `household_members`, `profiles`, `expenses`, `expense_splits`, `invitations`, `tasks`, `messages`, `ledger_entries` (read), `notifications` (written by RPCs/triggers), storage bucket `avatars`.

The chores engine (`household_chores`, `chore_assignments`, rotate/swap/snooze RPCs), embeddings/RAG functions and the `generate-embedding` edge function belong to another client (a mobile app, last active July 2026). Keep them working; do not remove.

---

## API conventions

```ts
export const GET = withAuthParams<{ id: string }>(async (request, { user, supabase, params }) => {
  const householdId = requireUuid(params.id, 'Household id');
  await requireMembership(supabase, householdId, user.id, { admin: true });   // throws HttpError 403
  const { data, error } = await supabase.rpc('...', { ... });
  if (error) return dbErrorResponse(error, 'Failed to ...');                  // maps SQLSTATE → HTTP status
  return NextResponse.json(serialize(data));
});
```
- Validate bodies in `src/lib/validation.ts`; throw `HttpError(400, message)` with a user-facing message.
- Never use the service-role client before the route has done its own authorization; it is only needed for
  the GoTrue soft delete in account deletion. Invitation-token flows are database functions.
- Money mutations go through the `web_*` RPCs, never direct table writes. `ledger_entries` is immutable: corrections
  are `reversal` rows (`web_zero_ledger_reference`).
- Responses use the camelCase shapes in `src/types`; map rows with `src/lib/serializers.ts`.
- Roles are lowercase `'admin' | 'member'` everywhere (DB check constraint).
- Invitation status values are `pending | accepted | rejected | expired` (there is no `declined` in the DB).

## Frontend conventions
- Client components read the session from `useAuth()` and the household from `useHousehold()`; never call `getSession()` ad hoc.
- Call `/api` through `src/lib/services/*` and `apiFetch`; show errors with `<Alert>`; no `alert()`.
- `<Avatar>` for profile pictures (initials fallback); avatars upload to storage `avatars/{uid}/…`.
- Dates: expenses use `YYYY-MM-DD` strings; tasks use ISO timestamps (date-only input becomes noon UTC).

---

## Local setup
```bash
cp .env.example .env.local      # NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
npm install
npm run dev
npm run check                   # tsc + eslint (strict: no any, no unused vars)
npm run build
```

---

## Technical Debt Tracker

### Done (2026-09-05 overhaul)
- [x] Web app aligned with the live schema (tasks, invitations, households.address, profiles, chat)
- [x] Household creation / join-by-code / invitation link flows; current-household context
- [x] Ledger-backed balances, share settling and settle-up plan; edits/deletes post reversals
- [x] SECURITY DEFINER functions: no anon EXECUTE, membership guards, service-role-only maintenance helpers
- [x] `delete_expense_simple` / `update_expense_with_adjustments` repaired (they fought the ledger immutability trigger)
- [x] Leaky households join-code policy dropped; duplicated invitation policies merged; duplicate indexes dropped
- [x] Avatars storage bucket + policies; dark mode actually toggles; strict eslint; migrations committed

### Open
- [x] Postgres upgraded 15.8.1.094 → 17.6.1.166 on 2026-09-05 (pgjwt had to be dropped first); extensions now vector 0.8.2 / pg_trgm 1.6 / pgcrypto 1.3
- [ ] Leaked-password protection (HIBP) needs the Pro plan; min password length is 8 in Auth settings to match the app
- [ ] Invitation emails are not sent; admins share the link / join code (wire Resend or Supabase SMTP)
- [ ] Extensions `vector`, `pg_trgm`, `fuzzystrmatch` live in `public` (advisor warning; move to `extensions` only with the other client's functions checked)
- [x] Account deletion is a soft delete (profile anonymised, auth user scrubbed) because financial rows reference profiles with NO ACTION
- [ ] Recurring expenses (`recurring_expenses`, `process_recurring_expenses_robust`) have no web UI
- [ ] Notifications table is written but never shown in the web app
- [ ] Automated tests (vitest for validation/serializers; a Playwright smoke run)

*Last updated: 2026-09-05*
