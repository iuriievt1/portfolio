const { Association, PresentationContext } = require('./Association');
const {
  CCancelRequest,
  CEchoRequest,
  CEchoResponse,
  CFindRequest,
  CFindResponse,
  CStoreRequest,
  CStoreResponse,
  Request,
  Response,
} = require('./Command');
const {
  AbortReason,
  AbortSource,
  AssociationOutcome,
  CommandFieldType,
  NotSentReason,
  PresentationContextResult,
  Priority,
  RawPduType,
  RejectReason,
  RejectResult,
  RejectSource,
  SopClass,
  Status,
  StorageClass,
  TimeoutKind,
  TransferSyntax,
  Uid,
  UserIdentityType,
} = require('./Constants');
const Client = require('./Client');
const Dataset = require('./Dataset');
const Statistics = require('./Statistics');
const log = require('./log');
const version = require('./version');

//#region association
const association = {
  Association,
  PresentationContext,
};
//#endregion

//#region requests
const requests = {
  CCancelRequest,
  CEchoRequest,
  CFindRequest,
  CStoreRequest,
  Request,
};
//#endregion

//#region responses
const responses = {
  CEchoResponse,
  CFindResponse,
  CStoreResponse,
  Response,
};
//#endregion

//#region constants
const constants = {
  AbortReason,
  AbortSource,
  AssociationOutcome,
  CommandFieldType,
  NotSentReason,
  PresentationContextResult,
  Priority,
  RawPduType,
  RejectReason,
  RejectResult,
  RejectSource,
  SopClass,
  Status,
  StorageClass,
  TimeoutKind,
  TransferSyntax,
  Uid,
  UserIdentityType,
};
//#endregion

const DcmjsDimse = {
  association,
  Client,
  constants,
  Dataset,
  log,
  requests,
  responses,
  Statistics,
  version,
};

//#region Exports
module.exports = DcmjsDimse;
//#endregion
