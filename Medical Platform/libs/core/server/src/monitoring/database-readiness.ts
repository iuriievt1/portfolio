import type postgres from "@veevoy/postgres"

// CAP-028-R21
const DATABASE_ANSWER_TIMEOUT_MILLISECONDS = 2000

// CAP-028-R21, CAP-028-S04
export async function answeredWithin<T>(
	work: Promise<T>,
	timeoutMilliseconds = DATABASE_ANSWER_TIMEOUT_MILLISECONDS,
): Promise<T | undefined> {
	let timer: NodeJS.Timeout | undefined
	const timedOut = new Promise<undefined>((resolve) => {
		timer = setTimeout(() => resolve(undefined), timeoutMilliseconds)
	})
	const answered = work.then(
		(answer) => answer,
		() => undefined,
	)
	try {
		return await Promise.race([answered, timedOut])
	} finally {
		clearTimeout(timer)
	}
}

// CAP-028-R06, CAP-028-R21, CAP-028-S04
export async function databaseAnswers(
	sql: postgres.Sql,
	timeoutMilliseconds = DATABASE_ANSWER_TIMEOUT_MILLISECONDS,
): Promise<boolean> {
	return (
		(await answeredWithin(
			sql`SELECT 1`.then(() => true),
			timeoutMilliseconds,
		)) === true
	)
}
