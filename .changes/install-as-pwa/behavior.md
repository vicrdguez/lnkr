# Install as a PWA Behavior

### Background:
- Given the Tenant user `vic` exists

## Feature: Web app manifest

#### Scenario: The manifest is public and complete
- When GET `/manifest.json` without a cookie
- Then the response is 200 with `Content-Type` `application/manifest+json` and `Cache-Control` `max-age=86400`
- And the JSON has `name` `lnkr`, `short_name` `lnkr`, `start_url` `/bookmarks`, `display` `standalone`, `theme_color` and `background_color` strings
- And `icons` contains `{"src": "/static/icon.svg", "sizes": "any", "type": "image/svg+xml"}`
- And `share_target` is `{"action": "/bookmarks/new", "method": "GET", "params": {"url": "url", "title": "title", "text": "text"}}`

#### Scenario: The icon is served
- When GET `/static/icon.svg`
- Then the response is 200 with a `Content-Type` starting with `image/svg+xml`

## Feature: OpenSearch

#### Scenario: The description is public
- When GET `/opensearch.xml` without a cookie
- Then the response is 200 with `Content-Type` `application/opensearchdescription+xml; charset=utf-8`
- And the body contains `<ShortName>lnkr</ShortName>` and `<Url type="text/html" template="https://lnkr.test/bookmarks?q={searchTerms}"/>`

## Feature: Head links

#### Scenario: The layout advertises manifest and search
- Given `vic` is logged in
- When GET `/bookmarks`
- Then the head contains `<link rel="manifest" href="/manifest.json">`, `<link rel="search" type="application/opensearchdescription+xml" title="lnkr" href="/opensearch.xml">`, `<meta name="theme-color"` and `<link rel="apple-touch-icon" href="/static/icon.svg">`

## Feature: Shared text as URL

#### Scenario: A URL in text prefills the form
- Given `vic` is logged in
- When GET `/bookmarks/new?title=Shared&text=https://example.com/shared`
- Then the `url` input holds `https://example.com/shared` and `title` holds `Shared`

#### Scenario: Text that is not a URL is ignored
- Given `vic` is logged in
- When GET `/bookmarks/new?text=just+words`
- Then the `url` input is empty

#### Scenario: An explicit url wins over text
- Given `vic` is logged in
- When GET `/bookmarks/new?url=https://example.com/a&text=https://example.com/b`
- Then the `url` input holds `https://example.com/a`
