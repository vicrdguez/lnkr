# Auto-tagging

A person declares Auto-tagging rules that tag a new Bookmark from its URL, so links gathered from the browser arrive tagged without typing, and the browser extension previews those Tags before saving.

## Behaviors
- The settings page has an Auto tagging section with one text of rules; saving replaces it and the page shows the saved text back exactly as typed. Saving it empty removes every rule.
- Each line is a URL pattern followed by the Tag names it adds, separated by whitespace. Blank lines, lines starting with `#`, lines with a pattern but no Tag and patterns that do not parse are ignored without failing the save.
- A pattern is a host with an optional path, query and fragment, optionally after a scheme, and every part it gives must hold. The host matches the URL's host or any subdomain of it, regardless of case. The path and the fragment match as prefixes of the URL's, case-sensitively. Every query key in the pattern must be in the URL, with the same value when the pattern gives one.
- Creating a Bookmark through `POST /api/bookmarks/` or the new-bookmark form adds the Tags of every matching rule to the submitted ones, never duplicating one that differs only in case. A URL that matches nothing gets only the submitted Tags.
- Saving a URL that is already bookmarked, through the API or the form, updates that Bookmark and adds no auto Tags; editing a Bookmark never consults the rules.
- `GET /api/bookmarks/check/` answers the matching Tags as `auto_tags` for any URL, bookmarked or not: in rule order, then the order within a rule, each name once regardless of case, and empty when nothing matches.
- While a new URL is typed in the new-bookmark form, the hint under it reads `Will be tagged:` followed by the Tags saving would add, and shows nothing when none would be.

## Out of scope
- Applying rules to existing Bookmarks or on edit
- Feedback on invalid rule lines in the settings page
- Regular expressions or wildcards in patterns
- Any change to Tag search or the Tag sidebar
