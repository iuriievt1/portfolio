'use client'

import DOMPurify from 'dompurify'
import { useTracks } from '../hooks/use-tracks'

export function SubtitleOverlay() {
	const { activeCues } = useTracks()

	if (activeCues.length === 0) return null

	return (
		<div className='pointer-events-none absolute inset-x-0 bottom-12 z-10 flex justify-center px-4 sm:bottom-24 sm:px-8'>
			<div className='max-w-[90%] rounded bg-black/75 px-2 py-1 sm:max-w-[80%] sm:px-4 sm:py-2'>
				{activeCues.map((cue) => (
					<p key={cue.id} className='text-center text-white text-xs leading-snug sm:text-lg'>
						{cue.html ? (
							<span
								// biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized via DOMPurify
								dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(cue.html) }}
							/>
						) : (
							cue.text
						)}
					</p>
				))}
			</div>
		</div>
	)
}
