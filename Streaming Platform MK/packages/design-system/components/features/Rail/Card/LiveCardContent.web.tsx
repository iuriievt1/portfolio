'use client'

import { cn } from '@pkg/utils'
import Image from 'next/image'
import { useCallback, useState } from 'react'
import { useCardMeta } from './context'
import { CardFrame } from './Frame'
import { CardLiveInfo } from './LiveInfo'
import { CardOuterMeta } from './OuterMeta'
import { CardOuterTitle } from './OuterTitle'
import { CardProgress } from './Progress'

function LiveImage() {
	const { item } = useCardMeta()
	const [loaded, setLoaded] = useState(false)
	const handleLoad = useCallback(() => setLoaded(true), [])

	if (!item.imageUrl) {
		const label = item.variant === 'live' ? item.live.channel : item.title

		return (
			<div className='relative flex aspect-live-image h-full shrink-0 items-center justify-center overflow-hidden rounded-md bg-white/[0.08]'>
				<span className='max-w-full truncate px-3 text-center text-badge text-white/80'>{label}</span>
			</div>
		)
	}

	return (
		<div className='relative aspect-live-image h-full shrink-0 overflow-hidden rounded-md'>
			{!loaded && (
				<div className='absolute inset-0 overflow-hidden bg-surface'>
					<div className='absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/[0.14] to-transparent' />
				</div>
			)}
			<Image
				src={item.imageUrl}
				alt={item.title}
				fill
				sizes='(max-width: 767px) 30vw, (max-width: 1535px) 15vw, 200px'
				className={cn('object-cover transition-opacity duration-300', loaded ? 'opacity-100' : 'opacity-0')}
				draggable={false}
				onLoad={handleLoad}
			/>
		</div>
	)
}

export function LiveCardContent() {
	return (
		<>
			<CardFrame aspect='live'>
				<LiveImage />
				<CardLiveInfo className='relative min-h-0'>
					<CardProgress className='mt-auto w-full md:mt-card-live-progress' />
				</CardLiveInfo>
			</CardFrame>
			<CardOuterMeta>
				<CardOuterTitle />
			</CardOuterMeta>
		</>
	)
}
