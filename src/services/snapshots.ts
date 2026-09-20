/** Both Browser Rendering secrets are set; without them the Snapshot button is hidden and the action refused. */
export const snapshotsConfigured = (env: Env): boolean => Boolean(env.CF_ACCOUNT_ID && env.CF_BROWSER_TOKEN);
