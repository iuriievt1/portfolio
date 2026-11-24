import { useEffect, useState } from "react"
import { millisecondsOf } from "../../../utils/time"

interface RateLimitNotice {
	retryAfterSeconds: number | undefined
}

// CAP-013-S12, CAP-013-S25, E73
export function useRetryAllowed<Notice extends RateLimitNotice>(notice: Notice | undefined): boolean {
	const [allowed, setAllowed] = useState<Notice | undefined>(undefined)

	useEffect(() => {
		if (notice === undefined) {
			return
		}
		const timer = setTimeout(() => setAllowed(notice), millisecondsOf(notice.retryAfterSeconds ?? 0))
		return () => clearTimeout(timer)
	}, [notice])

	return notice !== undefined && allowed === notice
}
