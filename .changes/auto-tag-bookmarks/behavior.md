# Auto-tag bookmarks Behavior

### Background:
- Given the Tenant user `vic` exists and is logged in
- And `T` is an API token
- And rules are saved by POST `/settings/auto-tagging` with field `rules`

## Feature: Auto-tagging rules on the settings page

#### Scenario: Rules are saved and shown back
- When POST `/settings/auto-tagging` with rules
  ```
  github.com code
  # comment
  example.com/docs docs reference
  ```
- Then the response redirects to `/settings`
- And GET `/settings` contains a textarea named `rules` whose content is exactly the saved text

#### Scenario: Saving empty rules clears them
- Given rules `github.com code` are saved
- When POST `/settings/auto-tagging` with rules empty
- Then GET `/settings` shows an empty textarea
- And GET `/api/bookmarks/check/?url=https://github.com/x` has `auto_tags` `[]`

## Feature: Tags added on creation

### Background:
- Given rules
  ```
  github.com code
  github.com/sissbruecker linkding
  ```

#### Scenario: Matching rules add their tags to the submitted ones
- When POST `/api/bookmarks/` with url `https://github.com/sissbruecker/linkding` and `tag_names` `["read-later"]`
- Then the response is 201 with `tag_names` `["code", "linkding", "read-later"]`

#### Scenario: Auto tags never duplicate submitted tags
- When POST `/api/bookmarks/` with url `https://github.com/a/b` and `tag_names` `["Code"]`
- Then the response is 201 with `tag_names` `["Code"]`
- And GET `/api/tags/` lists exactly one tag named `Code`

#### Scenario: No matching rule adds nothing
- When POST `/api/bookmarks/` with url `https://example.org/` and `tag_names` `["x"]`
- Then the response is 201 with `tag_names` `["x"]`

#### Scenario: Updating an existing URL adds no auto tags
- Given a Bookmark with url `https://github.com/a/b` created before any rule existed, with `tag_names` `[]`
- When POST `/api/bookmarks/` with url `https://github.com/a/b` and title `New title`
- Then the response is 201 with `tag_names` `[]`

#### Scenario: The web form applies rules on create
- When the logged-in user submits the new-bookmark form with url `https://github.com/a/b` and tags `mine`
- Then the created Bookmark, read through GET `/api/bookmarks/`, has `tag_names` `["code", "mine"]`

#### Scenario: The form's URL hint lists the tags that will be added
- When the logged-in user requests the new-bookmark URL check for `https://github.com/a/b`
- Then the hint fragment contains `code`

## Feature: Check reports auto tags

#### Scenario: Auto tags for an unbookmarked URL
- Given rules `github.com code`
- When GET `/api/bookmarks/check/?url=https://github.com/a/b` with token `T`
- Then `bookmark` is null and `auto_tags` is `["code"]`

#### Scenario: Auto tags for a bookmarked URL
- Given rules `github.com code`
- And a Bookmark with url `https://github.com/a/b`
- When GET `/api/bookmarks/check/?url=https://github.com/a/b`
- Then `bookmark` is that Bookmark and `auto_tags` is `["code"]`

#### Scenario: Auto tags are unique and in rule order
- Given rules
  ```
  github.com code
  github.com/a code repo
  ```
- When GET `/api/bookmarks/check/?url=https://github.com/a/b`
- Then `auto_tags` is `["code", "repo"]`

## Feature: Rule matching

### Rule: Each part of a pattern restricts the match

#### Scenario Outline: Host, path, query and fragment matching
- Given the single rule `<pattern> hit`
- When GET `/api/bookmarks/check/?url=<url>`
- Then `auto_tags` is `<result>`

Examples:
| pattern                     | url                                          | result    |
| example.com                 | https://example.com/                         | ["hit"]   |
| example.com                 | https://www.example.com/page                 | ["hit"]   |
| example.com                 | https://EXAMPLE.com/                         | ["hit"]   |
| example.com                 | https://notexample.com/                      | []        |
| example.com                 | https://example.com.evil.net/                | []        |
| example.com/docs            | https://example.com/docs/intro               | ["hit"]   |
| example.com/docs            | https://example.com/Docs/intro               | []        |
| example.com/docs            | https://example.com/blog                     | []        |
| example.com?lang=en         | https://example.com/?lang=en&x=1             | ["hit"]   |
| example.com?lang=en         | https://example.com/?lang=de                 | []        |
| example.com?lang            | https://example.com/?lang=de                 | ["hit"]   |
| example.com?lang            | https://example.com/                         | []        |
| example.com#section         | https://example.com/#section-2               | ["hit"]   |
| example.com#section         | https://example.com/#other                   | []        |
| example.com/docs?v=2#intro  | https://example.com/docs/a?v=2&b=1#intro-x   | ["hit"]   |

#### Scenario: Comments, blank lines and tagless lines are ignored
- Given rules
  ```
  # only a comment

  example.com
  example.org hit
  ```
- When GET `/api/bookmarks/check/?url=https://example.com/`
- Then `auto_tags` is `[]`
- And GET `/api/bookmarks/check/?url=https://example.org/` has `auto_tags` `["hit"]`

#### Scenario: A rule with several tags adds all of them
- Given rules `example.com one two three`
- When POST `/api/bookmarks/` with url `https://example.com/`
- Then `tag_names` is `["one", "three", "two"]`
