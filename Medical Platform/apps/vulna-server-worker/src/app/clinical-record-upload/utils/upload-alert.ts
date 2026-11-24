import { SYSTEM_JOB } from "@ansora/contracts"
import { AUDIT_EVENT_TYPE, AUDIT_OUTCOME, JOB_OBJECT_KIND } from "@ansora/core-server"
import type { SystemJobAuditEvent } from "../../../libs/audit/audit.types"
import type { AlertedFile, CopiedObjectKind, RaisedUploadAlert } from "../types/clinical-record-upload.types"

// stavy-a-mikrocopy.md E126
const UPLOAD_FAILURE_ADVICE =
	"doručení do PACS se tím nezastavilo a ze serveru se nic nesmaže, dokud nahrání neproběhne. " +
	"Po odstranění příčiny nahrání zopakujte."

// CAP-021-R39, CAP-026-R18
function pdfUploadFailureMessageOf(file: AlertedFile): string {
	return `Úložiště klinického záznamu nepřijalo PDF dokumentu ${file.fileId}. PDF zůstává na serveru; ${UPLOAD_FAILURE_ADVICE}`
}

// stavy-a-mikrocopy.md E126, CAP-021-R36
export function uploadFailureMessageOf(file: AlertedFile): string {
	if (file.kind === JOB_OBJECT_KIND.DOCUMENT) {
		return pdfUploadFailureMessageOf(file)
	}
	const what = file.kind === JOB_OBJECT_KIND.IMAGE ? "snímek" : "stránku"
	return (
		`Úložiště klinického záznamu nepřijalo ${what} ${file.fileId} záznamu ${file.recordId}. ` +
		`Snímek zůstává na serveru a zdravotníci ho vidí dál; ${UPLOAD_FAILURE_ADVICE}`
	)
}

// CAP-021-R40, administration.yaml AdministratorAlertKind viewing_copy_generation_failed
export function viewingCopyFailureMessageOf(file: AlertedFile<CopiedObjectKind>): string {
	const what = file.kind === JOB_OBJECT_KIND.IMAGE ? "snímku" : "stránky"
	const kept = file.kind === JOB_OBJECT_KIND.IMAGE ? "snímek" : "stránka"
	return (
		`Při uzavření záznamu ${file.recordId} se nepodařilo vyrobit prohlížecí kopii ${what} ${file.fileId}. ` +
		`Uzavření, nahrání originálu ani doručení to nezastaví a ${kept} má jen originál a náhled.`
	)
}

// CAP-028-R15, datovy-model.md 8
export function uploadAlertEventOf(alert: RaisedUploadAlert): SystemJobAuditEvent {
	return {
		eventType: AUDIT_EVENT_TYPE.ADMINISTRATOR_ALERT_RAISED,
		systemJob: SYSTEM_JOB.CLINICAL_RECORD_WRITE,
		objectId: alert.alertId,
		outcome: AUDIT_OUTCOME.FAILURE,
		details: {
			alert_id: alert.alertId,
			alert_kind: alert.kind,
			message: alert.message,
			task_id: alert.taskId,
			object_kind: alert.file.kind,
			object_id: alert.file.fileId,
		},
	}
}
