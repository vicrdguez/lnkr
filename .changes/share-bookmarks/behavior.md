# Share bookmarks Behavior

### Background:
- Given the Instance has users `vic` (cookie `CV`, token `TV`) and `ana` (cookie `CA`, token `TA`)
- And `vic` has `enable_sharing` on
- And form posts carry `Origin: https://lnkr.test`

## Feature: Sharing preferences

#### Scenario: The section saves and the profile reports
- When POST `/settings/sharing` with `CV`, `enable_sharing` on, `enable_public_sharing` on, `default_mark_shared` on
- Then the response redirects to `/settings` and the checkboxes show checked
- And GET `/api/user/profile/` with `TV` has `enable_sharing` true and `enable_public_sharing` true

#### Scenario: Default mark shared preselects the form
- Given `vic` has `default_mark_shared` on
- When GET `/bookmarks/new` with `CV`
- Then the `shared` checkbox is checked

#### Scenario: Sharing off hides the controls
- Given `ana` has `enable_sharing` off
- When GET `/bookmarks` with `CA`
- Then no item has a Share button, the bulk bar has no Share button, and the new-bookmark form has no `shared` checkbox

## Feature: Marking bookmarks shared

#### Scenario: Sharing through the API appears for another user
- When POST `/api/bookmarks/` with `TV`, url `https://v.test/1`, title `From vic`, tag_names `["x"]`, shared true
- Then GET `/bookmarks/shared` with `CA` lists `From vic` with owner `vic` and tag `x`
- And GET `/bookmarks/shared` with `CV` lists it too

#### Scenario: The item button shares and unshares
- Given `vic` has a Bookmark `B` not shared
- When POST `/bookmarks/<B.id>/share` as a Datastar action with `CV`
- Then the patched item shows an `Unshare` button and GET `/bookmarks/shared` with `CA` lists `B`
- When POST `/bookmarks/<B.id>/unshare` as a Datastar action with `CV`
- Then GET `/bookmarks/shared` with `CA` does not list `B`

#### Scenario: Bulk share and unshare
- Given `vic` has Bookmarks `B1` and `B2`
- When POST `/bookmarks/bulk` with `CV`, `action` `share`, `selected` `{"b<B1.id>": true, "b<B2.id>": true}`
- Then GET `/bookmarks/shared` with `CA` lists both
- When POST `/bookmarks/bulk` with `CV`, `action` `unshare`, `selected` `{"b<B1.id>": true}`
- Then GET `/bookmarks/shared` with `CA` lists only `B2`

#### Scenario: Edits propagate
- Given `vic` shared `B` titled `Old`
- When PATCH `/api/bookmarks/<B.id>/` with `TV` and title `New`, tag_names `["y"]`
- Then GET `/bookmarks/shared` with `CA` lists `New` with tag `y` and not `Old`

#### Scenario: Deleting removes the shared entry
- Given `vic` shared `B`
- When DELETE `/api/bookmarks/<B.id>/` with `TV`
- Then GET `/bookmarks/shared` with `CA` does not list `B`

#### Scenario: Turning sharing off removes every entry and on restores them
- Given `vic` shared `B1` and `B2`
- When POST `/settings/sharing` with `CV` and `enable_sharing` absent
- Then GET `/bookmarks/shared` with `CA` lists nothing from `vic`
- When POST `/settings/sharing` with `CV` and `enable_sharing` on
- Then GET `/bookmarks/shared` with `CA` lists `B1` and `B2`

#### Scenario: Shared flag without sharing enabled has no effect
- Given `ana` has `enable_sharing` off
- When POST `/api/bookmarks/` with `TA`, url `https://a.test/1`, shared true
- Then GET `/bookmarks/shared` with `CV` does not list it

#### Scenario: Re-sync rebuilds the index
- Given `vic` shared `B1` and the index row for `B1` was removed directly in the Directory
- When POST `/settings/sharing/resync` with `CV`
- Then GET `/bookmarks/shared` with `CA` lists `B1`

## Feature: The shared page

### Background:
- Given `vic` shared `https://v.test/python` titled `Python notes` tagged `python`, and `https://v.test/rust` titled `Rust notes`
- And `ana` has sharing on and shared `https://a.test/cooking` titled `Cooking`

#### Scenario: Newest first across users with owners
- When GET `/bookmarks/shared` with `CV`
- Then the items are `Cooking` by `ana`, `Rust notes` by `vic`, `Python notes` by `vic`
- And no item has Archive, Delete, Edit or Share controls

#### Scenario: q matches title, description and url
- When GET `/bookmarks/shared?q=notes` with `CV`
- Then the items are `Rust notes` and `Python notes`
- When GET `/bookmarks/shared?q=a.test` with `CV`
- Then the only item is `Cooking`

#### Scenario: user filters by owner
- When GET `/bookmarks/shared?user=ana` with `CV`
- Then the only item is `Cooking`
- And the sidebar lists users `ana` and `vic` linking to the `user` filter

#### Scenario: Pagination spans users
- Given thirty more shared Bookmarks from `ana`
- When GET `/bookmarks/shared?page=2` with `CV`
- Then the list holds three items and the page contains `Page 2 of 2`

#### Scenario: Tag links search the shared page
- When GET `/bookmarks/shared` with `CV`
- Then the tag `python` on `Python notes` links to `/bookmarks/shared?q=python`

## Feature: Public sharing

### Background:
- Given `vic` has `enable_public_sharing` on and shared `Public one`
- And `ana` has `enable_public_sharing` off and shared `Private one`

#### Scenario: Anonymous visitors see public rows only
- When GET `/bookmarks/shared` without a cookie
- Then the response is 200 listing `Public one` and not `Private one`
- And the page has a `Log in` link and no nav for bookmarks or settings

#### Scenario: Turning public sharing off hides the rows
- When POST `/settings/sharing` with `CV`, `enable_sharing` on and `enable_public_sharing` absent
- Then GET `/bookmarks/shared` without a cookie lists nothing

#### Scenario: Logged-in users still see everything shared
- When GET `/bookmarks/shared` with `CA`
- Then the items include `Public one` and `Private one`

## Feature: Shared feeds

### Background:
- Given `vic` has public sharing on and shared `Public one`; `ana` has public sharing off and shared `Private one`
- And `vic` has feed token `F`

#### Scenario: The public feed lists public rows
- When GET `/feeds/shared` without a cookie
- Then the response is 200 RSS with the only item `Public one`

#### Scenario: The token feed lists all shared rows
- When GET `/feeds/F/shared`
- Then the items are `Private one` and `Public one`

#### Scenario: q and limit apply
- When GET `/feeds/F/shared?q=private&limit=1`
- Then the only item is `Private one`

## Feature: Landing page and guest profile

#### Scenario: Landing page sends visitors to the shared page
- Given the Instance setting `landing_page` is `shared_bookmarks`
- When GET `/` without a cookie
- Then the response redirects to `/bookmarks/shared`
- Given `landing_page` is `login`
- When GET `/` without a cookie
- Then the response redirects to `/login`

#### Scenario: The guest profile styles the anonymous page
- Given `guest_profile_user_id` is `vic`'s id and `vic` has theme `dark`, link target `_self` and date display `absolute`
- When GET `/bookmarks/shared` without a cookie
- Then the `html` element has `data-theme` `dark`, title links have `target` `_self` and dates are absolute

#### Scenario: No guest profile means defaults
- Given `guest_profile_user_id` is empty
- When GET `/bookmarks/shared` without a cookie
- Then the `html` element has `data-theme` `auto`
