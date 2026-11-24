const { TransferSyntax } = require('./Constants');

const { readFile, readFileSync } = require('fs');
const dcmjs = require('@veevoy/dcmjs');
const { DicomMessage, DicomMetaDictionary, ReadBufferStream, WriteBufferStream } = dcmjs.data;
const dcmjsLog = dcmjs.log;

const Part10PreambleLength = 128;
const Part10Prefix = 'DICM';
const MetaGroupLengthElementLength = 12;
// The Specific Character Set element and the spaces around a CS value, which are not significant (PS3.5 6.2)
const SpecificCharacterSetTag = '00080005';
const InsignificantSpaces = /^ +| +$/g;
const StoredDatasetError =
  'A stored dataset is sent as stored; it cannot be changed or re-encoded';

//#region Dataset
class Dataset {
  /**
   * Creates an instance of Dataset.
   * @constructor
   * @param {Object|Buffer} [elementsOrBuffer] - Dataset elements as object or encoded as a DICOM dataset buffer.
   * @param {string} [transferSyntaxUid] - Dataset transfer syntax UID.
   * @param {Object} [readOptions] - The read options to pass through to `DicomMessage._read()`.
   */
  constructor(elementsOrBuffer, transferSyntaxUid, readOptions) {
    readOptions = readOptions || {};
    const baseOptions = { ignoreErrors: true };
    readOptions = { ...baseOptions, ...readOptions };

    dcmjsLog.level = 'error';

    this.transferSyntaxUid = transferSyntaxUid || TransferSyntax.ImplicitVRLittleEndian;
    this.storedDataset = undefined;
    this.receivedSpecificCharacterSet = undefined;
    if (Buffer.isBuffer(elementsOrBuffer)) {
      this.elements = this._fromElementsBuffer(
        elementsOrBuffer,
        this.transferSyntaxUid,
        readOptions
      );
      return;
    }

    this.elements = elementsOrBuffer || {};
  }

  /**
   * Gets element value.
   * @method
   * @param {string} tag - Element tag.
   * @returns {string|undefined} Element value or undefined if element doesn't exist.
   */
  getElement(tag) {
    return this.elements[tag];
  }

  /**
   * Sets element value.
   * @method
   * @param {string} tag - Element tag.
   * @param {string} value - Element value.
   */
  setElement(tag, value) {
    if (this.isStored()) {
      throw new Error(StoredDatasetError);
    }
    this.elements[tag] = value;
  }

  /**
   * Gets all elements.
   * @method
   * @returns {Object} Elements.
   */
  getElements() {
    return this.elements;
  }

  /**
   * Gets the Specific Character Set (0008,0005) of the dataset as it was received, read from its bytes:
   * dcmjs decodes the text with it and then sets the element to ISO_IR 192, as the decoded text is Unicode.
   * Leading and trailing spaces of each value are removed, as they are not significant (PS3.5 6.2, CS).
   * @method
   * @returns {string|undefined} The values joined by a backslash, an empty string for an empty element,
   * or undefined if the dataset was not read from bytes or the element was not in them.
   */
  getReceivedSpecificCharacterSet() {
    return this.receivedSpecificCharacterSet;
  }

  /**
   * Gets DICOM transfer syntax UID.
   * @method
   * @returns {string} Transfer syntax UID.
   */
  getTransferSyntaxUid() {
    return this.transferSyntaxUid;
  }

  /**
   * Sets DICOM transfer syntax UID.
   * @method
   * @param {string} transferSyntaxUid - Transfer Syntax UID.
   */
  setTransferSyntaxUid(transferSyntaxUid) {
    if (this.isStored()) {
      throw new Error(StoredDatasetError);
    }
    this.transferSyntaxUid = transferSyntaxUid;
  }

  /**
   * Checks whether the dataset carries the stored bytes of a part10 file.
   * @method
   * @returns {boolean} A flag indicating whether the dataset is stored.
   */
  isStored() {
    return this.storedDataset !== undefined;
  }

  /**
   * Gets the stored dataset bytes, the part10 file without its preamble and file meta information.
   * @method
   * @returns {Buffer} Stored dataset bytes.
   * @throws {Error} If the dataset is not stored.
   */
  getStoredDataset() {
    if (!this.isStored()) {
      throw new Error('The dataset is not stored');
    }
    return this.storedDataset;
  }

  /**
   * Gets elements encoded in a DICOM dataset buffer.
   * @method
   * @param {Object} [writeOptions] - The write options to pass through to `DicomMessage.write()`.
   * @param {Object} [nameMap] - Additional DICOM tags to recognize when denaturalizing the dataset.
   * @returns {Buffer} DICOM dataset.
   */
  getDenaturalizedDataset(writeOptions, nameMap) {
    if (this.isStored()) {
      throw new Error(StoredDatasetError);
    }
    const denaturalizedDataset = nameMap
      ? DicomMetaDictionary.denaturalizeDataset(this.getElements(), {
          ...DicomMetaDictionary.nameMap,
          ...nameMap,
        })
      : DicomMetaDictionary.denaturalizeDataset(this.getElements());

    const stream = new WriteBufferStream();
    DicomMessage.write(denaturalizedDataset, stream, this.transferSyntaxUid, writeOptions);

    return Buffer.from(stream.getBuffer());
  }

  /**
   * Gets command elements encoded in a DICOM dataset buffer.
   * @method
   * @param {Object} [writeOptions] - The write options to pass through to `DicomMessage.write()` and `DicomMessage.writeTagObject()`.
   * @returns {Buffer} DICOM dataset.
   */
  getDenaturalizedCommandDataset(writeOptions) {
    const denaturalizedDataset = DicomMetaDictionary.denaturalizeDataset(this.getElements());

    const datasetStream = new WriteBufferStream();
    const elementsStream = new WriteBufferStream();
    DicomMessage.write(
      denaturalizedDataset,
      elementsStream,
      TransferSyntax.ImplicitVRLittleEndian,
      writeOptions
    );
    DicomMessage.writeTagObject(
      datasetStream,
      '00000000',
      'UL',
      elementsStream.size,
      TransferSyntax.ImplicitVRLittleEndian,
      writeOptions
    );
    datasetStream.concat(elementsStream);

    return Buffer.from(datasetStream.getBuffer());
  }

  /**
   * Loads a dataset from DICOM P10 file.
   * @method
   * @static
   * @param {string} path - P10 file path.
   * @param {function(Error, Dataset)} [callback] - P10 file reading callback function.
   * If this is not provided, the function runs synchronously.
   * @param {Object} [readOptions] - The read options to pass through to `DicomMessage.readFile()`.
   * @returns {Dataset|undefined} Dataset or undefined, if the function runs asynchronously.
   */
  static fromFile(path, callback, readOptions) {
    if (callback !== undefined && callback instanceof Function) {
      readFile(path, (error, fileBuffer) => {
        if (error) {
          callback(error, undefined);
          return;
        }

        try {
          callback(undefined, this._fromP10Buffer(fileBuffer, readOptions));
        } catch (err) {
          callback(err, undefined);
        }
      });
      return;
    }

    return this._fromP10Buffer(readFileSync(path), readOptions);
  }

  /**
   * Generates a UUID-derived UID.
   * @method
   * @static
   * @returns {string} UUID-derived UID.
   */
  static generateDerivedUid() {
    return DicomMetaDictionary.uid();
  }

  /**
   * Creates a stored dataset from the bytes of a part10 file.
   * The bytes after the file meta information are kept as they are and sent on the wire unchanged;
   * only the elements up to SOP Instance UID are read, to address the dataset.
   * @method
   * @static
   * @param {Buffer} buffer - Part10 file bytes.
   * @param {Object} [readOptions] - The read options to pass through to `DicomMessage.readFile()`.
   * @returns {Dataset} Stored dataset.
   * @throws {Error} If the buffer is not a part10 file with a file meta information group length.
   */
  static fromStoredPart10(buffer, readOptions) {
    const datasetOffset = this._storedDatasetOffset(buffer);
    const header = this._fromP10Buffer(buffer, {
      ...(readOptions || {}),
      untilTag: '00080018', // SOPInstanceUID
      includeUntilTagValue: true,
    });
    header.storedDataset = buffer.subarray(datasetOffset);
    return header;
  }

  /**
   * Gets the dataset description.
   * It carries no element values, which hold patient identifiers that do not go into a log.
   * @method
   * @returns {string} Dataset description.
   */
  toString() {
    const elements = Object.keys(this.getElements()).filter((name) => !name.startsWith('_'));
    return `(Dataset) [transfer syntax: ${this.getTransferSyntaxUid()}, stored: ${this.isStored()}, elements: ${elements.length}]`;
  }

  //#region Private Methods
  /**
   * Gets the offset of the dataset in part10 file bytes, right after the file meta information.
   * @method
   * @static
   * @private
   * @param {Buffer} buffer - Part10 file bytes.
   * @returns {number} Dataset offset.
   * @throws {Error} If the buffer is not a part10 file with a file meta information group length.
   */
  static _storedDatasetOffset(buffer) {
    const groupLengthOffset = Part10PreambleLength + Part10Prefix.length;
    if (
      buffer.length < groupLengthOffset + MetaGroupLengthElementLength ||
      buffer.toString('latin1', Part10PreambleLength, groupLengthOffset) !== Part10Prefix
    ) {
      throw new Error('The stored bytes are not a part10 file');
    }
    if (
      buffer.readUInt16LE(groupLengthOffset) !== 0x0002 ||
      buffer.readUInt16LE(groupLengthOffset + 2) !== 0x0000 ||
      buffer.toString('latin1', groupLengthOffset + 4, groupLengthOffset + 6) !== 'UL'
    ) {
      throw new Error('The part10 file has no file meta information group length');
    }
    const datasetOffset =
      groupLengthOffset +
      MetaGroupLengthElementLength +
      buffer.readUInt32LE(groupLengthOffset + 8);
    if (datasetOffset > buffer.length) {
      throw new Error('The file meta information group length runs past the end of the part10 file');
    }
    return datasetOffset;
  }

  /**
   * Creates a dataset from p10 buffer.
   * @method
   * @static
   * @private
   * @param {Buffer} buffer - p10 buffer.
   * @param {Object} [readOptions] - The read options to pass through to `DicomMessage.readFile()`.
   * @returns {Dataset} Dataset.
   */
  static _fromP10Buffer(buffer, readOptions) {
    readOptions = readOptions || {};
    const baseOptions = { ignoreErrors: true };
    readOptions = { ...baseOptions, ...readOptions };

    const dicomDict = DicomMessage.readFile(
      buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
      readOptions
    );
    const meta = DicomMetaDictionary.naturalizeDataset(dicomDict.meta);
    const transferSyntaxUid = meta.TransferSyntaxUID;
    const elements = DicomMetaDictionary.naturalizeDataset(dicomDict.dict);

    return new Dataset(elements, transferSyntaxUid);
  }

  /**
   * Loads a dataset from elements only buffer.
   * @method
   * @private
   * @param {Buffer} buffer - Elements buffer.
   * @param {string} transferSyntaxUid - Transfer Syntax UID.
   * @param {Object} [readOptions] - The read options to pass through to `DicomMessage._read()`.
   * @returns {Object} Dataset elements.
   */
  _fromElementsBuffer(buffer, transferSyntaxUid, readOptions) {
    const stream = new ReadBufferStream(
      buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
    );
    // Use the proper encoding and endianness (based on transfer syntax UID)
    // since dcmjs doesn't do that internally.
    const syntaxTypeToDecode =
      transferSyntaxUid === TransferSyntax.ImplicitVRLittleEndian
        ? TransferSyntax.ImplicitVRLittleEndian
        : transferSyntaxUid === TransferSyntax.ExplicitVRBigEndian
          ? TransferSyntax.ExplicitVRBigEndian
          : TransferSyntax.ExplicitVRLittleEndian;
    const denaturalizedDataset = DicomMessage._read(stream, syntaxTypeToDecode, readOptions);
    // dcmjs reading with ignoreErrors stops at an error and returns what it read so far, so a data set it did
    // not read to the end lost its later elements; only reading until a tag stops early on purpose
    if (!readOptions.untilTag && !stream.end()) {
      throw new Error(`The data set could not be read past offset ${stream.offset} of ${stream.size}`);
    }
    const specificCharacterSet = denaturalizedDataset[SpecificCharacterSetTag];
    if (specificCharacterSet !== undefined) {
      this.receivedSpecificCharacterSet = (specificCharacterSet._rawValue || [])
        .map((value) => String(value).replace(InsignificantSpaces, ''))
        .join('\\');
    }

    return DicomMetaDictionary.naturalizeDataset(denaturalizedDataset);
  }
  //#endregion
}
//#endregion

//#region Exports
module.exports = Dataset;
//#endregion
