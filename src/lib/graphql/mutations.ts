import { gql } from "@apollo/client";

export const CREATE_ORGANIZATION = gql`
  mutation CreateOrganization($name: String!) {
    createOrganization(input: { name: $name }) {
      org_id
      name
    }
  }
`;

export const CREATE_WORKFLOW = gql`
  mutation CreateWorkflow($orgId: uuid!, $name: String!, $description: String) {
    insert_workflows_one(object: { org_id: $orgId, name: $name, description: $description }) {
      id
    }
  }
`;

/** A mutation to create/edit a workflow, its steps, and its triggers. */
export const SAVE_WORKFLOW_STEPS = gql`
  mutation SaveWorkflowSteps(
    $workflowId: uuid!
    $orgId: uuid!
    $deleteIds: [uuid!]!
    $steps: [workflow_steps_insert_input!]!
  ) {
    delete_workflow_steps(where: { id: { _in: $deleteIds } }) {
      affected_rows
    }
    insert_workflow_steps(
      objects: $steps
      on_conflict: { constraint: workflow_steps_pkey, update_columns: [name, type, config, step_order] }
    ) {
      affected_rows
    }
  }
`;

export const UPSERT_TRIGGER = gql`
  mutation UpsertTrigger($object: workflow_triggers_insert_input!) {
    insert_workflow_triggers_one(
      object: $object
      on_conflict: { constraint: workflow_triggers_pkey, update_columns: [config, is_enabled, next_run_at] }
    ) {
      id
      type
    }
  }
`;

export const DELETE_TRIGGER = gql`
  mutation DeleteTrigger($id: uuid!) {
    delete_workflow_triggers_by_pk(id: $id) {
      id
    }
  }
`;

export const UPDATE_WORKFLOW_META = gql`
  mutation UpdateWorkflowMeta($id: uuid!, $name: String!, $description: String, $is_active: Boolean!) {
    update_workflows_by_pk(pk_columns: { id: $id }, _set: { name: $name, description: $description, is_active: $is_active }) {
      id
    }
  }
`;

export const TRIGGER_WORKFLOW_RUN = gql`
  mutation TriggerWorkflowRun($workflowId: uuid!) {
    triggerWorkflowRun(input: { workflow_id: $workflowId }) {
      run_id
      status
    }
  }
`;

/** A mutation to approve a paused approval_gate step. */
export const APPROVE_STEP = gql`
  mutation ApproveStep($stepRunId: uuid!, $approve: Boolean!, $comment: String) {
    approveStep(input: { step_run_id: $stepRunId, approve: $approve, comment: $comment }) {
      step_run_id
      status
      resumed
    }
  }
`;

export const CREATE_EVENT_SOURCE_ROW = gql`
  mutation FireDatabaseEvent($triggerId: uuid!, $orgId: uuid!, $payload: jsonb!) {
    insert_workflow_event_sources_one(
      object: { workflow_trigger_id: $triggerId, org_id: $orgId, payload: $payload }
    ) {
      id
    }
  }
`;
