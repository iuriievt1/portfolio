import { clamp, cn } from '@pkg/utils'

type ProgressBarProps = {
	value: number
	className?: string
	barClassName?: string
}

export function ProgressBar({ value, className, barClassName }: ProgressBarProps) {
	const width = `${clamp(value, 0, 1) * 100}%`
	return (
		<div className={cn('h-progress-h overflow-hidden rounded-full bg-white/20', className)}>
			<div className={cn('h-full rounded-full bg-white transition-[width]', barClassName)} style={{ width }} />
		</div>
	)
}
ProgressBar.displayName = 'ProgressBar'
