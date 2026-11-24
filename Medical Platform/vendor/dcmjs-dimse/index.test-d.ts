import { expectTypeOf } from 'vitest';
import { Logger } from 'loglevel';

import {
  Client,
  Dataset,
  Statistics,
  association,
  constants,
  log,
  requests,
  responses,
  version,
} from '.';

const { Association, PresentationContext } = association;
const {
  CCancelRequest,
  CEchoRequest,
  CFindRequest,
  CStoreRequest,
  Request,
} = requests;
const {
  CEchoResponse,
  CFindResponse,
  CStoreResponse,
  Response,
} = responses;
const { AssociationOutcome, NotSentReason, Priority, SopClass, Status, TimeoutKind, TransferSyntax } = constants;

// log
expectTypeOf(log).toEqualTypeOf<Logger>();

// version
expectTypeOf(version).toEqualTypeOf<string>();

// NotSentReason
expectTypeOf(NotSentReason.NoAcceptedPresentationContext).toEqualTypeOf<string>();
expectTypeOf(NotSentReason.TransferSyntaxMismatch).toEqualTypeOf<string>();
expectTypeOf(NotSentReason.StoredDatasetUnavailable).toEqualTypeOf<string>();
expectTypeOf(NotSentReason.CharacterSetMismatch).toEqualTypeOf<string>();
expectTypeOf(NotSentReason.AssociationEnded).toEqualTypeOf<string>();

// AssociationOutcome
expectTypeOf(AssociationOutcome.Released).toEqualTypeOf<string>();
expectTypeOf(AssociationOutcome.NotConnected).toEqualTypeOf<string>();
expectTypeOf(Status.PendingWarning).toEqualTypeOf<number>();

// TimeoutKind
expectTypeOf(TimeoutKind.Connect).toEqualTypeOf<string>();
expectTypeOf(TimeoutKind.Acse).toEqualTypeOf<string>();
expectTypeOf(TimeoutKind.Dimse).toEqualTypeOf<string>();
expectTypeOf(TimeoutKind.Idle).toEqualTypeOf<string>();

// Dataset
const storedDataset = Dataset.fromStoredPart10(Buffer.alloc(0));
expectTypeOf(storedDataset).toEqualTypeOf<Dataset>();
expectTypeOf(Dataset.fromStoredPart10(Buffer.alloc(0), {})).toEqualTypeOf<Dataset>();
// @ts-expect-error
Dataset.fromStoredPart10('1');
expectTypeOf(storedDataset.isStored()).toEqualTypeOf<boolean>();
expectTypeOf(storedDataset.getStoredDataset()).toEqualTypeOf<Buffer>();
expectTypeOf(storedDataset.getReceivedSpecificCharacterSet()).toEqualTypeOf<string | undefined>();
// @ts-expect-error
storedDataset.toFile('1');

// PresentationContext
// @ts-expect-error
new PresentationContext();
// @ts-expect-error
new PresentationContext(1, 2);
// @ts-expect-error
new PresentationContext('1', '1.2.3.4.5');
// @ts-expect-error
new PresentationContext(1, '1.2.3.4.5', 1, '2');
// @ts-expect-error
new PresentationContext(1, '1.2.3.4.5', '5.4.3.2.1', 2, '3');
// @ts-expect-error
new PresentationContext(1, '1.2.3.4.5', '5.4.3.2.1', 2, true);

const presentationContext = new PresentationContext(
  1,
  SopClass.Verification,
  TransferSyntax.ImplicitVRLittleEndian
);
expectTypeOf(presentationContext.getPresentationContextId()).toEqualTypeOf<number>();
expectTypeOf(presentationContext.getAbstractSyntaxUid()).toEqualTypeOf<string>();
expectTypeOf(presentationContext.getTransferSyntaxUids()).toEqualTypeOf<Array<string>>();
// @ts-expect-error
presentationContext.addTransferSyntaxUid(1);
// @ts-expect-error
presentationContext.removeTransferSyntaxUid(1);
// @ts-expect-error
presentationContext.hasTransferSyntaxUid(1);
expectTypeOf(presentationContext.getAcceptedTransferSyntaxUid()).toEqualTypeOf<string | undefined>();
expectTypeOf(presentationContext.getResult()).toEqualTypeOf<number>();
// @ts-expect-error
presentationContext.setResult('1', 1);
expectTypeOf(presentationContext.getResultDescription()).toEqualTypeOf<string>();
// @ts-expect-error
presentationContext.setUserRole(true);
// @ts-expect-error
presentationContext.setProviderRole(true);
expectTypeOf(presentationContext.toString()).toEqualTypeOf<string>();

// Association
// @ts-expect-error
new Association();
// @ts-expect-error
new Association(1);
// @ts-expect-error
new Association(1, 1);

const assoc = new Association('SCU', 'SCP');
expectTypeOf(assoc.getCallingAeTitle()).toEqualTypeOf<string>();
// @ts-expect-error
assoc.setCallingAeTitle(1);
expectTypeOf(assoc.getCalledAeTitle()).toEqualTypeOf<string>();
// @ts-expect-error
assoc.setCalledAeTitle(1);
expectTypeOf(assoc.getMaxPduLength()).toEqualTypeOf<number>();
// @ts-expect-error
assoc.setMaxPduLength('1');
expectTypeOf(assoc.getPeerMaxPduLength()).toEqualTypeOf<number | undefined>();
// @ts-expect-error
assoc.setPeerMaxPduLength('1');
expectTypeOf(assoc.getImplementationClassUid()).toEqualTypeOf<string | undefined>();
// @ts-expect-error
assoc.setImplementationClassUid(1);
expectTypeOf(assoc.getImplementationVersion()).toEqualTypeOf<string | undefined>();
// @ts-expect-error
assoc.setImplementationVersion(1);
expectTypeOf(assoc.getPeerImplementationClassUid()).toEqualTypeOf<string | undefined>();
// @ts-expect-error
assoc.setPeerImplementationClassUid(1);
expectTypeOf(assoc.getPeerImplementationVersion()).toEqualTypeOf<string | undefined>();
// @ts-expect-error
assoc.setPeerImplementationVersion(1);
expectTypeOf(assoc.getNegotiateAsyncOps()).toEqualTypeOf<boolean>();
// @ts-expect-error
assoc.setNegotiateAsyncOps(1);
expectTypeOf(assoc.getMaxAsyncOpsInvoked()).toEqualTypeOf<number>();
// @ts-expect-error
assoc.setMaxAsyncOpsInvoked('1');
expectTypeOf(assoc.getMaxAsyncOpsPerformed()).toEqualTypeOf<number>();
// @ts-expect-error
assoc.setMaxAsyncOpsPerformed('2');
expectTypeOf(assoc.getNegotiateUserIdentity()).toEqualTypeOf<boolean>();
// @ts-expect-error
assoc.setNegotiateUserIdentity(1);
expectTypeOf(assoc.getUserIdentityType()).toEqualTypeOf<number>();
// @ts-expect-error
assoc.setUserIdentityType('1');
expectTypeOf(assoc.getUserIdentityPositiveResponseRequested()).toEqualTypeOf<boolean>();
// @ts-expect-error
assoc.setUserIdentityPositiveResponseRequested(1);
expectTypeOf(assoc.getUserIdentityPrimaryField()).toEqualTypeOf<string>();
// @ts-expect-error
assoc.setUserIdentityPrimaryField(1);
expectTypeOf(assoc.getUserIdentitySecondaryField()).toEqualTypeOf<string>();
// @ts-expect-error
assoc.setUserIdentitySecondaryField(2);
expectTypeOf(assoc.getNegotiateUserIdentityServerResponse()).toEqualTypeOf<boolean>();
// @ts-expect-error
assoc.setNegotiateUserIdentityServerResponse(1);
expectTypeOf(assoc.getUserIdentityServerResponse()).toEqualTypeOf<string>();
// @ts-expect-error
assoc.setUserIdentityServerResponse(1);
// @ts-expect-error
assoc.addPresentationContext(1);
// @ts-expect-error
assoc.addPresentationContext('1.2.3.4.5', 1);
expectTypeOf(assoc.addPresentationContext('1.2.3.4.5')).toEqualTypeOf<number>();
// @ts-expect-error
assoc.addOrGetPresentationContext(1);
expectTypeOf(assoc.addOrGetPresentationContext('1.2.3.4.5')).toEqualTypeOf<number>();
// @ts-expect-error
assoc.addTransferSyntaxToPresentationContext('1', 1);
// @ts-expect-error
assoc.getPresentationContext('1');
expectTypeOf(assoc.getPresentationContext(1)).toEqualTypeOf<association.PresentationContext>();
expectTypeOf(assoc.findPresentationContext(1)).toEqualTypeOf<association.PresentationContext | undefined>();
expectTypeOf(assoc.getPresentationContexts()).toEqualTypeOf<Array<{ id: number; context: association.PresentationContext }>>();
expectTypeOf(assoc.clearPresentationContexts()).toEqualTypeOf<void>();
// @ts-expect-error
assoc.addPresentationContextFromRequest('1', 2);
expectTypeOf(assoc.addPresentationContextFromRequest(new CEchoRequest())).toEqualTypeOf<number>();
// @ts-expect-error
assoc.getAcceptedPresentationContextFromRequest('1');
expectTypeOf(assoc.getAcceptedPresentationContextFromRequest(new CEchoRequest())).toEqualTypeOf<association.PresentationContext | undefined>();
expectTypeOf(assoc.toString()).toEqualTypeOf<string>();

// Request
// @ts-expect-error
new Request('1', 123, 'true', 1);
expectTypeOf(new Request(1, '1.2.3.4.5', false)).toEqualTypeOf<requests.Request>();
// @ts-expect-error
new Request(1, '1.2.3.4.5', false, '5.4.3.2.1');

const request = new Request(1, '1.2.3.4.5', false);
expectTypeOf(request.getAffectedSopClassUid()).toEqualTypeOf<string>();
expectTypeOf(request.getCommandBytesSent()).toEqualTypeOf<number>();
expectTypeOf(request.getDatasetBytesSent()).toEqualTypeOf<number>();
expectTypeOf(request.getSentDatasetSha256()).toEqualTypeOf<string | undefined>();
// @ts-expect-error
request.countSentBytes('1', Buffer.alloc(1));
// @ts-expect-error
request.countSentBytes(true, 1);
// @ts-expect-error
request.setAffectedSopClassUid(1);
expectTypeOf(request.setAffectedSopClassUid('1.2.3.4')).toEqualTypeOf<void>();
expectTypeOf(request.getAffectedSopInstanceUid()).toEqualTypeOf<string>();
// @ts-expect-error
request.setAffectedSopInstanceUid(1);
expectTypeOf(request.setAffectedSopInstanceUid('1.2.3.4')).toEqualTypeOf<void>();
expectTypeOf(request.getMessageId()).toEqualTypeOf<number>();
// @ts-expect-error
request.setMessageId('1');
expectTypeOf(request.setMessageId(1)).toEqualTypeOf<void>();
// @ts-expect-error
request.raiseResponseEvent({});
expectTypeOf(request.raiseNotSentEvent(NotSentReason.TransferSyntaxMismatch)).toEqualTypeOf<void>();
// @ts-expect-error
request.raiseNotSentEvent(1);
expectTypeOf(request.toString()).toEqualTypeOf<string>();

// Response
// @ts-expect-error
new Response('1', 123, 'true', '2', 1);
expectTypeOf(new Response(1, '1.2.3.4.5', false, 2, '')).toEqualTypeOf<responses.Response>();

const response = new Response(1, '1.2.3.4.5', false, 2, '');
expectTypeOf(response.getAffectedSopClassUid()).toEqualTypeOf<string>();
// @ts-expect-error
response.setAffectedSopClassUid(1);
expectTypeOf(response.setAffectedSopClassUid('1.2.3.4')).toEqualTypeOf<void>();
expectTypeOf(response.getAffectedSopInstanceUid()).toEqualTypeOf<string>();
// @ts-expect-error
response.setAffectedSopInstanceUid(1);
expectTypeOf(response.setAffectedSopInstanceUid('1.2.3.4')).toEqualTypeOf<void>();
expectTypeOf(response.getStatus()).toEqualTypeOf<number>();
// @ts-expect-error
response.setStatus('1');
expectTypeOf(response.setStatus(1)).toEqualTypeOf<void>();
expectTypeOf(response.getErrorComment()).toEqualTypeOf<string>();
// @ts-expect-error
response.setErrorComment(1);
expectTypeOf(response.setErrorComment('ERROR')).toEqualTypeOf<void>();
expectTypeOf(response.getMessageIdBeingRespondedTo()).toEqualTypeOf<number>();
// @ts-expect-error
response.setMessageIdBeingRespondedTo('1');
expectTypeOf(response.setMessageIdBeingRespondedTo(1)).toEqualTypeOf<void>();
expectTypeOf(response.toString()).toEqualTypeOf<string>();

// CEchoRequest
expectTypeOf(new CEchoRequest()).toEqualTypeOf<requests.CEchoRequest>();

// CEchoResponse
// @ts-expect-error
new CEchoResponse('1', 2);

// CFindRequest
// @ts-expect-error
new CFindRequest('1');
expectTypeOf(new CFindRequest()).toEqualTypeOf<requests.CFindRequest>();

const findRequest = new CFindRequest(Priority.High);
expectTypeOf(findRequest.getPriority()).toEqualTypeOf<number>();
// @ts-expect-error
findRequest.setPriority('1');
// @ts-expect-error
CFindRequest.createStudyFindRequest(1);
// @ts-expect-error
CFindRequest.createStudyFindRequest(1, '2');
expectTypeOf(CFindRequest.createStudyFindRequest({})).toEqualTypeOf<requests.CFindRequest>();
// @ts-expect-error
CFindRequest.createSeriesFindRequest(1);
// @ts-expect-error
CFindRequest.createSeriesFindRequest(1, '2');
expectTypeOf(CFindRequest.createSeriesFindRequest({})).toEqualTypeOf<requests.CFindRequest>();
// @ts-expect-error
CFindRequest.createImageFindRequest(1);
// @ts-expect-error
CFindRequest.createImageFindRequest(1, '2');
expectTypeOf(CFindRequest.createImageFindRequest({})).toEqualTypeOf<requests.CFindRequest>();
// @ts-expect-error
CFindRequest.createWorklistFindRequest(1);
// @ts-expect-error
CFindRequest.createWorklistFindRequest(1, '2');
expectTypeOf(CFindRequest.createWorklistFindRequest({})).toEqualTypeOf<requests.CFindRequest>();

// CFindResponse
// @ts-expect-error
new CFindResponse('1', 2);

// CStoreRequest
// @ts-expect-error
new CStoreRequest(1);
expectTypeOf(new CStoreRequest(storedDataset)).toEqualTypeOf<requests.CStoreRequest>();
expectTypeOf(new CStoreRequest('stored.dcm')).toEqualTypeOf<requests.CStoreRequest>();

const storeRequest = new CStoreRequest(storedDataset, Priority.High);
expectTypeOf(storeRequest.getPriority()).toEqualTypeOf<number>();
// @ts-expect-error
storeRequest.setPriority('1');
expectTypeOf(storeRequest.getVariants()).toEqualTypeOf<Array<Dataset>>();
expectTypeOf(storeRequest.selectPresentationContext(presentationContext)).toEqualTypeOf<void>();
// @ts-expect-error
storeRequest.selectPresentationContext(1);
expectTypeOf(storeRequest.getSelectedPresentationContextId()).toEqualTypeOf<number | undefined>();
expectTypeOf(new CStoreRequest([storedDataset, storedDataset], Priority.High)).toEqualTypeOf<requests.CStoreRequest>();
// @ts-expect-error
new CStoreRequest([1]);
expectTypeOf(storeRequest.loadFullDatasetIfNeeded()).toEqualTypeOf<void>();
// @ts-expect-error
storeRequest.getAdditionalTransferSyntaxes();
// @ts-expect-error
storeRequest.setAdditionalTransferSyntaxes([TransferSyntax.Jpeg2000Lossless]);

// CStoreResponse
// @ts-expect-error
new CStoreResponse('1', 2);

// CCancelRequest
// @ts-expect-error
new CCancelRequest(1);
// @ts-expect-error
new CCancelRequest('1', '2');

const cancelRequest = new CCancelRequest(SopClass.StudyRootQueryRetrieveInformationModelFind, 1);
expectTypeOf(cancelRequest.getMessageIdBeingRespondedTo()).toEqualTypeOf<number>();
// @ts-expect-error
cancelRequest.setMessageIdBeingRespondedTo('1');
expectTypeOf(CCancelRequest.fromRequest(new CFindRequest(1))).toEqualTypeOf<requests.CCancelRequest>();
// @ts-expect-error
CCancelRequest.fromRequest(new CEchoRequest());

// Statistics
const statistics = new Statistics();
expectTypeOf(statistics.getBytesReceived()).toEqualTypeOf<number>();
expectTypeOf(statistics.getBytesSent()).toEqualTypeOf<number>();
// @ts-expect-error
statistics.addBytesReceived('1');
// @ts-expect-error
statistics.addBytesSent('1');
// @ts-expect-error
statistics.addFromOtherStatistics('1');
expectTypeOf(statistics.reset()).toEqualTypeOf<void>();
expectTypeOf(statistics.toString()).toEqualTypeOf<string>();

// Client
expectTypeOf(new Client()).toEqualTypeOf<Client>();

const client = new Client();
expectTypeOf(client.clearRequests()).toEqualTypeOf<void>();
// @ts-expect-error
client.addRequest('1');
expectTypeOf(client.addRequest(new CEchoRequest())).toEqualTypeOf<void>();
expectTypeOf(client.addRequest(new CFindRequest())).toEqualTypeOf<void>();
expectTypeOf(client.addRequest(new CStoreRequest(storedDataset))).toEqualTypeOf<void>();
// @ts-expect-error
client.addAdditionalPresentationContext('1');
// @ts-expect-error
client.addAdditionalPresentationContext('1', 'true');
expectTypeOf(client.addAdditionalPresentationContext(
    new PresentationContext(1, SopClass.ModalityWorklistInformationModelFind)
  )).toEqualTypeOf<void>();
expectTypeOf(client.addAdditionalPresentationContext(
    new PresentationContext(1, SopClass.ModalityWorklistInformationModelFind),
    true
  )).toEqualTypeOf<void>();
expectTypeOf(client.getStatistics()).toEqualTypeOf<Statistics>();
client.on('closed', (end) => {
  expectTypeOf(end.outcome).toEqualTypeOf<string>();
  expectTypeOf(end.timeout).toEqualTypeOf<string | undefined>();
});
// @ts-expect-error
client.send('1');
// @ts-expect-error
client.send('1', '2');
// @ts-expect-error
client.send('1', '2', 3, 4);
// @ts-expect-error
client.send('1', '2', 3, 4, '5');
// @ts-expect-error
client.send('1', 2, '3', '4');
// @ts-expect-error
client.send('1', 2, '3', '4', { connectTimeout: 1 });
expectTypeOf(
  client.send('1', 2, '3', '4', {
    implementationClassUid: '1.2.3',
    implementationVersion: 'VULNA',
    connectTimeout: 1,
    acseTimeout: 2,
    dimseTimeout: 3,
    idleTimeout: 4,
    maxPduLength: 16384,
    maxReceivedMessageLength: 1048576,
    queryTransferSyntaxes: ['1.2.840.10008.1.2'],
  })
).toEqualTypeOf<void>();
// @ts-expect-error
client.send('1', 2, '3', '4', { implementationClassUid: '1.2.3', queryTransferSyntaxes: '1.2.840.10008.1.2' });
expectTypeOf(client.pauseReceiving()).toEqualTypeOf<void>();
expectTypeOf(client.resumeReceiving()).toEqualTypeOf<void>();
// @ts-expect-error
client.send('1', 2, '3', '4', { implementationClassUid: '1.2.3', maxReceivedMessageLength: '1' });
// @ts-expect-error
client.send('1', 2, '3', '4', { implementationClassUid: '1.2.3', pduTimeout: 1 });
// @ts-expect-error
client.send('1', 2, '3', '4', { implementationClassUid: '1.2.3', securityOptions: {} });
// @ts-expect-error
client.send('1', 2, '3', '4', { implementationClassUid: '1.2.3', logDatasets: true });
// @ts-expect-error
client.abort('1', '2');
// @ts-expect-error
client.cancel('1');
