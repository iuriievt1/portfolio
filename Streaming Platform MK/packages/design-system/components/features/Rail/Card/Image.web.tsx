'use client'

import { cn } from '@pkg/utils'
import Image from 'next/image'
import { useCallback, useState } from 'react'
import { useCardMeta } from './context'

type CardImageProps = { className?: string }

export function CardImage({ className }: CardImageProps) {
	const { item } = useCardMeta()
	const [loaded, setLoaded] = useState(false)
	// Keyed by URL, not a flag: MK declares artwork it does not serve, and a 404 would otherwise
	// leave the shimmer running forever — and a stale flag would blank the next good image.
	const [failedUrl, setFailedUrl] = useState<string | null>(null)

	const handleLoad = useCallback(() => setLoaded(true), [])
	const handleError = useCallback(() => setFailedUrl(item.imageUrl), [item.imageUrl])

	if (!item.imageUrl || failedUrl === item.imageUrl) {
		return <div className={cn('absolute inset-0 bg-surface', className)} />
	}

	return (
		<>
			{!loaded && (
				<div className='absolute inset-0 overflow-hidden bg-surface'>
					<div className='absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/[0.14] to-transparent' />
				</div>
			)}
			<Image
				src={item.imageUrl}
				alt={item.title}
				fill
				sizes='(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (max-width: 1536px) 25vw, 20vw'
				className={cn('object-cover transition-opacity duration-300', loaded ? 'opacity-100' : 'opacity-0', className)}
				draggable={false}
				onLoad={handleLoad}
				onError={handleError}
			/>
		</>
	)
}
CardImage.displayName = 'Card.Image'
