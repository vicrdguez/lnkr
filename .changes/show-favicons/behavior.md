# Show favicons Behavior

### Background:
- Given the Tenant user `vic` exists and is logged in
- And a Bookmark with url `https://example.com/some/page?x=1`
- And `LD_FAVICON_PROVIDER` is `https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url={url}&size=32`

## Feature: Favicons toggle on the settings page

#### Scenario: Toggle is off by default
- When GET `/settings`
- Then the page contains a checkbox named `enable_favicons` that is not checked

#### Scenario: Turning the toggle on
- When POST `/settings/favicons` with `enable_favicons` `on`
- Then the response redirects to `/settings`
- And GET `/settings` shows the checkbox checked

#### Scenario: Turning the toggle off
- Given the toggle is on
- When POST `/settings/favicons` without `enable_favicons`
- Then GET `/settings` shows the checkbox not checked

## Feature: Icons in the bookmark list

#### Scenario: No icons when off
- Given the toggle is off
- When GET `/bookmarks`
- Then the page contains no element with class `favicon`

#### Scenario: Icon source is the provider template with the origin
- Given the toggle is on
- When GET `/bookmarks`
- Then the list item for the Bookmark contains `<img class="favicon" src="https://t1.gstatic.com/faviconV2?client=SOCIAL&amp;type=FAVICON&amp;fallback_opts=TYPE,SIZE,URL&amp;url=https%3A%2F%2Fexample.com&amp;size=32">` with `alt` empty and `loading="lazy"`
- And the `src` does not contain `some/page`

#### Scenario: Every item gets an icon
- Given the toggle is on
- And a second Bookmark with url `https://other.example/`
- When GET `/bookmarks`
- Then the page contains exactly two elements with class `favicon`

#### Scenario: Archived list also shows icons
- Given the toggle is on
- And the Bookmark is archived
- When GET `/bookmarks/archived`
- Then its list item contains an element with class `favicon`

## Feature: Profile reports the toggle

#### Scenario Outline: enable_favicons in the profile
- Given the toggle is `<state>`
- When GET `/api/user/profile/` with a valid token
- Then `enable_favicons` is `<value>`

Examples:
| state | value |
| off   | false |
| on    | true  |
