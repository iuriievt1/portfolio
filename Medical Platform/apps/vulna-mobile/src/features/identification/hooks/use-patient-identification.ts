import { PATIENT_IDENTIFICATION_METHOD } from "@ansora/contracts"
import { CARD_READING, cardIdentifierOf, NoSessionError, nfcReader, type TagReading } from "@ansora/core-mobile"
import { useCallback, useEffect, useRef, useState } from "react"
import { type Patient, patientApi } from "../../../api/patients"
import { currentTexts } from "../../../i18n/language-store"
import { ROUTE } from "../../../navigation/routes"
import { CODE_SCAN, useCodeScan } from "../../code-scan/hooks/use-code-scan"
import { effectiveConfiguration } from "../../session/effective-configuration-store"
import { sessionCaller } from "../../session/session-actions"
import type { MatchingPatients } from "../matching-patients"
import {
	codeIdentifierOf,
	IDENTIFICATION,
	IDENTIFICATION_NOTICE,
	type IdentificationMethod,
	type IdentificationNotice,
	identificationOf,
	noticeOfError,
	type PatientCode,
	type PatientTag,
	type ReadIdentifier,
	type ReadTag,
	tagIdentifierOf,
} from "../patient-identifier"

export const IDENTIFICATION_PHASE = {
	IDLE: "idle",
	SCANNING_CODE: "scanning_code",
	READING_TAG: "reading_tag",
	SEARCHING: "searching",
	NOTICE: "notice",
} as const

export type IdentificationPhase =
	| { kind: typeof IDENTIFICATION_PHASE.IDLE }
	| { kind: typeof IDENTIFICATION_PHASE.SCANNING_CODE }
	| { kind: typeof IDENTIFICATION_PHASE.READING_TAG }
	| { kind: typeof IDENTIFICATION_PHASE.SEARCHING }
	| { kind: typeof IDENTIFICATION_PHASE.NOTICE; notice: IdentificationNotice; method: IdentificationMethod }

export interface PatientIdentificationFlow {
	phase: IdentificationPhase
	// CAP-013-R03
	canScanCode: boolean
	scanCode: () => void
	readTag: () => void
	cancelReading: () => void
	retry: () => void
	dismiss: () => void
}

export interface IdentificationHandlers {
	onPatient: (patient: Patient) => void
	onMatches: (matches: MatchingPatients) => void
}

const IDLE: IdentificationPhase = { kind: IDENTIFICATION_PHASE.IDLE }
const SCANNING_CODE: IdentificationPhase = { kind: IDENTIFICATION_PHASE.SCANNING_CODE }
const READING_TAG: IdentificationPhase = { kind: IDENTIFICATION_PHASE.READING_TAG }
const SEARCHING: IdentificationPhase = { kind: IDENTIFICATION_PHASE.SEARCHING }

function patientCode(): PatientCode | null {
	return effectiveConfiguration()?.patient_code ?? null
}

function patientTag(): PatientTag | null {
	return effectiveConfiguration()?.patient_tag ?? null
}

function noticeOf(notice: IdentificationNotice, method: IdentificationMethod): IdentificationPhase {
	return { kind: IDENTIFICATION_PHASE.NOTICE, notice, method }
}

function readTagOf(reading: Extract<TagReading, { kind: typeof CARD_READING.READ }>): ReadTag {
	return {
		uid: reading.tagId === undefined ? undefined : cardIdentifierOf(reading.tagId),
		ndefTexts: reading.ndefTexts,
	}
}

// CAP-013-R10, CAP-013-R13, CAP-025-R18, CHG-175
async function identifiedPatients(identifier: ReadIdentifier, method: IdentificationMethod): Promise<Patient[]> {
	const result = await sessionCaller.call((sessionToken) =>
		patientApi.identifyPatient(sessionToken, {
			search_method: method,
			system: identifier.system,
			value: identifier.value,
		}),
	)
	return result.items
}

// CAP-013-R10, CAP-013-R15, CAP-013-R18
export function usePatientIdentification({ onPatient, onMatches }: IdentificationHandlers): PatientIdentificationFlow {
	const scanOnScreen = useCodeScan(ROUTE.PATIENT_CODE_SCAN)
	const [phase, setPhase] = useState<IdentificationPhase>(IDLE)
	const shownPhase = useRef<IdentificationPhase>(IDLE)
	const attempt = useRef(0)

	const show = useCallback((next: IdentificationPhase) => {
		shownPhase.current = next
		setPhase(next)
	}, [])

	const begin = useCallback((): number => {
		attempt.current += 1
		return attempt.current
	}, [])

	useEffect(
		() => () => {
			attempt.current += 1
			if (shownPhase.current.kind === IDENTIFICATION_PHASE.READING_TAG) {
				void nfcReader().cancel()
			}
		},
		[],
	)

	const identify = useCallback(
		async (current: number, method: IdentificationMethod, identifier: ReadIdentifier) => {
			show(SEARCHING)
			try {
				const patients = await identifiedPatients(identifier, method)
				if (attempt.current !== current) {
					return
				}
				const identification = identificationOf(patients)
				switch (identification.kind) {
					case IDENTIFICATION.OPEN:
						show(IDLE)
						onPatient(identification.patient)
						return
					case IDENTIFICATION.CHOOSE:
						show(IDLE)
						onMatches({ patients: identification.patients, identifier, method })
						return
					case IDENTIFICATION.NOT_FOUND:
						show(noticeOf({ kind: IDENTIFICATION_NOTICE.NOT_FOUND }, method))
						return
					default:
						return identification satisfies never
				}
			} catch (error) {
				if (attempt.current !== current) {
					return
				}
				show(error instanceof NoSessionError ? IDLE : noticeOf(noticeOfError(error), method))
			}
		},
		[show, onPatient, onMatches],
	)

	// CAP-013-R02, CAP-013-R03, CAP-013-S01, CAP-013-S03
	const identifyByCode = useCallback(
		async (current: number) => {
			const method = PATIENT_IDENTIFICATION_METHOD.CODE
			const code = patientCode()
			if (code === null) {
				show(noticeOf({ kind: IDENTIFICATION_NOTICE.CODE_NOT_SET }, method))
				return
			}
			show(SCANNING_CODE)
			const scan = await scanOnScreen()
			if (attempt.current !== current) {
				return
			}
			switch (scan.kind) {
				case CODE_SCAN.SCANNED: {
					const identifier = codeIdentifierOf(scan.content, code)
					if (identifier === undefined) {
						show(noticeOf({ kind: IDENTIFICATION_NOTICE.NOT_FOUND }, method))
						return
					}
					await identify(current, method, identifier)
					return
				}
				case CODE_SCAN.CANCELLED:
					show(IDLE)
					return
				case CODE_SCAN.CAMERA_DENIED:
					show(noticeOf({ kind: IDENTIFICATION_NOTICE.CAMERA_DENIED }, method))
					return
				default:
					return scan satisfies never
			}
		},
		[show, scanOnScreen, identify],
	)

	// CAP-013-R04, CAP-013-R05, CAP-013-R06, CAP-013-S04
	const identifyByTag = useCallback(
		async (current: number) => {
			const method = PATIENT_IDENTIFICATION_METHOD.NFC_TAG
			const tag = patientTag()
			if (tag === null) {
				show(noticeOf({ kind: IDENTIFICATION_NOTICE.TAG_NOT_MAPPED }, method))
				return
			}
			const isNfcDisabled = nfcReader().readsWithoutPrompt && !(await nfcReader().isEnabled())
			if (attempt.current !== current) {
				return
			}
			if (isNfcDisabled) {
				show(noticeOf({ kind: IDENTIFICATION_NOTICE.NFC_DISABLED }, method))
				return
			}
			show(READING_TAG)
			const reading = await nfcReader().readTag(currentTexts().identification.tag.instruction, tag.source)
			if (attempt.current !== current) {
				return
			}
			switch (reading.kind) {
				case CARD_READING.READ: {
					const identifier = tagIdentifierOf(readTagOf(reading), tag)
					if (identifier === undefined) {
						show(noticeOf({ kind: IDENTIFICATION_NOTICE.TAG_NOT_MAPPED }, method))
						return
					}
					await identify(current, method, identifier)
					return
				}
				case CARD_READING.CANCELLED:
					show(IDLE)
					return
				case CARD_READING.TIMED_OUT:
				case CARD_READING.FAILED:
					show(noticeOf({ kind: IDENTIFICATION_NOTICE.TAG_UNREADABLE }, method))
					return
				default:
					return reading satisfies never
			}
		},
		[show, identify],
	)

	const start = useCallback(
		(identifyBy: (current: number) => Promise<void>) => {
			const { kind } = shownPhase.current
			if (kind !== IDENTIFICATION_PHASE.IDLE && kind !== IDENTIFICATION_PHASE.NOTICE) {
				return
			}
			const current = begin()
			identifyBy(current).catch((failure: unknown) => {
				console.warn("the patient could not be identified", failure)
				if (attempt.current === current) {
					show(IDLE)
				}
			})
		},
		[begin, show],
	)

	const scanCode = useCallback(() => start(identifyByCode), [start, identifyByCode])

	const readTag = useCallback(() => start(identifyByTag), [start, identifyByTag])

	const cancelReading = useCallback(() => {
		if (shownPhase.current.kind !== IDENTIFICATION_PHASE.READING_TAG) {
			return
		}
		begin()
		show(IDLE)
		void nfcReader().cancel()
	}, [begin, show])

	const retry = useCallback(() => {
		const shown = shownPhase.current
		if (shown.kind !== IDENTIFICATION_PHASE.NOTICE) {
			return
		}
		if (shown.method === PATIENT_IDENTIFICATION_METHOD.CODE) {
			scanCode()
			return
		}
		readTag()
	}, [scanCode, readTag])

	const dismiss = useCallback(() => {
		if (shownPhase.current.kind !== IDENTIFICATION_PHASE.NOTICE) {
			return
		}
		begin()
		show(IDLE)
	}, [begin, show])

	return { phase, canScanCode: patientCode() !== null, scanCode, readTag, cancelReading, retry, dismiss }
}
