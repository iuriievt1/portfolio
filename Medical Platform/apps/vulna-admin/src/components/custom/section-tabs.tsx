import { NavLink } from "react-router"
import { TAB_LINK_CLASS, TABS_LIST_CLASS } from "@/components/ui/tabs"

interface SectionTab {
	to: string
	label: string
}

interface Props {
	label: string
	tabs: readonly SectionTab[]
}

// DESIGN.md 9.1, 9.2
export function SectionTabs({ label, tabs }: Props) {
	return (
		<nav aria-label={label} className={TABS_LIST_CLASS}>
			{tabs.map((tab) => (
				<NavLink key={tab.to} to={tab.to} end className={TAB_LINK_CLASS}>
					{tab.label}
				</NavLink>
			))}
		</nav>
	)
}
