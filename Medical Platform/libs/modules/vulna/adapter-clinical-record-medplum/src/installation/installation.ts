import { randomBytes } from "node:crypto"
import { isDeepStrictEqual } from "node:util"
import { createReference, MedplumClient, type WithId } from "@medplum/core"
import type {
	AccessPolicy,
	AccessPolicyIpAccessRule,
	AccessPolicyResource,
	ClientApplication,
	Organization,
	Project,
	ProjectMembership,
} from "../fhir-types"
import { type IdentifierSystems, identifierSystemsOf, tokenOf } from "../identifiers"
import { HEALING_PHASE_LOINC, LOINC } from "../observation-resources"
import {
	API_CLIENT_NAME,
	BREAK_GLASS_POLICY_NAME,
	DEPARTMENT_TAG_PARAMETER,
	NO_ACCESS_POLICY_NAME,
	PROJECT_FEATURES,
	PROJECT_NAME,
	RETENTION_CLIENT_NAME,
	RETENTION_POLICY_NAME,
	rolePolicyNameOf,
	SEARCH_LIMIT,
	WORKER_CLIENT_NAME,
	WORKER_POLICY_NAME,
} from "../project"
import { type Fetch, timedFetch } from "../timed-fetch"
import { type BreakGlassCredentials, breakGlassAccessToken } from "./break-glass-login"

export interface InstallationSettings {
	baseUrl: string
	breakGlass: BreakGlassCredentials
	// ADR-050 bod 10
	adminAddressPrefixes: readonly string[]
	canonicalBase: string
	instance: { code: string; name: string }
	roles: readonly string[]
	// CAP-020-R04, CAP-003-R01
	clinicalRoles: readonly string[]
	// CAP-012-R30
	rotateApiSecret: boolean
	rotateWorkerSecret: boolean
	rotateRetentionSecret: boolean
	fetch?: Fetch
}

export interface IssuedCredential {
	clientId: string
	clientSecret: string | undefined
}

export interface InstallationResult {
	projectId: string
	apiCredential: IssuedCredential
	workerCredential: IssuedCredential
	retentionCredential: IssuedCredential
	disabledClients: readonly string[]
	createdPolicies: readonly string[]
}

interface InstalledClient {
	client: WithId<ClientApplication>
	credential: IssuedCredential
}

interface InstalledPolicy {
	policy: WithId<AccessPolicy>
	isCreated: boolean
}

const EVERY_ADDRESS = "*"
const INSTANCE_NETWORK_RULE = "instance network"
const ELSEWHERE_RULE = "anywhere else"
// IPv4-mapped IPv6
const IPV4_MAPPED_PREFIX = "::ffff:"
const IPV4_ADDRESS_PREFIX = /^\d{1,3}(\.\d{0,3}){0,3}$/
// ADR-050 bod 10
const EVERY_RESOURCE_TYPE = "*"
const CLIENT_OFF = "off"
const SECRET_BYTES = 32
// ADR-054 bod 2, CAP-020-R17, CAP-020-R18
const CLINICAL_READ_RESOURCES = ["Observation", "Condition", "BodyStructure", "DocumentReference"] as const
const READ_AND_SEARCH: AccessPolicyResource["interaction"] = ["read", "search"]
const ADMINISTRATOR = true
const NOT_ADMINISTRATOR = false
// CAP-026-R19, dorucovaci-jadro.md 6
const RETENTION_ACCESS: AccessPolicyResource[] = [{ resourceType: "Binary", interaction: ["read"] }]

// ADR-050 bod 8, ADR-052 bod 5
function closedCriteriaOf(systems: IdentifierSystems): string {
	return `_tag:not=${systems.draftTag}|`
}

function readOf(resourceType: string, criteria: string): AccessPolicyResource {
	return { resourceType, interaction: READ_AND_SEARCH, criteria: `${resourceType}?${criteria}` }
}

// CAP-021-R36, CAP-012-R30, ADR-054 bod 4, ADR-052 bod 5, architektura.md 3
function workerAccessOf(systems: IdentifierSystems): AccessPolicyResource[] {
	const closed = closedCriteriaOf(systems)
	return [
		{ resourceType: "Binary", interaction: ["create", "read"] },
		{ resourceType: "Encounter", interaction: READ_AND_SEARCH },
		readOf("Observation", `${closed}&code=${tokenOf(LOINC, HEALING_PHASE_LOINC)}`),
		readOf("Condition", closed),
		readOf("BodyStructure", closed),
		readOf("DocumentReference", `${closed}&_profile=${systems.scannedDocumentProfile}`),
		readOf("ImagingStudy", closed),
	]
}

// ADR-053 bod 3, ADR-050 bod 8, ADR-052 bod 5, CAP-020-R16, CAP-020-R20
function clinicalReadAccessOf(systems: IdentifierSystems): AccessPolicyResource[] {
	return CLINICAL_READ_RESOURCES.map((resourceType) =>
		readOf(resourceType, `_tag=%${DEPARTMENT_TAG_PARAMETER}&${closedCriteriaOf(systems)}`),
	)
}

// provoz-a-dohled.md 7, CAP-012-R30, CAP-012-S23
export async function installClinicalRecordStore(settings: InstallationSettings): Promise<InstallationResult> {
	if (settings.adminAddressPrefixes.length === 0) {
		throw new Error("the break-glass account needs at least one address of the instance network")
	}
	const fetchStore = timedFetch(settings.fetch ?? fetch)
	const store = new MedplumClient({ baseUrl: settings.baseUrl, fetch: fetchStore })
	store.setAccessToken(await breakGlassAccessToken(settings.baseUrl, settings.breakGlass, fetchStore))

	const project = await ensureProject(store)
	const api = await ensureClient(store, project, API_CLIENT_NAME, settings.rotateApiSecret)
	await ensureAdministrator(store, project, api.client)
	const worker = await ensureClient(store, project, WORKER_CLIENT_NAME, settings.rotateWorkerSecret)
	const systems = identifierSystemsOf(settings.canonicalBase)
	const workerPolicy = await ensurePolicy(store, project, WORKER_POLICY_NAME, workerAccessOf(systems))
	await grantPolicy(store, project, worker.client, workerPolicy.policy, NOT_ADMINISTRATOR)
	const retention = await ensureClient(store, project, RETENTION_CLIENT_NAME, settings.rotateRetentionSecret)
	const retentionPolicy = await ensurePolicy(store, project, RETENTION_POLICY_NAME, RETENTION_ACCESS)
	await grantPolicy(store, project, retention.client, retentionPolicy.policy, ADMINISTRATOR)
	const disabledClients = await disableOtherClients(
		store,
		new Set([api.client.id, worker.client.id, retention.client.id]),
	)
	const actorPolicies = await ensureActorPolicies(store, project, settings, systems)
	await ensureRootOrganization(store, project, settings, systems)
	await sealBreakGlass(store, settings.adminAddressPrefixes)
	return {
		projectId: project.id,
		apiCredential: api.credential,
		workerCredential: worker.credential,
		retentionCredential: retention.credential,
		disabledClients,
		createdPolicies: [
			...(workerPolicy.isCreated ? [WORKER_POLICY_NAME] : []),
			...(retentionPolicy.isCreated ? [RETENTION_POLICY_NAME] : []),
			...actorPolicies,
		],
	}
}

function inProject<T extends { meta?: { project?: string } }>(resources: readonly T[], projectId: string): T[] {
	return resources.filter((resource) => resource.meta?.project === projectId)
}

// ADR-050 bod 10
async function ensureProject(store: MedplumClient): Promise<WithId<Project>> {
	const wanted = {
		name: PROJECT_NAME,
		strictMode: true,
		checkReferencesOnWrite: true,
		features: [...PROJECT_FEATURES],
	}
	const existing = await store.searchOne("Project", { "name:exact": PROJECT_NAME })
	if (existing === undefined) {
		return await store.createResource<Project>({ resourceType: "Project", ...wanted })
	}
	return await store.updateResource<Project>({ ...existing, ...wanted })
}

// ADR-054 bod 3, CAP-012-R30
async function ensureClient(
	store: MedplumClient,
	project: WithId<Project>,
	name: string,
	rotateSecret: boolean,
): Promise<InstalledClient> {
	const existing = inProject(await store.searchResources("ClientApplication", { "name:exact": name }), project.id)[0]
	if (existing === undefined) {
		const created = await store.post<WithId<ClientApplication>>(`admin/projects/${project.id}/client`, { name })
		return { client: created, credential: { clientId: created.id, clientSecret: created.secret } }
	}
	if (!rotateSecret) {
		return { client: existing, credential: { clientId: existing.id, clientSecret: undefined } }
	}
	const secret = randomBytes(SECRET_BYTES).toString("hex")
	const rotated = await store.updateResource<ClientApplication>({
		...existing,
		secret,
		retiringSecret: existing.secret,
	})
	return { client: rotated, credential: { clientId: existing.id, clientSecret: secret } }
}

async function membershipOfClient(
	store: MedplumClient,
	project: WithId<Project>,
	client: WithId<ClientApplication>,
): Promise<WithId<ProjectMembership>> {
	const membership = await store.searchOne("ProjectMembership", {
		project: `Project/${project.id}`,
		user: `ClientApplication/${client.id}`,
	})
	if (membership === undefined) {
		throw new Error(`the store keeps no membership of client ${client.id}`)
	}
	return membership
}

async function ensureAdministrator(
	store: MedplumClient,
	project: WithId<Project>,
	client: WithId<ClientApplication>,
): Promise<void> {
	const membership = await membershipOfClient(store, project, client)
	if (membership.admin !== true) {
		await store.updateResource<ProjectMembership>({ ...membership, admin: true })
	}
}

// CAP-021-R36, CAP-026-R19, CAP-012-R30, ADR-054 bod 4, architektura.md 3
async function ensurePolicy(
	store: MedplumClient,
	project: WithId<Project>,
	name: string,
	access: AccessPolicyResource[],
): Promise<InstalledPolicy> {
	const existing = inProject(await store.searchResources("AccessPolicy", { "name:exact": name }), project.id)[0]
	if (existing === undefined) {
		const created = await store.createResource<AccessPolicy>({
			resourceType: "AccessPolicy",
			meta: { project: project.id },
			name,
			resource: access,
		})
		return { policy: created, isCreated: true }
	}
	if (isDeepStrictEqual(existing.resource, access)) {
		return { policy: existing, isCreated: false }
	}
	const corrected = await store.updateResource<AccessPolicy>({ ...existing, resource: access })
	return { policy: corrected, isCreated: false }
}

// CAP-021-R36, CAP-026-R19, CAP-012-R30
async function grantPolicy(
	store: MedplumClient,
	project: WithId<Project>,
	client: WithId<ClientApplication>,
	policy: WithId<AccessPolicy>,
	isAdministrator: boolean,
): Promise<void> {
	const membership = await membershipOfClient(store, project, client)
	const isGranted =
		(membership.admin === true) === isAdministrator &&
		membership.accessPolicy?.reference === createReference(policy).reference
	if (isGranted) {
		return
	}
	await store.updateResource<ProjectMembership>({
		...membership,
		admin: isAdministrator,
		accessPolicy: createReference(policy),
	})
}

// CAP-012-R30, CAP-012-S23
async function disableOtherClients(store: MedplumClient, keptClientIds: ReadonlySet<string>): Promise<string[]> {
	const clients = await store.searchResources("ClientApplication", { _count: SEARCH_LIMIT })
	const disabled: string[] = []
	for (const client of clients) {
		if (keptClientIds.has(client.id) || client.status === CLIENT_OFF) {
			continue
		}
		await store.updateResource<ClientApplication>({ ...client, status: CLIENT_OFF })
		disabled.push(client.id)
	}
	return disabled
}

// ADR-053 bod 3, 6, CAP-020-R16
async function ensureActorPolicies(
	store: MedplumClient,
	project: WithId<Project>,
	settings: InstallationSettings,
	systems: IdentifierSystems,
): Promise<string[]> {
	const existing = new Map(
		inProject(await store.searchResources("AccessPolicy", { _count: SEARCH_LIMIT }), project.id).map((policy) => [
			policy.name,
			policy,
		]),
	)
	const clinicalAccess = clinicalReadAccessOf(systems)
	const wanted: [string, AccessPolicy["resource"]][] = [
		[NO_ACCESS_POLICY_NAME, undefined],
		...settings.roles.map((role): [string, AccessPolicy["resource"]] => [
			rolePolicyNameOf(role),
			settings.clinicalRoles.includes(role) ? clinicalAccess : undefined,
		]),
	]
	const created: string[] = []
	for (const [name, access] of wanted) {
		const policy = existing.get(name)
		if (policy === undefined) {
			await store.createResource<AccessPolicy>({
				resourceType: "AccessPolicy",
				meta: { project: project.id },
				name,
				resource: access,
			})
			created.push(name)
		} else if (!isDeepStrictEqual(policy.resource, access)) {
			await store.updateResource<AccessPolicy>({ ...policy, resource: access })
		}
	}
	return created
}

// ADR-050 bod 2, 10
async function ensureRootOrganization(
	store: MedplumClient,
	project: WithId<Project>,
	settings: InstallationSettings,
	systems: IdentifierSystems,
): Promise<void> {
	await store.createResourceIfNoneExist<Organization>(
		{
			resourceType: "Organization",
			meta: { project: project.id },
			identifier: [{ system: systems.organization, value: settings.instance.code }],
			active: true,
			name: settings.instance.name,
		},
		`identifier=${tokenOf(systems.organization, settings.instance.code)}`,
	)
}

// ADR-050 bod 10, CAP-012-S23
export function breakGlassRulesOf(prefixes: readonly string[]): AccessPolicyIpAccessRule[] {
	const allowed = new Set(prefixes.flatMap(addressFormsOf))
	return [
		...[...allowed].map((value) => ({ name: INSTANCE_NETWORK_RULE, value, action: "allow" as const })),
		{ name: ELSEWHERE_RULE, value: EVERY_ADDRESS, action: "block" as const },
	]
}

function addressFormsOf(prefix: string): string[] {
	return IPV4_ADDRESS_PREFIX.test(prefix) ? [prefix, `${IPV4_MAPPED_PREFIX}${prefix}`] : [prefix]
}

interface SignedInAccount {
	project?: { id?: string }
	membership?: { id?: string }
}

async function sealBreakGlass(store: MedplumClient, prefixes: readonly string[]): Promise<void> {
	const account = await store.get<SignedInAccount>("auth/me")
	const projectId = account.project?.id
	const membershipId = account.membership?.id
	if (projectId === undefined || membershipId === undefined) {
		throw new Error("the break-glass account has no membership")
	}
	const membership = await store.readResource("ProjectMembership", membershipId)
	const rules = breakGlassRulesOf(prefixes)
	const existing = inProject(
		await store.searchResources("AccessPolicy", { "name:exact": BREAK_GLASS_POLICY_NAME }),
		projectId,
	)[0]
	const policy =
		existing === undefined
			? await store.createResource<AccessPolicy>({
					resourceType: "AccessPolicy",
					meta: { project: projectId },
					name: BREAK_GLASS_POLICY_NAME,
					resource: [{ resourceType: EVERY_RESOURCE_TYPE }],
					ipAccessRule: rules,
				})
			: await store.updateResource<AccessPolicy>({
					...existing,
					resource: [{ resourceType: EVERY_RESOURCE_TYPE }],
					ipAccessRule: rules,
				})
	if (membership.accessPolicy?.reference !== `AccessPolicy/${policy.id}`) {
		await store.updateResource<ProjectMembership>({ ...membership, accessPolicy: createReference(policy) })
	}
}
