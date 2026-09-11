# Add the Directory Behavior

### Background:
- Given requests go to `https://lnkr.test`
- And `formPost` sends `Origin: https://lnkr.test`

## Feature: Setup on a fresh Instance

#### Scenario: Setup creates the superuser and a Tenant
- Given no user exists in the Directory
- When POST `/setup` with username `vic` and password `correct horse battery`
- Then the response redirects to `/`
- And the `sessionid` cookie value has the form `<32 hex characters>.<session id>`
- And GET `/settings` with that cookie answers 200 and shows the API token prefixed with the same 32 hex characters

#### Scenario: Setup closes after the first user
- Given the Directory has one user
- When GET `/setup` without a cookie
- Then the response redirects to `/login`

#### Scenario: The Tenant no longer offers setup
- Given the Directory has one user with a session cookie
- When GET `/setup` with that cookie
- Then the response redirects to `/login`

## Feature: Registering a pre-existing main Tenant

### Background:
- Given the `main` Tenant was provisioned with username `vic` and password `correct horse battery` before the Directory existed, by calling `provision` on the `main` instance inside `runInDurableObject`
- And the Directory has served no request yet

#### Scenario: First Directory request registers main
- When GET `/login`
- Then the response is 200
- And inside the Directory instance `users` holds one row with username `vic`, tenant key `main` and `is_superuser` 1

#### Scenario: Login for the registered user reaches main
- When POST `/login` with username `vic` and password `correct horse battery`
- Then the response redirects to `/`
- And the `sessionid` cookie value starts with `main.`
- And GET `/settings` with that cookie answers 200

#### Scenario: A bare session cookie still reaches main
- Given a session id `S` created directly in the `main` Tenant's `sessions` table
- When GET `/settings` with cookie `sessionid=S`
- Then the response answers 200

#### Scenario: A bare API token still reaches main
- Given the `main` Tenant holds an API token `K` without prefix
- When GET `/api/user/profile/` with `Authorization: Token K`
- Then the response is 200

#### Scenario: Setup is closed once main is registered
- When GET `/setup`
- Then the response redirects to `/login`

## Feature: Login routing

### Background:
- Given the Instance was set up with user `vic`, password `correct horse battery`, tenant key `KV`

#### Scenario: Known username reaches its Tenant
- When POST `/login` with username `vic` and password `correct horse battery`
- Then the response redirects to `/`
- And the `sessionid` cookie value starts with `KV.`

#### Scenario: Wrong password is refused by the Tenant
- When POST `/login` with username `vic` and password `wrong`
- Then the response is 401 with the message `Invalid username or password`
- And no cookie is set

#### Scenario: Unknown username is refused by the Directory
- When POST `/login` with username `nobody` and password `whatever`
- Then the response is 401 with the message `Invalid username or password`
- And no cookie is set

#### Scenario: The Tenant limiter still applies
- Given five failed POST `/login` for `vic`
- When POST `/login` with username `vic` and the correct password
- Then the response is 429

#### Scenario: Same-origin next path is honoured across the routing
- When POST `/login?next=/settings` with valid credentials
- Then the response redirects to `/settings`

## Feature: Routing by credential prefix

### Background:
- Given the Instance was set up with user `vic`, tenant key `KV`, session cookie `C` and API token `T`

#### Scenario: Prefixed cookie reaches the Tenant
- When GET `/settings` with cookie `C`
- Then the response is 200

#### Scenario: Prefixed API token reaches the Tenant
- When GET `/api/user/profile/` with `Authorization: Token T`
- Then the response is 200

#### Scenario: Prefixed feed token reaches the Tenant
- Given a feed token `F` shown on the settings page
- When GET `/feeds/F/all`
- Then the response is 200 with an RSS document

#### Scenario: No credential reaches the Directory
- When GET `/bookmarks` without a cookie
- Then the response redirects to `/login?next=/bookmarks`

#### Scenario: Health is served without a credential
- When GET `/health`
- Then the response is 200 with JSON `status` equal to `healthy`

#### Scenario: Root without a credential goes to login
- When GET `/`
- Then the response redirects to `/login`

#### Scenario Outline: Forged prefixes hit an unprovisioned Tenant and get 404
- When GET `<path>` with cookie `sessionid=0123456789abcdef0123456789abcdef.x`
- Then the response is 404

Examples:
| path       |
| /settings  |
| /bookmarks |
| /setup     |

#### Scenario: A malformed prefix is treated as no credential
- When GET `/settings` with cookie `sessionid=not-hex.x`
- Then the response redirects to `/login?next=/settings`

## Feature: Isolation between Tenants

### Background:
- Given user `vic` set up through `/setup` with session cookie `CV` and API token `TV`
- And a second user `ana` registered in the Directory and provisioned with password `ana pass`, with session cookie `CA` and API token `TA`

#### Scenario: Bookmarks are private to their Tenant
- Given POST `/api/bookmarks/` with token `TV` created `https://example.com/v`
- When GET `/api/bookmarks/` with token `TA`
- Then `count` is 0
- And GET `/bookmarks` with cookie `CA` does not contain `example.com/v`

#### Scenario: A session from one Tenant cannot be replayed against another
- Given `CV` has value `KV.S`
- When GET `/settings` with cookie `sessionid=KA.S`
- Then the response redirects to `/login?next=/settings`

## Feature: Directory storage

#### Scenario: Directory migrations apply once
- Given the Directory has served one request
- When the Directory migration runner runs again inside the instance
- Then no error is thrown
- And `schema_migrations` holds one row per migration
