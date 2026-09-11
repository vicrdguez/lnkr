# Serve feeds and named tokens Behavior

### Background:
- Given the Tenant user `vic` exists and is logged in

## Feature: Named API tokens

#### Scenario: Creating a token shows the key once
- When POST `/settings/tokens` with `name` `laptop`
- Then the response is 200 and contains a 40-character hexadecimal key `K` and the text `laptop`
- And GET `/api/user/profile/` with `Authorization: Token K` answers 200
- But GET `/settings` contains `laptop` and does not contain `K`

#### Scenario: Tokens are listed by name and date
- Given tokens `laptop` and `phone` were created
- When GET `/settings`
- Then the Integrations section lists `laptop` and `phone` each with a creation date and a Revoke button

#### Scenario: A name is required
- When POST `/settings/tokens` with `name` empty
- Then the response is 400 with an error
- And GET `/settings` lists no new token

#### Scenario: Revoking a token
- Given token `laptop` with key `K` was created
- When POST `/settings/tokens/<id>/revoke`
- Then the response redirects to `/settings`
- And GET `/settings` does not list `laptop`
- And GET `/api/user/profile/` with `Authorization: Token K` answers 401

#### Scenario: A token created by the earlier slice keeps working
- Given an `api_tokens` row that existed before this slice
- When GET `/settings`
- Then it is listed with its stored name
- And its key still authenticates the API

## Feature: Feed token

#### Scenario: Feed token and URLs are shown
- When GET `/settings`
- Then the page contains a feed token `F` of 40 hexadecimal characters
- And the URLs `https://lnkr.test/feeds/F/all` and `https://lnkr.test/feeds/F/unread`

#### Scenario: The feed token is stable
- Given GET `/settings` showed feed token `F`
- When GET `/settings` again
- Then the page shows the same `F`

## Feature: RSS feeds

### Background:
- Given feed token `F`
- And Bookmarks created in order: `https://a.test/` titled `A` unread, `https://b.test/` titled `B` read with description `About B`, `https://c.test/` titled `C` unread and archived

#### Scenario: All feed lists active Bookmarks newest first
- When GET `/feeds/F/all` without cookies
- Then the response is 200 with `Content-Type` `application/rss+xml; charset=utf-8`
- And the body is an `<rss version="2.0">` document whose channel `<title>` is `All bookmarks`
- And the items are, in order, `B` then `A`, each with `<link>` equal to the Bookmark URL, `<description>` equal to the Bookmark description and a `<pubDate>` in RFC 2822 form
- And there is no item for `C`

#### Scenario: Unread feed lists active unread Bookmarks
- When GET `/feeds/F/unread`
- Then the only item is `A`

#### Scenario: q filters the feed with the search grammar
- Given a Bookmark `https://d.test/` titled `D` tagged `docs`
- When GET `/feeds/F/all?q=%23docs`
- Then the only item is `D`

#### Scenario: limit caps the items
- When GET `/feeds/F/all?limit=1`
- Then there is exactly one item, `B`

#### Scenario: Default limit is 100
- Given 101 active Bookmarks
- When GET `/feeds/F/all`
- Then there are exactly 100 items

#### Scenario: Unknown token
- When GET `/feeds/0000000000000000000000000000000000000000/all`
- Then the response is 404

#### Scenario Outline: Only all and unread exist
- When GET `/feeds/F/<kind>`
- Then the response is `<status>`

Examples:
| kind    | status |
| all     | 200    |
| unread  | 200    |
| shared  | 404    |
| other   | 404    |

#### Scenario: Text is escaped
- Given a Bookmark titled `Tom & Jerry <3` with description `a > b`
- When GET `/feeds/F/all`
- Then the body contains `<title>Tom &amp; Jerry &lt;3</title>` and `<description>a &gt; b</description>`

#### Scenario: A Bookmark without a title uses its URL
- Given a Bookmark `https://e.test/` with an empty title
- When GET `/feeds/F/all`
- Then its item `<title>` is `https://e.test/`
