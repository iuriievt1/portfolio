import { CardBadges } from './Badges'
import { CardDateBadge } from './DateBadge'
import { CardDescription } from './Description'
import { CardEpisodeLabel } from './EpisodeLabel'
import { CardFrame } from './Frame'
import { CardGradient } from './Gradient'
import { CardImage } from './Image'
import { CardLiveInfo } from './LiveInfo'
import { CardMetadata } from './Metadata'
import { CardMetaLine } from './MetaLine'
import { CardMultiviewBadge } from './MultiviewBadge'
import { CardOuterMeta } from './OuterMeta'
import { CardOuterTitle } from './OuterTitle'
import { CardProgress } from './Progress'
import { CardRoot } from './Root'
import { CardSubtitle } from './Subtitle'
import { CardTitle } from './Title'

export const Card = Object.assign(CardRoot, {
	Frame: CardFrame,
	Image: CardImage,
	Gradient: CardGradient,
	Badges: CardBadges,
	Progress: CardProgress,
	EpisodeLabel: CardEpisodeLabel,
	LiveInfo: CardLiveInfo,
	Metadata: CardMetadata,
	Title: CardTitle,
	Subtitle: CardSubtitle,
	Description: CardDescription,
	OuterMeta: CardOuterMeta,
	OuterTitle: CardOuterTitle,
	MetaLine: CardMetaLine,
	DateBadge: CardDateBadge,
	MultiviewBadge: CardMultiviewBadge,
})

export type { CardMeta } from './context'
export { CardMetaContext, useCardMeta } from './context'
export { ViewAllCard } from './ViewAllCard'
export { CardContent } from './variants'
