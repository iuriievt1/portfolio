const { CEchoResponse, CFindResponse, Command, CStoreResponse } = require('./../src/Command');
const { CommandFieldType, PresentationContextResult } = require('./../src/Constants');
const Dataset = require('./../src/Dataset');
const {
  decodeAbort,
  decodeAssociateRequest,
  decodePDataTf,
  encodeAssociateAccept,
  encodeAssociateReject,
  encodePDataTf,
  encodeReleaseResponse,
  PduHeaderLength,
  PduType,
} = require('./acceptor-codec');

const net = require('net');

// The fork has no server part, so the tests answer the client with this peer: an association acceptor
// on the PDU codec of the tests, with the DIMSE command sets encoded by the fork's data layer.

const DefaultMaxPduLength = 16384;
const ImplementationClassUid = '2.25.329800735698586629295641978511506172918';

const ResponseTypes = {
  [CommandFieldType.CEchoRequest]: CEchoResponse,
  [CommandFieldType.CFindRequest]: CFindResponse,
  [CommandFieldType.CStoreRequest]: CStoreResponse,
};

/**
 * Creates the response to a received request.
 * @param {Object} message - Received message.
 * @param {number} status - Response status.
 * @param {Dataset} [dataset] - Response dataset.
 * @returns {Response} Response.
 */
function responseTo(message, status, dataset) {
  const ResponseType = ResponseTypes[message.command.getCommandFieldType()];
  const command = message.command.getCommandDataset();
  const response = new ResponseType(status);
  response.setAffectedSopClassUid(command.getElement('AffectedSOPClassUID'));
  if (command.getElement('AffectedSOPInstanceUID') !== undefined) {
    response.setAffectedSopInstanceUid(command.getElement('AffectedSOPInstanceUID'));
  }
  response.setMessageIdBeingRespondedTo(command.getElement('MessageID'));
  if (dataset) {
    response.setDataset(dataset);
  }
  return response;
}

/**
 * Encodes a DIMSE message as one P-DATA-TF PDU, its dataset in the transfer syntax of the context.
 * @param {number} contextId - Presentation context ID.
 * @param {string} transferSyntaxUid - Accepted transfer syntax UID of the context.
 * @param {Command} command - Response or request.
 * @returns {Buffer} PDU bytes.
 */
function messagePdvs(contextId, transferSyntaxUid, command) {
  const pdvs = [
    {
      contextId,
      isCommand: true,
      isLast: true,
      value: command.getCommandDataset().getDenaturalizedCommandDataset(),
    },
  ];
  const dataset = command.getDataset();
  if (dataset) {
    dataset.setTransferSyntaxUid(transferSyntaxUid);
    pdvs.push({ contextId, isCommand: false, isLast: true, value: dataset.getDenaturalizedDataset() });
  }
  return pdvs;
}

function messagePdu(contextId, transferSyntaxUid, command) {
  return encodePDataTf(messagePdvs(contextId, transferSyntaxUid, command));
}

/**
 * Starts the test peer.
 * @param {number} port - Port to listen on.
 * @param {Object} [opts] - Peer options.
 * @param {function(Object)} [opts.requested] - Sees the decoded association request before it is answered.
 * @param {function(Object, Object): (Object|Buffer|undefined)} [opts.accept] - Answers the association request.
 * It gets the request and the answer, in which every proposed context is accepted with its first transfer
 * syntax, and returns nothing to send the answer as it is then, `{ reject: [result, source, reason] }`
 * to reject, or bytes to send instead.
 * @param {number} [opts.maxPduLength] - Maximum PDU length announced in the A-ASSOCIATE-AC.
 * @param {function(Socket)} [opts.afterAccept] - Called once the association is answered.
 * @param {function(Socket, Buffer)} [opts.onData] - Takes the bytes after the answer instead of the peer.
 * @param {function(Object): Array<Command>} [opts.respond] - Answers a received DIMSE message; the message
 * carries its socket, command, context, transfer syntax and dataset bytes.
 * @param {boolean|function(Socket)} [opts.release] - Whether an A-RELEASE-RQ is answered, as it is by default,
 * or what answers it instead.
 * @param {function(Socket)} [opts.releaseResponded] - Called on an A-RELEASE-RP from the client.
 * @returns {Object} Peer.
 */
function startPeer(port, opts) {
  const options = opts || {};
  const sockets = [];
  const peer = {
    request: undefined,
    proposed: [],
    messages: [],
    aborts: [],
    releaseRequested: false,
    releaseResponses: 0,
    ended: false,
    onEnded: undefined,
    // Everything the client sent has been read once the client ended its side
    afterClientEnded(callback) {
      if (peer.ended) {
        callback();
        return;
      }
      peer.onEnded = callback;
    },
    close() {
      sockets.forEach((socket) => socket.destroy());
      server.close();
    },
  };

  const server = net.createServer({ allowHalfOpen: true }, (socket) => {
    sockets.push(socket);
    socket.on('error', () => {});
    const clientEnded = () => {
      if (peer.ended) {
        return;
      }
      peer.ended = true;
      if (peer.onEnded) {
        peer.onEnded();
      }
    };
    socket.on('end', () => {
      socket.end();
      clientEnded();
    });
    // A reset ends the connection without an end; the test then fails on what it reads, not on a timeout
    socket.on('close', clientEnded);

    let pending = Buffer.alloc(0);
    let acceptedSyntaxes = undefined;
    let message = undefined;

    const answer = (requestBytes) => {
      const request = decodeAssociateRequest(requestBytes);
      peer.request = request;
      request.presentationContexts.forEach((context) => {
        peer.proposed.push({
          id: context.id,
          abstractSyntaxUid: context.abstractSyntax,
          transferSyntaxUids: [...context.transferSyntaxes],
        });
      });
      if (options.requested) {
        options.requested(request);
      }
      const response = {
        calledAeTitle: request.calledAeTitle,
        callingAeTitle: request.callingAeTitle,
        presentationContexts: request.presentationContexts.map((context) => ({
          id: context.id,
          result: PresentationContextResult.Accept,
          transferSyntax: context.transferSyntaxes[0],
        })),
        maxPduLength: options.maxPduLength !== undefined ? options.maxPduLength : DefaultMaxPduLength,
        implementationClassUid: ImplementationClassUid,
      };
      const decision = options.accept ? options.accept(request, response) : undefined;
      if (Buffer.isBuffer(decision)) {
        socket.write(decision);
      } else if (decision && decision.reject) {
        socket.write(encodeAssociateReject(...decision.reject));
      } else {
        socket.write(encodeAssociateAccept(response));
      }
      acceptedSyntaxes = new Map(
        response.presentationContexts
          .filter((context) => context.result === PresentationContextResult.Accept)
          .map((context) => [context.id, context.transferSyntax])
      );
      if (options.afterAccept) {
        options.afterAccept(socket);
      }
    };

    const receiveMessage = (pdv) => {
      message = message || {
        socket,
        contextId: pdv.contextId,
        transferSyntaxUid: acceptedSyntaxes.get(pdv.contextId),
        commandChunks: [],
        datasetChunks: [],
      };
      (pdv.isCommand ? message.commandChunks : message.datasetChunks).push(pdv.value);
      if (!pdv.isLast) {
        return;
      }
      if (pdv.isCommand) {
        message.commandBytes = Buffer.concat(message.commandChunks);
        message.command = new Command(new Dataset(message.commandBytes));
        if (message.command.hasDataset()) {
          return;
        }
      } else {
        message.datasetBytes = Buffer.concat(message.datasetChunks);
        message.dataset = new Dataset(message.datasetBytes, message.transferSyntaxUid);
      }
      const received = message;
      message = undefined;
      peer.messages.push(received);
      const responses = options.respond ? options.respond(received) : [];
      responses.forEach((response) => {
        socket.write(messagePdu(received.contextId, received.transferSyntaxUid, response));
      });
    };

    const receivePdu = (bytes) => {
      const type = bytes[0];
      if (type === PduType.PDataTf) {
        decodePDataTf(bytes).forEach((pdv) => receiveMessage(pdv));
        return;
      }
      if (type === PduType.ReleaseRq) {
        peer.releaseRequested = true;
        if (typeof options.release === 'function') {
          options.release(socket);
          return;
        }
        if (options.release !== false) {
          socket.write(encodeReleaseResponse());
          socket.end();
        }
        return;
      }
      if (type === PduType.ReleaseRp) {
        peer.releaseResponses += 1;
        if (options.releaseResponded) {
          options.releaseResponded(socket);
        }
        return;
      }
      if (type === PduType.Abort) {
        peer.aborts.push(decodeAbort(bytes));
        socket.end();
      }
    };

    socket.on('data', (data) => {
      if (acceptedSyntaxes !== undefined && options.onData) {
        options.onData(socket, data);
        return;
      }
      pending = Buffer.concat([pending, data]);
      while (
        pending.length >= PduHeaderLength &&
        pending.length >= PduHeaderLength + pending.readUInt32BE(2)
      ) {
        const length = PduHeaderLength + pending.readUInt32BE(2);
        const bytes = pending.subarray(0, length);
        pending = pending.subarray(length);
        if (acceptedSyntaxes === undefined) {
          answer(bytes);
          if (options.onData && pending.length > 0) {
            options.onData(socket, pending);
            pending = Buffer.alloc(0);
          }
          continue;
        }
        receivePdu(bytes);
      }
    });
  });
  server.listen(port);
  return peer;
}

module.exports = { messagePdu, messagePdvs, responseTo, startPeer };
