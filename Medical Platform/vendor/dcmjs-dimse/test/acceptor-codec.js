// The PDUs of the association acceptor for the tests, encoded and decoded after PS3.8 9.3 on their own,
// without the fork's codec: the fork has no acceptor side, and a test peer built on the fork's codec
// would check the fork against itself.

const PduHeaderLength = 6;
const AssociateFixedFieldsLength = 68;
const AeTitleLength = 16;
const ApplicationContextName = '1.2.840.10008.3.1.1.1';

const PduType = {
  AssociateRq: 0x01,
  AssociateAc: 0x02,
  AssociateRj: 0x03,
  PDataTf: 0x04,
  ReleaseRq: 0x05,
  ReleaseRp: 0x06,
  Abort: 0x07,
};

const ItemType = {
  ApplicationContext: 0x10,
  PresentationContextRq: 0x20,
  PresentationContextAc: 0x21,
  AbstractSyntax: 0x30,
  TransferSyntax: 0x40,
  UserInformation: 0x50,
  MaximumLength: 0x51,
  ImplementationClassUid: 0x52,
  AsynchronousOperations: 0x53,
  RoleSelection: 0x54,
  ImplementationVersionName: 0x55,
  UserIdentityRq: 0x58,
  UserIdentityAc: 0x59,
};

const MessageControlHeader = { Command: 0x01, Last: 0x02 };

function trimmed(bytes) {
  return bytes.toString('latin1').replace(/[\0 ]+$/, '').replace(/^ +/, '');
}

function items(bytes) {
  const found = [];
  let offset = 0;
  while (offset < bytes.length) {
    if (offset + 4 > bytes.length) {
      throw new Error(`Item header at ${offset} runs past the ${bytes.length} bytes`);
    }
    const length = bytes.readUInt16BE(offset + 2);
    if (offset + 4 + length > bytes.length) {
      throw new Error(`Item of length ${length} at ${offset} runs past the ${bytes.length} bytes`);
    }
    found.push({ type: bytes[offset], value: bytes.subarray(offset + 4, offset + 4 + length) });
    offset += 4 + length;
  }
  return found;
}

function item(type, value) {
  const header = Buffer.alloc(4);
  header[0] = type;
  header.writeUInt16BE(value.length, 2);
  return Buffer.concat([header, value]);
}

function pdu(type, value) {
  const header = Buffer.alloc(PduHeaderLength);
  header[0] = type;
  header.writeUInt32BE(value.length, 2);
  return Buffer.concat([header, value]);
}

function aeTitle(title) {
  return Buffer.from(title.padEnd(AeTitleLength, ' '), 'latin1');
}

function lengthPrefixed(value) {
  const bytes = Buffer.from(value, 'latin1');
  const length = Buffer.alloc(2);
  length.writeUInt16BE(bytes.length);
  return Buffer.concat([length, bytes]);
}

/**
 * Decodes a whole A-ASSOCIATE-RQ PDU.
 * @param {Buffer} bytes - PDU bytes.
 * @returns {Object} Association request.
 */
function decodeAssociateRequest(bytes) {
  const body = bytes.subarray(PduHeaderLength);
  const request = {
    protocolVersion: body.readUInt16BE(0),
    calledAeTitle: trimmed(body.subarray(4, 20)),
    callingAeTitle: trimmed(body.subarray(20, 36)),
    applicationContext: undefined,
    presentationContexts: [],
    maxPduLength: undefined,
    implementationClassUid: undefined,
    implementationVersionName: undefined,
    asynchronousOperations: undefined,
    roleSelections: [],
    userIdentity: undefined,
  };
  items(body.subarray(AssociateFixedFieldsLength)).forEach(({ type, value }) => {
    if (type === ItemType.ApplicationContext) {
      request.applicationContext = trimmed(value);
    } else if (type === ItemType.PresentationContextRq) {
      const syntaxes = items(value.subarray(4));
      request.presentationContexts.push({
        id: value[0],
        abstractSyntax: trimmed(syntaxes.find((sub) => sub.type === ItemType.AbstractSyntax).value),
        transferSyntaxes: syntaxes
          .filter((sub) => sub.type === ItemType.TransferSyntax)
          .map((sub) => trimmed(sub.value)),
      });
    } else if (type === ItemType.UserInformation) {
      items(value).forEach((sub) => {
        if (sub.type === ItemType.MaximumLength) {
          request.maxPduLength = sub.value.readUInt32BE(0);
        } else if (sub.type === ItemType.ImplementationClassUid) {
          request.implementationClassUid = trimmed(sub.value);
        } else if (sub.type === ItemType.ImplementationVersionName) {
          request.implementationVersionName = trimmed(sub.value);
        } else if (sub.type === ItemType.AsynchronousOperations) {
          request.asynchronousOperations = {
            invoked: sub.value.readUInt16BE(0),
            performed: sub.value.readUInt16BE(2),
          };
        } else if (sub.type === ItemType.RoleSelection) {
          request.roleSelections.push(sub.value);
        } else if (sub.type === ItemType.UserIdentityRq) {
          const primaryLength = sub.value.readUInt16BE(2);
          const secondaryOffset = 4 + primaryLength;
          request.userIdentity = {
            type: sub.value[0],
            positiveResponseRequested: sub.value[1] === 1,
            primaryField: trimmed(sub.value.subarray(4, secondaryOffset)),
            secondaryField: trimmed(
              sub.value.subarray(secondaryOffset + 2, secondaryOffset + 2 + sub.value.readUInt16BE(secondaryOffset))
            ),
          };
        }
      });
    }
  });
  return request;
}

/**
 * Encodes an A-ASSOCIATE-AC PDU.
 * @param {Object} accept - Association accept.
 * @param {string} accept.calledAeTitle - Called AE title.
 * @param {string} accept.callingAeTitle - Calling AE title.
 * @param {Array<Object>} accept.presentationContexts - `{ id, result, transferSyntax }` in the order to send,
 * repeated or unproposed IDs included.
 * @param {number} accept.maxPduLength - Maximum PDU length the acceptor receives.
 * @param {string} accept.implementationClassUid - Implementation class UID.
 * @param {string} [accept.implementationVersionName] - Implementation version name.
 * @param {Object} [accept.asynchronousOperations] - `{ invoked, performed }`.
 * @param {string} [accept.userIdentityServerResponse] - User identity server response.
 * @param {Array<Buffer>} [accept.roleSelections] - Raw SCP/SCU role selection item values.
 * @param {Array<Buffer>} [accept.items] - Items to send instead of the ones above, as they are.
 * @returns {Buffer} PDU bytes.
 */
function encodeAssociateAccept(accept) {
  const fixed = Buffer.alloc(AssociateFixedFieldsLength);
  fixed.writeUInt16BE(1, 0);
  aeTitle(accept.calledAeTitle).copy(fixed, 4);
  aeTitle(accept.callingAeTitle).copy(fixed, 20);
  if (accept.items) {
    return pdu(PduType.AssociateAc, Buffer.concat([fixed, ...accept.items]));
  }
  const userItems = [
    maximumLengthSubItem(accept.maxPduLength),
    item(ItemType.ImplementationClassUid, Buffer.from(accept.implementationClassUid, 'latin1')),
  ];
  if (accept.implementationVersionName !== undefined) {
    userItems.push(item(ItemType.ImplementationVersionName, Buffer.from(accept.implementationVersionName, 'latin1')));
  }
  if (accept.asynchronousOperations) {
    const operations = Buffer.alloc(4);
    operations.writeUInt16BE(accept.asynchronousOperations.invoked, 0);
    operations.writeUInt16BE(accept.asynchronousOperations.performed, 2);
    userItems.push(item(ItemType.AsynchronousOperations, operations));
  }
  (accept.roleSelections || []).forEach((value) => userItems.push(item(ItemType.RoleSelection, value)));
  if (accept.userIdentityServerResponse !== undefined) {
    userItems.push(item(ItemType.UserIdentityAc, lengthPrefixed(accept.userIdentityServerResponse)));
  }
  return pdu(PduType.AssociateAc, Buffer.concat([fixed, ...acceptItems(accept.presentationContexts, userItems)]));
}

/**
 * Encodes the items of an A-ASSOCIATE-AC PDU that accepts the given presentation contexts.
 * @param {Array<Object>} presentationContexts - `{ id, result, transferSyntax }` for each context.
 * @param {Array<Buffer>} userInformationSubItems - User information sub-items.
 * @returns {Array<Buffer>} Application context, presentation context and user information items.
 */
function acceptItems(presentationContexts, userInformationSubItems) {
  return [
    item(ItemType.ApplicationContext, Buffer.from(ApplicationContextName, 'latin1')),
    ...presentationContexts.map((context) =>
      item(
        ItemType.PresentationContextAc,
        Buffer.concat([
          Buffer.from([context.id, 0, context.result, 0]),
          item(ItemType.TransferSyntax, Buffer.from(context.transferSyntax, 'latin1')),
        ])
      )
    ),
    item(ItemType.UserInformation, Buffer.concat(userInformationSubItems)),
  ];
}

/**
 * Encodes a maximum length sub-item.
 * @param {number} maxPduLength - Maximum PDU length.
 * @returns {Buffer} Sub-item bytes.
 */
function maximumLengthSubItem(maxPduLength) {
  const value = Buffer.alloc(4);
  value.writeUInt32BE(maxPduLength);
  return item(ItemType.MaximumLength, value);
}

/**
 * Encodes an A-ASSOCIATE-RJ PDU.
 * @param {number} result - Result.
 * @param {number} source - Source.
 * @param {number} reason - Reason.
 * @returns {Buffer} PDU bytes.
 */
function encodeAssociateReject(result, source, reason) {
  return pdu(PduType.AssociateRj, Buffer.from([0, result, source, reason]));
}

/**
 * Encodes an A-RELEASE-RP PDU.
 * @returns {Buffer} PDU bytes.
 */
function encodeReleaseResponse() {
  return pdu(PduType.ReleaseRp, Buffer.alloc(4));
}

/**
 * Decodes the PDVs of a whole P-DATA-TF PDU.
 * @param {Buffer} bytes - PDU bytes.
 * @returns {Array<Object>} `{ contextId, isCommand, isLast, value }` for each PDV.
 */
function decodePDataTf(bytes) {
  const pdvs = [];
  const body = bytes.subarray(PduHeaderLength);
  let offset = 0;
  while (offset < body.length) {
    if (offset + 6 > body.length) {
      throw new Error(`PDV header at ${offset} runs past the ${body.length} bytes`);
    }
    const length = body.readUInt32BE(offset);
    if (length < 2 || offset + 4 + length > body.length) {
      throw new Error(`PDV of length ${length} at ${offset} does not fit in the ${body.length} bytes`);
    }
    const header = body[offset + 5];
    pdvs.push({
      contextId: body[offset + 4],
      isCommand: (header & MessageControlHeader.Command) !== 0,
      isLast: (header & MessageControlHeader.Last) !== 0,
      value: body.subarray(offset + 6, offset + 4 + length),
    });
    offset += 4 + length;
  }
  return pdvs;
}

/**
 * Encodes a P-DATA-TF PDU.
 * @param {Array<Object>} pdvs - `{ contextId, isCommand, isLast, value }` for each PDV.
 * @returns {Buffer} PDU bytes.
 */
function encodePDataTf(pdvs) {
  return pdu(
    PduType.PDataTf,
    Buffer.concat(
      pdvs.map((pdv) => {
        const header = Buffer.alloc(6);
        header.writeUInt32BE(pdv.value.length + 2, 0);
        header[4] = pdv.contextId;
        header[5] = (pdv.isCommand ? MessageControlHeader.Command : 0) | (pdv.isLast ? MessageControlHeader.Last : 0);
        return Buffer.concat([header, pdv.value]);
      })
    )
  );
}

/**
 * Decodes a whole A-ABORT PDU.
 * @param {Buffer} bytes - PDU bytes.
 * @returns {Object} `{ source, reason }`.
 */
function decodeAbort(bytes) {
  return { source: bytes[PduHeaderLength + 2], reason: bytes[PduHeaderLength + 3] };
}

module.exports = {
  acceptItems,
  ApplicationContextName,
  decodeAbort,
  decodeAssociateRequest,
  decodePDataTf,
  encodeAssociateAccept,
  encodeAssociateReject,
  encodePDataTf,
  encodeReleaseResponse,
  item,
  ItemType,
  maximumLengthSubItem,
  pdu,
  PduHeaderLength,
  PduType,
};
