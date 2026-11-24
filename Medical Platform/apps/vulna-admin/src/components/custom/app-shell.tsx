import { mergeProps } from "@base-ui/react/merge-props"
import { CaretRightIcon, SidebarSimpleIcon, XIcon } from "@phosphor-icons/react"
import { cn } from "cn"
import { type ReactNode, useEffect, useRef, useState } from "react"
import { Link, NavLink, type NavLinkProps, useLocation } from "react-router"
import { Button } from "@/components/ui/button"
import { Sheet, SheetClose, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useMediaQuery } from "@/lib/use-media-query"

interface ShellNavItem {
	to: string
	label: string
	icon: ReactNode
	activeIcon: ReactNode
	sectionPaths?: readonly string[]
}

export interface ShellNavGroup {
	label: string
	items: readonly ShellNavItem[]
}

export interface ShellCrumb {
	to: string
	label: string
}

interface Props {
	brand: string
	navigationLabel: string
	breadcrumbsLabel: string
	skipLabel: string
	toggleLabel: string
	closeLabel: string
	groups: readonly ShellNavGroup[]
	title: string
	parent?: ShellCrumb
	collapsed: boolean
	onCollapsedChange: (collapsed: boolean) => void
	actions: ReactNode
	children: ReactNode
}

const MAIN_ID = "main"
const SIDEBAR_ID = "sidebar"
// DESIGN.md 5.7
const WIDE_LAYOUT_QUERY = "(min-width: 48rem)"
const NAV_TOOLTIP_DELAY_MILLISECONDS = 0

const BRAND_ROW =
	"flex h-(--topbar-height) shrink-0 items-center px-4 text-sm font-semibold text-sidebar-accent-foreground"
const NAV_ITEM =
	"flex h-(--nav-row-h) items-center gap-2 rounded-md px-2 text-sm whitespace-nowrap transition-colors outline-hidden hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring"
const NAV_ITEM_COLLAPSED = "justify-center px-0"
const NAV_ITEM_ACTIVE = "bg-sidebar-accent font-medium text-sidebar-accent-foreground"

// DESIGN.md 5.2, 8.7
export function AppShell(props: Props) {
	const wide = useMediaQuery(WIDE_LAYOUT_QUERY)
	const [drawerOpen, setDrawerOpen] = useState(false)
	const toggleButton = useRef<HTMLButtonElement>(null)

	useEffect(() => {
		if (wide) {
			setDrawerOpen(false)
		}
	}, [wide])

	const toggleNavigation = () => {
		if (wide) {
			props.onCollapsedChange(!props.collapsed)
			return
		}
		setDrawerOpen(true)
	}

	return (
		<div className="flex min-h-svh bg-background max-sm:[--section-gap:1rem] print:block print:[body:has([data-print-area])_&]:hidden">
			<a
				href={`#${MAIN_ID}`}
				className="sr-only rounded-md bg-card px-3 py-2 text-sm focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:shadow-md"
			>
				{props.skipLabel}
			</a>
			<aside
				id={SIDEBAR_ID}
				className={cn(
					"hidden shrink-0 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 ease-linear md:flex print:hidden",
					props.collapsed ? "w-(--sidebar-width-icon)" : "w-(--sidebar-width)",
				)}
			>
				<div className={BRAND_ROW}>{props.collapsed ? null : props.brand}</div>
				<Navigation label={props.navigationLabel} groups={props.groups} collapsed={props.collapsed} />
			</aside>
			<Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
				<SheetContent
					finalFocus={toggleButton}
					className="w-(--sidebar-width-mobile) border-sidebar-border bg-sidebar text-sidebar-foreground"
				>
					<div className={cn(BRAND_ROW, "justify-between pr-2")}>
						<SheetTitle>{props.brand}</SheetTitle>
						<SheetClose render={<Button variant="ghost" size="icon-sm" />}>
							<XIcon aria-hidden />
							<span className="sr-only">{props.closeLabel}</span>
						</SheetClose>
					</div>
					<Navigation
						label={props.navigationLabel}
						groups={props.groups}
						collapsed={false}
						onNavigate={() => setDrawerOpen(false)}
					/>
				</SheetContent>
			</Sheet>
			<div className="flex min-w-0 flex-1 flex-col">
				{/* biome-ignore lint/a11y/noInteractiveElementToNoninteractiveRole: DESIGN.md 8.7 */}
				<header
					role="banner"
					className="flex h-(--topbar-height) shrink-0 items-center gap-2 border-b px-(--section-gap) print:hidden"
				>
					<Button
						ref={toggleButton}
						variant="ghost"
						size="icon-sm"
						aria-label={props.toggleLabel}
						aria-controls={wide ? SIDEBAR_ID : undefined}
						aria-expanded={wide ? !props.collapsed : drawerOpen}
						onClick={toggleNavigation}
					>
						<SidebarSimpleIcon aria-hidden />
					</Button>
					<TopbarTitle title={props.title} parent={props.parent} breadcrumbsLabel={props.breadcrumbsLabel} />
					{props.actions}
				</header>
				<main
					id={MAIN_ID}
					tabIndex={-1}
					className="flex flex-1 flex-col gap-(--section-gap) p-(--section-gap) outline-hidden"
				>
					{props.children}
				</main>
			</div>
		</div>
	)
}

interface NavigationProps {
	label: string
	groups: readonly ShellNavGroup[]
	collapsed: boolean
	onNavigate?: () => void
}

function Navigation({ label, groups, collapsed, onNavigate }: NavigationProps) {
	return (
		<nav aria-label={label} className="flex flex-col gap-4 px-2 pt-1">
			{groups.map((group) => (
				<NavigationGroup key={group.label} group={group} collapsed={collapsed} onNavigate={onNavigate} />
			))}
		</nav>
	)
}

interface NavigationGroupProps {
	group: ShellNavGroup
	collapsed: boolean
	onNavigate: (() => void) | undefined
}

function NavigationGroup({ group, collapsed, onNavigate }: NavigationGroupProps) {
	return (
		<div className="flex flex-col gap-1">
			<span className={cn("label-caps px-2 text-xs font-medium text-muted-foreground", collapsed && "sr-only")}>
				{group.label}
			</span>
			{group.items.map((item) => (
				<Tooltip key={item.to} disabled={!collapsed}>
					<TooltipTrigger
						delay={NAV_TOOLTIP_DELAY_MILLISECONDS}
						render={(triggerProps) => (
							<NavigationLink
								{...mergeProps<"a">(triggerProps, { onClick: onNavigate })}
								item={item}
								collapsed={collapsed}
							/>
						)}
					/>
					<TooltipContent side="right">{item.label}</TooltipContent>
				</Tooltip>
			))}
		</div>
	)
}

interface NavigationLinkProps extends Omit<NavLinkProps, "to" | "className" | "children"> {
	item: ShellNavItem
	collapsed: boolean
}

function isWithin(pathname: string, path: string): boolean {
	return pathname === path || pathname.startsWith(`${path}/`)
}

function NavigationLink({ item, collapsed, ...linkProps }: NavigationLinkProps) {
	const { pathname } = useLocation()
	const isInSection = (item.sectionPaths ?? []).some((path) => isWithin(pathname, path))
	return (
		<NavLink
			{...linkProps}
			to={item.to}
			className={({ isActive }) =>
				cn(NAV_ITEM, collapsed && NAV_ITEM_COLLAPSED, (isActive || isInSection) && NAV_ITEM_ACTIVE)
			}
		>
			{({ isActive }) => (
				<>
					{isActive || isInSection ? item.activeIcon : item.icon}
					<span className={collapsed ? "sr-only" : undefined}>{item.label}</span>
				</>
			)}
		</NavLink>
	)
}

function TopbarTitle({
	title,
	parent,
	breadcrumbsLabel,
}: {
	title: string
	parent: ShellCrumb | undefined
	breadcrumbsLabel: string
}) {
	return (
		<div className="flex min-w-0 flex-1 items-center gap-2">
			{parent === undefined ? null : (
				<nav aria-label={breadcrumbsLabel} className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
					<Link
						to={parent.to}
						className="rounded-sm hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
					>
						{parent.label}
					</Link>
					<CaretRightIcon aria-hidden className="size-3.5" />
				</nav>
			)}
			<h1 className="truncate text-base font-semibold">{title}</h1>
		</div>
	)
}
