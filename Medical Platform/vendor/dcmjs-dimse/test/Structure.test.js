const { CEchoResponse } = require('./../src/Command');
const { Status, TransferSyntax } = require('./../src/Constants');
const Dataset = require('./../src/Dataset');
const { commandSetProblem, datasetStructureProblem } = require('./../src/Structure');

function element(group, elementNumber, value, length = value.length) {
  const header = Buffer.alloc(8);
  header.writeUInt16LE(group, 0);
  header.writeUInt16LE(elementNumber, 2);
  header.writeUInt32LE(length, 4);
  return Buffer.concat([header, value]);
}

function explicitElement(group, elementNumber, vr, value, length = value.length) {
  const isLong = ['OB', 'SQ', 'UN', 'UT'].includes(vr);
  const header = Buffer.alloc(isLong ? 12 : 8);
  header.writeUInt16LE(group, 0);
  header.writeUInt16LE(elementNumber, 2);
  header.write(vr, 4, 'latin1');
  if (isLong) {
    header.writeUInt32LE(length, 8);
  } else {
    header.writeUInt16LE(length, 6);
  }
  return Buffer.concat([header, value]);
}

const UndefinedLength = 0xffffffff;
const Item = (value, length = value.length) => element(0xfffe, 0xe000, value, length);
const ItemDelimitation = element(0xfffe, 0xe00d, Buffer.alloc(0));
const SequenceDelimitation = element(0xfffe, 0xe0dd, Buffer.alloc(0));
const PatientName = element(0x0010, 0x0010, Buffer.from('SYNTHETIC^ONE '));
// (0040,0100) Scheduled Procedure Step Sequence is SQ in the dictionary
const SequenceTag = [0x0040, 0x0100];

function commandSet(elements) {
  const body = Buffer.concat(elements);
  const length = Buffer.alloc(4);
  length.writeUInt32LE(body.length);
  return Buffer.concat([element(0, 0, length), body]);
}

const CommandField = element(0, 0x0100, Buffer.from([0x30, 0x80]));
const Status0000 = element(0, 0x0900, Buffer.from([0, 0]));

describe('Command set structure (PS3.7 6.3.1)', () => {
  it('should take a command set the fork encodes', () => {
    const response = new CEchoResponse(Status.Success);
    response.setMessageIdBeingRespondedTo(1);

    expect(commandSetProblem(response.getCommandDataset().getDenaturalizedCommandDataset())).to.be.undefined;
    expect(commandSetProblem(commandSet([CommandField, Status0000]))).to.be.undefined;
  });

  it('should refuse a command set that does not follow PS3.7 6.3.1', () => {
    const lying = commandSet([CommandField, Status0000]);
    lying.writeUInt32LE(lying.readUInt32LE(8) + 1000, 8);
    const truncated = Buffer.concat([commandSet([CommandField]), element(0, 0x0902, Buffer.alloc(0), 1000)]);
    truncated.writeUInt32LE(truncated.length - 12, 8);

    expect(commandSetProblem(Buffer.alloc(0))).to.match(/is empty/);
    expect(commandSetProblem(Buffer.alloc(7))).to.match(/header at offset 0 runs past the end/);
    expect(commandSetProblem(lying)).to.match(/command group length \d+ differs from the \d+ bytes after it/);
    expect(commandSetProblem(truncated)).to.match(/element \(0000,0902\) of length 1000 runs past the end/);
    expect(commandSetProblem(Buffer.concat([CommandField, Status0000]))).to.match(/does not start with its command group length/);
    expect(commandSetProblem(commandSet([Status0000, CommandField]))).to.match(/\(0000,0100\) is out of increasing tag order or repeated/);
    expect(commandSetProblem(commandSet([CommandField, CommandField]))).to.match(/\(0000,0100\) is out of increasing tag order or repeated/);
    expect(commandSetProblem(commandSet([CommandField, PatientName]))).to.match(/\(0010,0010\) is not a command element/);
    expect(commandSetProblem(commandSet([CommandField, element(0, 0x0900, Buffer.from([0]))]))).to.match(/odd length 1/);
  });
});

describe('Data set structure (PS3.5 7.1, 7.5)', () => {
  const Syntaxes = [TransferSyntax.ImplicitVRLittleEndian, TransferSyntax.ExplicitVRLittleEndian, TransferSyntax.ExplicitVRBigEndian];

  it.each(Syntaxes)('should take a data set with nested sequences that the fork encodes (%s)', (syntax) => {
    const dataset = new Dataset(
      {
        SpecificCharacterSet: 'ISO_IR 192',
        PatientName: 'SYNTHETIC^ONE',
        ScheduledProcedureStepSequence: [
          { ScheduledProtocolCodeSequence: [{ CodeValue: 'XR', CodeMeaning: 'Ošetření' }] },
          { ScheduledPerformingPhysicianName: 'SYNTHETIC^TWO' },
        ],
      },
      syntax
    );

    expect(datasetStructureProblem(dataset.getDenaturalizedDataset(), syntax)).to.be.undefined;
  });

  it('should take defined and undefined lengths of sequences and items in Implicit VR', () => {
    const defined = element(...SequenceTag, Buffer.concat([Item(PatientName), Item(Buffer.alloc(0))]));
    const undefinedLength = element(
      ...SequenceTag,
      Buffer.concat([Item(Buffer.concat([PatientName, ItemDelimitation]), UndefinedLength), SequenceDelimitation]),
      UndefinedLength
    );

    expect(datasetStructureProblem(Buffer.concat([defined, undefinedLength, PatientName]), TransferSyntax.ImplicitVRLittleEndian)).to.be.undefined;
  });

  it('should take sequences nested 64 deep and refuse deeper ones at once, also far deeper', () => {
    const open = Buffer.concat([element(...SequenceTag, Buffer.alloc(0), UndefinedLength), Item(Buffer.alloc(0), UndefinedLength)]);
    const close = Buffer.concat([ItemDelimitation, SequenceDelimitation]);
    const nested = (depth) => Buffer.concat([...Array(depth).fill(open), ...Array(depth).fill(close), PatientName]);
    const definedNested = (depth) =>
      Array.from({ length: depth }).reduce((inner) => element(...SequenceTag, Item(inner)), PatientName);

    expect(datasetStructureProblem(nested(64), TransferSyntax.ImplicitVRLittleEndian)).to.be.undefined;
    expect(datasetStructureProblem(definedNested(64), TransferSyntax.ImplicitVRLittleEndian)).to.be.undefined;
    expect(datasetStructureProblem(nested(65), TransferSyntax.ImplicitVRLittleEndian)).to.match(/sequences nest deeper than 64/);
    expect(datasetStructureProblem(definedNested(65), TransferSyntax.ImplicitVRLittleEndian)).to.match(/sequences nest deeper than 64/);
    expect(datasetStructureProblem(nested(30000), TransferSyntax.ImplicitVRLittleEndian)).to.match(/sequences nest deeper than 64/);
  });

  it('should count nesting, not sequences one after another', () => {
    const sequence = element(...SequenceTag, Buffer.concat([Item(PatientName), Item(PatientName)]));

    expect(datasetStructureProblem(Buffer.concat(Array(200).fill(sequence)), TransferSyntax.ImplicitVRLittleEndian)).to.be.undefined;
  });

  it('should refuse elements, items and delimiters that do not fit their container', () => {
    const implicit = (bytes) => datasetStructureProblem(bytes, TransferSyntax.ImplicitVRLittleEndian);
    const lyingElement = element(0x0010, 0x0010, Buffer.from('SYNTHETIC '), 0xfffffff0);
    const lyingItem = element(...SequenceTag, Item(PatientName, 1000));
    const unclosedSequence = element(...SequenceTag, Item(PatientName), UndefinedLength);
    const unclosedItem = Buffer.concat([
      element(...SequenceTag, Buffer.alloc(0), UndefinedLength),
      Item(PatientName, UndefinedLength),
    ]);

    expect(implicit(lyingElement)).to.match(/element \(0010,0010\) of length 4294967280 runs past the end of its dataset/);
    expect(implicit(lyingItem)).to.match(/item of length 1000 at offset 8 runs past its sequence/);
    expect(implicit(Buffer.concat([PatientName, ItemDelimitation]))).to.match(/delimiter \(FFFE,E00D\) at offset \d+ does not close/);
    expect(implicit(element(...SequenceTag, PatientName))).to.match(/element \(0010,0010\) at offset 8 is in a sequence, not in an item/);
    expect(implicit(unclosedSequence)).to.match(/the sequence ends inside an element header/);
    expect(implicit(unclosedItem)).to.match(/the item ends inside an element header/);
    expect(implicit(PatientName.subarray(0, 6))).to.match(/the dataset ends inside an element header at offset 0/);
    expect(implicit(Buffer.concat([element(...SequenceTag, Buffer.alloc(0), UndefinedLength), element(0xfffe, 0xe0dd, Buffer.alloc(0), 4)]))).to.match(/sequence delimitation item at offset 8 has the length 4/);
  });

  it('should refuse an undefined length of an element that is not a sequence in an explicit VR', () => {
    const explicit = (bytes) => datasetStructureProblem(bytes, TransferSyntax.ExplicitVRLittleEndian);

    expect(explicit(explicitElement(0x0018, 0x1020, 'UT', Buffer.alloc(0), UndefinedLength))).to.match(/element \(0018,1020\) of VR UT has an undefined length/);
    expect(explicit(explicitElement(0x0010, 0x0010, 'PN', Buffer.from('SYNTHETIC '), 200))).to.match(/element \(0010,0010\) of length 200 runs past/);
    expect(explicit(explicitElement(0x0010, 0x0010, 'PN', Buffer.from('SYNTHETIC ')))).to.be.undefined;
  });

  it('should read a VR it does not know with a 32-bit value length, as PS3.5 6.2 and dcmjs do', () => {
    const explicit = (bytes) => datasetStructureProblem(bytes, TransferSyntax.ExplicitVRLittleEndian);
    const unknownShortHeader = Buffer.concat([
      explicitElement(0x0010, 0x0010, 'PN', Buffer.alloc(0)),
      explicitElement(0x0010, 0x0020, 'LO', Buffer.from('SYNTH-01')),
    ]);
    unknownShortHeader.write('ZZ', 4, 'latin1');
    const unknownLongHeader = Buffer.alloc(12);
    unknownLongHeader.writeUInt16LE(0x0009, 0);
    unknownLongHeader.writeUInt16LE(0x1010, 2);
    unknownLongHeader.write('ZZ', 4, 'latin1');
    unknownLongHeader.writeUInt32LE(4, 8);

    expect(explicit(unknownShortHeader)).to.match(/element \(0010,0010\) of length \d+ runs past the end of its dataset/);
    expect(explicit(Buffer.concat([unknownLongHeader, Buffer.from('ABCD')]))).to.be.undefined;
  });
});
