import { type ReactNode, type RefObject, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import cs from "@/i18n/cs.json"

export type PerformAction = (act: () => Promise<unknown>) => Promise<void>

interface Props {
	trigger: ReactNode
	title: string
	description: string
	returnFocus: RefObject<HTMLElement | null>
	onDone: () => void
	children: (perform: PerformAction) => ReactNode
}

// DESIGN.md 9.5
export function DeliveryActionDialog({ trigger, title, description, returnFocus, onDone, children }: Props) {
	const [open, setOpen] = useState(false)
	const [isActing, setIsActing] = useState(false)

	const changeOpen = (next: boolean) => {
		if (!isActing) {
			setOpen(next)
		}
	}

	const reloadAfterClose = (opened: boolean) => {
		if (!opened) {
			onDone()
		}
	}

	const perform: PerformAction = async (act) => {
		setIsActing(true)
		try {
			await act()
			setOpen(false)
		} finally {
			setIsActing(false)
		}
	}

	return (
		<>
			<Button size="sm" variant="outline" onClick={() => setOpen(true)}>
				{trigger}
			</Button>
			<Dialog open={open} onOpenChange={changeOpen} onOpenChangeComplete={reloadAfterClose}>
				<DialogContent closeLabel={cs.common.close} className="sm:max-w-lg" finalFocus={returnFocus}>
					<DialogHeader>
						<DialogTitle>{title}</DialogTitle>
						<DialogDescription>{description}</DialogDescription>
					</DialogHeader>
					{children(perform)}
				</DialogContent>
			</Dialog>
		</>
	)
}
