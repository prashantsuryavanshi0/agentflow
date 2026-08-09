import { gql } from "@apollo/client";

export const GET_MY_ORGS = gql`
  query GetMyOrgs {
    org_members {
      id
      role
      organization {
        id
        name
        quota_calls_used
        quota_calls_allowed
      }
    }
  }
`;

export const GET_ORG_USAGE = gql`
  query GetOrgUsage($orgId: uuid!) {
    org_usage_this_month(where: { org_id: { _eq: $orgId } }) {
      org_id
      quota_calls_allowed
      quota_calls_used
      quota_calls_remaining
      runs_this_month
    }
  }
`;

/** A query returning an org's workflows with their steps, triggers,
 * and most recent run status — as required by the assignment. */
export const GET_ORG_WORKFLOWS = gql`
  query GetOrgWorkflows($orgId: uuid!) {
    workflows(where: { org_id: { _eq: $orgId } }, order_by: { created_at: desc }) {
      id
      name
      description
      is_active
      created_at
      avg_run_duration_seconds
      steps(order_by: { step_order: asc }) {
        id
        step_order
        type
        name
        config
      }
      triggers {
        id
        type
        is_enabled
        next_run_at
      }
      latest_run {
        run_id
        status
        started_at
        finished_at
      }
    }
  }
`;

export const GET_WORKFLOW = gql`
  query GetWorkflow($id: uuid!) {
    workflows_by_pk(id: $id) {
      id
      org_id
      name
      description
      is_active
      steps(order_by: { step_order: asc }) {
        id
        step_order
        type
        name
        config
      }
      triggers {
        id
        type
        is_enabled
        next_run_at
      }
      runs(order_by: { created_at: desc }, limit: 10) {
        id
        status
        triggered_by_type
        started_at
        finished_at
      }
    }
  }
`;

export const GET_ORG_MEMBERS = gql`
  query GetOrgMembers($orgId: uuid!) {
    org_members(where: { org_id: { _eq: $orgId } }) {
      id
      role
      user_id
      user {
        displayName
        email
      }
    }
  }
`;
