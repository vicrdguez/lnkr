# Auto-tag bookmarks

## Why
Links gathered from the browser arrive untagged unless the person types tags every time. linkding lets a Tenant declare rules that tag a new Bookmark from its URL, and the browser extension previews those tags through `check`. Without them, gathering is slower and the extension shows an empty preview.

## What
A text of Auto-tagging rules on the settings page, one rule per line, matched against a new Bookmark's URL by host, path, query and fragment exactly as linkding does. Matching tags are added when a Bookmark is created through the API or the web form, and `check` reports them as `auto_tags` for any URL.

## Scope
- Settings page section "Auto tagging" with a textarea stored in the user's `prefs` JSON as `auto_tagging_rules`, saved by POST `/settings/auto-tagging`
- Rule syntax: `<pattern> <tag> [<tag>...]` per line; blank lines and lines starting with `#` ignored; pattern is `host[/path][?query][#fragment]`
- Matching: host equal to or ending with `.` plus the pattern host, path starting with the pattern path, every pattern query key present in the URL with the same value when the pattern gives one, fragment starting with the pattern fragment; comparisons of host are case-insensitive, the rest case-sensitive
- Tags from every matching rule are merged with the submitted `tag_names` when a new Bookmark is created by `POST /api/bookmarks/` or by the web new-bookmark form; a POST that updates an existing URL adds none
- `GET /api/bookmarks/check/` returns the matching tags as `auto_tags` for the given URL, whether or not it is bookmarked
- The new-bookmark form's URL hint lists the tags that will be added
- Invalid lines are ignored without failing the save

## Out of Scope
- Applying rules to existing Bookmarks or on edit
- Rule validation feedback in the settings page
- Regular expressions or wildcards in patterns
- Any change to tag search or the tag sidebar

## Definition of Done
- [ ] The settings page shows the current rules and saving replaces them; the saved text is shown back verbatim.
- [ ] Creating a Bookmark whose URL matches rules adds the rules' tags to the submitted ones, without duplicates, regardless of case.
- [ ] A URL matching no rule gets only the submitted tags.
- [ ] Host, path, query and fragment parts of a pattern each restrict the match exactly as specified.
- [ ] Comment lines, blank lines and lines without a tag are ignored.
- [ ] `check` returns `auto_tags` for the URL, in rule order without duplicates, and an empty list when nothing matches.
- [ ] Posting an existing URL through the API does not add auto tags to that Bookmark.
- [ ] The web new-bookmark form applies the rules on create and its URL hint lists the tags that will be added.

## Manual verification
- [ ] With a rule `github.com code`, open the extension on a GitHub page and see `code` prefilled in the tags field before saving.
