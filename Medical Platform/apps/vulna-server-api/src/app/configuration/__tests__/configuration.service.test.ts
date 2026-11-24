import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { ADMINISTRATION_ERROR_CODE, CONFIGURATION_KEY } from "@ansora/contracts"
import type { Schema } from "@ansora/core-server"
import { effectiveEntries, PERMISSIONS, PROFILE_ARTIFACT } from "@ansora/core-server"
import { CURRENT_BODY_DIAGRAM } from "@ansora/vulna-domain"
import { describe, expect, it } from "vitest"
import type { DatabaseService } from "../../../libs/database/database.service"
import type { ProfileService } from "../../../libs/profile/profile.service"
import type { AdministrationSession } from "../../administration-session/types/administration-session.types"
import type { AuditRepository } from "../../audit/repositories/audit.repository"
import type { NewAuditEvent } from "../../audit/types/audit.types"
import type { CodeListRepository } from "../../code-list/repositories/code-list.repository"
import type { CodeListSetRepository } from "../../code-list/repositories/code-list-set.repository"
import type { StoredCodeListItem } from "../../code-list/types/code-list.types"
import { ProblemException } from "../../infra/exceptions/problem.exception"
import { ConfigurationVersionConflictError } from "../errors/configuration-version-conflict.error"
import type { ConfigurationRepository } from "../repositories/configuration.repository"
import { ConfigurationService } from "../services/configuration.service"
import type { NewConfigurationVersion, StoredConfiguration } from "../types/configuration.types"

const schema: Schema = {
	type: "object",
	additionalProperties: false,
	properties: {
		pin_policy: {
			type: "object",
			additionalProperties: false,
			properties: { min_length: { type: "integer", default: 6, minimum: 4, maximum: 8 } },
		},
		mobile_app: {
			type: "object",
			additionalProperties: false,
			properties: { minimum_version: { type: ["string", "null"], default: null } },
		},
	},
}

const MOU_SCHEMA = JSON.parse(
	readFileSync(resolve(__dirname, "../../../../../../profiles/mou", PROFILE_ARTIFACT.CONFIGURATION_SCHEMA), "utf8"),
) as Schema
const EIGHTEEN_MONTHS_IN_DAYS = 548
const FIVE_YEARS_IN_DAYS = 1825

const createdAt = new Date("2026-09-21T08:00:00Z")

function storedWith(minimumVersion: string | null): StoredConfiguration {
	return {
		version: 1,
		createdAt,
		authorUserId: null,
		reason: "install",
		entries: [
			["mobile_app.minimum_version", minimumVersion],
			["pin_policy.min_length", 6],
		],
	}
}

const transaction = {} as never

function installedFrom(profileSchema: Schema): StoredConfiguration {
	return { version: 1, createdAt, authorUserId: null, reason: "install", entries: effectiveEntries(profileSchema, []) }
}

function serviceWith(
	current: StoredConfiguration,
	audited: NewAuditEvent[] = [],
	insert: (next: NewConfigurationVersion) => Promise<StoredConfiguration> = async (next) => ({
		...next,
		entries: [...next.entries],
		createdAt,
	}),
	profileSchema: Schema = schema,
	items: StoredCodeListItem[] = [],
	steps: string[] = [],
): ConfigurationService {
	const database = {
		sql: { begin: async (work: (tx: never) => Promise<unknown>) => work(transaction) },
	} as unknown as DatabaseService
	const repository = {
		latest: async () => current,
		insertVersion: (_tx: never, next: NewConfigurationVersion) => {
			steps.push("insert")
			return insert(next)
		},
	} as unknown as ConfigurationRepository
	const audit = {
		append: async (_tx: never, event: NewAuditEvent) => {
			audited.push(event)
		},
	} as unknown as AuditRepository
	const profile = { configurationSchema: profileSchema, outboundTargetKeys: [] } as unknown as ProfileService
	const codeLists = {
		items: async (sql: unknown) => {
			steps.push(sql === transaction ? "items in transaction" : "items outside transaction")
			return items
		},
	} as unknown as CodeListRepository
	const codeListSets = {
		lock: async () => {
			steps.push("lock")
		},
	} as unknown as CodeListSetRepository
	return new ConfigurationService(database, repository, audit, profile, codeLists, codeListSets)
}

const administrator: AdministrationSession = {
	sessionId: "9e8d7c6b-5a49-4382-8170-6f5e4d3c2b1a",
	userId: "3f0d1c2e-5b6a-4c7d-8e9f-0a1b2c3d4e5f",
	permissions: PERMISSIONS,
}

async function rejection(work: Promise<unknown>): Promise<ProblemException> {
	const error: unknown = await work.catch((caught: unknown) => caught)
	if (!(error instanceof ProblemException)) {
		throw new Error("the service accepted the change")
	}
	return error
}

describe("configuration service", () => {
	it("CAP-012-S01 stores the next version with author, reason and time, audits it and answers with the items", async () => {
		const audited: NewAuditEvent[] = []
		const service = serviceWith(storedWith(null), audited)
		const result = await service.update(
			{ expected_version: 1, reason: "delší PIN", changes: [{ key: "pin_policy.min_length", value: 7 }] },
			administrator,
		)
		expect(result.version).toBe(2)
		expect(result.author_user_id).toBe(administrator.userId)
		expect(result.reason).toBe("delší PIN")
		expect(result.created_at).toBe(createdAt.toISOString())
		expect(result.warnings).toEqual([])
		expect(audited).toEqual([
			{
				eventType: "configuration-changed",
				actorKind: "user",
				actorUserId: administrator.userId,
				outcome: "success",
				details: { version: 2, reason: "delší PIN" },
			},
		])
		expect(result.items).toContainEqual({
			key: "pin_policy.min_length",
			value: 7,
			owner: "server",
			default_value: 6,
			lower_limit: 4,
			upper_limit: 8,
		})
	})

	it("CAP-012-S12 answers a stale expected version with 409 version-conflict", async () => {
		const stale = serviceWith(storedWith(null))
		const error = await rejection(
			stale.update(
				{ expected_version: 0, reason: "x", changes: [{ key: "pin_policy.min_length", value: 7 }] },
				administrator,
			),
		)
		expect(error.getStatus()).toBe(409)
		expect(error.code).toBe(ADMINISTRATION_ERROR_CODE.VERSION_CONFLICT)

		const raced = serviceWith(storedWith(null), [], async (next) => {
			throw new ConfigurationVersionConflictError(next.version)
		})
		const racedError = await rejection(
			raced.update(
				{ expected_version: 1, reason: "x", changes: [{ key: "pin_policy.min_length", value: 7 }] },
				administrator,
			),
		)
		expect(racedError.getStatus()).toBe(409)
		expect(racedError.code).toBe(ADMINISTRATION_ERROR_CODE.VERSION_CONFLICT)
	})

	it("CAP-001-S27 answers a value outside its bounds with 422 and names the key", async () => {
		const error = await rejection(
			serviceWith(storedWith(null)).update(
				{ expected_version: 1, reason: "x", changes: [{ key: "pin_policy.min_length", value: 3 }] },
				administrator,
			),
		)
		expect(error.getStatus()).toBe(422)
		expect(error.code).toBe(ADMINISTRATION_ERROR_CODE.VALUE_OUT_OF_RANGE)
		expect(error.detail).toContain("pin_policy.min_length")
	})

	it("reads the minimum app version from the current configuration and treats null as unset", async () => {
		await expect(serviceWith(storedWith(null)).minimumAppVersion()).resolves.toBeUndefined()
		await expect(serviceWith(storedWith("1.4.0")).minimumAppVersion()).resolves.toEqual({
			major: 1,
			minor: 4,
			patch: 0,
		})
	})

	it("reads a key a newer profile added with its default and keeps the stored version", async () => {
		const stored: StoredConfiguration = { ...storedWith(null), entries: [["pin_policy.min_length", 7]] }

		const effective = await serviceWith(stored).effective()

		expect(effective.version).toBe(1)
		expect(effective.values.get("pin_policy.min_length")).toBe(7)
		expect(effective.values.has("mobile_app.minimum_version")).toBe(true)
		expect(effective.values.get("mobile_app.minimum_version")).toBeNull()
	})

	it("returns the current configuration with its version and items", async () => {
		const configuration = await serviceWith(storedWith(null)).read()
		expect(configuration.version).toBe(1)
		expect(configuration.author_user_id).toBeNull()
		expect(configuration.items.map((item) => item.key)).toEqual(["mobile_app.minimum_version", "pin_policy.min_length"])
	})
})

describe("audit retention in the MOÚ profile", () => {
	it("CAP-025-R05 keeps the audit trail for five years by default with an 18 month lower bound", async () => {
		const configuration = await serviceWith(installedFrom(MOU_SCHEMA), [], undefined, MOU_SCHEMA).read()
		expect(configuration.items).toContainEqual(
			expect.objectContaining({
				key: CONFIGURATION_KEY.RETENTION_AUDIT_DAYS,
				value: FIVE_YEARS_IN_DAYS,
				lower_limit: EIGHTEEN_MONTHS_IN_DAYS,
			}),
		)
	})

	it("CAP-025-S05 refuses an audit retention shorter than 18 months and keeps the current version", async () => {
		const stored: NewConfigurationVersion[] = []
		const service = serviceWith(
			installedFrom(MOU_SCHEMA),
			[],
			async (next) => {
				stored.push(next)
				return { ...next, entries: [...next.entries], createdAt }
			},
			MOU_SCHEMA,
		)
		const error = await rejection(
			service.update(
				{
					expected_version: 1,
					reason: "kratší uchování",
					changes: [{ key: CONFIGURATION_KEY.RETENTION_AUDIT_DAYS, value: EIGHTEEN_MONTHS_IN_DAYS - 1 }],
				},
				administrator,
			),
		)
		expect(error.getStatus()).toBe(422)
		expect(error.code).toBe(ADMINISTRATION_ERROR_CODE.VALUE_OUT_OF_RANGE)
		expect(stored).toEqual([])
	})

	it("CAP-012-S19 refuses a default language some active item has no name in and names the item", async () => {
		const stored: NewConfigurationVersion[] = []
		const items: StoredCodeListItem[] = [
			{ id: "i1", codeListCode: "wound-type", code: "burn", sequence: 1, isActive: true, names: { cs: "Popálenina" } },
			{ id: "i2", codeListCode: "wound-type", code: "old", sequence: 2, isActive: false, names: { cs: "Starý" } },
		]
		const service = serviceWith(
			installedFrom(MOU_SCHEMA),
			[],
			async (next) => {
				stored.push(next)
				return { ...next, entries: [...next.entries], createdAt }
			},
			MOU_SCHEMA,
			items,
		)

		const error = await rejection(
			service.update(
				{
					expected_version: 1,
					reason: "angličtina jako výchozí",
					changes: [
						{ key: CONFIGURATION_KEY.SUPPORTED_LANGUAGES, value: ["cs", "en"] },
						{ key: CONFIGURATION_KEY.DEFAULT_LANGUAGE, value: "en" },
					],
				},
				administrator,
			),
		)

		expect(error.code).toBe(ADMINISTRATION_ERROR_CODE.DEFAULT_LANGUAGE_NAMES_MISSING)
		expect(error.extensions.missing_names).toEqual([
			{ kind: "code_list_item", code_list_code: "wound-type", code: "burn", language: "en" },
		])
		expect(stored).toEqual([])
	})

	it("CAP-012-S19 names a body diagram region without a name in the new default language", async () => {
		const items: StoredCodeListItem[] = [
			{ id: "i1", codeListCode: "wound-type", code: "burn", sequence: 1, isActive: true, names: { de: "Verbrennung" } },
		]
		const service = serviceWith(installedFrom(MOU_SCHEMA), [], undefined, MOU_SCHEMA, items)

		const error = await rejection(
			service.update(
				{
					expected_version: 1,
					reason: "němčina jako výchozí",
					changes: [
						{ key: CONFIGURATION_KEY.SUPPORTED_LANGUAGES, value: ["cs", "de"] },
						{ key: CONFIGURATION_KEY.DEFAULT_LANGUAGE, value: "de" },
					],
				},
				administrator,
			),
		)

		expect(error.code).toBe(ADMINISTRATION_ERROR_CODE.DEFAULT_LANGUAGE_NAMES_MISSING)
		expect(error.extensions.missing_names).toEqual(
			CURRENT_BODY_DIAGRAM.regions.map((region) => ({
				kind: "body_diagram_region",
				code_list_code: null,
				code: region.code,
				language: "de",
			})),
		)
	})

	it("CAP-012-R28 skips the names check when the default language stays", async () => {
		const items: StoredCodeListItem[] = [
			{ id: "i1", codeListCode: "wound-type", code: "burn", sequence: 1, isActive: true, names: { en: "Burn" } },
		]
		const steps: string[] = []
		const service = serviceWith(installedFrom(MOU_SCHEMA), [], undefined, MOU_SCHEMA, items, steps)

		const result = await service.update(
			{
				expected_version: 1,
				reason: "kratší uchování",
				changes: [{ key: CONFIGURATION_KEY.RETENTION_AUDIT_DAYS, value: EIGHTEEN_MONTHS_IN_DAYS }],
			},
			administrator,
		)

		expect(result.version).toBe(2)
		expect(steps).toEqual(["lock", "insert"])
	})

	it("CAP-012-R28 checks the names under the code list lock, inside the transaction that saves the version", async () => {
		const steps: string[] = []
		const service = serviceWith(installedFrom(MOU_SCHEMA), [], undefined, MOU_SCHEMA, [], steps)

		await service.update(
			{
				expected_version: 1,
				reason: "angličtina jako výchozí",
				changes: [{ key: CONFIGURATION_KEY.DEFAULT_LANGUAGE, value: "en" }],
			},
			administrator,
		)

		expect(steps).toEqual(["lock", "items in transaction", "insert"])
	})

	it("CAP-012-R28 reads the instance default language strictly", async () => {
		await expect(
			serviceWith(installedFrom(MOU_SCHEMA), [], undefined, MOU_SCHEMA).instanceDefaultLanguage(),
		).resolves.toBe("cs")
		await expect(serviceWith(storedWith(null)).instanceDefaultLanguage()).rejects.toThrow(
			CONFIGURATION_KEY.DEFAULT_LANGUAGE,
		)
	})

	it("CAP-025-R06 accepts an audit retention of exactly 18 months", async () => {
		const result = await serviceWith(installedFrom(MOU_SCHEMA), [], undefined, MOU_SCHEMA).update(
			{
				expected_version: 1,
				reason: "nejkratší uchování",
				changes: [{ key: CONFIGURATION_KEY.RETENTION_AUDIT_DAYS, value: EIGHTEEN_MONTHS_IN_DAYS }],
			},
			administrator,
		)
		expect(result.version).toBe(2)
	})
})
