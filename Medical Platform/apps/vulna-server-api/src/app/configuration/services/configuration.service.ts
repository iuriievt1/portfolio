import { ADMINISTRATION_ERROR_CODE } from "@ansora/contracts"
import {
	type AppVersion,
	AUDIT_ACTOR_KIND,
	AUDIT_EVENT_TYPE,
	AUDIT_OUTCOME,
	applyConfigurationChange,
	CONFIGURATION_KEY,
	type ConfigurationEntry,
	type ConfigurationKey,
	configurationItems,
	effectiveEntries,
	parseVersion,
	requiredIntegerOf,
	requiredTextOf,
	textValueOf,
} from "@ansora/core-server"
import { type ClinicalSteps, CURRENT_BODY_DIAGRAM } from "@ansora/vulna-domain"
import { HttpStatus, Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { DatabaseService, type Executor } from "../../../libs/database/database.service"
import { ProfileService } from "../../../libs/profile/profile.service"
import type { AdministrationSession } from "../../administration-session/types/administration-session.types"
import { AuditRepository } from "../../audit/repositories/audit.repository"
import { CodeListRepository } from "../../code-list/repositories/code-list.repository"
import { CodeListSetRepository } from "../../code-list/repositories/code-list-set.repository"
import { ProblemException } from "../../infra/exceptions/problem.exception"
import { CONFIGURATION_REJECTION_STATUS } from "../constants/configuration-rejection.constants"
import { CONFIGURATION_WARNING_MESSAGE } from "../constants/configuration-warning.constants"
import type { ConfigurationChangeInput } from "../dto/configuration-change.input.dto"
import { ConfigurationVersionConflictError } from "../errors/configuration-version-conflict.error"
import { ConfigurationRepository } from "../repositories/configuration.repository"
import type {
	Configuration,
	ConfigurationSaveResult,
	EffectiveValues,
	NewConfigurationVersion,
	PageSizePolicy,
	StoredConfiguration,
} from "../types/configuration.types"
import { clinicalStepsOf } from "../utils/clinical-steps"
import { missingNamesOf } from "../utils/missing-names"

@Injectable()
export class ConfigurationService {
	constructor(
		private readonly database: DatabaseService,
		private readonly repository: ConfigurationRepository,
		private readonly audit: AuditRepository,
		private readonly profile: ProfileService,
		private readonly codeLists: CodeListRepository,
		private readonly codeListSets: CodeListSetRepository,
	) {}

	async current(): Promise<StoredConfiguration> {
		const current = await this.repository.latest()
		if (current === undefined) {
			throw new Error(
				"The instance has no configuration version; the migration step writes the first one from the profile",
			)
		}
		return current
	}

	// konfigurace-a-profily.md 7
	async effective(): Promise<EffectiveValues> {
		const current = await this.current()
		return {
			version: current.version,
			values: new Map(effectiveEntries(this.profile.configurationSchema, current.entries)),
		}
	}

	async values(): Promise<ReadonlyMap<string, unknown>> {
		return (await this.effective()).values
	}

	async value(key: ConfigurationKey): Promise<unknown> {
		return (await this.values()).get(key)
	}

	async integer(key: ConfigurationKey): Promise<number> {
		return requiredIntegerOf(await this.values(), key)
	}

	async pageSize(): Promise<PageSizePolicy> {
		const values = await this.values()
		return {
			defaultSize: requiredIntegerOf(values, CONFIGURATION_KEY.API_PAGE_SIZE_DEFAULT),
			maxSize: requiredIntegerOf(values, CONFIGURATION_KEY.API_PAGE_SIZE_MAX),
		}
	}

	// CAP-012-R28
	async instanceDefaultLanguage(): Promise<string> {
		return requiredTextOf(await this.values(), CONFIGURATION_KEY.DEFAULT_LANGUAGE)
	}

	async clinicalSteps(): Promise<ClinicalSteps> {
		return clinicalStepsOf(await this.values())
	}

	async minimumAppVersion(): Promise<AppVersion | undefined> {
		const value = await this.value(CONFIGURATION_KEY.MINIMUM_APP_VERSION)
		return typeof value === "string" ? parseVersion(value) : undefined
	}

	async read(): Promise<Configuration> {
		return this.toConfiguration(await this.current())
	}

	async update(
		change: ConfigurationChangeInput,
		administrator: AdministrationSession,
	): Promise<ConfigurationSaveResult> {
		const current = await this.current()
		const outcome = applyConfigurationChange(
			{ version: current.version, entries: current.entries },
			{
				expectedVersion: change.expected_version,
				changes: change.changes.map((item): ConfigurationEntry => [item.key, item.value]),
			},
			this.profile.configurationSchema,
			this.profile.outboundTargetKeys,
		)
		if (!outcome.ok) {
			throw new ProblemException(
				CONFIGURATION_REJECTION_STATUS[outcome.code],
				outcome.code,
				outcome.problems.join("; "),
			)
		}
		const saved = await this.save(current.entries, {
			version: outcome.version,
			authorUserId: administrator.userId,
			reason: change.reason,
			entries: outcome.entries,
		})
		return {
			...this.toConfiguration(saved),
			warnings: outcome.warnings.map((warning) => ({
				...warning,
				message: CONFIGURATION_WARNING_MESSAGE[warning.code],
			})),
		}
	}

	// CAP-012-R19, CAP-017-R18
	async recordVersion(tx: postgres.TransactionSql, authorUserId: string, reason: string): Promise<number> {
		const current = await this.current()
		const saved = await this.conflictAsProblem(
			async () =>
				await this.repository.insertVersion(tx, {
					version: current.version + 1,
					authorUserId,
					reason,
					entries: current.entries,
				}),
		)
		return saved.version
	}

	// CAP-012-R28, CAP-012-S19
	private async requireDefaultLanguageNames(
		sql: Executor,
		before: readonly ConfigurationEntry[],
		after: readonly ConfigurationEntry[],
	): Promise<void> {
		const language = this.defaultLanguageOf(after)
		if (language === undefined || language === this.defaultLanguageOf(before)) {
			return
		}
		const missing = missingNamesOf(await this.codeLists.items(sql, undefined), CURRENT_BODY_DIAGRAM.regions, language)
		if (missing.length > 0) {
			throw new ProblemException(
				HttpStatus.UNPROCESSABLE_ENTITY,
				ADMINISTRATION_ERROR_CODE.DEFAULT_LANGUAGE_NAMES_MISSING,
				`${missing.length} code list items or body diagram regions have no name in ${language}`,
				{},
				{ missing_names: missing },
			)
		}
	}

	private defaultLanguageOf(entries: readonly ConfigurationEntry[]): string | undefined {
		const values = new Map(effectiveEntries(this.profile.configurationSchema, entries))
		return textValueOf(values, CONFIGURATION_KEY.DEFAULT_LANGUAGE)
	}

	// CAP-012-R28, CAP-017-R05
	private async save(
		before: readonly ConfigurationEntry[],
		next: NewConfigurationVersion,
	): Promise<StoredConfiguration> {
		return await this.conflictAsProblem(
			async () =>
				await this.database.sql.begin(async (tx) => {
					await this.codeListSets.lock(tx)
					await this.requireDefaultLanguageNames(tx, before, next.entries)
					const saved = await this.repository.insertVersion(tx, next)
					await this.audit.append(tx, {
						eventType: AUDIT_EVENT_TYPE.CONFIGURATION_CHANGED,
						actorKind: AUDIT_ACTOR_KIND.USER,
						actorUserId: next.authorUserId,
						outcome: AUDIT_OUTCOME.SUCCESS,
						details: { version: saved.version, reason: saved.reason },
					})
					return saved
				}),
		)
	}

	private async conflictAsProblem<Result>(work: () => Promise<Result>): Promise<Result> {
		try {
			return await work()
		} catch (error) {
			if (error instanceof ConfigurationVersionConflictError) {
				throw new ProblemException(HttpStatus.CONFLICT, ADMINISTRATION_ERROR_CODE.VERSION_CONFLICT, error.message)
			}
			throw error
		}
	}

	private toConfiguration(stored: StoredConfiguration): Configuration {
		return {
			version: stored.version,
			created_at: stored.createdAt.toISOString(),
			author_user_id: stored.authorUserId,
			reason: stored.reason,
			items: configurationItems(this.profile.configurationSchema, stored.entries),
		}
	}
}
