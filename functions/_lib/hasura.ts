/**
 * Thin admin-authenticated GraphQL client used by every function.
 * These functions run server-side only — the admin secret never
 * reaches the browser — which is what lets them perform the writes
 * that the row-level permissions in nhost/metadata/tables.yaml
 * deliberately withhold from the `user` role (workflow_runs,
 * step_runs, quota increments, approval resolution).
 */
const GRAPHQL_URL =
  process.env.NHOST_GRAPHQL_URL ||
  process.env.HASURA_GRAPHQL_URL ||
  "http://localhost:1337/v1/graphql";
const ADMIN_SECRET =
  process.env.GRAPHQL_ADMIN_SECRET ||
  process.env.HASURA_GRAPHQL_ADMIN_SECRET ||
  "";
export class HasuraError extends Error {
  errors: unknown;
  constructor(message: string, errors: unknown) {
    super(message);
    this.errors = errors;
  }
}
export async function hasuraRequest<T = any>(
  query: string,
  variables: Record<string, unknown> = {}
): Promise<T> {
  const res = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-hasura-admin-secret": ADMIN_SECRET,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) {
    throw new HasuraError("Hasura GraphQL error", json.errors);
  }
  return json.data as T;
}
