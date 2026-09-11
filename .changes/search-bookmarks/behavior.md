# Search bookmarks Behavior

### Background:
- Given the Tenant user `vic` exists with API token `T`
- And these bookmarks were created through the API, in this order:

  | ref | url                                   | title               | description        | notes            | tag_names            | unread | is_archived |
  | b1  | https://example.com/python-guide      | Python guide        | Learn Python fast  |                  | ["python","tutorial"] | true   | false       |
  | b2  | https://example.com/rust-book         | The Rust Book       |                    | read chapter 3   | ["rust","book"]      | false  | false       |
  | b3  | https://example.com/cooking           | Cooking with Java   | coffee not code    |                  | []                   | false  | false       |
  | b4  | https://example.com/archived-python   | Old Python notes    |                    |                  | ["python"]           | false  | true        |

## Feature: Query grammar on the active list

#### Scenario Outline: Queries select the expected active bookmarks
- When GET `/api/bookmarks/?q=<q>`
- Then the response is 200
- And the result urls are exactly `<results>` in newest-first order
- And `count` equals the number of results

Examples:
| q                            | results     |
| python                       | b1          |
| PYTHON                       | b1          |
| "python guide"               | b1          |
| 'learn python'               | b1          |
| guide fast                   | b1          |
| guide and fast               | b1          |
| Guide AND Fast               | b1          |
| rust or java                 | b3, b2      |
| python and tutorial          |             |
| python and #tutorial         | b1          |
| #python                      | b1          |
| #Python                      | b1          |
| not python                   | b3, b2      |
| NOT python                   | b3, b2      |
| !unread                      | b1          |
| !untagged                    | b3          |
| !bogus                       | b3, b2, b1  |
| chapter                      | b2          |
| rust-book                    | b2          |
| coffee (java or rust)        | b3          |
| (java or rust) and coffee    | b3          |
| not java and not rust        | b1          |
| not (java or rust)           | b1          |
| java or rust and chapter     | b3, b2      |
| (java or rust) and chapter   | b2          |
| #rust #book                  | b2          |
| #rust or #tutorial           | b2, b1      |
| python not tutorial          | b1          |
| python not #tutorial         |             |
| zzz                          |             |

#### Scenario Outline: Unparsable queries answer zero results
- When GET `/api/bookmarks/?q=<q>`
- Then the response is 200 with `count` 0 and an empty `results`

Examples:
| q          |
| (python    |
| python)    |
| python and |
| and python |
| ()         |
| not        |
| "unclosed  |

#### Scenario: An empty query returns everything active
- When GET `/api/bookmarks/?q=`
- Then the result urls are exactly `b3, b2, b1`

#### Scenario: A whitespace-only query returns everything active
- When GET `/api/bookmarks/?q=%20%20`
- Then the result urls are exactly `b3, b2, b1`

#### Scenario: A query with too many terms answers zero results
- When GET `/api/bookmarks/?q=` followed by thirty distinct terms separated by spaces
- Then the response is 200 with `count` 0

## Feature: Query grammar on the archived list

#### Scenario: The archived list searches only archived bookmarks
- When GET `/api/bookmarks/archived/?q=python`
- Then the result urls are exactly `b4`

#### Scenario: The active list never returns archived matches
- When GET `/api/bookmarks/?q=old`
- Then `count` is 0

## Feature: Search composes with the other list parameters

#### Scenario: Search and pagination
- When GET `/api/bookmarks/?q=not%20zzz&limit=2`
- Then `count` is 3, `results` has two items, and `next` is the same URL with `offset=2`

#### Scenario: Search and added_since
- Given `b1` was added at `2026-09-01T00:00:00.000Z` and `b2` and `b3` on `2026-09-10T00:00:00.000Z`
- When GET `/api/bookmarks/?q=not%20zzz&added_since=2026-09-05T00:00:00Z`
- Then the result urls are exactly `b3, b2`

## Feature: Term matching is a substring match on every text field

#### Scenario Outline: Each field is searched
- When GET `/api/bookmarks/?q=<q>`
- Then the result urls are exactly `<results>`

Examples:
| q         | results | matched field |
| Rust Book | b2      | title         |
| not code  | b3      | description   |
| chapter 3 | b2      | notes         |
| /cooking  | b3      | url           |
