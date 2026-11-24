import type { Duplex } from "node:stream"
import { COMMAND_FIELD, decodeCommand, emptyCommand, encodeCommand } from "../dimse"
import {
	encodeAssociateRequest,
	encodeDataPdu,
	encodeReleaseRequest,
	PDU_TYPE,
	PRESENTATION_CONTEXT_RESULT,
	PROFILE_MAX_PDU_LENGTH,
	parseAssociateAccept,
	parseDataPdu,
} from "../pdu"
import { ENCODER_IMPLEMENTATION_CLASS_UID, ENCODER_IMPLEMENTATION_VERSION_NAME } from "../synthetic"
import { APPLICATION_CONTEXT_NAME, IMPLICIT_VR_LITTLE_ENDIAN, VERIFICATION } from "../uids"
import { PduChannel } from "./channel"

// integrace-dicom.md 1, 3
const CONTEXT_ID = 1
const MESSAGE_ID = 1

export class EchoError extends Error {}

export interface EchoResult {
	acceptedTransferSyntax: string
	peerMaxPduLength: number
	peerImplementationClassUid: string
	status: number
}

async function expectPdu(channel: PduChannel, type: number, timeoutMs: number, step: string) {
	const pdu = await channel.next(timeoutMs)
	if (pdu.type === PDU_TYPE.ASSOCIATE_RJ) {
		const [, result, source, reason] = pdu.body
		throw new EchoError(`${step}: association rejected ${result}/${source}/${reason}`)
	}
	if (pdu.type === PDU_TYPE.ABORT) {
		throw new EchoError(`${step}: peer aborted the association`)
	}
	if (pdu.type !== type) {
		throw new EchoError(`${step}: expected PDU type ${type}, got ${pdu.type}`)
	}
	return pdu
}

async function readCommand(channel: PduChannel, timeoutMs: number) {
	const chunks: Buffer[] = []
	for (;;) {
		const pdu = await expectPdu(channel, PDU_TYPE.DATA_TF, timeoutMs, "C-ECHO-RSP")
		for (const value of parseDataPdu(pdu.body)) {
			if (value.contextId !== CONTEXT_ID || !value.isCommand) {
				throw new EchoError(`C-ECHO-RSP: unexpected PDV on context ${value.contextId}`)
			}
			chunks.push(value.data)
			if (value.isLast) {
				return decodeCommand(Buffer.concat(chunks))
			}
		}
	}
}

// PS3.7 9.1.5, PS3.8 7.1, 7.2
export async function echo(
	stream: Duplex,
	callingAeTitle: string,
	calledAeTitle: string,
	timeoutMs: number,
): Promise<EchoResult> {
	const channel = new PduChannel(stream, PROFILE_MAX_PDU_LENGTH)
	try {
		channel.send(
			encodeAssociateRequest({
				calledAeTitle,
				callingAeTitle,
				applicationContext: APPLICATION_CONTEXT_NAME,
				presentationContexts: [
					{ id: CONTEXT_ID, abstractSyntax: VERIFICATION, transferSyntaxes: [IMPLICIT_VR_LITTLE_ENDIAN] },
				],
				maxPduLength: PROFILE_MAX_PDU_LENGTH,
				implementationClassUid: ENCODER_IMPLEMENTATION_CLASS_UID,
				implementationVersionName: ENCODER_IMPLEMENTATION_VERSION_NAME,
			}),
		)
		const accept = parseAssociateAccept(
			(await expectPdu(channel, PDU_TYPE.ASSOCIATE_AC, timeoutMs, "A-ASSOCIATE")).body,
		)
		const context = accept.presentationContexts.find((candidate) => candidate.id === CONTEXT_ID)
		if (context?.result !== PRESENTATION_CONTEXT_RESULT.ACCEPTANCE) {
			throw new EchoError(`A-ASSOCIATE: Verification context not accepted (result ${context?.result})`)
		}
		if (context.transferSyntax !== IMPLICIT_VR_LITTLE_ENDIAN) {
			throw new EchoError(`A-ASSOCIATE: accepted transfer syntax ${context.transferSyntax} was not proposed`)
		}
		const request = {
			...emptyCommand(COMMAND_FIELD.C_ECHO_RQ),
			messageId: MESSAGE_ID,
			affectedSopClassUid: VERIFICATION,
		}
		channel.send(
			encodeDataPdu([{ contextId: CONTEXT_ID, isCommand: true, isLast: true, data: encodeCommand(request) }]),
		)
		const response = await readCommand(channel, timeoutMs)
		if (response.commandField !== COMMAND_FIELD.C_ECHO_RSP || response.messageIdBeingRespondedTo !== MESSAGE_ID) {
			throw new EchoError(
				`C-ECHO-RSP: unexpected response 0x${response.commandField.toString(16)} to message ${response.messageIdBeingRespondedTo}`,
			)
		}
		if (response.status === undefined) {
			throw new EchoError("C-ECHO-RSP: response without status")
		}
		channel.send(encodeReleaseRequest())
		await expectPdu(channel, PDU_TYPE.RELEASE_RP, timeoutMs, "A-RELEASE")
		return {
			acceptedTransferSyntax: context.transferSyntax,
			peerMaxPduLength: accept.maxPduLength,
			peerImplementationClassUid: accept.implementationClassUid,
			status: response.status,
		}
	} finally {
		channel.close()
	}
}
