# Stand up the Tenant Behavior

## Feature: First-run setup

#### Scenario: Setup form is offered on a fresh Instance
- Given no user exists
- When a visitor requests GET `/setup`
- Then the response is 200 and contains a form with `username` and `password` fields

#### Scenario: Setup creates the user and starts a session
- Given no user exists
- When the visitor submits POST `/setup` with username `vic` and password `correct horse battery`
- Then the response redirects to `/`
- And a `sessionid` cookie is set
- And GET `/settings` with that cookie answers 200

#### Scenario Outline: Setup rejects missing fields
- Given no user exists
- When the visitor submits POST `/setup` with username `<username>` and password `<password>`
- Then the response is 400 and contains the setup form with an error
- And GET `/setup` still answers 200

Examples:
| username | password |
| ``       | `secret` |
| `vic`    | ``       |

#### Scenario Outline: Setup is closed once a user exists
- Given the user `vic` exists
- When anyone sends `<method>` `/setup`
- Then the response redirects to `/login`
- And no second user exists, shown by `vic` still being the only username that can log in

Examples:
| method |
| GET    |
| POST   |

## Feature: Password login

### Background:
- Given the user `vic` exists with password `correct horse battery`

#### Scenario: Protected page redirects to login
- Given no session cookie
- When GET `/settings`
- Then the response redirects to `/login?next=/settings`

#### Scenario: Correct credentials start a session
- When POST `/login` with username `vic` and password `correct horse battery`
- Then the response redirects to `/`
- And the `Set-Cookie` header sets `sessionid` with `HttpOnly`, `SameSite=Lax`, `Path=/` and `Max-Age=1209600`
- And GET `/settings` with that cookie answers 200

#### Scenario Outline: Secure flag follows the request scheme
- When POST `/login` with valid credentials over `<scheme>`
- Then the `sessionid` cookie `<secure>` the `Secure` attribute

Examples:
| scheme | secure   |
| https  | carries  |
| http   | omits    |

#### Scenario: Same-origin next path is honoured
- When POST `/login?next=/settings` with valid credentials
- Then the response redirects to `/settings`

#### Scenario: Next pointing at another origin is ignored
- When POST `/login?next=https://evil.example/` with valid credentials
- Then the response redirects to `/`

#### Scenario Outline: Wrong credentials are refused
- When POST `/login` with username `<username>` and password `<password>`
- Then the response is 401 and contains the login form with the message `Invalid username or password`
- And no `Set-Cookie` header is present

Examples:
| username | password        |
| vic      | wrong           |
| nobody   | correct horse battery |

#### Scenario: Root redirects by session
- Given a valid session cookie
- When GET `/`
- Then the response redirects to `/settings`
- But without a cookie GET `/` redirects to `/login`

## Feature: Login attempt limiter

### Background:
- Given the user `vic` exists with password `correct horse battery`

### Rule: Five failures within fifteen minutes lock the username until the window ends

#### Scenario: Sixth attempt is refused even with the right password
- Given five failed POST `/login` for `vic` within the last fifteen minutes
- When POST `/login` with username `vic` and the correct password
- Then the response is 429 and contains the message `Too many attempts. Try again later.`
- And no `Set-Cookie` header is present

#### Scenario: The lock ends with the window
- Given five failed POST `/login` for `vic`
- And sixteen minutes pass
- When POST `/login` with username `vic` and the correct password
- Then the response redirects to `/` and sets `sessionid`

#### Scenario: A successful login resets the count
- Given four failed POST `/login` for `vic`
- And one successful POST `/login` for `vic`
- When four more failed POST `/login` for `vic`
- And POST `/login` with the correct password
- Then the response redirects to `/` and sets `sessionid`

## Feature: Session lifecycle

### Background:
- Given the user `vic` is logged in with a `sessionid` cookie

#### Scenario: Logout ends the session
- When POST `/logout` with the cookie
- Then the response redirects to `/login`
- And `Set-Cookie` clears `sessionid` with `Max-Age=0`
- And GET `/settings` with the old cookie redirects to `/login?next=/settings`

#### Scenario: Expired session is rejected
- Given fifteen days pass
- When GET `/settings` with the cookie
- Then the response redirects to `/login?next=/settings`

## Feature: Change password

### Background:
- Given the user `vic` with password `correct horse battery` is logged in

#### Scenario: Password changes with the current password
- When POST `/settings/password` with current `correct horse battery`, new `new pass phrase`, confirm `new pass phrase`
- Then the response redirects to `/settings`
- And POST `/login` with `new pass phrase` starts a session
- But POST `/login` with `correct horse battery` answers 401

#### Scenario: Wrong current password is rejected
- When POST `/settings/password` with current `wrong`, new `new pass phrase`, confirm `new pass phrase`
- Then the response is 400 and contains the form with an error
- And POST `/login` with `correct horse battery` still starts a session

#### Scenario: Mismatched confirmation is rejected
- When POST `/settings/password` with current `correct horse battery`, new `new pass phrase`, confirm `other`
- Then the response is 400 and contains the form with an error
- And POST `/login` with `correct horse battery` still starts a session

## Feature: Cross-site form protection

#### Scenario: Form POST from another origin is refused
- Given the user `vic` exists
- When POST `/login` with valid credentials and header `Origin: https://evil.example`
- Then the response is 403
- And no `Set-Cookie` header is present

## Feature: Health

#### Scenario: Health is public
- Given no session cookie
- When GET `/health`
- Then the response is 200 with JSON `status` equal to `healthy` and a non-empty `version`

## Feature: Schema migrations

#### Scenario: Migrations apply once
- Given the Tenant object has served one request
- When the migration runner runs again inside the object
- Then no error is thrown
- And `schema_migrations` holds exactly one row per migration in the list
