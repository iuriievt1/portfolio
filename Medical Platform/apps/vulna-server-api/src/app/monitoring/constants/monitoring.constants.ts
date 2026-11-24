import { ADMIN_API_BASE_PATH } from "@ansora/contracts"

export const MONITORING_PATH = `${ADMIN_API_BASE_PATH}/monitoring`
// administration.yaml listAdministratorAlerts
export const ALERTS_SUBPATH = "alerts"
// administration.yaml acknowledgeAdministratorAlert
export const ALERT_ID_PARAMETER = "alertId"
export const ALERT_ACKNOWLEDGEMENT_SUBPATH = `${ALERTS_SUBPATH}/:${ALERT_ID_PARAMETER}/acknowledgement`
// administration.yaml requeueClinicalRecordWrite
export const CLINICAL_RECORD_WRITE_REQUEUE_SUBPATH = "clinical-record-writes/:taskId/requeue"

// queue_task_open_uniq
export const REQUEUE_RACE_RETRIES = 1

// administration.yaml getOperationalMetricsForAdministration
export const METRICS_SUBPATH = "metrics"

// administration.yaml AdministratorAlertKind clinical_record_store_unavailable
export const STORE_OUTAGE_ALERT_SECONDS = 300
export const STORE_OUTAGE_CHECK_MILLISECONDS = 30_000
