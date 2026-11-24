import { cn } from '@pkg/utils'
import { Avatar } from '../../primitives/Avatar'

type AccountBadgeProps = {
	/** Initials for an account, or the position label (`#1`) for a store. */
	label: string
	/**
	 * Picture belonging to this account. Only accounts that actually have one carry
	 * it — everyone else keeps their initials, whether or not they are the active row.
	 */
	avatarUrl?: string
	/** Signed-in account / selected store: 2px white ring instead of the muted 1px one. */
	isActive?: boolean
	/** Identity could not be resolved — dead or expired token. */
	dimmed?: boolean
	/** Figma: 38×38 in the switcher panel; the app bar trigger uses its own size. */
	className?: string
}

/**
 * The circle in front of an account or store. Shared by the switcher rows and the
 * app bar trigger so the signed-in account looks the same in both places.
 *
 * Figma: 38×38, radius 40. Active 2px #FFF, inactive 1px #AFAFAF. Label 12 / 700.
 */
export function AccountBadge({ label, avatarUrl, isActive = false, dimmed = false, className }: AccountBadgeProps) {
	if (avatarUrl) {
		// The picture carries the same ring as an initials badge, so the active state
		// reads identically whichever of the two a row happens to render.
		return (
			<Avatar
				src={avatarUrl}
				fallback={label}
				size='md'
				className={cn(className, isActive && 'border-2 border-white')}
			/>
		)
	}

	return (
		<span
			aria-hidden='true'
			className={cn(
				'flex shrink-0 items-center justify-center rounded-full text-center font-bold text-[12px] transition-colors',
				isActive ? 'border-2 border-white text-white' : 'border border-switcher-muted text-switcher-muted',
				dimmed && 'border-white/15 text-white/25',
				className,
			)}
		>
			{label}
		</span>
	)
}
AccountBadge.displayName = 'AccountBadge'
