package wauthn

import (
	"os"

	"github.com/go-webauthn/webauthn/webauthn"
)

// WA is the global WebAuthn instance — initialized once in main.go
var WA *webauthn.WebAuthn

// Init reads config from env and creates the WebAuthn handler
func Init() error {
	rpID := os.Getenv("WEBAUTHN_RP_ID")
	rpOrigin := os.Getenv("WEBAUTHN_RP_ORIGIN")
	if rpID == "" {
		rpID = "localhost"
	}
	if rpOrigin == "" {
		rpOrigin = "http://localhost:3000"
	}

	var err error
	WA, err = webauthn.New(&webauthn.Config{
		RPDisplayName: "ChatApp",
		RPID:          rpID,
		RPOrigins:     []string{rpOrigin},
	})
	return err
}
