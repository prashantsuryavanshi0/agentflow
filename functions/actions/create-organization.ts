import type { Request, Response } from "express";
import { hasuraRequest } from "../_lib/hasura";

/**
 * Creates an organization and its first org_members row (role:
 * owner) atomically, so a signed-in user always lands in a workflow
 * they actually control. Implemented as an Action instead of a
 * direct insert permission to avoid a race between the two inserts.
 */
export default async function handler(req: Request, res: Response) {
  try {

    const sessionVariables = req.body.session_variables || {};
    const userId = sessionVariables["x-hasura-user-id"];
    const name = (req.body.input?.name || "").trim();

    if (!userId) return res.status(401).json({ message: "Sign in required" });
    if (!name) return res.status(400).json({ message: "name is required" });

    const org = await hasuraRequest<{ insert_organizations_one: { id: string; name: string } }>(
      `mutation CreateOrg($name: String!) {
        insert_organizations_one(object: { name: $name }) { id name }
      }`,
      { name }
    );

    await hasuraRequest(
      `mutation AddOwner($orgId: uuid!, $userId: uuid!) {
        insert_org_members_one(object: { org_id: $orgId, user_id: $userId, role: owner }) { id }
      }`,
      { orgId: org.insert_organizations_one.id, userId }
    );

    return res.status(200).json({ org_id: org.insert_organizations_one.id, name: org.insert_organizations_one.name });
  } catch (err: any) {
    console.error("createOrganization error", err);
    return res.status(500).json({ message: err?.message || "Internal error" });
  }
}
