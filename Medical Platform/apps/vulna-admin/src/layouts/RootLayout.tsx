import {
	CloudArrowUpIcon,
	DeviceMobileIcon,
	GearSixIcon,
	ImagesIcon,
	ListBulletsIcon,
	ListMagnifyingGlassIcon,
	SignOutIcon,
	SquaresFourIcon,
	UsersIcon,
} from "@phosphor-icons/react"
import { cn } from "cn"
import { useState } from "react"
import { Outlet, useLocation } from "react-router"
import { AppShell, type ShellNavGroup } from "@/components/custom/app-shell"
import { Button } from "@/components/ui/button"
import { IdleWarning } from "@/features/session/components/IdleWarning"
import { SignedOutPage } from "@/features/session/components/SignedOutPage"
import { StartupScreen } from "@/features/session/components/StartupScreen"
import { useSession } from "@/features/session/hooks/use-session"
import cs from "@/i18n/cs.json"
import { APPEAR } from "@/lib/motion"
import { ROUTES } from "@/lib/routes"
import { type ShellTitle, ShellTitleContext } from "./shell-title"
import { useSidebarCollapsed } from "./use-sidebar-collapsed"

const NAVIGATION: readonly ShellNavGroup[] = [
	{
		label: cs.navigation.groups.operations,
		items: [
			{
				to: `/${ROUTES.ALERTS}`,
				label: cs.alerts.heading,
				icon: <SquaresFourIcon aria-hidden className="size-4" />,
				activeIcon: <SquaresFourIcon aria-hidden weight="fill" className="size-4" />,
			},
			{
				to: `/${ROUTES.ACQUISITIONS}`,
				label: cs.acquisitions.heading,
				icon: <ImagesIcon aria-hidden className="size-4" />,
				activeIcon: <ImagesIcon aria-hidden weight="fill" className="size-4" />,
				sectionPaths: [`/${ROUTES.DRAFTS}`],
			},
			{
				to: `/${ROUTES.DELIVERIES}`,
				label: cs.deliveries.heading,
				icon: <CloudArrowUpIcon aria-hidden className="size-4" />,
				activeIcon: <CloudArrowUpIcon aria-hidden weight="fill" className="size-4" />,
			},
		],
	},
	{
		label: cs.navigation.groups.peopleAndDevices,
		items: [
			{
				to: `/${ROUTES.USERS}`,
				label: cs.users.heading,
				icon: <UsersIcon aria-hidden className="size-4" />,
				activeIcon: <UsersIcon aria-hidden weight="fill" className="size-4" />,
			},
			{
				to: `/${ROUTES.DEVICES}`,
				label: cs.devices.heading,
				icon: <DeviceMobileIcon aria-hidden className="size-4" />,
				activeIcon: <DeviceMobileIcon aria-hidden weight="fill" className="size-4" />,
				sectionPaths: [`/${ROUTES.DEVICE_GROUPS}`],
			},
		],
	},
	{
		label: cs.navigation.groups.setup,
		items: [
			{
				to: `/${ROUTES.CONFIGURATION}`,
				label: cs.configuration.heading,
				icon: <GearSixIcon aria-hidden className="size-4" />,
				activeIcon: <GearSixIcon aria-hidden weight="fill" className="size-4" />,
			},
			{
				to: `/${ROUTES.CODE_LISTS}`,
				label: cs.codeLists.heading,
				icon: <ListBulletsIcon aria-hidden className="size-4" />,
				activeIcon: <ListBulletsIcon aria-hidden weight="fill" className="size-4" />,
			},
			{
				to: `/${ROUTES.AUDIT}`,
				label: cs.audit.heading,
				icon: <ListMagnifyingGlassIcon aria-hidden className="size-4" />,
				activeIcon: <ListMagnifyingGlassIcon aria-hidden weight="fill" className="size-4" />,
			},
		],
	},
]

export function RootLayout() {
	const session = useSession()
	const { pathname } = useLocation()
	const [heading, setHeading] = useState<ShellTitle>({ title: cs.app.name })
	const [sidebarCollapsed, setSidebarCollapsed] = useSidebarCollapsed()

	if (session.ended) {
		return <SignedOutPage />
	}
	if (session.data === undefined) {
		return <StartupScreen failed={session.error !== undefined} onRetry={session.reload} />
	}
	const signOut = () => void session.signOut().catch((error: unknown) => console.warn("sign-out failed", error))
	return (
		<ShellTitleContext value={setHeading}>
			<AppShell
				brand={cs.app.name}
				navigationLabel={cs.navigation.label}
				breadcrumbsLabel={cs.navigation.breadcrumbs}
				skipLabel={cs.navigation.skipToContent}
				toggleLabel={cs.navigation.toggle}
				closeLabel={cs.common.close}
				groups={NAVIGATION}
				title={heading.title}
				parent={heading.parent}
				collapsed={sidebarCollapsed}
				onCollapsedChange={setSidebarCollapsed}
				actions={
					<div className="flex shrink-0 items-center gap-3">
						<span className="hidden text-sm text-muted-foreground sm:inline">{session.data.user.display_name}</span>
						<Button variant="ghost" size="sm" onClick={signOut}>
							<SignOutIcon aria-hidden />
							<span className="max-sm:sr-only">{cs.session.signOut}</span>
						</Button>
					</div>
				}
			>
				<IdleWarning idleExpiresAt={session.data.idle_expires_at} />
				<div key={pathname} className={cn("flex flex-1 flex-col gap-(--section-gap)", APPEAR)}>
					<Outlet />
				</div>
			</AppShell>
		</ShellTitleContext>
	)
}
