# API tokens

A person creates a named API token for each device or client that talks to the REST API and revokes any one of them on its own, so losing a phone never means replacing every credential.

## Behaviors
- The Integrations section of the settings page lists every API token by name and creation date and never shows a stored key. A token from before named tokens is listed as `Default` and keeps working.
- Creating a token needs a name; the key, forty lowercase hexadecimal characters, is shown once in the response and authenticates the REST API from then on.
- Revoking a token removes it from the list and its key stops authenticating.
- Token forms need a session and are refused when they come from another site.

## Out of scope
- Regenerating a token in place; revoke and create instead
- Per-token permissions, expiry or last-used dates
- Feed tokens, which the feeds capability covers
