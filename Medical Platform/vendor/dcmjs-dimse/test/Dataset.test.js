const { StorageClass, TransferSyntax } = require('./../src/Constants');
const Dataset = require('./../src/Dataset');

const fs = require('fs');
const path = require('path');
const { temporaryDirectory, withDone, writePart10File } = require('./support');

const SyntheticElements = {
  SOPClassUID: StorageClass.SecondaryCaptureImageStorage,
  SOPInstanceUID: Dataset.generateDerivedUid(),
  PatientName: 'SYNTHETIC^PATIENT',
  PatientID: 'SYNTHETIC-0001',
  StudyInstanceUID: Dataset.generateDerivedUid(),
  SeriesInstanceUID: Dataset.generateDerivedUid(),
  Modality: 'OT',
};

describe('Dataset', () => {
  let directory = undefined;
  const file = (name) => path.join(directory, name);

  beforeEach(() => {
    directory = temporaryDirectory();
    writePart10File(file('fileIn.dcm'), SyntheticElements, TransferSyntax.ExplicitVRLittleEndian);
    fs.writeFileSync(file('fileInEmpty.dcm'), '');
  });
  afterEach(() => {
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it('should correctly convert elements to a DICOM dataset and back', () => {
    const patientName = 'JOHN^DOE';
    const patientID = '12345678';
    const accessionNumber = '87654321';
    const studyDescription = 'THIS IS A STUDY';
    const seriesDescription = 'THIS IS A SERIES';

    const dataset1 = new Dataset(
      {
        PatientName: patientName,
        PatientID: patientID,
        AccessionNumber: accessionNumber,
      },
      TransferSyntax.ImplicitVRLittleEndian
    );
    dataset1.setElement('StudyDescription', studyDescription);
    const dicomDataset1 = dataset1.getDenaturalizedDataset();
    expect(dicomDataset1.toString()).to.be.a('string');

    const dataset2 = new Dataset(dicomDataset1, TransferSyntax.ImplicitVRLittleEndian);
    expect(String(dataset2.getElement('PatientName'))).to.be.eq(patientName);
    expect(dataset2.getElement('PatientID')).to.be.eq(patientID);
    expect(dataset2.getElement('AccessionNumber')).to.be.eq(accessionNumber);
    expect(dataset2.getElement('StudyDescription')).to.be.eq(studyDescription);
    expect(dataset2.getTransferSyntaxUid()).to.be.eq(TransferSyntax.ImplicitVRLittleEndian);

    dataset2.setTransferSyntaxUid(TransferSyntax.ExplicitVRLittleEndian);
    dataset2.setElement('SeriesDescription', seriesDescription);
    const dicomDataset2 = dataset2.getDenaturalizedDataset();

    const dataset3 = new Dataset(dicomDataset2, TransferSyntax.ExplicitVRLittleEndian);
    expect(String(dataset3.getElement('PatientName'))).to.be.eq(patientName);
    expect(dataset3.getElement('PatientID')).to.be.eq(patientID);
    expect(dataset3.getElement('AccessionNumber')).to.be.eq(accessionNumber);
    expect(dataset3.getElement('StudyDescription')).to.be.eq(studyDescription);
    expect(dataset3.getElement('SeriesDescription')).to.be.eq(seriesDescription);
    expect(dataset3.getTransferSyntaxUid()).to.be.eq(TransferSyntax.ExplicitVRLittleEndian);

    const dicomDataset4 = dataset3.getDenaturalizedDataset();

    const dataset5 = new Dataset(dicomDataset4, TransferSyntax.ExplicitVRLittleEndian, {
      untilTag: '00080050', // AccessionNumber
      includeUntilTagValue: false,
    });
    expect(dataset5.getElement('PatientID')).to.be.undefined;
    expect(dataset5.getElement('PatientName')).to.be.undefined;
    expect(dataset5.getElement('StudyDescription')).to.be.undefined;
    expect(dataset5.getElement('SeriesDescription')).to.be.undefined;

    const dataset6 = new Dataset(dicomDataset4, TransferSyntax.ExplicitVRLittleEndian, {
      untilTag: '00080050', // AccessionNumber
      includeUntilTagValue: true,
    });
    expect(dataset6.getElement('AccessionNumber')).to.be.eq(accessionNumber);
    expect(dataset6.getElement('PatientID')).to.be.undefined;
    expect(dataset6.getElement('PatientName')).to.be.undefined;
    expect(dataset6.getElement('StudyDescription')).to.be.undefined;
    expect(dataset6.getElement('SeriesDescription')).to.be.undefined;
  });

  it('should create at least 100 different DICOM UIDs sequentially', () => {
    const uids = [];
    for (let i = 0; i < 100; i++) {
      const uid = Dataset.generateDerivedUid();
      expect(uids).to.not.contain(uid);
      uids.push(uid);
    }
  });

  it('should read DICOM part10 files', () => {
    const dataset1 = Dataset.fromFile(file('fileIn.dcm'));
    const elements1 = dataset1.getElements();
    delete elements1._vrMap;
    expect(Object.keys(elements1)).to.have.members(Object.keys(SyntheticElements));
    Object.keys(SyntheticElements).forEach((name) => {
      expect(String(elements1[name])).to.be.eq(String(SyntheticElements[name]));
    });
    expect(dataset1.getTransferSyntaxUid()).to.be.eq(TransferSyntax.ExplicitVRLittleEndian);

    const elements3 = {
      SOPClassUID: StorageClass.SecondaryCaptureImageStorage,
      SOPInstanceUID: Dataset.generateDerivedUid(),
      PatientName: 'JOHN^DOE',
      PatientID: '123456',
      AccessionNumber: '654321',
      StudyDescription: 'STUDY_DESCRIPTION',
      SeriesDescription: 'SERIES_DESCRIPTION',
    };
    writePart10File(file('fileOut2.dcm'), elements3, TransferSyntax.ImplicitVRLittleEndian);
    const dataset4 = Dataset.fromFile(file('fileOut2.dcm'));
    const elements4 = dataset4.getElements();
    delete elements4._vrMap;
    expect(Object.keys(elements3).length).to.be.eq(Object.keys(elements4).length);
    expect(Object.keys(elements3)).to.have.members(Object.keys(elements4));
    Object.keys(elements3).forEach((el1) => {
      const val1 = elements3[el1];
      const val2 = elements4[el1];
      expect(String(val1)).to.be.eq(String(val2));
    });

    expect(() => {
      Dataset.fromFile(file('fileInEmpty.dcm'));
    }).to.throw();

  });

  it('should keep private tags which are encoded via a nameMap', () => {
    const elements1 = {
      SOPClassUID: StorageClass.SecondaryCaptureImageStorage,
      SOPInstanceUID: Dataset.generateDerivedUid(),
      PatientName: 'JOHN^DOE',
      PatientID: '123456',
      AccessionNumber: '654321',
      StudyDescription: 'STUDY_DESCRIPTION',
      SeriesDescription: 'SERIES_DESCRIPTION',
      '00091001': 'Private tag that should stay',
      '00091002': 'Private tag that should NOT stay',
    };
    const dataset1 = new Dataset(elements1, TransferSyntax.ImplicitVRLittleEndian);
    const encoded = dataset1.getDenaturalizedDataset(undefined, {
      '00091001': {
        tag: '(0009,1001)',
        vr: 'LT',
        name: '00091001',
        vm: '1',
        version: 'PrivateTag',
      },
    });
    const dataset2 = new Dataset(encoded, TransferSyntax.ImplicitVRLittleEndian);
    const elements2 = dataset2.getElements();
    delete elements2._vrMap;

    expect(Buffer.from(elements2['00091001'][0]).toString('utf8')).to.equal(
      'Private tag that should stay'
    );
    expect(elements2['00091002']).to.be.undefined;
    expect(Object.keys(elements1).length - 1).to.be.eq(Object.keys(elements2).length);

  });

  it('should keep the bytes after the file meta information of a stored part10 file unchanged', () => {
    const fileBytes = fs.readFileSync(file('fileIn.dcm'));
    const dataset = Dataset.fromStoredPart10(fileBytes);
    const stored = dataset.getStoredDataset();

    expect(dataset.isStored()).to.be.true;
    expect(dataset.getTransferSyntaxUid()).to.be.eq(TransferSyntax.ExplicitVRLittleEndian);
    expect(dataset.getElement('SOPInstanceUID')).to.be.eq(SyntheticElements.SOPInstanceUID);
    expect(fileBytes.subarray(fileBytes.length - stored.length).equals(stored)).to.be.true;
    const decoded = new Dataset(stored, TransferSyntax.ExplicitVRLittleEndian);
    expect(decoded.getElement('PatientID')).to.be.eq(SyntheticElements.PatientID);
    expect(decoded.getElement('_meta')).to.be.undefined;
  });

  it('should refuse to change or re-encode a stored dataset', () => {
    const dataset = Dataset.fromStoredPart10(fs.readFileSync(file('fileIn.dcm')));

    expect(() => dataset.setElement('PatientID', 'OTHER')).to.throw();
    expect(() => dataset.setTransferSyntaxUid(TransferSyntax.ImplicitVRLittleEndian)).to.throw();
    expect(() => dataset.getDenaturalizedDataset()).to.throw();
    expect(() => new Dataset({}).getStoredDataset()).to.throw();
  });

  it('should write no part10 file, which would carry an implementation class UID of the library', () => {
    expect(Dataset.prototype.toFile).to.be.undefined;
  });

  it('should refuse a data set that dcmjs cannot read to the end, instead of keeping what it read so far', () => {
    const element = (group, number, length, value = Buffer.alloc(0)) => {
      const header = Buffer.alloc(8);
      header.writeUInt16LE(group, 0);
      header.writeUInt16LE(number, 2);
      header.writeUInt32LE(length, 4);
      return Buffer.concat([header, value]);
    };
    const open = Buffer.concat([element(0x0040, 0x0100, 0xffffffff), element(0xfffe, 0xe000, 0xffffffff)]);
    const close = Buffer.concat([element(0xfffe, 0xe00d, 0), element(0xfffe, 0xe0dd, 0)]);
    const patientId = element(0x0010, 0x0020, 8, Buffer.from('SYNTH-01'));
    // Nested so deep that dcmjs exhausts the stack and, reading with ignoreErrors, keeps what it read so far
    const deep = Buffer.concat([...Array(3000).fill(open), ...Array(3000).fill(close), patientId]);

    expect(() => new Dataset(deep, TransferSyntax.ImplicitVRLittleEndian)).to.throw(/could not be read past offset \d+ of \d+/);
    expect(new Dataset(Buffer.concat([open, close, patientId]), TransferSyntax.ImplicitVRLittleEndian).getElement('PatientID')).to.be.eq('SYNTH-01');
  });

  it('should keep the Specific Character Set as it was received, which dcmjs sets to ISO_IR 192', () => {
    const element = (group, elementNumber, value) => {
      const header = Buffer.alloc(8);
      header.writeUInt16LE(group, 0);
      header.writeUInt16LE(elementNumber, 2);
      header.writeUInt32LE(value.length, 4);
      return Buffer.concat([header, value]);
    };
    const text = (value, encoding) => {
      const bytes = Buffer.from(value, encoding);
      return bytes.length % 2 === 0 ? bytes : Buffer.concat([bytes, Buffer.from(' ')]);
    };
    const received = (characterSet) =>
      new Dataset(
        Buffer.concat([
          ...(characterSet === undefined ? [] : [element(0x0008, 0x0005, text(characterSet, 'latin1'))]),
          element(0x0010, 0x0010, text('Nováková^Jana', characterSet === 'ISO_IR 100' ? 'latin1' : 'utf8')),
        ]),
        TransferSyntax.ImplicitVRLittleEndian
      );

    const latin1 = received('ISO_IR 100');
    expect(latin1.getElement('PatientName')).to.deep.equal([{ Alphabetic: 'Nováková^Jana' }]);
    expect(latin1.getElement('SpecificCharacterSet')).to.equal('ISO_IR 192');
    expect(latin1.getReceivedSpecificCharacterSet()).to.equal('ISO_IR 100');
    expect(received('ISO_IR 192').getReceivedSpecificCharacterSet()).to.equal('ISO_IR 192');
    expect(received(' ISO_IR 6').getReceivedSpecificCharacterSet()).to.equal('ISO_IR 6');
    expect(received('').getReceivedSpecificCharacterSet()).to.equal('');
    expect(received(undefined).getReceivedSpecificCharacterSet()).to.be.undefined;
    expect(received('\\ISO 2022 IR 100').getReceivedSpecificCharacterSet()).to.equal('\\ISO 2022 IR 100');
    expect(new Dataset({ SpecificCharacterSet: 'ISO_IR 100' }).getReceivedSpecificCharacterSet()).to.be.undefined;
  });

  it('should describe a dataset without its element values', () => {
    const description = new Dataset(SyntheticElements, TransferSyntax.ExplicitVRLittleEndian).toString();
    const storedDescription = Dataset.fromStoredPart10(fs.readFileSync(file('fileIn.dcm'))).toString();

    expect(description).to.be.eq(
      `(Dataset) [transfer syntax: ${TransferSyntax.ExplicitVRLittleEndian}, stored: false, elements: 7]`
    );
    expect(storedDescription).to.match(/^\(Dataset\) \[transfer syntax: [0-9.]+, stored: true, elements: \d+\]$/);
    [description, storedDescription].forEach((text) => {
      expect(text).to.not.include(SyntheticElements.PatientID);
      expect(text).to.not.include('SYNTHETIC^PATIENT');
    });
  });

  it('should refuse stored bytes that are not a part10 file with a file meta information group length', () => {
    const fileBytes = fs.readFileSync(file('fileIn.dcm'));
    const withoutPrefix = Buffer.from(fileBytes);
    withoutPrefix.write('XXXX', 128, 'latin1');
    const withoutGroupLength = Buffer.from(fileBytes);
    withoutGroupLength.writeUInt16LE(0x0001, 134);
    const groupLengthPastEnd = Buffer.from(fileBytes);
    groupLengthPastEnd.writeUInt32LE(fileBytes.length, 140);

    expect(() => Dataset.fromStoredPart10(Buffer.alloc(10))).to.throw(/not a part10 file/);
    expect(() => Dataset.fromStoredPart10(withoutPrefix)).to.throw(/not a part10 file/);
    expect(() => Dataset.fromStoredPart10(withoutGroupLength)).to.throw(/no file meta information group length/);
    expect(() => Dataset.fromStoredPart10(groupLengthPastEnd)).to.throw(/runs past the end/);
  });

  it('should read DICOM part10 files asynchronously', withDone((done) => {
    Dataset.fromFile(file('fileIn.dcm'), (err, dataset1) => {
      const elements1 = dataset1.getElements();
      delete elements1._vrMap;
      expect(err).to.be.undefined;
      expect(Object.keys(elements1)).to.have.members(Object.keys(SyntheticElements));
      expect(dataset1.getElement('PatientID')).to.be.eq(SyntheticElements.PatientID);

      Dataset.fromFile(file('fileInEmpty.dcm'), (err2, dataset2) => {
        expect(err2).not.to.be.undefined;
        expect(dataset2).to.be.undefined;
        done();
      });
    });
  }));
});
