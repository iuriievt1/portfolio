import type { SVGProps } from 'react'

/** Checkmark used for selected items in Quality / Speed / CC menus. */
export function CheckIcon(props: SVGProps<SVGSVGElement>) {
	return (
		<svg width='19' height='15' viewBox='0 0 19 15' fill='none' xmlns='http://www.w3.org/2000/svg' {...props}>
			<g filter='url(#filter0_d_3015_2359)'>
				<path
					d='M17.463 0.360505C16.9824 -0.120168 16.2614 -0.120168 15.7807 0.360505L6.76807 9.37312L3.04286 5.64791C2.56219 5.16723 1.84118 5.16723 1.3605 5.64791C0.879832 6.12858 0.879832 6.84959 1.3605 7.33026L5.9269 11.8967C6.16723 12.137 6.40757 12.2572 6.76807 12.2572C7.12858 12.2572 7.36892 12.137 7.60925 11.8967L17.463 2.04286C17.9437 1.56219 17.9437 0.841178 17.463 0.360505Z'
					fill='white'
				/>
			</g>
			<defs>
				<filter
					id='filter0_d_3015_2359'
					x='0'
					y='0'
					width='18.8235'
					height='14.2568'
					filterUnits='userSpaceOnUse'
					colorInterpolationFilters='sRGB'
				>
					<feFlood floodOpacity='0' result='BackgroundImageFix' />
					<feColorMatrix
						in='SourceAlpha'
						type='matrix'
						values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0'
						result='hardAlpha'
					/>
					<feOffset dy='1' />
					<feGaussianBlur stdDeviation='0.5' />
					<feComposite in2='hardAlpha' operator='out' />
					<feColorMatrix type='matrix' values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.5 0' />
					<feBlend mode='normal' in2='BackgroundImageFix' result='effect1_dropShadow_3015_2359' />
					<feBlend mode='normal' in='SourceGraphic' in2='effect1_dropShadow_3015_2359' result='shape' />
				</filter>
			</defs>
		</svg>
	)
}
