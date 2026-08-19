# Weekly fixture sync — what it does

This is the job a scheduled Claude task runs once a week to keep the
`matches` table current. It's registered as a Claude scheduled task (not
code you need to run yourself).

It uses the **Supabase MCP connector** (connected via claude.ai/Cowork
connector settings) to read and write the database directly, rather than
raw HTTPS calls — Claude's sandboxed environment blocks outbound writes to
arbitrary external APIs, so the connector is what makes this reliable.
Project: `TarikReid Project` (project_id `krhpczmughncrntbnrfw`).

Each run is a fresh session with no memory of previous runs, so the
instructions below are self-contained.

---

**Task prompt:**

> Weekly Arsenal fixture sync for a personal ticket-tracking web app
> (Tarik, Barry, Oliver, Josh). Run unattended — don't ask questions, just
> do the sync and report a short summary at the end.
>
> 1. Search the web for Arsenal's current 2026/27 fixture list. Check both
>    Premier League fixtures (for kick-off date/time changes — TV picks get
>    announced roughly 2–6 weeks ahead) and any newly-confirmed Champions
>    League or domestic cup (FA Cup, EFL Cup) fixtures. Use at least two
>    sources (e.g. arsenal.com, premierleague.com,
>    footballpickr.com/fixtures/arsenal, Sports Illustrated's Arsenal
>    fixtures coverage, or Wikipedia's current-season article) and
>    cross-check before trusting a specific date/time.
> 2. Keep only home fixtures (Arsenal at the Emirates Stadium). Ignore away
>    games and pre-season friendlies.
> 3. Use the Supabase connector's `execute_sql` tool against project_id
>    `krhpczmughncrntbnrfw` to read what's already there:
>    `select opponent, competition, kickoff, fixture_key from matches where season = '2026/27' order by kickoff;`
> 4. For each home fixture found on the web, build a `fixture_key`
>    (lowercase, hyphenated): `pl-2627-<opponent-slug>` for Premier League
>    (matches the seeded rows — e.g. `pl-2627-chelsea`); for cups/Europe use
>    `<comp>-2627-<round-or-matchday>-<opponent-slug>`, e.g.
>    `ucl-2627-md3-<opponent>`, `facup-2627-r3-<opponent>`,
>    `eflcup-2627-r3-<opponent>`. Match whatever convention the existing rows
>    already use if it differs from this.
> 5. For each fixture, run one upsert via `execute_sql` — this inserts it if
>    new, or updates only the kickoff if it changed, and does nothing (and
>    returns no row) if it's already correct:
>    ```sql
>    insert into matches (opponent, competition, kickoff, season, fixture_key)
>    values ('<opponent>', '<competition>', '<kickoff ISO8601>', '2026/27', '<fixture_key>')
>    on conflict (fixture_key) do update
>      set kickoff = excluded.kickoff
>      where matches.kickoff is distinct from excluded.kickoff
>    returning (xmax = 0) as is_new, opponent, kickoff;
>    ```
>    A returned row with `is_new = true` is a newly added fixture; `is_new =
>    false` is a kick-off change on an existing one. No returned row means
>    nothing changed for that fixture. Never set `notes` — leave it alone,
>    it may hold the group's own ticket notes.
>    - **Never delete rows** — even a fixture that looks postponed or
>      cancelled. Just flag it in the summary for a human to check instead.
> 6. Do not touch the `people` or `ticket_status` tables at all.
> 7. Finish with a short plain-text summary: fixtures checked, any new ones
>    added (name them), any kick-off changes (old → new, name them), and
>    anything that needs a human look. If nothing changed, say so briefly.

---

**Schedule:** weekly (Monday mornings, UK time).
**Notifications:** push, so you hear about it if a kick-off time actually
moves — otherwise it's easy to miss a scheduled task's own run log.
