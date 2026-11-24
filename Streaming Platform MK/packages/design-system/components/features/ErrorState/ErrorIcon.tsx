import { PALETTE, rgb } from '../../../tokens'

const errorColor = rgb(PALETTE.red)

export function ErrorIcon({ size = 74 }: { size?: number }) {
	return (
		<svg width={size} height={size} viewBox='0 0 74 74' fill='none' xmlns='http://www.w3.org/2000/svg'>
			<g clipPath='url(#error-icon-clip)'>
				<path
					d='M36.917 2.77032C55.7695 2.7705 71.0625 18.0561 71.0625 36.9168C71.0623 55.7778 55.778 71.0621 36.917 71.0623C18.0559 71.0623 2.77068 55.7779 2.77051 36.9168C2.77051 18.0556 18.0558 2.77032 36.917 2.77032Z'
					stroke={errorColor}
					strokeWidth='5.04167'
				/>
				<path
					fillRule='evenodd'
					clipRule='evenodd'
					d='M39.416 46.2913V51.3333H34.375V46.2913H39.416ZM39.416 42.1663H34.375L33 22.0003H40.791L39.416 42.1663Z'
					fill={errorColor}
				/>
			</g>
			<defs>
				<clipPath id='error-icon-clip'>
					<rect width='73.3333' height='73.3333' fill='white' />
				</clipPath>
			</defs>
		</svg>
	)
}
