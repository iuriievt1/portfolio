import { cn } from '@pkg/utils'
import Image from 'next/image'

type AvatarProps = {
	src?: string
	fallback?: string
	size?: 'sm' | 'md'
	className?: string
}

const sizes = {
	sm: 'h-8 w-8',
	md: 'h-9 w-9',
} as const

const pxSizes = { sm: 32, md: 36 } as const

export function Avatar({ src, fallback = 'U', size = 'md', className }: AvatarProps) {
	const altText = fallback ? `${fallback}'s avatar` : 'User avatar'

	return (
		<div className={cn('relative shrink-0 overflow-hidden rounded-full bg-avatar-fallback', sizes[size], className)}>
			{src ? (
				<Image
					src={src}
					alt={altText}
					width={pxSizes[size]}
					height={pxSizes[size]}
					className='absolute inset-0 h-full w-full object-cover'
				/>
			) : (
				<span className='flex h-full w-full items-center justify-center text-sm text-white/80'>{fallback}</span>
			)}
		</div>
	)
}
Avatar.displayName = 'Avatar'
