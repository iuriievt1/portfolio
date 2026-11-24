const { TransferSyntax } = require('./Constants');

const dcmjs = require('@veevoy/dcmjs');
const { DicomMetaDictionary } = dcmjs.data;

const ElementHeaderLength = 8;
const ExplicitLongElementHeaderLength = 12;
const UndefinedLength = 0xffffffff;
const CommandGroupLengthValueLength = 4;
const DelimiterGroup = 0xfffe;
const ItemElement = 0xe000;
const ItemDelimitationElement = 0xe00d;
const SequenceDelimitationElement = 0xe0dd;
// Far deeper than any identifier nests, far below the depth at which dcmjs exhausts the stack
const MaxSequenceNesting = 64;
// PS3.5 7.1.2: VRs whose explicit encoding has a 16-bit value length; every other VR, also one not known yet,
// has a 32-bit one after two reserved bytes (PS3.5 6.2)
const ExplicitShortLengthVrs = [
  'AE', 'AS', 'AT', 'CS', 'DA', 'DS', 'DT', 'FL', 'FD', 'IS', 'LO',
  'LT', 'PN', 'SH', 'SL', 'SS', 'ST', 'TM', 'UI', 'UL', 'US',
];

//#region Structure
/**
 * Checks the structure of a received command set: Implicit VR Little Endian command elements of group 0000
 * in increasing tag order, each once, with even values that lie within the command set, the first being the
 * command group length of the elements after it (PS3.7 6.3.1, E.1).
 * @param {Buffer} buffer - Command set bytes.
 * @returns {string|undefined} What is wrong with the command set, if anything.
 */
function commandSetProblem(buffer) {
  let offset = 0;
  let previousElement = -1;
  let groupLength = undefined;
  while (offset < buffer.length) {
    if (offset + ElementHeaderLength > buffer.length) {
      return `element header at offset ${offset} runs past the end of the command set`;
    }
    const group = buffer.readUInt16LE(offset);
    const element = buffer.readUInt16LE(offset + 2);
    const length = buffer.readUInt32LE(offset + 4);
    const tag = tagString(group, element);
    if (group !== 0) {
      return `element ${tag} is not a command element`;
    }
    if (element <= previousElement) {
      return `element ${tag} is out of increasing tag order or repeated`;
    }
    if (length === UndefinedLength || offset + ElementHeaderLength + length > buffer.length) {
      return `element ${tag} of length ${length} runs past the end of the command set`;
    }
    if (length % 2 !== 0) {
      return `element ${tag} has an odd length ${length}`;
    }
    if (offset === 0) {
      if (element !== 0 || length !== CommandGroupLengthValueLength) {
        return 'the command set does not start with its command group length';
      }
      groupLength = buffer.readUInt32LE(ElementHeaderLength);
    }
    previousElement = element;
    offset += ElementHeaderLength + length;
  }
  if (offset === 0) {
    return 'the command set is empty';
  }
  const after = buffer.length - ElementHeaderLength - CommandGroupLengthValueLength;
  if (groupLength !== after) {
    return `command group length ${groupLength} differs from the ${after} bytes after it`;
  }
  return undefined;
}

/**
 * Checks the structure of a received data set: every element, sequence and item lies within the data set
 * and the container it is in, and every undefined length is closed by its delimitation item (PS3.5 7.1,
 * 7.5), and sequences nest at most 64 deep. Element values are not checked. The data set is walked without
 * recursion, so that deep nesting cannot exhaust the stack.
 * @param {Buffer} buffer - Data set bytes.
 * @param {string} transferSyntaxUid - Transfer syntax UID of the data set.
 * @returns {string|undefined} What is wrong with the data set, if anything.
 */
function datasetStructureProblem(buffer, transferSyntaxUid) {
  const isExplicit = transferSyntaxUid !== TransferSyntax.ImplicitVRLittleEndian;
  const isLittleEndian = transferSyntaxUid !== TransferSyntax.ExplicitVRBigEndian;
  const readUInt16 = (offset) => (isLittleEndian ? buffer.readUInt16LE(offset) : buffer.readUInt16BE(offset));
  const readUInt32 = (offset) => (isLittleEndian ? buffer.readUInt32LE(offset) : buffer.readUInt32BE(offset));
  // Each container ends at a known offset, or at its delimitation item when its length is undefined
  const containers = [{ kind: 'dataset', end: buffer.length }];
  let sequenceNesting = 0;
  let offset = 0;

  while (containers.length > 0) {
    const container = containers[containers.length - 1];
    if (container.end !== undefined && offset === container.end) {
      leave();
      continue;
    }
    const limit = container.end !== undefined ? container.end : buffer.length;
    if (offset + ElementHeaderLength > limit) {
      return `the ${container.kind} ends inside an element header at offset ${offset}`;
    }
    const group = readUInt16(offset);
    const element = readUInt16(offset + 2);
    const tag = tagString(group, element);

    if (container.kind === 'sequence') {
      const itemLength = readUInt32(offset + 4);
      if (group === DelimiterGroup && element === SequenceDelimitationElement && container.end === undefined) {
        if (itemLength !== 0) {
          return `sequence delimitation item at offset ${offset} has the length ${itemLength}`;
        }
        offset += ElementHeaderLength;
        leave();
        continue;
      }
      if (group !== DelimiterGroup || element !== ItemElement) {
        return `element ${tag} at offset ${offset} is in a sequence, not in an item`;
      }
      offset += ElementHeaderLength;
      if (itemLength === UndefinedLength) {
        containers.push({ kind: 'item', end: undefined });
        continue;
      }
      if (offset + itemLength > limit) {
        return `item of length ${itemLength} at offset ${offset - ElementHeaderLength} runs past its sequence`;
      }
      containers.push({ kind: 'item', end: offset + itemLength });
      continue;
    }

    if (group === DelimiterGroup) {
      if (element === ItemDelimitationElement && container.kind === 'item' && container.end === undefined) {
        offset += ElementHeaderLength;
        leave();
        continue;
      }
      return `delimiter ${tag} at offset ${offset} does not close an item or a sequence`;
    }

    const { vr, headerLength } = elementVr(buffer, offset, isExplicit, group, element);
    if (offset + headerLength > limit) {
      return `the ${container.kind} ends inside the header of element ${tag}`;
    }
    const length = headerLength === ExplicitLongElementHeaderLength ? readUInt32(offset + 8) : readValueLength(offset);
    offset += headerLength;
    if (length === UndefinedLength) {
      // PS3.5 6.2.2: an undefined length is a sequence, also when the VR is UN
      if (vr !== 'SQ' && vr !== 'UN' && vr !== undefined) {
        return `element ${tag} of VR ${vr} has an undefined length`;
      }
      if (!enterSequence(undefined)) {
        return `sequences nest deeper than ${MaxSequenceNesting}`;
      }
      continue;
    }
    if (offset + length > limit) {
      return `element ${tag} of length ${length} runs past the end of its ${container.kind}`;
    }
    if (vr === 'SQ') {
      if (!enterSequence(offset + length)) {
        return `sequences nest deeper than ${MaxSequenceNesting}`;
      }
      continue;
    }
    offset += length;
  }

  return undefined;

  function enterSequence(end) {
    if (sequenceNesting === MaxSequenceNesting) {
      return false;
    }
    sequenceNesting += 1;
    containers.push({ kind: 'sequence', end });
    return true;
  }

  function leave() {
    if (containers.pop().kind === 'sequence') {
      sequenceNesting -= 1;
    }
  }

  function readValueLength(at) {
    return isExplicit ? readUInt16(at + 6) : readUInt32(at + 4);
  }
}
//#endregion

//#region Private Functions
/**
 * Gets the VR of an element and the length of its header: from the data set in an explicit VR transfer
 * syntax, from the dictionary in Implicit VR Little Endian.
 * @param {Buffer} buffer - Data set bytes.
 * @param {number} offset - Offset of the element.
 * @param {boolean} isExplicit - Whether the transfer syntax has explicit VRs.
 * @param {number} group - Group number.
 * @param {number} element - Element number.
 * @returns {{vr: string|undefined, headerLength: number}} VR, undefined if unknown, and header length.
 */
function elementVr(buffer, offset, isExplicit, group, element) {
  if (!isExplicit) {
    const entry = DicomMetaDictionary.dictionary[tagString(group, element)];
    return { vr: entry ? entry.vr : undefined, headerLength: ElementHeaderLength };
  }
  const vr = buffer.toString('latin1', offset + 4, offset + 6);
  return {
    vr,
    headerLength: ExplicitShortLengthVrs.includes(vr) ? ElementHeaderLength : ExplicitLongElementHeaderLength,
  };
}

/**
 * Formats a tag as the dictionary does, (gggg,eeee) in upper case.
 * @param {number} group - Group number.
 * @param {number} element - Element number.
 * @returns {string} Formatted tag.
 */
function tagString(group, element) {
  const hex = (value) => value.toString(16).toUpperCase().padStart(4, '0');
  return `(${hex(group)},${hex(element)})`;
}
//#endregion

//#region Exports
module.exports = { commandSetProblem, datasetStructureProblem };
//#endregion
