import type postgres from "@veevoy/postgres"
import { type Clinician, enrolledClinician } from "../server/clinician"
import { DeviceKey } from "./device-key"
import { SystemPhone } from "./phone"

export interface SignedInPhone {
	phone: SystemPhone
	clinician: Clinician
}

// ADR-024, ADR-013, CAP-001-R31
export async function signedInPhone(sql: postgres.Sql, apiUrl: string, label: string): Promise<SignedInPhone> {
	const key = new DeviceKey()
	const clinician = await enrolledClinician(sql, key, label)
	const phone = new SystemPhone(apiUrl, key)
	phone.signIn(clinician.sessionToken)
	return { phone, clinician }
}
