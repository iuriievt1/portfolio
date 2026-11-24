const Dataset = require('./../src/Dataset');

const dcmjs = require('@veevoy/dcmjs');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { DicomDict, DicomMetaDictionary } = dcmjs.data;

// Synthetic implementation identity of the tests, under the UUID-derived root 2.25
const TestImplementationClassUid = '2.25.112093717208913938302837463011232398412';
const TestImplementationVersion = 'FORK-TEST';

/**
 * Gets the client options of the tests: the given ones with the implementation identity of the tests.
 * @param {Object} [opts] - Client options.
 * @returns {Object} Client options.
 */
function clientOptions(opts) {
  return { implementationClassUid: TestImplementationClassUid, ...opts };
}

/**
 * Runs a callback-style test body as a promise.
 * @param {function(function(Error=))} body - Test body that calls `done` when finished.
 * @returns {function(): Promise<void>} Test function.
 */
function withDone(body) {
  return () =>
    new Promise((resolve, reject) => {
      const done = (error) => (error ? reject(error) : resolve());
      try {
        body(done);
      } catch (error) {
        reject(error);
      }
    });
}

/**
 * Creates an empty temporary directory.
 * @returns {string} Directory path.
 */
function temporaryDirectory() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'dcmjs-dimse-'));
}

/**
 * Writes the elements as a part10 file, with dcmjs and not with the fork, which has no part10 writing.
 * @param {string} file - File path.
 * @param {Object} elements - Dataset elements.
 * @param {string} transferSyntaxUid - Transfer syntax UID of the file.
 */
function writePart10File(file, elements, transferSyntaxUid) {
  const meta = {
    FileMetaInformationVersion: new Uint8Array([0, 1]).buffer,
    MediaStorageSOPClassUID: elements.SOPClassUID,
    MediaStorageSOPInstanceUID: elements.SOPInstanceUID,
    TransferSyntaxUID: transferSyntaxUid,
    ImplementationClassUID: TestImplementationClassUid,
    ImplementationVersionName: TestImplementationVersion,
  };
  const dicomDict = new DicomDict(DicomMetaDictionary.denaturalizeDataset(meta));
  dicomDict.dict = DicomMetaDictionary.denaturalizeDataset(elements);
  fs.writeFileSync(file, Buffer.from(dicomDict.write()));
}

/**
 * Writes the elements as a part10 file in a new temporary directory.
 * @param {Object} elements - Dataset elements.
 * @param {string} transferSyntaxUid - Transfer syntax UID of the file.
 * @returns {string} File path.
 */
function part10File(elements, transferSyntaxUid) {
  const file = path.join(temporaryDirectory(), 'stored.dcm');
  writePart10File(file, elements, transferSyntaxUid);
  return file;
}

/**
 * Creates a stored dataset from the elements written as a part10 file.
 * @param {Object} elements - Dataset elements.
 * @param {string} transferSyntaxUid - Transfer syntax UID of the file.
 * @returns {Dataset} Stored dataset.
 */
function storedDataset(elements, transferSyntaxUid) {
  const file = part10File(elements, transferSyntaxUid);
  const dataset = Dataset.fromStoredPart10(fs.readFileSync(file));
  fs.rmSync(path.dirname(file), { recursive: true, force: true });
  return dataset;
}

module.exports = {
  clientOptions,
  part10File,
  storedDataset,
  temporaryDirectory,
  TestImplementationClassUid,
  TestImplementationVersion,
  withDone,
  writePart10File,
};
