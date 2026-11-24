'use client'

import type { RailData } from '@pkg/design-system'
import { Rail } from '@pkg/design-system'

export function RailClient({ rail }: { rail: RailData }) {
	return (
		<Rail id={rail.id} rail={rail}>
			<Rail.Title title={rail.title} viewAllHref={rail.viewAllHref} viewAllLabel={rail.viewAllLabel} />
			<Rail.Cards items={rail.items} viewAllHref={rail.viewAllHref} />
		</Rail>
	)
}
