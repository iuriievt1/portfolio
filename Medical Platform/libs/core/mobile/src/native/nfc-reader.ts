import { PATIENT_TAG_SOURCE, type PatientTagSource } from "@ansora/contracts"
import { Platform } from "react-native"
import NfcManager, {
	Ndef,
	type NdefRecord,
	NdefStatus,
	NfcError,
	NfcTech,
	type TagEvent,
} from "react-native-nfc-manager"
import type { NfcReader } from "./index"
import { isMissingAdapter } from "./nfc-adapter"
import { screenPrivacy } from "./screen-privacy"

export const CARD_READING = {
	READ: "read",
	CANCELLED: "cancelled",
	TIMED_OUT: "timed_out",
	FAILED: "failed",
} as const

type ReadingFailure =
	| { kind: typeof CARD_READING.CANCELLED }
	| { kind: typeof CARD_READING.TIMED_OUT }
	| { kind: typeof CARD_READING.FAILED }

export type CardReading = { kind: typeof CARD_READING.READ; tagId: string } | ReadingFailure

// CAP-013-R05
export type TagReading =
	| { kind: typeof CARD_READING.READ; tagId: string | undefined; ndefTexts: string[] }
	| ReadingFailure

const READS_WITHOUT_PROMPT = Platform.OS === "android"
const IS_IOS = Platform.OS === "ios"
// CAP-001-R09
const READING_LIMIT_MILLISECONDS = 60_000
// CAP-013-R04
const IOS_TAG_TECHNOLOGIES = [NfcTech.MifareIOS, NfcTech.Iso15693IOS]
const ANDROID_TAG_TECHNOLOGIES: Readonly<Record<PatientTagSource, NfcTech[]>> = {
	[PATIENT_TAG_SOURCE.NDEF_TEXT]: [NfcTech.Ndef],
	[PATIENT_TAG_SOURCE.UID]: [NfcTech.NfcA, NfcTech.NfcB, NfcTech.NfcF, NfcTech.NfcV],
}

let started: Promise<void> | undefined
let releasing: Promise<void> | undefined

const reader: NfcReader = {
	readsWithoutPrompt: READS_WITHOUT_PROMPT,

	async isSupported() {
		try {
			return (await NfcManager.isSupported()) && (await hasAdapter())
		} catch (failure) {
			console.warn("NFC support could not be read", failure)
			return false
		}
	},

	async isEnabled() {
		try {
			return await NfcManager.isEnabled()
		} catch (failure) {
			console.warn("NFC state could not be read", failure)
			return false
		}
	},

	async openSettings() {
		await NfcManager.goToNfcSetting()
	},

	async readCard(instruction) {
		return await request({ alertMessage: instruction }, READS_WITHOUT_PROMPT)
	},

	async watchCard() {
		return await request({}, false)
	},

	async readTag(instruction, content) {
		return await requestTag({ alertMessage: instruction }, content)
	},

	async cancel() {
		await release()
	},
}

export function nfcReader(): NfcReader {
	return reader
}

async function hasAdapter(): Promise<boolean> {
	started ??= NfcManager.start()
	try {
		await started
		return true
	} catch (failure) {
		started = undefined
		return !isMissingAdapter(failure)
	}
}

async function readWith<T>(
	technologies: NfcTech | NfcTech[],
	options: { alertMessage?: string },
	limited: boolean,
	readingOfTag: (tag: TagEvent | null) => Promise<T>,
): Promise<T | ReadingFailure> {
	started ??= NfcManager.start()
	let timedOut = false
	const timer = limited
		? setTimeout(() => {
				timedOut = true
				void release()
			}, READING_LIMIT_MILLISECONDS)
		: undefined
	// CAP-013-R04
	screenPrivacy().allowSystemSheet(true)
	try {
		await started
		await releasing
		await NfcManager.requestTechnology(technologies, options)
		return await readingOfTag(await NfcManager.getTag())
	} catch (failure) {
		return timedOut ? { kind: CARD_READING.TIMED_OUT } : readingOf(failure)
	} finally {
		clearTimeout(timer)
		screenPrivacy().allowSystemSheet(false)
		void release()
	}
}

async function request(options: { alertMessage?: string }, limited: boolean): Promise<CardReading> {
	return await readWith<CardReading>(NfcTech.NfcA, options, limited, async (tag) =>
		tag?.id === undefined ? { kind: CARD_READING.FAILED } : { kind: CARD_READING.READ, tagId: tag.id },
	)
}

// CAP-013-R04, CAP-013-R05, CAP-013-R06
async function requestTag(options: { alertMessage?: string }, content: PatientTagSource): Promise<TagReading> {
	const technologies = IS_IOS ? IOS_TAG_TECHNOLOGIES : ANDROID_TAG_TECHNOLOGIES[content]
	return await readWith<TagReading>(technologies, options, true, async (tag) => ({
		kind: CARD_READING.READ,
		tagId: tag?.id,
		ndefTexts: content === PATIENT_TAG_SOURCE.NDEF_TEXT ? await ndefTextsOf(tag) : [],
	}))
}

async function ndefTextsOf(tag: TagEvent | null): Promise<string[]> {
	const records = IS_IOS ? await iosNdefRecords() : tag?.ndefMessage
	return (records ?? []).flatMap((record) => {
		const text = textOf(record)
		return text === undefined ? [] : [text]
	})
}

// CAP-013-R04, CAP-013-R05
async function iosNdefRecords(): Promise<NdefRecord[]> {
	const { status } = await NfcManager.ndefHandler.getNdefStatus()
	if (status === NdefStatus.NotSupported) {
		return []
	}
	try {
		return (await NfcManager.ndefHandler.getNdefMessage())?.ndefMessage ?? []
	} catch (failure) {
		if (failure instanceof NfcError.ZeroLengthMessage) {
			return []
		}
		throw failure
	}
}

function textOf(record: NdefRecord): string | undefined {
	if (!Ndef.isType(record, Ndef.TNF_WELL_KNOWN, Ndef.RTD_TEXT)) {
		return undefined
	}
	return Ndef.text.decodePayload(Uint8Array.from(record.payload))
}

function release(): Promise<void> {
	releasing = NfcManager.cancelTechnologyRequest().catch((failure: unknown) =>
		console.warn("the card reading could not be released", failure),
	)
	return releasing
}

function readingOf(failure: unknown): ReadingFailure {
	if (failure instanceof NfcError.UserCancel) {
		return { kind: CARD_READING.CANCELLED }
	}
	if (failure instanceof NfcError.Timeout) {
		return { kind: CARD_READING.TIMED_OUT }
	}
	console.warn("the card could not be read", failure)
	return { kind: CARD_READING.FAILED }
}
