import { createBrowserRouter, Navigate, RouterProvider } from "react-router"
import { AcquisitionPage } from "./features/acquisitions/components/AcquisitionPage"
import { AcquisitionsPage } from "./features/acquisitions/components/AcquisitionsPage"
import { AlertsPage } from "./features/alerts/components/AlertsPage"
import { AuditPage } from "./features/audit/components/AuditPage"
import { CodeListPage } from "./features/code-lists/components/CodeListPage"
import { CodeListsPage } from "./features/code-lists/components/CodeListsPage"
import { ConfigurationPage } from "./features/configuration/components/ConfigurationPage"
import { DeliveriesPage } from "./features/deliveries/components/DeliveriesPage"
import { DeliveryPage } from "./features/deliveries/components/DeliveryPage"
import { DeviceGroupPage } from "./features/device-groups/components/DeviceGroupPage"
import { DeviceGroupsPage } from "./features/device-groups/components/DeviceGroupsPage"
import { DevicePage } from "./features/devices/components/DevicePage"
import { DevicesPage } from "./features/devices/components/DevicesPage"
import { DraftsPage } from "./features/drafts/components/DraftsPage"
import { OrphanedObjectsPage } from "./features/orphaned-objects/components/OrphanedObjectsPage"
import { UserCardsPage } from "./features/users/components/UserCardsPage"
import { UserPage } from "./features/users/components/UserPage"
import { UsersPage } from "./features/users/components/UsersPage"
import { RootLayout } from "./layouts/RootLayout"
import { ROUTES } from "./lib/routes"

const router = createBrowserRouter([
	{
		path: ROUTES.ROOT,
		Component: RootLayout,
		children: [
			{ index: true, element: <Navigate to={ROUTES.ALERTS} replace /> },
			{ path: ROUTES.ALERTS, Component: AlertsPage },
			{ path: ROUTES.DRAFTS, Component: DraftsPage },
			{ path: ROUTES.ORPHANED_OBJECTS, Component: OrphanedObjectsPage },
			{
				path: ROUTES.ACQUISITIONS,
				children: [
					{ index: true, Component: AcquisitionsPage },
					{ path: ROUTES.ACQUISITION, Component: AcquisitionPage },
				],
			},
			{
				path: ROUTES.DELIVERIES,
				children: [
					{ index: true, Component: DeliveriesPage },
					{ path: ROUTES.DELIVERY, Component: DeliveryPage },
				],
			},
			{
				path: ROUTES.USERS,
				children: [
					{ index: true, Component: UsersPage },
					{ path: ROUTES.USER, Component: UserPage },
					{ path: `${ROUTES.USER}/${ROUTES.CARDS}`, Component: UserCardsPage },
				],
			},
			{
				path: ROUTES.DEVICES,
				children: [
					{ index: true, Component: DevicesPage },
					{ path: ROUTES.DEVICE, Component: DevicePage },
				],
			},
			{
				path: ROUTES.DEVICE_GROUPS,
				children: [
					{ index: true, Component: DeviceGroupsPage },
					{ path: ROUTES.DEVICE_GROUP, Component: DeviceGroupPage },
				],
			},
			{ path: ROUTES.CONFIGURATION, Component: ConfigurationPage },
			{
				path: ROUTES.CODE_LISTS,
				children: [
					{ index: true, Component: CodeListsPage },
					{ path: ROUTES.CODE_LIST, Component: CodeListPage },
				],
			},
			{ path: ROUTES.AUDIT, Component: AuditPage },
		],
	},
])

export function App() {
	return <RouterProvider router={router} />
}
