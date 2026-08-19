# Arsenal Home Games — Ticket Tracker

A small shared web app for Tarik, Barry and Oliver (with Josh as a spare) to
track who's requested and used a ticket for each Arsenal home game this
season. No login — anyone with the link can see and update it, like a shared
spreadsheet.

It's plain HTML/CSS/JS (no build step) backed by a free [Supabase](https://supabase.com)
database, so everyone's screen stays in sync in real time.

## 1. Database — ✅ already done

The Supabase project (`TarikReid Project`) is live, `schema.sql` has been
run, and `config.js` already has the real Project URL and Publishable key in
it. Nothing to do here — this section is just for reference if you ever spin
up a fresh project (e.g. for a future season):

1. [supabase.com](https://supabase.com) → sign up free → **New project**.
2. **SQL Editor** → **New query** → paste in the entire contents of
   `schema.sql` → **Run**. Creates the tables, seeds Tarik/Barry/Oliver/Josh
   and the fixtures, and sets permissions.
3. **Project Settings → Data API** for the **Project URL**; **Project
   Settings → API Keys** for the **Publishable key** (`sb_publishable_...`).
4. Paste both into `config.js`.

## 2. Get it on everyone's iPhone

The app is a set of static files — no app store, no install, just a web page
everyone opens in Safari. Two parts: put it somewhere with a URL, then add
it to each person's home screen so it feels like a real app.

**Host it (do this once):**

- **GitHub Pages (recommended — free, permanent URL)**: create a repo, push
  this folder to it, then in the repo's **Settings → Pages** set the source
  to your main branch. You'll get a URL like
  `https://yourname.github.io/arsenal-tickets/`.
- **Netlify Drop**: drag this folder onto
  [app.netlify.com/drop](https://app.netlify.com/drop) for an instant URL.
  Sign in (free) right after to *claim* it — an unclaimed drop is temporary
  and password-protected, claiming makes the URL permanent.

**Then, on each iPhone (Tarik, Barry, Oliver, Josh — takes 15 seconds each):**

1. Open the hosted URL in **Safari** (has to be Safari, not Chrome, for this
   step).
2. Tap the **Share** icon (square with an arrow, bottom of screen).
3. Scroll down and tap **Add to Home Screen** → **Add**.

That's it — it now sits on their home screen with the app icon, opens full
screen with no browser bar, and still talks to the same live Supabase
database as everyone else's, so all four of you always see the same data.

## Using the app

- **Add a game**: "+ Add game" — opponent, competition, date/time, notes.
- **Request a ticket**: each person taps "Request ticket" on a game. The
  +/– stepper next to it covers requesting more than one (e.g. a spare for
  Josh).
- **Confirm used**: after the game, tap "Confirm used" to log that the
  ticket was actually used — this is what feeds the "Tickets used" tally at
  the top.
- **Cancel / undo**: mistakes happen — "Cancel" drops a request, "Undo"
  reverses a "used" confirmation.
- **Upcoming / Past / All** tabs filter the list; past games sort most-recent
  first.
- Dark mode toggle is the half-moon icon, top right.

## 2026/27 fixtures & the weekly automatic sync

`schema.sql` seeds all 19 of Arsenal's confirmed Premier League home fixtures
for 2026/27 (Coventry City through to Brighton on the final day). Champions
League and domestic cup (FA Cup, EFL Cup) home fixtures aren't fixed yet —
those get confirmed by draws through the season — so they're not in there
yet.

Because Premier League kick-off times get moved for TV for weeks after the
initial fixture release, and new cup fixtures get added once each round is
drawn, this app supports a **weekly automated sync**: once a week, a
scheduled check runs against the official fixture sources and:

- adds any newly-confirmed home fixture (a cup draw, a new Champions League
  matchday date) that isn't in the database yet;
- updates the kick-off date/time on any existing fixture that's been moved;
- never touches your notes or anyone's ticket request/used status — it only
  ever changes the fixture's own date/time or adds new rows;
- never deletes a fixture, even if it looks postponed — it flags anything
  odd for you to check instead of guessing.

**This is live** — it runs every Monday morning via a Claude scheduled task
connected to the Supabase database. `fixture-sync-job.md` in this folder has
the exact instructions the weekly job follows, if you want to see (or tweak)
what it does.

## Notes on the design

- No authentication — this is meant to be as low-friction as a group chat.
  Don't put anything sensitive in it.
- Ticket "used" counts feed the season stat tile at the top so you can see
  at a glance who's actually been using their tickets.
- If you'd rather start the season's data from the old spreadsheet history,
  the `2526 Fixtures` tab format maps directly onto `matches` — happy to
  write an import script if that'd help later.
