import { cn } from '@pkg/utils'

type PageContentProps = {
	children: React.ReactNode
	className?: string
}

export function PageContent({ children, className }: PageContentProps) {
	return (
		<div
			className={cn(
				'space-y-section-sm py-8',
				'px-[var(--page-pad-sm)]',
				'lg:px-[var(--page-pad-lg)]',
				'xl:space-y-section-xl xl:px-[var(--page-pad-xl)]',
				'3xl:space-y-section-3xl 3xl:px-[var(--page-pad-3xl)]',
				className,
			)}
		>
			{children}
		</div>
	)
}
PageContent.displayName = 'PageContent'
