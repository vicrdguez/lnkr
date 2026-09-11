# Administer users Behavior

### Background:
- Given the Instance was set up with superuser `vic`, logged in with cookie `CV`
- And a second user `ana` created through the admin page with password `ana pass`, logged in with cookie `CA`
- And form posts carry `Origin: https://lnkr.test`

## Feature: Access to the admin page

#### Scenario: A superuser sees the page and the link
- When GET `/admin` with `CV`
- Then the response is 200 listing `vic` marked superuser and `ana` not, each with a joined date
- And GET `/bookmarks` with `CV` has a nav link `Admin` to `/admin`

#### Scenario: A non-superuser is refused
- When GET `/admin` with `CA`
- Then the response is 403
- And GET `/bookmarks` with `CA` has no nav link `Admin`

#### Scenario Outline: Every admin route is refused to non-superusers
- When `<method>` `<path>` with `CA`
- Then the response is 403

Examples:
| method | path                      |
| POST   | /admin/users              |
| POST   | /admin/users/1/password   |
| POST   | /admin/users/1/superuser  |
| POST   | /admin/users/1/delete     |
| POST   | /admin/settings           |

#### Scenario: Anonymous visitors are sent to login
- When GET `/admin` without a cookie
- Then the response redirects to `/login?next=/admin`

## Feature: Create users

#### Scenario: Creating a user provisions a Tenant
- When POST `/admin/users` with `CV`, username `bob` and password `bob pass`
- Then the response redirects to `/admin` and GET `/admin` lists `bob`
- And POST `/login` with `bob` and `bob pass` redirects to `/` with a cookie whose prefix is neither `vic`'s nor `ana`'s tenant key
- And GET `/api/bookmarks/` with `bob`'s API token has `count` 0

#### Scenario Outline: Invalid input is refused
- When POST `/admin/users` with `CV`, username `<username>` and password `<password>`
- Then the response is 400 with the admin page and an error
- And no user was created

Examples:
| username | password |
| ``       | `x`      |
| `carl`   | ``       |
| `ANA`    | `x`      |

## Feature: Reset password

#### Scenario: The new password replaces the old one
- When POST `/admin/users/<ana.id>/password` with `CV` and password `new ana pass`
- Then the response redirects to `/admin`
- And POST `/login` with `ana` and `new ana pass` redirects to `/`
- But POST `/login` with `ana` and `ana pass` answers 401

#### Scenario: An empty password is refused
- When POST `/admin/users/<ana.id>/password` with `CV` and password ``
- Then the response is 400 and `ana pass` still logs in

## Feature: Superuser flag

#### Scenario: Granting and revoking
- When POST `/admin/users/<ana.id>/superuser` with `CV`
- Then GET `/admin` with `CA` answers 200 and `ana` is listed as superuser
- When POST `/admin/users/<ana.id>/superuser` with `CV`
- Then GET `/admin` with `CA` answers 403

#### Scenario: A superuser cannot demote themselves
- When POST `/admin/users/<vic.id>/superuser` with `CV`
- Then the response is 400 and GET `/admin` with `CV` still answers 200

## Feature: Delete users

#### Scenario: Deleting a user wipes their Tenant
- Given `ana` has a bookmark and an API token `TA`
- When POST `/admin/users/<ana.id>/delete` with `CV`
- Then the response redirects to `/admin` and GET `/admin` does not list `ana`
- And GET `/settings` with `CA` answers 404
- And GET `/api/bookmarks/` with `TA` answers 404
- And POST `/login` with `ana` and `ana pass` answers 401

#### Scenario: A deleted username can be created again
- Given `ana` was deleted
- When POST `/admin/users` with `CV`, username `ana` and password `again`
- Then GET `/admin` lists `ana` and POST `/login` with `ana` and `again` redirects to `/`
- And GET `/api/bookmarks/` with `ana`'s new API token has `count` 0

#### Scenario: A superuser cannot delete themselves
- When POST `/admin/users/<vic.id>/delete` with `CV`
- Then the response is 400 and `vic` is still listed

#### Scenario: Unknown user
- When POST `/admin/users/999/delete` with `CV`
- Then the response is 404

## Feature: Instance settings

#### Scenario: Settings are shown and saved
- When GET `/admin` with `CV`
- Then the settings form shows `landing_page` `login` and `guest_profile_user_id` empty
- When POST `/admin/settings` with `CV`, landing_page `shared_bookmarks` and guest_profile_user_id `<ana.id>`
- Then the response redirects to `/admin` and the form shows `shared_bookmarks` and `ana` selected

#### Scenario: Invalid settings fall back
- When POST `/admin/settings` with `CV`, landing_page `elsewhere` and guest_profile_user_id `999`
- Then the form shows `login` and no guest user

## Feature: Mirror of the superuser flag

#### Scenario: The legacy main Tenant is a superuser
- Given the `main` Tenant existed before the Directory and was registered on the Directory's first request
- When GET `/admin` with a session for the `main` Tenant's user
- Then the response is 200
