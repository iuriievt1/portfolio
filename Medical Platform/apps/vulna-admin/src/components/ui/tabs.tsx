import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"
import { cn } from "cn"
import { APPEAR } from "@/lib/motion"

export const TABS_LIST_CLASS =
	"flex scroll-px-(--card-p) gap-1 overflow-x-auto overscroll-x-contain border-b px-(--card-p) [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
const TAB_CLASS =
	"-mb-px flex shrink-0 items-center gap-1.5 border-b-2 border-transparent px-2 py-2.5 text-sm whitespace-nowrap text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
export const TAB_LINK_CLASS = cn(
	TAB_CLASS,
	"aria-[current=page]:border-primary aria-[current=page]:font-medium aria-[current=page]:text-foreground",
)

function Tabs({ className, ...props }: TabsPrimitive.Root.Props) {
	return <TabsPrimitive.Root data-slot="tabs" className={cn("flex flex-col", className)} {...props} />
}

function TabsList({ className, ...props }: TabsPrimitive.List.Props) {
	return <TabsPrimitive.List data-slot="tabs-list" className={cn(TABS_LIST_CLASS, className)} {...props} />
}

function TabsTab({ className, ...props }: TabsPrimitive.Tab.Props) {
	return (
		<TabsPrimitive.Tab
			data-slot="tabs-tab"
			className={cn(
				TAB_CLASS,
				"data-active:border-primary data-active:font-medium data-active:text-foreground",
				className,
			)}
			{...props}
		/>
	)
}

function TabsPanel({ className, ...props }: TabsPrimitive.Panel.Props) {
	return <TabsPrimitive.Panel data-slot="tabs-panel" className={cn("outline-none", APPEAR, className)} {...props} />
}

export { Tabs, TabsList, TabsPanel, TabsTab }
