import { type DiagramView, SILHOUETTE_OUTLINE, SILHOUETTE_PART, type SilhouettePath } from "@ansora/contracts"
import { G, Path } from "react-native-svg"
import colors from "../../../styles/colors.json"

interface Props {
	view: DiagramView
}

// CAP-016-R07, clinical-workflow.yaml bodyDiagramBackground
export function BodySilhouette({ view }: Props) {
	return (
		<G transform={`translate(${view.frame.x} ${view.frame.y})`} pointerEvents="none">
			{view.silhouette.map((part, index) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: fixed drawing
				<SilhouetteShape key={index} part={part} />
			))}
		</G>
	)
}

function SilhouetteShape({ part }: { part: SilhouettePath }) {
	switch (part.part) {
		case SILHOUETTE_PART.FILL:
			return <Path d={part.path} fill={colors.card} />
		case SILHOUETTE_PART.OUTLINE:
			return (
				<Path
					d={part.path}
					fill="none"
					stroke={colors.foreground}
					strokeWidth={SILHOUETTE_OUTLINE.WIDTH}
					strokeMiterlimit={SILHOUETTE_OUTLINE.MITER_LIMIT}
				/>
			)
		case SILHOUETTE_PART.DETAIL:
			return <Path d={part.path} fill={colors.foreground} />
		default:
			return part.part satisfies never
	}
}
