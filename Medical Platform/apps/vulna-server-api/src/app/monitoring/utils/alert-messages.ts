import { INSTANCE_TIME_ZONE } from "@ansora/vulna-domain"

const CZECH = "cs"

const MOMENT = new Intl.DateTimeFormat(CZECH, {
	dateStyle: "medium",
	timeStyle: "medium",
	timeZone: INSTANCE_TIME_ZONE,
})

// CAP-025-R21, stavy-a-mikrocopy.md E47
export function brokenAuditChainMessageOf(recordAt: Date): string {
	return (
		`Řetěz auditních záznamů je porušený u záznamu z ${MOMENT.format(recordAt)}. ` +
		"Selhání je zapsané jako bezpečnostní událost. Kopie záznamů je v systému správy logů nemocnice."
	)
}

// CAP-028-R22, ADR-054
export function storeOutageMessageOf(unavailableSince: Date): string {
	return (
		`Úložiště klinického záznamu neodpovídá od ${MOMENT.format(unavailableSince)}. ` +
		"Zdravotníci teď nemohou zakládat, doplňovat ani uzavírat záznamy. Upozornění zmizí, až úložiště znovu odpoví."
	)
}
