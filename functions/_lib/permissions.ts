import { hasuraRequest } from "./hasura";
import { OrgRole } from "./types";

/**
 * Layer 1 check, done inside the Action handler as well as at the
 * database layer: is `userId` a member of `orgId`, and with what
 * role? Every Action re-derives this itself (never trusts the
 * client) because Actions run with the admin secret and therefore
 * bypass the row-level permissions entirely — the handler IS the
 * permission boundary for anything it does.
 */
export async function getMembership(
  orgId: string,
  userId: string
): Promise<OrgRole | null> {
  const data = await hasuraRequest<{
    org_members: { role: OrgRole }[];
  }>(
    `query GetMembership($orgId: uuid!, $userId: uuid!) {
      org_members(where: { org_id: { _eq: $orgId }, user_id: { _eq: $userId } }, limit: 1) {
        role
      }
    }`,
    { orgId, userId }
  );
  return data.org_members[0]?.role ?? null;
}

export function canTrigger(role: OrgRole | null): boolean {
  return role === "owner" || role === "editor";
}

export function canApprove(role: OrgRole | null): boolean {
  return role === "owner" || role === "editor";
}
