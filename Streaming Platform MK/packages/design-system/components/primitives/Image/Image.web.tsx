'use client'

import { cn } from '@pkg/utils'
import Image from 'next/image'
import { useCallback, useState } from 'react'
import type { ImageProps } from './types'

export function DSImage({
	src,
	alt,
	aspectRatio,
	fill: fillContainer,
	errorLabel = 'Failed to load',
	className,
	placeholderClassName,
}: ImageProps) {
	const [loaded, setLoaded] = useState(false)
	const [error, setError] = useState(false)

	const handleLoad = useCallback(() => setLoaded(true), [])
	const handleError = useCallback(() => setError(true), [])

	const aspectClass = aspectRatio === '2/3' ? 'aspect-poster' : aspectRatio === '16/9' ? 'aspect-video' : undefined

	if (error) {
		return (
			<div
				className={cn(
					'flex items-center justify-center bg-surface-2',
					fillContainer && 'absolute inset-0',
					aspectClass,
					className,
				)}
			>
				<span className='text-muted-2 text-sm'>{errorLabel}</span>
			</div>
		)
	}

	return (
		<div className={cn('relative overflow-hidden', fillContainer && 'absolute inset-0', aspectClass, className)}>
			{!loaded && <div className={cn('absolute inset-0 animate-pulse bg-surface', placeholderClassName)} />}
			<Image
				src={src}
				alt={alt}
				fill
				sizes='(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw'
				draggable={false}
				onLoad={handleLoad}
				onError={handleError}
				className={cn('object-cover transition-opacity duration-normal', loaded ? 'opacity-100' : 'opacity-0')}
			/>
		</div>
	)
}
DSImage.displayName = 'Image'
