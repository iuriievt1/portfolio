import { createContext, useContext } from "react"

const SessionLockContext = createContext<(() => void) | undefined>(undefined)

export const SessionLockProvider = SessionLockContext.Provider

export function useLockAction(): () => void {
	const lock = useContext(SessionLockContext)
	if (lock === undefined) {
		throw new Error("the lock is offered only inside the protected area")
	}
	return lock
}
