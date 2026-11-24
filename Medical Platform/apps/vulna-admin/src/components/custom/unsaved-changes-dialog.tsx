import type { Blocker } from "react-router"
import { Button } from "@/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog"

interface Props {
	blocker: Blocker
	heading: string
	body: string
	stayLabel: string
	leaveLabel: string
	closeLabel: string
}

// DESIGN.md 9.4, 9.5
export function UnsavedChangesDialog({ blocker, heading, body, stayLabel, leaveLabel, closeLabel }: Props) {
	const stay = () => blocker.reset?.()
	return (
		<Dialog open={blocker.state === "blocked"} onOpenChange={(open) => (open ? undefined : stay())}>
			<DialogContent closeLabel={closeLabel}>
				<DialogHeader>
					<DialogTitle>{heading}</DialogTitle>
					<DialogDescription>{body}</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<Button variant="outline" autoFocus onClick={stay}>
						{stayLabel}
					</Button>
					<Button variant="destructive" onClick={() => blocker.proceed?.()}>
						{leaveLabel}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
