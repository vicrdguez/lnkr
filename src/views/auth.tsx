import { ErrorMessage, Field, Layout } from "./layout";

/** The first-run form; the Directory serves it until the first user exists. */
export const SetupForm = ({ error }: { error?: string }) => (
  <Layout title="Set up lnkr">
    <ErrorMessage message={error} />
    <form method="post">
      <Field label="Username" name="username" autocomplete="username" />
      <Field label="Password" name="password" type="password" autocomplete="new-password" />
      <button>Set up</button>
    </form>
  </Layout>
);

/** The login form, identical whether the Directory or a Tenant renders it. */
export const LoginForm = ({ error }: { error?: string }) => (
  <Layout title="Log in">
    <ErrorMessage message={error} />
    <form method="post">
      <Field label="Username" name="username" autocomplete="username" />
      <Field label="Password" name="password" type="password" autocomplete="current-password" />
      <button>Log in</button>
    </form>
  </Layout>
);

export const INVALID_CREDENTIALS = "Invalid username or password";
