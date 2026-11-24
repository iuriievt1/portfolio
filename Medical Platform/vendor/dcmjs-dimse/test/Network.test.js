const { Association, PresentationContext } = require('./../src/Association');
const { AAssociateRQ } = require('./../src/Pdu');
const {
  CEchoRequest,
  CEchoResponse,
  CFindRequest,
  CFindResponse,
  Command,
  CStoreRequest,
  CStoreResponse,
  Response,
} = require('./../src/Command');
const {
  AbortReason,
  AbortSource,
  AssociationOutcome,
  CommandFieldType,
  NotSentReason,
  PresentationContextResult,
  RejectReason,
  RejectResult,
  RejectSource,
  SopClass,
  Status,
  StorageClass,
  TimeoutKind,
  TransferSyntax,
  UserIdentityType,
} = require('./../src/Constants');
const Client = require('./../src/Client');
const Dataset = require('./../src/Dataset');
const Network = require('./../src/Network');
const log = require('./../src/log');

const events = require('events');
const net = require('net');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {
  clientOptions,
  part10File,
  storedDataset,
  TestImplementationClassUid,
  withDone,
} = require('./support');
const {
  encodeAssociateAccept,
  encodeAssociateReject,
  encodePDataTf,
  encodeReleaseResponse,
  pdu: encodePdu,
} = require('./acceptor-codec');
const { messagePdu, messagePdvs, responseTo, startPeer } = require('./peer');

const PduType = { AssociateAc: 0x02, PDataTf: 0x04, ReleaseRq: 0x05, Abort: 0x07, Undefined: 0x0a };

const datasets = [
  new Dataset({
    PatientID: 'SYNTHETIC-1001',
    PatientName: 'SYNTHETIC^ONE',
    StudyInstanceUID: Dataset.generateDerivedUid(),
  }),
  new Dataset({
    PatientID: 'SYNTHETIC-1002',
    PatientName: 'SYNTHETIC^TWO',
    StudyInstanceUID: Dataset.generateDerivedUid(),
  }),
];

// Answers C-ECHO and C-STORE with success and C-FIND with the matching dataset, as a PACS would
function answerRequests(message) {
  switch (message.command.getCommandFieldType()) {
    case CommandFieldType.CEchoRequest:
    case CommandFieldType.CStoreRequest:
      return [responseTo(message, Status.Success)];
    case CommandFieldType.CFindRequest: {
      const found = datasets.find(
        (dataset) => dataset.getElement('PatientID') === message.dataset.getElement('PatientID')
      );
      const matches = found ? [responseTo(message, Status.Pending, found)] : [];
      return [...matches, responseTo(message, Status.Success)];
    }
    default:
      return [];
  }
}

function pdusOf(bytes) {
  const pdus = [];
  let offset = 0;
  while (offset + 6 <= bytes.length && offset + 6 + bytes.readUInt32BE(offset + 2) <= bytes.length) {
    const length = bytes.readUInt32BE(offset + 2);
    pdus.push({ type: bytes[offset], value: bytes.subarray(offset + 6, offset + 6 + length) });
    offset += 6 + length;
  }
  return pdus;
}

function pdvsOf(pdu) {
  const pdvs = [];
  let offset = 0;
  while (offset + 4 <= pdu.value.length) {
    const itemLength = pdu.value.readUInt32BE(offset);
    const header = pdu.value[offset + 5];
    pdvs.push({ valueLength: itemLength - 2, isCommand: (header & 1) === 1, isLast: (header & 2) === 2 });
    offset += 4 + itemLength;
  }
  return pdvs;
}

function abortOf(bytes) {
  const abort = pdusOf(bytes).find((pdu) => pdu.type === PduType.Abort);
  return abort === undefined ? undefined : { source: abort.value[2], reason: abort.value[3] };
}

function runClient(port, requestOrRequests, opts, onClosed) {
  const outcome = { networkError: undefined, networkErrors: 0, statuses: [], aborts: 0, accepted: 0, rejected: 0 };
  const client = new Client();
  const requests = Array.isArray(requestOrRequests) ? requestOrRequests : [requestOrRequests];
  requests.forEach((request) => {
    request.on('response', (response) => outcome.statuses.push(response.getStatus()));
    client.addRequest(request);
  });
  client.on('networkError', (e) => {
    outcome.networkError = e;
    outcome.networkErrors += 1;
  });
  client.on('abort', () => {
    outcome.aborts += 1;
  });
  client.on('associationAccepted', () => {
    outcome.accepted += 1;
  });
  client.on('associationRejected', () => {
    outcome.rejected += 1;
  });
  client.on('closed', (end) => {
    outcome.end = end;
    onClosed(outcome);
  });
  client.send('127.0.0.1', port, 'CALLINGAET', 'CALLEDAET', clientOptions(opts));
}

describe('Network', () => {
  beforeAll(() => {
    log.setLevel('error');
  });

  it('should be able to reject an association', withDone((done) => {
    const reject = [RejectResult.Permanent, RejectSource.ServiceUser, RejectReason.NoReasonGiven];
    const peer = startPeer(2101, { accept: () => ({ reject }) });

    let rejected = undefined;

    const client = new Client();
    client.addRequest(new CEchoRequest());
    client.addAdditionalPresentationContext(
      new PresentationContext(
        0,
        SopClass.ModalityWorklistInformationModelFind,
        TransferSyntax.ImplicitVRLittleEndian
      )
    );
    client.addAdditionalPresentationContext(
      new PresentationContext(
        0,
        SopClass.ModalityWorklistInformationModelFind,
        TransferSyntax.ExplicitVRLittleEndian
      ),
      true
    );
    client.on('associationRejected', (r) => {
      rejected = r;
    });
    client.on('closed', () => {
      peer.close();
      expect(rejected).to.deep.equal({ result: reject[0], source: reject[1], reason: reject[2] });
      expect(peer.proposed.map((c) => [c.abstractSyntaxUid, c.transferSyntaxUids])).to.deep.equal([
        [SopClass.Verification, [TransferSyntax.ImplicitVRLittleEndian, TransferSyntax.ExplicitVRLittleEndian]],
        [SopClass.ModalityWorklistInformationModelFind, [TransferSyntax.ImplicitVRLittleEndian]],
        [SopClass.ModalityWorklistInformationModelFind, [TransferSyntax.ExplicitVRLittleEndian]],
      ]);
      done();
    });
    client.on('networkError', (e) => {
      throw e;
    });
    client.send('127.0.0.1', 2101, 'CALLINGAET', 'CALLEDAET', clientOptions());
  }));

  it('should be able to handle association with user identity', withDone((done) => {
    const peer = startPeer(2102, {
      accept: (request, answer) => {
        if (
          request.userIdentity &&
          request.userIdentity.positiveResponseRequested &&
          request.userIdentity.type === UserIdentityType.Username
        ) {
          answer.userIdentityServerResponse = request.userIdentity.primaryField;
        }
      },
      respond: answerRequests,
    });

    const username = 'USERNAME';
    let serverResponse = '';

    const client = new Client();
    client.addRequest(new CEchoRequest());
    client.on('associationAccepted', (association) => {
      if (association.getNegotiateUserIdentityServerResponse()) {
        serverResponse = association.getUserIdentityServerResponse();
      }
    });
    client.on('closed', () => {
      peer.close();
      expect(serverResponse).to.be.eq(username);
      done();
    });
    client.on('networkError', (e) => {
      throw e;
    });
    client.send('127.0.0.1', 2102, 'CALLINGAET', 'CALLEDAET', clientOptions({
      userIdentity: {
        type: UserIdentityType.Username,
        positiveResponseRequested: true,
        primaryField: username,
      },
    }));
  }));

  it('should correctly perform a C-ECHO operation', withDone((done) => {
    const peer = startPeer(2103, { respond: answerRequests });

    let status = Status.ProcessingFailure;

    const client = new Client();
    const request = new CEchoRequest();
    request.on('response', (response) => {
      status = response.getStatus();
    });
    client.addRequest(request);
    client.on('closed', () => {
      peer.close();
      expect(status).to.be.eq(Status.Success);
      expect(peer.releaseRequested).to.be.true;
      done();
    });
    client.on('networkError', (e) => {
      throw e;
    });
    client.send('127.0.0.1', 2103, 'CALLINGAET', 'CALLEDAET', clientOptions());
  }));

  it('should correctly perform a C-FIND operation (Study)', withDone((done) => {
    const peer = startPeer(2105, { respond: answerRequests });

    let ret = undefined;

    const client = new Client();
    const request = CFindRequest.createStudyFindRequest({ PatientID: 'SYNTHETIC-1001' });
    request.on('response', (response) => {
      if (response.getStatus() === Status.Pending) {
        ret = response.getDataset();
      }
    });
    client.addRequest(request);
    client.on('closed', () => {
      peer.close();
      expect(ret.getElement('PatientID')).to.be.eq(datasets[0].getElement('PatientID'));
      expect(String(ret.getElement('PatientName'))).to.be.eq(
        String(datasets[0].getElement('PatientName'))
      );
      done();
    });
    client.on('networkError', (e) => {
      throw e;
    });
    client.send('127.0.0.1', 2105, 'CALLINGAET', 'CALLEDAET', clientOptions());
  }));

  it('should correctly perform a C-FIND operation (Worklist)', withDone((done) => {
    const peer = startPeer(2106, { respond: answerRequests });

    let ret = undefined;

    const client = new Client();
    const request = CFindRequest.createWorklistFindRequest({ PatientID: 'SYNTHETIC-1002' });
    request.on('response', (response) => {
      if (response.getStatus() === Status.Pending) {
        ret = response.getDataset();
      }
    });
    client.addRequest(request);
    client.on('closed', () => {
      peer.close();
      expect(ret.getElement('PatientID')).to.be.eq(datasets[1].getElement('PatientID'));
      expect(String(ret.getElement('PatientName'))).to.be.eq(
        String(datasets[1].getElement('PatientName'))
      );
      done();
    });
    client.on('networkError', (e) => {
      throw e;
    });
    client.send('127.0.0.1', 2106, 'CALLINGAET', 'CALLEDAET', clientOptions());
  }));

  it('should perform a C-STORE and a C-FIND operation in one association', withDone((done) => {
    const peer = startPeer(2107, { respond: answerRequests });

    const dataset = storedDataset(
      {
        SOPClassUID: StorageClass.MrImageStorage,
        SOPInstanceUID: Dataset.generateDerivedUid(),
        PatientID: 'SYNTHETIC-1001',
      },
      TransferSyntax.ImplicitVRLittleEndian
    );
    const statuses = [];

    const client = new Client();
    const storeRequest = new CStoreRequest(dataset);
    storeRequest.on('response', (response) => statuses.push(['store', response.getStatus()]));
    client.addRequest(storeRequest);
    const findRequest = CFindRequest.createStudyFindRequest({ PatientID: 'SYNTHETIC-1001' });
    findRequest.on('response', (response) => statuses.push(['find', response.getStatus()]));
    client.addRequest(findRequest);
    client.on('closed', () => {
      peer.close();
      expect(statuses).to.deep.equal([
        ['store', Status.Success],
        ['find', Status.Pending],
        ['find', Status.Success],
      ]);
      expect(peer.messages.map((message) => message.command.getCommandFieldType())).to.deep.equal([
        CommandFieldType.CStoreRequest,
        CommandFieldType.CFindRequest,
      ]);
      expect(peer.messages[0].datasetBytes.equals(dataset.getStoredDataset())).to.be.true;
      done();
    });
    client.on('networkError', (e) => {
      throw e;
    });
    client.send('127.0.0.1', 2107, 'CALLINGAET', 'CALLEDAET', clientOptions());
  }));

  it('should correctly perform a C-CANCEL operation', withDone((done) => {
    let findMessage = undefined;
    const client = new Client();
    const request = CFindRequest.createStudyFindRequest({ PatientID: 'SYNTHETIC-1001' });
    const peer = startPeer(2113, {
      respond: (message) => {
        if (message.command.getCommandFieldType() === CommandFieldType.CFindRequest) {
          findMessage = message;
          client.cancel(request);
          return [];
        }
        if (message.command.getCommandFieldType() === CommandFieldType.CCancelRequest) {
          return [responseTo(findMessage, Status.Cancel)];
        }
        return [];
      },
    });

    let canceled = false;

    request.on('response', (response) => {
      if (response.getStatus() === Status.Cancel) {
        canceled = true;
      }
    });
    client.addRequest(request);
    client.on('closed', () => {
      peer.close();
      const cancel = peer.messages[1].command.getCommandDataset();
      expect(canceled).to.be.true;
      expect(cancel.getElement('CommandField')).to.be.eq(CommandFieldType.CCancelRequest);
      expect(cancel.getElement('MessageIDBeingRespondedTo')).to.be.eq(
        findMessage.command.getCommandDataset().getElement('MessageID')
      );
      done();
    });
    client.on('networkError', (e) => {
      throw e;
    });
    client.send('127.0.0.1', 2113, 'CALLINGAET', 'CALLEDAET', clientOptions());
  }));

  it('should correctly perform an A-ABORT operation', withDone((done) => {
    let responded = false;
    const client = new Client();
    const peer = startPeer(2114, {
      respond: () => {
        // Never respond, so that the client gets the chance to abort
        client.abort(AbortSource.ServiceUser, AbortReason.InvalidPduParameter);
        return [];
      },
    });

    const request = CFindRequest.createStudyFindRequest({ PatientID: 'SYNTHETIC-1001' });
    request.on('response', () => {
      responded = true;
    });
    client.addRequest(request);
    client.on('closed', () => peer.afterClientEnded(() => {
      peer.close();
      expect(responded).to.be.false;
      expect(peer.aborts).to.deep.equal([
        { source: AbortSource.ServiceUser, reason: AbortReason.InvalidPduParameter },
      ]);
      done();
    }));
    client.on('networkError', (e) => {
      throw e;
    });
    client.send('127.0.0.1', 2114, 'CALLINGAET', 'CALLEDAET', clientOptions());
  }));

  // A peer that accepts the TCP connection but never responds nor closes its side
  function createUnresponsivePeer(port, onData) {
    const sockets = [];
    const server = net.createServer({ allowHalfOpen: true }, (socket) => {
      sockets.push(socket);
      socket.on('error', () => {});
      socket.on('data', (data) => onData && onData(socket, data));
    });
    server.listen(port);
    return {
      close: () => {
        sockets.forEach((socket) => socket.destroy());
        server.close();
      },
    };
  }

  it('should close the client connection on timeout when the peer never closes its side', withDone((done) => {
    const peer = createUnresponsivePeer(2116);

    let networkError = undefined;

    const client = new Client();
    client.addRequest(new CEchoRequest());
    client.on('networkError', (e) => {
      networkError = e;
    });
    client.on('closed', () => {
      peer.close();
      expect(networkError.timeout).to.be.eq(TimeoutKind.Acse);
      done();
    });
    client.send('127.0.0.1', 2116, 'CALLINGAET', 'CALLEDAET', clientOptions({ acseTimeout: 300 }));
  }));

  it('should deliver the A-ABORT to the peer before closing the client connection on association timeout', withDone((done) => {
    const received = [];
    let closed = false;
    let abortReceived = false;

    const finish = () => {
      if (closed && abortReceived) {
        peer.close();
        done();
      }
    };

    const peer = createUnresponsivePeer(2120, (socket, data) => {
      received.push(data);
      // A-ABORT PDU: type, reserved, length (4), reserved, reserved, source, reason
      const buffer = Buffer.concat(received);
      const aAbortPdu = buffer.subarray(buffer.length - 10);
      if (aAbortPdu[0] === 0x07 && aAbortPdu.readUInt32BE(2) === 4) {
        abortReceived = true;
        finish();
      }
    });

    const client = new Client();
    client.addRequest(new CEchoRequest());
    client.on('networkError', () => {});
    client.on('closed', () => {
      closed = true;
      finish();
    });
    client.send('127.0.0.1', 2120, 'CALLINGAET', 'CALLEDAET', clientOptions({ acseTimeout: 300 }));
  }), 5000);

  it('should emit abort and close the client connection when the peer sends an A-ABORT', withDone((done) => {
    // A-ABORT PDU: type, reserved, length (4), reserved, reserved, source, reason
    const aAbortPdu = Buffer.from([0x07, 0x00, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x02, 0x00]);
    const peer = createUnresponsivePeer(2117, (socket) => socket.write(aAbortPdu));

    let abort = undefined;

    const client = new Client();
    client.addRequest(new CEchoRequest());
    client.on('abort', (a) => {
      abort = a;
    });
    client.on('closed', () => {
      expect(abort.source).to.be.eq(AbortSource.ServiceProvider);
      peer.close();
      done();
    });
    client.on('networkError', (e) => {
      throw e;
    });
    client.send('127.0.0.1', 2117, 'CALLINGAET', 'CALLEDAET', clientOptions());
  }));

  it('should close the client connection when aborted before the association request', withDone((done) => {
    let receivedBytes = 0;
    const peer = createUnresponsivePeer(2118, (socket, data) => {
      receivedBytes += data.length;
    });

    const client = new Client();
    client.addRequest(new CEchoRequest());
    client.on('closed', () => {
      // Give a non-aborted connection the chance to send the association request
      setTimeout(() => {
        expect(receivedBytes).to.be.eq(0);
        peer.close();
        done();
      }, 200);
    });
    client.on('networkError', (e) => {
      throw e;
    });
    client.send('127.0.0.1', 2118, 'CALLINGAET', 'CALLEDAET', clientOptions());
    client.abort(AbortSource.ServiceUser, AbortReason.NotSpecified);
  }));

  it('should deliver the A-ABORT and close the client connection when aborted after the association request', withDone((done) => {
    const received = [];
    let aborted = false;
    let closed = false;
    let abortReceived = false;

    const finish = () => {
      if (closed && abortReceived) {
        peer.close();
        done();
      }
    };

    const client = new Client();
    const peer = createUnresponsivePeer(2122, (socket, data) => {
      received.push(data);
      // The association request has reached the peer, which now stays silent
      if (!aborted) {
        aborted = true;
        client.abort(AbortSource.ServiceUser, AbortReason.NotSpecified);
        return;
      }
      // A-ABORT PDU: type, reserved, length (4), reserved, reserved, source, reason
      const buffer = Buffer.concat(received);
      const aAbortPdu = buffer.subarray(buffer.length - 10);
      if (aAbortPdu[0] === 0x07 && aAbortPdu.readUInt32BE(2) === 4) {
        abortReceived = true;
        finish();
      }
    });

    client.addRequest(new CEchoRequest());
    client.on('closed', () => {
      closed = true;
      finish();
    });
    client.on('networkError', (e) => {
      throw e;
    });
    client.send('127.0.0.1', 2122, 'CALLINGAET', 'CALLEDAET', clientOptions());
  }), 5000);

  it('should close without a network error when aborted from the connected event', withDone((done) => {
    const peer = createUnresponsivePeer(2121);
    let networkError = false;

    const client = new Client();
    client.addRequest(new CEchoRequest());
    client.on('connected', () => {
      client.abort(AbortSource.ServiceUser, AbortReason.NotSpecified);
    });
    client.on('networkError', () => {
      networkError = true;
    });
    client.on('closed', () => {
      peer.close();
      try {
        expect(networkError).to.be.false;
        expect(client.getStatistics().getBytesSent()).to.be.eq(0);
        done();
      } catch (err) {
        done(err);
      }
    });
    client.send('127.0.0.1', 2121, 'CALLINGAET', 'CALLEDAET', clientOptions());
  }));

  it('should close without a network error when aborted from the associationAccepted event', withDone((done) => {
    const peer = startPeer(2123, { respond: answerRequests });
    let networkError = false;

    const client = new Client();
    client.addRequest(CFindRequest.createStudyFindRequest({ PatientID: 'SYNTHETIC-1001' }));
    client.on('associationAccepted', () => {
      client.abort(AbortSource.ServiceUser, AbortReason.NotSpecified);
    });
    client.on('networkError', () => {
      networkError = true;
    });
    client.on('closed', () => peer.afterClientEnded(() => {
      peer.close();
      expect(networkError).to.be.false;
      // The queued request was not dispatched over the closing connection
      expect(peer.messages).to.have.length(0);
      expect(peer.aborts).to.deep.equal([{ source: AbortSource.ServiceUser, reason: AbortReason.NotSpecified }]);
      done();
    }));
    client.send('127.0.0.1', 2123, 'CALLINGAET', 'CALLEDAET', clientOptions());
  }));

  it('should close without a network error when aborted from a final response event', withDone((done) => {
    const peer = startPeer(2124, { respond: answerRequests });
    let networkError = false;

    const client = new Client();
    const echoRequest = new CEchoRequest();
    echoRequest.on('response', (response) => {
      if (response.getStatus() !== Status.Pending) {
        client.abort(AbortSource.ServiceUser, AbortReason.NotSpecified);
      }
    });
    client.addRequest(echoRequest);
    client.addRequest(CFindRequest.createStudyFindRequest({ PatientID: 'SYNTHETIC-1001' }));
    client.on('networkError', () => {
      networkError = true;
    });
    client.on('closed', () => peer.afterClientEnded(() => {
      peer.close();
      expect(networkError).to.be.false;
      expect(peer.releaseRequested).to.be.false;
      // The second request was not dispatched after the abort
      expect(peer.messages.map((message) => message.command.getCommandFieldType())).to.deep.equal([
        CommandFieldType.CEchoRequest,
      ]);
      expect(peer.aborts.map((abort) => abort.source)).to.deep.equal([AbortSource.ServiceUser]);
      done();
    }));
    client.send('127.0.0.1', 2124, 'CALLINGAET', 'CALLEDAET', clientOptions({ associationLingerTimeout: 100 }));
  }));

  it('should not emit network errors from timeout monitors while draining an aborted connection', withDone((done) => {
    const clientSocket = new events.EventEmitter();
    let ended = false;
    let destroyed = false;
    clientSocket.connecting = false;
    clientSocket.destroyed = false;
    clientSocket.writableEnded = false;
    clientSocket.end = (callback) => {
      // A stalled peer keeps the flush (and the end callback) pending forever
      ended = true;
      clientSocket.writableEnded = true;
    };
    clientSocket.destroy = () => {
      destroyed = true;
      clientSocket.destroyed = true;
      clientSocket.emit('close');
    };
    clientSocket.write = () => true;

    const network = new Network(clientSocket, { acseTimeout: 200 });

    let networkError = undefined;
    network.on('networkError', (err) => {
      networkError = err;
    });
    network.on('close', () => {
      try {
        expect(destroyed).to.be.true;
        expect(networkError).to.be.undefined;
        done();
      } catch (err) {
        done(err);
      }
    });

    // Simulate an association waiting for the release response, then an intentional abort toward a
    // peer that stops consuming data, so the flush outlives the ACSE timeout
    network.association = {};
    network.sendAssociationReleaseRequest();
    network.sendAbort(AbortSource.ServiceUser, AbortReason.NotSpecified);
    network.close();
    expect(ended).to.be.true;
  }), 5000);

  // Answers the proposed presentation contexts by their transfer syntax, as a PACS configuration would
  function answeringContexts(configuration) {
    return (request, answer) => {
      answer.presentationContexts.forEach((context) => {
        const proposed = context.transferSyntax;
        if ((configuration.rejectedTransferSyntaxes || []).includes(proposed)) {
          context.result = PresentationContextResult.RejectTransferSyntaxesNotSupported;
          return;
        }
        context.transferSyntax =
          (configuration.acceptedAs || {})[proposed] || configuration.acceptedTransferSyntax || proposed;
      });
    };
  }

  function storeOnPeer(port, configuration, request, onClosed) {
    const peer = startPeer(port, { accept: answeringContexts(configuration), respond: answerRequests });

    const events = [];
    const client = new Client();
    request.on('notSent', (reason) => events.push(reason));
    request.on('done', () => events.push('done'));
    client.addRequest(request);
    client.on('closed', () => {
      peer.close();
      onClosed(peer, events);
    });
    client.on('networkError', (e) => {
      throw e;
    });
    client.send('127.0.0.1', port, 'CALLINGAET', 'CALLEDAET', clientOptions());
  }

  it('should send the stored bytes of a C-STORE request unchanged', withDone((done) => {
    const dataset = storedDataset(
      {
        _vrMap: { PixelData: 'OB' },
        SOPClassUID: StorageClass.SecondaryCaptureImageStorage,
        SOPInstanceUID: Dataset.generateDerivedUid(),
        PatientID: 'SYNTHETIC-0003',
        PixelData: [crypto.randomBytes(100 * 1024).buffer],
      },
      TransferSyntax.ExplicitVRLittleEndian
    );
    storeOnPeer(2150, {}, new CStoreRequest(dataset), (peer, events) => {
      expect(events).to.deep.equal(['done']);
      expect(peer.messages).to.have.length(1);
      expect(peer.messages[0].datasetBytes.equals(dataset.getStoredDataset())).to.be.true;
      done();
    });
  }));

  it('should not send stored C-STORE bytes when the peer accepts a transfer syntax that was not proposed', withDone((done) => {
    const dataset = storedDataset(
      {
        SOPClassUID: StorageClass.SecondaryCaptureImageStorage,
        SOPInstanceUID: Dataset.generateDerivedUid(),
      },
      TransferSyntax.ExplicitVRLittleEndian
    );
    const configuration = { acceptedTransferSyntax: TransferSyntax.ImplicitVRLittleEndian };
    storeOnPeer(2151, configuration, new CStoreRequest(dataset), (peer, events) => {
      expect(events).to.deep.equal([NotSentReason.NoAcceptedPresentationContext, 'done']);
      expect(peer.messages).to.have.length(0);
      done();
    });
  }));

  it('should not transcode a C-FIND identifier to the transfer syntax the peer accepted', withDone((done) => {
    const request = CFindRequest.createStudyFindRequest({ PatientID: 'SYNTHETIC-1001' });
    request.getDataset().setTransferSyntaxUid(TransferSyntax.JpegBaseline);
    storeOnPeer(2152, {}, request, (peer, events) => {
      expect(events).to.deep.equal([NotSentReason.TransferSyntaxMismatch, 'done']);
      expect(peer.messages).to.have.length(0);
      done();
    });
  }));

  it('should not send a C-STORE request whose part10 file cannot be read any more', withDone((done) => {
    const file = part10File(
      {
        SOPClassUID: StorageClass.SecondaryCaptureImageStorage,
        SOPInstanceUID: Dataset.generateDerivedUid(),
      },
      TransferSyntax.ExplicitVRLittleEndian
    );
    const request = new CStoreRequest(file);
    fs.rmSync(path.dirname(file), { recursive: true, force: true });
    storeOnPeer(2126, {}, request, (peer, events) => {
      expect(events).to.deep.equal([NotSentReason.StoredDatasetUnavailable, 'done']);
      expect(peer.messages).to.have.length(0);
      done();
    });
  }));

  function storedVariants(syntaxes) {
    const elements = {
      _vrMap: { PixelData: 'OB' },
      SOPClassUID: StorageClass.SecondaryCaptureImageStorage,
      SOPInstanceUID: Dataset.generateDerivedUid(),
      PatientID: 'SYNTHETIC-0006',
      PixelData: [crypto.randomBytes(4 * 1024).buffer],
    };
    return syntaxes.map((syntax) => storedDataset(elements, syntax));
  }

  const VariantSyntaxes = [
    TransferSyntax.JpegBaseline,
    TransferSyntax.ExplicitVRLittleEndian,
    TransferSyntax.ImplicitVRLittleEndian,
  ];

  function receivedOn(peer) {
    return peer.messages.map((message) => ({
      id: message.contextId,
      transferSyntaxUid: message.transferSyntaxUid,
    }));
  }

  it('should propose a presentation context for each variant and send only the preferred accepted variant', withDone((done) => {
    const variants = storedVariants(VariantSyntaxes);
    const request = new CStoreRequest(variants);
    const configuration = { rejectedTransferSyntaxes: [TransferSyntax.JpegBaseline] };
    storeOnPeer(2127, configuration, request, (peer, events) => {
      expect(peer.proposed).to.deep.equal(
        VariantSyntaxes.map((syntax, index) => ({
          id: 2 * index + 1,
          abstractSyntaxUid: StorageClass.SecondaryCaptureImageStorage,
          transferSyntaxUids: [syntax],
        }))
      );
      expect(events).to.deep.equal(['done']);
      expect(peer.messages).to.have.length(1);
      expect(peer.messages[0].datasetBytes.equals(variants[1].getStoredDataset())).to.be.true;
      expect(receivedOn(peer)).to.deep.equal([{ id: 3, transferSyntaxUid: TransferSyntax.ExplicitVRLittleEndian }]);
      expect(request.getSelectedPresentationContextId()).to.be.eq(3);
      expect(request.getDataset()).to.be.eq(variants[1]);
      done();
    });
  }));

  it('should send the most preferred variant once when the peer accepts every variant', withDone((done) => {
    const variants = storedVariants(VariantSyntaxes);
    const request = new CStoreRequest(variants);
    storeOnPeer(2128, {}, request, (peer, events) => {
      expect(events).to.deep.equal(['done']);
      expect(peer.messages).to.have.length(1);
      expect(peer.messages[0].datasetBytes.equals(variants[0].getStoredDataset())).to.be.true;
      expect(receivedOn(peer)).to.deep.equal([{ id: 1, transferSyntaxUid: TransferSyntax.JpegBaseline }]);
      expect(request.getSelectedPresentationContextId()).to.be.eq(1);
      done();
    });
  }));

  it('should not send any variant when the peer accepts none of them', withDone((done) => {
    const request = new CStoreRequest(storedVariants(VariantSyntaxes));
    storeOnPeer(2129, { rejectedTransferSyntaxes: VariantSyntaxes }, request, (peer, events) => {
      expect(peer.proposed).to.have.length(3);
      expect(events).to.deep.equal([NotSentReason.NoAcceptedPresentationContext, 'done']);
      expect(peer.messages).to.have.length(0);
      expect(request.getSelectedPresentationContextId()).to.be.undefined;
      done();
    });
  }));

  it('should not send a variant on a presentation context the peer accepted with a transfer syntax that was not proposed', withDone((done) => {
    const request = new CStoreRequest(storedVariants(VariantSyntaxes));
    const configuration = {
      acceptedAs: { [TransferSyntax.JpegBaseline]: TransferSyntax.ExplicitVRLittleEndian },
      rejectedTransferSyntaxes: [TransferSyntax.ExplicitVRLittleEndian, TransferSyntax.ImplicitVRLittleEndian],
    };
    storeOnPeer(2130, configuration, request, (peer, events) => {
      expect(events).to.deep.equal([NotSentReason.NoAcceptedPresentationContext, 'done']);
      expect(peer.messages).to.have.length(0);
      done();
    });
  }));

  it('should take every PDV of a P-DATA-TF PDU', withDone((done) => {
    const peer = startPeer(2146, {
      respond: (message) => {
        // A pending response with its identifier and the final response, all in one PDU
        message.socket.write(
          encodePDataTf([
            ...messagePdvs(message.contextId, message.transferSyntaxUid, responseTo(message, Status.Pending, datasets[0])),
            ...messagePdvs(message.contextId, message.transferSyntaxUid, responseTo(message, Status.Success)),
          ])
        );
        return [];
      },
    });

    const request = CFindRequest.createStudyFindRequest({ PatientID: 'SYNTHETIC-1001' });
    runClient(2146, request, { dimseTimeout: 1000 }, (outcome) => {
      peer.close();
      expect(outcome.networkError).to.be.undefined;
      expect(outcome.statuses).to.deep.equal([Status.Pending, Status.Success]);
      done();
    });
  }));
});

describe('Network implementation identity and logs', () => {
  // The longest values the standard allows: a 64-character UID (PS3.5 9.1) and a 16-character name (PS3.7 D.3.3.2.3)
  const LongestUid = `2.25.${'1'.repeat(59)}`;
  const LongestVersion = 'VULNA-TEST-1.0.0';
  const PeerImplementationClassUid = '2.25.329800735698586629295641978511506172918';
  const PeerImplementationVersion = 'PEER-SCP-2';

  it('should identify itself with the implementation identity it is given and keep the peer identity apart', withDone((done) => {
    const peer = startPeer(2153, {
      accept: (request, answer) => {
        answer.implementationVersionName = PeerImplementationVersion;
      },
      respond: answerRequests,
    });

    let accepted = undefined;
    const client = new Client();
    client.addRequest(new CEchoRequest());
    client.on('associationAccepted', (association) => {
      accepted = association;
    });
    client.on('closed', () => {
      peer.close();
      expect(LongestUid).to.have.length(64);
      expect(LongestVersion).to.have.length(16);
      expect(peer.request.implementationClassUid).to.be.eq(LongestUid);
      expect(peer.request.implementationVersionName).to.be.eq(LongestVersion);
      expect(accepted.getImplementationClassUid()).to.be.eq(LongestUid);
      expect(accepted.getImplementationVersion()).to.be.eq(LongestVersion);
      expect(accepted.getPeerImplementationClassUid()).to.be.eq(PeerImplementationClassUid);
      expect(accepted.getPeerImplementationVersion()).to.be.eq(PeerImplementationVersion);
      done();
    });
    client.on('networkError', (e) => {
      throw e;
    });
    client.send('127.0.0.1', 2153, 'CALLINGAET', 'CALLEDAET', {
      implementationClassUid: LongestUid,
      implementationVersion: LongestVersion,
    });
  }));

  it('should send no implementation version name when it is given none', withDone((done) => {
    const peer = startPeer(2154, { respond: answerRequests });

    let accepted = undefined;
    const client = new Client();
    client.addRequest(new CEchoRequest());
    client.on('associationAccepted', (association) => {
      accepted = association;
    });
    client.on('closed', () => {
      peer.close();
      expect(peer.request.implementationClassUid).to.be.eq(TestImplementationClassUid);
      expect(peer.request.implementationVersionName).to.be.undefined;
      expect(accepted.getPeerImplementationClassUid()).to.be.eq(PeerImplementationClassUid);
      expect(accepted.getPeerImplementationVersion()).to.be.undefined;
      done();
    });
    client.on('networkError', (e) => {
      throw e;
    });
    client.send('127.0.0.1', 2154, 'CALLINGAET', 'CALLEDAET', clientOptions());
  }));

  it('should refuse a missing or invalid implementation identity before connecting', () => {
    const invalidOptions = [
      [{}, /implementationClassUid option must be/],
      [{ implementationClassUid: '' }, /implementationClassUid option must be/],
      [{ implementationClassUid: 1.2 }, /implementationClassUid option must be/],
      [{ implementationClassUid: '1.02' }, /implementationClassUid option must be/],
      [{ implementationClassUid: '1..2' }, /implementationClassUid option must be/],
      [{ implementationClassUid: '.1.2' }, /implementationClassUid option must be/],
      [{ implementationClassUid: '1.2.' }, /implementationClassUid option must be/],
      [{ implementationClassUid: '1.2.a' }, /implementationClassUid option must be/],
      [{ implementationClassUid: '1.2\0' }, /implementationClassUid option must be/],
      [{ implementationClassUid: `${LongestUid}1` }, /implementationClassUid option must be/],
      [{ implementationClassUid: LongestUid, implementationVersion: '' }, /implementationVersion option must be/],
      [{ implementationClassUid: LongestUid, implementationVersion: `${LongestVersion}X` }, /implementationVersion option must be/],
      [{ implementationClassUid: LongestUid, implementationVersion: ' VULNA' }, /implementationVersion option must be/],
      [{ implementationClassUid: LongestUid, implementationVersion: 'VULNA ' }, /implementationVersion option must be/],
      [{ implementationClassUid: LongestUid, implementationVersion: 'VULNAČ' }, /implementationVersion option must be/],
      [{ implementationClassUid: LongestUid, implementationVersion: 1 }, /implementationVersion option must be/],
    ];
    invalidOptions.forEach(([opts, message]) => {
      const client = new Client();
      client.addRequest(new CEchoRequest());
      expect(() => client.send('127.0.0.1', 2155, 'CALLINGAET', 'CALLEDAET', opts)).to.throw(message);
      expect(client.network).to.be.undefined;
    });
  });

  it('should log no patient identifier and no error comment at any log level', withDone((done) => {
    const patientId = 'SYNTHETIC-LOG-0001';
    const errorComment = 'SYNTHETIC ERROR COMMENT';
    const peer = startPeer(2156, {
      respond: (message) => {
        const match = new Dataset({ PatientID: patientId, PatientName: 'SYNTHETIC^LOG' });
        const final = responseTo(message, Status.ProcessingFailure);
        final.setErrorComment(errorComment);
        return [responseTo(message, Status.Pending, match), final];
      },
    });

    const logged = [];
    const originalFactory = log.methodFactory;
    log.methodFactory = () => (...args) => logged.push(args.map(String).join(' '));
    log.setLevel('trace');
    const restoreLog = () => {
      log.methodFactory = originalFactory;
      log.setLevel('error');
    };

    const client = new Client();
    client.addRequest(CFindRequest.createStudyFindRequest({ PatientID: patientId }));
    client.on('closed', () => {
      restoreLog();
      peer.close();
      expect(logged.length).to.be.greaterThan(0);
      expect(logged.filter((line) => line.includes(patientId) || line.includes(errorComment))).to.deep.equal([]);
      done();
    });
    client.send('127.0.0.1', 2156, 'CALLINGAET', 'CALLEDAET', clientOptions());
  }));
});

describe('Network reading the PDUs of the peer as strictly as PS3.8', () => {
  beforeAll(() => {
    log.setLevel('error');
  });

  const AbortPdu = Buffer.from([PduType.Abort, 0, 0, 0, 0, 4, 0, 0, AbortSource.ServiceUser, 0]);
  const ProviderAbort = (reason) => [{ source: AbortSource.ServiceProvider, reason }];
  const UserAbort = [{ source: AbortSource.ServiceUser, reason: AbortReason.NotSpecified }];
  const AssociateFixedFieldsEnd = 6 + 68;

  function withItemLength(bytes, itemType, length) {
    const copy = Buffer.from(bytes);
    let offset = AssociateFixedFieldsEnd;
    while (copy[offset] !== itemType) {
      offset += 4 + copy.readUInt16BE(offset + 2);
    }
    copy.writeUInt16BE(length, offset + 2);
    return copy;
  }

  function commandBytes(command) {
    return command.getCommandDataset().getDenaturalizedCommandDataset();
  }

  function contextIdOf(peer, abstractSyntaxUid) {
    return peer.request.presentationContexts.find((context) => context.abstractSyntax === abstractSyntaxUid).id;
  }

  function expectAborted(peer, outcome, message, aborts) {
    expect(outcome.networkError.message).to.match(message);
    expect(outcome.networkErrors).to.be.eq(1);
    expect(outcome.statuses).to.deep.equal([]);
    expect(peer.aborts).to.deep.equal(aborts);
  }

  it('should abort as the service provider on an A-ASSOCIATE-AC whose item runs past the PDU', withDone((done) => {
    const peer = startPeer(2160, {
      accept: (request, answer) => withItemLength(encodeAssociateAccept(answer), 0x21, 0xffff),
      respond: answerRequests,
    });

    runClient(2160, new CEchoRequest(), {}, (outcome) => peer.afterClientEnded(() => {
      peer.close();
      expectAborted(peer, outcome, /Invalid A-ASSOCIATE-AC from the peer: .*runs past the bytes left/, ProviderAbort(AbortReason.InvalidPduParameter));
      expect(outcome.accepted).to.be.eq(0);
      expect(peer.messages).to.have.length(0);
      done();
    }));
  }));

  it('should abort as the service provider on an A-ASSOCIATE-RJ with an undefined result', withDone((done) => {
    const peer = startPeer(2161, { accept: () => encodeAssociateReject(0, RejectSource.ServiceUser, 1) });

    runClient(2161, new CEchoRequest(), {}, (outcome) => peer.afterClientEnded(() => {
      peer.close();
      expectAborted(peer, outcome, /Invalid A-ASSOCIATE-RJ from the peer: .*result 0/, ProviderAbort(AbortReason.InvalidPduParameter));
      expect(outcome.rejected).to.be.eq(0);
      done();
    }));
  }));

  it('should abort as the service provider on a P-DATA-TF before the association is accepted', withDone((done) => {
    const peer = startPeer(2162, {
      accept: () => encodePDataTf([{ contextId: 1, isCommand: true, isLast: true, value: Buffer.alloc(2) }]),
    });

    runClient(2162, new CEchoRequest(), {}, (outcome) => peer.afterClientEnded(() => {
      peer.close();
      expectAborted(peer, outcome, /Unexpected P-DATA-TF from the peer/, ProviderAbort(AbortReason.UnexpectedPdu));
      expect(outcome.accepted).to.be.eq(0);
      done();
    }));
  }));

  it('should abort as the service provider on a second A-ASSOCIATE-AC and send the requests only once', withDone((done) => {
    let accept = undefined;
    const peer = startPeer(2163, {
      accept: (request, answer) => {
        accept = encodeAssociateAccept(answer);
        return accept;
      },
      afterAccept: (socket) => socket.write(accept),
      respond: answerRequests,
    });

    runClient(2163, new CEchoRequest(), {}, (outcome) => peer.afterClientEnded(() => {
      peer.close();
      expectAborted(peer, outcome, /Unexpected A-ASSOCIATE-AC from the peer/, ProviderAbort(AbortReason.UnexpectedPdu));
      expect(outcome.accepted).to.be.eq(1);
      expect(peer.messages.length).to.be.at.most(1);
      done();
    }));
  }));

  it('should abort as the service provider on an A-RELEASE-RP or an A-ASSOCIATE-RJ on an established association', withDone((done) => {
    const unexpected = [
      [2164, encodeReleaseResponse(), /Unexpected A-RELEASE-RP from the peer/],
      [2165, encodeAssociateReject(RejectResult.Permanent, RejectSource.ServiceUser, 1), /Unexpected A-ASSOCIATE-RJ from the peer/],
    ];
    let pending = unexpected.length;
    unexpected.forEach(([port, bytes, message]) => {
      const peer = startPeer(port, { respond: (received) => {
        received.socket.write(bytes);
        return [];
      } });
      runClient(port, new CEchoRequest(), {}, (outcome) => peer.afterClientEnded(() => {
        peer.close();
        expectAborted(peer, outcome, message, ProviderAbort(AbortReason.UnexpectedPdu));
        expect(outcome.rejected).to.be.eq(0);
        pending -= 1;
        if (pending === 0) {
          done();
        }
      }));
    });
  }));

  it('should abort as the service provider on a P-DATA-TF without a PDV or with a PDV running past the PDU', withDone((done) => {
    const overrun = encodePDataTf([{ contextId: 1, isCommand: true, isLast: true, value: Buffer.alloc(4) }]);
    overrun.writeUInt32BE(overrun.length, 6);
    const invalid = [
      [2166, encodePdu(PduType.PDataTf, Buffer.alloc(0)), /Invalid P-DATA-TF from the peer: P-DATA-TF has no PDV/],
      [2167, overrun, /Invalid P-DATA-TF from the peer: PDV of length \d+ does not fit/],
    ];
    let pending = invalid.length;
    invalid.forEach(([port, bytes, message]) => {
      const peer = startPeer(port, { respond: (received) => {
        received.socket.write(bytes);
        return [];
      } });
      runClient(port, new CEchoRequest(), {}, (outcome) => peer.afterClientEnded(() => {
        peer.close();
        expectAborted(peer, outcome, message, ProviderAbort(AbortReason.InvalidPduParameter));
        pending -= 1;
        if (pending === 0) {
          done();
        }
      }));
    });
  }));

  it('should abort as the service provider on a PDV on a rejected presentation context', withDone((done) => {
    let rejectedId = undefined;
    const peer = startPeer(2168, {
      accept: (request, answer) => {
        const rejected = answer.presentationContexts.find(
          (context) => request.presentationContexts.find((proposed) => proposed.id === context.id).abstractSyntax ===
            SopClass.ModalityWorklistInformationModelFind
        );
        rejected.result = PresentationContextResult.RejectAbstractSyntaxNotSupported;
        rejectedId = rejected.id;
      },
      respond: (message) => {
        message.socket.write(messagePdu(rejectedId, TransferSyntax.ImplicitVRLittleEndian, responseTo(message, Status.Success)));
        return [];
      },
    });

    const client = new Client();
    client.addAdditionalPresentationContext(
      new PresentationContext(0, SopClass.ModalityWorklistInformationModelFind, TransferSyntax.ImplicitVRLittleEndian)
    );
    const request = new CEchoRequest();
    const statuses = [];
    let networkError = undefined;
    request.on('response', (response) => statuses.push(response.getStatus()));
    client.addRequest(request);
    client.on('networkError', (e) => {
      networkError = e;
    });
    client.on('closed', () => peer.afterClientEnded(() => {
      peer.close();
      expect(networkError.message).to.match(new RegExp(`PDV on presentation context ${rejectedId}, which was not accepted`));
      expect(statuses).to.deep.equal([]);
      expect(peer.aborts).to.deep.equal(ProviderAbort(AbortReason.InvalidPduParameter));
      done();
    }));
    client.send('127.0.0.1', 2168, 'CALLINGAET', 'CALLEDAET', clientOptions());
  }));

  it('should abort as the service provider on a PDV on a presentation context that was not proposed', withDone((done) => {
    const peer = startPeer(2169, {
      respond: (message) => {
        message.socket.write(messagePdu(201, TransferSyntax.ImplicitVRLittleEndian, responseTo(message, Status.Success)));
        return [];
      },
    });

    runClient(2169, new CEchoRequest(), {}, (outcome) => peer.afterClientEnded(() => {
      peer.close();
      expectAborted(peer, outcome, /PDV on presentation context 201, which was not accepted/, ProviderAbort(AbortReason.InvalidPduParameter));
      done();
    }));
  }));

  it('should abort as the service user on a dataset fragment without a command that announces a dataset (PS3.8 E.1)', withDone((done) => {
    const peer = startPeer(2170, {
      respond: (message) => {
        const final = responseTo(message, Status.Success);
        message.socket.write(
          encodePDataTf([
            { contextId: message.contextId, isCommand: true, isLast: true, value: commandBytes(final) },
            { contextId: message.contextId, isCommand: false, isLast: true, value: Buffer.alloc(8) },
          ])
        );
        return [];
      },
    });

    runClient(2170, new CEchoRequest(), {}, (outcome) => peer.afterClientEnded(() => {
      peer.close();
      expect(outcome.networkError.message).to.match(/Dataset fragment without a command that announces a dataset/);
      expect(outcome.statuses).to.deep.equal([Status.Success]);
      expect(peer.aborts).to.deep.equal(UserAbort);
      done();
    }));
  }));

  it('should abort as the service user on a command fragment while the dataset of the message is expected', withDone((done) => {
    const peer = startPeer(2171, {
      respond: (message) => {
        const pending = responseTo(message, Status.Pending, datasets[0]);
        const final = responseTo(message, Status.Success);
        message.socket.write(
          encodePDataTf([
            { contextId: message.contextId, isCommand: true, isLast: true, value: commandBytes(pending) },
            { contextId: message.contextId, isCommand: true, isLast: true, value: commandBytes(final) },
          ])
        );
        return [];
      },
    });

    const request = CFindRequest.createStudyFindRequest({ PatientID: 'SYNTHETIC-1001' });
    runClient(2171, request, {}, (outcome) => peer.afterClientEnded(() => {
      peer.close();
      expectAborted(peer, outcome, /Command fragment while the dataset of the message is expected/, UserAbort);
      done();
    }));
  }));

  it('should abort as the service user on a fragment of a message on another presentation context (PS3.8 E.1)', withDone((done) => {
    const peer = startPeer(2172, {
      respond: (message) => {
        const command = commandBytes(responseTo(message, Status.Success));
        const otherContextId = contextIdOf(peer, SopClass.StudyRootQueryRetrieveInformationModelFind);
        message.socket.write(
          encodePDataTf([
            { contextId: message.contextId, isCommand: true, isLast: false, value: command.subarray(0, 8) },
            { contextId: otherContextId, isCommand: true, isLast: true, value: command.subarray(8) },
          ])
        );
        return [];
      },
    });

    const requests = [new CEchoRequest(), CFindRequest.createStudyFindRequest({ PatientID: 'SYNTHETIC-1001' })];
    runClient(2172, requests, {}, (outcome) => peer.afterClientEnded(() => {
      peer.close();
      expectAborted(peer, outcome, /Fragment on presentation context \d+ while a message on presentation context \d+ is received/, UserAbort);
      done();
    }));
  }));

  it('should take empty PDV fragments (PS3.8 E.1)', withDone((done) => {
    const peer = startPeer(2173, {
      respond: (message) => {
        const command = commandBytes(responseTo(message, Status.Success));
        message.socket.write(
          encodePDataTf([
            { contextId: message.contextId, isCommand: true, isLast: false, value: Buffer.alloc(0) },
            { contextId: message.contextId, isCommand: true, isLast: true, value: command },
          ])
        );
        return [];
      },
    });

    runClient(2173, new CEchoRequest(), {}, (outcome) => peer.afterClientEnded(() => {
      peer.close();
      expect(outcome.networkError).to.be.undefined;
      expect(outcome.statuses).to.deep.equal([Status.Success]);
      expect(peer.aborts).to.deep.equal([]);
      done();
    }));
  }));

  it('should take a received message as long as the maximum and abort as the service user on a longer one', withDone((done) => {
    // The pending response is the longest message: its command and the matching dataset
    const sent = CFindRequest.createStudyFindRequest({ PatientID: 'SYNTHETIC-1001' });
    sent.setMessageId(1);
    const pendingResponse = responseTo({ command: sent }, Status.Pending, datasets[0]);
    datasets[0].setTransferSyntaxUid(TransferSyntax.ImplicitVRLittleEndian);
    const longest = commandBytes(pendingResponse).length + datasets[0].getDenaturalizedDataset().length;

    const runs = [
      [2174, longest, (outcome, peer) => {
        expect(outcome.networkError).to.be.undefined;
        expect(outcome.statuses).to.deep.equal([Status.Pending, Status.Success]);
        expect(peer.aborts).to.deep.equal([]);
      }],
      [2175, longest - 1, (outcome, peer) => {
        expectAborted(peer, outcome, new RegExp(`Received message exceeds the maximum length ${longest - 1}`), UserAbort);
      }],
    ];
    let pending = runs.length;
    runs.forEach(([port, maxReceivedMessageLength, check]) => {
      const peer = startPeer(port, { respond: answerRequests });
      const request = CFindRequest.createStudyFindRequest({ PatientID: 'SYNTHETIC-1001' });
      runClient(port, request, { maxReceivedMessageLength }, (outcome) => peer.afterClientEnded(() => {
        peer.close();
        check(outcome, peer);
        pending -= 1;
        if (pending === 0) {
          done();
        }
      }));
    });
  }));

  it('should ignore the PDUs after an A-ABORT from the peer', withDone((done) => {
    const peer = startPeer(2176, {
      respond: (message) => {
        message.socket.write(
          Buffer.concat([AbortPdu, messagePdu(message.contextId, message.transferSyntaxUid, responseTo(message, Status.Success))])
        );
        return [];
      },
    });

    runClient(2176, new CEchoRequest(), {}, (outcome) => peer.afterClientEnded(() => {
      peer.close();
      expect(outcome.aborts).to.be.eq(1);
      expect(outcome.networkError).to.be.undefined;
      expect(outcome.statuses).to.deep.equal([]);
      expect(peer.aborts).to.deep.equal([]);
      done();
    }));
  }));

  it('should ignore the PDUs after a PDU that aborted the association', withDone((done) => {
    let accept = undefined;
    const peer = startPeer(2177, {
      accept: (request, answer) => {
        accept = encodeAssociateAccept(answer);
        return accept;
      },
      respond: (message) => {
        message.socket.write(
          Buffer.concat([
            accept,
            messagePdu(message.contextId, message.transferSyntaxUid, responseTo(message, Status.Success)),
            encodePdu(0x0a, Buffer.alloc(4)),
          ])
        );
        return [];
      },
    });

    runClient(2177, new CEchoRequest(), {}, (outcome) => peer.afterClientEnded(() => {
      peer.close();
      expectAborted(peer, outcome, /Unexpected A-ASSOCIATE-AC from the peer/, ProviderAbort(AbortReason.UnexpectedPdu));
      done();
    }));
  }));

  it('should take no PDV of a P-DATA-TF PDU after a response listener aborted the association', withDone((done) => {
    const peer = startPeer(2178, {
      respond: (message) => {
        message.socket.write(
          encodePDataTf([
            ...messagePdvs(message.contextId, message.transferSyntaxUid, responseTo(message, Status.Pending, datasets[0])),
            ...messagePdvs(message.contextId, message.transferSyntaxUid, responseTo(message, Status.Success)),
          ])
        );
        return [];
      },
    });

    const statuses = [];
    const client = new Client();
    const request = CFindRequest.createStudyFindRequest({ PatientID: 'SYNTHETIC-1001' });
    request.on('response', (response) => {
      statuses.push(response.getStatus());
      client.abort(AbortSource.ServiceUser, AbortReason.NotSpecified);
    });
    client.addRequest(request);
    client.on('closed', () => peer.afterClientEnded(() => {
      peer.close();
      expect(statuses).to.deep.equal([Status.Pending]);
      expect(peer.aborts).to.deep.equal(UserAbort);
      done();
    }));
    client.send('127.0.0.1', 2178, 'CALLINGAET', 'CALLEDAET', clientOptions());
  }));

  it('should take no PDV after the association was aborted, even with the connection still open', () => {
    const socket = new events.EventEmitter();
    socket.connecting = false;
    socket.destroyed = false;
    socket.writableEnded = false;
    socket.writableLength = 0;
    // The bytes are handed to the operating system at once
    socket.write = (bytes, onWritten) => {
      onWritten();
      return true;
    };
    const network = new Network(socket, {});
    const association = new Association('CALLINGAET', 'CALLEDAET');
    association.setImplementationClassUid(TestImplementationClassUid);
    const request = CFindRequest.createStudyFindRequest({ PatientID: 'SYNTHETIC-1001' });
    association.addPresentationContextFromRequest(request, [TransferSyntax.ImplicitVRLittleEndian]);
    const statuses = [];
    request.on('response', (response) => {
      statuses.push(response.getStatus());
      network.sendAbort(AbortSource.ServiceUser, AbortReason.NotSpecified);
    });
    network.on('associationAccepted', () => network.sendRequests([request]));

    network.sendAssociationRequest(association);
    socket.emit(
      'data',
      encodeAssociateAccept({
        calledAeTitle: 'CALLEDAET',
        callingAeTitle: 'CALLINGAET',
        presentationContexts: [
          { id: 1, result: PresentationContextResult.Accept, transferSyntax: TransferSyntax.ImplicitVRLittleEndian },
        ],
        maxPduLength: 16384,
        implementationClassUid: TestImplementationClassUid,
      })
    );
    socket.emit(
      'data',
      encodePDataTf([
        ...messagePdvs(1, TransferSyntax.ImplicitVRLittleEndian, responseTo({ command: request }, Status.Pending, datasets[0])),
        ...messagePdvs(1, TransferSyntax.ImplicitVRLittleEndian, responseTo({ command: request }, Status.Success)),
      ])
    );
    socket.destroyed = true;
    socket.emit('close');

    expect(statuses).to.deep.equal([Status.Pending]);
  });

  function closingSocket() {
    const socket = new events.EventEmitter();
    socket.connecting = false;
    socket.destroyed = false;
    socket.writableEnded = false;
    socket.writableLength = 0;
    // The bytes are handed to the operating system at once
    socket.write = (bytes, onWritten) => {
      onWritten();
      return true;
    };
    socket.end = () => {
      socket.writableEnded = true;
    };
    socket.destroy = () => {
      socket.destroyed = true;
      socket.emit('close');
    };
    return socket;
  }

  it('should end its side and keep reading until the peer closes its side (PS3.8 9.2.3, Sta13)', () => {
    const socket = closingSocket();
    const network = new Network(socket, {});

    network.close();
    expect(socket.writableEnded).to.be.true;
    expect(socket.destroyed).to.be.false;
    socket.emit('end');
    expect(socket.destroyed).to.be.true;
  });

  it('should destroy the connection after the grace period when the peer does not close its side', withDone((done) => {
    const socket = closingSocket();
    const network = new Network(socket, {});
    const closedAt = Date.now();

    network.close();
    socket.once('close', () => {
      expect(Date.now() - closedAt).to.be.at.least(900);
      expect(socket.writableEnded).to.be.true;
      done();
    });
  }));

  it('should take no PDV once it closes the connection', () => {
    const socket = closingSocket();
    const network = new Network(socket, {});
    const association = new Association('CALLINGAET', 'CALLEDAET');
    association.setImplementationClassUid(TestImplementationClassUid);
    const request = new CEchoRequest();
    association.addPresentationContextFromRequest(request, [TransferSyntax.ImplicitVRLittleEndian]);
    const statuses = [];
    request.on('response', (response) => statuses.push(response.getStatus()));
    network.on('associationAccepted', () => network.sendRequests([request]));

    network.sendAssociationRequest(association);
    socket.emit(
      'data',
      encodeAssociateAccept({
        calledAeTitle: 'CALLEDAET',
        callingAeTitle: 'CALLINGAET',
        presentationContexts: [
          { id: 1, result: PresentationContextResult.Accept, transferSyntax: TransferSyntax.ImplicitVRLittleEndian },
        ],
        maxPduLength: 16384,
        implementationClassUid: TestImplementationClassUid,
      })
    );
    network.close();
    socket.emit(
      'data',
      encodePDataTf([
        { contextId: 1, isCommand: true, isLast: true, value: commandBytes(responseTo({ command: request }, Status.Success)) },
      ])
    );
    socket.emit('end');

    expect(statuses).to.deep.equal([]);
  });

  it('should not request the release of an association that is not established', () => {
    const socket = new events.EventEmitter();
    socket.connecting = false;
    socket.destroyed = false;
    socket.writableEnded = false;
    const written = [];
    socket.write = (bytes) => {
      written.push(bytes);
      return true;
    };
    const network = new Network(socket, {});

    network.sendAssociationReleaseRequest();
    socket.destroyed = true;
    socket.emit('close');

    expect(written).to.deep.equal([]);
  });
});

describe('Network taking only the responses to its own requests', () => {
  beforeAll(() => {
    log.setLevel('error');
  });

  const UserAbort = [{ source: AbortSource.ServiceUser, reason: AbortReason.NotSpecified }];
  const ForeignUid = '2.25.999';

  function storeRequest(pixelBytes) {
    return new CStoreRequest(
      storedDataset(
        {
          _vrMap: { PixelData: 'OB' },
          SOPClassUID: StorageClass.SecondaryCaptureImageStorage,
          SOPInstanceUID: Dataset.generateDerivedUid(),
          PatientID: 'SYNTHETIC-0008',
          PixelData: [crypto.randomBytes(pixelBytes || 1024).buffer],
        },
        TransferSyntax.ExplicitVRLittleEndian
      )
    );
  }

  function commandOf(elements) {
    return new Command(new Dataset({ CommandDataSetType: 0x0101, ...elements }));
  }

  function answering(message, response) {
    message.socket.write(messagePdu(message.contextId, message.transferSyntaxUid, response));
    return [];
  }

  // Runs the requests against a peer whose answer is not the client's, and expects the association aborted
  function expectNotTaken(port, requests, respond, problem, done, takenStatuses) {
    const peer = startPeer(port, { respond });
    runClient(port, requests, {}, (outcome) => peer.afterClientEnded(() => {
      peer.close();
      expect(outcome.networkError.message).to.match(problem);
      expect(outcome.networkErrors).to.be.eq(1);
      expect(peer.aborts).to.deep.equal(UserAbort);
      expect(outcome.statuses).to.deep.equal(takenStatuses || []);
      done();
    }));
  }

  it('should abort on a response to a message ID that no outstanding request has', withDone((done) => {
    expectNotTaken(2179, new CEchoRequest(), (message) => {
      const response = responseTo(message, Status.Success);
      response.setMessageIdBeingRespondedTo(message.command.getCommandDataset().getElement('MessageID') + 1);
      return answering(message, response);
    }, /Response that is not the client's: C-ECHO RSP .* answers no outstanding request/, done);
  }));

  it('should abort on a C-ECHO or C-FIND response to a C-STORE request with its message ID', withDone((done) => {
    const answers = [
      [2180, (message) => new CEchoResponse(Status.Success), /C-ECHO RSP .* answers C-STORE RQ/],
      [2181, (message) => new CFindResponse(Status.Success), /C-FIND RSP .* answers C-STORE RQ/],
    ];
    let pending = answers.length;
    answers.forEach(([port, create, problem]) => {
      expectNotTaken(port, storeRequest(), (message) => {
        const response = create(message);
        response.setMessageIdBeingRespondedTo(message.command.getCommandDataset().getElement('MessageID'));
        return answering(message, response);
      }, problem, () => {
        pending -= 1;
        if (pending === 0) {
          done();
        }
      });
    });
  }));

  it('should abort on a response on another presentation context than the one of its request', withDone((done) => {
    let peer = undefined;
    const respond = (message) => {
      if (message.command.getCommandFieldType() !== CommandFieldType.CEchoRequest) {
        return [];
      }
      const findContext = peer.proposed.find(
        (context) => context.abstractSyntaxUid === SopClass.StudyRootQueryRetrieveInformationModelFind
      );
      message.socket.write(messagePdu(findContext.id, message.transferSyntaxUid, responseTo(message, Status.Success)));
      return [];
    };
    peer = startPeer(2182, { respond });
    const requests = [new CEchoRequest(), CFindRequest.createStudyFindRequest({ PatientID: 'SYNTHETIC-1001' })];
    runClient(2182, requests, {}, (outcome) => peer.afterClientEnded(() => {
      peer.close();
      expect(outcome.networkError.message).to.match(/C-ECHO RSP .* came on presentation context \d+, not on the one of C-ECHO RQ/);
      expect(outcome.statuses).to.deep.equal([]);
      expect(peer.aborts).to.deep.equal(UserAbort);
      done();
    }));
  }));

  it('should abort on a C-STORE response that names another SOP class or SOP instance', withDone((done) => {
    const answers = [
      [2183, (response) => response.setAffectedSopClassUid(StorageClass.VlPhotographicImageStorage), /names another affected SOP class/],
      [2184, (response) => response.setAffectedSopInstanceUid(ForeignUid), /names another affected SOP instance/],
    ];
    let pending = answers.length;
    answers.forEach(([port, change, problem]) => {
      expectNotTaken(port, storeRequest(), (message) => {
        const response = responseTo(message, Status.Success);
        change(response);
        return answering(message, response);
      }, problem, () => {
        pending -= 1;
        if (pending === 0) {
          done();
        }
      });
    });
  }));

  it('should take a C-STORE response that names neither the SOP class nor the SOP instance (PS3.7 9.1.1.1)', withDone((done) => {
    const peer = startPeer(2185, {
      respond: (message) =>
        answering(
          message,
          commandOf({
            CommandField: CommandFieldType.CStoreResponse,
            MessageIDBeingRespondedTo: message.command.getCommandDataset().getElement('MessageID'),
            Status: Status.Success,
          })
        ),
    });
    runClient(2185, storeRequest(), {}, (outcome) => peer.afterClientEnded(() => {
      peer.close();
      expect(outcome.networkError).to.be.undefined;
      expect(outcome.statuses).to.deep.equal([Status.Success]);
      done();
    }));
  }));

  it('should abort on a C-STORE response that comes before the request was handed to the system completely', withDone((done) => {
    const received = [];
    let answered = false;
    const request = storeRequest(8 * 1024 * 1024);
    const peer = startPeer(2186, {
      onData: (socket, data) => {
        received.push(data);
        if (answered) {
          return;
        }
        answered = true;
        // The peer stops reading, so that the rest of the data set cannot be sent, and answers at once
        socket.pause();
        const response = new CStoreResponse(Status.Success);
        response.setAffectedSopClassUid(StorageClass.SecondaryCaptureImageStorage);
        response.setAffectedSopInstanceUid(request.getAffectedSopInstanceUid());
        response.setMessageIdBeingRespondedTo(1);
        socket.write(messagePdu(1, TransferSyntax.ExplicitVRLittleEndian, response));
        setTimeout(() => socket.resume(), 200);
      },
    });
    runClient(2186, request, {}, (outcome) => peer.afterClientEnded(() => {
      peer.close();
      expect(outcome.networkError.message).to.match(/C-STORE RSP .* came before C-STORE RQ .* was sent completely/);
      expect(outcome.statuses).to.deep.equal([]);
      expect(abortOf(Buffer.concat(received))).to.deep.equal(UserAbort[0]);
      done();
    }));
  }));

  it('should abort on a pending status of a C-STORE or C-ECHO response', withDone((done) => {
    const cases = [
      [2187, storeRequest(), Status.Pending],
      [2188, new CEchoRequest(), Status.PendingWarning],
    ];
    let pending = cases.length;
    cases.forEach(([port, request, status]) => {
      expectNotTaken(port, request, (message) => answering(message, responseTo(message, status)), /has a pending status, which only C-FIND has/, () => {
        pending -= 1;
        if (pending === 0) {
          done();
        }
      });
    });
  }));

  it('should abort on a C-STORE response or a final C-FIND response that carries a data set (PS3.7 9.1.2.1.5)', withDone((done) => {
    const cases = [
      [2189, storeRequest(), Status.Success],
      [2190, CFindRequest.createStudyFindRequest({ PatientID: 'SYNTHETIC-1001' }), Status.Success],
    ];
    let pending = cases.length;
    cases.forEach(([port, request, status]) => {
      expectNotTaken(port, request, (message) => answering(message, responseTo(message, status, datasets[0])), /carries a data set, which only a pending C-FIND response does/, () => {
        pending -= 1;
        if (pending === 0) {
          done();
        }
      });
    });
  }));

  it('should abort on a response without a status', withDone((done) => {
    expectNotTaken(2191, new CEchoRequest(), (message) =>
      answering(
        message,
        commandOf({
          CommandField: CommandFieldType.CEchoResponse,
          AffectedSOPClassUID: SopClass.Verification,
          MessageIDBeingRespondedTo: message.command.getCommandDataset().getElement('MessageID'),
        })
      ), /C-ECHO RSP .* has no status/, done);
  }));

  it('should abort on a second final response to the same request', withDone((done) => {
    expectNotTaken(2192, new CEchoRequest(), (message) => {
      answering(message, responseTo(message, Status.Success));
      return answering(message, responseTo(message, Status.Success));
    }, /C-ECHO RSP .* answers no outstanding request/, done, [Status.Success]);
  }));

  it('should take FF01 as a pending C-FIND status, not as a final one (PS3.4 C.4.1.1.4)', withDone((done) => {
    const peer = startPeer(2193, {
      respond: (message) => [responseTo(message, Status.PendingWarning, datasets[0]), responseTo(message, Status.Success)],
    });
    const request = CFindRequest.createStudyFindRequest({ PatientID: 'SYNTHETIC-1001' });
    let doneEvents = 0;
    request.on('done', () => {
      doneEvents += 1;
    });
    runClient(2193, request, {}, (outcome) => peer.afterClientEnded(() => {
      peer.close();
      expect(outcome.networkError).to.be.undefined;
      expect(outcome.statuses).to.deep.equal([Status.PendingWarning, Status.Success]);
      expect(doneEvents).to.be.eq(1);
      done();
    }));
  }));

  it('should abort on an identifier that cannot be read with the read options the user gave', withDone((done) => {
    const peer = startPeer(2214, {
      respond: (message) => {
        const match = new Dataset({ SpecificCharacterSet: ['ISO_IR 192', 'ISO_IR 100'], PatientID: 'SYNTHETIC-1001' });
        return [responseTo(message, Status.Pending, match), responseTo(message, Status.Success)];
      },
    });
    const request = CFindRequest.createStudyFindRequest({ PatientID: 'SYNTHETIC-1001' });
    runClient(2214, request, { datasetReadOptions: { ignoreErrors: false } }, (outcome) => peer.afterClientEnded(() => {
      peer.close();
      expect(outcome.networkError.message).to.match(/Invalid data set from the peer: Using multiple character sets is not supported/);
      expect(outcome.statuses).to.deep.equal([]);
      expect(peer.aborts).to.deep.equal(UserAbort);
      done();
    }));
  }));

  it('should abort on a command set or an identifier whose structure is not valid', withDone((done) => {
    const cases = [
      [2194, new CEchoRequest(), (message) => {
        const bytes = responseTo(message, Status.Success).getCommandDataset().getDenaturalizedCommandDataset();
        bytes.writeUInt32LE(bytes.readUInt32LE(8) + 1000, 8);
        message.socket.write(encodePDataTf([{ contextId: message.contextId, isCommand: true, isLast: true, value: bytes }]));
        return [];
      }, /Invalid command set from the peer: command group length \d+ differs/],
      [2195, CFindRequest.createStudyFindRequest({ PatientID: 'SYNTHETIC-1001' }), (message) => {
        const command = responseTo(message, Status.Pending, datasets[0]).getCommandDataset().getDenaturalizedCommandDataset();
        const identifier = Buffer.from([0x10, 0x00, 0x10, 0x00, 0xf0, 0xff, 0xff, 0xff, 0x41, 0x42]);
        message.socket.write(
          encodePDataTf([
            { contextId: message.contextId, isCommand: true, isLast: true, value: command },
            { contextId: message.contextId, isCommand: false, isLast: true, value: identifier },
          ])
        );
        return [];
      }, /Invalid data set from the peer: element \(0010,0010\) of length 4294967280 runs past/],
    ];
    let pending = cases.length;
    cases.forEach(([port, request, respond, problem]) => {
      expectNotTaken(port, request, respond, problem, () => {
        pending -= 1;
        if (pending === 0) {
          done();
        }
      });
    });
  }));
});

describe('Network sending only queries whose text is in their declared character set', () => {
  beforeAll(() => {
    log.setLevel('error');
  });

  function findOnPeer(port, elements, onClosed) {
    const peer = startPeer(port, { respond: answerRequests });
    const request = CFindRequest.createStudyFindRequest(elements);
    const events = [];
    request.on('notSent', (reason) => events.push(reason));
    request.on('done', () => events.push('done'));
    runClient(port, request, {}, (outcome) => peer.afterClientEnded(() => {
      peer.close();
      onClosed(peer, events, outcome);
    }));
  }

  it('should not send a C-FIND whose text is outside the default repertoire without ISO_IR 192', withDone((done) => {
    findOnPeer(2196, { PatientName: 'Šťastná*' }, (peer, events, outcome) => {
      expect(events).to.deep.equal([NotSentReason.CharacterSetMismatch, 'done']);
      expect(peer.messages).to.have.length(0);
      expect(outcome.networkError).to.be.undefined;
      done();
    });
  }));

  it('should not send a C-FIND whose text is outside its VR repertoire or in a sequence item without ISO_IR 192', withDone((done) => {
    const queries = [
      [2197, { SpecificCharacterSet: 'ISO_IR 100', PatientName: 'Šťastná*' }],
      [2198, { SpecificCharacterSet: 'ISO_IR 192', ModalitiesInStudy: 'XČ' }],
      [2199, { ProcedureCodeSequence: [{ CodeMeaning: 'Ošetření' }] }],
    ];
    let pending = queries.length;
    queries.forEach(([port, elements]) => {
      findOnPeer(port, elements, (peer, events) => {
        expect(events).to.deep.equal([NotSentReason.CharacterSetMismatch, 'done']);
        expect(peer.messages).to.have.length(0);
        pending -= 1;
        if (pending === 0) {
          done();
        }
      });
    });
  }));

  it('should send a C-FIND with ISO_IR 192 whose text the peer reads as it was written', withDone((done) => {
    findOnPeer(2200, { SpecificCharacterSet: 'ISO_IR 192', PatientName: 'Šťastná^Jana*' }, (peer, events, outcome) => {
      expect(events).to.deep.equal(['done']);
      expect(outcome.networkError).to.be.undefined;
      expect(peer.messages).to.have.length(1);
      expect(peer.messages[0].dataset.getElement('PatientName')[0].Alphabetic).to.be.eq('Šťastná^Jana*');
      expect(peer.messages[0].datasetBytes.includes(Buffer.from('Šťastná', 'utf8'))).to.be.true;
      done();
    });
  }));

  it('should send a C-FIND of the default repertoire without a declared character set', withDone((done) => {
    findOnPeer(2201, { PatientName: 'NOVAK*', PatientID: 'SYNTHETIC-1001' }, (peer, events) => {
      expect(events).to.deep.equal(['done']);
      expect(peer.messages).to.have.length(1);
      done();
    });
  }));
});

describe('Network ending an association and every request in it', () => {
  beforeAll(() => {
    log.setLevel('error');
  });

  const ReleaseRequestPdu = Buffer.from([0x05, 0, 0, 0, 0, 4, 0, 0, 0, 0]);
  const AbortPdu = Buffer.from([PduType.Abort, 0, 0, 0, 0, 4, 0, 0, AbortSource.ServiceUser, 0]);

  function endEvents(request) {
    const seen = [];
    request.on('notSent', (reason) => seen.push(reason));
    request.on('done', () => seen.push('done'));
    return seen;
  }

  function storeRequest(pixelBytes) {
    return new CStoreRequest(
      storedDataset(
        {
          _vrMap: { PixelData: 'OB' },
          SOPClassUID: StorageClass.SecondaryCaptureImageStorage,
          SOPInstanceUID: Dataset.generateDerivedUid(),
          PatientID: 'SYNTHETIC-0011',
          PixelData: [crypto.randomBytes(pixelBytes).buffer],
        },
        TransferSyntax.ExplicitVRLittleEndian
      )
    );
  }

  it('should end as released after its own release request (PS3.8 AR-3)', withDone((done) => {
    const peer = startPeer(2202, { respond: answerRequests });
    const request = new CEchoRequest();
    const seen = endEvents(request);
    runClient(2202, request, {}, (outcome) => peer.afterClientEnded(() => {
      peer.close();
      expect(outcome.end).to.deep.equal({ outcome: AssociationOutcome.Released });
      expect(seen).to.deep.equal(['done']);
      done();
    }));
  }));

  it('should end as rejected and end every request as not sent', withDone((done) => {
    const reject = [RejectResult.Permanent, RejectSource.ServiceUser, RejectReason.NoReasonGiven];
    const peer = startPeer(2203, { accept: () => ({ reject }) });
    const requests = [new CEchoRequest(), CFindRequest.createStudyFindRequest({ PatientID: 'SYNTHETIC-1001' })];
    const seen = requests.map(endEvents);
    runClient(2203, requests, {}, (outcome) => peer.afterClientEnded(() => {
      peer.close();
      expect(outcome.end).to.deep.equal({ outcome: AssociationOutcome.Rejected });
      expect(seen).to.deep.equal([
        [NotSentReason.AssociationEnded, 'done'],
        [NotSentReason.AssociationEnded, 'done'],
      ]);
      done();
    }));
  }));

  it('should end as aborted by the peer and end the sent request without a response and the next one as not sent', withDone((done) => {
    const peer = startPeer(2204, {
      respond: (message) => {
        message.socket.write(AbortPdu);
        return [];
      },
    });
    const requests = [new CEchoRequest(), new CEchoRequest()];
    const seen = requests.map(endEvents);
    runClient(2204, requests, {}, (outcome) => peer.afterClientEnded(() => {
      peer.close();
      expect(outcome.end).to.deep.equal({ outcome: AssociationOutcome.AbortedByPeer });
      expect(outcome.statuses).to.deep.equal([]);
      expect(seen).to.deep.equal([['done'], [NotSentReason.AssociationEnded, 'done']]);
      expect(requests[0].getCommandBytesSent()).to.be.greaterThan(0);
      expect(requests[1].getCommandBytesSent()).to.be.eq(0);
      done();
    }));
  }));

  it('should end as aborted locally with the kind of the timeout that ended it', withDone((done) => {
    const peer = startPeer(2205, { respond: () => [] });
    runClient(2205, new CEchoRequest(), { dimseTimeout: 200 }, (outcome) => peer.afterClientEnded(() => {
      peer.close();
      expect(outcome.end).to.deep.equal({ outcome: AssociationOutcome.AbortedLocally, timeout: TimeoutKind.Dimse });
      done();
    }));
  }));

  it('should end as aborted locally when the user aborts', withDone((done) => {
    const peer = startPeer(2206, { respond: answerRequests });
    const client = new Client();
    const request = new CEchoRequest();
    const seen = endEvents(request);
    client.addRequest(request);
    client.on('associationAccepted', () => client.abort(AbortSource.ServiceUser, AbortReason.NotSpecified));
    client.on('closed', (end) => peer.afterClientEnded(() => {
      peer.close();
      expect(end).to.deep.equal({ outcome: AssociationOutcome.AbortedLocally });
      expect(seen).to.deep.equal([NotSentReason.AssociationEnded, 'done']);
      done();
    }));
    client.send('127.0.0.1', 2206, 'CALLINGAET', 'CALLEDAET', clientOptions());
  }));

  it('should end as aborted locally when the user aborts before the association request', withDone((done) => {
    const peer = startPeer(2213, { respond: answerRequests });
    const client = new Client();
    const request = new CEchoRequest();
    const seen = endEvents(request);
    client.addRequest(request);
    client.on('connected', () => client.abort());
    client.on('closed', (end) => {
      peer.close();
      expect(end).to.deep.equal({ outcome: AssociationOutcome.AbortedLocally });
      expect(peer.request).to.be.undefined;
      expect(seen).to.deep.equal([NotSentReason.AssociationEnded, 'done']);
      done();
    });
    client.send('127.0.0.1', 2213, 'CALLINGAET', 'CALLEDAET', clientOptions());
  }));

  it('should end as not connected when the connection is refused, and end the request as not sent', withDone((done) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => {
        const request = new CEchoRequest();
        const seen = endEvents(request);
        runClient(port, request, {}, (outcome) => {
          expect(outcome.end).to.deep.equal({ outcome: AssociationOutcome.NotConnected });
          expect(seen).to.deep.equal([NotSentReason.AssociationEnded, 'done']);
          done();
        });
      });
    });
  }));

  it('should end as connect timeout when the connection is not established in time', withDone((done) => {
    const socket = new events.EventEmitter();
    socket.connecting = true;
    socket.destroyed = false;
    socket.writableEnded = false;
    socket.destroy = () => {
      socket.destroyed = true;
      socket.emit('close');
    };
    const network = new Network(socket, { connectTimeout: 100 });
    network.on('networkError', () => undefined);
    network.on('close', (end) => {
      expect(end).to.deep.equal({ outcome: AssociationOutcome.ConnectTimeout, timeout: TimeoutKind.Connect });
      done();
    });
  }));

  function quietSocket(connecting) {
    const socket = new events.EventEmitter();
    socket.connecting = connecting;
    socket.destroyed = false;
    socket.writableEnded = false;
    socket.writableLength = 0;
    socket.write = (bytes, onWritten) => {
      onWritten();
      return true;
    };
    socket.end = () => {
      socket.writableEnded = true;
    };
    socket.destroy = () => {
      socket.destroyed = true;
      socket.emit('close');
    };
    return socket;
  }

  it('should end as aborted locally once it sends an A-ABORT, before the connection closes', () => {
    const socket = quietSocket(false);
    const network = new Network(socket, {});
    const association = new Association('CALLINGAET', 'CALLEDAET');
    association.setImplementationClassUid(TestImplementationClassUid);
    association.addPresentationContextFromRequest(new CEchoRequest(), [TransferSyntax.ImplicitVRLittleEndian]);
    network.sendAssociationRequest(association);

    network.sendAbort(AbortSource.ServiceUser, AbortReason.NotSpecified);
    const end = network.getAssociationOutcome();
    socket.destroy();

    expect(end).to.deep.equal({ outcome: AssociationOutcome.AbortedLocally });
  });

  it('should end as not connected when the connection closes before it was established', withDone((done) => {
    const socket = quietSocket(true);
    const network = new Network(socket, {});
    network.on('close', (end) => {
      expect(end).to.deep.equal({ outcome: AssociationOutcome.NotConnected });
      done();
    });
    socket.emit('close');
  }));

  it('should end as a socket error on a reset after the request', withDone((done) => {
    const peer = startPeer(2207, {
      respond: (message) => {
        message.socket.resetAndDestroy();
        return [];
      },
    });
    const request = new CEchoRequest();
    const seen = endEvents(request);
    runClient(2207, request, {}, (outcome) => {
      peer.close();
      expect(outcome.end).to.deep.equal({ outcome: AssociationOutcome.SocketError });
      expect(seen).to.deep.equal(['done']);
      done();
    });
  }));

  it('should end as closed unexpectedly when the peer closes the connection without release or abort', withDone((done) => {
    const peer = startPeer(2208, {
      respond: (message) => {
        message.socket.end();
        return [];
      },
    });
    const request = new CEchoRequest();
    const seen = endEvents(request);
    runClient(2208, request, {}, (outcome) => peer.afterClientEnded(() => {
      peer.close();
      expect(outcome.end).to.deep.equal({ outcome: AssociationOutcome.ClosedUnexpectedly });
      expect(outcome.networkError).to.be.undefined;
      expect(seen).to.deep.equal(['done']);
      done();
    }));
  }));

  it('should answer a release request of the peer and end as released by the peer (PS3.8 AR-2, AR-4)', withDone((done) => {
    const peer = startPeer(2209, {
      respond: (message) => {
        answerRequests(message).forEach((response) =>
          message.socket.write(messagePdu(message.contextId, message.transferSyntaxUid, response))
        );
        message.socket.write(ReleaseRequestPdu);
        return [];
      },
    });
    const requests = [new CEchoRequest(), new CEchoRequest()];
    const seen = requests.map(endEvents);
    runClient(2209, requests, { associationLingerTimeout: 1000 }, (outcome) => peer.afterClientEnded(() => {
      peer.close();
      expect(outcome.end).to.deep.equal({ outcome: AssociationOutcome.ReleasedByPeer });
      expect(outcome.networkError).to.be.undefined;
      expect(peer.releaseResponses).to.be.eq(1);
      expect(peer.aborts).to.deep.equal([]);
      expect(outcome.statuses[0]).to.be.eq(Status.Success);
      expect(seen[0]).to.deep.equal(['done']);
      done();
    }));
  }));

  it('should answer a release request of the peer that collides with its own and wait for the release response (PS3.8 AR-8, AR-9)', withDone((done) => {
    const peer = startPeer(2210, {
      respond: answerRequests,
      release: (socket) => socket.write(ReleaseRequestPdu),
      releaseResponded: (socket) => {
        socket.write(encodeReleaseResponse());
        socket.end();
      },
    });
    runClient(2210, new CEchoRequest(), {}, (outcome) => peer.afterClientEnded(() => {
      peer.close();
      expect(outcome.end).to.deep.equal({ outcome: AssociationOutcome.Released });
      expect(outcome.networkError).to.be.undefined;
      expect(peer.releaseResponses).to.be.eq(1);
      done();
    }));
  }));

  it('should count the command and dataset bytes handed to the operating system', withDone((done) => {
    const peer = startPeer(2211, { respond: answerRequests });
    const request = storeRequest(100 * 1024);
    const stored = request.getDataset().getStoredDataset().length;
    runClient(2211, request, {}, (outcome) => peer.afterClientEnded(() => {
      peer.close();
      expect(outcome.statuses).to.deep.equal([Status.Success]);
      expect(request.getDatasetBytesSent()).to.be.eq(stored);
      expect(request.getCommandBytesSent()).to.be.eq(peer.messages[0].commandBytes.length);
      const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
      expect(request.getSentDatasetSha256()).to.be.eq(sha256(request.getDataset().getStoredDataset()));
      expect(request.getSentDatasetSha256()).to.be.eq(sha256(peer.messages[0].datasetBytes));
      done();
    }));
  }));

  it('should end a C-STORE whose dataset left only in part without a response and not as not sent', withDone((done) => {
    let aborted = false;
    const peer = startPeer(2212, {
      onData: (socket) => {
        if (aborted) {
          return;
        }
        aborted = true;
        // The peer stops reading, so that the rest of the dataset stays with the client, and aborts
        socket.pause();
        socket.write(AbortPdu);
      },
    });
    const request = storeRequest(8 * 1024 * 1024);
    const stored = request.getDataset().getStoredDataset().length;
    const seen = endEvents(request);
    runClient(2212, request, {}, (outcome) => {
      peer.close();
      expect(outcome.end).to.deep.equal({ outcome: AssociationOutcome.AbortedByPeer });
      expect(seen).to.deep.equal(['done']);
      expect(request.getDatasetBytesSent()).to.be.greaterThan(0);
      expect(request.getDatasetBytesSent()).to.be.lessThan(stored);
      const sent = request.getDataset().getStoredDataset().subarray(0, request.getDatasetBytesSent());
      expect(request.getSentDatasetSha256()).to.be.eq(crypto.createHash('sha256').update(sent).digest('hex'));
      done();
    });
  }));

  it('should have no SHA-256 of sent dataset bytes before any was sent and for a request without a dataset', withDone((done) => {
    const peer = startPeer(2224, { respond: answerRequests });
    const echo = new CEchoRequest();
    const store = storeRequest(1024);

    expect(store.getSentDatasetSha256()).to.be.undefined;
    runClient(2224, echo, {}, (outcome) => peer.afterClientEnded(() => {
      peer.close();
      expect(outcome.statuses).to.deep.equal([Status.Success]);
      expect(echo.getCommandBytesSent()).to.be.greaterThan(0);
      expect(echo.getSentDatasetSha256()).to.be.undefined;
      done();
    }));
  }));
});

describe('Network as the association requestor in the SCU role only', () => {
  it('should abort the association when the peer sends a DIMSE request', withDone((done) => {
    const peer = startPeer(2147, {
      respond: () => {
        const peerRequest = new CEchoRequest();
        peerRequest.setMessageId(1);
        return [peerRequest];
      },
    });

    runClient(2147, new CEchoRequest(), {}, (outcome) => peer.afterClientEnded(() => {
      peer.close();
      expect(outcome.statuses).to.deep.equal([]);
      expect(outcome.networkError.message).to.match(/Unexpected DIMSE message from the peer: C-ECHO RQ/);
      expect(peer.aborts).to.deep.equal([{ source: AbortSource.ServiceUser, reason: AbortReason.NotSpecified }]);
      done();
    }));
  }));

  it('should abort the association on a response of a service the client does not use', withDone((done) => {
    const peer = startPeer(2148, {
      respond: (message) => {
        const response = new Response(
          CommandFieldType.CMoveResponse,
          SopClass.StudyRootQueryRetrieveInformationModelMove,
          false,
          Status.Success
        );
        response.setMessageIdBeingRespondedTo(message.command.getCommandDataset().getElement('MessageID'));
        return [response];
      },
    });

    runClient(2148, new CEchoRequest(), {}, (outcome) => peer.afterClientEnded(() => {
      peer.close();
      expect(outcome.statuses).to.deep.equal([]);
      expect(outcome.networkError.message).to.match(/Unexpected DIMSE message from the peer: C-MOVE RSP/);
      expect(peer.aborts).to.deep.equal([{ source: AbortSource.ServiceUser, reason: AbortReason.NotSpecified }]);
      done();
    }));
  }));

  it('should abort the association on an A-ASSOCIATE-RQ from the peer', withDone((done) => {
    const received = [];
    const peer = startPeer(2149, {
      onData: (socket, data) => {
        received.push(data);
        if (received.length === 1) {
          const request = new Association('CALLINGAET', 'CALLEDAET');
          request.setImplementationClassUid(TestImplementationClassUid);
          socket.write(new AAssociateRQ(request).write().writePdu());
        }
      },
    });

    runClient(2149, new CEchoRequest(), {}, (outcome) => peer.afterClientEnded(() => {
      peer.close();
      expect(outcome.networkError.message).to.match(/Unexpected A-ASSOCIATE-RQ from the peer/);
      expect(abortOf(Buffer.concat(received))).to.deep.equal({
        source: AbortSource.ServiceProvider,
        reason: AbortReason.UnexpectedPdu,
      });
      done();
    }));
  }));
});

describe('Network limits and timeouts', () => {
  function fakeSocket(connecting) {
    const socket = new events.EventEmitter();
    socket.connecting = connecting;
    socket.destroyed = false;
    socket.writableEnded = false;
    socket.write = () => true;
    socket.destroy = () => {
      socket.destroyed = true;
      socket.emit('close');
    };
    return socket;
  }

  function storedImage(pixelBytes) {
    return storedDataset(
      {
        _vrMap: { PixelData: 'OB' },
        SOPClassUID: StorageClass.SecondaryCaptureImageStorage,
        SOPInstanceUID: Dataset.generateDerivedUid(),
        PatientID: 'SYNTHETIC-0007',
        PixelData: [crypto.randomBytes(pixelBytes).buffer],
      },
      TransferSyntax.ExplicitVRLittleEndian
    );
  }

  it('should use 30 s connect, ACSE and DIMSE timeouts and a 60 s idle timeout by default', () => {
    expect(Network.timeoutsFromOptions({})).to.deep.equal({
      [TimeoutKind.Connect]: 30000,
      [TimeoutKind.Acse]: 30000,
      [TimeoutKind.Dimse]: 30000,
      [TimeoutKind.Idle]: 60000,
    });
  });

  it('should refuse invalid timeouts and maximum PDU lengths before connecting', () => {
    const invalidOptions = [
      [{ connectTimeout: 0 }, /connectTimeout option must be/],
      [{ acseTimeout: -1 }, /acseTimeout option must be/],
      [{ dimseTimeout: NaN }, /dimseTimeout option must be/],
      [{ idleTimeout: '100' }, /idleTimeout option must be/],
      [{ idleTimeout: 2147483648 }, /idleTimeout option must be/],
      [{ associationTimeout: 100 }, /associationTimeout option was replaced/],
      [{ pduTimeout: 100 }, /pduTimeout option was replaced/],
      [{ maxPduLength: 6 }, /maxPduLength option must be/],
      [{ maxPduLength: 0 }, /maxPduLength option must be/],
      [{ maxPduLength: 1.5 }, /maxPduLength option must be/],
      [{ maxPduLength: 0x100000000 }, /maxPduLength option must be/],
      [{ maxReceivedMessageLength: 0 }, /maxReceivedMessageLength option must be/],
      [{ maxReceivedMessageLength: 1.5 }, /maxReceivedMessageLength option must be/],
      [{ maxReceivedMessageLength: '1024' }, /maxReceivedMessageLength option must be/],
      [{ maxReceivedMessageLength: 0x100000000 }, /maxReceivedMessageLength option must be/],
    ];
    invalidOptions.forEach(([opts, message]) => {
      const client = new Client();
      client.addRequest(new CEchoRequest());
      expect(() => client.send('127.0.0.1', 2131, 'CALLINGAET', 'CALLEDAET', clientOptions(opts))).to.throw(message);
    });
  });

  it('should drop the connection attempt on the connect timeout', withDone((done) => {
    const socket = fakeSocket(true);
    const network = new Network(socket, { connectTimeout: 100 });
    let networkError = undefined;
    network.on('networkError', (e) => {
      networkError = e;
    });
    network.on('close', () => {
      expect(networkError.timeout).to.be.eq(TimeoutKind.Connect);
      expect(socket.destroyed).to.be.true;
      done();
    });
  }));

  it('should stop the connect timeout once connected', () => {
    vi.useFakeTimers();
    try {
      const socket = fakeSocket(true);
      const network = new Network(socket, { connectTimeout: 100 });
      let networkError = undefined;
      network.on('networkError', (e) => {
        networkError = e;
      });
      vi.advanceTimersByTime(20);
      socket.emit('connect');
      vi.advanceTimersByTime(300);
      expect(networkError).to.be.undefined;
      socket.destroy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('should abort the association on the ACSE timeout while waiting for the release response', withDone((done) => {
    const peer = startPeer(2132, { respond: answerRequests, release: false });

    runClient(2132, new CEchoRequest(), { acseTimeout: 300 }, (outcome) => {
      peer.close();
      expect(outcome.statuses).to.deep.equal([Status.Success]);
      expect(outcome.networkError.timeout).to.be.eq(TimeoutKind.Acse);
      done();
    });
  }));

  it('should abort the association on the DIMSE timeout', withDone((done) => {
    const peer = startPeer(2133, { respond: () => [] });

    runClient(2133, new CEchoRequest(), { dimseTimeout: 300 }, (outcome) => {
      peer.close();
      expect(outcome.statuses).to.deep.equal([]);
      expect(outcome.networkError.timeout).to.be.eq(TimeoutKind.Dimse);
      done();
    });
  }));

  it('should restart the DIMSE timeout on every pending response', withDone((done) => {
    const PendingResponses = 4;
    const PendingInterval = 150;
    const FirstMessageId = 1;
    const FindPcId = 1;
    const findResponsePdu = (status) => {
      const response = new CFindResponse(status);
      response.setMessageIdBeingRespondedTo(FirstMessageId);
      if (status === Status.Pending) {
        response.setDataset(new Dataset({ PatientID: 'SYNTHETIC-0008' }));
      }
      return messagePdu(FindPcId, TransferSyntax.ImplicitVRLittleEndian, response);
    };
    let received = Buffer.alloc(0);
    let requested = false;
    const peer = startPeer(2134, {
      // The request may come in more than one chunk; it is whole with the last fragment of its dataset
      onData: (socket, data) => {
        received = Buffer.concat([received, data]);
        const pdus = pdusOf(received);
        if (pdus.some((pdu) => pdu.type === PduType.ReleaseRq)) {
          socket.end();
          return;
        }
        const isRequestWhole = pdus
          .filter((pdu) => pdu.type === PduType.PDataTf)
          .some((pdu) => pdvsOf(pdu).some((pdv) => !pdv.isCommand && pdv.isLast));
        if (requested || !isRequestWhole) {
          return;
        }
        requested = true;
        let sent = 0;
        const timer = setInterval(() => {
          sent += 1;
          if (sent > PendingResponses) {
            clearInterval(timer);
            socket.write(findResponsePdu(Status.Success));
            return;
          }
          socket.write(findResponsePdu(Status.Pending));
        }, PendingInterval);
      },
    });

    const request = CFindRequest.createStudyFindRequest({ PatientID: 'SYNTHETIC-0008' });
    runClient(2134, request, { dimseTimeout: 400 }, (outcome) => {
      peer.close();
      expect(outcome.networkError).to.be.undefined;
      expect(outcome.statuses).to.deep.equal([
        ...Array(PendingResponses).fill(Status.Pending),
        Status.Success,
      ]);
      done();
    });
  }));

  it('should abort an idle association on the idle timeout', withDone((done) => {
    const peer = startPeer(2135, { respond: answerRequests });

    runClient(
      2135,
      new CEchoRequest(),
      { idleTimeout: 200, associationLingerTimeout: 1000 },
      (outcome) => {
        peer.close();
        expect(outcome.statuses).to.deep.equal([Status.Success]);
        expect(outcome.networkError.timeout).to.be.eq(TimeoutKind.Idle);
        done();
      }
    );
  }));

  it('should abort a stalled send on the idle timeout, not on the DIMSE timeout', withDone((done) => {
    const peer = startPeer(2136, { afterAccept: (socket) => socket.pause() });

    const request = new CStoreRequest(storedImage(24 * 1024 * 1024));
    runClient(2136, request, { idleTimeout: 300, dimseTimeout: 120000 }, (outcome) => {
      peer.close();
      expect(outcome.networkError.timeout).to.be.eq(TimeoutKind.Idle);
      done();
    });
  }), 20000);

  it('should not let a peer that stopped reading keep a stalled send alive by trickling bytes', withDone((done) => {
    const TrickleInterval = 100;
    let trickle = undefined;
    const peer = startPeer(2145, {
      afterAccept: (socket) => {
        socket.pause();
        const header = Buffer.alloc(6);
        header[0] = PduType.PDataTf;
        header.writeUInt32BE(1000, 2);
        socket.write(header);
        trickle = setInterval(() => socket.write(Buffer.alloc(1)), TrickleInterval);
      },
    });

    const request = new CStoreRequest(storedImage(24 * 1024 * 1024));
    runClient(2145, request, { idleTimeout: 3 * TrickleInterval, dimseTimeout: 120000 }, (outcome) => {
      clearInterval(trickle);
      peer.close();
      expect(outcome.networkError.timeout).to.be.eq(TimeoutKind.Idle);
      done();
    });
  }), 20000);

  it('should keep a slow send alive and start the DIMSE timeout once the last fragment is handed to the system', withDone((done) => {
    // Linux leaves the sender to a slow reader up to a second without progress; the idle timeout outlasts that
    // and the slow reading outlasts the idle timeout, so that only progress keeps the send alive
    const IdleTimeout = 3000;
    const DimseTimeout = 1000;
    const SlowReadingPeriod = 6000;
    const ReadPause = 30;
    let receivedBytes = 0;
    let firstDataAt = undefined;
    const peer = startPeer(2144, {
      onData: (socket, data) => {
        firstDataAt = firstDataAt || Date.now();
        receivedBytes += data.length;
        // Slow at first, so that only a DIMSE timeout started too early fires while the data is still coming
        if (Date.now() - firstDataAt < SlowReadingPeriod) {
          socket.pause();
          setTimeout(() => socket.resume(), ReadPause);
        }
      },
    });

    const request = new CStoreRequest(storedImage(32 * 1024 * 1024));
    const datasetBytes = request.getDataset().getStoredDataset().length;
    runClient(2144, request, { idleTimeout: IdleTimeout, dimseTimeout: DimseTimeout }, (outcome) => {
      peer.close();
      expect(outcome.networkError.timeout).to.be.eq(TimeoutKind.Dimse);
      expect(receivedBytes).to.be.greaterThan(datasetBytes);
      expect(Date.now() - firstDataAt).to.be.greaterThan(SlowReadingPeriod + DimseTimeout);
      done();
    });
  }), 30000);

  it('should split the command and the dataset into even fragments within the peer maximum PDU length', withDone((done) => {
    const PeerMaxPduLength = 51;
    const received = [];
    const peer = startPeer(2137, {
      maxPduLength: PeerMaxPduLength,
      onData: (socket, data) => received.push(data),
    });

    const request = new CStoreRequest(storedImage(1000));
    runClient(2137, request, { dimseTimeout: 300 }, () => {
      peer.close();
      const pDataTfs = pdusOf(Buffer.concat(received)).filter((pdu) => pdu.type === PduType.PDataTf);
      const pdvs = pDataTfs.map((pdu) => pdvsOf(pdu));
      const command = pdvs.flat().filter((pdv) => pdv.isCommand);
      const dataset = pdvs.flat().filter((pdv) => !pdv.isCommand);

      expect(pDataTfs.every((pdu) => pdu.value.length <= PeerMaxPduLength)).to.be.true;
      expect(pdvs.every((items) => items.length === 1)).to.be.true;
      expect(pdvs.flat().every((pdv) => pdv.valueLength % 2 === 0)).to.be.true;
      expect(command.length).to.be.greaterThan(1);
      expect(command.map((pdv) => pdv.isLast)).to.deep.equal([...Array(command.length - 1).fill(false), true]);
      expect(dataset.map((pdv) => pdv.isLast)).to.deep.equal([...Array(dataset.length - 1).fill(false), true]);
      expect(dataset.reduce((sum, pdv) => sum + pdv.valueLength, 0)).to.be.eq(
        request.getDataset().getStoredDataset().length
      );
      done();
    });
  }));

  it('should announce 16384 and keep sending within it when the peer announces no limit', withDone((done) => {
    const received = [];
    let announced = undefined;
    const peer = startPeer(2138, {
      maxPduLength: 0,
      requested: (request) => {
        announced = request.maxPduLength;
      },
      onData: (socket, data) => received.push(data),
    });

    runClient(2138, new CStoreRequest(storedImage(100 * 1024)), { dimseTimeout: 300 }, () => {
      peer.close();
      const lengths = pdusOf(Buffer.concat(received))
        .filter((pdu) => pdu.type === PduType.PDataTf)
        .map((pdu) => pdu.value.length);
      expect(announced).to.be.eq(16384);
      expect(Math.max(...lengths)).to.be.eq(16384);
      done();
    });
  }));

  it('should abort an association whose peer maximum PDU length cannot carry any PDV', withDone((done) => {
    const received = [];
    const peer = startPeer(2139, {
      maxPduLength: 6,
      onData: (socket, data) => received.push(data),
    });

    runClient(2139, new CEchoRequest(), {}, (outcome) => peer.afterClientEnded(() => {
      peer.close();
      const bytes = Buffer.concat(received);
      expect(outcome.networkError.message).to.match(/peer maximum PDU length 6 cannot carry any PDV/);
      expect(pdusOf(bytes).some((pdu) => pdu.type === PduType.PDataTf)).to.be.false;
      expect(abortOf(bytes)).to.deep.equal({
        source: AbortSource.ServiceProvider,
        reason: AbortReason.InvalidPduParameter,
      });
      done();
    }));
  }));

  it('should refuse an oversized P-DATA-TF PDU from its header, before allocating it', withDone((done) => {
    const DeclaredLength = 16385;
    const allocations = vi.spyOn(Buffer, 'allocUnsafe');
    const received = [];
    const peer = startPeer(2140, {
      onData: (socket, data) => {
        received.push(data);
        if (received.length === 1) {
          const header = Buffer.alloc(6);
          header[0] = PduType.PDataTf;
          header.writeUInt32BE(DeclaredLength, 2);
          socket.write(header);
        }
      },
    });

    runClient(2140, new CEchoRequest(), {}, (outcome) => peer.afterClientEnded(() => {
      peer.close();
      const allocatedSizes = allocations.mock.calls.map(([size]) => size);
      allocations.mockRestore();
      expect(outcome.networkError.message).to.match(/PDU length 16385 \[type: 4\] exceeds the maximum 16384/);
      expect(allocatedSizes).not.to.include(6 + DeclaredLength);
      expect(abortOf(Buffer.concat(received))).to.deep.equal({
        source: AbortSource.ServiceProvider,
        reason: AbortReason.InvalidPduParameter,
      });
      done();
    }));
  }));

  it('should announce the maximum PDU length option and refuse a received P-DATA-TF PDU over it', withDone((done) => {
    let announced = undefined;
    let answered = false;
    const peer = startPeer(2141, {
      requested: (request) => {
        announced = request.maxPduLength;
      },
      onData: (socket) => {
        if (!answered) {
          answered = true;
          const header = Buffer.alloc(6);
          header[0] = PduType.PDataTf;
          header.writeUInt32BE(4097, 2);
          socket.write(header);
        }
      },
    });

    runClient(2141, new CEchoRequest(), { maxPduLength: 4096 }, (outcome) => {
      peer.close();
      expect(announced).to.be.eq(4096);
      expect(outcome.networkError.message).to.match(/PDU length 4097 \[type: 4\] exceeds the maximum 4096/);
      done();
    });
  }));

  it('should refuse an oversized A-ASSOCIATE-AC PDU', withDone((done) => {
    const received = [];
    const peer = startPeer(2142, {
      accept: () => {
        const header = Buffer.alloc(6);
        header[0] = PduType.AssociateAc;
        header.writeUInt32BE(16385, 2);
        return header;
      },
      onData: (socket, data) => received.push(data),
    });

    runClient(2142, new CEchoRequest(), {}, (outcome) => peer.afterClientEnded(() => {
      peer.close();
      expect(outcome.networkError.message).to.match(/PDU length 16385 \[type: 2\] exceeds the maximum 16384/);
      expect(abortOf(Buffer.concat(received))).to.deep.equal({
        source: AbortSource.ServiceProvider,
        reason: AbortReason.InvalidPduParameter,
      });
      done();
    }));
  }));

  it('should abort on an unknown PDU type and read nothing after it', withDone((done) => {
    const received = [];
    const peer = startPeer(2143, {
      onData: (socket, data) => {
        received.push(data);
        if (received.length === 1) {
          const unknown = Buffer.from([PduType.Undefined, 0, 0, 0, 0, 4, 0, 0, 0, 0]);
          const abort = Buffer.from([PduType.Abort, 0, 0, 0, 0, 4, 0, 0, AbortSource.ServiceUser, 0]);
          socket.write(Buffer.concat([unknown, abort]));
        }
      },
    });

    runClient(2143, new CEchoRequest(), {}, (outcome) => peer.afterClientEnded(() => {
      peer.close();
      expect(outcome.networkError.message).to.match(/Unknown PDU type: 10/);
      expect(outcome.aborts).to.be.eq(0);
      expect(abortOf(Buffer.concat(received))).to.deep.equal({
        source: AbortSource.ServiceProvider,
        reason: AbortReason.UnrecognizedPdu,
      });
      done();
    }));
  }));
});

describe('Network negotiating presentation contexts without requests', () => {
  function context(abstractSyntaxUid, transferSyntaxUids) {
    const proposed = new PresentationContext(1, abstractSyntaxUid);
    transferSyntaxUids.forEach((transferSyntaxUid) => proposed.addTransferSyntaxUid(transferSyntaxUid));
    return proposed;
  }

  it('should only negotiate the additional presentation contexts and release the association', withDone((done) => {
    const peer = startPeer(2215, {
      accept: (request, response) => {
        response.presentationContexts[1].result = PresentationContextResult.RejectAbstractSyntaxNotSupported;
      },
    });
    const client = new Client();
    client.addAdditionalPresentationContext(context(SopClass.Verification, [TransferSyntax.ImplicitVRLittleEndian]));
    client.addAdditionalPresentationContext(
      context(StorageClass.SecondaryCaptureImageStorage, [TransferSyntax.JpegBaseline, TransferSyntax.ExplicitVRLittleEndian]),
      true
    );
    let accepted = undefined;
    let networkError = undefined;
    // The transfer syntax that comes with a result other than acceptance is not significant (PS3.8 9.3.3.2)
    client.on('associationAccepted', (association) => {
      accepted = association.getPresentationContexts().map(({ id, context: negotiated }) => ({
        id,
        result: negotiated.getResult(),
        ...(negotiated.getResult() === PresentationContextResult.Accept
          ? { transferSyntaxUid: negotiated.getAcceptedTransferSyntaxUid() }
          : {}),
      }));
    });
    client.on('networkError', (e) => {
      networkError = e;
    });
    client.on('closed', (end) => peer.afterClientEnded(() => {
      peer.close();
      expect(networkError).to.be.undefined;
      expect(peer.proposed).to.deep.equal([
        { id: 1, abstractSyntaxUid: SopClass.Verification, transferSyntaxUids: [TransferSyntax.ImplicitVRLittleEndian] },
        {
          id: 3,
          abstractSyntaxUid: StorageClass.SecondaryCaptureImageStorage,
          transferSyntaxUids: [TransferSyntax.JpegBaseline, TransferSyntax.ExplicitVRLittleEndian],
        },
      ]);
      expect(accepted).to.deep.equal([
        { id: 1, result: PresentationContextResult.Accept, transferSyntaxUid: TransferSyntax.ImplicitVRLittleEndian },
        { id: 3, result: PresentationContextResult.RejectAbstractSyntaxNotSupported },
      ]);
      expect(peer.messages).to.deep.equal([]);
      expect(peer.releaseRequested).to.be.true;
      expect(end).to.deep.equal({ outcome: AssociationOutcome.Released });
      done();
    }));
    client.send('127.0.0.1', 2215, 'CALLINGAET', 'CALLEDAET', clientOptions());
  }));

  it('should refuse to connect without requests and presentation contexts or with a context without a transfer syntax', () => {
    const empty = new Client();
    const withoutSyntax = new Client();
    withoutSyntax.addAdditionalPresentationContext(context(SopClass.Verification, []));

    expect(() => empty.send('127.0.0.1', 2216, 'CALLINGAET', 'CALLEDAET', clientOptions())).to.throw(
      /There are no requests to perform and no presentation contexts to propose/
    );
    expect(() => withoutSyntax.send('127.0.0.1', 2216, 'CALLINGAET', 'CALLEDAET', clientOptions())).to.throw(
      /presentation context of 1\.2\.840\.10008\.1\.1 has no transfer syntax to propose/
    );
    expect(empty.network).to.be.undefined;
    expect(withoutSyntax.network).to.be.undefined;
  });

  it('should propose at most 128 presentation contexts, whose IDs one byte carries (PS3.8 9.3.2.2)', () => {
    const contexts = (count) => {
      const client = new Client();
      Array.from({ length: count }).forEach(() =>
        client.addAdditionalPresentationContext(context(SopClass.Verification, [TransferSyntax.ImplicitVRLittleEndian]), true)
      );
      return client;
    };
    const tooMany = contexts(129);
    const association = new Association('CALLINGAET', 'CALLEDAET');
    const ids = Array.from({ length: 128 }).map(() => association.addPresentationContext(SopClass.Verification));

    expect(ids[0]).to.equal(1);
    expect(ids[127]).to.equal(255);
    expect(() => association.addPresentationContext(SopClass.Verification)).to.throw(
      /No more than 128 presentation contexts can be proposed/
    );
    expect(() => tooMany.send('127.0.0.1', 2216, 'CALLINGAET', 'CALLEDAET', clientOptions())).to.throw(
      /No more than 128 presentation contexts can be proposed/
    );
    expect(tooMany.network).to.be.undefined;
  });
});

describe('Network pausing the reading of responses', () => {
  const PendingCount = 10;
  const PausedAfter = 3;
  const PauseMs = 400;
  const ShortDimseTimeoutMs = 150;
  // Far more than the socket buffers, so that the peer is held while the client does not read
  const FloodBytes = 32 * 1024 * 1024;

  function pendingPdu(message) {
    return messagePdu(message.contextId, message.transferSyntaxUid, responseTo(message, Status.Pending, datasets[0]));
  }

  it('should stop reading between PDUs while paused, without its DIMSE timeout', withDone((done) => {
    const peer = startPeer(2217, {
      respond: (message) => {
        const pdus = Array.from({ length: PendingCount }).map(() => pendingPdu(message));
        pdus.push(messagePdu(message.contextId, message.transferSyntaxUid, responseTo(message, Status.Success)));
        message.socket.write(Buffer.concat(pdus));
        return [];
      },
    });
    const client = new Client();
    const request = CFindRequest.createStudyFindRequest({ PatientID: 'SYNTHETIC-1001' });
    const statuses = [];
    let whilePaused = undefined;
    let networkError = undefined;
    request.on('response', (response) => {
      statuses.push(response.getStatus());
      if (statuses.length === PausedAfter) {
        client.pauseReceiving();
        setTimeout(() => {
          whilePaused = statuses.length;
          client.resumeReceiving();
        }, PauseMs);
      }
    });
    client.addRequest(request);
    client.on('networkError', (e) => {
      networkError = e;
    });
    client.on('closed', (end) => peer.afterClientEnded(() => {
      peer.close();
      expect(networkError).to.be.undefined;
      expect(whilePaused).to.equal(PausedAfter);
      expect(statuses).to.deep.equal([...Array(PendingCount).fill(Status.Pending), Status.Success]);
      expect(end).to.deep.equal({ outcome: AssociationOutcome.Released });
      done();
    }));
    client.send('127.0.0.1', 2217, 'CALLINGAET', 'CALLEDAET', clientOptions({ dimseTimeout: ShortDimseTimeoutMs }));
  }));

  it('should hold the peer by the TCP window while paused', withDone((done) => {
    let peerSocket = undefined;
    const peer = startPeer(2218, {
      respond: (message) => {
        peerSocket = message.socket;
        const pdu = pendingPdu(message);
        message.socket.write(Buffer.concat(Array(Math.ceil(FloodBytes / pdu.length)).fill(pdu)));
        return [];
      },
    });
    const client = new Client();
    const request = CFindRequest.createStudyFindRequest({ PatientID: 'SYNTHETIC-1001' });
    let unsent = undefined;
    request.once('response', () => {
      client.pauseReceiving();
      setTimeout(() => {
        unsent = peerSocket.writableLength;
        client.abort(AbortSource.ServiceUser, AbortReason.NotSpecified);
      }, PauseMs);
    });
    client.addRequest(request);
    client.on('closed', () => {
      peer.close();
      expect(unsent).to.be.greaterThan(0);
      done();
    });
    client.send('127.0.0.1', 2218, 'CALLINGAET', 'CALLEDAET', clientOptions());
  }));

  it('should read what came while paused after the rest of the interrupted data', withDone((done) => {
    const FirstWrite = 5;
    const SecondWriteDelayMs = 100;
    const peer = startPeer(2219, {
      respond: (message) => {
        const first = Array.from({ length: FirstWrite }).map(() => pendingPdu(message));
        message.socket.write(Buffer.concat(first));
        setTimeout(() => {
          const second = Array.from({ length: PendingCount - FirstWrite }).map(() => pendingPdu(message));
          second.push(messagePdu(message.contextId, message.transferSyntaxUid, responseTo(message, Status.Success)));
          message.socket.write(Buffer.concat(second), () => {
            secondWrittenAt = performance.now();
          });
        }, SecondWriteDelayMs);
        return [];
      },
    });
    const client = new Client();
    const request = CFindRequest.createStudyFindRequest({ PatientID: 'SYNTHETIC-1001' });
    const statuses = [];
    let networkError = undefined;
    let secondWrittenAt = undefined;
    let pausedAt = undefined;
    let resumedAt = undefined;
    request.on('response', (response) => {
      statuses.push(response.getStatus());
      if (statuses.length === 2) {
        client.pauseReceiving();
        pausedAt = performance.now();
        setTimeout(() => {
          resumedAt = performance.now();
          client.resumeReceiving();
        }, PauseMs);
      }
    });
    client.addRequest(request);
    client.on('networkError', (e) => {
      networkError = e;
    });
    client.on('closed', () => peer.afterClientEnded(() => {
      peer.close();
      expect(networkError).to.be.undefined;
      expect(secondWrittenAt).to.be.greaterThan(pausedAt);
      expect(secondWrittenAt).to.be.lessThan(resumedAt);
      expect(statuses).to.deep.equal([...Array(PendingCount).fill(Status.Pending), Status.Success]);
      done();
    }));
    client.send('127.0.0.1', 2219, 'CALLINGAET', 'CALLEDAET', clientOptions());
  }));

  it('should run the DIMSE timeout again once resumed', withDone((done) => {
    const peer = startPeer(2220, {
      respond: (message) => {
        message.socket.write(Buffer.concat([pendingPdu(message), pendingPdu(message), pendingPdu(message)]));
        return [];
      },
    });
    const client = new Client();
    const request = CFindRequest.createStudyFindRequest({ PatientID: 'SYNTHETIC-1001' });
    let received = 0;
    let resumedAt = undefined;
    let networkError = undefined;
    let erroredAt = undefined;
    request.on('response', () => {
      received += 1;
      if (received === 3) {
        client.pauseReceiving();
        setTimeout(() => {
          resumedAt = Date.now();
          client.resumeReceiving();
        }, PauseMs);
      }
    });
    client.addRequest(request);
    client.on('networkError', (e) => {
      networkError = e;
      erroredAt = Date.now();
    });
    client.on('closed', () => peer.afterClientEnded(() => {
      peer.close();
      expect(networkError.timeout).to.equal(TimeoutKind.Dimse);
      expect(erroredAt).to.be.at.least(resumedAt);
      done();
    }));
    client.send('127.0.0.1', 2220, 'CALLINGAET', 'CALLEDAET', clientOptions({ dimseTimeout: ShortDimseTimeoutMs }));
  }));

  it('should not run the DIMSE timeout after a pause on the final response', withDone((done) => {
    const LingerMs = 600;
    const peer = startPeer(2221, {
      respond: (message) => [responseTo(message, Status.Pending, datasets[0]), responseTo(message, Status.Success)],
    });
    const client = new Client();
    const request = CFindRequest.createStudyFindRequest({ PatientID: 'SYNTHETIC-1001' });
    let networkError = undefined;
    request.on('response', (response) => {
      if (response.getStatus() === Status.Success) {
        client.pauseReceiving();
        setTimeout(() => client.resumeReceiving(), PauseMs);
      }
    });
    client.addRequest(request);
    client.on('networkError', (e) => {
      networkError = e;
    });
    client.on('closed', (end) => peer.afterClientEnded(() => {
      peer.close();
      expect(networkError).to.be.undefined;
      expect(end).to.deep.equal({ outcome: AssociationOutcome.Released });
      done();
    }));
    client.send(
      '127.0.0.1',
      2221,
      'CALLINGAET',
      'CALLEDAET',
      clientOptions({ dimseTimeout: ShortDimseTimeoutMs, associationLingerTimeout: LingerMs })
    );
  }));

  it('should hold the DIMSE timeout of a request sent while paused', withDone((done) => {
    const peer = startPeer(2222, { respond: answerRequests });
    const client = new Client();
    const first = CFindRequest.createStudyFindRequest({ PatientID: 'SYNTHETIC-1001' });
    const second = CFindRequest.createStudyFindRequest({ PatientID: 'SYNTHETIC-1002' });
    const statuses = [];
    let networkError = undefined;
    first.on('response', (response) => {
      statuses.push(response.getStatus());
      if (response.getStatus() === Status.Success) {
        client.pauseReceiving();
        setTimeout(() => client.resumeReceiving(), PauseMs);
      }
    });
    second.on('response', (response) => statuses.push(response.getStatus()));
    client.addRequest(first);
    client.addRequest(second);
    client.on('networkError', (e) => {
      networkError = e;
    });
    client.on('closed', () => peer.afterClientEnded(() => {
      peer.close();
      expect(networkError).to.be.undefined;
      expect(statuses).to.deep.equal([Status.Pending, Status.Success, Status.Pending, Status.Success]);
      done();
    }));
    client.send('127.0.0.1', 2222, 'CALLINGAET', 'CALLEDAET', clientOptions({ dimseTimeout: ShortDimseTimeoutMs }));
  }));

  it('should switch to the idle timeout on a final response in the PDU it paused in', withDone((done) => {
    const LingerMs = 600;
    const peer = startPeer(2223, {
      respond: (message) => {
        message.socket.write(
          encodePDataTf([
            ...messagePdvs(message.contextId, message.transferSyntaxUid, responseTo(message, Status.Pending, datasets[0])),
            ...messagePdvs(message.contextId, message.transferSyntaxUid, responseTo(message, Status.Success)),
          ])
        );
        return [];
      },
    });
    const client = new Client();
    const request = CFindRequest.createStudyFindRequest({ PatientID: 'SYNTHETIC-1001' });
    const statuses = [];
    let networkError = undefined;
    request.on('response', (response) => {
      statuses.push(response.getStatus());
      if (response.getStatus() === Status.Pending) {
        client.pauseReceiving();
        setTimeout(() => client.resumeReceiving(), PauseMs);
      }
    });
    client.addRequest(request);
    client.on('networkError', (e) => {
      networkError = e;
    });
    client.on('closed', (end) => peer.afterClientEnded(() => {
      peer.close();
      expect(networkError).to.be.undefined;
      expect(statuses).to.deep.equal([Status.Pending, Status.Success]);
      expect(end).to.deep.equal({ outcome: AssociationOutcome.Released });
      done();
    }));
    client.send(
      '127.0.0.1',
      2223,
      'CALLINGAET',
      'CALLEDAET',
      clientOptions({ dimseTimeout: ShortDimseTimeoutMs, associationLingerTimeout: LingerMs })
    );
  }));

  it('should keep data received while paused after the unread rest, even from a socket that does not pause', () => {
    const socket = new events.EventEmitter();
    socket.connecting = false;
    socket.destroyed = false;
    socket.writableEnded = false;
    socket.pause = () => undefined;
    socket.resume = () => undefined;
    const network = new Network(socket, {});
    socket.emit('connect');
    const pdu = (marker) => Buffer.concat([Buffer.from([PduType.PDataTf, 0, 0, 0, 0, 4]), Buffer.from(marker.repeat(4))]);
    const [a, b, c, d] = ['a', 'b', 'c', 'd'].map(pdu);
    const read = [];
    network.pduAccumulator.removeAllListeners('pdu');
    network.pduAccumulator.on('pdu', (bytes) => {
      const marker = bytes.subarray(6, 7).toString();
      read.push(marker);
      if (marker === 'a' || marker === 'b') {
        network.pauseReceiving();
      }
    });

    socket.emit('data', Buffer.concat([a, b.subarray(0, 5)]));
    socket.emit('data', Buffer.concat([b.subarray(5), c]));
    socket.emit('data', d);
    expect(read).to.deep.equal(['a']);
    network.resumeReceiving();
    expect(read).to.deep.equal(['a', 'b']);
    network.resumeReceiving();
    expect(read).to.deep.equal(['a', 'b', 'c', 'd']);
  });

  it('should do nothing before the connection is made', () => {
    const client = new Client();

    expect(() => client.pauseReceiving()).to.not.throw();
    expect(() => client.resumeReceiving()).to.not.throw();
  });
});

describe('Network proposing the transfer syntaxes of C-ECHO and C-FIND', () => {
  it('should propose the given transfer syntaxes in their order, and Implicit and Explicit VR Little Endian by default', withDone((done) => {
    const peer = startPeer(2225, { respond: answerRequests });
    const proposedBy = (options, onProposed) => {
      runClient(2225, [new CEchoRequest(), CFindRequest.createStudyFindRequest({ PatientID: 'SYNTHETIC-1001' })], options, () => {
        const proposed = peer.proposed.splice(0);
        onProposed(proposed.map(({ transferSyntaxUids }) => transferSyntaxUids));
      });
    };

    proposedBy({ queryTransferSyntaxes: [TransferSyntax.ImplicitVRLittleEndian] }, (implicitOnly) => {
      proposedBy({ queryTransferSyntaxes: [TransferSyntax.ExplicitVRLittleEndian, TransferSyntax.ImplicitVRLittleEndian] }, (both) => {
        proposedBy({}, (defaults) => {
          peer.close();
          expect(implicitOnly).to.deep.equal([[TransferSyntax.ImplicitVRLittleEndian], [TransferSyntax.ImplicitVRLittleEndian]]);
          expect(both).to.deep.equal([
            [TransferSyntax.ExplicitVRLittleEndian, TransferSyntax.ImplicitVRLittleEndian],
            [TransferSyntax.ExplicitVRLittleEndian, TransferSyntax.ImplicitVRLittleEndian],
          ]);
          expect(defaults).to.deep.equal([
            [TransferSyntax.ImplicitVRLittleEndian, TransferSyntax.ExplicitVRLittleEndian],
            [TransferSyntax.ImplicitVRLittleEndian, TransferSyntax.ExplicitVRLittleEndian],
          ]);
          done();
        });
      });
    });
  }));

  it('should keep one context for each variant of a C-STORE, whatever the transfer syntaxes of the queries', withDone((done) => {
    const peer = startPeer(2226, { respond: answerRequests });
    const store = new CStoreRequest(
      storedDataset(
        { SOPClassUID: StorageClass.SecondaryCaptureImageStorage, SOPInstanceUID: Dataset.generateDerivedUid() },
        TransferSyntax.ExplicitVRLittleEndian
      )
    );
    runClient(2226, store, { queryTransferSyntaxes: [TransferSyntax.ImplicitVRLittleEndian] }, (outcome) => peer.afterClientEnded(() => {
      peer.close();
      expect(outcome.statuses).to.deep.equal([Status.Success]);
      expect(peer.proposed.map(({ transferSyntaxUids }) => transferSyntaxUids)).to.deep.equal([[TransferSyntax.ExplicitVRLittleEndian]]);
      done();
    }));
  }));

  it('should refuse transfer syntaxes that are not a non-empty list of distinct UIDs before connecting', () => {
    const invalid = [[], ['1.2.840.10008.1.2', '1.2.840.10008.1.2'], ['not a uid'], [`1.${'2'.repeat(64)}`], '1.2'];
    invalid.forEach((queryTransferSyntaxes) => {
      const client = new Client();
      client.addRequest(new CEchoRequest());
      expect(() => client.send('127.0.0.1', 2227, 'CALLINGAET', 'CALLEDAET', clientOptions({ queryTransferSyntaxes }))).to.throw(
        /queryTransferSyntaxes option must be a non-empty list of distinct UIDs/
      );
      expect(client.network).to.be.undefined;
    });
  });
});

describe('Network keeping the protocol machine of PS3.8 9.2.3 on a socket that is driven by the test', () => {
  const ReleaseRequest = encodePdu(0x05, Buffer.alloc(4));
  const PduTypeOf = { ReleaseRp: 0x06, Abort: 0x07, PDataTf: 0x04 };
  const LongTimeoutMs = 60000;

  beforeAll(() => {
    log.setLevel('error');
  });

  function drivenSocket({ drains = true, connected = true } = {}) {
    const socket = new events.EventEmitter();
    socket.connecting = !connected;
    socket.destroyed = false;
    socket.writableEnded = false;
    socket.writableLength = 0;
    socket.written = [];
    socket.write = (bytes, onWritten) => {
      socket.written.push(Buffer.from(bytes));
      onWritten();
      return drains;
    };
    socket.end = () => {
      socket.writableEnded = true;
    };
    socket.destroy = () => {
      socket.destroyed = true;
      socket.emit('close');
    };
    socket.pause = () => undefined;
    socket.resume = () => undefined;
    return socket;
  }

  function associated(socket, request, opts) {
    const network = new Network(socket, { idleTimeout: LongTimeoutMs, dimseTimeout: LongTimeoutMs, ...opts });
    socket.emit('connect');
    const association = new Association('CALLINGAET', 'CALLEDAET');
    association.setImplementationClassUid(TestImplementationClassUid);
    association.addPresentationContextFromRequest(request, [TransferSyntax.ImplicitVRLittleEndian]);
    network.on('networkError', () => undefined);
    network.sendAssociationRequest(association);
    socket.emit(
      'data',
      encodeAssociateAccept({
        calledAeTitle: 'CALLEDAET',
        callingAeTitle: 'CALLINGAET',
        presentationContexts: [
          { id: 1, result: PresentationContextResult.Accept, transferSyntax: TransferSyntax.ImplicitVRLittleEndian },
        ],
        maxPduLength: 16384,
        implementationClassUid: TestImplementationClassUid,
      })
    );
    return network;
  }

  const typesOf = (socket) => socket.written.map((bytes) => bytes.readUInt8(0));

  it('should answer a release request of the peer while a send waits for the socket to drain, and send nothing after (AR-4)', () => {
    const socket = drivenSocket({ drains: false });
    const network = associated(socket, new CEchoRequest());
    network.sendRequests([new CEchoRequest()]);
    socket.emit('data', ReleaseRequest);
    socket.emit('drain');

    expect(typesOf(socket).slice(1)).to.deep.equal([PduTypeOf.ReleaseRp]);
    expect(network.getAssociationOutcome()).to.deep.equal({ outcome: AssociationOutcome.ReleasedByPeer });
  });

  it('should take only the release response of the peer after answering its release request in a collision (Sta11)', () => {
    const socket = drivenSocket();
    const request = new CEchoRequest();
    const network = associated(socket, request);
    network.sendAssociationReleaseRequest();
    socket.emit('data', ReleaseRequest);
    socket.emit('data', ReleaseRequest);

    expect(typesOf(socket).slice(1)).to.deep.equal([0x05, PduTypeOf.ReleaseRp, PduTypeOf.Abort]);
    expect(network.getAssociationOutcome()).to.deep.equal({ outcome: AssociationOutcome.AbortedLocally });
  });

  it('should send no A-ABORT once the association has ended', () => {
    const socket = drivenSocket();
    const network = associated(socket, new CEchoRequest());
    socket.emit('data', encodePdu(0x07, Buffer.from([0, 0, 2, 0])));
    const written = socket.written.length;
    network.sendAbort(AbortSource.ServiceUser, AbortReason.NotSpecified);

    expect(socket.written).to.have.length(written);
    expect(network.getAssociationOutcome()).to.deep.equal({ outcome: AssociationOutcome.AbortedByPeer });
  });

  it('should not pause before the connection is made and keep the ACSE timeout running while paused', () => {
    vi.useFakeTimers();
    try {
      const connecting = drivenSocket({ connected: false });
      const beforeConnect = new Network(connecting, { connectTimeout: 100 });
      beforeConnect.on('networkError', () => undefined);
      beforeConnect.pauseReceiving();
      vi.advanceTimersByTime(100);
      expect(beforeConnect.getAssociationOutcome()).to.deep.equal({
        outcome: AssociationOutcome.ConnectTimeout,
        timeout: TimeoutKind.Connect,
      });

      const socket = drivenSocket();
      const network = associated(socket, new CEchoRequest(), { acseTimeout: 100 });
      network.sendAssociationReleaseRequest();
      network.pauseReceiving();
      vi.advanceTimersByTime(100);
      expect(network.getAssociationOutcome()).to.deep.equal({
        outcome: AssociationOutcome.AbortedLocally,
        timeout: TimeoutKind.Acse,
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('should abort on a pending C-FIND response without an identifier (PS3.4 C.4.1.1.3.2)', () => {
    const socket = drivenSocket();
    const request = CFindRequest.createStudyFindRequest({ PatientID: 'SYNTHETIC-1001' });
    const network = associated(socket, request);
    const statuses = [];
    request.on('response', (response) => statuses.push(response.getStatus()));
    network.sendRequests([request]);
    socket.emit(
      'data',
      encodePDataTf([
        { contextId: 1, isCommand: true, isLast: true, value: commandBytesOf(responseTo({ command: request }, Status.Pending)) },
      ])
    );

    expect(statuses).to.deep.equal([]);
    expect(typesOf(socket).at(-1)).to.be.eq(PduTypeOf.Abort);
  });

  it('should send no C-CANCEL for a C-FIND that has ended, and one on its own context otherwise (PS3.7 9.3.2.3)', () => {
    const socket = drivenSocket();
    const request = CFindRequest.createStudyFindRequest({ PatientID: 'SYNTHETIC-1001' });
    const network = associated(socket, request);
    network.sendRequests([request]);
    const beforeCancel = socket.written.length;
    network.sendCancel(request);
    const cancel = socket.written.slice(beforeCancel);
    socket.emit(
      'data',
      encodePDataTf([
        { contextId: 1, isCommand: true, isLast: true, value: commandBytesOf(responseTo({ command: request }, Status.Cancel)) },
      ])
    );
    const afterEnd = socket.written.length;
    network.sendCancel(request);

    expect(cancel.map((bytes) => [bytes.readUInt8(0), bytes.readUInt8(10)])).to.deep.equal([[PduTypeOf.PDataTf, 1]]);
    expect(socket.written).to.have.length(afterEnd);
  });

  it('should leave the transfer syntax of a C-FIND identifier as it was when its text refuses it', () => {
    const socket = drivenSocket();
    const request = CFindRequest.createStudyFindRequest({ PatientName: 'Šťastná*' });
    const dataset = request.getDataset();
    dataset.setTransferSyntaxUid(TransferSyntax.ExplicitVRLittleEndian);
    const network = associated(socket, request);
    const notSent = [];
    request.on('notSent', (reason) => notSent.push(reason));
    network.sendRequests([request]);

    expect(notSent).to.deep.equal([NotSentReason.CharacterSetMismatch]);
    expect(dataset.getTransferSyntaxUid()).to.be.eq(TransferSyntax.ExplicitVRLittleEndian);
  });

  it('should abort a PDU it cannot allocate as the service provider', () => {
    const socket = drivenSocket();
    const network = associated(socket, new CEchoRequest());
    const received = encodePdu(0x04, Buffer.alloc(8));
    const pduLength = received.length;
    const allocate = Buffer.allocUnsafe;
    const allocation = vi.spyOn(Buffer, 'allocUnsafe').mockImplementation((size) => {
      if (size === pduLength) {
        throw new RangeError('Array buffer allocation failed');
      }
      return allocate(size);
    });
    try {
      socket.emit('data', received);
    } finally {
      allocation.mockRestore();
    }

    expect(typesOf(socket).at(-1)).to.be.eq(PduTypeOf.Abort);
    expect(network.getAssociationOutcome()).to.deep.equal({ outcome: AssociationOutcome.AbortedLocally });
  });

  it('should refuse timeouts that are not whole milliseconds and requests added after sending', () => {
    for (const value of [0.5, 1.5, 0, -1]) {
      expect(() => Network.timeoutsFromOptions({ dimseTimeout: value })).to.throw(/integer number of milliseconds/);
    }
    const client = new Client();
    client.addRequest(new CEchoRequest());
    client.on('networkError', () => undefined);
    client.send('127.0.0.1', 1, 'CALLINGAET', 'CALLEDAET', clientOptions({ connectTimeout: 1 }));
    expect(() => client.addRequest(new CEchoRequest())).to.throw(/requests were sent already/);
  });

  it('should stop between the messages of one P-DATA-TF while paused and take the rest once resumed (PS3.8 9.3.5)', () => {
    const socket = drivenSocket();
    const request = CFindRequest.createStudyFindRequest({ PatientID: 'SYNTHETIC-1001' });
    const network = associated(socket, request);
    const statuses = [];
    request.on('response', (response) => {
      statuses.push(response.getStatus());
      if (statuses.length === 1) {
        network.pauseReceiving();
      }
    });
    network.sendRequests([request]);
    const implicit = TransferSyntax.ImplicitVRLittleEndian;
    socket.emit(
      'data',
      encodePDataTf([
        ...messagePdvs(1, implicit, responseTo({ command: request }, Status.Pending, datasets[0])),
        ...messagePdvs(1, implicit, responseTo({ command: request }, Status.Pending, datasets[0])),
        ...messagePdvs(1, implicit, responseTo({ command: request }, Status.Success)),
      ])
    );

    expect(statuses).to.deep.equal([Status.Pending]);
    network.resumeReceiving();
    expect(statuses).to.deep.equal([Status.Pending, Status.Pending, Status.Success]);
  });

  it('should take nothing of the P-DATA-TF it paused in once the association has ended', () => {
    const socket = drivenSocket();
    const request = CFindRequest.createStudyFindRequest({ PatientID: 'SYNTHETIC-1001' });
    const network = associated(socket, request);
    const statuses = [];
    request.on('response', (response) => {
      statuses.push(response.getStatus());
      network.pauseReceiving();
    });
    network.sendRequests([request]);
    const implicit = TransferSyntax.ImplicitVRLittleEndian;
    socket.emit(
      'data',
      encodePDataTf([
        ...messagePdvs(1, implicit, responseTo({ command: request }, Status.Pending, datasets[0])),
        ...messagePdvs(1, implicit, responseTo({ command: request }, Status.Success)),
      ])
    );
    network.sendAbort(AbortSource.ServiceUser, AbortReason.NotSpecified);
    network.resumeReceiving();

    expect(statuses).to.deep.equal([Status.Pending]);
  });

  function commandBytesOf(command) {
    return command.getCommandDataset().getDenaturalizedCommandDataset();
  }
});
