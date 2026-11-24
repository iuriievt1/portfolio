import {
	ADMIN_API_BASE_PATH,
	ADMINISTRATOR_ALERT_KIND,
	type AdministratorAlertKind,
	type ClosableDeliveryInstanceState,
	DELIVERY_INSTANCE_STATE,
} from "@ansora/contracts"
import { MONITORING_PATH } from "../../monitoring/constants/monitoring.constants"

// administration.yaml listDeliveryTargets, resumeDeliveryTarget
export const DELIVERY_TARGETS_PATH = `${ADMIN_API_BASE_PATH}/delivery-targets`
export const TARGET_CODE_PARAMETER = "targetCode"
export const TARGET_RESUMPTION_SUBPATH = `:${TARGET_CODE_PARAMETER}/resumption`
// administration.yaml DeliveryTarget.code
export const TARGET_CODE_MAX_LENGTH = 100

// administration.yaml listDeliveries, getDelivery, closeDeliveryInstance, resumeDeliveryVerification,
// restartTextRecognition
export const MONITORED_DELIVERIES_PATH = `${MONITORING_PATH}/deliveries`
export const DELIVERY_ID_PARAMETER = "deliveryId"
export const INSTANCE_ID_PARAMETER = "instanceId"
export const DELIVERY_SUBPATH = `:${DELIVERY_ID_PARAMETER}`
const INSTANCE_SUBPATH = `${DELIVERY_SUBPATH}/instances/:${INSTANCE_ID_PARAMETER}`
export const VERIFICATION_RESUMPTION_SUBPATH = `${INSTANCE_SUBPATH}/verification-resumption`
export const INSTANCE_CLOSURE_SUBPATH = `${INSTANCE_SUBPATH}/closure`
// administration.yaml restartTextRecognition
export const TEXT_RECOGNITION_RESTART_SUBPATH = `${DELIVERY_SUBPATH}/text-recognition-restart`

// administration.yaml listDeliveries, getDelivery, NAB-345
export const CONSISTENT_READ = "ISOLATION LEVEL REPEATABLE READ READ ONLY"

// CAP-023-R17, CAP-023-R09, CAP-023-R28
export const ALERT_KIND_OF_CLOSABLE_STATE: Readonly<Record<ClosableDeliveryInstanceState, AdministratorAlertKind>> = {
	[DELIVERY_INSTANCE_STATE.HELD_FOR_REVIEW]: ADMINISTRATOR_ALERT_KIND.HELD_FOR_REVIEW,
	[DELIVERY_INSTANCE_STATE.PERMANENTLY_FAILED]: ADMINISTRATOR_ALERT_KIND.PERMANENT_DELIVERY_FAILURE,
}
