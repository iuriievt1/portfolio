import { cn } from '@pkg/utils'
import { forwardRef } from 'react'
import { CloseIcon } from '../icons/Close'
import { SearchIcon } from '../icons/Search'

type SearchInputProps = {
	placeholder?: string
	onClose?: () => void
	className?: string
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
	({ placeholder = 'Search...', onClose, className }, ref) => {
		return (
			<div
				className={cn(
					'flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-1.5 backdrop-blur-sm',
					className,
				)}
			>
				<SearchIcon className='h-4 w-4 shrink-0 text-white/50' />
				<input
					ref={ref}
					type='text'
					placeholder={placeholder}
					className='min-w-0 flex-1 bg-transparent text-sm text-white placeholder-white/40 outline-none'
				/>
				{onClose && (
					<button
						type='button'
						aria-label='Close search'
						onClick={onClose}
						className='inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white/50 transition-colors hover:text-white'
					>
						<CloseIcon className='h-4 w-4' />
					</button>
				)}
			</div>
		)
	},
)
SearchInput.displayName = 'SearchInput'
