import { randomUUID } from "node:crypto"
import {
	AUDIT_SEARCH_METHOD,
	ERROR_CODE,
	identifierSearchTextOf,
	PATIENT_IDENTIFICATION_METHOD,
	PATIENT_SEARCH_QUERY_MIN_LENGTH,
	type PatientIdentificationMethod,
	RETRY_AFTER_HEADER,
} from "@ansora/contracts"
import { AUDIT_EVENT_TYPE, AUDIT_OUTCOME, type AuditOutcome, CONFIGURATION_KEY, textValueOf } from "@ansora/core-server"
import { HttpStatus, Injectable, Logger } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { DatabaseService } from "../../../libs/database/database.service"
import { AuditRepository } from "../../audit/repositories/audit.repository"
import { userAuditEventOf } from "../../audit/utils/user-audit-event"
import { ConfigurationService } from "../../configuration/services/configuration.service"
import { ProblemException } from "../../infra/exceptions/problem.exception"
import type { CurrentSession } from "../../login/types/login.types"
import { RequestRateService } from "../../request-rate/services/request-rate.service"
import {
	PATIENT_SEARCH_MAX_MATCHES,
	PATIENT_SEARCH_RATE_KEY,
	PATIENT_SEARCH_READ_LIMIT,
} from "../constants/registry.constants"
import type { PatientIdentificationInput } from "../dto/patient-identification.input.dto"
import type { PatientSearchInput } from "../dto/patient-search.input.dto"
import { PatientRepository } from "../repositories/patient.repository"
import type {
	FoundPatient,
	PatientIdentification,
	PatientIdentifierRow,
	PatientSearchMethod,
} from "../types/registry.types"
import { searchAuditDetailsOf } from "../utils/search-audit"

// CHG-175, CAP-013-R03, CAP-013-R05
const CONFIGURED_SYSTEM_KEY = {
	[PATIENT_IDENTIFICATION_METHOD.CODE]: CONFIGURATION_KEY.PATIENT_CODE_SYSTEM,
	[PATIENT_IDENTIFICATION_METHOD.NFC_TAG]: CONFIGURATION_KEY.PATIENT_TAG_SYSTEM,
} as const satisfies Record<PatientIdentificationMethod, string>

class IdentifierTakenError extends Error {}

// CAP-013-R07, CAP-013-R10, CAP-013-R13, CAP-013-R17, CHG-176, CHG-182
@Injectable()
export class PatientIdentificationService {
	private readonly logger = new Logger(PatientIdentificationService.name)

	constructor(
		private readonly database: DatabaseService,
		private readonly patients: PatientRepository,
		private readonly configuration: ConfigurationService,
		private readonly rates: RequestRateService,
		private readonly audit: AuditRepository,
	) {}

	// CHG-175, CAP-013-R10, CAP-024-R07, CAP-025-R18
	async identify(
		current: CurrentSession,
		input: PatientIdentificationInput,
		now: Date,
	): Promise<PatientIdentification> {
		const method = input.search_method
		await this.takeRate(current, method, now)
		await this.requireConfiguredSystem(current, input)
		const found = await this.patients.byIdentifier(input.system, input.value, PATIENT_SEARCH_READ_LIMIT)
		if (found.length > PATIENT_SEARCH_MAX_MATCHES) {
			await this.record(current, method, AUDIT_OUTCOME.TOO_MANY_MATCHES, [])
			throw new ProblemException(HttpStatus.UNPROCESSABLE_ENTITY, ERROR_CODE.SEARCH_TOO_BROAD)
		}
		if (found.length > 0) {
			await this.record(current, method, AUDIT_OUTCOME.MATCH, found)
			return { created: false, found }
		}
		const created = await this.created(current, input)
		if (created !== undefined) {
			return { created: true, found: [created] }
		}
		const identified = await this.patients.byIdentifier(input.system, input.value, PATIENT_SEARCH_READ_LIMIT)
		await this.record(current, method, AUDIT_OUTCOME.MATCH, identified)
		return { created: false, found: identified }
	}

	// CHG-182, CAP-013-R07, CAP-013-R17, CAP-025-R18
	async find(current: CurrentSession, input: PatientSearchInput, now: Date): Promise<FoundPatient[]> {
		const method = AUDIT_SEARCH_METHOD.IDENTIFIER_SEARCH
		await this.takeRate(current, method, now)
		const start = identifierSearchTextOf(input.query)
		// CAP-013-S23
		if (start.length < PATIENT_SEARCH_QUERY_MIN_LENGTH) {
			await this.record(current, method, AUDIT_OUTCOME.QUERY_TOO_SHORT, [])
			throw new ProblemException(HttpStatus.BAD_REQUEST, ERROR_CODE.SEARCH_QUERY_TOO_SHORT)
		}
		const system = await this.searchedSystem(current)
		const found = await this.patients.byIdentifierStart(system, start, PATIENT_SEARCH_READ_LIMIT)
		// CAP-013-S25
		if (found.length > PATIENT_SEARCH_MAX_MATCHES) {
			await this.record(current, method, AUDIT_OUTCOME.TOO_MANY_MATCHES, [])
			throw new ProblemException(HttpStatus.UNPROCESSABLE_ENTITY, ERROR_CODE.SEARCH_TOO_BROAD)
		}
		await this.record(current, method, found.length > 0 ? AUDIT_OUTCOME.MATCH : AUDIT_OUTCOME.NO_MATCH, found)
		return found
	}

	// CAP-013-R03, CAP-013-R07
	private async searchedSystem(current: CurrentSession): Promise<string> {
		const system = textValueOf(await this.configuration.values(), CONFIGURATION_KEY.PATIENT_CODE_SYSTEM)
		if (system !== undefined) {
			return system
		}
		await this.record(current, AUDIT_SEARCH_METHOD.IDENTIFIER_SEARCH, AUDIT_OUTCOME.REJECTED, [])
		throw new ProblemException(
			HttpStatus.BAD_REQUEST,
			ERROR_CODE.RECORD_REJECTED,
			"no identifier system is configured for the patient code",
		)
	}

	// CAP-013-R03, CAP-013-R05
	private async requireConfiguredSystem(current: CurrentSession, input: PatientIdentificationInput): Promise<void> {
		const configured = await this.configuration.value(CONFIGURED_SYSTEM_KEY[input.search_method])
		if (configured === input.system) {
			return
		}
		await this.record(current, input.search_method, AUDIT_OUTCOME.REJECTED, [])
		throw new ProblemException(
			HttpStatus.BAD_REQUEST,
			ERROR_CODE.RECORD_REJECTED,
			"the identifier system is not the one configured for this way of reading",
		)
	}

	// CHG-175, CAP-024-R07
	private async created(current: CurrentSession, input: PatientIdentificationInput): Promise<FoundPatient | undefined> {
		const identifier: PatientIdentifierRow = {
			patient_id: randomUUID(),
			system: input.system,
			value: input.value,
			issuer: null,
		}
		const patient: FoundPatient = {
			patient: { id: identifier.patient_id, sex: null },
			identifiers: [identifier],
		}
		try {
			await this.database.sql.begin(async (tx: postgres.TransactionSql) => {
				if (!(await this.patients.create(tx, randomUUID(), identifier))) {
					throw new IdentifierTakenError()
				}
				await this.append(tx, current, input.search_method, AUDIT_OUTCOME.CREATED, [patient])
			})
		} catch (error) {
			if (!(error instanceof IdentifierTakenError)) {
				throw error
			}
			this.logger.log(`identifier already created concurrently, patient ${identifier.patient_id} not created`)
			return undefined
		}
		this.logger.log(`created patient ${identifier.patient_id} from an identifier read by the app`)
		return patient
	}

	// CAP-013-S12
	private async takeRate(current: CurrentSession, method: PatientSearchMethod, now: Date): Promise<void> {
		const perUser = await this.configuration.integer(CONFIGURATION_KEY.PATIENT_SEARCH_PER_USER)
		const perDevice = await this.configuration.integer(CONFIGURATION_KEY.PATIENT_SEARCH_PER_DEVICE)
		const byUser = this.rates.take(`${PATIENT_SEARCH_RATE_KEY.USER}:${current.session.userId}`, perUser, now)
		const verdict = byUser.allowed
			? this.rates.take(`${PATIENT_SEARCH_RATE_KEY.DEVICE}:${current.device.id}`, perDevice, now)
			: byUser
		if (verdict.allowed) {
			return
		}
		await this.record(current, method, AUDIT_OUTCOME.RATE_LIMITED, [])
		throw new ProblemException(HttpStatus.TOO_MANY_REQUESTS, ERROR_CODE.SEARCH_RATE_LIMITED, undefined, {
			[RETRY_AFTER_HEADER]: String(verdict.retryAfterSeconds),
		})
	}

	private async record(
		current: CurrentSession,
		method: PatientSearchMethod,
		outcome: AuditOutcome,
		released: readonly FoundPatient[],
	): Promise<void> {
		await this.database.sql.begin(async (tx: postgres.TransactionSql) => {
			await this.append(tx, current, method, outcome, released)
		})
	}

	private async append(
		tx: postgres.TransactionSql,
		current: CurrentSession,
		method: PatientSearchMethod,
		outcome: AuditOutcome,
		released: readonly FoundPatient[],
	): Promise<void> {
		await this.audit.append(
			tx,
			userAuditEventOf(current, {
				eventType: AUDIT_EVENT_TYPE.PATIENT_SEARCH,
				outcome,
				details: searchAuditDetailsOf(method, released, undefined),
			}),
		)
	}
}
