import type { FC } from "hono/jsx";
import type { AssetRow } from "../db/assets";
import type { User } from "../db/users";
import { DOCTYPE, ErrorMessage, Layout } from "./layout";

/**
 * The form's fields as typed, also the Datastar signals the form declares; `tags` is space-separated and `id` is
 * the Bookmark being edited, absent on the new form.
 */
export type FormValues = {
  url: string;
  title: string;
  description: string;
  notes: string;
  tags: string;
  unread: boolean;
  id?: number;
};

export const EMPTY_FORM: FormValues = { url: "", title: "", description: "", notes: "", tags: "", unread: false };

/** Modifier attributes hold dots, which JSX attribute names cannot, so they are spread from objects. */
const CHECK_ON_INPUT = { "data-on:input__debounce.500ms": "@get('/bookmarks/check')" };
const SUGGEST_ON_INPUT = { "data-on:input__debounce.300ms": "@get('/bookmarks/tags/suggest')" };

export const BookmarkForm: FC<{
  user: User;
  title: string;
  action: string;
  values: FormValues;
  autoClose?: boolean;
  error?: string;
  /** The Bookmark's Assets, listed under the edit form only. */
  assets?: AssetRow[];
}> = ({ user, title, action, values, autoClose, error, assets }) => (
  <Layout title={title} user={user}>
    <ErrorMessage message={error} />
    {/* DEBT(#27/W1): Datastar rewrites @name( even inside these JSON string literals, so a value holding text like @Component( fails to compile and the form's live behaviors never start. */}
    <form method="post" action={action} data-signals={JSON.stringify(values)} data-init="$url && @get('/bookmarks/check')">
      {autoClose && <input type="hidden" name="auto_close" value="1" />}
      <label>
        URL
        <input name="url" type="url" value={values.url} required data-bind="url" {...CHECK_ON_INPUT} />
      </label>
      <UrlHint />
      <label>
        Title
        <input name="title" value={values.title} data-bind="title" />
      </label>
      <label>
        Description
        <textarea name="description" data-bind="description">
          {values.description}
        </textarea>
      </label>
      <label>
        Notes
        <textarea name="notes" data-bind="notes">
          {values.notes}
        </textarea>
      </label>
      <label>
        Tags
        <input name="tags" value={values.tags} autocomplete="off" data-bind="tags" {...SUGGEST_ON_INPUT} />
      </label>
      <TagSuggestions typed="" names={[]} />
      <label class="checkbox">
        <input type="checkbox" name="unread" checked={values.unread} data-bind="unread" /> Unread
      </label>
      <button>Save</button>
    </form>
    {assets && <Snapshots assets={assets} />}
  </Layout>
);

/** The Bookmark's Snapshots, newest first: a view link once complete, and Delete, which asks first. */
const Snapshots: FC<{ assets: AssetRow[] }> = ({ assets }) => (
  <section id="snapshots">
    <h2>Snapshots</h2>
    {assets.length > 0 && (
      <ul>
        {assets.map((asset) => (
          <li>
            {asset.status === "complete" ? <a href={`/assets/${asset.id}`}>{asset.display_name}</a> : asset.display_name}{" "}
            <span class="status">{asset.status}</span>{" "}
            {asset.status === "complete" && <span class="size">{(asset.file_size / 1024).toFixed(1)} KB</span>}{" "}
            <form method="post" action={`/assets/${asset.id}/delete`}>
              <button
                aria-label={`Delete ${asset.display_name}`}
                data-on:click="confirm('Delete this snapshot?') || evt.preventDefault()"
              >
                Delete
              </button>
            </form>
          </li>
        ))}
      </ul>
    )}
  </section>
);

/** The notice under the URL field: whether the URL belongs to Bookmark `id`, and the auto tags saving would add. */
export const UrlHint: FC<{ id?: number; autoTags?: string[] }> = ({ id, autoTags = [] }) => (
  <div id="url-hint" class="hint" role="status">
    {id !== undefined && (
      <>
        This URL is already bookmarked. The form has been filled from the existing bookmark.{" "}
        <a href={`/bookmarks/${id}/edit`}>Edit it</a>
      </>
    )}
    {autoTags.length > 0 && <p>Will be tagged: {autoTags.join(" ")}</p>}
  </div>
);

/** One button per name; clicking it replaces the last token of `typed` in the `tags` signal. */
export const TagSuggestions: FC<{ typed: string; names: string[] }> = ({ typed, names }) => (
  <div id="tag-suggestions">
    {names.map((name) => (
      // JSON.stringify writes the JavaScript string literal, escaping quotes, backslashes and control characters.
      // DEBT(#27/W2): String.replace reads $&, $', $`, $$ and $<n> in a tag name as patterns, so such a name completes wrongly.
      <button type="button" data-on:click={`$tags = ${JSON.stringify(`${typed.replace(/\S*$/, name)} `)}`}>
        {name}
      </button>
    ))}
  </div>
);

/** The page an `auto_close` save lands on: the project's only inline script closes the window. */
export const ClosePage: FC = () => (
  <>
    {DOCTYPE}
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>Saved · lnkr</title>
      </head>
      <body>
        <p>You can now close this window.</p>
        <script>window.close()</script>
      </body>
    </html>
  </>
);
