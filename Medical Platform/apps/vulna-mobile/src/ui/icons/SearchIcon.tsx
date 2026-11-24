import Svg, { Path } from "react-native-svg"
import colors from "../../styles/colors.json"

const SIZE = 20
const OUTLINE =
	"M10.5 3C6.35786 3 3 6.35786 3 10.5C3 14.6421 6.35786 18 10.5 18C12.2831 18 13.9209 17.3777 15.2083 16.3383L19.4343 20.5643C19.7272 20.8572 20.2021 20.8572 20.495 20.5643C20.7879 20.2714 20.7879 19.7965 20.495 19.5036L16.269 15.2776C17.3532 13.9784 18 12.3153 18 10.5C18 6.35786 14.6421 3 10.5 3ZM4.5 10.5C4.5 7.18629 7.18629 4.5 10.5 4.5C13.8137 4.5 16.5 7.18629 16.5 10.5C16.5 13.8137 13.8137 16.5 10.5 16.5C7.18629 16.5 4.5 13.8137 4.5 10.5Z"

export function SearchIcon() {
	return (
		<Svg width={SIZE} height={SIZE} viewBox="0 0 24 24">
			<Path d={OUTLINE} fill={colors["control-primary"]} />
		</Svg>
	)
}
