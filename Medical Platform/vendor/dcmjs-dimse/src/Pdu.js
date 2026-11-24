const {
  AbortReason,
  AbortSource,
  PresentationContextResult,
  RawPduType,
  RejectReason,
  RejectResult,
  RejectSource,
} = require('./Constants');

const log = require('./log');

const { SmartBuffer } = require('smart-buffer');
const { EOL } = require('os');

// PS3.8 9.3.3
const AssociateFixedFieldsLength = 68;
const ItemHeaderLength = 4;
const PresentationContextFieldsLength = 4;
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
  ImplementationVersionName: 0x55,
  UserIdentityRq: 0x58,
  UserIdentityServerResponse: 0x59,
};
// PS3.8 D.1.2, PS3.7 D.3.3.2.2, D.3.3.2.4, D.3.3.3.2, D.3.3.7.2: each at most once in an A-ASSOCIATE-AC
const SingleUserInformationSubItemTypes = [
  ItemType.MaximumLength,
  ItemType.ImplementationClassUid,
  ItemType.AsynchronousOperations,
  ItemType.ImplementationVersionName,
  ItemType.UserIdentityServerResponse,
];
const MaximumLengthSubItemLength = 4;
// PS3.7 D.3.3.2.1, D.3.3.2.3
const ImplementationClassUidSubItemLengths = { min: 1, max: 64 };
const ImplementationVersionNameSubItemLengths = { min: 1, max: 16 };
const ProtocolVersionLength = 2;
const AsynchronousOperationsSubItemLength = 4;
const ServerResponseLengthFieldLength = 2;
// PS3.8 9.3.4, 9.3.6, 9.3.7, 9.3.8
const FixedPduBodyLength = 4;
// PS3.8 9.3.5.1: presentation context ID and message control header
const PdvFieldsLength = 2;

//#region RawPdu
class RawPdu {
  /**
   * Creates an instance of Pdu for reading or writing PDUs.
   * @constructor
   * @param {number|Buffer} typeOrBuffer - Type of PDU or PDU Buffer.
   */
  constructor(typeOrBuffer) {
    this.m16 = [];
    this.m32 = [];

    if (Buffer.isBuffer(typeOrBuffer)) {
      this.buffer = SmartBuffer.fromBuffer(typeOrBuffer, 'ascii');
      this.type = this.buffer.readUInt8();
      return;
    }

    this.buffer = SmartBuffer.fromOptions({
      encoding: 'ascii',
    });
    this.type = typeOrBuffer;
  }

  /**
   * Gets the PDU type.
   * @method
   * @returns {number} PDU type.
   */
  getType() {
    return this.type;
  }

  /**
   * Gets the PDU length.
   * @method
   * @returns {number} PDU length.
   */
  getLength() {
    return this.buffer.length;
  }

  /**
   * Gets the number of PDU bytes that are not read yet.
   * @method
   * @returns {number} Number of unread bytes.
   */
  getRemaining() {
    return this.buffer.length - this.buffer.readOffset;
  }

  /**
   * Checks that the PDU has the fixed length of its type.
   * @method
   * @param {number} length - Fixed PDU length.
   * @throws {Error} If the PDU length differs.
   */
  checkFixedLength(length) {
    if (this.buffer.length !== length) {
      throw new Error(`${this.toString()} has the fixed length ${length}`);
    }
  }

  /**
   * Resets PDU read buffer.
   * @method
   */
  reset() {
    this.buffer.readOffset = 0;
    this.buffer.writeOffset = 0;
  }

  /**
   * Reads PDU.
   * @method
   */
  readPdu() {
    this.buffer.readUInt8();
    const len = this.buffer.readUInt32BE();
    const data = this.buffer.readBuffer(len);
    this.buffer = SmartBuffer.fromBuffer(data, 'ascii');
  }

  /**
   * Writes PDU type and length.
   * @method
   * @returns {Buffer} PDU buffer with type and length.
   */
  writePdu() {
    const outBuffer = SmartBuffer.fromOptions({
      encoding: 'ascii',
    });
    const length = this.getLength();

    outBuffer.writeUInt8(this.type);
    outBuffer.writeUInt8(0);
    outBuffer.writeUInt8((length & 0xff000000) >> 24);
    outBuffer.writeUInt8((length & 0x00ff0000) >> 16);
    outBuffer.writeUInt8((length & 0x0000ff00) >> 8);
    outBuffer.writeUInt8(length & 0x000000ff);
    outBuffer.writeBuffer(this.buffer.toBuffer());

    return outBuffer.toBuffer();
  }

  /**
   * Checks if the reading bytes exceed the PDU length.
   * @method
   * @param {number} bytes - Number of bytes to read.
   * @param {string} name - Field name to read.
   * @throws {Error} If bytes to read are exceeding buffer length.
   */
  checkOffset(bytes, name) {
    const offset = this.buffer.readOffset;
    const length = this.buffer.length;
    if (offset + bytes > length) {
      throw new Error(
        `${this.toString()} [length: ${length}, offset: ${offset}, bytes: ${bytes}, field: ${name}] Requested offset out of range!`
      );
    }
  }

  //#region Read Methods
  /**
   * Reads byte from PDU.
   * @method
   * @param {string} name - Field name to read.
   * @returns {number} Read byte.
   */
  readByte(name) {
    this.checkOffset(1, name);
    return this.buffer.readUInt8();
  }

  /**
   * Reads bytes from PDU.
   * @method
   * @param {string} name - Field name to read.
   * @param {number} count - Number of bytes to read.
   * @returns {Buffer} Read bytes in a buffer.
   */
  readBytes(name, count) {
    this.checkOffset(count, name);
    return this.buffer.readBuffer(count);
  }

  /**
   * Reads unsigned short from PDU.
   * @method
   * @param {string} name - Field name to read.
   * @returns {number} Read unsigned short.
   */
  readUInt16(name) {
    this.checkOffset(2, name);
    return this.buffer.readUInt16BE();
  }

  /**
   * Reads unsigned int from PDU.
   * @method
   * @param {string} name - Field name to read.
   * @returns {number} Read unsigned int.
   */
  readUInt32(name) {
    this.checkOffset(4, name);
    return this.buffer.readUInt32BE();
  }

  /**
   * Reads string from PDU.
   * @method
   * @param {string} name - Field name to read.
   * @param {number} count - Number of bytes to read.
   * @returns {string} Read string.
   */
  readString(name, count) {
    const bytes = this.readBytes(name, count);
    return this._trim(String.fromCharCode.apply(String, bytes), [' ', '\0']);
  }

  /**
   * Skips bytes in PDU.
   * @method
   * @param {string} name - Field name to skip.
   * @param {number} count - Number of bytes to skip.
   */
  skipBytes(name, count) {
    this.checkOffset(count, name);
    this.buffer.readOffset += count;
  }
  //#endregion

  //#region Write Methods
  /**
   * Writes byte to PDU.
   * @method
   * @param {string} name - Field name to write.
   * @param {number} value - Byte value.
   */
  writeByte(name, value) {
    this.buffer.writeUInt8(value);
  }

  /**
   * Writes byte to PDU multiple times.
   * @method
   * @param {string} name - Field name to write.
   * @param {number} value - Byte value.
   * @param {number} count - Number of times to write PDU value.
   */
  writeByteMultiple(name, value, count) {
    for (let i = 0; i < count; i++) {
      this.writeByte(name, value);
    }
  }

  /**
   * Writes bytes to PDU.
   * @method
   * @param {string} name - Field name to write.
   * @param {Buffer} value - Byte values.
   */
  writeBytes(name, value) {
    this.buffer.writeBuffer(value);
  }

  /**
   * Writes unsigned short to PDU.
   * @method
   * @param {string} name - Field name to write.
   * @param {number} value - Unsigned short value.
   */
  writeUInt16(name, value) {
    this.buffer.writeUInt16BE(value);
  }

  /**
   * Writes unsigned int to PDU.
   * @method
   * @param {string} name - Field name to write.
   * @param {number} value - Unsigned int value.
   */
  writeUInt32(name, value) {
    this.buffer.writeUInt32BE(value);
  }

  /**
   * Writes string to PDU.
   * @method
   * @param {string} name - Field name to write.
   * @param {string} value - String value.
   */
  writeString(name, value) {
    for (let i = 0, len = value.length; i < len; ++i) {
      this.buffer.writeUInt8(value.charCodeAt(i));
    }
  }

  /**
   * Writes string to PDU with padding.
   * @method
   * @param {string} name - Field name to write.
   * @param {string} value - String value.
   * @param {number} count - Number of characters to write.
   * @param {string} pad - Padding character.
   */
  writeStringWithPadding(name, value, count, pad) {
    this.writeString(name, value.padEnd(count, pad));
  }

  /**
   * Marks position to write 16-bit length value.
   * @method
   * @param {string} name - Field name.
   */
  // eslint-disable-next-line no-unused-vars
  markLength16(name) {
    this.m16.push(this.buffer.writeOffset);
    this.buffer.writeUInt16BE(0);
  }

  /**
   * Writes 16-bit length to top length marker.
   * @method
   */
  writeLength16() {
    const p1 = this.m16.pop();
    const p2 = this.buffer.writeOffset;
    this.buffer.writeOffset = p1;
    this.buffer.writeUInt16BE(p2 - p1 - 2);
    this.buffer.writeOffset = p2;
  }

  /**
   * Marks position to write 32-bit length value.
   * @method
   * @param {string} name - Field name.
   */
  // eslint-disable-next-line no-unused-vars
  markLength32(name) {
    this.m32.push(this.buffer.writeOffset);
    this.buffer.writeUInt32BE(0);
  }

  /**
   * Writes 32-bit length to top length marker.
   * @method
   */
  writeLength32() {
    const p1 = this.m32.pop();
    const p2 = this.buffer.writeOffset;
    this.buffer.writeOffset = p1;
    this.buffer.writeUInt32BE(p2 - p1 - 4);
    this.buffer.writeOffset = p2;
  }

  /**
   * Gets the PDU description.
   * @method
   * @returns {string} PDU description.
   */
  toString() {
    return `(PDU) [type: ${this.getType()}, length: ${this.getLength()}]`;
  }
  //#endregion

  //#region Private Methods
  /**
   * Trim characters from a string.
   * @method
   * @private
   * @param {string} str - The string to trim.
   * @param {Array<string>} chars - The characters to trim from string.
   * @returns {string} Trimmed string.
   */
  _trim(str, chars) {
    let start = 0;
    let end = str.length;
    while (start < end && chars.indexOf(str[start]) >= 0) {
      ++start;
    }
    while (end > start && chars.indexOf(str[end - 1]) >= 0) {
      --end;
    }

    return start > 0 || end < str.length ? str.substring(start, end) : str;
  }
  //#endregion
}
//#endregion

//#region AAssociateRQ
class AAssociateRQ {
  /**
   * Creates an instance of AAssociateRQ.
   * @constructor
   * @param {Association} association - Association information.
   */
  constructor(association) {
    this.association = association;
  }

  /**
   * Gets the association information.
   * @method
   * @returns {Association} Association information.
   */
  getAssociation() {
    return this.association;
  }

  /**
   * Writes A-ASSOCIATE-RQ to PDU.
   * @method
   * @returns {RawPdu} PDU.
   * @throws {Error} If the association has no implementation class UID, which the request
   * always carries (PS3.7 D.3.3.2).
   */
  write() {
    if (!this.association.getImplementationClassUid()) {
      throw new Error('An A-ASSOCIATE-RQ carries the implementation class UID, which is not set');
    }
    const pdu = new RawPdu(RawPduType.AAssociateRQ);

    pdu.writeUInt16('Version', 0x0001);
    pdu.writeByteMultiple('Reserved', 0x00, 2);
    pdu.writeStringWithPadding('Called AE', this.association.getCalledAeTitle(), 16, ' ');
    pdu.writeStringWithPadding('Calling AE', this.association.getCallingAeTitle(), 16, ' ');
    pdu.writeByteMultiple('Reserved', 0x00, 32);

    // Application Context
    pdu.writeByte('Item-Type', ItemType.ApplicationContext);
    pdu.writeByte('Reserved', 0x00);
    pdu.markLength16('Item-Length');
    pdu.writeString('Application Context Name', this.association.getApplicationContextName());
    pdu.writeLength16();

    const contexts = this.association.getPresentationContexts();
    contexts.forEach((pc) => {
      const context = this.association.getPresentationContext(pc.id);
      // Presentation Context
      pdu.writeByte('Item-Type', ItemType.PresentationContextRq);
      pdu.writeByte('Reserved', 0x00);
      pdu.markLength16('Item-Length');
      pdu.writeByte('Presentation Context ID', context.getPresentationContextId());
      pdu.writeByteMultiple('Reserved', 0x00, 3);

      // Abstract Syntax
      pdu.writeByte('Item-Type', ItemType.AbstractSyntax);
      pdu.writeByte('Reserved', 0x00);
      pdu.markLength16('Item-Length');
      pdu.writeString('Abstract Syntax UID', context.getAbstractSyntaxUid());
      pdu.writeLength16();

      // Transfer Syntaxes
      const syntaxes = context.getTransferSyntaxUids();
      syntaxes.forEach((tx) => {
        pdu.writeByte('Item-Type', ItemType.TransferSyntax);
        pdu.writeByte('Reserved', 0x00);
        pdu.markLength16('Item-Length');
        pdu.writeString('Transfer Syntax UID', tx);
        pdu.writeLength16();
      });

      pdu.writeLength16();
    });

    // User Data Fields
    pdu.writeByte('Item-Type', ItemType.UserInformation);
    pdu.writeByte('Reserved', 0x00);
    pdu.markLength16('Item-Length');

    // Maximum PDU
    pdu.writeByte('Item-Type', ItemType.MaximumLength);
    pdu.writeByte('Reserved', 0x00);
    pdu.writeUInt16('Item-Length', 0x0004);
    pdu.writeUInt32('Max PDU Length', this.association.getMaxPduLength());

    // Implementation Class UID
    pdu.writeByte('Item-Type', ItemType.ImplementationClassUid);
    pdu.writeByte('Reserved', 0x00);
    pdu.markLength16('Item-Length');
    pdu.writeString('Implementation Class UID', this.association.getImplementationClassUid());
    pdu.writeLength16();

    // Asynchronous Operations Negotiation
    if (
      this.association.getNegotiateAsyncOps() &&
      (this.association.getMaxAsyncOpsInvoked() !== 1 ||
        this.association.getMaxAsyncOpsPerformed() !== 1)
    ) {
      pdu.writeByte('Item-Type', ItemType.AsynchronousOperations);
      pdu.writeByte('Reserved', 0x00);
      pdu.writeUInt16('Item-Length', 0x0004);
      pdu.writeUInt16('Asynchronous Operations Invoked', this.association.getMaxAsyncOpsInvoked());
      pdu.writeUInt16(
        'Asynchronous Operations Performed',
        this.association.getMaxAsyncOpsPerformed()
      );
    }

    // Implementation Version, which is optional (PS3.7 D.3.3.2)
    if (this.association.getImplementationVersion() !== undefined) {
      pdu.writeByte('Item-Type', ItemType.ImplementationVersionName);
      pdu.writeByte('Reserved', 0x00);
      pdu.markLength16('Item-Length');
      pdu.writeString('Implementation Version', this.association.getImplementationVersion());
      pdu.writeLength16();
    }

    // User Identity Negotiation
    if (this.association.getNegotiateUserIdentity()) {
      pdu.writeByte('Item-Type', ItemType.UserIdentityRq);
      pdu.writeByte('Reserved', 0x00);
      pdu.markLength16('Item-Length');
      pdu.writeByte('User Identity Type', this.association.getUserIdentityType());
      pdu.writeByte(
        'Positive Response Requested',
        this.association.getUserIdentityPositiveResponseRequested()
      );
      pdu.markLength16('User Identity Primary Field-Length');
      pdu.writeString(
        'User Identity Primary Field',
        this.association.getUserIdentityPrimaryField()
      );
      pdu.writeLength16();
      pdu.markLength16('User Identity Secondary Field-Length');
      pdu.writeString(
        'User Identity Secondary Field',
        this.association.getUserIdentitySecondaryField()
      );
      pdu.writeLength16();
      pdu.writeLength16();
    }

    pdu.writeLength16();

    return pdu;
  }

  /**
   * Gets the A-ASSOCIATE-RQ description.
   * @method
   * @returns {string} A-ASSOCIATE-RQ description.
   */
  toString() {
    return `(A-ASSOCIATE-RQ)${EOL}${this.association.toString()}`;
  }
}
//#endregion

//#region AAssociateAC
class AAssociateAC {
  /**
   * Creates an instance of AAssociateAC.
   * @constructor
   * @param {Association} association - Association information.
   */
  constructor(association) {
    this.association = association;
  }

  /**
   * Gets the association information.
   * @method
   * @returns {Association} Association information.
   */
  getAssociation() {
    return this.association;
  }

  /**
   * Reads A-ASSOCIATE-AC from PDU.
   * Every item lies within the PDU and every sub-item within its item (PS3.8 9.3.3); the PDU has one
   * application context item, one or more presentation context items and one user information item with
   * one or more sub-items, and an accepted presentation context has one transfer syntax sub-item. Items and
   * user information sub-items of an unrecognized type are skipped (PS3.8 9.3.1).
   * @method
   * @param {RawPdu} PDU.
   * @throws {Error} If the PDU is not a valid A-ASSOCIATE-AC.
   */
  read(pdu) {
    const answeredPcIds = new Set();
    const itemCounts = new Map();

    if (pdu.getRemaining() < AssociateFixedFieldsLength) {
      throw new Error(`${pdu.toString()} is shorter than the fixed fields of an A-ASSOCIATE-AC`);
    }
    pdu.readUInt16('Version');
    pdu.skipBytes(
      'Reserved, Called and Calling AE Titles',
      AssociateFixedFieldsLength - ProtocolVersionLength
    );

    while (pdu.getRemaining() > 0) {
      const item = this._readItemHeader(pdu, 'Item', pdu.getRemaining());
      itemCounts.set(item.type, (itemCounts.get(item.type) || 0) + 1);
      if (item.type === ItemType.PresentationContextAc) {
        this._readPresentationContext(pdu, item.length, answeredPcIds);
      } else if (item.type === ItemType.UserInformation) {
        this._readUserInformation(pdu, item.length);
      } else {
        pdu.skipBytes('Item Value', item.length);
      }
    }

    if (
      itemCounts.get(ItemType.ApplicationContext) !== 1 ||
      itemCounts.get(ItemType.UserInformation) !== 1 ||
      !itemCounts.has(ItemType.PresentationContextAc)
    ) {
      throw new Error(
        'An A-ASSOCIATE-AC has one application context item, one or more presentation context items and one user information item'
      );
    }
  }

  /**
   * Gets the A-ASSOCIATE-AC description.
   * @method
   * @returns {string} A-ASSOCIATE-AC description.
   */
  toString() {
    return `(A-ASSOCIATE-AC)${EOL}${this.association.toString()}`;
  }

  //#region Private Methods
  /**
   * Applies the result of the peer to a proposed presentation context.
   * An answer for a presentation context that was not proposed, a second answer for the same context
   * and an acceptance with a transfer syntax that was not proposed for the context are ignored,
   * so that the context stays not accepted and nothing is sent on it.
   * @method
   * @private
   * @param {number} pcId - Presentation context ID.
   * @param {number} result - Presentation context result.
   * @param {string|undefined} acceptedTransferSyntaxUid - Accepted transfer syntax UID, if accepted.
   * @param {Set<number>} answeredPcIds - IDs of the presentation contexts answered so far.
   */
  _applyPresentationContextResult(pcId, result, acceptedTransferSyntaxUid, answeredPcIds) {
    const proposed = this.association.findPresentationContext(pcId);
    if (proposed === undefined || answeredPcIds.has(pcId)) {
      log.warn(
        `Ignoring the answer for presentation context ${pcId}: it was not proposed or was already answered`
      );
      return;
    }
    answeredPcIds.add(pcId);
    if (
      result === PresentationContextResult.Accept &&
      !proposed.hasTransferSyntaxUid(acceptedTransferSyntaxUid)
    ) {
      log.warn(
        `Ignoring the acceptance of presentation context ${pcId}: transfer syntax ${acceptedTransferSyntaxUid} was not proposed`
      );
      return;
    }
    proposed.setResult(result, acceptedTransferSyntaxUid);
  }

  /**
   * Reads the header of an item or a sub-item.
   * @method
   * @private
   * @param {RawPdu} pdu - PDU.
   * @param {string} name - Item name.
   * @param {number} available - Number of bytes left for the item in the PDU or in the enclosing item.
   * @returns {{type: number, length: number}} Item type and length.
   * @throws {Error} If the item does not fit in the bytes left for it.
   */
  _readItemHeader(pdu, name, available) {
    if (available < ItemHeaderLength) {
      throw new Error(`${name} header of ${available} bytes is shorter than ${ItemHeaderLength}`);
    }
    const type = pdu.readByte(`${name}-Type`);
    pdu.readByte('Reserved');
    const length = pdu.readUInt16(`${name}-Length`);
    if (length > available - ItemHeaderLength) {
      throw new Error(`${name} of type ${type} and length ${length} runs past the bytes left for it`);
    }
    return { type, length };
  }

  /**
   * Reads a presentation context item and applies its result.
   * @method
   * @private
   * @param {RawPdu} pdu - PDU.
   * @param {number} length - Item length.
   * @param {Set<number>} answeredPcIds - IDs of the presentation contexts answered so far.
   * @throws {Error} If the item is not valid.
   */
  _readPresentationContext(pdu, length, answeredPcIds) {
    if (length < PresentationContextFieldsLength) {
      throw new Error(`Presentation context item of length ${length} is shorter than its fixed fields`);
    }
    const id = pdu.readByte('Presentation Context ID');
    pdu.readByte('Reserved');
    const result = pdu.readByte('Presentation Context Result/Reason');
    pdu.readByte('Reserved');
    const subItemsLength = length - PresentationContextFieldsLength;
    if (result === PresentationContextResult.Proposed || !Object.values(PresentationContextResult).includes(result)) {
      throw new Error(`Presentation context ${id} has the result ${result}, which is not defined`);
    }

    // The transfer syntax of a context that was not accepted is not significant (PS3.8 9.3.3.2)
    if (result !== PresentationContextResult.Accept) {
      pdu.skipBytes('Transfer Syntax Sub-Item', subItemsLength);
      this._applyPresentationContextResult(id, result, undefined, answeredPcIds);
      return;
    }
    const syntax = this._readItemHeader(pdu, 'Transfer Syntax Sub-Item', subItemsLength);
    if (
      syntax.type !== ItemType.TransferSyntax ||
      syntax.length !== subItemsLength - ItemHeaderLength
    ) {
      throw new Error(`Accepted presentation context ${id} does not have one transfer syntax sub-item`);
    }
    const transferSyntaxUid = pdu.readString('Transfer Syntax UID', syntax.length);
    this._applyPresentationContextResult(id, result, transferSyntaxUid, answeredPcIds);
  }

  /**
   * Reads the user information item.
   * @method
   * @private
   * @param {RawPdu} pdu - PDU.
   * @param {number} length - Item length.
   * @throws {Error} If the item is not valid.
   */
  _readUserInformation(pdu, length) {
    if (length === 0) {
      throw new Error('User information item has no sub-item');
    }
    const readTypes = new Set();
    let remaining = length;
    while (remaining > 0) {
      const subItem = this._readItemHeader(pdu, 'User Information Sub-Item', remaining);
      remaining -= ItemHeaderLength + subItem.length;
      if (SingleUserInformationSubItemTypes.includes(subItem.type) && readTypes.has(subItem.type)) {
        throw new Error(`User information sub-item of type ${subItem.type} is present more than once`);
      }
      readTypes.add(subItem.type);
      this._readUserInformationSubItem(pdu, subItem);
    }
  }

  /**
   * Reads a user information sub-item.
   * @method
   * @private
   * @param {RawPdu} pdu - PDU.
   * @param {{type: number, length: number}} subItem - Sub-item type and length.
   * @throws {Error} If the sub-item is not valid.
   */
  _readUserInformationSubItem(pdu, subItem) {
    switch (subItem.type) {
      case ItemType.MaximumLength:
        this._checkSubItemLength(subItem, MaximumLengthSubItemLength);
        this.association.setPeerMaxPduLength(pdu.readUInt32('Max PDU Length'));
        return;
      case ItemType.ImplementationClassUid:
        this._checkSubItemRange(subItem, ImplementationClassUidSubItemLengths);
        this.association.setPeerImplementationClassUid(
          pdu.readString('Implementation Class UID', subItem.length)
        );
        return;
      case ItemType.AsynchronousOperations:
        this._checkSubItemLength(subItem, AsynchronousOperationsSubItemLength);
        this.association.setMaxAsyncOpsInvoked(pdu.readUInt16('Asynchronous Operations Invoked'));
        this.association.setMaxAsyncOpsPerformed(pdu.readUInt16('Asynchronous Operations Performed'));
        this.association.setNegotiateAsyncOps(
          this.association.getMaxAsyncOpsInvoked() !== 1 ||
            this.association.getMaxAsyncOpsPerformed() !== 1
        );
        return;
      case ItemType.ImplementationVersionName:
        this._checkSubItemRange(subItem, ImplementationVersionNameSubItemLengths);
        this.association.setPeerImplementationVersion(
          pdu.readString('Implementation Version', subItem.length)
        );
        return;
      case ItemType.UserIdentityServerResponse: {
        if (subItem.length < ServerResponseLengthFieldLength) {
          throw new Error(`User identity sub-item of length ${subItem.length} has no server response length`);
        }
        const serverResponseLength = pdu.readUInt16('Server Response-Length');
        if (serverResponseLength !== subItem.length - ServerResponseLengthFieldLength) {
          throw new Error(`User identity server response of length ${serverResponseLength} does not fill its sub-item`);
        }
        this.association.setUserIdentityServerResponse(
          pdu.readString('Server Response', serverResponseLength)
        );
        this.association.setNegotiateUserIdentityServerResponse(true);
        return;
      }
      default:
        pdu.skipBytes('User Item Value', subItem.length);
    }
  }

  /**
   * Checks the length of a fixed length sub-item.
   * @method
   * @private
   * @param {{type: number, length: number}} subItem - Sub-item type and length.
   * @param {number} length - Fixed length of the sub-item.
   * @throws {Error} If the sub-item length differs.
   */
  _checkSubItemLength(subItem, length) {
    if (subItem.length !== length) {
      throw new Error(`User information sub-item of type ${subItem.type} has the fixed length ${length}, not ${subItem.length}`);
    }
  }

  /**
   * Checks that a user information sub-item has a length in its range.
   * @method
   * @private
   * @param {{type: number, length: number}} subItem - Sub-item type and length.
   * @param {{min: number, max: number}} lengths - Allowed lengths.
   * @throws {Error} If the length is outside the range.
   */
  _checkSubItemRange(subItem, lengths) {
    if (subItem.length < lengths.min || subItem.length > lengths.max) {
      throw new Error(
        `User information sub-item of type ${subItem.type} has the length ${subItem.length}, ` +
          `not ${lengths.min} to ${lengths.max}`
      );
    }
  }
  //#endregion
}
//#endregion

//#region AAssociateRJ
class AAssociateRJ {
  /**
   * Creates an instance of AAssociateRJ.
   * @constructor
   * @param {number} [result] - Rejection result.
   * @param {number} [source] - Rejection source.
   * @param {number} [reason] - Rejection reason.
   */
  constructor(result, source, reason) {
    this.result = result || RejectResult.Permanent;
    this.source = source || RejectSource.ServiceUser;
    this.reason = reason || RejectReason.NoReasonGiven;
  }

  /**
   * Gets the rejection result.
   * @method
   * @returns {number} Rejection result.
   */
  getResult() {
    return this.result;
  }

  /**
   * Gets the rejection source.
   * @method
   * @returns {number} Rejection source.
   */
  getSource() {
    return this.source;
  }

  /**
   * Gets the rejection reason.
   * @method
   * @returns {number} Rejection reason.
   */
  getReason() {
    return this.reason;
  }

  /**
   * Reads A-ASSOCIATE-RJ from PDU.
   * @method
   * @param {RawPdu} PDU.
   * @throws {Error} If the PDU does not have the fixed length, or its result or source is not defined.
   */
  read(pdu) {
    pdu.checkFixedLength(FixedPduBodyLength);
    pdu.readByte('Reserved');
    this.result = pdu.readByte('Result');
    this.source = pdu.readByte('Source');
    this.reason = pdu.readByte('Reason');
    // The result decides whether the rejection is permanent, so an undefined one is not taken (PS3.8 9.3.4)
    if (!Object.values(RejectResult).includes(this.result)) {
      throw new Error(`A-ASSOCIATE-RJ has the result ${this.result}, which is not defined`);
    }
    if (!Object.values(RejectSource).includes(this.source)) {
      throw new Error(`A-ASSOCIATE-RJ has the source ${this.source}, which is not defined`);
    }
  }

  /**
   * Gets the A-ASSOCIATE-RJ description.
   * @method
   * @returns {string} A-ASSOCIATE-RJ description.
   */
  toString() {
    return `(A-ASSOCIATE-RJ) [result: ${this._resultToString(
      this.getResult()
    )}, source: ${this._sourceToString(this.getSource())}, reason: ${this._reasonToString(
      this.getSource(),
      this.getReason()
    )}]`;
  }

  //#region Private Methods
  /**
   * Returns a readable string from rejection result.
   * @method
   * @private
   * @param {number} result - Rejection result.
   * @returns {string} Readable string.
   */
  _resultToString(result) {
    switch (result) {
      case RejectResult.Permanent:
        return 'Permanent';
      case RejectResult.Transient:
        return 'Transient';
      default:
        return `${result}`;
    }
  }

  /**
   * Returns a readable string from rejection source.
   * @method
   * @private
   * @param {number} source - Rejection source.
   * @returns {string} Readable string.
   */
  _sourceToString(source) {
    switch (source) {
      case RejectSource.ServiceUser:
        return 'Service user';
      case RejectSource.ServiceProviderAcse:
        return 'Service provider (ACSE)';
      case RejectSource.ServiceProviderPresentation:
        return 'Service provider (Presentation)';
      default:
        return `${source}`;
    }
  }

  /**
   * Returns a readable string from rejection reason.
   * @method
   * @private
   * @param {number} source - Rejection source.
   * @param {number} reason - Rejection reason.
   * @returns {string} Readable string.
   */
  _reasonToString(source, reason) {
    if (source === RejectSource.ServiceUser) {
      switch (reason) {
        case RejectReason.NoReasonGiven:
          return 'No reason given';
        case RejectReason.ApplicationContextNotSupported:
          return 'Application context name not supported';
        case RejectReason.CallingAeNotRecognized:
          return 'Calling AE title not recognized';
        case RejectReason.CalledAeNotRecognized:
          return 'Called AE title not recognized';
        default:
          return `${reason}`;
      }
    } else if (source === RejectSource.ServiceProviderAcse) {
      switch (reason) {
        case RejectReason.NoReasonGiven:
          return 'No reason given';
        case RejectReason.ProtocolVersionNotSupported:
          return 'Protocol version not supported';
        default:
          return `${reason}`;
      }
    } else if (source === RejectSource.ServiceProviderPresentation) {
      switch (reason) {
        case RejectReason.TemporaryCongestion:
          return 'Temporary congestion';
        case RejectReason.LocalLimitExceeded:
          return 'Local limit exceeded';
        default:
          return `${reason}`;
      }
    }

    return `${reason}`;
  }
  //#endregion
}
//#endregion

//#region AReleaseRQ
class AReleaseRQ {
  /**
   * Creates an instance of AReleaseRQ.
   * @constructor
   */
  constructor() {}

  /**
   * Writes A-RELEASE-RQ to PDU.
   * @method
   * @returns {RawPdu} PDU.
   */
  write() {
    const pdu = new RawPdu(RawPduType.AReleaseRQ);

    pdu.writeUInt32('Reserved', 0x00000000);

    return pdu;
  }
  /**
   * Reads A-RELEASE-RQ from PDU.
   * @method
   * @param {RawPdu} PDU.
   * @throws {Error} If the PDU does not have the fixed length.
   */
  read(pdu) {
    pdu.checkFixedLength(FixedPduBodyLength);
    pdu.readUInt32('Reserved');
  }

  /**
   * Gets the A-RELEASE-RQ description.
   * @method
   * @returns {string} A-RELEASE-RQ description.
   */
  toString() {
    return '(A-RELEASE-RQ)';
  }
}
//#endregion

//#region AReleaseRP
class AReleaseRP {
  /**
   * Creates an instance of AReleaseRP.
   * @constructor
   */
  constructor() {}

  /**
   * Writes A-RELEASE-RP to PDU buffer.
   * @method
   * @returns {RawPdu} PDU buffer.
   */
  write() {
    const pdu = new RawPdu(RawPduType.AReleaseRP);

    pdu.writeUInt32('Reserved', 0x00000000);

    return pdu;
  }
  /**
   * Reads A-RELEASE-RP from PDU buffer.
   * @method
   * @param {RawPdu} PDU buffer.
   * @throws {Error} If the PDU does not have the fixed length.
   */
  read(pdu) {
    pdu.checkFixedLength(FixedPduBodyLength);
    pdu.readUInt32('Reserved');
  }

  /**
   * Gets the A-RELEASE-RP description.
   * @method
   * @returns {string} A-RELEASE-RP description.
   */
  toString() {
    return '(A-RELEASE-RP)';
  }
}
//#endregion

//#region AAbort
class AAbort {
  /**
   * Creates an instance of AAbort.
   * @constructor
   * @param {number} [source] - Abortion source.
   * @param {number} [reason] - Abortion reason.
   */
  constructor(source, reason) {
    this.source = source || AbortSource.ServiceUser;
    this.reason = reason || AbortReason.NotSpecified;
  }

  /**
   * Gets the abort source.
   * @method
   * @returns {number} Abort source.
   */
  getSource() {
    return this.source;
  }

  /**
   * Gets the abort reason.
   * @method
   * @returns {number} Abort reason.
   */
  getReason() {
    return this.reason;
  }

  /**
   * Writes A-ABORT to PDU.
   * @method
   * @returns {RawPdu} PDU.
   */
  write() {
    const pdu = new RawPdu(RawPduType.AAbort);

    pdu.writeByte('Reserved', 0x00);
    pdu.writeByte('Reserved', 0x00);
    pdu.writeByte('Source', this.source);
    pdu.writeByte('Reason', this.reason);

    return pdu;
  }

  /**
   * Reads A-ABORT from PDU.
   * @method
   * @param {RawPdu} PDU.
   * @throws {Error} If the PDU does not have the fixed length.
   */
  read(pdu) {
    pdu.checkFixedLength(FixedPduBodyLength);
    pdu.readByte('Reserved');
    pdu.readByte('Reserved');
    this.source = pdu.readByte('Source');
    this.reason = pdu.readByte('Reason');
  }

  /**
   * Gets the A-ABORT description.
   * @method
   * @returns {string} A-ABORT description.
   */
  toString() {
    return `(A-ABORT) [source: ${this._sourceToString(
      this.getSource()
    )}, reason: ${this._reasonToString(this.getReason())}]`;
  }

  //#region Private Methods
  /**
   * Returns a readable string from abortion source.
   * @method
   * @private
   * @param {number} source - Abortion source.
   * @returns {string} Readable string.
   */
  _sourceToString(source) {
    switch (source) {
      case AbortSource.ServiceUser:
        return 'Service user';
      case AbortSource.Unknown:
        return 'Unknown';
      case AbortSource.ServiceProvider:
        return 'Service provider';
      default:
        return `${source}`;
    }
  }

  /**
   * Returns a readable string from abortion reason.
   * @method
   * @private
   * @param {number} reason - Abortion reason.
   * @returns {string} Readable string.
   */
  _reasonToString(reason) {
    switch (reason) {
      case AbortReason.NotSpecified:
        return 'Not specified';
      case AbortReason.UnrecognizedPdu:
        return 'Unrecognized PDU';
      case AbortReason.UnexpectedPdu:
        return 'Unexpected PDU';
      case AbortReason.UnrecognizedPduParameter:
        return 'Unrecognized PDU parameter';
      case AbortReason.UnexpectedPduParameter:
        return 'Unexpected PDU parameter';
      case AbortReason.InvalidPduParameter:
        return 'Invalid PDU parameter';
      default:
        return `${reason}`;
    }
  }
  //#endregion
}
//#endregion

//#region Pdv
class Pdv {
  /**
   * Creates an instance of Pdv.
   * @constructor
   * @param {number} pcId - Presentation context ID.
   * @param {Buffer} value - PDV data.
   * @param {boolean} command - Is command.
   * @param {boolean} last - Is last fragment of command or data.
   */
  constructor(pcId, value, command, last) {
    this.pcId = pcId;
    this.value = value;
    this.command = command;
    this.last = last;
  }

  /**
   * Gets the presentation context ID.
   * @method
   * @returns {number} Presentation context ID.
   */
  getPresentationContextId() {
    return this.pcId;
  }

  /**
   * Gets the PDV data.
   * @method
   * @returns {Buffer} PDV data.
   */

  getValue() {
    return this.value;
  }

  /**
   * Gets whether PDV is command.
   * @method
   * @returns {boolean} Is command.
   */
  isCommand() {
    return this.command;
  }

  /**
   * Gets whether PDV is last fragment of command or data.
   * @method
   * @returns {boolean} Is last fragment.
   */
  isLastFragment() {
    return this.last;
  }

  /**
   * Gets the PDV length.
   * @method
   * @returns {number} PDV length.
   */
  getLength() {
    return this.value.length + 6;
  }

  /**
   * Writes PDV to PDU.
   * @method
   * @param {RawPdu} PDU.
   */
  write(pdu) {
    const mch = (this.last ? 2 : 0) + (this.command ? 1 : 0);
    pdu.markLength32('PDV-Length');
    pdu.writeByte('Presentation Context ID', this.pcId);
    pdu.writeByte('Message Control Header', mch);
    pdu.writeBytes('PDV Value', this.value);
    pdu.writeLength32();
  }

  /**
   * Reads PDV from PDU.
   * The PDV has at least its presentation context ID and message control header, and lies within the PDU
   * (PS3.8 9.3.5.1); a PDV with an empty fragment is taken (PS3.8 E.1).
   * @method
   * @param {RawPdu} PDU.
   * @returns {number} Number of bytes read.
   * @throws {Error} If the PDV is not valid.
   */
  read(pdu) {
    const len = pdu.readUInt32('PDV-Length');
    if (len < PdvFieldsLength || len > pdu.getRemaining()) {
      throw new Error(`PDV of length ${len} does not fit between ${PdvFieldsLength} and the ${pdu.getRemaining()} bytes left`);
    }
    this.pcId = pdu.readByte('Presentation Context ID');
    const mch = pdu.readByte('Message Control Header');
    this.value = pdu.readBytes('PDV Value', len - PdvFieldsLength);
    this.command = (mch & 0x01) !== 0;
    this.last = (mch & 0x02) !== 0;

    return len + 4;
  }

  /**
   * Gets the PDV description.
   * @method
   * @returns {string} PDV description.
   */
  toString() {
    return `(PDV) [pc: ${this.getPresentationContextId()}, command: ${this.isCommand()}, last: ${this.isLastFragment()}, length: ${this.getLength()}]`;
  }
}
//#endregion

//#region PDataTF
class PDataTF {
  /**
   * Creates an instance of PDataTF.
   * @constructor
   */
  constructor() {
    this.pdvs = [];
  }

  /**
   * Gets PDVs in P-DATA-TF.
   * @method
   * @returns {Array<Pdv>} PDVs in this P-DATA-TF.
   */
  getPdvs() {
    return this.pdvs;
  }

  /**
   * Gets PDV count in P-DATA-TF.
   * @method
   * @returns {number} PDV count.
   */
  getPdvCount() {
    return this.pdvs.length;
  }

  /**
   * Adds a PDV in P-DATA-TF.
   * @method
   * @param {Pdv} pdv - PDV.
   */
  addPdv(pdv) {
    return this.pdvs.push(pdv);
  }

  /**
   * Clears all PDVs in P-DATA-TF.
   * @method
   */
  clearPdvs() {
    this.pdvs.length = 0;
  }

  /**
   * Gets the total length of the PDVs in P-DATA-TF.
   * @method
   * @returns {number} Length of PDVs.
   */
  getLengthOfPdvs() {
    let len = 0;
    this.pdvs.forEach((pdv) => {
      len += pdv.getLength();
    });

    return len;
  }

  /**
   * Writes P-DATA-TF to PDU.
   * @method
   * @returns {RawPdu} PDU.
   */
  write() {
    const pdu = new RawPdu(RawPduType.PDataTF);
    this.pdvs.forEach((pdv) => {
      pdv.write(pdu);
    });

    return pdu;
  }

  /**
   * Reads P-DATA-TF from PDU.
   * @method
   * @param {RawPdu} PDU.
   * @throws {Error} If the PDU has no PDV (PS3.8 9.3.5) or a PDV is not valid.
   */
  read(pdu) {
    const len = pdu.getLength();
    if (len === 0) {
      throw new Error('P-DATA-TF has no PDV');
    }
    let read = 0;
    while (read < len) {
      const pdv = new Pdv();
      read += pdv.read(pdu);
      this.pdvs.push(pdv);
    }
  }

  /**
   * Gets the P-DATA-TF description.
   * @method
   * @returns {string} P-DATA-TF description.
   */
  toString() {
    return `(P-DATA-TF) [PDV count: ${this.getPdvCount()}, PDV length: ${this.getLengthOfPdvs()}]`;
  }
}
//#endregion

//#region Exports
module.exports = {
  AAbort,
  AAssociateAC,
  AAssociateRJ,
  AAssociateRQ,
  AReleaseRP,
  AReleaseRQ,
  PDataTF,
  Pdv,
  RawPdu,
};
//#endregion
