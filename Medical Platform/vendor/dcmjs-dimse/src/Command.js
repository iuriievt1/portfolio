const { CommandFieldType, Priority, SopClass, Status } = require('./Constants');
const Dataset = require('./Dataset');

const { Mixin } = require('ts-mixer');
const { readFileSync } = require('fs');
const { createHash } = require('crypto');
const AsyncEventEmitter2 = require('async-event-emitter2');

//#region Command
class Command {
  /**
   * Creates an instance of Command.
   * @constructor
   * @param {Dataset} [commandDataset] - Command dataset.
   * @param {Dataset} [dataset] - Dataset.
   */
  constructor(commandDataset, dataset) {
    this.commandDataset = commandDataset || new Dataset();
    this.dataset = dataset;
  }

  /**
   * Gets command dataset.
   * @method
   * @returns {Dataset} Command dataset.
   */
  getCommandDataset() {
    return this.commandDataset;
  }

  /**
   * Sets command dataset.
   * @method
   * @param {Dataset} dataset - Command dataset.
   */
  setCommandDataset(dataset) {
    this.commandDataset = dataset;
  }

  /**
   * Gets dataset.
   * @method
   * @returns {Dataset|undefined} Dataset, if exists.
   */
  getDataset() {
    return this.dataset;
  }

  /**
   * Sets dataset and updates CommandDataSetType element.
   * @method
   * @param {Dataset} dataset - Dataset.
   */
  setDataset(dataset) {
    this.dataset = dataset;
    this.commandDataset.setElement('CommandDataSetType', this.dataset ? 0x0202 : 0x0101);
  }

  /**
   * Gets command field type.
   * @method
   * @returns {number} Command field type.
   */
  getCommandFieldType() {
    return this.commandDataset.getElement('CommandField');
  }

  /**
   * Command has dataset.
   * @method
   * @returns {boolean} Command has dataset.
   */
  hasDataset() {
    return this.commandDataset.getElement('CommandDataSetType') !== 0x0101;
  }

  /**
   * Gets the command description.
   * It carries no element values: a dataset holds patient identifiers and a response its error
   * comment, neither of which goes into a log.
   * @method
   * @returns {string} Command description.
   */
  toString() {
    return `${this._typeToString(this.getCommandFieldType())} [HasDataset: ${this.hasDataset()}]`;
  }

  //#region Private Methods
  /**
   * Returns a readable string from message type.
   * @method
   * @private
   * @param {number} type - Command field type.
   * @returns {string} Readable string.
   */
  _typeToString(type) {
    switch (type) {
      case CommandFieldType.CCancelRequest:
        return 'C-CANCEL RQ';
      case CommandFieldType.CEchoRequest:
        return 'C-ECHO RQ';
      case CommandFieldType.CEchoResponse:
        return 'C-ECHO RSP';
      case CommandFieldType.CFindRequest:
        return 'C-FIND RQ';
      case CommandFieldType.CFindResponse:
        return 'C-FIND RSP';
      case CommandFieldType.CGetRequest:
        return 'C-GET RQ';
      case CommandFieldType.CGetResponse:
        return 'C-GET RSP';
      case CommandFieldType.CMoveRequest:
        return 'C-MOVE RQ';
      case CommandFieldType.CMoveResponse:
        return 'C-MOVE RSP';
      case CommandFieldType.CStoreRequest:
        return 'C-STORE RQ';
      case CommandFieldType.CStoreResponse:
        return 'C-STORE RSP';
      case CommandFieldType.NActionRequest:
        return 'N-ACTION RQ';
      case CommandFieldType.NActionResponse:
        return 'N-ACTION RSP';
      case CommandFieldType.NCreateRequest:
        return 'N-CREATE RQ';
      case CommandFieldType.NCreateResponse:
        return 'N-CREATE RSP';
      case CommandFieldType.NDeleteRequest:
        return 'N-DELETE RQ';
      case CommandFieldType.NDeleteResponse:
        return 'N-DELETE RSP';
      case CommandFieldType.NEventReportRequest:
        return 'N-EVENT-REPORT RQ';
      case CommandFieldType.NEventReportResponse:
        return 'N-EVENT-REPORT RSP';
      case CommandFieldType.NGetRequest:
        return 'N-GET RQ';
      case CommandFieldType.NGetResponse:
        return 'N-GET RSP';
      case CommandFieldType.NSetRequest:
        return 'N-SET RQ';
      case CommandFieldType.NSetResponse:
        return 'N-SET RSP';
      default:
        return `${type}`;
    }
  }
  //#endregion
}
//#endregion

//#region Request
class Request extends Mixin(Command, AsyncEventEmitter2) {
  /**
   * Creates an instance of Request.
   * @constructor
   * @param {number} type - Command field type.
   * @param {string} affectedSopClassUid - Affected SOP Class UID.
   * @param {boolean} hasDataset - Request has dataset.
   */
  constructor(type, affectedSopClassUid, hasDataset) {
    super(
      new Dataset({
        CommandField: type,
        CommandDataSetType: hasDataset ? 0x0202 : 0x0101,
      })
    );
    this.setAffectedSopClassUid(affectedSopClassUid);
    this.commandBytesSent = 0;
    this.datasetBytesSent = 0;
    this.sentDatasetHash = createHash('sha256');
  }

  /**
   * Gets the number of command bytes handed to the operating system, PDU and PDV headers not included.
   * @method
   * @returns {number} Command bytes sent.
   */
  getCommandBytesSent() {
    return this.commandBytesSent;
  }

  /**
   * Gets the number of dataset bytes handed to the operating system, PDU and PDV headers not included.
   * Handed to the operating system does not mean received by the peer (integrace-dicom.md 6.2).
   * @method
   * @returns {number} Dataset bytes sent.
   */
  getDatasetBytesSent() {
    return this.datasetBytesSent;
  }

  /**
   * Gets the SHA-256 of the dataset bytes handed to the operating system so far, in the order they were sent,
   * PDU and PDV headers not included (integrace-dicom.md 6.2, 9.1).
   * @method
   * @returns {string|undefined} Lowercase hexadecimal SHA-256, or undefined if no dataset byte was sent.
   */
  getSentDatasetSha256() {
    if (this.datasetBytesSent === 0) {
      return undefined;
    }
    return this.sentDatasetHash.copy().digest('hex');
  }

  /**
   * Counts a fragment of the request once it is handed to the operating system.
   * @method
   * @param {boolean} isCommand - Whether the fragment is of the command or of the dataset.
   * @param {Buffer} fragment - Fragment bytes.
   */
  countSentBytes(isCommand, fragment) {
    if (isCommand) {
      this.commandBytesSent += fragment.length;
      return;
    }
    this.datasetBytesSent += fragment.length;
    this.sentDatasetHash.update(fragment);
  }

  /**
   * Gets affected SOP class UID.
   * @method
   * @returns {string} Affected SOP class UID.
   */
  getAffectedSopClassUid() {
    const command = this.getCommandDataset();
    return command.getElement('AffectedSOPClassUID');
  }

  /**
   * Sets affected SOP class UID.
   * @method
   * @param {string} affectedSopClassUid - Affected SOP class UID.
   */
  setAffectedSopClassUid(affectedSopClassUid) {
    const command = this.getCommandDataset();
    command.setElement('AffectedSOPClassUID', affectedSopClassUid);
  }

  /**
   * Gets affected SOP instance UID.
   * @method
   * @returns {string} Affected SOP instance UID.
   */
  getAffectedSopInstanceUid() {
    const command = this.getCommandDataset();
    return command.getElement('AffectedSOPInstanceUID');
  }

  /**
   * Sets affected SOP instance UID.
   * @method
   * @param {string} affectedSopInstanceUid - Affected SOP instance UID.
   */
  setAffectedSopInstanceUid(affectedSopInstanceUid) {
    const command = this.getCommandDataset();
    command.setElement('AffectedSOPInstanceUID', affectedSopInstanceUid);
  }

  /**
   * Gets request message ID.
   * @method
   * @return {number} Request message ID.
   */
  getMessageId() {
    const command = this.getCommandDataset();
    return command.getElement('MessageID');
  }

  /**
   * Sets request message ID.
   * @method
   * @param {number} messageId - Request message ID.
   */
  setMessageId(messageId) {
    const command = this.getCommandDataset();
    command.setElement('MessageID', messageId);
  }

  /**
   * Raise response event.
   * @method
   * @param {Response} response - Response.
   */
  raiseResponseEvent(response) {
    this.emit('response', response);
  }

  /**
   * Raise done event.
   * @method
   */
  raiseDoneEvent() {
    this.emit('done');
  }

  /**
   * Raise not sent event.
   * Raised before the done event when no byte of the request's dataset left for the peer.
   * @method
   * @param {NotSentReason} reason - Why the request was not sent.
   */
  raiseNotSentEvent(reason) {
    this.emit('notSent', reason);
  }

  /**
   * Gets the request description.
   * @method
   * @return {string} Request description.
   */
  toString() {
    return `${super.toString()} [id: ${this.getMessageId() || ''}]`;
  }
}
//#endregion

//#region Response
class Response extends Command {
  /**
   * Creates an instance of Response.
   * @constructor
   * @param {number} type - Command field type.
   * @param {string} affectedSopClassUid - Affected SOP Class UID.
   * @param {boolean} hasDataset - Response has dataset.
   * @param {number} status - Response status.
   * @param {string} errorComment - Response error comment.
   */
  constructor(type, affectedSopClassUid, hasDataset, status, errorComment) {
    super(
      new Dataset({
        CommandField: type,
        CommandDataSetType: hasDataset ? 0x0202 : 0x0101,
        Status: status,
        ErrorComment: errorComment,
      })
    );
    this.setAffectedSopClassUid(affectedSopClassUid);
  }

  /**
   * Gets affected SOP class UID.
   * @method
   * @returns {string} Affected SOP class UID.
   */
  getAffectedSopClassUid() {
    const command = this.getCommandDataset();
    return command.getElement('AffectedSOPClassUID');
  }

  /**
   * Sets affected SOP class UID.
   * @method
   * @param {string} affectedSopClassUid - Affected SOP class UID.
   */
  setAffectedSopClassUid(affectedSopClassUid) {
    const command = this.getCommandDataset();
    command.setElement('AffectedSOPClassUID', affectedSopClassUid);
  }

  /**
   * Gets affected SOP instance UID.
   * @method
   * @returns {string} Affected SOP instance UID.
   */
  getAffectedSopInstanceUid() {
    const command = this.getCommandDataset();
    return command.getElement('AffectedSOPInstanceUID');
  }

  /**
   * Sets affected SOP instance UID.
   * @method
   * @param {string} affectedSopInstanceUid - Affected SOP instance UID.
   */
  setAffectedSopInstanceUid(affectedSopInstanceUid) {
    const command = this.getCommandDataset();
    command.setElement('AffectedSOPInstanceUID', affectedSopInstanceUid);
  }

  /**
   * Gets status.
   * @method
   * @returns {number} Status.
   */
  getStatus() {
    const command = this.getCommandDataset();
    return command.getElement('Status');
  }

  /**
   * Sets status.
   * @method
   * @param {number} status - Status.
   */
  setStatus(status) {
    const command = this.getCommandDataset();
    command.setElement('Status', status);
  }

  /**
   * Gets error comment.
   * @method
   * @returns {string} Error comment.
   */
  getErrorComment() {
    const command = this.getCommandDataset();
    return command.getElement('ErrorComment');
  }

  /**
   * Sets error comment.
   * @method
   * @param {string} errorComment - Error comment.
   */
  setErrorComment(errorComment) {
    const command = this.getCommandDataset();
    command.setElement('ErrorComment', errorComment);
  }

  /**
   * Gets response message ID.
   * @method
   * @return {number} Response message ID.
   */
  getMessageIdBeingRespondedTo() {
    const command = this.getCommandDataset();
    return command.getElement('MessageIDBeingRespondedTo');
  }

  /**
   * Sets response message ID.
   * @method
   * @param {number} messageId - Response message ID.
   */
  setMessageIdBeingRespondedTo(messageId) {
    const command = this.getCommandDataset();
    command.setElement('MessageIDBeingRespondedTo', messageId);
  }

  /**
   * Gets the response description.
   * @method
   * @return {string} Response description.
   */
  toString() {
    return `${super.toString()} [id: ${
      this.getMessageIdBeingRespondedTo() || ''
    }; status: ${this._statusToString(this.getStatus())}]`;
  }

  //#region Private Methods
  /**
   * Returns a readable string from status.
   * @method
   * @private
   * @param {number} status - Status code.
   * @returns {string} Readable status string.
   */
  _statusToString(status) {
    switch (status) {
      case Status.Success:
        return 'Success';
      case Status.Cancel:
        return 'Cancel';
      case Status.Pending:
        return 'Pending';
      case Status.PendingWarning:
        return 'Pending Warning';
      case Status.SopClassNotSupported:
        return 'SOP Class Not Supported';
      case Status.ClassInstanceConflict:
        return 'Class Instance Conflict';
      case Status.DuplicateSOPInstance:
        return 'Duplicate SOP Instance';
      case Status.DuplicateInvocation:
        return 'Duplicate Invocation';
      case Status.InvalidArgumentValue:
        return 'Invalid Argument Value';
      case Status.InvalidAttributeValue:
        return 'Invalid Attribute Value';
      case Status.InvalidObjectInstance:
        return 'Invalid Object Instance';
      case Status.MissingAttribute:
        return 'Missing Attribute';
      case Status.MissingAttributeValue:
        return 'Missing Attribute Value';
      case Status.MistypedArgument:
        return 'Mistyped Argument';
      case Status.NoSuchArgument:
        return 'No Such Argument';
      case Status.NoSuchEventType:
        return 'No Such Event Type';
      case Status.NoSuchObjectInstance:
        return 'No Such Object Instance';
      case Status.NoSuchSopClass:
        return 'No Such SOP Class';
      case Status.ProcessingFailure:
        return 'Processing Failure';
      case Status.ResourceLimitation:
        return 'Resource Limitation';
      case Status.UnrecognizedOperation:
        return 'Unrecognized Operation';
      case Status.NoSuchActionType:
        return 'No Such Action Type';
      default:
        return `${status}`;
    }
  }
  //#endregion
}
//#endregion

//#region CEchoRequest
class CEchoRequest extends Request {
  /**
   * Creates an instance of CEchoRequest.
   * @constructor
   */
  constructor() {
    super(CommandFieldType.CEchoRequest, SopClass.Verification, false);
  }
}
//#endregion

//#region CEchoResponse
class CEchoResponse extends Response {
  /**
   * Creates an instance of CEchoResponse.
   * @constructor
   * @param {number} status - Response status.
   * @param {string} errorComment - Error comment.
   */
  constructor(status, errorComment) {
    super(CommandFieldType.CEchoResponse, SopClass.Verification, false, status, errorComment);
  }
}
//#endregion

//#region CFindRequest
class CFindRequest extends Request {
  /**
   * Creates an instance of CFindRequest.
   * @constructor
   * @param {Priority} [priority] - Request priority.
   */
  constructor(priority) {
    super(
      CommandFieldType.CFindRequest,
      SopClass.StudyRootQueryRetrieveInformationModelFind,
      false
    );
    this.setPriority(priority || Priority.Medium);
  }

  /**
   * Gets request priority.
   * @method
   * @return {Priority} Request priority.
   */
  getPriority() {
    const command = this.getCommandDataset();
    return command.getElement('Priority');
  }

  /**
   * Sets request priority.
   * @method
   * @param {Priority} priority - Request request priority.
   */
  setPriority(priority) {
    const command = this.getCommandDataset();
    command.setElement('Priority', priority);
  }

  /**
   * Creates study find request.
   * @method
   * @static
   * @param {Object} elements - Find request dataset elements.
   * @param {Priority} [priority] - Request priority.
   * @return {CFindRequest} Study find request.
   */
  static createStudyFindRequest(elements, priority) {
    const baseElements = {
      PatientID: '',
      PatientName: '',
      IssuerOfPatientID: '',
      PatientSex: '',
      PatientBirthDate: '',
      StudyInstanceUID: '',
      ModalitiesInStudy: '',
      StudyID: '',
      AccessionNumber: '',
      StudyDate: '',
      StudyTime: '',
      StudyDescription: '',
      NumberOfStudyRelatedSeries: '',
      NumberOfStudyRelatedInstances: '',
    };
    const mergedElements = { ...baseElements, ...elements };
    mergedElements.QueryRetrieveLevel = 'STUDY';

    const findRequest = new CFindRequest(priority);
    findRequest.setDataset(new Dataset(mergedElements));

    return findRequest;
  }

  /**
   * Creates series find request.
   * @method
   * @static
   * @param {Object} elements - Find request dataset elements.
   * @param {Priority} [priority] - Request priority.
   * @return {CFindRequest} Series find request.
   */
  static createSeriesFindRequest(elements, priority) {
    const baseElements = {
      StudyInstanceUID: '',
      SeriesInstanceUID: '',
      SeriesNumber: '',
      SeriesDescription: '',
      Modality: '',
      SeriesDate: '',
      SeriesTime: '',
      NumberOfSeriesRelatedInstances: '',
    };
    const mergedElements = { ...baseElements, ...elements };
    mergedElements.QueryRetrieveLevel = 'SERIES';

    const findRequest = new CFindRequest(priority);
    findRequest.setDataset(new Dataset(mergedElements));

    return findRequest;
  }

  /**
   * Creates image find request.
   * @method
   * @static
   * @param {Object} elements - Find request dataset elements.
   * @param {Priority} [priority] - Request priority.
   * @return {CFindRequest} Image find request.
   */
  static createImageFindRequest(elements, priority) {
    const baseElements = {
      StudyInstanceUID: '',
      SeriesInstanceUID: '',
      SOPInstanceUID: '',
      InstanceNumber: '',
      Modality: '',
    };
    const mergedElements = { ...baseElements, ...elements };
    mergedElements.QueryRetrieveLevel = 'IMAGE';

    const findRequest = new CFindRequest(priority);
    findRequest.setDataset(new Dataset(mergedElements));

    return findRequest;
  }

  /**
   * Creates worklist find request.
   * @method
   * @static
   * @param {Object} elements - Find request dataset elements.
   * @param {Priority} [priority] - Request priority.
   * @return {CFindRequest} Worklist find request.
   */
  static createWorklistFindRequest(elements, priority) {
    const baseElements = {
      PatientID: '',
      PatientName: '',
      IssuerOfPatientID: '',
      PatientSex: '',
      PatientWeight: '',
      PatientBirthDate: '',
      MedicalAlerts: '',
      PregnancyStatus: '',
      Allergies: '',
      PatientComments: '',
      SpecialNeeds: '',
      PatientState: '',
      CurrentPatientLocation: '',
      InstitutionName: '',
      AdmissionID: '',
      AccessionNumber: '',
      ReferringPhysicianName: '',
      AdmittingDiagnosesDescription: '',
      RequestingPhysician: '',
      StudyInstanceUID: '',
      StudyDescription: '',
      StudyID: '',
      ReasonForTheRequestedProcedure: '',
      StudyDate: '',
      StudyTime: '',

      RequestedProcedureID: '',
      RequestedProcedureDescription: '',
      RequestedProcedurePriority: '',
      RequestedProcedureCodeSequence: [],
      ReferencedStudySequence: [],
      ProcedureCodeSequence: [],

      ScheduledProcedureStepSequence: [
        {
          ScheduledStationAETitle: '',
          ScheduledStationName: '',
          ScheduledProcedureStepStartDate: '',
          ScheduledProcedureStepStartTime: '',
          Modality: '',
          ScheduledPerformingPhysicianName: '',
          ScheduledProcedureStepDescription: '',
          ScheduledProtocolCodeSequence: [],
          ScheduledProcedureStepLocation: '',
          ScheduledProcedureStepID: '',
          RequestedContrastAgent: '',
          PreMedication: '',
          AnatomicalOrientationType: '',
        },
      ],
    };
    const mergedElements = { ...baseElements, ...elements };
    mergedElements.QueryRetrieveLevel = '';

    const findRequest = new CFindRequest(priority);
    findRequest.setAffectedSopClassUid(SopClass.ModalityWorklistInformationModelFind);
    findRequest.setDataset(new Dataset(mergedElements));

    return findRequest;
  }
}
//#endregion

//#region CFindResponse
class CFindResponse extends Response {
  /**
   * Creates an instance of CEchoResponse.
   * @constructor
   * @param {number} status - Response status.
   * @param {string} errorComment - Error comment.
   */
  constructor(status, errorComment) {
    super(
      CommandFieldType.CFindResponse,
      SopClass.StudyRootQueryRetrieveInformationModelFind,
      false,
      status,
      errorComment
    );
  }
}
//#endregion

//#region CStoreRequest
class CStoreRequest extends Request {
  /**
   * Creates an instance of CStoreRequest.
   * Only stored bytes are sent, unchanged: a stored dataset (see `Dataset.fromStoredPart10`),
   * a part10 file or variants. Variants are stored datasets of one SOP instance, one per transfer syntax,
   * in order of preference; each variant gets its own presentation context and only the variant whose
   * context the peer accepted with exactly its transfer syntax is sent, once.
   * @constructor
   * @param {Dataset|string|Array<Dataset>} storedDatasetOrFileOrVariants - Stored dataset, part10 file path or variants.
   * @param {Priority} [priority] - Request priority.
   * @throws {Error} If there are no stored bytes to send, or the variants are not stored datasets
   * of one SOP instance in distinct transfer syntaxes.
   */
  constructor(storedDatasetOrFileOrVariants, priority) {
    super(CommandFieldType.CStoreRequest, '', false);
    this.setPriority(priority || Priority.Medium);
    this.selectedPresentationContextId = undefined;

    if (typeof storedDatasetOrFileOrVariants === 'string' || storedDatasetOrFileOrVariants instanceof String) {
      const dataset = Dataset.fromFile(storedDatasetOrFileOrVariants, undefined, {
        untilTag: '00080018', // SOPInstanceUID
        includeUntilTagValue: true,
      });
      this.variants = [dataset];
      this._setDatasetToStore(dataset);

      this.needsFullDatasetLoading = true;
      this.datasetOrFile = storedDatasetOrFileOrVariants;
      return;
    }

    const variants = Array.isArray(storedDatasetOrFileOrVariants)
      ? storedDatasetOrFileOrVariants
      : [storedDatasetOrFileOrVariants];
    CStoreRequest._checkVariants(variants);
    this.variants = [...variants];
    this._setDatasetToStore(this.variants[0]);
  }

  /**
   * Gets request priority.
   * @method
   * @return {Priority} Request priority.
   */
  getPriority() {
    const command = this.getCommandDataset();
    return command.getElement('Priority');
  }

  /**
   * Sets request priority.
   * @method
   * @param {Priority} priority - Request request priority.
   */
  setPriority(priority) {
    const command = this.getCommandDataset();
    command.setElement('Priority', priority);
  }

  /**
   * Gets the variants of the SOP instance, one per transfer syntax, in order of preference.
   * @method
   * @returns {Array<Dataset>} Variants.
   */
  getVariants() {
    return this.variants;
  }

  /**
   * Selects the accepted presentation context the request is sent on,
   * and with it the variant in the transfer syntax the context was accepted with.
   * @method
   * @param {PresentationContext} context - Accepted presentation context.
   * @throws {Error} If there is no variant in the accepted transfer syntax.
   */
  selectPresentationContext(context) {
    const acceptedTransferSyntaxUid = context.getAcceptedTransferSyntaxUid();
    const variant = this.variants.find(
      (candidate) => candidate.getTransferSyntaxUid() === acceptedTransferSyntaxUid
    );
    if (variant === undefined) {
      throw new Error(`There is no variant in the accepted transfer syntax ${acceptedTransferSyntaxUid}`);
    }
    this.setDataset(variant);
    this.selectedPresentationContextId = context.getPresentationContextId();
  }

  /**
   * Gets the ID of the accepted presentation context the request is sent on.
   * @method
   * @returns {number|undefined} Presentation context ID, if selected.
   */
  getSelectedPresentationContextId() {
    return this.selectedPresentationContextId;
  }

  /**
   * Loads the stored dataset when, during the command construction,
   * only the minimum necessary tags were loaded (e.g. loaded from file).
   * @method
   * @throws {Error} If the file cannot be read or no longer holds the announced SOP instance.
   */
  loadFullDatasetIfNeeded() {
    if (
      this.needsFullDatasetLoading !== undefined &&
      this.needsFullDatasetLoading === true &&
      this.datasetOrFile !== undefined &&
      this.datasetOrFile.trim() !== ''
    ) {
      const dataset = Dataset.fromStoredPart10(readFileSync(this.datasetOrFile));
      if (
        dataset.getElement('SOPClassUID') !== this.getAffectedSopClassUid() ||
        dataset.getElement('SOPInstanceUID') !== this.getAffectedSopInstanceUid() ||
        dataset.getTransferSyntaxUid() !== this.getDataset().getTransferSyntaxUid()
      ) {
        throw new Error(`File ${this.datasetOrFile} changed since the request was created`);
      }
      this.setDataset(dataset);
      this.variants = [dataset];
      this.needsFullDatasetLoading = false;
    }
  }

  //#region Private Methods
  /**
   * Sets the affected SOP class and instance UIDs and the dataset to send.
   * @method
   * @private
   * @param {Dataset} dataset - Dataset.
   */
  _setDatasetToStore(dataset) {
    this.setAffectedSopClassUid(dataset.getElement('SOPClassUID'));
    this.setAffectedSopInstanceUid(dataset.getElement('SOPInstanceUID'));
    this.setDataset(dataset);
  }

  /**
   * Checks that the variants are stored datasets of one SOP instance in distinct transfer syntaxes.
   * @method
   * @static
   * @private
   * @param {Array<Dataset>} variants - Variants.
   * @throws {Error} If the variants break the rule.
   */
  static _checkVariants(variants) {
    if (variants.length === 0) {
      throw new Error('A C-STORE request needs at least one variant');
    }
    if (!variants.every((variant) => variant instanceof Dataset && variant.isStored())) {
      throw new Error(
        'A C-STORE request sends only stored bytes: a stored dataset (Dataset.fromStoredPart10) or a part10 file'
      );
    }
    const [first] = variants;
    if (
      variants.some(
        (variant) =>
          variant.getElement('SOPClassUID') !== first.getElement('SOPClassUID') ||
          variant.getElement('SOPInstanceUID') !== first.getElement('SOPInstanceUID')
      )
    ) {
      throw new Error('The variants of a C-STORE request must be one SOP instance');
    }
    const transferSyntaxUids = variants.map((variant) => variant.getTransferSyntaxUid());
    if (new Set(transferSyntaxUids).size !== transferSyntaxUids.length) {
      throw new Error('The variants of a C-STORE request must be in distinct transfer syntaxes');
    }
  }
  //#endregion
}
//#endregion

//#region CStoreResponse
class CStoreResponse extends Response {
  /**
   * Creates an instance of CStoreResponse.
   * @constructor
   * @param {number} status - Response status.
   * @param {string} errorComment - Error comment.
   */
  constructor(status, errorComment) {
    super(CommandFieldType.CStoreResponse, '', false, status, errorComment);
  }
}
//#endregion

//#region CCancelRequest
class CCancelRequest extends Request {
  /**
   * Creates an instance of CCancelRequest.
   * @constructor
   * @param {string} affectedSopClassUid - Affected SOP class UID.
   * @param {number} messageId - Message ID to cancel.
   */
  constructor(affectedSopClassUid, messageId) {
    super(CommandFieldType.CCancelRequest, affectedSopClassUid, false);
    this.setMessageIdBeingRespondedTo(messageId);
  }

  /**
   * Gets message ID to cancel.
   * @method
   * @return {number} Message ID to cancel.
   */
  getMessageIdBeingRespondedTo() {
    const command = this.getCommandDataset();
    return command.getElement('MessageIDBeingRespondedTo');
  }

  /**
   * Sets message ID to cancel.
   * @method
   * @param {number} messageId - Message ID to cancel.
   */
  setMessageIdBeingRespondedTo(messageId) {
    const command = this.getCommandDataset();
    command.setElement('MessageIDBeingRespondedTo', messageId);
  }

  /**
   * Creates a C-CANCEL request from a C-FIND request.
   * @method
   * @static
   * @param {CFindRequest} request - C-FIND request.
   * @returns {CCancelRequest} C-CANCEL request.
   * @throws {Error} If request is not an instance of CFindRequest.
   */
  static fromRequest(request) {
    if (!(request instanceof CFindRequest)) {
      throw new Error('Request should be an instance of CFindRequest');
    }

    return new CCancelRequest(request.getAffectedSopClassUid(), request.getMessageId());
  }
}
//#endregion

//#region Exports
module.exports = {
  CCancelRequest,
  CEchoRequest,
  CEchoResponse,
  CFindRequest,
  CFindResponse,
  Command,
  CStoreRequest,
  CStoreResponse,
  Request,
  Response,
};
//#endregion
