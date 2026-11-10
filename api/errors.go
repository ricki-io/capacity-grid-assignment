package main

import (
	"log"
	"net/http"
)

// writeError sends every failure in the same JSON shape, so the client has
// one way to read an error message.
func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

// internalError logs the real cause and tells the client only that the
// request failed. A request the client gave up on is not an error.
func internalError(w http.ResponseWriter, r *http.Request, what string, err error) {
	if r.Context().Err() != nil {
		return
	}
	log.Printf("%s: %v", what, err)
	writeError(w, http.StatusInternalServerError, "something went wrong, try again")
}
