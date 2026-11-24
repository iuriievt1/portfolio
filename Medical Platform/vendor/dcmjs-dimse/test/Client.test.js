const { AbortReason, AbortSource, CommandFieldType, NotSentReason, SopClass, StorageClass, TransferSyntax } = require('./../src/Constants');
const { CCancelRequest, CEchoRequest, CFindRequest, CStoreRequest, Request } = require('./../src/Command');
const Client = require('./../src/Client');
const Dataset = require('./../src/Dataset');
const { storedDataset } = require('./support');


describe('Client', () => {
  it('should throw for invalid requests and presentation contexts', () => {
    expect(() => {
      const client = new Client();
      client.addRequest('invalid request');
    }).to.throw();

    expect(() => {
      const client = new Client();
      client.addAdditionalPresentationContext('invalid presentation contexts');
    }).to.throw();

    expect(() => {
      const client = new Client();
      client.send('127.0.0.1', 11112, 'SCU', 'SCP');
    }).to.throw();
  });

  it('should accept only C-ECHO, C-FIND and C-STORE requests', () => {
    const client = new Client();

    expect(() => client.addRequest(new CEchoRequest())).to.not.throw();
    expect(() => client.addRequest(new CFindRequest())).to.not.throw();
    expect(() =>
      client.addRequest(new Request(CommandFieldType.NActionRequest, SopClass.StorageCommitmentPushModel, true))
    ).to.throw(/is not a C-ECHO, C-FIND or C-STORE request/);
    expect(() =>
      client.addRequest(new CCancelRequest(SopClass.StudyRootQueryRetrieveInformationModelFind, 1))
    ).to.throw(/is not a C-ECHO, C-FIND or C-STORE request/);
  });

  it('should refuse TLS before connecting', () => {
    const client = new Client();
    client.addRequest(new CEchoRequest());

    expect(() => client.send('127.0.0.1', 11112, 'SCU', 'SCP', { securityOptions: {} })).to.throw(
      /securityOptions option is refused/
    );
    expect(client.network).to.be.undefined;
  });

  it('should throw for invalid cancellation and abortion', () => {
    expect(() => {
      const client = new Client();
      client.abort(AbortSource.ServiceUser, AbortReason.NoReasonGiven);
    }).to.throw();

    expect(() => {
      const client = new Client();
      client.cancel(CFindRequest.createStudyFindRequest());
    }).to.throw();
  });

  function endedEvents(request, commandBytes, datasetBytes) {
    const seen = [];
    request.on('notSent', (reason) => seen.push(reason));
    request.on('done', () => seen.push('done'));
    request.countSentBytes(true, Buffer.alloc(commandBytes));
    request.countSentBytes(false, Buffer.alloc(datasetBytes));
    new Client()._endUnfinishedRequest(request);
    return seen;
  }

  it('should end a request the association ended as not sent only when nothing of it left (integrace-dicom.md 6.2, 8.2)', () => {
    const store = () =>
      new CStoreRequest(
        storedDataset(
          { SOPClassUID: StorageClass.SecondaryCaptureImageStorage, SOPInstanceUID: Dataset.generateDerivedUid() },
          TransferSyntax.ExplicitVRLittleEndian
        )
      );

    // A C-STORE whose command left but no byte of its dataset did is not sent
    expect(endedEvents(store(), 100, 0)).to.deep.equal([NotSentReason.AssociationEnded, 'done']);
    expect(endedEvents(store(), 100, 1)).to.deep.equal(['done']);
    expect(endedEvents(new CEchoRequest(), 0, 0)).to.deep.equal([NotSentReason.AssociationEnded, 'done']);
    expect(endedEvents(new CEchoRequest(), 2, 0)).to.deep.equal(['done']);
  });
});
