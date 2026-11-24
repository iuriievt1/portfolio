import { identifierSearchTextOf, PATIENT_IDENTIFIER_VALUE_MAX_LENGTH } from "@ansora/contracts"
import { NoSessionError } from "@ansora/core-mobile"
import { useFocusEffect } from "expo-router"
import { useCallback, useEffect, useRef, useState } from "react"
import { BackHandler } from "react-native"
import { type Patient, patientApi } from "../../../api/patients"
import { useRetryAllowed } from "../../identification/hooks/use-retry-allowed"
import { sessionCaller } from "../../session/session-actions"
import {
	SEARCH_STATE,
	type SearchState,
	searchStateOfError,
	searchStateOfQuery,
	searchStateOfResult,
} from "../patient-search"

const TYPING_PAUSE_MILLISECONDS = 400

export interface PatientSearch {
	system: string
	query: string
	state: SearchState
	isActive: boolean
	isTyping: boolean
	canRetry: boolean
	startTyping: () => void
	type: (digit: string) => void
	erase: () => void
	retry: () => void
	clear: () => void
	choose: (patient: Patient) => void
}

// CAP-013-R07, CAP-013-R17, CAP-013-R19, CHG-182
export function usePatientSearch(
	system: string | undefined,
	onPatient: (patient: Patient) => void,
): PatientSearch | undefined {
	const [query, setQuery] = useState("")
	const [isTyping, setTyping] = useState(false)
	const [state, setState] = useState<SearchState>({ kind: SEARCH_STATE.IDLE })
	const canRetry = useRetryAllowed(state.kind === SEARCH_STATE.RATE_LIMITED ? state : undefined)
	const latest = useRef(0)

	const search = useCallback((text: string) => {
		const request = latest.current + 1
		latest.current = request
		void find(text).then((next) => {
			if (next !== undefined && latest.current === request) {
				setState(next)
			}
		})
	}, [])

	useEffect(() => {
		latest.current += 1
		const immediate = searchStateOfQuery(query)
		if (immediate !== undefined) {
			setState(immediate)
			return
		}
		setState((shown) => (shown.kind === SEARCH_STATE.TOO_SHORT ? { kind: SEARCH_STATE.IDLE } : shown))
		const timer = setTimeout(() => search(identifierSearchTextOf(query)), TYPING_PAUSE_MILLISECONDS)
		return () => clearTimeout(timer)
	}, [query, search])

	useEffect(() => {
		if (!isTyping) {
			return
		}
		const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
			setTyping(false)
			return true
		})
		return () => subscription.remove()
	}, [isTyping])

	useFocusEffect(useCallback(() => () => setTyping(false), []))

	const retry = useCallback(() => search(identifierSearchTextOf(query)), [query, search])

	const startTyping = useCallback(() => setTyping(true), [])

	const type = useCallback(
		(digit: string) =>
			setQuery((typed) => (typed.length < PATIENT_IDENTIFIER_VALUE_MAX_LENGTH ? `${typed}${digit}` : typed)),
		[],
	)

	const erase = useCallback(() => setQuery((typed) => typed.slice(0, -1)), [])

	const clear = useCallback(() => {
		setQuery("")
		setTyping(false)
	}, [])

	const choose = useCallback(
		(patient: Patient) => {
			setTyping(false)
			onPatient(patient)
		},
		[onPatient],
	)

	if (system === undefined) {
		return undefined
	}
	return {
		system,
		query,
		state,
		isActive: isTyping || query.length > 0,
		isTyping,
		canRetry,
		startTyping,
		type,
		erase,
		retry,
		clear,
		choose,
	}
}

async function find(text: string): Promise<SearchState | undefined> {
	try {
		const result = await sessionCaller.call((sessionToken) => patientApi.findPatients(sessionToken, { query: text }))
		return searchStateOfResult(result)
	} catch (error) {
		if (error instanceof NoSessionError) {
			return undefined
		}
		return searchStateOfError(error)
	}
}
