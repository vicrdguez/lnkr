import type { FC } from "hono/jsx";
import type { BundleInput, BundleRow } from "../db/bundles";
import type { User } from "../db/users";
import { ErrorMessage, Layout } from "./layout";

/** The Bundle's parts in one line: the search, then each non-empty tag list with its role. */
const summary = ({ search, any_tags, all_tags, excluded_tags }: BundleRow): string =>
  [search, any_tags && `any: ${any_tags}`, all_tags && `all: ${all_tags}`, excluded_tags && `not: ${excluded_tags}`]
    .filter(Boolean)
    .join(" · ");

/** Every Bundle in sidebar order with Up, Down, Edit and Delete, which asks first. */
export const BundleList: FC<{ user: User; bundles: BundleRow[] }> = ({ user, bundles }) => (
  <Layout title="Bundles" user={user} section="bundles">
    <p>
      <a href="/bundles/new">New bundle</a>
    </p>
    {bundles.length === 0 && <p class="empty">No bundles yet</p>}
    <ul id="bundle-list">
      {bundles.map((bundle) => (
        <li class="actions">
          <a class="name" href={`/bookmarks?bundle=${bundle.id}`}>
            {bundle.name}
          </a>
          <span class="summary">{summary(bundle)}</span>
          <form method="post" action={`/bundles/${bundle.id}/up`}>
            <button aria-label={`Move ${bundle.name} up`}>Up</button>
          </form>
          <form method="post" action={`/bundles/${bundle.id}/down`}>
            <button aria-label={`Move ${bundle.name} down`}>Down</button>
          </form>
          <a class="edit" href={`/bundles/${bundle.id}/edit`} aria-label={`Edit ${bundle.name}`}>
            Edit
          </a>
          <form method="post" action={`/bundles/${bundle.id}/delete`}>
            <button
              aria-label={`Delete ${bundle.name}`}
              data-on:click="confirm('Delete this bundle?') || evt.preventDefault()"
            >
              Delete
            </button>
          </form>
        </li>
      ))}
    </ul>
  </Layout>
);

/** The new and edit forms: a name, a search in the query grammar, and the three whitespace-separated tag lists. */
export const BundleForm: FC<{ user: User; title: string; action: string; values: BundleInput; error?: string }> = ({
  user,
  title,
  action,
  values,
  error,
}) => (
  <Layout title={title} user={user} section="bundles">
    <ErrorMessage message={error} />
    <form method="post" action={action}>
      <label>
        Name
        <input name="name" value={values.name} required />
      </label>
      <label>
        Search
        <input name="search" value={values.search} />
      </label>
      <label>
        Any of these tags
        <input name="any_tags" value={values.any_tags} autocomplete="off" />
      </label>
      <label>
        All of these tags
        <input name="all_tags" value={values.all_tags} autocomplete="off" />
      </label>
      <label>
        None of these tags
        <input name="excluded_tags" value={values.excluded_tags} autocomplete="off" />
      </label>
      <p class="hint">
        Tag lists take names separated by spaces, matched regardless of case. The search takes the same grammar as the
        search box.
      </p>
      <button>Save</button>
    </form>
  </Layout>
);
