/**
 * Ticket machines on Railway (FB-239; John's ruling, 2026-10-02; D11).
 *
 * One ticket, one Railway **environment** in a project kept for ticket machines, holding one service
 * that runs the lane once and stops. Removing the environment removes the service and its
 * deployments with it, and Railway stops billing. Each environment has its own variables and its own
 * private network, so one ticket's machine cannot see another's.
 *
 * Built against Railway's public GraphQL API (`https://backboard.railway.com/graphql/v2`), from its
 * guides (docs.railway.com/guides/manage-environments, manage-services, manage-variables,
 * manage-deployments) and the API's own published schema, read on 2026-10-02. The calls, in order:
 *
 *   1. `environmentCreate` — a new, empty environment. Never `sourceEnvironmentId`: copying another
 *      environment would copy its variables, which is exactly what must not happen.
 *   2. `serviceCreate` — one service in that environment, from a public image.
 *   3. `variableCollectionUpsert` — the run's boot variables, scoped to that environment and service.
 *   4. `serviceInstanceUpdate` — the start command, and `restartPolicyType: NEVER`: a lane run that
 *      ends must stay ended, not be started again by Railway at our expense.
 *   5. `serviceInstanceLimitsUpdate` — the size limit, which is also what makes the cost bounded.
 *   6. `serviceInstanceDeployV2` — start it.
 *
 * **This file has never called the real API.** Making a machine costs money and is an external
 * action, so it is tested against a stand-in for `fetch` that checks every request it would send.
 * The token goes only in the Authorization header, never in a URL or a log line.
 */
import type { Machine, MachineProvider, MachineSpec, MachineState } from './machine-provider';
import { MACHINE_NAME_PREFIX } from './ticket-machines';

export const RAILWAY_API = 'https://backboard.railway.com/graphql/v2';

/** Node 20, matching the venture machines (deploy/lane/README.md sets them up with Node 20). */
export const WORKER_IMAGE = 'node:20-bookworm';

export class RailwayError extends Error {}

export function railwayProvider(o: {
  token: string;
  projectId: string;
  fetchImpl?: typeof fetch;
  region?: string;
  image?: string;
}): MachineProvider {
  if (!o.token) throw new Error('The Railway token is not set, so no machine can be made.');
  const doFetch = o.fetchImpl ?? globalThis.fetch;
  const image = o.image ?? WORKER_IMAGE;

  async function gql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
    const res = await doFetch(RAILWAY_API, {
      method: 'POST',
      headers: { Authorization: `Bearer ${o.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    });
    const text = await res.text();
    let body: { data?: T; errors?: Array<{ message?: string }> } = {};
    try { body = JSON.parse(text); } catch { /* reported below */ }
    if (!res.ok || body.errors?.length || !body.data) {
      const message = body.errors?.map((e) => e.message).filter(Boolean).join('; ') || text.slice(0, 200);
      throw new RailwayError(`Railway said ${res.status}: ${message}`);
    }
    return body.data;
  }

  const notFound = (e: unknown) => /not found|does not exist|404/i.test(String((e as Error)?.message ?? e));

  async function removeEnvironment(id: string): Promise<void> {
    try {
      await gql('mutation environmentDelete($id: String!) { environmentDelete(id: $id) }', { id });
    } catch (e) {
      if (!notFound(e)) throw e;
    }
  }

  return {
    name: 'railway',

    async create(spec: MachineSpec): Promise<Machine> {
      const env = await gql<{ environmentCreate: { id: string; name: string; createdAt?: string } }>(
        'mutation environmentCreate($input: EnvironmentCreateInput!) { environmentCreate(input: $input) { id name createdAt } }',
        { input: { projectId: o.projectId, name: spec.name, skipInitialDeploys: true } },
      );
      const environmentId = env.environmentCreate.id;
      try {
        const svc = await gql<{ serviceCreate: { id: string } }>(
          'mutation serviceCreate($input: ServiceCreateInput!) { serviceCreate(input: $input) { id } }',
          { input: { projectId: o.projectId, environmentId, name: 'worker', source: { image } } },
        );
        const serviceId = svc.serviceCreate.id;
        await gql(
          'mutation variableCollectionUpsert($input: VariableCollectionUpsertInput!) { variableCollectionUpsert(input: $input) }',
          { input: { projectId: o.projectId, environmentId, serviceId, variables: spec.variables, replace: true, skipDeploys: true } },
        );
        await gql(
          'mutation serviceInstanceUpdate($serviceId: String!, $environmentId: String!, $input: ServiceInstanceUpdateInput!) { serviceInstanceUpdate(serviceId: $serviceId, environmentId: $environmentId, input: $input) }',
          {
            serviceId,
            environmentId,
            input: {
              startCommand: `bash -c '${spec.bootCommand}'`,
              restartPolicyType: 'NEVER',
              numReplicas: 1,
              ...(o.region ? { region: o.region } : {}),
            },
          },
        );
        await gql(
          'mutation serviceInstanceLimitsUpdate($input: ServiceInstanceLimitsUpdateInput!) { serviceInstanceLimitsUpdate(input: $input) }',
          { input: { serviceId, environmentId, vCPUs: spec.shape.vcpus, memoryGB: spec.shape.memoryGb } },
        );
        const dep = await gql<{ serviceInstanceDeployV2: string }>(
          'mutation serviceInstanceDeployV2($serviceId: String!, $environmentId: String!) { serviceInstanceDeployV2(serviceId: $serviceId, environmentId: $environmentId) }',
          { serviceId, environmentId },
        );
        return {
          id: environmentId,
          name: env.environmentCreate.name,
          createdAt: env.environmentCreate.createdAt ?? null,
          ref: { serviceId, deploymentId: dep.serviceInstanceDeployV2 },
        };
      } catch (e) {
        // Half made is not left behind: the environment goes, and the service and anything deployed
        // in it go with it.
        await removeEnvironment(environmentId).catch(() => {});
        throw e;
      }
    },

    async state(machine): Promise<MachineState> {
      const deploymentId = machine.ref?.deploymentId;
      if (!deploymentId) return 'starting';
      try {
        const d = await gql<{ deployment: { status: string } | null }>(
          'query deployment($id: String!) { deployment(id: $id) { id status } }',
          { id: deploymentId },
        );
        return deploymentState(d.deployment?.status ?? null);
      } catch (e) {
        if (notFound(e)) return 'gone';
        throw e;
      }
    },

    async list(): Promise<Machine[]> {
      const out: Machine[] = [];
      let after: string | null = null;
      for (let page = 0; page < 50; page += 1) {
        const r: { environments: { edges: Array<{ node: { id: string; name: string; createdAt: string } }>; pageInfo?: { hasNextPage: boolean; endCursor: string | null } } } = await gql(
          'query environments($projectId: String!, $after: String) { environments(projectId: $projectId, after: $after, first: 100) { edges { node { id name createdAt } } pageInfo { hasNextPage endCursor } } }',
          { projectId: o.projectId, after },
        );
        for (const { node } of r.environments.edges) {
          // Only ticket machines. The project's own environments (its "production", say) are never
          // listed, so the clean-up can never remove one.
          if (node.name.startsWith(MACHINE_NAME_PREFIX)) out.push({ id: node.id, name: node.name, createdAt: node.createdAt, ref: {} });
        }
        if (!r.environments.pageInfo?.hasNextPage) break;
        after = r.environments.pageInfo.endCursor;
      }
      return out;
    },

    async destroy(machine) {
      await removeEnvironment(machine.id);
    },
  };
}

/** Railway's deployment statuses, in the four words the studio acts on. */
export function deploymentState(status: string | null): MachineState {
  switch (status) {
    case null: return 'gone';
    case 'SUCCESS': return 'running';
    case 'FAILED':
    case 'CRASHED': return 'failed';
    case 'REMOVED':
    case 'REMOVING':
    case 'SKIPPED':
    case 'SLEEPING': return 'stopped';
    default: return 'starting'; // BUILDING, DEPLOYING, INITIALIZING, QUEUED, WAITING, NEEDS_APPROVAL
  }
}
