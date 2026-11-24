import { useEffect, useState } from 'react'

/** Returns true after `ms` elapses since `active` became true. Resets on re-activation. */
export function useMinDuration(active: boolean, ms: number) {
	const [elapsed, setElapsed] = useState(false)

	useEffect(() => {
		if (!active) return
		setElapsed(false)
		const timer = setTimeout(() => setElapsed(true), ms)
		return () => clearTimeout(timer)
	}, [active, ms])

	return elapsed
}
