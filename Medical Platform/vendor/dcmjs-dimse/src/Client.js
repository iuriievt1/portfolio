const { Association, PresentationContext } = require('./Association');
const { NotSentReason, PduLength, TransferSyntax, UserIdentityType } = require('./Constants');
const { CEchoRequest, CFindRequest, CStoreRequest } = require('./Command');
const Network = require('./Network');
const Statistics = require('./Statistics');
const log = require('./log');

const AsyncEventEmitter2 = require('async-event-emitter2');
const net = require('net');

// Numeric components without leading zeros, separated by dots, of at most 64 characters (PS3.5 9.1)
const UidPattern = /^(0|[1-9][0-9]*)(\.(0|[1-9][0-9]*))*$/;
const MaxUidLength = 64;
// 1 to 16 characters of the ISO 646 basic G0 set (PS3.7 D.3.3.2.3); spaces at either end would be
// trimmed by the peer, so they are not allowed
const ImplementationVersionPattern = /^[\x21-\x7e]([\x20-\x7e]{0,14}[\x21-\x7e])?$/;
// Proposed for a C-ECHO and a C-FIND unless the options say otherwise, as upstream did
const DefaultQueryTransferSyntaxes = [TransferSyntax.ImplicitVRLittleEndian, TransferSyntax.ExplicitVRLittleEndian];

/**
 * Checks whether a value is a UID (PS3.5 9.1).
 * @param {*} value - Value.
 * @returns {boolean} Whether it is a UID.
 */
function isUid(value) {
  return typeof value === 'string' && value.length <= MaxUidLength && UidPattern.test(value);
}

//#region Client
class Client extends AsyncEventEmitter2 {
  /**
   * Creates an instance of Client.
   * @constructor
   */
  constructor() {
    super();
    this.requests = [];
    this.additionalPresentationContexts = [];
    this.network = undefined;
    this.statistics = new Statistics();
  }

  /**
   * Adds a request.
   * The client performs C-ECHO, C-FIND and C-STORE requests only.
   * @method
   * @param {CEchoRequest|CFindRequest|CStoreRequest} request - DICOM request.
   * @throws {Error} If request is not a C-ECHO, C-FIND or C-STORE request, or the requests were sent already.
   */
  addRequest(request) {
    if (this.network) {
      throw new Error(`${request.toString()} cannot be added: the requests were sent already`);
    }
    if (
      !(request instanceof CEchoRequest) &&
      !(request instanceof CFindRequest) &&
      !(request instanceof CStoreRequest)
    ) {
      throw new Error(`${request.toString()} is not a C-ECHO, C-FIND or C-STORE request`);
    }
    // Prevent duplicates
    if (this.requests.includes(request)) {
      log.warn(`${request.toString()} request has already been added. Ignoring...`);
      return;
    }
    this.requests.push(request);
  }

  /**
   * Clears all requests.
   * @method
   */
  clearRequests() {
    this.requests.length = 0;
  }

  /**
   * Adds an additional presentation context.
   * @method
   * @param {PresentationContext} context - Presentation context.
   * @param {boolean} [addAsNew] - Flag to indicate whether to add the provided context
   * as a new one, irrespectively if the respected SOP class already exists in the association.
   * @throws {Error} If request is not an instance of the Request class.
   */
  addAdditionalPresentationContext(context, addAsNew) {
    addAsNew = addAsNew || false;
    // Check if request is actually a context!
    if (!(context instanceof PresentationContext)) {
      throw new Error(`${context.toString()} is not a presentation context`);
    }
    // Prevent duplicates
    if (this.additionalPresentationContexts.some((i) => i.context === context)) {
      log.warn(`${context.toString()} context has already been added. Ignoring...`);
      return;
    }
    this.additionalPresentationContexts.push({ context, addAsNew });
  }

  /**
   * Sends requests to the remote host.
   * Without requests, the association only negotiates the additional presentation contexts and is then released.
   * @method
   * @param {string} host - Remote host.
   * @param {number} port - Remote port.
   * @param {string} callingAeTitle - Local AE title.
   * @param {string} calledAeTitle - Remote AE title.
   * @param {Object} opts - Network options.
   * @param {string} opts.implementationClassUid - Implementation class UID with which the client
   * identifies itself to the peer; the library has none of its own.
   * @param {string} [opts.implementationVersion] - Implementation version name with which the client
   * identifies itself to the peer; none is sent without it.
   * @param {number} [opts.connectTimeout] - TCP connect timeout in milliseconds.
   * @param {number} [opts.acseTimeout] - Timeout for the A-ASSOCIATE-AC/RJ and A-RELEASE-RP in milliseconds.
   * @param {number} [opts.dimseTimeout] - Timeout for a DIMSE response, from the last fragment
   * of the request handed to the operating system or from the last pending response, in milliseconds.
   * @param {number} [opts.idleTimeout] - Timeout without network progress while no other timeout runs,
   * e.g. a stalled send or an idle association, in milliseconds.
   * @param {number} [opts.maxPduLength] - Maximum PDU length announced to the peer; a received PDU
   * over it is refused before it is allocated.
   * @param {number} [opts.maxReceivedMessageLength] - Maximum length of the command and the dataset of
   * a received DIMSE message together, 1048576 by default; a longer message aborts the association.
   * @param {Array<string>} [opts.queryTransferSyntaxes] - Transfer syntaxes proposed, in this order, for the
   * presentation contexts of C-ECHO and C-FIND requests; Implicit and Explicit VR Little Endian by default.
   * A C-STORE request proposes one context for each of its variants instead.
   * @param {number} [opts.associationLingerTimeout] - Association linger timeout in milliseconds.
   * @param {Object} [opts.datasetReadOptions] - The read options to pass through to `DicomMessage._read()`.
   * @param {Object} [opts.datasetWriteOptions] - The write options to pass through to `DicomMessage.write()`.
   * @param {Object} [opts.datasetNameMap] - Additional DICOM tags to recognize when denaturalizing the dataset.
   * @param {Object} [opts.asyncOps] - Asynchronous operations options.
   * @param {number} [opts.asyncOps.maxAsyncOpsInvoked] - Supported maximum number of asynchronous operations invoked.
   * @param {number} [opts.asyncOps.maxAsyncOpsPerformed] - Supported maximum number of asynchronous operations performed.
   * @param {Object} [opts.userIdentity] - User identity negotiation options.
   * @param {UserIdentityType} [opts.userIdentity.type] - User identity type.
   * @param {boolean} [opts.userIdentity.positiveResponseRequested] - Expect positive response.
   * @param {string} [opts.userIdentity.primaryField] - User identity primary field.
   * @param {string} [opts.userIdentity.secondaryField] - User identity secondary field.
   * @throws {Error} If there are neither requests nor additional presentation contexts, an additional
   * presentation context has no transfer syntax, more than 128 presentation contexts would be proposed or
   * an option is not valid; TLS
   * (`opts.securityOptions`) is refused, as the fork has no TLS.
   */
  send(host, port, callingAeTitle, calledAeTitle, opts) {
    opts = opts || {};
    this.associationLingerTimeout = opts.associationLingerTimeout || 0;

    // Without requests, the association only negotiates the additional presentation contexts and is released
    if (this.requests.length === 0 && this.additionalPresentationContexts.length === 0) {
      throw new Error('There are no requests to perform and no presentation contexts to propose');
    }
    // A presentation context is proposed with at least one transfer syntax (PS3.8 9.3.2.2)
    this.additionalPresentationContexts.forEach(({ context }) => {
      if (context.getTransferSyntaxUids().length === 0) {
        throw new Error(`The presentation context of ${context.getAbstractSyntaxUid()} has no transfer syntax to propose`);
      }
    });
    // Check the options before connecting; a connection without the TLS that was asked for is never made
    if (opts.securityOptions !== undefined) {
      throw new Error('The securityOptions option is refused: the client has no TLS');
    }
    Network.timeoutsFromOptions(opts);
    if (!isUid(opts.implementationClassUid)) {
      throw new Error(
        `The implementationClassUid option must be a UID of at most ${MaxUidLength} characters (PS3.5 9.1)`
      );
    }
    if (
      opts.implementationVersion !== undefined &&
      (typeof opts.implementationVersion !== 'string' ||
        !ImplementationVersionPattern.test(opts.implementationVersion))
    ) {
      throw new Error(
        'The implementationVersion option must be 1 to 16 ISO 646 characters without spaces at either end'
      );
    }
    const queryTransferSyntaxes =
      opts.queryTransferSyntaxes !== undefined ? opts.queryTransferSyntaxes : DefaultQueryTransferSyntaxes;
    if (
      !Array.isArray(queryTransferSyntaxes) ||
      queryTransferSyntaxes.length === 0 ||
      new Set(queryTransferSyntaxes).size !== queryTransferSyntaxes.length ||
      !queryTransferSyntaxes.every(isUid)
    ) {
      throw new Error('The queryTransferSyntaxes option must be a non-empty list of distinct UIDs (PS3.5 9.1)');
    }
    if (
      opts.maxPduLength !== undefined &&
      (!Number.isInteger(opts.maxPduLength) ||
        opts.maxPduLength < PduLength.Minimum ||
        opts.maxPduLength > PduLength.Maximum)
    ) {
      throw new Error(
        `The maxPduLength option must be an integer from ${PduLength.Minimum} to ${PduLength.Maximum}`
      );
    }
    if (
      opts.maxReceivedMessageLength !== undefined &&
      (!Number.isInteger(opts.maxReceivedMessageLength) ||
        opts.maxReceivedMessageLength < 1 ||
        opts.maxReceivedMessageLength > PduLength.Maximum)
    ) {
      throw new Error(
        `The maxReceivedMessageLength option must be an integer from 1 to ${PduLength.Maximum}`
      );
    }

    // Create association object
    const association = new Association(callingAeTitle, calledAeTitle);
    association.setImplementationClassUid(opts.implementationClassUid);
    association.setImplementationVersion(opts.implementationVersion);
    if (opts.maxPduLength !== undefined) {
      association.setMaxPduLength(opts.maxPduLength);
    }
    if (opts.asyncOps) {
      association.setMaxAsyncOpsInvoked(opts.asyncOps.maxAsyncOpsInvoked || 1);
      association.setMaxAsyncOpsPerformed(opts.asyncOps.maxAsyncOpsPerformed || 1);
      association.setNegotiateAsyncOps(
        association.getMaxAsyncOpsInvoked() !== 1 || association.getMaxAsyncOpsPerformed() !== 1
      );
    }
    if (opts.userIdentity) {
      association.setUserIdentityType(opts.userIdentity.type || UserIdentityType.Username);
      association.setUserIdentityPositiveResponseRequested(
        opts.userIdentity.positiveResponseRequested || false
      );
      association.setUserIdentityPrimaryField(opts.userIdentity.primaryField || '');
      association.setUserIdentitySecondaryField(opts.userIdentity.secondaryField || '');
      association.setNegotiateUserIdentity(true);
    }

    // Add requests
    this.requests.forEach((request) => {
      association.addPresentationContextFromRequest(request, queryTransferSyntaxes);
    });

    // Add additional presentation contexts
    this.additionalPresentationContexts.forEach((item) => {
      const pcId = item.addAsNew
        ? association.addPresentationContext(item.context.getAbstractSyntaxUid())
        : association.addOrGetPresentationContext(item.context.getAbstractSyntaxUid());
      const transferSyntaxes = item.context.getTransferSyntaxUids();
      transferSyntaxes.forEach((transferSyntax) => {
        association.addTransferSyntaxToPresentationContext(pcId, transferSyntax);
      });
    });

    // Every request ends with done, also when the association ends before its final response
    const requests = [...this.requests];
    const finished = new Set();
    requests.forEach((request) => request.once('done', () => finished.add(request)));

    // Connect
    log.info(`Connecting to ${host}:${port}`);
    const socket = net.connect({ host, port });

    const network = new Network(socket, opts);
    network.on('connect', () => {
      this.emit('connected');
      // A connected listener may abort before the association request is sent.
      if (socket.destroyed || socket.writableEnded) {
        return;
      }
      network.sendAssociationRequest(association);
    });
    network.on('associationAccepted', (association) => {
      this.emit('associationAccepted', association);
      network.sendRequests(requests);
    });
    // The requestor closes the transport connection (PS3.8 9.2.3, AR-3, AE-4)
    network.on('associationReleaseResponse', () => {
      this.emit('associationReleased');
      network.close();
    });
    network.on('associationRejected', (reject) => {
      this.emit('associationRejected', reject);
      network.close();
    });
    let lingerTimer = undefined;
    network.on('done', () => {
      lingerTimer = setTimeout(() => network.sendAssociationReleaseRequest(), this.associationLingerTimeout);
    });
    network.on('associationReleaseRequested', () => {
      // The release response is sent; the association is over (PS3.8 9.2.3, AR-4)
      network.close();
    });
    network.on('abort', (abort) => {
      this.emit('abort', abort);
      // The association is gone; close the transport connection (PS3.8, AA-3)
      network.close();
    });
    network.on('networkError', (err) => {
      // Close rather than just end the socket; a half-closed socket is retained
      // (along with its pending requests) until the peer closes its side,
      // which never happens with an unresponsive peer
      network.close();
      this.emit('networkError', err);
    });
    network.on('close', (outcome) => {
      clearTimeout(lingerTimer);
      this.statistics.addFromOtherStatistics(network.getStatistics());
      this.network = undefined;
      requests
        .filter((request) => !finished.has(request))
        .forEach((request) => this._endUnfinishedRequest(request));
      this.emit('closed', outcome);
    });
    this.network = network;
  }

  /**
   * Gets network statistics.
   * @method
   * @returns {Statistics} Network statistics.
   */
  getStatistics() {
    return this.statistics;
  }

  //#region Private Methods
  /**
   * Ends a request the association ended before its final response came: it was not sent when no byte of
   * its dataset (C-STORE) or of its command (C-ECHO, C-FIND) was handed to the operating system
   * (integrace-dicom.md 6.2, 8.2); otherwise its outcome is unknown to the client.
   * @method
   * @private
   * @param {Request} request - The request.
   */
  _endUnfinishedRequest(request) {
    const isSent =
      request instanceof CStoreRequest ? request.getDatasetBytesSent() > 0 : request.getCommandBytesSent() > 0;
    if (!isSent) {
      request.raiseNotSentEvent(NotSentReason.AssociationEnded);
    }
    request.raiseDoneEvent();
  }
  //#endregion

  /**
   * Aborts the established association.
   * If the association has not been requested yet, the connection is
   * closed without sending an A-ABORT and the requests are not performed.
   * @method
   * @param {AbortSource} [source] - Abortion source.
   * @param {AbortReason} [reason] - Abortion reason.
   * @throws {Error} If the network has not been initialized.
   */
  abort(source, reason) {
    if (!this.network) {
      throw new Error('Network has not been initialized');
    }

    // The association request has not been sent yet, so there is nothing to abort
    // on the wire; close the connection so that the requests are not performed
    if (!this.network.association) {
      this.network.close();
      return;
    }

    // Flush the A-ABORT and then close the connection; an unresponsive peer
    // would otherwise keep the socket open indefinitely
    this.network.sendAbort(source, reason);
    this.network.close();
  }

  /**
   * Stops reading responses after the one that is being processed, so that the peer is held by the TCP window.
   * The DIMSE and idle timeouts do not run while reading is paused; the caller bounds the pause.
   * Does nothing before the connection is made or after it is closed.
   * @method
   */
  pauseReceiving() {
    if (this.network) {
      this.network.pauseReceiving();
    }
  }

  /**
   * Reads the responses again, first those received while paused.
   * Does nothing before the connection is made or after it is closed.
   * @method
   */
  resumeReceiving() {
    if (this.network) {
      this.network.resumeReceiving();
    }
  }

  /**
   * Cancels a C-FIND request.
   * @method
   * @param {CFindRequest} request - C-FIND request.
   * @throws {Error} If request is not an instance of CFindRequest or the network has not been initialized.
   */
  cancel(request) {
    if (!this.network) {
      throw new Error('Network has not been initialized');
    }

    this.network.sendCancel(request);
  }
}
//#endregion

//#region Exports
module.exports = Client;
//#endregion
