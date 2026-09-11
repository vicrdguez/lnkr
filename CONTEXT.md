# lnkr

A personal bookmark manager that keeps linkding's REST API and browser extension working, so links are gathered from the browser and read later; content capture lives elsewhere.

## Language

### Ownership

**Instance**:
One deployment of lnkr reachable at one URL. An Instance serves one or more Tenants; the first version serves exactly one.
_Avoid_: server, app, site

**Tenant**:
One user's complete collection: their Bookmarks, Tags, Bundles, preferences, sessions and tokens. Nothing a Tenant owns is visible to another Tenant.
_Avoid_: account, workspace, user data, profile

**API token**:
A secret a client presents to act as a Tenant over the REST API. A Tenant may hold several, each named.
_Avoid_: API key, access token

**Feed token**:
A secret embedded in a Tenant's RSS feed URLs in place of a login.

### Bookmarks

**Bookmark**:
A saved URL with a title, a description, Notes, any number of Tags and the Unread, Archived and Shared flags. A URL appears at most once per Tenant.
_Avoid_: link, entry, item

**Tag**:
A label a Tenant applies to Bookmarks. Tag names are unique per Tenant regardless of case.
_Avoid_: label, category, keyword

**Notes**:
Free text attached to a Bookmark, stored and shown as plain text.
_Avoid_: comment, annotation, markdown

**Unread**:
The flag marking a Bookmark as still to be read.
_Avoid_: to-read, later, pending

**Archived**:
The state of a Bookmark taken out of the active list but kept, searchable, in the archive.
_Avoid_: hidden, closed, done

**Shared**:
The flag marking a Bookmark as visible to other Tenants of the same Instance. It has no effect while an Instance has one Tenant and exists so the API stays compatible.
_Avoid_: public, published

**Delete**:
Removing a Bookmark permanently. Distinct from Archived.
_Avoid_: remove

**Page metadata**:
The title and description read from the page at a URL, used to prefill a new Bookmark.
_Avoid_: scrape result, og data

**Auto-tagging rule**:
A rule that assigns Tags to a new Bookmark when its URL matches a host and optional path, query or fragment.

**Bundle**:
A saved search: a named combination of search terms, Tag conditions and flag filters that can be applied to the Bookmark list.
_Avoid_: saved filter, smart list, view

### Captured content

**Snapshot**:
A stored copy of a Bookmark's page content taken at a point in time, kept so the content survives the page disappearing.
_Avoid_: archive, cache, copy

**Asset**:
The API's name for a file attached to a Bookmark, kept for compatibility. In lnkr the only Asset is a Snapshot; there are no user uploads.
_Avoid_: attachment, upload, file

**Web Archive link**:
A link to the Internet Archive's copy of a Bookmark's URL. Not stored by lnkr and not a Snapshot.
_Avoid_: wayback, archive link

## Flagged ambiguities

- **Instance vs Tenant.** "A single instance for a single user" was used to mean both. Resolution: Instance is the deployment, Tenant is the user's data. In the first version one Instance holds one Tenant, and that Tenant is the only thing the Instance stores.
- **Archive.** Linkding uses "archive" for the Archived state, for Wayback links and for page copies. Resolution: Archived is the Bookmark state only; page copies are Snapshots; Internet Archive links are Web Archive links.
- **Remove vs Delete.** Linkding's UI says "Remove", its API says DELETE. Resolution: Delete everywhere.

## Example dialogue

**Dev:** When I save a page from the extension twice, do I get two Bookmarks?

**Expert:** No. A URL appears once per Tenant, so the second save updates the existing Bookmark and the form tells you it was already there.

**Dev:** And if I archive it, is that the same as taking a Snapshot?

**Expert:** Different things. Archived just moves the Bookmark out of the active list. A Snapshot is a stored copy of the page itself, attached as an Asset. The Web Archive link is neither; it points at the Internet Archive and we store nothing.

**Dev:** Notes support Markdown?

**Expert:** Notes are plain text. Real notes live in Obsidian; lnkr keeps the field so the extension and exports keep working.

**Dev:** If a second person joins the Instance later, do they see my Bookmarks?

**Expert:** Not unless a Bookmark is Shared, and sharing only comes with multi-Tenant support. Each Tenant's data is separate.
