import type { FooterSocialIconProps } from './types'

export function SocialIcon({ href, label, children }: FooterSocialIconProps) {
	return (
		<a
			href={href}
			aria-label={label}
			target='_blank'
			rel='noopener noreferrer'
			className='text-white/40 transition-colors hover:text-white'
		>
			{children}
		</a>
	)
}
SocialIcon.displayName = 'Footer.SocialIcon'
