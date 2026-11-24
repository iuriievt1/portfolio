import type { RailData, RailVariant } from '@pkg/design-system'
import type { MediaItem } from '../../types/media'
import { toRailItem } from '../home/mappers'

export function toGenreRailData(title: string, variant: RailVariant, items: MediaItem[]): RailData {
	return {
		id: 'genre-grid',
		title,
		variant,
		items: items.map((item) => toRailItem(item, variant)),
		showCardTitle: true,
	}
}
