import { cn } from '@pkg/utils'
import { cva, type VariantProps } from 'class-variance-authority'

// Size lives on each intent, not the base: `text-badge` is a custom key that tailwind-merge
// reads as a colour, so a size on a variant would not replace it and both would apply.
const badge = cva('inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 leading-none', {
	variants: {
		intent: {
			// 12px x 1.58 inside 4px padding is the 27px badge height Figma specifies (2040:33102).
			live: 'gap-[5px] rounded-[6px] bg-live px-2 py-1 text-[12px] text-white leading-[1.58]',
			new: 'bg-emerald-500/90 text-badge text-white',
			free: 'bg-blue-500/90 text-badge text-white',
			lastChance: 'bg-amber-500/90 text-badge text-black',
			rating: 'bg-white/15 text-badge text-white/80',
			adult: 'bg-white/15 text-badge text-white/60',
			showType: 'bg-white/10 text-badge text-white/70',
		},
	},
})

type BadgeIntent = NonNullable<VariantProps<typeof badge>['intent']>

type BadgeProps = {
	intent?: BadgeIntent
	children: React.ReactNode
	className?: string
	dot?: boolean
}

export function Badge({ intent, children, className, dot }: BadgeProps) {
	return (
		<span className={cn(badge({ intent }), className)}>
			{dot && <span className='h-1 w-1 rounded-full bg-current' />}
			{children}
		</span>
	)
}
Badge.displayName = 'Badge'

export type { BadgeProps, BadgeIntent }
