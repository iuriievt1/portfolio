import { Link } from '../../primitives/Link'
import type { FooterLinkProps } from './types'

export function FooterLink({ href, children, external }: FooterLinkProps) {
	if (external) {
		return (
			<li>
				<a
					href={href}
					className='text-white/40 transition-colors hover:text-white'
					target='_blank'
					rel='noopener noreferrer'
				>
					{children}
				</a>
			</li>
		)
	}

	return (
		<li>
			<Link href={href} className='text-white/40 hover:text-white'>
				{children}
			</Link>
		</li>
	)
}
FooterLink.displayName = 'Footer.Link'
