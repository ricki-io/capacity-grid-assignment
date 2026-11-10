# Worklog

Running notes on how this got built — decisions, assumptions, dead ends, and anything
left unfinished. Append as you go; a line or two per entry is right.

---

## Seed data: what is actually in there

- Every logical assignment is stored as 15 rows with the same person, project and dates
  (14 at x h/day, one at 2x). They look like duplicates but are not: summed they give round
  figures (Ana = 8 h/day). The query sums and never de-duplicates. 126,195 rows = 8,413
  logical assignments.
- Assignments run through weekends (Ana Mon–Sun, Bo Fri–Mon) and the spec does not say
  whether those days count. Decision: only Mon–Fri count, because capacity is a weekly
  working-hours figure. It matters: 39 people are over in the week of 29 Dec with weekdays
  only, 143 with all seven days.
- `end_date` is inclusive (Cem has a one-day assignment, start = end).
- Assignments cross week boundaries (Bo Fri–Mon, generated ones last up to 14 days), so
  hours are split per week by overlap rather than attributed to the start week.
- Eli has `weekly_hours = 0` and 20h allocated, so percentages are out. Over-allocated
  means allocated > capacity, strictly: Ana at 40/40 is full, not over.
- Capacity has no history. `people.weekly_hours` is one value, so an edit rewrites every
  week, past ones included. Left as is (schema is fixed input).
- Names include right-to-left and non-Latin scripts (ids 494–500) and one 30-character name.
- Expected hours for the weeks of 29 Dec / 5 Jan / 12 Jan, worked out by hand from the seed:
  Ana 40/0/30, Bo 0/32/8, Cem 0/4/12, Dee 0/45/40, Eli 0/20/0.

## API

- Weeks start on Monday. `from`/`to` are widened to whole weeks (the scaffold's `to` is a
  Friday) and the response lists the weeks, so the client does no week maths to line up
  columns.
- Shape: `weeks[]` plus `people[{id, name, weeklyHours, allocated[]}]`, with `allocated`
  aligned to `weeks`. Capacity is sent once per person, not per cell, because the schema
  holds one value per person. A capacity edit therefore changes exactly one field.
- `PATCH /api/people/{id}` takes `{"weeklyHours": n}` and returns the stored person in the
  same shape the grid already holds. 0–168 allowed (0 is real: Eli), 422 outside that,
  404 for an unknown id. Last write wins; no versioning.
- Tried generating the weeks with `generate_series` over dates: it returns timestamptz and
  needs casts to stay timezone-safe. Switched to an integer series plus date arithmetic.
- Checked against the hand-worked numbers above: all five match. Timing on the seed is
  about 10 ms for 3 weeks and 45 ms for 26 weeks (63 KB).
- Deferred: one request is capped at 26 weeks but returns every person. With a few thousand
  people the response is still small; the cost is rendering, so the fix belongs with row
  virtualisation and a server-side "over-allocated only" filter, not alphabetical paging.
- Deferred: the `(start_date, end_date)` index only bounds `start_date`, so the scan grows
  with all history before `to`. A GiST index on a date range would fix it; the schema is
  off-limits here.
