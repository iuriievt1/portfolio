import type {
	AcquisitionOfRecord,
	HistoryFinding,
	HistoryRecords,
	HistoryScanRecord,
	HistoryWoundRecord,
} from "@ansora/vulna-domain"
import type { CurrentSession } from "../../login/types/login.types"
import { DocumentationUnavailableException } from "../exceptions/documentation-unavailable.exception"
import type { ClinicalReadService } from "../services/clinical-read.service"

export interface StoreHistory {
	findings: readonly HistoryFinding[]
	wounds: readonly HistoryWoundRecord[]
	scans: readonly HistoryScanRecord[]
	unavailable: boolean
}

export interface ClinicalReadsFake {
	reads: ClinicalReadService
}

export function shownWound(acquisitionId: string): HistoryWoundRecord {
	return {
		acquisitionId,
		findingId: undefined,
		site: undefined,
		healingPhaseCode: undefined,
		description: undefined,
		closedWoundTypeCode: undefined,
	}
}

function recordsOf(history: StoreHistory, acquisitionId: string): HistoryRecords {
	return {
		findings: [],
		wounds: history.wounds.filter((wound) => wound.acquisitionId === acquisitionId),
		scans: history.scans.filter((scan) => scan.acquisitionId === acquisitionId),
	}
}

// ADR-054 bod 2, CAP-020-R16
export function clinicalReadsFake(setup: Partial<StoreHistory> = {}): ClinicalReadsFake {
	const history: StoreHistory = { findings: [], wounds: [], scans: [], unavailable: false, ...setup }
	const closedIds = [...history.wounds, ...history.scans].map((record) => record.acquisitionId)
	async function answer<T>(value: T): Promise<T> {
		if (history.unavailable) {
			throw new DocumentationUnavailableException()
		}
		return value
	}
	const reads = {
		closedWoundsOfPatient: async () => await answer({ findings: history.findings, wounds: history.wounds }),
		closedScansOfPatient: async () => await answer(history.scans),
		recordVisibilityOf: async (current: CurrentSession) =>
			await answer({ userId: current.session.userId, closedAcquisitionIds: closedIds }),
		closedRecordsOfFinding: async (_current: CurrentSession, findingId: string) =>
			await answer({
				findings: history.findings.filter((finding) => finding.findingId === findingId),
				wounds: history.wounds.filter((wound) => wound.findingId === findingId),
				scans: [],
			}),
		closedRecord: async (_current: CurrentSession, acquisition: AcquisitionOfRecord) =>
			await answer(recordsOf(history, acquisition.acquisitionId)),
		isClosedRecordVisible: async (_current: CurrentSession, acquisition: AcquisitionOfRecord) => {
			const records = await answer(recordsOf(history, acquisition.acquisitionId))
			return records.wounds.length > 0 || records.scans.length > 0
		},
	} as unknown as ClinicalReadService
	return { reads }
}
