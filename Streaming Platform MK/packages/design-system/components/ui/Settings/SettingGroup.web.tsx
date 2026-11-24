import type { SettingGroupProps } from './types'

export function SettingGroup({ title, children }: SettingGroupProps) {
	return (
		<div className='mt-6'>
			<p className='px-4 pb-2 font-semibold text-white/40 text-xs uppercase tracking-wider'>{title}</p>
			<div className='overflow-hidden rounded-lg bg-white/5'>{children}</div>
		</div>
	)
}
SettingGroup.displayName = 'SettingGroup'
