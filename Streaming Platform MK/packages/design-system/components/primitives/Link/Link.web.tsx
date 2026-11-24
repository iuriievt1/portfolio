import { cn } from '@pkg/utils'
import { Link as SolitoLink } from 'solito/link'

type LinkProps = {
	href: string
	children: React.ReactNode
	className?: string
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'children' | 'className'>

export function Link({ href, children, className, ...rest }: LinkProps) {
	return (
		<SolitoLink href={href} className={cn('text-white transition-colors hover:text-white/90', className)} {...rest}>
			{children}
		</SolitoLink>
	)
}
Link.displayName = 'Link'
