import AsyncEventEmitter2 from 'async-event-emitter2';
import { Mixin } from 'ts-mixer';
import { Logger } from 'loglevel';

declare namespace PresentationContextResult {
  const Proposed: number;
  const Accept: number;
  const RejectUser: number;
  const RejectNoReason: number;
  const RejectAbstractSyntaxNotSupported: number;
  const RejectTransferSyntaxesNotSupported: number;
}

declare namespace UserIdentityType {
  const Username: number;
  const UsernameAndPasscode: number;
  const Kerberos: number;
  const Saml: number;
  const Jwt: number;
}

declare namespace AbortSource {
  const ServiceUser: number;
  const Unknown: number;
  const ServiceProvider: number;
}

declare namespace AbortReason {
  const NotSpecified: number;
  const UnrecognizedPdu: number;
  const UnexpectedPdu: number;
  const UnrecognizedPduParameter: number;
  const UnexpectedPduParameter: number;
  const InvalidPduParameter: number;
}

declare namespace RejectResult {
  const Permanent: number;
  const Transient: number;
}

declare namespace RejectSource {
  const ServiceUser: number;
  const ServiceProviderAcse: number;
  const ServiceProviderPresentation: number;
}

declare namespace RejectReason {
  const NoReasonGiven: number;
  const ApplicationContextNotSupported: number;
  const CallingAeNotRecognized: number;
  const CalledAeNotRecognized: number;
  const ProtocolVersionNotSupported: number;
  const TemporaryCongestion: number;
  const LocalLimitExceeded: number;
}

declare namespace Priority {
  const Low: number;
  const Medium: number;
  const High: number;
}

declare namespace Status {
  const Success: number;
  const Cancel: number;
  const Pending: number;
  const PendingWarning: number;
  const ClassInstanceConflict: number;
  const DataSetSopClassMismatch: number;
  const DuplicateSOPInstance: number;
  const DuplicateInvocation: number;
  const InvalidArgumentValue: number;
  const InvalidAttributeValue: number;
  const InvalidObjectInstance: number;
  const MissingAttribute: number;
  const MissingAttributeValue: number;
  const MistypedArgument: number;
  const MoveDestinationUnknown: number;
  const NoSuchActionType: number;
  const NoSuchArgument: number;
  const NoSuchEventType: number;
  const NoSuchObjectInstance: number;
  const NoSuchSopClass: number;
  const NotAuthorized: number;
  const OutOfResourcesNumberOfMatches: number;
  const OutOfResourcesSubOperations: number;
  const ProcessingFailure: number;
  const ResourceLimitation: number;
  const SopClassNotSupported: number;
  const UnrecognizedOperation: number;
}

declare namespace StorageClass {
  const BasicTextSrStorage: string;
  const BreastProjectionXRayImageStorageForPresentation: string;
  const BreastProjectionXRayImageStorageForProcessing: string;
  const BreastTomosynthesisImageStorage: string;
  const ChestCadSrStorage: string;
  const ComprehensiveSrStorage: string;
  const ComputedRadiographyImageStorage: string;
  const CtImageStorage: string;
  const DigitalIntraOralXRayImageStorageForPresentation: string;
  const DigitalIntraOralXRayImageStorageForProcessing: string;
  const DigitalMammographyXRayImageStorageForPresentation: string;
  const DigitalMammographyXRayImageStorageForProcessing: string;
  const DigitalXRayImageStorageForPresentation: string;
  const DigitalXRayImageStorageForProcessing: string;
  const EncapsulatedCdaStorage: string;
  const EncapsulatedPdfStorage: string;
  const EnhancedCtImageStorage: string;
  const EnhancedMrColorImageStorage: string;
  const EnhancedMrImageStorage: string;
  const EnhancedPetImageStorage: string;
  const EnhancedSrStorage: string;
  const EnhancedXaImageStorage: string;
  const EnhancedXrfImageStorage: string;
  const IntravascularOpticalCoherenceTomographyImageStorageForPresentation: string;
  const IntravascularOpticalCoherenceTomographyImageStorageForProcessing: string;
  const LegacyConvertedEnhancedCTImageStorage: string;
  const LegacyConvertedEnhancedMRImageStorage: string;
  const LegacyConvertedEnhancedPETImageStorage: string;
  const MammographyCadSrStorage: string;
  const MrImageStorage: string;
  const MultiframeGrayscaleByteSecondaryCaptureImageStorage: string;
  const MultiframeGrayscaleWordSecondaryCaptureImageStorage: string;
  const MultiframeSingleBitSecondaryCaptureImageStorage: string;
  const MultiframeTrueColorSecondaryCaptureImageStorage: string;
  const NuclearMedicineImageStorage: string;
  const OphthalmicOpticalCoherenceTomographyEnFaceImageStorage: string;
  const OphthalmicPhotography16BitImageStorage: string;
  const OphthalmicPhotography8BitImageStorage: string;
  const OphthalmicTomographyImageStorage: string;
  const PositronEmissionTomographyImageStorage: string;
  const RtImageStorage: string;
  const SecondaryCaptureImageStorage: string;
  const UltrasoundImageStorage: string;
  const UltrasoundMultiframeImageStorage: string;
  const VideoEndoscopicImageStorage: string;
  const VideoMicroscopicImageStorage: string;
  const VideoPhotographicImageStorage: string;
  const VlEndoscopicImageStorage: string;
  const VlMicroscopicImageStorage: string;
  const VlPhotographicImageStorage: string;
  const VlSlideCoordinatesMicroscopicImageStorage: string;
  const VlWholeSlideMicroscopyImageStorage: string;
  const WideFieldOphthalmicPhotography3dCoordinatesImageStorage: string;
  const WideFieldOphthalmicPhotographyStereographicProjectionImageStorage: string;
  const XRay3dAngiographicImageStorage: string;
  const XRay3dCraniofacialImageStorage: string;
  const XRayAngiographicImageStorage: string;
  const XRayRadiationDoseSRStorage: string;
  const XRayRadiofluoroscopicImageStorage: string;
}

declare namespace SopClass {
  const Verification: string;
  const StudyRootQueryRetrieveInformationModelFind: string;
  const ModalityWorklistInformationModelFind: string;
  const ModalityPerformedProcedureStep: string;
  const StudyRootQueryRetrieveInformationModelMove: string;
  const StudyRootQueryRetrieveInformationModelGet: string;
  const StorageCommitmentPushModel: string;
  const BasicFilmSession: string;
  const PrintJob: string;
  const BasicAnnotationBox: string;
  const Printer: string;
  const PrinterConfigurationRetrieval: string;
  const BasicGrayscalePrintManagementMeta: string;
  const BasicColorPrintManagementMeta: string;
  const BasicFilmBox: string;
  const PresentationLut: string;
  const BasicGrayscaleImageBox: string;
  const BasicColorImageBox: string;
  const InstanceAvailabilityNotification: string;
}

declare namespace TransferSyntax {
  const ImplicitVRLittleEndian: string;
  const ExplicitVRLittleEndian: string;
  const DeflatedExplicitVRLittleEndian: string;
  const ExplicitVRBigEndian: string;
  const RleLossless: string;
  const JpegBaseline: string;
  const JpegLossless: string;
  const JpegLsLossless: string;
  const JpegLsLossy: string;
  const Jpeg2000Lossless: string;
  const Jpeg2000Lossy: string;
}

declare namespace TimeoutKind {
  const Connect: string;
  const Acse: string;
  const Dimse: string;
  const Idle: string;
}

declare namespace AssociationOutcome {
  const Released: string;
  const ReleasedByPeer: string;
  const Rejected: string;
  const AbortedByPeer: string;
  const AbortedLocally: string;
  const ConnectTimeout: string;
  const SocketError: string;
  const ClosedUnexpectedly: string;
  const NotConnected: string;
}

/**
 * How an association ended: the first cause of the end, with the timeout kind when a timeout ended it.
 */
interface AssociationEnd {
  outcome: string;
  timeout?: string;
}

declare namespace NotSentReason {
  const NoAcceptedPresentationContext: string;
  const TransferSyntaxMismatch: string;
  const StoredDatasetUnavailable: string;
  const CharacterSetMismatch: string;
  const AssociationEnded: string;
}

declare class Dataset {
  /**
   * Creates an instance of Dataset.
   */
  constructor(
    elementsOrBuffer?: Record<string, unknown> | Buffer,
    transferSyntaxUid?: string,
    readOptions?: Record<string, unknown>
  );

  /**
   * Gets element value.
   */
  getElement(tag: string): string | undefined;

  /**
   * Gets the Specific Character Set of the dataset as it was received, values without their insignificant
   * spaces joined by a backslash; undefined if it was not read from bytes or the element was not in them.
   */
  getReceivedSpecificCharacterSet(): string | undefined;

  /**
   * Sets element value.
   * Throws for a stored dataset.
   */
  setElement(tag: string, value: string): void;

  /**
   * Gets all elements.
   */
  getElements(): Record<string, unknown>;

  /**
   * Gets DICOM transfer syntax UID.
   */
  getTransferSyntaxUid(): string;

  /**
   * Sets DICOM transfer syntax UID.
   * Throws for a stored dataset.
   */
  setTransferSyntaxUid(transferSyntaxUid: string): void;

  /**
   * Checks whether the dataset carries the stored bytes of a part10 file.
   */
  isStored(): boolean;

  /**
   * Gets the stored dataset bytes, the part10 file without its preamble and file meta information.
   */
  getStoredDataset(): Buffer;

  /**
   * Creates a stored dataset from the bytes of a part10 file.
   * The bytes after the file meta information are sent on the wire unchanged.
   */
  static fromStoredPart10(buffer: Buffer, readOptions?: Record<string, unknown>): Dataset;

  /**
   * Gets elements encoded in a DICOM dataset buffer.
   * Throws for a stored dataset.
   */
  getDenaturalizedDataset(
    writeOptions?: Record<string, unknown>,
    nameMap?: Record<string, unknown>
  ): Buffer;

  /**
   * Gets command elements encoded in a DICOM dataset buffer.
   */
  getDenaturalizedCommandDataset(writeOptions?: Record<string, unknown>): Buffer;

  /**
   * Loads a dataset from DICOM P10 file.
   */
  static fromFile(
    path: string,
    callback?: (error: Error | undefined, dataset: Dataset | undefined) => void,
    readOptions?: Record<string, unknown>
  ): Dataset | undefined;

  /**
   * Generates a UUID-derived UID.
   */
  static generateDerivedUid(): string;

  /**
   * Gets the dataset description, without element values.
   */
  toString(): string;
}

declare class PresentationContext {
  /**
   * Creates an instance of PresentationContext.
   */
  constructor(pcId: number, abstractSyntaxUid: string, transferSyntaxUid?: string, result?: number);

  /**
   * Gets presentation context ID.
   */
  getPresentationContextId(): number;

  /**
   * Gets abstract syntax UID.
   */
  getAbstractSyntaxUid(): string;

  /**
   * Gets transfer syntax UIDs.
   */
  getTransferSyntaxUids(): Array<string>;

  /**
   * Add transfer syntax UID.
   */
  addTransferSyntaxUid(transferSyntaxUid: string): void;

  /**
   * Removes transfer syntax UID.
   */
  removeTransferSyntaxUid(transferSyntaxUid: string): void;

  /**
   * Checks whether transfer syntax UID is present.
   */
  hasTransferSyntaxUid(transferSyntaxUid: string): boolean;

  /**
   * Gets the accepted transfer syntax UID.
   */
  getAcceptedTransferSyntaxUid(): string | undefined;

  /**
   * Gets the presentation context result.
   */
  getResult(): number;

  /**
   * Sets the presentation context result.
   */
  setResult(result: number, acceptedTransferSyntaxUid?: string): void;

  /**
   * Gets the presentation context result description.
   */
  getResultDescription(): string;

  /**
   * Gets the presentation context description.
   */
  toString(): string;
}

declare class Association {
  /**
   * Creates an instance of Association.
   */
  constructor(callingAeTitle: string, calledAeTitle: string);

  /**
   * Gets the calling AE title.
   */
  getCallingAeTitle(): string;

  /**
   * Sets the calling AE title.
   */
  setCallingAeTitle(aet: string): void;

  /**
   * Gets the called AE title.
   */
  getCalledAeTitle(): string;

  /**
   * Sets the called AE title.
   */
  setCalledAeTitle(aet: string): void;

  /**
   * Gets maximum PDU length.
   */
  getMaxPduLength(): number;

  /**
   * Sets maximum PDU length.
   */
  setMaxPduLength(maxPduLength: number): void;

  /**
   * Gets the maximum PDU length the peer receives, as announced in its association request or accept;
   * zero means that the peer announced no limit.
   */
  getPeerMaxPduLength(): number | undefined;

  /**
   * Sets the maximum PDU length the peer receives.
   */
  setPeerMaxPduLength(peerMaxPduLength: number): void;

  /**
   * Gets the application context name.
   */
  getApplicationContextName(): string;

  /**
   * Gets the implementation class UID, with which the client identifies itself to the peer.
   */
  getImplementationClassUid(): string | undefined;

  /**
   * Sets the implementation class UID.
   */
  setImplementationClassUid(uid: string): void;

  /**
   * Gets the implementation version name, with which the client identifies itself to the peer.
   */
  getImplementationVersion(): string | undefined;

  /**
   * Sets the implementation version name, or undefined not to send any.
   */
  setImplementationVersion(version: string | undefined): void;

  /**
   * Gets the implementation class UID of the peer, as announced in its association accept.
   */
  getPeerImplementationClassUid(): string | undefined;

  /**
   * Sets the implementation class UID of the peer.
   */
  setPeerImplementationClassUid(uid: string): void;

  /**
   * Gets the implementation version name of the peer, as announced in its association accept.
   */
  getPeerImplementationVersion(): string | undefined;

  /**
   * Sets the implementation version name of the peer.
   */
  setPeerImplementationVersion(version: string): void;

  /**
   * Gets a flag indicating whether to negotiate asynchronous operations.
   */
  getNegotiateAsyncOps(): boolean;

  /**
   * Sets a flag indicating whether to negotiate asynchronous operations.
   */
  setNegotiateAsyncOps(negotiate: boolean): void;

  /**
   * Gets the supported maximum number of asynchronous operations invoked.
   */
  getMaxAsyncOpsInvoked(): number;

  /**
   * Sets the supported maximum number of asynchronous operations invoked.
   */
  setMaxAsyncOpsInvoked(ops: number): void;

  /**
   * Gets the supported maximum number of asynchronous operations performed.
   */
  getMaxAsyncOpsPerformed(): number;

  /**
   * Sets the supported maximum number of asynchronous operations performed.
   */
  setMaxAsyncOpsPerformed(ops: number): void;

  /**
   * Gets a flag indicating whether to negotiate user identity.
   */
  getNegotiateUserIdentity(): boolean;

  /**
   * Sets a flag indicating whether to negotiate user identity.
   */
  setNegotiateUserIdentity(negotiate: boolean): void;

  /**
   * Gets the user identity type.
   */
  getUserIdentityType(): number;

  /**
   * Sets the user identity type.
   */
  setUserIdentityType(type: number): void;

  /**
   * Gets a flag indicating whether a positive response requested.
   */
  getUserIdentityPositiveResponseRequested(): boolean;

  /**
   * Sets a flag indicating whether a positive response requested.
   */
  setUserIdentityPositiveResponseRequested(positiveResponseRequested: boolean): void;

  /**
   * Gets the user identity primary field.
   * This field might contain the username, the Kerberos service ticket or the JWT.
   */
  getUserIdentityPrimaryField(): string;

  /**
   * Sets the user identity primary field.
   * This field might contain the username, the Kerberos service ticket or the JWT.
   */
  setUserIdentityPrimaryField(primaryField: string): void;

  /**
   * Gets the user identity secondary field.
   * This field might contain the passcode.
   */
  getUserIdentitySecondaryField(): string;

  /**
   * Sets the user identity secondary field.
   * This field might contain the passcode.
   */
  setUserIdentitySecondaryField(secondaryField: string): void;

  /**
   * Gets a flag indicating whether to negotiate user identity server response.
   */
  getNegotiateUserIdentityServerResponse(): boolean;

  /**
   * Sets a flag indicating whether to negotiate user identity server response.
   */
  setNegotiateUserIdentityServerResponse(negotiate: boolean): void;

  /**
   * Gets the user identity server response.
   * This field might contain the Kerberos server ticket if the user identity type value was 3,
   * the SAML response if the user identity type value was 4, or it might be empty
   * if the user identity type value was 1 or 2.
   */
  getUserIdentityServerResponse(): string;

  /**
   * Sets the user identity server response.
   * This field might contain the Kerberos server ticket if the user identity type value was 3,
   * the SAML response if the user identity type value was 4, or it might be empty
   * if the user identity type value was 1 or 2.
   */
  setUserIdentityServerResponse(serverResponse: string): void;

  /**
   * Adds presentation context to association.
   */
  addPresentationContext(abstractSyntaxUid: string): number;

  /**
   * Adds presentation context to association if not exists.
   */
  addOrGetPresentationContext(abstractSyntaxUid: string): number;

  /**
   * Adds transfer syntax to presentation context.
   */
  addTransferSyntaxToPresentationContext(pcId: number, transferSyntaxUid: string): void;

  /**
   * Gets presentation context.
   */
  getPresentationContext(pcId: number): PresentationContext;

  /**
   * Finds a proposed presentation context.
   */
  findPresentationContext(pcId: number): PresentationContext | undefined;

  /**
   * Gets presentation contexts.
   */
  getPresentationContexts(): Array<{
    id: number;
    context: PresentationContext;
  }>;

  /**
   * Clears all presentation contexts.
   */
  clearPresentationContexts(): void;

  /**
   * Adds presentation context from request.
   */
  addPresentationContextFromRequest(
    request: Request,
    transferSyntaxes?: string | Array<string>
  ): number;

  /**
   * Gets accepted presentation context from request.
   */
  getAcceptedPresentationContextFromRequest(request: Request): PresentationContext | undefined;

  /**
   * Gets the association description.
   */
  toString(): string;
}

declare class Command {
  /**
   * Creates an instance of Command.
   */
  constructor(commandDataset?: Dataset, dataset?: Dataset);

  /**
   * Gets command dataset.
   */
  getCommandDataset(): Dataset;

  /**
   * Sets command dataset.
   */
  setCommandDataset(dataset: Dataset): void;

  /**
   * Gets dataset.
   */
  getDataset(): Dataset | undefined;

  /**
   * Sets dataset and updates CommandDataSetType element.
   */
  setDataset(dataset: Dataset): void;

  /**
   * Gets command field type.
   */
  getCommandFieldType(): number;

  /**
   * Command has dataset.
   */
  hasDataset(): boolean;

  /**
   * Gets the command description.
   */
  toString(): string;
}

declare class Request extends Mixin(Command, AsyncEventEmitter2) {
  /**
   * Creates an instance of Request.
   */
  constructor(type: number, affectedSopClassUid: string, hasDataset: boolean);

  /**
   * Gets affected SOP class UID.
   */
  getAffectedSopClassUid(): string;

  /**
   * Sets affected SOP class UID.
   */
  setAffectedSopClassUid(affectedSopClassUid: string): void;

  /**
   * Gets affected SOP instance UID.
   */
  getAffectedSopInstanceUid(): string;

  /**
   * Sets affected SOP instance UID.
   */
  setAffectedSopInstanceUid(affectedSopInstanceUid: string): void;

  /**
   * Gets request message ID.
   */
  getMessageId(): number;

  /**
   * Sets request message ID.
   */
  setMessageId(messageId: number): void;

  /**
   * Raise response event.
   */
  raiseResponseEvent(response: Response): void;

  /**
   * Raise done event.
   */
  raiseDoneEvent(): void;

  /**
   * Raise not sent event, before the done event, when no byte of the request's dataset left for the peer.
   */
  raiseNotSentEvent(reason: string): void;

  /**
   * Gets the number of command bytes handed to the operating system, PDU and PDV headers not included.
   */
  getCommandBytesSent(): number;

  /**
   * Gets the number of dataset bytes handed to the operating system, PDU and PDV headers not included.
   */
  getDatasetBytesSent(): number;

  /**
   * Gets the SHA-256 of the dataset bytes handed to the operating system so far, or undefined if none was sent.
   */
  getSentDatasetSha256(): string | undefined;

  /**
   * Counts a fragment of the request once it is handed to the operating system.
   */
  countSentBytes(isCommand: boolean, fragment: Buffer): void;

  /**
   * Gets the request description.
   */
  toString(): string;
}

declare class Response extends Command {
  /**
   * Creates an instance of Response.
   */
  constructor(
    type: number,
    affectedSopClassUid: string,
    hasDataset: boolean,
    status: number,
    errorComment: string
  );

  /**
   * Gets affected SOP class UID.
   */
  getAffectedSopClassUid(): string;

  /**
   * Sets affected SOP class UID.
   */
  setAffectedSopClassUid(affectedSopClassUid: string): void;

  /**
   * Gets affected SOP instance UID.
   */
  getAffectedSopInstanceUid(): string;

  /**
   * Sets affected SOP instance UID.
   */
  setAffectedSopInstanceUid(affectedSopInstanceUid: string): void;

  /**
   * Gets status.
   */
  getStatus(): number;

  /**
   * Sets status.
   */
  setStatus(status: number): void;

  /**
   * Gets error comment.
   */
  getErrorComment(): string;

  /**
   * Sets error comment.
   */
  setErrorComment(errorComment: string): void;

  /**
   * Gets response message ID.
   */
  getMessageIdBeingRespondedTo(): number;

  /**
   * Sets response message ID.
   */
  setMessageIdBeingRespondedTo(messageId: number): void;

  /**
   * Gets the response description.
   */
  toString(): string;
}

declare class CEchoRequest extends Request {
  /**
   * Creates an instance of CEchoRequest.
   */
  constructor();
}

declare class CEchoResponse extends Response {
  /**
   * Creates an instance of CEchoResponse.
   */
  constructor(status: number, errorComment: string);
}

declare class CFindRequest extends Request {
  /**
   * Creates an instance of CFindRequest.
   */
  constructor(priority?: number);

  /**
   * Gets request priority.
   */
  getPriority(): number;

  /**
   * Sets request priority.
   */
  setPriority(priority: number): void;

  /**
   * Creates study find request.
   */
  static createStudyFindRequest(elements: Record<string, unknown>, priority?: number): CFindRequest;

  /**
   * Creates series find request.
   */
  static createSeriesFindRequest(
    elements: Record<string, unknown>,
    priority?: number
  ): CFindRequest;

  /**
   * Creates image find request.
   */
  static createImageFindRequest(elements: Record<string, unknown>, priority?: number): CFindRequest;

  /**
   * Creates worklist find request.
   */
  static createWorklistFindRequest(
    elements: Record<string, unknown>,
    priority?: number
  ): CFindRequest;
}

declare class CFindResponse extends Response {
  /**
   * Creates an instance of CEchoResponse.
   */
  constructor(status: number, errorComment: string);
}

declare class CStoreRequest extends Request {
  /**
   * Creates an instance of CStoreRequest.
   * Only stored bytes are sent, unchanged: a stored dataset, a part10 file or variants. Variants are stored
   * datasets of one SOP instance, one per transfer syntax, in order of preference; only the variant whose
   * presentation context the peer accepted with exactly its transfer syntax is sent.
   */
  constructor(storedDatasetOrFileOrVariants: Dataset | string | Array<Dataset>, priority?: number);

  /**
   * Gets request priority.
   */
  getPriority(): number;

  /**
   * Sets request priority.
   */
  setPriority(priority: number): void;

  /**
   * Gets the variants of the SOP instance, one per transfer syntax, in order of preference.
   */
  getVariants(): Array<Dataset>;

  /**
   * Selects the accepted presentation context the request is sent on,
   * and with it the variant in the transfer syntax the context was accepted with.
   */
  selectPresentationContext(context: PresentationContext): void;

  /**
   * Gets the ID of the accepted presentation context the request is sent on.
   */
  getSelectedPresentationContextId(): number | undefined;

  /**
   * Loads the stored dataset when only the minimum necessary tags were loaded from file.
   */
  loadFullDatasetIfNeeded(): void;
}

declare class CStoreResponse extends Response {
  /**
   * Creates an instance of CStoreResponse.
   */
  constructor(status: number, errorComment: string);
}

declare class CCancelRequest extends Request {
  /**
   * Creates an instance of CCancelRequest.
   */
  constructor(affectedSopClassUid: string, messageId: number);

  /**
   * Gets message ID to cancel.
   */
  getMessageIdBeingRespondedTo(): number;

  /**
   * Sets message ID to cancel.
   */
  setMessageIdBeingRespondedTo(messageId: number): void;

  /**
   * Creates a C-CANCEL request from a C-FIND request.
   */
  static fromRequest(request: CFindRequest): CCancelRequest;
}

declare class Statistics {
  /**
   * Creates an instance of Statistics.
   */
  constructor();

  /**
   * Gets the received bytes.
   */
  getBytesReceived(): number;

  /**
   * Gets the sent bytes.
   */
  getBytesSent(): number;

  /**
   * Adds bytes to the received bytes.
   */
  addBytesReceived(bytes: number): void;

  /**
   * Adds bytes to the sent bytes.
   */
  addBytesSent(bytes: number): void;

  /**
   * Adds values from other statistics.
   */
  addFromOtherStatistics(statistics: Statistics): void;

  /**
   * Resets received and sent bytes.
   */
  reset(): void;

  /**
   * Gets the statistics description.
   */
  toString(): string;
}

declare class Client extends AsyncEventEmitter2<AsyncEventEmitter2.EventMap> {
  /**
   * Creates an instance of Client.
   */
  constructor();

  /**
   * The connection closed; every request has ended with done before, and the listener gets how the
   * association ended.
   */
  on(event: 'closed', listener: (end: AssociationEnd) => void): this;
  on(event: string, listener: (...args: any[]) => void): this;

  /**
   * Adds a C-ECHO, C-FIND or C-STORE request.
   */
  addRequest(request: CEchoRequest | CFindRequest | CStoreRequest): void;

  /**
   * Clears all requests.
   */
  clearRequests(): void;

  /**
   * Adds an additional presentation context.
   */
  addAdditionalPresentationContext(context: PresentationContext, addAsNew?: boolean): void;

  /**
   * Sends requests to the remote host. Without requests, the association only negotiates the additional
   * presentation contexts and is then released.
   */
  send(
    host: string,
    port: number,
    callingAeTitle: string,
    calledAeTitle: string,
    opts: {
      implementationClassUid: string;
      implementationVersion?: string;
      connectTimeout?: number;
      acseTimeout?: number;
      dimseTimeout?: number;
      idleTimeout?: number;
      maxPduLength?: number;
      maxReceivedMessageLength?: number;
      queryTransferSyntaxes?: string[];
      associationLingerTimeout?: number;
      datasetReadOptions?: Record<string, unknown>;
      datasetWriteOptions?: Record<string, unknown>;
      datasetNameMap?: Record<string, unknown>;
      asyncOps?: {
        maxAsyncOpsInvoked?: number;
        maxAsyncOpsPerformed?: number;
      };
      userIdentity?: {
        type?: number;
        positiveResponseRequested?: boolean;
        primaryField?: string;
        secondaryField?: string;
      };
    }
  ): void;

  /**
   * Gets network statistics.
   */
  getStatistics(): Statistics;

  /**
   * Aborts the established association.
   */
  abort(source?: number, reason?: number): void;

  /**
   * Stops reading responses after the one that is being processed; the DIMSE and idle timeouts do not run
   * meanwhile.
   */
  pauseReceiving(): void;

  /**
   * Reads the responses again, first those received while paused.
   */
  resumeReceiving(): void;

  /**
   * Cancels a C-FIND request.
   */
  cancel(request: CFindRequest): void;
}

/**
 * Logger.
 */
declare const log: Logger;

/**
 * Version.
 */
declare const version: string;

export namespace constants {
  export { PresentationContextResult };
  export { UserIdentityType };
  export { AbortSource };
  export { AbortReason };
  export { RejectResult };
  export { RejectSource };
  export { RejectReason };
  export { Priority };
  export { Status };
  export { StorageClass };
  export { SopClass };
  export { TransferSyntax };
  export { NotSentReason };
  export { TimeoutKind };
  export { AssociationOutcome };
}

export namespace association {
  export { PresentationContext };
  export { Association };
}

export namespace requests {
  export { Request };
  export { CEchoRequest };
  export { CFindRequest };
  export { CStoreRequest };
  export { CCancelRequest };
}

export namespace responses {
  export { Response };
  export { CEchoResponse };
  export { CFindResponse };
  export { CStoreResponse };
}

export { Dataset, Client, Statistics, log, version };
