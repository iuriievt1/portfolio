const { TransferSyntax } = require('./../src/Constants');
const Dataset = require('./../src/Dataset');

const dcmjs = require('@veevoy/dcmjs');

const { DicomDict, DicomMessage, DicomMetaDictionary } = dcmjs.data;

// The scenarios of dcmjs pull request #520 (issue #508), which @veevoy/dcmjs takes over: text in sequence
// items is decoded with the Specific Character Set of the data set, unless an item declares its own.

const Text = 'lesione – café 肝 Šťastná';
const LongLengthVrs = ['OB', 'OD', 'OF', 'OL', 'OV', 'OW', 'SQ', 'SV', 'UC', 'UN', 'UR', 'UT', 'UV'];
const Part10ElementsOffset = 144;

/**
 * Rewrites the sequences and items that dcmjs writes with an undefined length with defined lengths,
 * so that the reader takes each item's length instead of looking for its Item Delimitation Item.
 * @param {Uint8Array} bytes - Elements in Explicit or Implicit VR Little Endian.
 * @param {number} start - Offset of the first element.
 * @param {string} syntax - Transfer syntax UID of the elements.
 * @returns {Uint8Array} The bytes before the start and the rewritten elements.
 */
function withDefinedLengths(bytes, start, syntax) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u32 = (value) => [value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, value >>> 24];
  let pos = start;

  function elements() {
    const out = [];
    while (pos < bytes.length) {
      if (view.getUint16(pos, true) === 0xfffe) {
        // Item Delimitation Item
        pos += 8;
        break;
      }
      const vr = String.fromCharCode(bytes[pos + 4], bytes[pos + 5]);
      let header = 8;
      let length = view.getUint16(pos + 6, true);
      if (syntax === TransferSyntax.ImplicitVRLittleEndian) {
        length = view.getUint32(pos + 4, true);
      } else if (LongLengthVrs.includes(vr)) {
        header = 12;
        length = view.getUint32(pos + 8, true);
      }
      if (length !== 0xffffffff) {
        out.push(...bytes.subarray(pos, pos + header + length));
        pos += header + length;
        continue;
      }
      const tagAndVr = Array.from(bytes.subarray(pos, pos + header - 4));
      pos += header;
      const items = [];
      while (view.getUint16(pos + 2, true) === 0xe000) {
        pos += 8;
        const item = elements();
        items.push(0xfe, 0xff, 0x00, 0xe0, ...u32(item.length), ...item);
      }
      // Sequence Delimitation Item
      pos += 8;
      out.push(...tagAndVr, ...u32(items.length), ...items);
    }
    return out;
  }

  return Uint8Array.from([...bytes.subarray(0, start), ...elements()]);
}

function writePart10(dict, syntax) {
  const dicomDict = new DicomDict({ '00020010': { vr: 'UI', Value: [syntax] } });
  dicomDict.dict = dict;
  return new Uint8Array(dicomDict.write());
}

function hasUndefinedLength(bytes) {
  return bytes.some((_, i) => [0, 1, 2, 3].every((j) => bytes[i + j] === 0xff));
}

const Encodings = [
  ['Explicit VR, undefined lengths', TransferSyntax.ExplicitVRLittleEndian, false],
  ['Explicit VR, defined lengths', TransferSyntax.ExplicitVRLittleEndian, true],
  ['Implicit VR, undefined lengths', TransferSyntax.ImplicitVRLittleEndian, false],
  ['Implicit VR, defined lengths', TransferSyntax.ImplicitVRLittleEndian, true],
];

function readPart10(part10, syntax, defined) {
  const bytes = defined ? withDefinedLengths(part10, Part10ElementsOffset + metaGroupLength(part10), syntax) : part10;
  return DicomMetaDictionary.naturalizeDataset(DicomMessage.readFile(bytes.slice().buffer).dict);
}

function metaGroupLength(part10) {
  return new DataView(part10.buffer, part10.byteOffset).getUint32(140, true);
}

const NestedText = {
  SpecificCharacterSet: 'ISO_IR 192',
  SOPClassUID: '1.2.840.10008.5.1.4.1.1.88.33',
  SOPInstanceUID: '2.25.1',
  StudyDescription: Text,
  ValueType: 'CONTAINER',
  ContentSequence: [
    {
      RelationshipType: 'CONTAINS',
      ValueType: 'TEXT',
      TextValue: Text,
      ContentSequence: [{ RelationshipType: 'CONTAINS', ValueType: 'TEXT', TextValue: Text }],
    },
  ],
};

describe('Character set of sequence items (dcmjs #508)', () => {
  it.each([
    ['Explicit VR', TransferSyntax.ExplicitVRLittleEndian],
    ['Implicit VR', TransferSyntax.ImplicitVRLittleEndian],
  ])('rewrites the undefined lengths dcmjs writes with defined ones (%s)', (_, syntax) => {
    const part10 = writePart10(
      DicomMetaDictionary.denaturalizeDataset({
        SpecificCharacterSet: 'ISO_IR 192',
        ContentSequence: [{ TextValue: 'a', ContentSequence: [{ TextValue: 'b' }] }],
      }),
      syntax
    );

    expect(hasUndefinedLength(part10)).to.be.true;
    expect(hasUndefinedLength(withDefinedLengths(part10, Part10ElementsOffset + metaGroupLength(part10), syntax))).to
      .be.false;
  });

  it.each(Encodings)('decodes text in sequence items at every depth with the data set character set (%s)', (_, syntax, defined) => {
    const dataset = readPart10(writePart10(DicomMetaDictionary.denaturalizeDataset(NestedText), syntax), syntax, defined);

    expect(dataset.StudyDescription).to.equal(Text);
    expect(dataset.ContentSequence[0].TextValue).to.equal(Text);
    expect(dataset.ContentSequence[0].ContentSequence[0].TextValue).to.equal(Text);
  });

  it.each(Encodings)('decodes text in sequence items of a received identifier (%s)', (_, syntax, defined) => {
    const encoded = new Dataset(NestedText, syntax).getDenaturalizedDataset();
    const bytes = defined ? Buffer.from(withDefinedLengths(new Uint8Array(encoded), 0, syntax)) : encoded;
    const dataset = new Dataset(bytes, syntax);

    expect(dataset.getElement('StudyDescription')).to.equal(Text);
    expect(dataset.getElement('ContentSequence')[0].TextValue).to.equal(Text);
    expect(dataset.getElement('ContentSequence')[0].ContentSequence[0].TextValue).to.equal(Text);
  });

  it('decodes text in UN elements read with their dictionary VR', () => {
    const dict = DicomMetaDictionary.denaturalizeDataset({
      SpecificCharacterSet: 'ISO_IR 192',
      SOPClassUID: '1.2.840.10008.5.1.4.1.1.7',
      SOPInstanceUID: '2.25.1',
    });
    // StudyDescription is LO in the dictionary, stored here with explicit VR UN, padded to an even length
    const padded = new TextEncoder().encode(Text).length % 2 === 0 ? Text : `${Text} `;
    dict['00081030'] = { vr: 'UN', Value: [new TextEncoder().encode(padded).buffer] };

    expect(readPart10(writePart10(dict, TransferSyntax.ExplicitVRLittleEndian), TransferSyntax.ExplicitVRLittleEndian, false).StudyDescription).to.equal(Text);
  });

  describe('Specific Character Set declared in a sequence item', () => {
    // PS3.5 7.5.3: it applies only to that item and the items nested in it; an item without one uses
    // the character set of the data set that contains it. dcmjs writes UTF-8 only, so the item's text
    // is written as ASCII placeholders of the same length and replaced with its ISO 8859-5 bytes.
    const CyrillicName = 'Иванов^Петр';
    const CyrillicMeaning = 'Рентген';
    const LatinName = 'Dupré^Anaïs';
    const Reason = 'Contrôle après opération';

    // ISO 8859-5 keeps ASCII and puts А..я (U+0410..U+044F) at 0xB0..0xEF
    const iso88595 = (value) =>
      Uint8Array.from(value, (c) => {
        const code = c.codePointAt(0);
        return code < 0x80 ? code : code - 0x360;
      });

    function replaceBytes(data, placeholder, bytes) {
      const needle = new TextEncoder().encode(placeholder);
      const at = data.findIndex((_, i) => needle.every((byte, j) => data[i + j] === byte));
      expect(at).to.be.greaterThan(-1);
      data.set(bytes, at);
    }

    function worklistPart10(syntax) {
      const data = writePart10(
        DicomMetaDictionary.denaturalizeDataset({
          SpecificCharacterSet: 'ISO_IR 192',
          PatientName: LatinName,
          ScheduledProcedureStepSequence: [
            {
              SpecificCharacterSet: 'ISO_IR 144',
              ScheduledPerformingPhysicianName: 'QQQQQQ^QQQQ',
              ScheduledProtocolCodeSequence: [
                { CodeValue: 'XR', CodingSchemeDesignator: '99LOCAL', CodeMeaning: 'WWWWWWW' },
              ],
            },
            { ScheduledPerformingPhysicianName: LatinName },
          ],
          ReasonForTheRequestedProcedure: Reason,
        }),
        syntax
      );
      replaceBytes(data, 'QQQQQQ^QQQQ', iso88595(CyrillicName));
      replaceBytes(data, 'WWWWWWW', iso88595(CyrillicMeaning));
      return data;
    }

    it('builds the item text in ISO 8859-5', () => {
      expect(new TextDecoder('iso-8859-5').decode(iso88595(CyrillicName))).to.equal(CyrillicName);
    });

    it.each(Encodings)('applies only to that item and the items nested in it (%s)', (_, syntax, defined) => {
      const dataset = readPart10(worklistPart10(syntax), syntax, defined);
      const [own, inherited] = dataset.ScheduledProcedureStepSequence;

      expect({
        patientName: dataset.PatientName[0].Alphabetic,
        ownItemName: own.ScheduledPerformingPhysicianName[0].Alphabetic,
        nestedItemMeaning: own.ScheduledProtocolCodeSequence[0].CodeMeaning,
        nextItemName: inherited.ScheduledPerformingPhysicianName[0].Alphabetic,
        afterSequence: dataset.ReasonForTheRequestedProcedure,
      }).to.deep.equal({
        patientName: LatinName,
        ownItemName: CyrillicName,
        nestedItemMeaning: CyrillicMeaning,
        nextItemName: LatinName,
        afterSequence: Reason,
      });
    });
  });
});
