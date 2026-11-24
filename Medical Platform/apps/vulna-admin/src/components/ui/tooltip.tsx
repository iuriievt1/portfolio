import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip"
import { cn } from "cn"

const SIDE_OFFSET = 4

function Tooltip({ ...props }: TooltipPrimitive.Root.Props) {
	return <TooltipPrimitive.Root data-slot="tooltip" {...props} />
}

function TooltipTrigger({ ...props }: TooltipPrimitive.Trigger.Props) {
	return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
}

function TooltipContent({
	className,
	side,
	...props
}: TooltipPrimitive.Popup.Props & Pick<TooltipPrimitive.Positioner.Props, "side">) {
	return (
		<TooltipPrimitive.Portal>
			<TooltipPrimitive.Positioner side={side} sideOffset={SIDE_OFFSET} className="isolate z-50">
				<TooltipPrimitive.Popup
					data-slot="tooltip-content"
					className={cn(
						"z-50 w-fit rounded-md bg-foreground px-3 py-1.5 text-xs text-background data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
						className,
					)}
					{...props}
				/>
			</TooltipPrimitive.Positioner>
		</TooltipPrimitive.Portal>
	)
}

export { Tooltip, TooltipContent, TooltipTrigger }
