import { Dialog as SheetPrimitive } from "@base-ui/react/dialog"
import { cn } from "cn"

function Sheet({ ...props }: SheetPrimitive.Root.Props) {
	return <SheetPrimitive.Root data-slot="sheet" {...props} />
}

function SheetClose({ ...props }: SheetPrimitive.Close.Props) {
	return <SheetPrimitive.Close data-slot="sheet-close" {...props} />
}

export const SHEET_SIDE = {
	LEFT: "left",
	RIGHT: "right",
} as const

type SheetSide = (typeof SHEET_SIDE)[keyof typeof SHEET_SIDE]

const SIDE_CLASS: Readonly<Record<SheetSide, string>> = {
	[SHEET_SIDE.LEFT]: "left-0 border-r data-open:slide-in-from-left data-closed:slide-out-to-left",
	[SHEET_SIDE.RIGHT]: "right-0 border-l data-open:slide-in-from-right data-closed:slide-out-to-right",
}

function SheetContent({
	className,
	side = SHEET_SIDE.LEFT,
	...props
}: SheetPrimitive.Popup.Props & { side?: SheetSide }) {
	return (
		<SheetPrimitive.Portal>
			<SheetPrimitive.Backdrop
				data-slot="sheet-overlay"
				className="fixed inset-0 isolate z-50 bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
			/>
			<SheetPrimitive.Popup
				data-slot="sheet-content"
				className={cn(
					"fixed inset-y-0 z-50 flex h-dvh flex-col overflow-y-auto overscroll-contain bg-background text-sm shadow-lg outline-none duration-200 data-open:animate-in data-closed:animate-out",
					SIDE_CLASS[side],
					className,
				)}
				{...props}
			/>
		</SheetPrimitive.Portal>
	)
}

function SheetTitle({ className, ...props }: SheetPrimitive.Title.Props) {
	return <SheetPrimitive.Title data-slot="sheet-title" className={cn("font-semibold", className)} {...props} />
}

export { Sheet, SheetClose, SheetContent, SheetTitle }
