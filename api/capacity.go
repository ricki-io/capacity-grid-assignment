package main

import (
	"errors"
	"fmt"
	"log"
	"net/http"
	"time"
)

const dateLayout = "2006-01-02"

// maxWeeks caps one request. The grid shows a window onto the history, not
// all of it; a wider view should be several requests, not one large response.
const maxWeeks = 26

type capacityResponse struct {
	// Weeks is the Monday of every week in the range, in order.
	Weeks  []string         `json:"weeks"`
	People []personCapacity `json:"people"`
}

type personCapacity struct {
	person
	// Allocated lines up with capacityResponse.Weeks: Allocated[i] is the
	// hours booked in Weeks[i].
	Allocated []float64 `json:"allocated"`
}

// capacityQuery returns one row per person with their allocated hours for
// each week between $1 and $2, both Mondays.
//
// Only Monday to Friday count: a week's working days are week_start to
// week_start + 4, and an assignment contributes hours_per_day for each of
// those days it covers (end_date is inclusive). The overlap is plain date
// arithmetic, so no assignment is expanded into one row per day.
//
// Assignments are summed as stored. The seed splits each logical assignment
// into several rows that only add up to the real figure together, so they
// must not be de-duplicated.
const capacityQuery = `
WITH weeks AS (
  SELECT $1::date + 7 * i AS week_start
  FROM generate_series(0, ($2::date - $1::date) / 7) AS i
),
allocated AS (
  SELECT a.person_id,
         w.week_start,
         sum(a.hours_per_day * (
           least(a.end_date, w.week_start + 4) - greatest(a.start_date, w.week_start) + 1
         )) AS hours
  FROM weeks w
  JOIN assignments a
    ON a.start_date <= w.week_start + 4
   AND a.end_date >= w.week_start
  GROUP BY a.person_id, w.week_start
)
SELECT p.id,
       p.name,
       p.weekly_hours::float8,
       array_agg(coalesce(al.hours, 0)::float8 ORDER BY w.week_start)
FROM people p
CROSS JOIN weeks w
LEFT JOIN allocated al
  ON al.person_id = p.id
 AND al.week_start = w.week_start
GROUP BY p.id
ORDER BY p.name, p.id`

// handleCapacity serves GET /api/capacity?from=YYYY-MM-DD&to=YYYY-MM-DD
//
// The range is widened to whole Monday-to-Sunday weeks, and the response
// lists those weeks so the client never has to work out which column a
// number belongs to. Capacity is sent once per person because that is all
// the schema holds: one weekly_hours value, with no history.
func (s *server) handleCapacity(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	first, last, err := parseWeekRange(q.Get("from"), q.Get("to"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	rows, err := s.db.Query(r.Context(), capacityQuery, first, last)
	if err != nil {
		s.internalError(w, r, "capacity query", err)
		return
	}
	defer rows.Close()

	resp := capacityResponse{Weeks: weekStarts(first, last), People: []personCapacity{}}
	for rows.Next() {
		var p personCapacity
		if err := rows.Scan(&p.ID, &p.Name, &p.WeeklyHours, &p.Allocated); err != nil {
			s.internalError(w, r, "capacity scan", err)
			return
		}
		resp.People = append(resp.People, p)
	}
	if err := rows.Err(); err != nil {
		s.internalError(w, r, "capacity rows", err)
		return
	}

	writeJSON(w, http.StatusOK, resp)
}

// parseWeekRange turns from/to into the Mondays of the first and last week
// the range touches.
func parseWeekRange(from, to string) (first, last time.Time, err error) {
	start, err := time.Parse(dateLayout, from)
	if err != nil {
		return first, last, errors.New("from must be a date like 2026-01-05")
	}
	end, err := time.Parse(dateLayout, to)
	if err != nil {
		return first, last, errors.New("to must be a date like 2026-01-05")
	}
	if end.Before(start) {
		return first, last, errors.New("to must not be before from")
	}

	first, last = mondayOf(start), mondayOf(end)
	if weeks := int(last.Sub(first).Hours()/(24*7)) + 1; weeks > maxWeeks {
		return first, last, fmt.Errorf("range covers %d weeks, the most one request can cover is %d", weeks, maxWeeks)
	}
	return first, last, nil
}

func mondayOf(d time.Time) time.Time {
	daysSinceMonday := (int(d.Weekday()) + 6) % 7
	return d.AddDate(0, 0, -daysSinceMonday)
}

func weekStarts(first, last time.Time) []string {
	var weeks []string
	for d := first; !d.After(last); d = d.AddDate(0, 0, 7) {
		weeks = append(weeks, d.Format(dateLayout))
	}
	return weeks
}

// internalError logs the real cause and tells the client only that the
// request failed. A request the client gave up on is not an error.
func (s *server) internalError(w http.ResponseWriter, r *http.Request, what string, err error) {
	if r.Context().Err() != nil {
		return
	}
	log.Printf("%s: %v", what, err)
	writeError(w, http.StatusInternalServerError, "something went wrong, try again")
}
