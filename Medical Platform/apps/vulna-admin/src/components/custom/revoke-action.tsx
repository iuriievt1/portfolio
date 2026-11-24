import { type ReactNode, useRef, useState } from "react"
import { NOTICE_TONE, Notice } from "@/components/custom/notice"
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
	label: string
	accessibleLabel: string | undefined
	heading: string
	body: string
	confirmLabel: string
	pendingLabel: string
	cancelLabel: string
	closeLabel: string
	failureMessageOf: (failure: unknown) => string
	revoke: () => Promise<unknown>
	onRevoked: () => void
	children?: ReactNode
}

// DESIGN.md 8.2, DESIGN.md 9.5
export function RevokeAction({
	label,
	accessibleLabel,
	heading,
	body,
	confirmLabel,
	pendingLabel,
	cancelLabel,
	closeLabel,
	failureMessageOf,
	revoke,
	onRevoked,
	children,
}: Props) {
	const [open, setOpen] = useState(false)
	const [revoking, setRevoking] = useState(false)
	const [failure, setFailure] = useState<unknown>(undefined)
	const revoked = useRef(false)

	const openDialog = () => {
		setFailure(undefined)
		setOpen(true)
	}

	const changeOpen = (next: boolean) => {
		if (!revoking) {
			setOpen(next)
		}
	}

	const reloadAfterClose = (opened: boolean) => {
		if (opened || !revoked.current) {
			return
		}
		revoked.current = false
		onRevoked()
	}

	const confirm = async () => {
		setRevoking(true)
		setFailure(undefined)
		try {
			await revoke()
			revoked.current = true
			setOpen(false)
		} catch (error) {
			setFailure(error)
		} finally {
			setRevoking(false)
		}
	}

	return (
		<>
			<Button variant="outline" size="sm" aria-label={accessibleLabel} onClick={openDialog}>
				{label}
			</Button>
			<Dialog open={open} onOpenChange={changeOpen} onOpenChangeComplete={reloadAfterClose}>
				<DialogContent closeLabel={closeLabel}>
					<DialogHeader>
						<DialogTitle>{heading}</DialogTitle>
						<DialogDescription>{body}</DialogDescription>
					</DialogHeader>
					{children}
					{failure === undefined ? null : <Notice tone={NOTICE_TONE.CRITICAL}>{failureMessageOf(failure)}</Notice>}
					<DialogFooter>
						<Button variant="outline" autoFocus disabled={revoking} onClick={() => setOpen(false)}>
							{cancelLabel}
						</Button>
						<Button variant="destructive" disabled={revoking} onClick={() => void confirm()}>
							{revoking ? pendingLabel : confirmLabel}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	)
}
