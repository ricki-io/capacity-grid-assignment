# Decisions

## What did the spec not tell you?

- I counted Monday to Friday, with inclusive start and end dates. The spec doesn't say whether weekends count, so this is an assumption. Weeks start on Monday, and selected dates expand to whole weeks.
- I used TanStack Query for fetching, caching and managing saves. Capacity is one value per person, so I update it optimistically across cached ranges and derive the totals from it. Before updating the cache, I cancel in-flight capacity requests so an older response doesn't overwrite the edit. If saving fails, I restore only that person's weekly hours, not the whole cached response, so other people's edits stay intact. The row offers a retry, and a background refetch checks against the server once pending saves finish.
- I left people pagination out for now. Splitting the team into alphabetical pages could hide someone who is over capacity. Requests are limited to 26 weeks, and the grid includes an over-allocated filter. Rendering larger teams still needs work.

## What did you notice that looked wrong?

- The assignment rows look duplicated, but their hours add up to the expected totals. They need to be summed, not deduplicated.
- One person has zero capacity and 20 hours assigned. I show hours and the amount over capacity instead of relying on percentages. Exactly 40/40 is full, not over.
- Changing weekly capacity also changes past weeks. The schema only stores the current value, with no history. I kept that behavior because the schema is fixed, but it's something I'd clarify before using this in production.

## What did the AI get wrong that you caught?

- The failed-save test passed even when the rollback was removed. The background refetch was restoring the old value, so the test wasn't checking what we thought it was. It now makes reads fail too, so the rollback has to work for the test to pass.

## What would you do differently with a week?

- Add E2E tests for keyboard editing, failed saves and navigating while requests are pending.
- Measure with a few thousand people, then add row virtualization and move filtering to the server where needed.
- Handle two managers editing the same person, and keep the selected range in the URL.
