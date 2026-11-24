import type { FocusRingProps } from './types'

export function FocusRing({ children, className }: FocusRingProps) {
	return <div className={className}>{children}</div>
}
FocusRing.displayName = 'FocusRing'
