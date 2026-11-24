import { CaretDownIcon } from "@phosphor-icons/react"
import { cn } from "cn"
import type * as React from "react"

function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
	return (
		<div data-slot="native-select-wrapper" className="relative w-full has-[select:disabled]:opacity-50">
			<select
				data-slot="native-select"
				className={cn(
					"h-8 w-full min-w-0 appearance-none rounded-lg border border-input bg-transparent py-1 pr-8 pl-2.5 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30",
					className,
				)}
				{...props}
			/>
			<CaretDownIcon
				aria-hidden
				className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground"
			/>
		</div>
	)
}

export { NativeSelect }
