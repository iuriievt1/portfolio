import { Cards } from './Cards/Cards'
import { Empty } from './Empty/Empty'
import { Loading } from './Loading/Loading'
import { Rail as RailProvider } from './Root/Rail'
import { Title } from './Title/Title'

export { Card, CardContent, CardMetaContext } from './Card'

export const Rail = Object.assign(RailProvider, {
	Title,
	Cards,
	Loading,
	Empty,
})

export type {
	DisplayVisibility,
	RailActions,
	RailContextValue,
	RailDisplay,
	RailFocusState,
	RailHoverState,
	RailMeta,
	RailState,
} from './context'
export {
	useCardAspect,
	useRail,
	useRailDisplay,
	useRailFocus,
	useRailHover,
	useRailMeta,
	useRailState,
} from './hooks/use-rail'
export type {
	BackdropItem,
	CardAspect,
	ContinueItem,
	HighlightsItem,
	LiveItem,
	MultiviewItem,
	PosterItem,
	RailData,
	RailItemData,
	RailVariant,
	RenderCardFn,
	ResponsiveCols,
	ScheduleItem,
	ShowType,
	SponsoredItem,
} from './types'
