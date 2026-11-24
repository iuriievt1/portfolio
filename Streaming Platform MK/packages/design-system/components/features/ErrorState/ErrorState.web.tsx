import { ErrorIcon } from './ErrorIcon'

type ErrorAction = {
	label: string
	action: (() => void) | string
	variant?: 'primary' | 'secondary'
}

type ErrorStateProps = {
	title: string
	message?: string
	/** @deprecated Use `actions` instead */
	actionLabel?: string
	/** @deprecated Use `actions` instead */
	onAction?: (() => void) | string
	actions?: ErrorAction[]
}

const primaryClass =
	'flex flex-1 items-center justify-center rounded-[4px] bg-foreground px-6 sm:px-8 py-3 sm:py-3.5 text-center text-sm sm:text-base font-semibold text-page-bg transition-opacity hover:opacity-90 active:opacity-80'

const secondaryClass =
	'flex flex-1 items-center justify-center rounded-[4px] bg-white/10 px-6 sm:px-8 py-3 sm:py-3.5 text-center text-sm sm:text-base font-semibold text-white transition-opacity hover:opacity-90 active:opacity-80'

function ActionButton({ label, action, variant = 'primary' }: ErrorAction) {
	const cls = variant === 'primary' ? primaryClass : secondaryClass
	if (typeof action === 'string') {
		return (
			<a href={action} className={cls}>
				{label}
			</a>
		)
	}
	return (
		<button type='button' onClick={action} className={cls}>
			{label}
		</button>
	)
}

export function ErrorState({ title, message, actionLabel, onAction, actions }: ErrorStateProps) {
	const resolvedActions: ErrorAction[] =
		actions ?? (onAction && actionLabel ? [{ label: actionLabel, action: onAction, variant: 'primary' }] : [])

	return (
		<div className='flex flex-1 flex-col items-center justify-center px-5 sm:px-6'>
			<div className='flex w-full max-w-sm flex-col items-center gap-4 text-center sm:gap-5'>
				<ErrorIcon size={56} />
				<div className='flex flex-col items-center gap-1'>
					<h1 className='font-bold text-foreground text-lg sm:text-xl'>{title}</h1>
					{message && <p className='max-w-md text-muted text-xs sm:text-sm'>{message}</p>}
				</div>
				{resolvedActions.length > 0 && (
					<div className='flex w-full gap-2'>
						{resolvedActions.map((a) => (
							<ActionButton key={a.label} {...a} />
						))}
					</div>
				)}
			</div>
		</div>
	)
}
