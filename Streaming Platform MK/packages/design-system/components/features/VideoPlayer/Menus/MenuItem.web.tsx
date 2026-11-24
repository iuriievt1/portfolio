'use client'

import { cn } from '@pkg/utils'
import { CheckIcon } from '../../../../icons/VideoPlayer'

type MenuItemProps = {
	label: string
	active: boolean
	onClick: () => void
	badge?: string
}

/** Unselected rows keep the slot so every label lines up with the selected one. */
const CHECK_CLASS = 'h-[9px] w-[12px] shrink-0 sm:h-[12px] sm:w-[17px]'

export function MenuItem({ label, active, onClick, badge }: MenuItemProps) {
	const buttonClass = cn(
		'flex w-full items-center gap-2 whitespace-nowrap rounded-md px-3 py-1 text-left font-semibold text-sm text-white leading-[1.58] transition-colors sm:gap-[9px] sm:px-[15px] sm:py-[5px] sm:text-base',
		active ? 'bg-white/10' : 'hover:bg-white/5',
	)
	const labelText = badge ? `${label} (${badge})` : label

	return (
		<button type='button' onClick={onClick} className={buttonClass}>
			{active ? <CheckIcon className={CHECK_CLASS} /> : <span className={CHECK_CLASS} />}
			<span>{labelText}</span>
		</button>
	)
}
