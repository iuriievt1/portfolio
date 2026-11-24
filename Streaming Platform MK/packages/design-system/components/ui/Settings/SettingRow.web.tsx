import { cn } from '@pkg/utils'
import type { SettingRowProps } from './types'

export function SettingRow({ label, description, value, onToggle }: SettingRowProps) {
	const trackClass = cn('relative h-6 w-11 rounded-full transition-colors', value ? 'bg-green-500/60' : 'bg-white/10')
	const thumbClass = cn(
		'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
		value ? 'translate-x-[22px]' : 'translate-x-0.5',
	)

	return (
		<button
			type='button'
			onClick={() => onToggle(!value)}
			className='flex w-full items-center justify-between border-white/10 border-b px-4 py-4 text-left transition-colors hover:bg-white/5'
		>
			<div className='flex-1 pr-4'>
				<p className='font-medium text-base text-white'>{label}</p>
				{description && <p className='mt-0.5 text-sm text-white/50'>{description}</p>}
			</div>
			<div className={trackClass}>
				<div className={thumbClass} />
			</div>
		</button>
	)
}
SettingRow.displayName = 'SettingRow'
