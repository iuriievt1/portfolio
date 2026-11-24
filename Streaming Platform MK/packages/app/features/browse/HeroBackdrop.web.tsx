/** Decorative View All hero backdrop — two blurred brand-blue glows + a bottom scrim that fades into the page bg. Exported 1:1 from Figma. */
export function HeroBackdrop({ className }: { className?: string }) {
	return (
		<svg
			aria-hidden
			className={className}
			viewBox='0 0 1280 300'
			preserveAspectRatio='none'
			fill='none'
			xmlns='http://www.w3.org/2000/svg'
		>
			<g clipPath='url(#va-clip)'>
				<g opacity='0.4' filter='url(#va-blur-0)'>
					<circle cx='1155.67' cy='-108' r='364.333' fill='#1133C9' />
				</g>
				<g opacity='0.4' filter='url(#va-blur-1)'>
					<ellipse cx='122.5' cy='-269' rx='429.5' ry='429' transform='rotate(8.56944 122.5 -269)' fill='#114EC9' />
				</g>
			</g>
			<rect x='1280' y='-102' width='411' height='1280' transform='rotate(90 1280 -102)' fill='url(#va-scrim)' />
			<defs>
				<filter
					id='va-blur-0'
					x='544.533'
					y='-719.133'
					width='1222.27'
					height='1222.27'
					filterUnits='userSpaceOnUse'
					colorInterpolationFilters='sRGB'
				>
					<feGaussianBlur stdDeviation='123.4' />
				</filter>
				<filter
					id='va-blur-1'
					x='-553.847'
					y='-944.87'
					width='1352.69'
					height='1351.74'
					filterUnits='userSpaceOnUse'
					colorInterpolationFilters='sRGB'
				>
					<feGaussianBlur stdDeviation='123.4' />
				</filter>
				<linearGradient id='va-scrim' x1='1280' y1='538' x2='1691' y2='538' gradientUnits='userSpaceOnUse'>
					<stop stopColor='#050C1D' stopOpacity='0' />
					<stop offset='1' stopColor='#050C1D' />
				</linearGradient>
				<clipPath id='va-clip'>
					<rect width='1280' height='333' fill='white' transform='translate(0 -33)' />
				</clipPath>
			</defs>
		</svg>
	)
}
HeroBackdrop.displayName = 'BrowseHeroBackdrop'
