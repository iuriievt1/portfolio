import { useEffect, useState } from "react"
import { forgetMatchingPatients, type MatchingPatients, matchingPatients } from "../matching-patients"

// CAP-013-R08, CAP-013-R10
export function useOfferedMatches(): MatchingPatients | undefined {
	const [matches] = useState(matchingPatients)
	useEffect(() => forgetMatchingPatients, [])
	return matches
}
