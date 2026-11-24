const {
  AAbort,
  AAssociateAC,
  AAssociateRJ,
  AAssociateRQ,
  AReleaseRP,
  AReleaseRQ,
  PDataTF,
  Pdv,
  RawPdu,
} = require('./Pdu');
const {
  AbortReason,
  AbortSource,
  AssociationOutcome,
  CommandFieldType,
  DefaultImplementation,
  NotSentReason,
  PduLength,
  PresentationContextResult,
  RawPduType,
  Status,
  TimeoutKind,
  UncompressedTransferSyntaxes,
} = require('./Constants');
const {
  CCancelRequest,
  CEchoResponse,
  CFindRequest,
  CFindResponse,
  Command,
  CStoreRequest,
  CStoreResponse,
  Request,
} = require('./Command');
const Dataset = require('./Dataset');
const { characterSetProblem } = require('./CharacterSet');
const { commandSetProblem, datasetStructureProblem } = require('./Structure');
const Statistics = require('./Statistics');
const log = require('./log');

const { EOL } = require('os');
const AsyncEventEmitter2 = require('async-event-emitter2');

// Longest wait for the peer to close its side before the socket is destroyed, the ARTIM timer of Sta13
const CloseGracePeriod = 1000;

// Library defaults; pynetdicom 3.0.4 uses the same ACSE, DIMSE and network (idle) timeouts
const DefaultTimeouts = {
  [TimeoutKind.Connect]: 30 * 1000,
  [TimeoutKind.Acse]: 30 * 1000,
  [TimeoutKind.Dimse]: 30 * 1000,
  [TimeoutKind.Idle]: 60 * 1000,
};
const TimeoutOptions = {
  [TimeoutKind.Connect]: 'connectTimeout',
  [TimeoutKind.Acse]: 'acseTimeout',
  [TimeoutKind.Dimse]: 'dimseTimeout',
  [TimeoutKind.Idle]: 'idleTimeout',
};
// The four timeouts replace these options, which are refused rather than silently ignored
const ReplacedTimeoutOptions = ['associationTimeout', 'pduTimeout'];
// Longest delay setTimeout accepts; a longer one fires at once
const MaxTimeout = 2147483647;

const KnownPduTypes = [
  RawPduType.AAssociateRQ,
  RawPduType.AAssociateAC,
  RawPduType.AAssociateRJ,
  RawPduType.PDataTF,
  RawPduType.AReleaseRQ,
  RawPduType.AReleaseRP,
  RawPduType.AAbort,
];
const PduNames = {
  [RawPduType.AAssociateRQ]: 'A-ASSOCIATE-RQ',
  [RawPduType.AAssociateAC]: 'A-ASSOCIATE-AC',
  [RawPduType.AAssociateRJ]: 'A-ASSOCIATE-RJ',
  [RawPduType.PDataTF]: 'P-DATA-TF',
  [RawPduType.AReleaseRQ]: 'A-RELEASE-RQ',
  [RawPduType.AReleaseRP]: 'A-RELEASE-RP',
  [RawPduType.AAbort]: 'A-ABORT',
};

// States of the association requestor in which it reads PDUs (PS3.8 9.2.3)
const AssociationState = {
  // Sta5
  AwaitingAssociateResponse: 'awaiting-associate-response',
  // Sta6
  Established: 'established',
  // Sta7
  AwaitingReleaseResponse: 'awaiting-release-response',
  // Sta11: the release request of the peer answered in a release collision
  ReleaseCollision: 'release-collision',
  // Sta13 and Sta1: the association is over and a PDU is ignored
  Ended: 'ended',
};
// Any other PDU in these states is action AA-8 of PS3.8 9.2.3
const ExpectedPduTypes = {
  [AssociationState.AwaitingAssociateResponse]: [
    RawPduType.AAssociateAC,
    RawPduType.AAssociateRJ,
    RawPduType.AAbort,
  ],
  [AssociationState.Established]: [RawPduType.PDataTF, RawPduType.AReleaseRQ, RawPduType.AAbort],
  [AssociationState.AwaitingReleaseResponse]: [
    RawPduType.PDataTF,
    RawPduType.AReleaseRQ,
    RawPduType.AReleaseRP,
    RawPduType.AAbort,
  ],
  [AssociationState.ReleaseCollision]: [RawPduType.AReleaseRP, RawPduType.AAbort],
};

// The command and the dataset of one received message; a C-FIND identifier is far smaller
const DefaultMaxReceivedMessageLength = 1024 * 1024;

// PS3.7 E.1: the command field of a response is the one of its request with this bit set
const ResponseCommandFieldBit = 0x8000;
// PS3.4 C.4.1.1.4: the C-FIND statuses that are not final
const PendingStatuses = [Status.Pending, Status.PendingWarning];
// The timeouts that wait for the peer to send, which it cannot while nothing is read
const PausedTimeoutKinds = [TimeoutKind.Dimse, TimeoutKind.Idle];

//#region Network
class Network extends AsyncEventEmitter2 {
  /**
   * Creates an instance of Network.
   * @constructor
   * @param {Socket} socket - Network socket.
   * @param {Object} [opts] - Network options.
   * @param {number} [opts.connectTimeout] - TCP connect timeout in milliseconds.
   * @param {number} [opts.acseTimeout] - Timeout for the A-ASSOCIATE-AC/RJ and A-RELEASE-RP in milliseconds.
   * @param {number} [opts.dimseTimeout] - Timeout for a DIMSE response, from the last fragment
   * of the request handed to the operating system or from the last pending response, in milliseconds.
   * @param {number} [opts.idleTimeout] - Timeout without network progress while no other timeout runs,
   * e.g. a stalled send or an idle association, in milliseconds.
   * @param {number} [opts.maxReceivedMessageLength] - Maximum length of the command and the dataset of
   * a received DIMSE message together; a longer message aborts the association.
   * @param {Object} [opts.datasetReadOptions] - The read options to pass through to `DicomMessage._read()`.
   * @param {Object} [opts.datasetWriteOptions] - The write options to pass through to `DicomMessage.write()`.
   * @param {Object} [opts.datasetNameMap] - Additional DICOM tags to recognize when denaturalizing the dataset.
   * @throws {Error} If a timeout is not a positive number of milliseconds or a replaced timeout option is given.
   */
  constructor(socket, opts) {
    super();
    this.messageId = 0;
    this.socket = socket;
    this.requests = [];
    this.pending = [];

    this.state = undefined;
    this.incoming = undefined;
    this.outcome = undefined;
    this.hasConnected = false;

    opts = opts || {};
    this.timeouts = Network.timeoutsFromOptions(opts);
    this.maxReceivedMessageLength =
      opts.maxReceivedMessageLength !== undefined
        ? opts.maxReceivedMessageLength
        : DefaultMaxReceivedMessageLength;
    this.datasetReadOptions = opts.datasetReadOptions || {};
    this.datasetWriteOptions = opts.datasetWriteOptions || {};
    this.datasetNameMap = opts.datasetNameMap || {};
    this.logId = '';
    this.timeoutKind = undefined;
    this.timeoutId = undefined;
    this.awaitingResponse = new Set();
    this.fullySent = new WeakSet();
    this.requestContextIds = new WeakMap();
    this.outgoing = [];
    this.waitingForDrain = false;
    this.receivingPaused = false;
    this.timeoutKindWhilePaused = undefined;
    this.pausedPdvs = undefined;
    this.statistics = new Statistics();

    this._wrapSocket();
  }

  /**
   * Stops reading received PDVs after the message that is being handed over, also inside a P-DATA-TF that
   * carries more messages (PS3.8 9.3.5), and stops reading the socket, so that the peer is held by the TCP
   * window. The DIMSE and idle timeouts do not run meanwhile: the peer cannot progress while nothing is read,
   * so the caller bounds the pause. The connect and ACSE timeouts run on. Does nothing before the connection
   * is made.
   * @method
   */
  pauseReceiving() {
    if (this.receivingPaused || !this.hasConnected || this._isSocketClosing()) {
      return;
    }
    this.receivingPaused = true;
    if (PausedTimeoutKinds.includes(this.timeoutKind)) {
      this.timeoutKindWhilePaused = this.timeoutKind;
      this._clearTimeout();
    }
    this.pduAccumulator.pause();
    this.socket.pause();
  }

  /**
   * Reads the rest of the P-DATA-TF it paused in, the PDUs received while paused and the socket again;
   * the timeout that ran before the pause starts anew.
   * @method
   */
  resumeReceiving() {
    if (!this.receivingPaused) {
      return;
    }
    this.receivingPaused = false;
    const kind = this.timeoutKindWhilePaused;
    this.timeoutKindWhilePaused = undefined;
    if (kind !== undefined) {
      this._startTimeout(kind);
    }
    const paused = this.pausedPdvs;
    this.pausedPdvs = undefined;
    if (paused !== undefined && this._isReceiving()) {
      this._takePdvs(paused.pdvs, paused.next);
    }
    if (this.receivingPaused) {
      return;
    }
    this.pduAccumulator.resume();
    if (!this.receivingPaused && !this._isSocketClosing()) {
      this.socket.resume();
    }
  }

  /**
   * Sends association request.
   * @method
   * @param {Association} association - Association.
   */
  sendAssociationRequest(association) {
    this.association = association;
    this.state = AssociationState.AwaitingAssociateResponse;
    const rq = new AAssociateRQ(this.association);
    const rqPdu = rq.write();

    this.logId = this.association.getCalledAeTitle();
    log.info(`${this.logId} -> Association request:${EOL}${this.association.toString()}`);
    this._sendPdu(rqPdu);
    this._startTimeout(TimeoutKind.Acse);
  }

  /**
   * Sends association release request.
   * @method
   */
  sendAssociationReleaseRequest() {
    if (this.state !== AssociationState.Established) {
      log.info(`${this.logId} -> The association is not established. Skipping release request...`);
      return;
    }
    this.state = AssociationState.AwaitingReleaseResponse;
    const rq = new AReleaseRQ();
    const rqPdu = rq.write();

    log.info(`${this.logId} -> Association release request`);
    this._sendPdu(rqPdu);
    this._startTimeout(TimeoutKind.Acse);
  }

  /**
   * Sends association release response.
   * @method
   */
  sendAssociationReleaseResponse() {
    const rq = new AReleaseRP();
    const rqPdu = rq.write();

    log.info(`${this.logId} -> Association release response`);
    // No P-DATA-TF follows the release response (PS3.8 9.2.3, AR-4), and the response does not wait for it
    this.outgoing.length = 0;
    this._sendPdu(rqPdu, true);
  }

  /**
   * Sends requests.
   * @method
   * @param {Array<Request>|Request} requests - Requests to perform.
   */
  sendRequests(requests) {
    const rqs = Array.isArray(requests) ? requests : [requests];
    this.requests.push(...rqs);
    this._sendNextRequests();
  }

  /**
   * Sends cancel request.
   * @method
   * @param {CFindRequest} request - C-FIND request.
   * @throws {Error} If request is not an instance of CFindRequest.
   */
  sendCancel(request) {
    if (!this.association) {
      log.error(
        `There is no association in which to cancel request ${request.toString()}. Skipping...`
      );
      return;
    }

    // PS3.7 9.3.2.3: the C-CANCEL goes on the presentation context of the C-FIND it cancels
    if (!this.pending.includes(request)) {
      log.info(`${this.logId} -> ${request.toString()} is not outstanding. Skipping cancel...`);
      return;
    }
    const context = this.association.getPresentationContext(this.requestContextIds.get(request));
    const dimse = { context, command: CCancelRequest.fromRequest(request) };
    this._sendDimse(dimse);
  }

  /**
   * Sends abort request.
   * @method
   * @param {number} [source] - Abortion source.
   * @param {number} [reason] - Abortion reason.
   */
  sendAbort(source, reason) {
    if (!this.association || this.state === AssociationState.Ended) {
      log.info(`${this.logId} -> There is no association to abort. Skipping...`);
      return;
    }

    const rq = new AAbort(source, reason);
    const rqPdu = rq.write();

    this._endAssociation(AssociationOutcome.AbortedLocally);
    this.state = AssociationState.Ended;
    log.info(`${this.logId} -> Abort ${rq.toString()}`);
    // Nothing that waits is sent after an A-ABORT, and the A-ABORT itself does not wait
    this.outgoing.length = 0;
    this._sendPdu(rqPdu, true);
  }

  /**
   * Closes the connection.
   * Pending outgoing data (e.g. an A-ABORT PDU) is sent and the connection ends once the peer closes its
   * side, at the latest after a short grace period (Sta13 of PS3.8 9.2.3). Until then the received data is
   * read and ignored: a socket destroyed with unread data resets the connection, and the peer could lose
   * the A-ABORT it has not read yet.
   * @method
   */
  close() {
    if (this.socket.destroyed) {
      return;
    }
    this._endAssociation(AssociationOutcome.AbortedLocally);
    this.state = AssociationState.Ended;

    // Nothing has been sent over a connection that is still being established
    if (this.socket.connecting) {
      this.socket.destroy();
      return;
    }

    // Stop the timeouts; if the peer stalls while the pending data is
    // being flushed, they would emit a spurious network error during the
    // graceful close of an intentionally aborted or finished connection
    this._reset();

    const destroyTimer = setTimeout(() => this.socket.destroy(), CloseGracePeriod);
    this.socket.once('close', () => clearTimeout(destroyTimer));
    this.socket.once('end', () => this.socket.destroy());
    this.socket.end();
  }

  /**
   * Gets network statistics.
   * @method
   * @returns {Statistics} Network statistics.
   */
  getStatistics() {
    return this.statistics;
  }

  /**
   * Gets how the association ended, once it ended: the first cause of the end, with the timeout kind
   * when a timeout ended it (integrace-dicom.md 6.2).
   * @method
   * @returns {{outcome: AssociationOutcome, timeout: (TimeoutKind|undefined)}|undefined} Outcome, if ended.
   */
  getAssociationOutcome() {
    return this.outcome;
  }

  /**
   * Gets the four timeouts from the network options, with the defaults for those not given.
   * @method
   * @static
   * @param {Object} [opts] - Network options.
   * @returns {Object} Timeouts in milliseconds by timeout kind.
   * @throws {Error} If a timeout is not an integer number of milliseconds from 1 to 2147483647 or a replaced
   * timeout option is given.
   */
  static timeoutsFromOptions(opts) {
    const options = opts || {};
    const replaced = ReplacedTimeoutOptions.find((option) => options[option] !== undefined);
    if (replaced !== undefined) {
      throw new Error(
        `The ${replaced} option was replaced by connectTimeout, acseTimeout, dimseTimeout and idleTimeout`
      );
    }
    const timeouts = {};
    Object.keys(TimeoutOptions).forEach((kind) => {
      const value = options[TimeoutOptions[kind]];
      if (value === undefined) {
        timeouts[kind] = DefaultTimeouts[kind];
        return;
      }
      if (!Number.isInteger(value) || value < 1 || value > MaxTimeout) {
        throw new Error(
          `The ${TimeoutOptions[kind]} option must be an integer number of milliseconds from 1 to ${MaxTimeout}`
        );
      }
      timeouts[kind] = value;
    });
    return timeouts;
  }

  //#region Private Methods
  /**
   * Advances the message ID.
   * @method
   * @private
   */
  _getNextMessageId() {
    return ++this.messageId % 65536;
  }

  /**
   * Sends PDU over the network.
   * @method
   * @private
   * @param {RawPdu} pdu - PDU.
   * @param {boolean} [immediately] - Write it now, ahead of the queued PDUs (A-ABORT).
   */
  _sendPdu(pdu, immediately) {
    if (this._isSocketClosing()) {
      log.info(`${this.logId} -> Connection is closing. Skipping PDU [type: ${pdu.getType()}]`);
      return;
    }

    if (immediately) {
      this._writePdu(() => pdu.writePdu(), undefined);
      return;
    }
    this._queuePdu(() => pdu.writePdu(), undefined);
  }

  /**
   * Queues a PDU to be written once the PDUs before it are written and the socket accepts more.
   * Waiting for the socket keeps the memory bounded and makes every write a sign of network progress.
   * @method
   * @private
   * @param {function(): Buffer} build - Builds the PDU bytes when it is written.
   * @param {function()} [onSent] - Called once the PDU is handed to the operating system.
   */
  _queuePdu(build, onSent) {
    this.outgoing.push({ build, onSent });
    if (!this.waitingForDrain) {
      this._writeQueuedPdus();
    }
  }

  /**
   * Writes the queued PDUs until the socket asks to wait for it to drain.
   * @method
   * @private
   */
  _writeQueuedPdus() {
    while (this.outgoing.length > 0) {
      if (this._isSocketClosing()) {
        this.outgoing.length = 0;
        return;
      }
      const { build, onSent } = this.outgoing.shift();
      if (!this._writePdu(build, onSent)) {
        this.waitingForDrain = true;
        this.socket.once('drain', () => {
          this.waitingForDrain = false;
          this._markProgress();
          this._writeQueuedPdus();
        });
        return;
      }
    }
  }

  /**
   * Writes a PDU to the socket.
   * @method
   * @private
   * @param {function(): Buffer} build - Builds the PDU bytes.
   * @param {function()} [onSent] - Called once the PDU is handed to the operating system.
   * @returns {boolean} Whether the socket accepts more data without waiting to drain.
   */
  _writePdu(build, onSent) {
    let buffer = undefined;
    try {
      buffer = build();
    } catch (err) {
      log.error(`${this.logId} -> Error sending PDU: ${err.message}`);
      this.outgoing.length = 0;
      this.emit('networkError', err);
      return true;
    }
    const accepted = this.socket.write(buffer, (err) => {
      if (err) {
        return;
      }
      this._markProgress();
      if (onSent) {
        onSent();
      }
    });
    this.statistics.addBytesSent(buffer.length);
    return accepted;
  }

  /**
   * Sends requests over the network.
   * @method
   * @private
   */
  _sendNextRequests() {
    const processNextRequest = () => {
      // The connection is closing (e.g. aborted from a listener); neither dispatch
      // further requests nor signal completion, which would trigger a release request
      if (this._isSocketClosing()) {
        return;
      }
      const request = this.requests.shift();
      if (!request) {
        // Done with requests
        this.emit('done');
        return;
      }
      const context = this.association.getAcceptedPresentationContextFromRequest(request);
      if (!context) {
        log.error(
          `Could not find an accepted presentation context for request ${request.toString()}. Skipping...`
        );
        this._raiseNotSent(request, NotSentReason.NoAcceptedPresentationContext);
        processNextRequest();
        return;
      }
      // Select the variant to store and lazy load it
      if (request instanceof CStoreRequest) {
        try {
          request.selectPresentationContext(context);
          request.loadFullDatasetIfNeeded();
        } catch (err) {
          log.error(
            `Could not load the stored dataset of request ${request.toString()}: ${err.message}. Skipping...`
          );
          this._raiseNotSent(request, NotSentReason.StoredDatasetUnavailable);
          processNextRequest();
          return;
        }
      }
      request.setMessageId(this._getNextMessageId());
      this.pending.push(request);
      this.requestContextIds.set(request, context.getPresentationContextId());
      const dimse = { context, command: request };
      dimse.command.once('done', () => {
        // Request is done (there are no more pending responses)
        processNextRequest();
      });
      this._sendDimse(dimse);
    };
    processNextRequest();
  }

  /**
   * Sends DIMSE over the network.
   * @method
   * @private
   * @param {Object} dimse - DIMSE information.
   * @param {Command} dimse.command - Command.
   * @param {PresentationContext} dimse.context - Presentation context.
   */
  _sendDimse(dimse) {
    if (this._isSocketClosing()) {
      log.info(`${this.logId} -> Connection is closing. Skipping ${dimse.command.toString()}`);
      return;
    }

    try {
      const dataset = dimse.command.getDataset();
      // A C-FIND identifier, which the client encodes; stored bytes go out as they are
      const characterSetMismatch =
        dataset && !dataset.isStored() ? characterSetProblem(dataset.getElements()) : undefined;
      if (characterSetMismatch !== undefined) {
        log.error(`${this.logId} -> ${dimse.command.toString()} was not sent: ${characterSetMismatch}`);
        this._raiseNotSent(dimse.command, NotSentReason.CharacterSetMismatch);
        return;
      }
      const presentationContext = this.association.getPresentationContext(
        dimse.context.getPresentationContextId()
      );
      const acceptedTransferSyntaxUid = presentationContext.getAcceptedTransferSyntaxUid();
      if (dataset && acceptedTransferSyntaxUid !== dataset.getTransferSyntaxUid()) {
        if (
          dataset.isStored() ||
          !UncompressedTransferSyntaxes.includes(dataset.getTransferSyntaxUid()) ||
          !UncompressedTransferSyntaxes.includes(acceptedTransferSyntaxUid)
        ) {
          const notSent = `${dimse.command.toString()} was not sent: the dataset is encoded in ${dataset.getTransferSyntaxUid()}, the peer accepted ${acceptedTransferSyntaxUid}`;
          log.error(`${this.logId} -> ${notSent}`);
          this._raiseNotSent(dimse.command, NotSentReason.TransferSyntaxMismatch);
          return;
        }
        dataset.setTransferSyntaxUid(acceptedTransferSyntaxUid);
      }
      this._sendPDataTF(
        dimse.command,
        dimse.context.getPresentationContextId(),
        this._getMaxSentPduLength()
      );
    } catch (err) {
      this._abortOnError(`Error sending DIMSE: ${err.message}`, err);
    }
  }

  /**
   * Aborts an established association over a local error, as the service user whose reason is not
   * significant (PS3.8 9.3.8), and reports the error.
   * @method
   * @private
   * @param {string} message - What went wrong.
   * @param {Error} err - The error.
   */
  _abortOnError(message, err) {
    log.error(`${this.logId} -> ${message}`);
    if (
      this.state === AssociationState.Established ||
      this.state === AssociationState.AwaitingReleaseResponse
    ) {
      this.sendAbort(AbortSource.ServiceUser, AbortReason.NotSpecified);
    }
    this.emit('networkError', err);
  }

  /**
   * Raises the not sent and done events of a request none of whose dataset bytes were sent.
   * @method
   * @private
   * @param {Request} request - The request that was not sent.
   * @param {NotSentReason} reason - Why the request was not sent.
   */
  _raiseNotSent(request, reason) {
    this.pending = this.pending.filter((pendingRequest) => pendingRequest !== request);
    request.raiseNotSentEvent(reason);
    request.raiseDoneEvent();
  }

  /**
   * Sends PDataTF over the network.
   * The command and the dataset are split into fragments so that no P-DATA-TF PDU is longer than the maximum.
   * @method
   * @private
   * @param {Command} command - The requesting command.
   * @param {number} pcId - Presentation context ID.
   * @param {number} maxPduLength - Maximum PDU length.
   */
  _sendPDataTF(command, pcId, maxPduLength) {
    const commandDataset = command.getCommandDataset();
    const commandBuffer = commandDataset.getDenaturalizedCommandDataset();

    log.info(`${this.logId} -> ${command.toString()} [pc: ${pcId}]`);

    const dataset = command.getDataset();
    // Encoded before anything is queued, so that a dataset that cannot be encoded sends no command either
    const datasetBuffer = !dataset
      ? undefined
      : dataset.isStored()
        ? dataset.getStoredDataset()
        : dataset.getDenaturalizedDataset(this.datasetWriteOptions, this.datasetNameMap);
    const awaitsResponse = command instanceof Request && !(command instanceof CCancelRequest);
    const onSent = awaitsResponse ? () => this._requestSent(command) : undefined;
    const onFragmentSent =
      command instanceof Request
        ? (isCommand, fragment) => command.countSentBytes(isCommand, fragment)
        : undefined;

    const onCommandSent = datasetBuffer ? undefined : onSent;
    this._queuePdvs(pcId, commandBuffer, true, maxPduLength, onCommandSent, onFragmentSent);
    if (datasetBuffer) {
      this._queuePdvs(pcId, datasetBuffer, false, maxPduLength, onSent, onFragmentSent);
    }
  }

  /**
   * Queues a command or a dataset as P-DATA-TF PDUs of one PDV each, the last one flagged as the last fragment.
   * @method
   * @private
   * @param {number} pcId - Presentation context ID.
   * @param {Buffer} value - Command or dataset bytes.
   * @param {boolean} isCommand - Whether the value is a command.
   * @param {number} maxPduLength - Maximum PDU length.
   * @param {function()} [onLastSent] - Called once the last fragment is handed to the operating system.
   * @param {function(boolean, Buffer)} [onFragmentSent] - Called with whether it is the command and the bytes
   * of each fragment once it is handed to the operating system.
   */
  _queuePdvs(pcId, value, isCommand, maxPduLength, onLastSent, onFragmentSent) {
    // Even fragments keep data element values whole in pairs of bytes; one byte when nothing more fits
    const room = maxPduLength - PduLength.PdvItemHeader;
    const fragmentLength = room > 1 ? room - (room % 2) : 1;
    let offset = 0;
    do {
      const fragment = value.subarray(offset, offset + fragmentLength);
      offset += fragment.length;
      const isLast = offset >= value.length;

      this._queuePdu(
        () => {
          const pDataTf = new PDataTF();
          pDataTf.addPdv(new Pdv(pcId, fragment, isCommand, isLast));
          return pDataTf.write().writePdu();
        },
        () => {
          if (onFragmentSent) {
            onFragmentSent(isCommand, fragment);
          }
          if (isLast && onLastSent) {
            onLastSent();
          }
        }
      );
    } while (offset < value.length);
  }

  /**
   * Process received PDU from the network.
   * A PDU the association does not expect in its state, or one that is not valid, aborts it: action AA-8
   * of PS3.8 9.2.3. Once the association is over, a PDU is ignored.
   * @method
   * @private
   * @param {Buffer} data - Accumulated PDU data.
   */
  _processPdu(data) {
    if (this.state === AssociationState.Ended) {
      return;
    }
    const raw = new RawPdu(data);
    const type = raw.getType();
    const expected = ExpectedPduTypes[this.state] || [];
    if (!expected.includes(type)) {
      this._rejectPdu(`Unexpected ${PduNames[type]} from the peer`, AbortReason.UnexpectedPdu);
      return;
    }

    let pdu = undefined;
    try {
      pdu = this._readPdu(raw);
    } catch (err) {
      this._rejectPdu(`Invalid ${PduNames[type]} from the peer: ${err.message}`, AbortReason.InvalidPduParameter);
      return;
    }

    switch (type) {
      case RawPduType.AAssociateAC: {
        log.info(`${this.logId} <- Association accept:${EOL}${this.association.toString()}`);
        const peerMaxPduLength = this.association.getPeerMaxPduLength();
        if (
          peerMaxPduLength !== undefined &&
          peerMaxPduLength !== 0 &&
          peerMaxPduLength < PduLength.Minimum
        ) {
          this._rejectPdu(
            `The peer maximum PDU length ${peerMaxPduLength} cannot carry any PDV`,
            AbortReason.InvalidPduParameter
          );
          return;
        }
        this.state = AssociationState.Established;
        this._startTimeout(TimeoutKind.Idle);
        this.emit('associationAccepted', this.association);
        return;
      }
      case RawPduType.AAssociateRJ: {
        this._endAssociation(AssociationOutcome.Rejected);
        this.state = AssociationState.Ended;
        log.info(`${this.logId} <- Association reject ${pdu.toString()}`);
        this.emit('associationRejected', {
          result: pdu.getResult(),
          source: pdu.getSource(),
          reason: pdu.getReason(),
        });
        return;
      }
      case RawPduType.PDataTF: {
        this._processPDataTf(pdu);
        return;
      }
      case RawPduType.AReleaseRQ: {
        log.info(`${this.logId} <- Association release request`);
        // AR-2 and AR-4 of PS3.8 9.2.3 on an established association; in a release collision AR-8 and AR-9,
        // after which the client waits only for the release response of the peer (Sta11)
        this.sendAssociationReleaseResponse();
        if (this.state === AssociationState.AwaitingReleaseResponse) {
          this.state = AssociationState.ReleaseCollision;
          return;
        }
        this._endAssociation(AssociationOutcome.ReleasedByPeer);
        this.state = AssociationState.Ended;
        this.emit('associationReleaseRequested');
        return;
      }
      case RawPduType.AReleaseRP: {
        this._endAssociation(AssociationOutcome.Released);
        this.state = AssociationState.Ended;
        log.info(`${this.logId} <- Association release response`);
        this.emit('associationReleaseResponse');
        return;
      }
      default: {
        this._endAssociation(AssociationOutcome.AbortedByPeer);
        this.state = AssociationState.Ended;
        log.info(`${this.logId} <- Association abort ${pdu.toString()}`);
        this.emit('abort', {
          source: pdu.getSource(),
          reason: pdu.getReason(),
        });
      }
    }
  }

  /**
   * Reads a received PDU of a type the association expects.
   * @method
   * @private
   * @param {RawPdu} raw - Received PDU.
   * @returns {AAssociateAC|AAssociateRJ|PDataTF|AReleaseRQ|AReleaseRP|AAbort} Read PDU.
   * @throws {Error} If the PDU is not valid.
   */
  _readPdu(raw) {
    raw.readPdu();
    const pdu = this._pduOfType(raw.getType());
    pdu.read(raw);
    return pdu;
  }

  /**
   * Creates the PDU that reads a received PDU of a type the association expects.
   * @method
   * @private
   * @param {number} type - PDU type.
   * @returns {AAssociateAC|AAssociateRJ|PDataTF|AReleaseRQ|AReleaseRP|AAbort} PDU.
   */
  _pduOfType(type) {
    switch (type) {
      case RawPduType.AAssociateAC:
        return new AAssociateAC(this.association);
      case RawPduType.AAssociateRJ:
        return new AAssociateRJ();
      case RawPduType.PDataTF:
        return new PDataTF();
      case RawPduType.AReleaseRQ:
        return new AReleaseRQ();
      case RawPduType.AReleaseRP:
        return new AReleaseRP();
      default:
        return new AAbort();
    }
  }

  /**
   * Process P-DATA-TF.
   * The client is the association requestor and proposes no role selection, so it is the SCU and the peer
   * the SCP (PS3.7 D.3.3.4): the responses to its requests are the only DIMSE messages it takes,
   * and any other message from the peer aborts the association.
   * A PDV on a presentation context that was not accepted aborts the association as a PDU parameter that is
   * not valid (PS3.8 7.6.1). A message is assembled from its fragments by PS3.8 E.1: all of them on one
   * presentation context, the command before the dataset, and a dataset only after a command that announces
   * one; a message that breaks these rules or exceeds the maximum length aborts the association.
   * @method
   * @private
   * @param {PDataTF} pdu - PDU.
   */
  _processPDataTf(pdu) {
    this._takePdvs(pdu.getPdvs(), 0);
  }

  /**
   * Takes the PDVs of a received P-DATA-TF from the given one on. Reading paused by a response listener stops
   * after the PDV that completed its message; the rest of the PDVs is taken once reading resumes.
   * @method
   * @private
   * @param {Array<Pdv>} pdvs - PDVs of the P-DATA-TF.
   * @param {number} first - Index of the first PDV to take.
   */
  _takePdvs(pdvs, first) {
    try {
      for (let i = first; i < pdvs.length; i++) {
        if (!this._takePdv(pdvs[i])) {
          return;
        }
        if (this.receivingPaused && i + 1 < pdvs.length) {
          this.pausedPdvs = { pdvs, next: i + 1 };
          return;
        }
      }
    } catch (err) {
      this._abortOnError(`Error reading DIMSE: ${err.message}`, err);
    }
  }

  /**
   * Takes a received PDV into the message that is being received and hands over the message once it is whole.
   * @method
   * @private
   * @param {Pdv} pdv - PDV.
   * @returns {boolean} Whether the association goes on.
   */
  _takePdv(pdv) {
    const pcId = pdv.getPresentationContextId();
    const presentationContext = this._acceptedPresentationContext(pcId);
    if (!presentationContext) {
      this._rejectPdu(
        `PDV on presentation context ${pcId}, which was not accepted`,
        AbortReason.InvalidPduParameter
      );
      return false;
    }
    if (this.incoming === undefined) {
      this.incoming = { pcId, commandFragments: [], datasetFragments: [], length: 0, response: undefined };
    }
    const incoming = this.incoming;
    if (incoming.pcId !== pcId) {
      this._abortOnInvalidMessage(
        `Fragment on presentation context ${pcId} while a message on presentation context ${incoming.pcId} is received`
      );
      return false;
    }
    if (pdv.isCommand() && incoming.response !== undefined) {
      this._abortOnInvalidMessage('Command fragment while the dataset of the message is expected');
      return false;
    }
    if (!pdv.isCommand() && incoming.response === undefined) {
      this._abortOnInvalidMessage('Dataset fragment without a command that announces a dataset');
      return false;
    }
    incoming.length += pdv.getValue().length;
    if (incoming.length > this.maxReceivedMessageLength) {
      this._abortOnInvalidMessage(
        `Received message exceeds the maximum length ${this.maxReceivedMessageLength}`
      );
      return false;
    }
    (pdv.isCommand() ? incoming.commandFragments : incoming.datasetFragments).push(pdv.getValue());
    if (!pdv.isLastFragment()) {
      return true;
    }

    if (pdv.isCommand()) {
      const commandBuffer = Buffer.concat(incoming.commandFragments);
      const structureProblem = commandSetProblem(commandBuffer);
      if (structureProblem !== undefined) {
        this._abortOnInvalidMessage(`Invalid command set from the peer: ${structureProblem}`);
        return false;
      }
      const command = this._readReceived(() => new Command(new Dataset(commandBuffer)), 'command set');
      if (command === undefined) {
        return false;
      }
      const response = this._responseFromCommand(command);
      if (response === undefined) {
        this._abortOnInvalidMessage(`Unexpected DIMSE message from the peer: ${command.toString()}`);
        return false;
      }
      log.info(`${this.logId} <- ${response.toString()} [pc: ${pcId}]`);
      const request = this._requestOfResponse(response, pcId);
      if (request === undefined) {
        return false;
      }
      if (response.hasDataset()) {
        incoming.response = response;
        incoming.request = request;
        return true;
      }
      this.incoming = undefined;
      this._performDimse(response, request);
      return this._isReceiving();
    }

    const datasetBuffer = Buffer.concat(incoming.datasetFragments);
    const transferSyntaxUid = presentationContext.getAcceptedTransferSyntaxUid();
    const structureProblem = datasetStructureProblem(datasetBuffer, transferSyntaxUid);
    if (structureProblem !== undefined) {
      this._abortOnInvalidMessage(`Invalid data set from the peer: ${structureProblem}`);
      return false;
    }
    const dataset = this._readReceived(
      () => new Dataset(datasetBuffer, transferSyntaxUid, this.datasetReadOptions),
      'data set'
    );
    if (dataset === undefined) {
      return false;
    }
    this.incoming = undefined;
    incoming.response.setDataset(dataset);
    this._performDimse(incoming.response, incoming.request);
    return this._isReceiving();
  }

  /**
   * Reads a received command set or data set, and aborts the association when it cannot be read.
   * @method
   * @private
   * @param {function(): (Command|Dataset)} read - Reads it.
   * @param {string} what - What is read.
   * @returns {Command|Dataset|undefined} What was read, if it could be read.
   */
  _readReceived(read, what) {
    try {
      return read();
    } catch (err) {
      this._abortOnInvalidMessage(`Invalid ${what} from the peer: ${err.message}`);
      return undefined;
    }
  }

  /**
   * Finds the request a received response answers, and aborts the association when it answers none that is
   * outstanding or does not match it: a response is taken only for an outstanding request of the client that
   * was sent completely, of the request's operation, on its presentation context, with the SOP class and
   * SOP instance of the request where it names them (PS3.7 9.1.1.1, 9.1.2.1), a pending status only for
   * C-FIND, and a data set only where the operation allows it.
   * @method
   * @private
   * @param {Response} response - Received response.
   * @param {number} pcId - Presentation context ID of the response.
   * @returns {Request|undefined} The request, if the response answers it.
   */
  _requestOfResponse(response, pcId) {
    const problem = this._responseProblem(response, pcId);
    if (typeof problem === 'string') {
      this._abortOnInvalidMessage(`Response that is not the client's: ${problem}`);
      return undefined;
    }
    return problem.request;
  }

  /**
   * Checks a received response against the outstanding request it names.
   * @method
   * @private
   * @param {Response} response - Received response.
   * @param {number} pcId - Presentation context ID of the response.
   * @returns {string|{request: Request}} What is wrong with the response, or the request it answers.
   */
  _responseProblem(response, pcId) {
    const description = response.toString();
    const messageId = response.getMessageIdBeingRespondedTo();
    const request = this.pending.find((r) => r.getMessageId() === messageId);
    if (messageId === undefined || request === undefined) {
      return `${description} answers no outstanding request`;
    }
    if (response.getCommandFieldType() !== (request.getCommandFieldType() | ResponseCommandFieldBit)) {
      return `${description} answers ${request.toString()}`;
    }
    if (pcId !== this.requestContextIds.get(request)) {
      return `${description} came on presentation context ${pcId}, not on the one of ${request.toString()}`;
    }
    const sopClassUid = response.getAffectedSopClassUid();
    if (sopClassUid !== undefined && sopClassUid !== request.getAffectedSopClassUid()) {
      return `${description} names another affected SOP class than ${request.toString()}`;
    }
    if (request instanceof CStoreRequest) {
      const sopInstanceUid = response.getAffectedSopInstanceUid();
      if (sopInstanceUid !== undefined && sopInstanceUid !== request.getAffectedSopInstanceUid()) {
        return `${description} names another affected SOP instance than ${request.toString()}`;
      }
    }
    if (!this.fullySent.has(request)) {
      return `${description} came before ${request.toString()} was sent completely`;
    }
    const status = response.getStatus();
    if (status === undefined) {
      return `${description} has no status`;
    }
    const isFind = request instanceof CFindRequest;
    if (PendingStatuses.includes(status) && !isFind) {
      return `${description} has a pending status, which only C-FIND has`;
    }
    if (response.hasDataset() && (!isFind || !PendingStatuses.includes(status))) {
      return `${description} carries a data set, which only a pending C-FIND response does`;
    }
    // PS3.4 C.4.1.1.3.2: a pending C-FIND response carries the identifier of its match
    if (isFind && PendingStatuses.includes(status) && !response.hasDataset()) {
      return `${description} has a pending status without an identifier`;
    }
    return { request };
  }

  /**
   * Checks whether the association still takes what the peer sends; a response listener may have ended it.
   * @method
   * @private
   * @returns {boolean} Whether the association still takes PDVs.
   */
  _isReceiving() {
    return this.state !== AssociationState.Ended && !this._isSocketClosing();
  }

  /**
   * Gets a presentation context that the peer accepted.
   * @method
   * @private
   * @param {number} pcId - Presentation context ID.
   * @returns {PresentationContext|undefined} Presentation context, if accepted.
   */
  _acceptedPresentationContext(pcId) {
    const proposed = this.association.findPresentationContext(pcId);
    if (proposed === undefined || proposed.getResult() !== PresentationContextResult.Accept) {
      return undefined;
    }
    return proposed;
  }

  /**
   * Gets the response a received command is, if it is a response to a request the client sends.
   * @method
   * @private
   * @param {Command} command - Received command.
   * @returns {Response|undefined} Response, if the command is one.
   */
  _responseFromCommand(command) {
    switch (command.getCommandFieldType()) {
      case CommandFieldType.CEchoResponse:
        return Object.assign(new CEchoResponse(), command);
      case CommandFieldType.CFindResponse:
        return Object.assign(new CFindResponse(), command);
      case CommandFieldType.CStoreResponse:
        return Object.assign(new CStoreResponse(), command);
      default:
        return undefined;
    }
  }

  /**
   * Aborts the association over a received DIMSE message that is not valid.
   * The abort is the service user's, whose reason is not significant and is sent as 0 (PS3.8 9.3.8).
   * @method
   * @private
   * @param {string} reason - Why the message is not valid.
   */
  _abortOnInvalidMessage(reason) {
    const error = `${this.logId} -> ${reason}`;
    log.error(error);
    this.sendAbort(AbortSource.ServiceUser, AbortReason.NotSpecified);
    this._reset();
    this.emit('networkError', new Error(error));
  }

  /**
   * Hands a received response to its request; a final response ends the request, so that no later response
   * can answer it.
   * @method
   * @private
   * @param {Response} response - Response.
   * @param {Request} request - The request it answers.
   */
  _performDimse(response, request) {
    const isPending = PendingStatuses.includes(response.getStatus());
    if (!isPending) {
      this.pending = this.pending.filter((pendingRequest) => pendingRequest !== request);
    }
    this._responseReceived(request, isPending);
    request.raiseResponseEvent(response);
    if (!isPending) {
      request.raiseDoneEvent();
    }
  }

  /**
   * Wraps socket operations.
   * @method
   * @private
   */
  _wrapSocket() {
    this.socket.on('connect', () => {
      this.hasConnected = true;
      this._startTimeout(TimeoutKind.Idle);
      this.emit('connect');
    });
    const pduAccumulator = new PduAccumulator((pduType) => this._getMaxReceivedPduLength(pduType));
    this.pduAccumulator = pduAccumulator;
    pduAccumulator.on('pdu', (data) => {
      this._processPdu(data);
    });
    pduAccumulator.on('error', (err) => {
      if (this.state === AssociationState.Ended) {
        return;
      }
      this._rejectPdu(err.message, err.abortReason);
    });
    this.socket.on('data', (data) => {
      this.statistics.addBytesReceived(data.length);
      // While there is data to send, only sending is progress; a peer that stops reading
      // must not keep a stalled send alive by trickling bytes back
      if (!this._isSending()) {
        this._markProgress();
      }
      pduAccumulator.accumulate(data);
    });
    this.socket.on('error', (err) => {
      this._endAssociation(this.hasConnected ? AssociationOutcome.SocketError : AssociationOutcome.NotConnected);
      this._reset();
      const error = `${this.logId} -> Connection error: ${err.message}`;
      log.error(error);
      this.emit('networkError', new Error(error));
    });
    this.socket.on('close', () => {
      this._endAssociation(
        this.hasConnected ? AssociationOutcome.ClosedUnexpectedly : AssociationOutcome.NotConnected
      );
      this.state = AssociationState.Ended;
      this._reset();
      log.info(`${this.logId} -> Connection closed`);
      this.emit('close', this.outcome);
    });

    this._startTimeout(this.socket.connecting ? TimeoutKind.Connect : TimeoutKind.Idle);
  }

  /**
   * Gets the maximum length of a received PDU.
   * A P-DATA-TF PDU is limited by the maximum PDU length announced to the peer; the other PDUs,
   * which that announcement does not cover, are limited by it too, but never below the default.
   * @method
   * @private
   * @param {number} pduType - PDU type.
   * @returns {number} Maximum length of the received PDU.
   */
  _getMaxReceivedPduLength(pduType) {
    const announced = this.association
      ? this.association.getMaxPduLength()
      : DefaultImplementation.MaxPduLength;
    if (pduType === RawPduType.PDataTF) {
      return announced;
    }
    return Math.max(announced, DefaultImplementation.MaxPduLength);
  }

  /**
   * Gets the maximum length of a sent P-DATA-TF PDU: the one the peer announced,
   * but never more than the one announced to the peer.
   * @method
   * @private
   * @returns {number} Maximum length of the sent PDU.
   */
  _getMaxSentPduLength() {
    const announced = this.association.getMaxPduLength();
    const peer = this.association.getPeerMaxPduLength();
    if (peer === undefined || peer === 0) {
      return announced;
    }
    return Math.min(peer, announced);
  }

  /**
   * Aborts the association and reports a network error over a PDU or PDV that is not accepted: action AA-8
   * of PS3.8 9.2.3, an A-ABORT from the service provider. A PDU refused by its header is refused before any
   * memory is allocated for it.
   * @method
   * @private
   * @param {string} reason - Why the PDU is not accepted.
   * @param {AbortReason} abortReason - A-ABORT reason.
   */
  _rejectPdu(reason, abortReason) {
    const error = `${this.logId} -> Rejected PDU: ${reason}`;
    log.error(error);
    if (this.association) {
      this.sendAbort(AbortSource.ServiceProvider, abortReason);
    }
    this.state = AssociationState.Ended;
    this._reset();
    this.emit('networkError', new Error(error));
  }

  /**
   * Starts a timeout instead of the one that runs.
   * @method
   * @private
   * @param {TimeoutKind} kind - Timeout kind.
   */
  _startTimeout(kind) {
    this._clearTimeout();
    if (this._isSocketClosing()) {
      return;
    }
    if (this.receivingPaused && PausedTimeoutKinds.includes(kind)) {
      this.timeoutKindWhilePaused = kind;
      return;
    }
    this.timeoutKind = kind;
    this.timeoutId = setTimeout(() => this._timedOut(kind), this.timeouts[kind]);
  }

  /**
   * Clears the timeout that runs.
   * @method
   * @private
   */
  _clearTimeout() {
    if (this.timeoutId !== undefined) {
      clearTimeout(this.timeoutId);
    }
    this.timeoutId = undefined;
    this.timeoutKind = undefined;
  }

  /**
   * Restarts the idle timeout on network progress: bytes received or handed to the operating system.
   * @method
   * @private
   */
  _markProgress() {
    if (this.timeoutKind === TimeoutKind.Idle) {
      this.timeoutId.refresh();
    }
  }

  /**
   * Checks whether there is data that the socket has not handed to the operating system yet.
   * @method
   * @private
   * @returns {boolean} Whether data is being sent.
   */
  _isSending() {
    return this.outgoing.length > 0 || this.waitingForDrain || this.socket.writableLength > 0;
  }

  /**
   * Starts the DIMSE timeout once the last fragment of a request is handed to the operating system.
   * @method
   * @private
   * @param {Request} request - The request.
   */
  _requestSent(request) {
    this.fullySent.add(request);
    if (!this.pending.includes(request)) {
      return;
    }
    this.awaitingResponse.add(request);
    this._startTimeout(TimeoutKind.Dimse);
  }

  /**
   * Restarts the DIMSE timeout on a pending response; stops it once no request awaits a response.
   * @method
   * @private
   * @param {Request} request - The request.
   * @param {boolean} isPending - Whether the response is a pending one.
   */
  _responseReceived(request, isPending) {
    if (!isPending) {
      this.awaitingResponse.delete(request);
    }
    if (this.awaitingResponse.size > 0) {
      this._startTimeout(TimeoutKind.Dimse);
      return;
    }
    const runningKind = this.receivingPaused ? this.timeoutKindWhilePaused : this.timeoutKind;
    if (runningKind === TimeoutKind.Dimse) {
      this._startTimeout(TimeoutKind.Idle);
    }
  }

  /**
   * Ends the connection on an expired timeout: the connection attempt is dropped,
   * an association is aborted.
   * @method
   * @private
   * @param {TimeoutKind} kind - Timeout kind.
   */
  _timedOut(kind) {
    this.timeoutId = undefined;
    this.timeoutKind = undefined;
    const error = new Error(
      `Connection timeout: ${this.logId} -> Exceeded the ${kind} timeout (${this.timeouts[kind]} ms), closing connection...`
    );
    error.timeout = kind;
    log.error(error.message);
    this._endAssociation(
      kind === TimeoutKind.Connect ? AssociationOutcome.ConnectTimeout : AssociationOutcome.AbortedLocally,
      kind
    );
    if (kind === TimeoutKind.Connect) {
      this._reset();
      this.emit('networkError', error);
      if (!this.socket.destroyed) {
        this.socket.destroy();
      }
      return;
    }
    if (this.association) {
      this.sendAbort();
    }
    this._reset();
    this.emit('networkError', error);
  }

  /**
   * Records how the association ended, unless an earlier cause already ended it.
   * @method
   * @private
   * @param {AssociationOutcome} outcome - How the association ended.
   * @param {TimeoutKind} [timeout] - The timeout that ended it.
   */
  _endAssociation(outcome, timeout) {
    if (this.outcome !== undefined) {
      return;
    }
    this.outcome = timeout === undefined ? { outcome } : { outcome, timeout };
  }

  /**
   * Checks whether the socket can no longer be written to,
   * i.e. it is destroyed or its writable side has been ended.
   * @method
   * @private
   * @returns {boolean} Whether the socket is closing or closed.
   */
  _isSocketClosing() {
    return this.socket.destroyed || this.socket.writableEnded;
  }

  /**
   * Resets connection stats.
   * @method
   * @private
   */
  _reset() {
    this.incoming = undefined;
    this.pausedPdvs = undefined;
    this.outgoing.length = 0;
    this.waitingForDrain = false;
    this._clearTimeout();
  }
  //#endregion
}
//#endregion

//#region PduAccumulator
class PduAccumulator extends AsyncEventEmitter2 {
  /**
   * Creates an instance of PduAccumulator.
   * @constructor
   * @param {function(number): number} getMaxPduLength - Gets the maximum length of a received PDU by its type.
   */
  constructor(getMaxPduLength) {
    super();
    this.getMaxPduLength = getMaxPduLength;
    this.header = Buffer.alloc(0);
    this.pdu = undefined;
    this.received = 0;
    this.failed = false;
    this.paused = false;
    this.backlog = [];
  }

  /**
   * Accumulates the received data from the network into whole PDUs.
   * A PDU is checked by its header, type and length, before the memory for it is allocated;
   * after a PDU is refused, nothing more is read from the connection. While paused, the data
   * is kept unread.
   * @method
   * @param {Buffer} data - The received data.
   */
  accumulate(data) {
    if (this.paused) {
      this.backlog.push(data);
      return;
    }
    this._consume(data);
  }

  /**
   * Stops reading after the PDU that is being emitted.
   * @method
   */
  pause() {
    this.paused = true;
  }

  /**
   * Reads the data kept while paused, until paused again.
   * @method
   */
  resume() {
    this.paused = false;
    while (!this.paused && !this.failed && this.backlog.length > 0) {
      this._consume(this.backlog.shift());
    }
  }

  //#region Private Methods
  /**
   * Reads the data into PDUs; the part left when paused is kept first in the backlog.
   * @method
   * @private
   * @param {Buffer} data - The received data.
   */
  _consume(data) {
    let offset = 0;
    while (offset < data.length && !this.failed) {
      if (this.paused) {
        this.backlog.unshift(data.subarray(offset));
        return;
      }
      offset = this.pdu === undefined ? this._readHeader(data, offset) : this._readValue(data, offset);
    }
  }

  /**
   * Reads the header of the next PDU and allocates the PDU, if it is accepted.
   * @method
   * @private
   * @param {Buffer} data - The received data.
   * @param {number} offset - Offset of the first unread byte.
   * @returns {number} Offset of the first unread byte.
   */
  _readHeader(data, offset) {
    const taken = data.subarray(offset, offset + PduLength.Header - this.header.length);
    this.header = Buffer.concat([this.header, taken]);
    if (this.header.length < PduLength.Header) {
      return offset + taken.length;
    }

    const pduType = this.header.readUInt8(0);
    const pduLength = this.header.readUInt32BE(2);
    if (!KnownPduTypes.includes(pduType)) {
      this._fail(`Unknown PDU type: ${pduType}`, AbortReason.UnrecognizedPdu);
      return data.length;
    }
    const maxPduLength = this.getMaxPduLength(pduType);
    if (pduLength > maxPduLength) {
      this._fail(
        `PDU length ${pduLength} [type: ${pduType}] exceeds the maximum ${maxPduLength}`,
        AbortReason.InvalidPduParameter
      );
      return data.length;
    }

    try {
      this.pdu = Buffer.allocUnsafe(PduLength.Header + pduLength);
    } catch (err) {
      this._fail(
        `PDU of length ${pduLength} [type: ${pduType}] cannot be allocated: ${err.message}`,
        AbortReason.NotSpecified
      );
      return data.length;
    }
    this.header.copy(this.pdu);
    this.received = PduLength.Header;
    this.header = Buffer.alloc(0);
    if (pduLength === 0) {
      this._emitPdu();
    }
    return offset + taken.length;
  }

  /**
   * Reads the value of the PDU that is being received.
   * @method
   * @private
   * @param {Buffer} data - The received data.
   * @param {number} offset - Offset of the first unread byte.
   * @returns {number} Offset of the first unread byte.
   */
  _readValue(data, offset) {
    const taken = data.subarray(offset, offset + this.pdu.length - this.received);
    taken.copy(this.pdu, this.received);
    this.received += taken.length;
    if (this.received === this.pdu.length) {
      this._emitPdu();
    }
    return offset + taken.length;
  }

  /**
   * Emits the PDU that has been received whole.
   * @method
   * @private
   */
  _emitPdu() {
    const pdu = this.pdu;
    this.pdu = undefined;
    this.received = 0;
    this.emit('pdu', pdu);
  }

  /**
   * Refuses the PDU that is being received and stops reading.
   * @method
   * @private
   * @param {string} message - Why the PDU is refused.
   * @param {AbortReason} abortReason - A-ABORT reason.
   */
  _fail(message, abortReason) {
    this.failed = true;
    this.header = Buffer.alloc(0);
    this.pdu = undefined;
    const error = new Error(message);
    error.abortReason = abortReason;
    this.emit('error', error);
  }
  //#endregion
}
//#endregion

//#region Exports
module.exports = Network;
//#endregion
