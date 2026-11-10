package main

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/jackc/pgx/v5"
)

// maxWeeklyHours is the number of hours in a week.
const maxWeeklyHours = 168

// person is what the API says about someone, in both the capacity response
// and the reply to an update, so the grid can drop one into the other.
type person struct {
	ID          int     `json:"id"`
	Name        string  `json:"name"`
	WeeklyHours float64 `json:"weeklyHours"`
}

type updatePersonRequest struct {
	// A pointer, so a missing field is not mistaken for zero hours.
	WeeklyHours *float64 `json:"weeklyHours"`
}

// handleUpdatePerson serves PATCH /api/people/{id} with {"weeklyHours": 32}
//
// It replies with the person as stored. Capacity is a single value per
// person, so that one object is everything an edit can have changed: the
// grid swaps it in and every number derived from it follows.
func (s *server) handleUpdatePerson(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "person id must be a number")
		return
	}

	var req updatePersonRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1024)).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, `body must be JSON like {"weeklyHours": 32}`)
		return
	}
	if req.WeeklyHours == nil {
		writeError(w, http.StatusUnprocessableEntity, "weeklyHours is required")
		return
	}
	hours := *req.WeeklyHours
	if hours < 0 || hours > maxWeeklyHours {
		writeError(w, http.StatusUnprocessableEntity, "weeklyHours must be between 0 and 168")
		return
	}

	var p person
	err = s.db.QueryRow(r.Context(), `
		UPDATE people
		SET weekly_hours = $1
		WHERE id = $2
		RETURNING id, name, weekly_hours::float8`,
		hours, id,
	).Scan(&p.ID, &p.Name, &p.WeeklyHours)
	if errors.Is(err, pgx.ErrNoRows) {
		writeError(w, http.StatusNotFound, "person not found")
		return
	}
	if err != nil {
		s.internalError(w, r, "update person", err)
		return
	}

	writeJSON(w, http.StatusOK, p)
}
