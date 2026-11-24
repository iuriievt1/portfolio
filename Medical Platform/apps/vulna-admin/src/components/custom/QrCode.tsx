import qrcode from "qrcode-generator"
import { useMemo } from "react"

const AUTOMATIC_VERSION = 0
const ERROR_CORRECTION = "M"
// ISO/IEC 18004
const QUIET_ZONE = 4

interface Props {
	value: string
	label: string
}

export function QrCode({ value, label }: Props) {
	const { size, modules } = useMemo(() => symbolOf(value), [value])
	return (
		<svg className="size-60" viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} shapeRendering="crispEdges">
			<rect className="fill-card" width={size} height={size} />
			<path className="fill-foreground" d={modules} />
		</svg>
	)
}

function symbolOf(value: string): { size: number; modules: string } {
	const code = qrcode(AUTOMATIC_VERSION, ERROR_CORRECTION)
	code.addData(value)
	code.make()
	const count = code.getModuleCount()
	const squares: string[] = []
	for (let row = 0; row < count; row += 1) {
		for (let column = 0; column < count; column += 1) {
			if (code.isDark(row, column)) {
				squares.push(`M${column + QUIET_ZONE} ${row + QUIET_ZONE}h1v1h-1z`)
			}
		}
	}
	return { size: count + 2 * QUIET_ZONE, modules: squares.join("") }
}
