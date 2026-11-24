import { CARRIER_STATE, USER_STATE } from "@ansora/contracts"
import { PrinterIcon, QrCodeIcon } from "@phosphor-icons/react"
import { useCallback, useState } from "react"
import { LoadFailure } from "@/components/custom/load-failure"
import { NOTICE_TONE, Notice } from "@/components/custom/notice"
import { PageSection } from "@/components/custom/page-section"
import { QrCode } from "@/components/custom/QrCode"
import { RevokeAction } from "@/components/custom/revoke-action"
import { Button } from "@/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { useIssue } from "@/features/users/hooks/use-issue"
import { issueQrCode, revokeQrCode } from "@/features/users/hooks/use-user"
import type { QrCode as IssuedQrCode, User } from "@/features/users/types/user.types"
import cs from "@/i18n/cs.json"
import { CARRIER_ISSUE_MESSAGES, errorMessageOf } from "@/lib/error-message"
import { fillText, formatDateTime } from "@/lib/format"
import { REVOKE_DIALOG_TEXTS } from "@/lib/revoke-dialog-texts"
import type { RequestState } from "@/lib/use-request"

const texts = cs.user.qrCode

interface Props {
	user: User
	qrCodes: RequestState<IssuedQrCode[]>
}

// CAP-005-R04, CAP-005-R05
export function QrCodeSection({ user, qrCodes }: Props) {
	const qrCode = useIssue(useCallback(() => issueQrCode(user.id), [user.id]))
	const [showing, setShowing] = useState(false)
	const issueCode = async () => {
		const issued = await qrCode.start()
		if (issued === undefined) {
			return
		}
		qrCodes.reload()
		setShowing(issued.print_content !== undefined)
	}
	const clearAfterClose = (open: boolean) => {
		if (!open) {
			qrCode.clear()
		}
	}
	const printContent = qrCode.issued?.print_content

	return (
		<PageSection title={texts.heading} description={texts.body}>
			<div className="flex flex-col gap-(--card-p)">
				{qrCode.error === undefined ? null : (
					<Notice tone={NOTICE_TONE.CRITICAL}>{errorMessageOf(qrCode.error, CARRIER_ISSUE_MESSAGES)}</Notice>
				)}
				<ValidQrCode qrCodes={qrCodes} />
				{user.state === USER_STATE.ACTIVE ? (
					<Button variant="outline" onClick={() => void issueCode()} disabled={qrCode.issuing}>
						<QrCodeIcon aria-hidden />
						{qrCode.issuing ? texts.issuing : texts.issue}
					</Button>
				) : null}
			</div>
			<Dialog open={showing} onOpenChange={setShowing} onOpenChangeComplete={clearAfterClose}>
				{printContent === undefined ? null : (
					<DialogContent closeLabel={cs.common.close} className="print:invisible">
						<div data-print-area className="flex flex-col items-center gap-4 print:visible">
							<DialogHeader className="self-stretch">
								<DialogTitle>{texts.heading}</DialogTitle>
								<DialogDescription>{user.display_name}</DialogDescription>
							</DialogHeader>
							<QrCode value={printContent} label={fillText(texts.imageLabel, { name: user.display_name })} />
							{qrCode.issued?.issued_at === undefined ? null : (
								<p className="text-sm text-muted-foreground">
									{fillText(texts.issuedAt, { time: formatDateTime(qrCode.issued.issued_at) })}
								</p>
							)}
						</div>
						<DialogFooter>
							<Button onClick={() => window.print()}>
								<PrinterIcon aria-hidden />
								{texts.print}
							</Button>
						</DialogFooter>
					</DialogContent>
				)}
			</Dialog>
		</PageSection>
	)
}

// CAP-005-R05, CAP-005-S03
function ValidQrCode({ qrCodes }: { qrCodes: RequestState<IssuedQrCode[]> }) {
	if (qrCodes.data === undefined) {
		if (qrCodes.error === undefined) {
			return (
				<div role="status">
					<span className="sr-only">{cs.common.loading}</span>
					<Skeleton aria-hidden className="h-7" />
				</div>
			)
		}
		return <LoadFailure title={errorMessageOf(qrCodes.error)} retryLabel={cs.errors.retry} onRetry={qrCodes.reload} />
	}
	const valid = qrCodes.data.find((code) => code.state === CARRIER_STATE.VALID)
	if (valid === undefined) {
		return <p className="text-sm text-muted-foreground">{texts.none}</p>
	}
	return (
		<div className="flex flex-wrap items-center justify-between gap-3">
			<p className="text-sm">
				{valid.issued_at === undefined
					? texts.valid
					: fillText(texts.validSince, { time: formatDateTime(valid.issued_at) })}
			</p>
			<RevokeAction
				{...REVOKE_DIALOG_TEXTS}
				label={texts.revoke}
				accessibleLabel={undefined}
				heading={texts.revokeHeading}
				body={texts.revokeBody}
				confirmLabel={texts.revoke}
				revoke={() => revokeQrCode(valid.id)}
				onRevoked={qrCodes.reload}
			/>
		</div>
	)
}
