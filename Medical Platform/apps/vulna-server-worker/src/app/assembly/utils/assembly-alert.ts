import { ADMINISTRATOR_ALERT_KIND, SYSTEM_JOB } from "@ansora/contracts"
import { AUDIT_EVENT_TYPE, AUDIT_OUTCOME } from "@ansora/core-server"
import type { SystemJobAuditEvent } from "../../../libs/audit/audit.types"
import { ASSEMBLY_FAILURE, ASSEMBLY_PAUSE } from "../constants/assembly.constants"
import type { AssemblyFailureReason, AssemblyPause, FailedAssembly, RaisedAssemblyAlert } from "../types/assembly.types"

// CAP-022-R11, CAP-028-R15
const REASON_TEXT: Readonly<Record<AssemblyFailureReason, string>> = {
	[ASSEMBLY_FAILURE.PATIENT_ID_SYSTEM_UNSET]: "není nastavený systém identifikátoru pacienta pro Patient ID",
	[ASSEMBLY_FAILURE.PATIENT_ID_MISSING]: "pacient nemá platný identifikátor pro Patient ID",
	[ASSEMBLY_FAILURE.PATIENT_ID_AMBIGUOUS]: "pacient má pro Patient ID víc platných identifikátorů",
	[ASSEMBLY_FAILURE.INVALID_VALUE]: "některý údaj záznamu nejde zapsat do objektu DICOM",
	[ASSEMBLY_FAILURE.UNKNOWN_BODY_SITE]: "poloha rány není v mapovací tabulce schématu",
	[ASSEMBLY_FAILURE.UNSUPPORTED_LANGUAGE]: "výchozí jazyk instance nemá název, který objekt potřebuje",
	[ASSEMBLY_FAILURE.UNSUPPORTED_IMAGE]: "snímek není baseline JPEG, který jde uložit do DICOM beze změny",
	[ASSEMBLY_FAILURE.ROTATED_IMAGE]: "snímek má v Exif jinou orientaci než 1",
	[ASSEMBLY_FAILURE.UNSUPPORTED_DOCUMENT]: "výstup rozpoznání textu není PDF",
	[ASSEMBLY_FAILURE.OCR_FAILED]:
		"rozpoznání textu selhalo i po opakování a PDF bez textové vrstvy se do PACS neodesílá",
	[ASSEMBLY_FAILURE.CLINICAL_RECORD_MISSING]: "úložiště klinického záznamu uzavřený záznam nevydalo",
	[ASSEMBLY_FAILURE.CLINICAL_RECORD_MISMATCH]:
		"uzavřený záznam v úložišti klinického záznamu nesouhlasí se záznamem na serveru",
	[ASSEMBLY_FAILURE.MISSING_BUFFER]: "bajty souboru záznamu na serveru chybí",
	[ASSEMBLY_FAILURE.INCOMPLETE_RECORD]: "záznam na serveru nemá úplné soubory nebo údaje",
	[ASSEMBLY_FAILURE.UNKNOWN_CODE]: "položka číselníku, kterou záznam nese, na serveru chybí",
}

// CAP-022-R15, stavy-a-mikrocopy.md E80
const RESTART_TEXT: Readonly<Partial<Record<AssemblyFailureReason, string>>> = {
	[ASSEMBLY_FAILURE.OCR_FAILED]: "Rozpoznání textu můžete znovu spustit v Odesílání do PACS.",
}

// CAP-022-R11, CAP-022-R15, CAP-028-R15, administration.yaml AdministratorAlert
export function assemblyFailureMessageOf(failure: FailedAssembly): string {
	const sentences = [
		`Sestavení záznamu ${failure.acquisitionId} pro PACS selhalo: ${REASON_TEXT[failure.reason]}.`,
		"Do PACS se ze záznamu nic neodeslalo a jeho data zůstávají na serveru.",
		RESTART_TEXT[failure.reason],
	]
	return sentences.filter((sentence) => sentence !== undefined).join(" ")
}

// CAP-028-R15, datovy-model.md 8
export function assemblyAlertEventOf(alert: RaisedAssemblyAlert): SystemJobAuditEvent {
	return {
		eventType: AUDIT_EVENT_TYPE.ADMINISTRATOR_ALERT_RAISED,
		systemJob: SYSTEM_JOB.ASSEMBLY,
		objectId: alert.alertId,
		outcome: AUDIT_OUTCOME.FAILURE,
		details: {
			alert_id: alert.alertId,
			alert_kind: ADMINISTRATOR_ALERT_KIND.ASSEMBLY_FAILED,
			message: alert.message,
			task_id: alert.taskId,
			delivery_id: alert.failure.deliveryId,
			acquisition_id: alert.failure.acquisitionId,
			reason: alert.failure.reason,
		},
	}
}

// CAP-021-R41, CAP-028-R15
const PAUSE_TEXT: Readonly<Record<AssemblyPause, string>> = {
	[ASSEMBLY_PAUSE.IMPLEMENTATION_CLASS_UID_MISSING]: "v nastavení PACS chybí platné Implementation Class UID",
	[ASSEMBLY_PAUSE.PATIENT_ID_SYSTEM_MISSING]: "není nastavený systém identifikátoru pacienta pro Patient ID",
	[ASSEMBLY_PAUSE.LANGUAGE_WITHOUT_TEXTS]: "výchozí jazyk instance nemá texty pro objekty DICOM",
	[ASSEMBLY_PAUSE.TRANSFER_SYNTAXES_UNSUPPORTED]: "nastavené transfer syntaxe server sestavit neumí",
	[ASSEMBLY_PAUSE.RELEASE_UNFIT]: "označení verze serveru se nevejde do objektu DICOM; opraví ho dodavatel",
	[ASSEMBLY_PAUSE.CLINICAL_RECORD_STORE_UNCONFIGURED]:
		"chybí adresa úložiště klinického záznamu nebo pověření vykonavatele",
}

// CAP-021-R41, CAP-028-R15, administration.yaml AdministratorAlertKind
export function assemblyPauseMessageOf(pause: AssemblyPause): string {
	return (
		`Sestavení záznamů pro PACS stojí: ${PAUSE_TEXT[pause]}. ` +
		"Uzavřené záznamy čekají na serveru a sestaví se, jakmile se nastavení doplní."
	)
}

// CAP-028-R15, datovy-model.md 8
export function assemblyPauseEventOf(alertId: string, message: string, pause: AssemblyPause): SystemJobAuditEvent {
	return {
		eventType: AUDIT_EVENT_TYPE.ADMINISTRATOR_ALERT_RAISED,
		systemJob: SYSTEM_JOB.ASSEMBLY,
		objectId: alertId,
		outcome: AUDIT_OUTCOME.FAILURE,
		details: {
			alert_id: alertId,
			alert_kind: ADMINISTRATOR_ALERT_KIND.ASSEMBLY_PAUSED,
			message,
			reason: pause,
		},
	}
}
