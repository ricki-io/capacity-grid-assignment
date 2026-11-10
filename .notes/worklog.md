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

## Grid

- The range is owned by `App`, not the grid: the timeline that will sit next to it shows
  the same weeks. The page opens on the scaffold's weeks, where the seed's hand-made cases
  are, with "Today" one click away. In production the default would be the current week.
- The date picker widens to whole weeks and stops at 26, the same cap as the API. The end
  the manager just picked stays put and the other end moves.
- Every derived number (cell state, "N over" per week, people over in the range) is worked
  out during render from the response. Nothing derived is stored, so nothing can go stale.
- Loading: first load shows placeholders; moving to new weeks keeps the previous ones on
  screen, dimmed, with a line saying what is loading. Failure: with nothing to show, an
  error and a retry; when a refresh fails, the last numbers stay with a warning that they
  may be out of date. Queries retry once, not three times, so a failure shows in about a
  second.
- Over-allocation is stated in words ("+5h over"), not only colour.
- Looked at it running: the five hand-made people match, and 39 / 15 / 0 people over per
  week matches my own count from the seed. 26 weeks x 500 people (13,000 cells) renders
  and scrolls without trouble. Stopped the API container to see both failure states.
- Deferred: the range is not in the URL, so a reload returns to the opening weeks. No row
  virtualisation yet (see API notes).

## Editing weekly hours

- After a save the grid patches what it already has, optimistically, rather than waiting
  on a refetch. This is safe because of the data: weekly hours are one value per person
  and allocated hours do not depend on them, so an edit changes exactly one field and
  every other number is derived from it while rendering.
- The new value is written into every cached range, not only the visible one, so going
  back to weeks already visited does not show the old hours.
- A failed save puts that one value back and leaves a message on the row with the value
  that was tried, plus retry and dismiss. Only the one field is restored, not a snapshot
  of the cache, so it cannot undo another save still in progress.
- Late arrivals: fetches in flight when a save starts are cancelled (they read the old
  value). When the last save in flight settles, the ranges are refetched in the
  background. That covers a range requested mid-save, and a save that reached the
  database but whose reply was lost.
- One save per person at a time; the control is inert while saving, so two replies for the
  same person cannot land out of order.
- Enter or leaving the field saves, Escape cancels, an invalid value (outside 0–168) is
  refused in place and never sent.
- Caught while looking at it running: after Enter, keyboard focus was lost. The button
  was `disabled` in the same render that focus returned to it, and a disabled button
  cannot take focus. Switched to `aria-disabled` plus a guard in the click handler.
- Looked at it running: Dee 40 -> 50 clears her "+5h over", the week goes from 15 to 14
  over and the range from 41 to 40 people. With the API container stopped, Ana 40 -> 30
  showed the optimistic numbers, then went back with the error; retry worked once the API
  was up. Put both people back to 40 afterwards.
- Tests: week maths (year boundary, Sunday, range clamping), the load boundaries (40/40
  is full, 20/0 is over), and the grid through a successful and a failed save.
- Caught while checking the tests: the first failed-save test still passed with the
  rollback line deleted. The refetch that follows every save was putting the old value
  back, so the test proved nothing about the rollback. It now takes the fake API down for
  reads as well, which is what a real outage looks like, and goes red without the rollback.
- Not done: no versioning, so two managers editing the same person is last write wins.
  A failed save's message lives in the grid's state and is lost on reload.

## Final check

- Rebuilt from nothing (`docker compose down -v`, then up with `--build`): database
  re-seeded, API image rebuilt, web dependencies installed fresh. The five hand-made
  people still match, 39 / 15 / 0 over per week, 15 tests pass, type-check clean, and the
  page loads with data.

## Look and feel

- Restyled to sit closer to Toggl's own product: warm page, white panel, purple accents, red
  for over-allocation, uppercase column labels, initials next to each name. Colours are the
  ones on toggl.com; their roles here, the red pair and all dark-mode values are my choices.
  The only references were public marketing images, so it is "in the family", not a copy.
- System font, not Toggl's Aeonik: it is a licensed typeface and I have no right to ship it.
  No Toggl logo either, for the same reason.
- No behaviour changed. The "Over-allocated only" checkbox is still a checkbox, drawn as a
  filter button. Person column is a fixed width so spare room goes to the weeks.
- Checked in Chromium at desktop and phone width, light and dark, with a failed save and an
  invalid entry. 15 tests pass, type-check clean.

## Accessibility and small-screen fixes

- Had the restyle reviewed (design critique plus accessibility audit) and fixed what was a
  real defect, not taste:
  - Phones lost the week header: the table had no height there, so the header had nothing
    to stick to. It keeps its own scroll area at every width now.
  - At 320px (and desktop at 400% zoom) the range control overflowed. The two dates stack
    between the arrows below 360px.
  - Control borders were 1.66:1 on white; now 4.12:1. Slightly heavier than Toggl's.
  - For screen readers: the table has a name, an empty cell says "Nothing allocated", the
    current week says "This week", and "40h full" is no longer read as one word.
  - "0 of 500" is no longer red; cut-off names show in full on hover.
- Screen-reader-only text inside a scroll area must sit in a positioned ancestor, or it
  stretches the page (it made the document 30,000px tall until the scroll area was positioned).
- Left alone on purpose: search and sort for 500 people, range presets, and a Save/Cancel
  step for weekly hours. Those are features, not fixes.
- Not tested with a real screen reader, nor at 200% text-only zoom.
