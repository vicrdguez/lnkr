# Import and export Netscape bookmarks Behavior

### Background:
- Given the Tenant user `vic` exists and is logged in
- And the fixture `test/fixtures/linkding-export.html` is a linkding export with three entries:
  ```
  <!DOCTYPE NETSCAPE-Bookmark-file-1>
  <META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
  <TITLE>Bookmarks</TITLE>
  <H1>Bookmarks</H1>
  <DL><p>
  <DT><A HREF="https://example.com/one" ADD_DATE="1700000000" LAST_MODIFIED="1700003600" PRIVATE="1" TOREAD="1" TAGS="alpha,beta">One &amp; only</A>
  <DD>First &lt;desc&gt;[linkding-notes]Line 1
  Line 2[/linkding-notes]
  <DT><A HREF="https://example.com/two" ADD_DATE="1700010000" LAST_MODIFIED="1700010000" PRIVATE="0" TOREAD="0" TAGS="">Two</A>
  <DT><A HREF="https://example.com/three" ADD_DATE="1700020000" LAST_MODIFIED="1700020000" PRIVATE="1" TOREAD="0" TAGS="alpha,linkding:bookmarks.archived">Three</A>
  <DD>Archived one
  </DL><p>
  ```

## Feature: Export

#### Scenario: Export downloads the Netscape file
- Given Bookmarks exist
- When GET `/settings/export`
- Then the response is 200 with `Content-Type` `text/html; charset=utf-8` and `Content-Disposition` `attachment; filename="bookmarks.html"`
- And the body starts with `<!DOCTYPE NETSCAPE-Bookmark-file-1>`

#### Scenario: Export entries carry every attribute
- Given a Bookmark `https://example.com/one` titled `One & only`, description `First <desc>`, Notes `Line 1\nLine 2`, tags `alpha` and `beta`, unread, added at `2023-11-14T22:13:20.000Z` and modified at `2023-11-14T23:13:20.000Z`
- When GET `/settings/export`
- Then the body contains the line `<DT><A HREF="https://example.com/one" ADD_DATE="1700000000" LAST_MODIFIED="1700003600" PRIVATE="1" TOREAD="1" TAGS="alpha,beta">One &amp; only</A>`
- And the next line is `<DD>First &lt;desc&gt;[linkding-notes]Line 1\nLine 2[/linkding-notes]`

#### Scenario: Archived Bookmarks get the marker tag
- Given an archived Bookmark `https://example.com/three` tagged `alpha`, read
- When GET `/settings/export`
- Then its entry has `PRIVATE="1"`, `TOREAD="0"` and `TAGS="alpha,linkding:bookmarks.archived"`

#### Scenario: A Shared Bookmark exports as not private
- Given a Bookmark `https://example.com/two` with `shared` true
- When GET `/settings/export`
- Then its entry has `PRIVATE="0"`

#### Scenario: Entries without a description have no DD line
- Given a Bookmark with an empty description and empty Notes
- When GET `/settings/export`
- Then its `<DT>` line is followed directly by the next `<DT>` line or by `</DL><p>`

#### Scenario: Export is oldest first
- Given Bookmarks added at 2023-11-14, 2023-11-15 and 2023-11-13
- When GET `/settings/export`
- Then the entries appear in the order 2023-11-13, 2023-11-14, 2023-11-15

#### Scenario: A Bookmark without a title exports its URL as the title
- Given a Bookmark `https://example.com/untitled` with an empty title
- When GET `/settings/export`
- Then its entry text is `https://example.com/untitled`

## Feature: Import

#### Scenario: Import creates Bookmarks from a linkding export
- When POST `/settings/import` with the fixture as `file`
- Then the response is 200 and contains `3 created, 0 updated, 0 skipped`
- And GET `/api/bookmarks/` lists `https://example.com/two` and `https://example.com/one` with `count` 2
- And the Bookmark `https://example.com/one` has title `One & only`, description `First <desc>`, notes `Line 1\nLine 2`, `tag_names` `["alpha", "beta"]`, `unread` true, `shared` false, `date_added` `2023-11-14T22:13:20.000Z`, `date_modified` `2023-11-14T23:13:20.000Z`
- And GET `/api/bookmarks/archived/` lists only `https://example.com/three` with `tag_names` `["alpha"]`

#### Scenario: The marker tag is not stored as a tag
- Given the fixture was imported
- When GET `/api/tags/`
- Then the names are exactly `alpha` and `beta`

#### Scenario: Re-import changes nothing
- Given the fixture was imported
- When POST `/settings/import` with the fixture again
- Then the response contains `0 created, 3 updated, 0 skipped`
- And GET `/api/bookmarks/` has `count` 2 and GET `/api/tags/` has `count` 2

#### Scenario: An existing URL is updated and tags merged
- Given a Bookmark `https://example.com/one` titled `Old`, tagged `gamma`, read, added at `2020-01-01T00:00:00.000Z`
- When POST `/settings/import` with the fixture
- Then the response contains `2 created, 1 updated, 0 skipped`
- And the Bookmark has title `One & only`, `tag_names` `["alpha", "beta", "gamma"]`, `unread` true and `date_added` `2020-01-01T00:00:00.000Z`

#### Scenario Outline: The private flag maps to Shared only when asked
- When POST `/settings/import` with the fixture and `map_private_flag` `<option>`
- Then the Bookmark `https://example.com/two` has `shared` `<two>` and `https://example.com/one` has `shared` false

Examples:
| option | two   |
| absent | false |
| on     | true  |

#### Scenario: Invalid URLs are skipped
- Given a file with entries `https://ok.test/`, `not a url` and `ftp://x.test/`
- When POST `/settings/import` with that file
- Then the response contains `1 created, 0 updated, 2 skipped`
- And GET `/api/bookmarks/` has `count` 1

#### Scenario: Missing attributes get defaults
- Given a file with the entry `<DT><A HREF="https://plain.test/">Plain</A>`
- When POST `/settings/import` with that file at `2026-09-11T10:00:00.000Z`
- Then the Bookmark has `tag_names` `[]`, `unread` false, `is_archived` false, `date_added` `2026-09-11T10:00:00.000Z`

#### Scenario: Folders are ignored
- Given a file whose entries sit inside `<DT><H3>Folder</H3><DL><p>...</DL><p>`
- When POST `/settings/import` with that file
- Then every entry is created and no tag named `Folder` exists

#### Scenario: A missing file is refused
- When POST `/settings/import` without a `file` part
- Then the response is 400

## Feature: Round trip

#### Scenario: Export of an imported fixture equals the fixture
- Given the fixture was imported into a fresh Tenant with `map_private_flag` on
- When GET `/settings/export`
- Then the body equals the fixture byte for byte
