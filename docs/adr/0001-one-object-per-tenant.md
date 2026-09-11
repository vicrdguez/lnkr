# One Durable Object per Tenant, no `user_id` columns

Status: accepted, 2026-09-11.

lnkr stores each Tenant's data in its own SQLite-backed Durable Object, named after the Tenant, and the first version has exactly one Tenant, named `main`. Tables carry no `user_id` column and no query ever spans Tenants; the Worker's only job before forwarding a request is to resolve which object it belongs to, in one function. Sessions, API tokens and preferences live inside the Tenant's object.

## Considered options

- **One global object with `user_id` on every table**, which is linkding's schema and what the first draft of the plan had. Rejected: every query must be scoped by hand and a missed `WHERE` leaks across users, all users share one object's region and 10 GB cap, and Cloudflare's guidance is explicitly against a single object handling all requests.
- **One object per Tenant** (chosen): isolation is structural, the object is the unit of coordination Cloudflare designed for, and the single-Tenant version needs no user scoping at all.

## Consequences

- Adding Tenants later means adding a small directory object for username lookup, superuser flags and Instance-wide settings, consulted at login and administration only. Cookie and token values can then carry the Tenant key so ordinary requests need no directory hop.
- Features that read across Tenants, such as Shared bookmarks or a public feed, need a fan-out or an index in the directory. None exist in the first version.
- Nothing Instance-wide, such as a landing page or guest profile, exists until the directory does.
