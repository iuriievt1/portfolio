import Svg, { Path } from "react-native-svg"
import colors from "../../styles/colors.json"

const SIZE = 24
const OUTLINE =
	"M140,128a12,12,0,1,1-12-12A12,12,0,0,1,140,128Zm56-12a12,12,0,1,0,12,12A12,12,0,0,0,196,116ZM60,116a12,12,0,1,0,12,12A12,12,0,0,0,60,116Z"

interface Props {
	color?: string
}

export function MoreIcon({ color = colors.foreground }: Props) {
	return (
		<Svg width={SIZE} height={SIZE} viewBox="0 0 256 256">
			<Path d={OUTLINE} fill={color} />
		</Svg>
	)
}
