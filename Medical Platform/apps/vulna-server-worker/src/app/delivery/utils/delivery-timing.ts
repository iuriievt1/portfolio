import { type ConfigurationValues, MILLISECONDS_PER_SECOND } from "@ansora/core-server"
import { dimseTimeoutsOf } from "../../../libs/pacs/utils/pacs-configuration"
import type { DeliverySettings } from "../types/delivery.types"

// CAP-023-R25, ADR-016 ř. 54
export function deliveryLeaseMillisecondsOf(values: ConfigurationValues): number {
	const timeouts = dimseTimeoutsOf(values)
	return timeouts.connectMs + timeouts.acseMs + timeouts.dimseMs
}

// CAP-023-R24, konfigurace-a-profily.md 2.7
export function minimumBackoffMillisecondsOf(settings: DeliverySettings): number {
	return settings.backoff.minimumSeconds * MILLISECONDS_PER_SECOND
}
