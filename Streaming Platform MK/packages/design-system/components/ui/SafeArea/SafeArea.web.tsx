import { cn } from '@pkg/utils'

type SafeAreaProps = {
	children: React.ReactNode
	className?: string
	edges?: ('top' | 'bottom' | 'left' | 'right')[]
}

export function SafeArea({ children, className }: SafeAreaProps) {
	return <div className={cn(className)}>{children}</div>
}
SafeArea.displayName = 'SafeArea'
