# Tenant login

A person sets up the Instance's single Tenant on first run and afterwards logs in with a username and password to reach the Tenant's pages.

<!-- DEBT(#36/W2): stale since #36: setup creates the first user in the Directory and provisions a Tenant with a fresh key, and an Instance holds several Tenants; see tenancy.md. -->

## Behaviors
- On a fresh Instance, `/setup` offers a form; submitting a username and password creates the Tenant's user and logs them in. Once a user exists, setup is closed and sends visitors to login.
- Logging in with the right username and password starts a session kept in a cookie that lasts fourteen days by default. After login the visitor lands on the same-origin path they were heading for, otherwise on the home page.
- Wrong credentials are refused with a message. After five failures for a username within fifteen minutes, that username cannot log in until the window ends; a successful login clears the count.
- Every page except setup, login, health and static files needs a session and sends visitors without one to login, remembering where they were going.
- Logging out ends the session. A session past its lifetime no longer grants access.
- The settings page lets the logged-in user change their password by giving the current one and a matching confirmation.
- `/health` reports the Instance's status and version without a login.
- Form submissions that come from another site are refused.

## Out of scope
- More than one Tenant, user administration, the directory
- Login through an external identity provider, password reset by email, remember-me
- API tokens and Feed tokens
