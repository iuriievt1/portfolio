// ADR-024, dev/system/run.sh
export interface SystemEnvironment {
	apiUrl: string
	databaseUrl: string
	databaseName: string
	orthancUrl: string
	orthancUser: string
	orthancPassword: string
	clinicalRecordUrl: string
	syslogFile: string
	apiSurveillanceUrl: string
	workerSurveillanceUrl: string
	apiContainer: string
	workerContainer: string
}

function required(name: string): string {
	const value = process.env[name]
	if (value === undefined || value === "") {
		throw new Error(`the system tests need ${name}; run them through pnpm test:system`)
	}
	return value
}

export function systemEnvironment(): SystemEnvironment {
	const databaseUrl = required("SYSTEM_DATABASE_URL")
	return {
		apiUrl: required("SYSTEM_API_URL"),
		databaseUrl,
		databaseName: new URL(databaseUrl).pathname.slice(1),
		orthancUrl: required("SYSTEM_ORTHANC_URL"),
		orthancUser: required("SYSTEM_ORTHANC_USER"),
		orthancPassword: required("SYSTEM_ORTHANC_PASSWORD"),
		clinicalRecordUrl: required("SYSTEM_CLINICAL_RECORD_URL"),
		syslogFile: required("SYSTEM_SYSLOG_FILE"),
		apiSurveillanceUrl: required("SYSTEM_API_SURVEILLANCE_URL"),
		workerSurveillanceUrl: required("SYSTEM_WORKER_SURVEILLANCE_URL"),
		apiContainer: required("SYSTEM_API_CONTAINER"),
		workerContainer: required("SYSTEM_WORKER_CONTAINER"),
	}
}
