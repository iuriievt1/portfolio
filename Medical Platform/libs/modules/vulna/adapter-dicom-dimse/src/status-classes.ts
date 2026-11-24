import {
	type AssociationRejection,
	type Classification,
	DIMSE_PHASE,
	type DimsePhase,
	INFORMATION_MODEL,
	type InformationModel,
	NOT_SENT_REASON,
	type NotSentReason,
	OUTCOME_CLASS,
	type OutcomeClass,
	RETRY_POLICY,
	type RetryPolicy,
} from "./contract"
import { statusHexOf } from "./phase"

// integrace-dicom.md 8, dorucovaci-jadro.md 5, ADR-003 ř. 27, ADR-005 ř. 25–34

interface Flags {
	retentionAnchor?: boolean
	clinicalSafetyQueue?: boolean
	alertAdmin?: boolean
	pauseTarget?: boolean
}

interface Rule {
	outcomeClass: OutcomeClass
	retryPolicy: RetryPolicy
	flags: Flags
}

interface Answered {
	phase: DimsePhase
	notSentReason: NotSentReason | undefined
	status: number | undefined
	rejection: AssociationRejection | undefined
}

// integrace-dicom.md 8 K, B, U, P
const NO_FLAGS: Flags = {}
const RETENTION_ANCHOR: Flags = { retentionAnchor: true }
const RETENTION_ANCHOR_AND_ALERT: Flags = { retentionAnchor: true, alertAdmin: true }
const CLINICAL_SAFETY_AND_ALERT: Flags = { clinicalSafetyQueue: true, alertAdmin: true }
const ALERT: Flags = { alertAdmin: true }
const ALERT_AND_PAUSE: Flags = { alertAdmin: true, pauseTarget: true }

// integrace-dicom.md 8
const RULE_ID = {
	STORE_WARNING: "STORE.Bxxx",
	STORE_UNDOCUMENTED: "STORE.UNDOCUMENTED",
	STORE_UNKNOWN: "STORE.UNKNOWN",
	STORE_NOT_SENT: "STORE.NOT_SENT",
	ARTIFACT_INTEGRITY: "LOCAL.ARTIFACT_INTEGRITY",
	FIND_NO_FINAL_RESPONSE: "FIND.NO_FINAL_RESPONSE",
	// (?)
	FIND_CANCELLED: "FIND.CANCELLED",
	// (?)
	ECHO_NOT_SENT: "ECHO.NOT_SENT",
} as const

function rule(outcomeClass: OutcomeClass, retryPolicy: RetryPolicy, flags: Flags = NO_FLAGS): Rule {
	return { outcomeClass, retryPolicy, flags }
}

function classified(found: Rule, ruleId: string): Classification {
	return {
		outcomeClass: found.outcomeClass,
		retryPolicy: found.retryPolicy,
		retentionAnchor: found.flags.retentionAnchor === true,
		clinicalSafetyQueue: found.flags.clinicalSafetyQueue === true,
		alertAdmin: found.flags.alertAdmin === true,
		pauseTarget: found.flags.pauseTarget === true,
		ruleId,
	}
}

const { SUCCESS, SUCCESS_WITH_WARNING, TRANSIENT, CONFIGURATION, DATA, IDENTITY_CONFLICT } = OUTCOME_CLASS
const { UNKNOWN_OUTCOME, UNDOCUMENTED_STATUS, INCOMPLETE_RESULT } = OUTCOME_CLASS
const { NEVER, BACKOFF, VERIFY_THEN_RETRY } = RETRY_POLICY

const STATUS_SUCCESS = 0x00_00

// integrace-dicom.md 8.1, CS tab. 2.15
const STORE_STATUSES: ReadonlyMap<number, Rule> = new Map([
	[STATUS_SUCCESS, rule(SUCCESS, NEVER, RETENTION_ANCHOR)],
	[0xa7_00, rule(TRANSIENT, BACKOFF)],
	[0xa7_01, rule(TRANSIENT, BACKOFF)],
	[0xa7_04, rule(TRANSIENT, BACKOFF)],
	[0xc0_01, rule(TRANSIENT, VERIFY_THEN_RETRY)],
	[0xa7_02, rule(CONFIGURATION, NEVER, ALERT_AND_PAUSE)],
	[0xa7_03, rule(CONFIGURATION, NEVER, ALERT_AND_PAUSE)],
	[0xa7_05, rule(CONFIGURATION, NEVER, ALERT_AND_PAUSE)],
	[0xa7_06, rule(CONFIGURATION, NEVER, ALERT_AND_PAUSE)],
	[0xa9_00, rule(DATA, NEVER, CLINICAL_SAFETY_AND_ALERT)],
	[0xc0_00, rule(DATA, NEVER, CLINICAL_SAFETY_AND_ALERT)],
	[0xc0_03, rule(DATA, NEVER, CLINICAL_SAFETY_AND_ALERT)],
	[0xc0_04, rule(DATA, NEVER, CLINICAL_SAFETY_AND_ALERT)],
	[0xc0_02, rule(IDENTITY_CONFLICT, NEVER, CLINICAL_SAFETY_AND_ALERT)],
	[0x01_22, rule(CONFIGURATION, NEVER, ALERT_AND_PAUSE)],
])
// PS3.4 B.2.3, integrace-dicom.md 8.1, CAP-023-R12
const WARNING_FIRST = 0xb0_00
const WARNING_LAST = 0xbf_ff
const STORE_WARNING = rule(SUCCESS_WITH_WARNING, NEVER, RETENTION_ANCHOR_AND_ALERT)
// integrace-dicom.md 8.1, ADR-005 ř. 30
const UNDOCUMENTED = rule(UNDOCUMENTED_STATUS, NEVER, ALERT)

// integrace-dicom.md 8.2, CS tab. 2.19, 2.26
const FIND_STATUSES: ReadonlyMap<number, Rule> = new Map([
	[STATUS_SUCCESS, rule(SUCCESS, NEVER)],
	[0xa7_00, rule(INCOMPLETE_RESULT, BACKOFF)],
	[0xfe_00, rule(INCOMPLETE_RESULT, BACKOFF)],
	[0xc0_00, rule(INCOMPLETE_RESULT, BACKOFF, ALERT)],
	[0xa9_00, rule(DATA, NEVER, ALERT)],
])
// integrace-dicom.md 8.2, CS tab. 2.19, TS-146
const FIND_NOT_AUTHORIZED = 0xc0_01
const QUERY_RETRIEVE_NOT_AUTHORIZED = rule(CONFIGURATION, NEVER, ALERT_AND_PAUSE)
// integrace-dicom.md 8.2
const NO_FINAL_RESPONSE = rule(INCOMPLETE_RESULT, BACKOFF)
// integrace-dicom.md 6.4, 8.2, ADR-005 ř. 39, CAP-024-R08 (?)
const CANCELLED = rule(INCOMPLETE_RESULT, BACKOFF)

// integrace-dicom.md 8.3, NAB-354
const ECHO_SUCCESS = rule(SUCCESS, NEVER)

// integrace-dicom.md 8.3, PS3.8 9.3.4
const REJECTED_TRANSIENT = 2
const REJECTION_TRANSIENT = rule(TRANSIENT, BACKOFF)
const REJECTION_PERMANENT = rule(CONFIGURATION, NEVER, ALERT_AND_PAUSE)
// integrace-dicom.md 8.1, 8.3, CAP-023-R16
const NO_ACCEPTED_TRANSFER_SYNTAX = rule(CONFIGURATION, NEVER, ALERT_AND_PAUSE)
// integrace-dicom.md 8.1, CAP-023-R09
const ARTIFACT_INTEGRITY = rule(DATA, NEVER, CLINICAL_SAFETY_AND_ALERT)
// integrace-dicom.md 8.2 A900 (?)
const INVALID_QUERY = rule(DATA, NEVER, ALERT)
// integrace-dicom.md 8.1, 8.3, ADR-005 ř. 33, CAP-023-R24
const NOT_SENT = rule(TRANSIENT, BACKOFF)
const UNKNOWN = rule(UNKNOWN_OUTCOME, VERIFY_THEN_RETRY)

const OPERATION = { STORE: "STORE", FIND: "FIND", ECHO: "ECHO" } as const
type Operation = (typeof OPERATION)[keyof typeof OPERATION]

// integrace-dicom.md 8.3, PS3.8 9.3.4
function rejectionClassification(rejection: AssociationRejection): Classification {
	const found = rejection.result === REJECTED_TRANSIENT ? REJECTION_TRANSIENT : REJECTION_PERMANENT
	return classified(found, `RJ.${rejection.result}/${rejection.source}/${rejection.reason}`)
}

// integrace-dicom.md 8.1, 8.2, 8.3
function notSentClassification(
	operation: Operation,
	answered: Answered,
	otherwise: Rule,
	ruleId: string,
): Classification {
	if (answered.rejection !== undefined) {
		return rejectionClassification(answered.rejection)
	}
	switch (answered.notSentReason) {
		case NOT_SENT_REASON.ARTIFACT_INTEGRITY:
			return classified(ARTIFACT_INTEGRITY, RULE_ID.ARTIFACT_INTEGRITY)
		case NOT_SENT_REASON.NO_ACCEPTED_TRANSFER_SYNTAX:
			return classified(NO_ACCEPTED_TRANSFER_SYNTAX, `${operation}.NO_ACCEPTED_TRANSFER_SYNTAX`)
		case NOT_SENT_REASON.INVALID_QUERY:
			return classified(INVALID_QUERY, `${operation}.INVALID_QUERY`)
		default:
			return classified(otherwise, ruleId)
	}
}

// integrace-dicom.md 8.1, ADR-005 ř. 27–34, CAP-023-R12
export function storeClassification(answered: Answered): Classification {
	if (answered.phase === DIMSE_PHASE.UNKNOWN) {
		return classified(UNKNOWN, RULE_ID.STORE_UNKNOWN)
	}
	const status = answered.status
	if (status === undefined) {
		return notSentClassification(OPERATION.STORE, answered, NOT_SENT, RULE_ID.STORE_NOT_SENT)
	}
	const documented = STORE_STATUSES.get(status)
	if (documented !== undefined) {
		return classified(documented, `STORE.${statusHexOf(status)}`)
	}
	if (status >= WARNING_FIRST && status <= WARNING_LAST) {
		return classified(STORE_WARNING, RULE_ID.STORE_WARNING)
	}
	return classified(UNDOCUMENTED, RULE_ID.STORE_UNDOCUMENTED)
}

// integrace-dicom.md 6.4, 8.2, ADR-005 ř. 39
export function findClassification(
	answered: Answered,
	informationModel: InformationModel,
	isCancelled: boolean,
): Classification {
	const status = answered.status
	if (status === undefined) {
		return notSentClassification(OPERATION.FIND, answered, NO_FINAL_RESPONSE, RULE_ID.FIND_NO_FINAL_RESPONSE)
	}
	if (status === STATUS_SUCCESS && isCancelled) {
		return classified(CANCELLED, RULE_ID.FIND_CANCELLED)
	}
	const ruleId = `FIND.${statusHexOf(status)}`
	const documented = FIND_STATUSES.get(status)
	if (documented !== undefined) {
		return classified(documented, ruleId)
	}
	if (status === FIND_NOT_AUTHORIZED && informationModel !== INFORMATION_MODEL.MODALITY_WORKLIST) {
		return classified(QUERY_RETRIEVE_NOT_AUTHORIZED, ruleId)
	}
	return classified(UNDOCUMENTED, ruleId)
}

// integrace-dicom.md 6.2, 8.3, NAB-354, CAP-023-R24
export function echoClassification(answered: Answered): Classification {
	const status = answered.status
	if (status === undefined) {
		return notSentClassification(OPERATION.ECHO, answered, NOT_SENT, RULE_ID.ECHO_NOT_SENT)
	}
	return classified(status === STATUS_SUCCESS ? ECHO_SUCCESS : UNDOCUMENTED, `ECHO.${statusHexOf(status)}`)
}
