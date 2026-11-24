import type { SVGProps } from 'react'

/** The `!` mark inside the error diamond. Rendered inside a 112×112px div rotated 45deg. */
export function ErrorIcon(props: SVGProps<SVGSVGElement>) {
	return (
		<svg width='8' height='30' viewBox='0 0 8 30' fill='none' xmlns='http://www.w3.org/2000/svg' {...props}>
			<path
				d='M6.41602 24.291V29.333H1.375V24.291H6.41602ZM6.41602 20.166H1.375L0 0H7.79102L6.41602 20.166Z'
				fill='#FF5C5C'
			/>
		</svg>
	)
}
