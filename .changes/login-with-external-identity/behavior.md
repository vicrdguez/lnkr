# Log in with an external identity Behavior

### Background:
- Given the provider issuer `https://op.test` serves discovery at `https://op.test/.well-known/openid-configuration` with authorization endpoint `https://op.test/authorize`, token endpoint `https://op.test/token`, JWKS at `https://op.test/jwks`
- And the test holds an RSA key pair whose public key the JWKS serves and signs ID tokens with it
- And the Directory has variables `LD_ENABLE_OIDC` `True`, `OIDC_OP_DISCOVERY_ENDPOINT` set to the discovery URL, `OIDC_RP_CLIENT_ID` `lnkr`, `OIDC_RP_CLIENT_SECRET` `secret`, unless a scenario says otherwise

## Feature: Starting the OIDC flow

#### Scenario: The login page offers OIDC
- When GET `/login`
- Then the page contains a link `Log in with OpenID Connect` to `/oidc/login` and still contains the password form

#### Scenario: The flow redirects to the provider
- When GET `/oidc/login`
- Then the response redirects to a URL starting with `https://op.test/authorize?`
- And its query has `response_type` `code`, `client_id` `lnkr`, `redirect_uri` `https://lnkr.test/oidc/callback`, `scope` containing `openid` and `email`, a `state`, a `code_challenge` and `code_challenge_method` `S256`
- And a cookie `oidc` is set with `HttpOnly`, `SameSite=Lax`, `Path=/oidc`, `Max-Age=600`

#### Scenario: OIDC disabled hides the link and the routes
- Given `LD_ENABLE_OIDC` is unset
- When GET `/login`
- Then the page has no link to `/oidc/login`
- And GET `/oidc/login` answers 404

## Feature: Completing the OIDC flow

### Background:
- Given `/oidc/login` was requested and its `state`, `code_challenge` and `oidc` cookie captured

#### Scenario: A valid callback creates the user and logs in
- Given the token endpoint answers a valid ID token for subject `s1` with `email` `ana@example.com` when it receives the code `c1` and a `code_verifier` matching the challenge
- When GET `/oidc/callback?code=c1&state=<state>` with the `oidc` cookie
- Then the response redirects to `/`
- And a `sessionid` cookie with a tenant key prefix is set and the `oidc` cookie is cleared
- And GET `/settings` with that cookie answers 200
- And the admin user list contains `ana@example.com` as a non-superuser

#### Scenario: A second login reuses the user
- Given `ana@example.com` logged in once through OIDC and saved a bookmark
- When the flow completes again for the same identity
- Then the new session's Tenant lists that bookmark

#### Scenario: The username claim is configurable
- Given `OIDC_USERNAME_CLAIM` is `preferred_username` and the ID token carries `preferred_username` `ana`
- When the flow completes
- Then the user is named `ana`

#### Scenario: An existing password user with the same name is reused
- Given the Instance was set up with user `ana@example.com` and a password
- When the flow completes for `email` `ana@example.com`
- Then the session belongs to that user's Tenant and the password still works

#### Scenario Outline: Invalid callbacks are refused
- When GET `/oidc/callback` `<condition>`
- Then the response is 400 and no `sessionid` cookie is set

Examples:
| condition                                                             |
| with `state` `wrong` and the `oidc` cookie                            |
| with the right `state` and no `oidc` cookie                           |
| when the token endpoint answers 400                                   |
| when the ID token is signed by another key                            |
| when the ID token's `aud` is `other`                                  |
| when the ID token expired an hour ago                                 |

#### Scenario: Identity users cannot use a password
- Given `ana@example.com` was created through OIDC
- When POST `/login` with username `ana@example.com` and any password
- Then the response is 401

## Feature: Disabled password form

#### Scenario: The form is hidden and refused
- Given `LD_DISABLE_LOGIN_FORM` is `True`
- When GET `/login`
- Then the page has the OIDC link and no password input
- When POST `/login` with any credentials
- Then the response is 403 and no cookie is set

## Feature: Cloudflare Access

### Background:
- Given `LD_ACCESS_TEAM_DOMAIN` is `team` and `LD_ACCESS_AUD` is `aud1`
- And `https://team.cloudflareaccess.com/cdn-cgi/access/certs` serves the test JWKS

#### Scenario: A valid Access JWT logs in and redirects
- When GET `/bookmarks` with header `Cf-Access-Jwt-Assertion` holding a token signed by the test key with `iss` `https://team.cloudflareaccess.com`, `aud` `["aud1"]`, `email` `bob@example.com`, `exp` in one hour
- Then the response redirects to `/bookmarks` and sets a prefixed `sessionid` cookie
- And GET `/bookmarks` with that cookie answers 200
- And the admin user list contains `bob@example.com`

#### Scenario: A request with a session ignores the header
- Given `vic` is logged in with cookie `C`
- When GET `/bookmarks` with `C` and an Access token for `bob@example.com`
- Then the response is 200 for `vic`'s Tenant and no new user is created

#### Scenario Outline: Invalid Access tokens are ignored
- When GET `/bookmarks` with an Access token that `<problem>`
- Then the response redirects to `/login?next=/bookmarks` and no user is created

Examples:
| problem                              |
| is signed by another key             |
| has `aud` `["other"]`                |
| expired an hour ago                  |
| has `iss` `https://evil.test`        |

#### Scenario: Access is off without the variables
- Given `LD_ACCESS_TEAM_DOMAIN` is unset
- When GET `/bookmarks` with a valid Access token
- Then the response redirects to `/login?next=/bookmarks`
