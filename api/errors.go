package main

import "net/http"

// writeError sends every failure in the same JSON shape, so the client has
// one way to read an error message.
func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}
