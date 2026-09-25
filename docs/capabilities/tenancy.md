# Tenancy

An Instance keeps each person's Tenant separate and finds the right one for every request, so a second person can join without seeing the first person's Bookmarks and an Instance set up before multi-Tenant support keeps working unchanged.

## Behaviors
- The Directory remembers which Tenant owns each username, which users are superusers, and the Instance's settings.
- Every Tenant is named by a random tenant key, 32 hexadecimal characters; a Tenant set up before the Directory existed keeps the key `main`.
- Session cookies, API tokens and Feed tokens carry their Tenant's key as a prefix, `<tenant key>.<value>`, so a request reaches its Tenant without consulting the Directory. A value without a prefix belongs to `main`, so cookies and tokens issued before this change keep working.
- A credential whose prefix is not a tenant key counts as no credential. A well-formed prefix naming a Tenant nobody provisioned answers not found on every path.
- A request without a credential is served by the Directory: the login page, setup, health and `/` work, other pages send the visitor to login remembering where they were going, the REST API answers that credentials were not provided and feeds answer not found.
- Logging in asks the Directory which Tenant owns the username and hands the credentials to that Tenant, which checks the password, applies its failure limit and starts a session. An unknown username is refused with the same message as a wrong password.
- On a fresh Instance, setup creates the first user in the Directory as superuser, gives them a Tenant with a fresh key and logs them in. Once any user exists, setup sends visitors to login.
- The first time the Directory serves anything on an Instance that already had a Tenant, it registers that Tenant's user as superuser under the key `main`.

## Out of scope
- Creating further users and any user administration
- Login through an external identity provider
- Anything shared across Tenants
- A failure limit for usernames that do not exist
- Moving data between Tenants or changing a tenant key
