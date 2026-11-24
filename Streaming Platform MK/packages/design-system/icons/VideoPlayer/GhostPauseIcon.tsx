import type { SVGProps } from 'react'

/**
 * Big center pause icon for the ghost overlay (appears for 2s when user presses pause).
 * Self-contained at 113×113 with bars already positioned correctly within the viewBox.
 * Wrap in a circular container with semi-transparent background.
 */
export function GhostPauseIcon(props: SVGProps<SVGSVGElement>) {
	return (
		<svg width='113' height='113' viewBox='0 0 113 113' fill='none' xmlns='http://www.w3.org/2000/svg' {...props}>
			<rect x='29.7241' y='14.1379' width='19.6386' height='81.8276' fill='white' />
			<rect x='62.4551' y='14.1379' width='19.6386' height='81.8276' fill='white' />
		</svg>
	)
}
