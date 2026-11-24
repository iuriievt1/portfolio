const { Association } = require('./../src/Association');
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
} = require('../src/Pdu');
const {
  PresentationContextResult,
  RawPduType,
  SopClass,
  StorageClass,
  TransferSyntax,
  UserIdentityType,
} = require('./../src/Constants');
const {
  acceptItems,
  ApplicationContextName,
  decodeAssociateRequest,
  encodeAssociateAccept,
  encodeAssociateReject,
  item,
  ItemType,
  maximumLengthSubItem,
  pdu: encodePdu,
  PduType,
} = require('./acceptor-codec');
const { TestImplementationClassUid, TestImplementationVersion } = require('./support');


describe('PDU', () => {
  it('should write an A-ASSOCIATE-RQ PDU that the acceptor reads, with no role selection', () => {
    const maxPdu = 1024;
    const association = new Association('CALLINGAET', 'CALLEDAET');
    association.setImplementationClassUid(TestImplementationClassUid);
    association.setImplementationVersion(TestImplementationVersion);
    association.setMaxPduLength(maxPdu);
    association.setNegotiateAsyncOps(true);
    association.setMaxAsyncOpsInvoked(3);
    association.setMaxAsyncOpsPerformed(4);
    association.setNegotiateUserIdentity(true);
    association.setUserIdentityType(UserIdentityType.Saml);
    association.setUserIdentityPositiveResponseRequested(true);
    association.setUserIdentityPrimaryField('SYNTHETIC');
    association.setUserIdentitySecondaryField('SECRET');
    const pcId = association.addPresentationContext(SopClass.Verification);
    association.addTransferSyntaxToPresentationContext(pcId, TransferSyntax.ImplicitVRLittleEndian);

    const request = decodeAssociateRequest(new AAssociateRQ(association).write().writePdu());

    expect(request).to.deep.equal({
      protocolVersion: 1,
      calledAeTitle: 'CALLEDAET',
      callingAeTitle: 'CALLINGAET',
      applicationContext: '1.2.840.10008.3.1.1.1',
      presentationContexts: [
        { id: pcId, abstractSyntax: SopClass.Verification, transferSyntaxes: [TransferSyntax.ImplicitVRLittleEndian] },
      ],
      maxPduLength: maxPdu,
      implementationClassUid: TestImplementationClassUid,
      implementationVersionName: TestImplementationVersion,
      asynchronousOperations: { invoked: 3, performed: 4 },
      roleSelections: [],
      userIdentity: {
        type: UserIdentityType.Saml,
        positiveResponseRequested: true,
        primaryField: 'SYNTHETIC',
        secondaryField: 'SECRET',
      },
    });
  });

  it('should refuse to write an A-ASSOCIATE-RQ PDU without an implementation class UID', () => {
    const association = new Association('CALLINGAET', 'CALLEDAET');
    association.addPresentationContext(SopClass.Verification);

    expect(() => new AAssociateRQ(association).write()).to.throw(/carries the implementation class UID/);
  });

  it('should read an A-ASSOCIATE-AC PDU and keep the default roles over a role selection it did not propose', () => {
    const association = new Association('CALLINGAET', 'CALLEDAET');
    association.setImplementationClassUid(TestImplementationClassUid);
    const pcId = association.addPresentationContext(SopClass.Verification);
    association.addTransferSyntaxToPresentationContext(pcId, TransferSyntax.ImplicitVRLittleEndian);
    const roleSelection = Buffer.concat([
      Buffer.from([0, SopClass.Verification.length]),
      Buffer.from(SopClass.Verification, 'latin1'),
      Buffer.from([0, 1]),
    ]);

    const raw = new RawPdu(
      encodeAssociateAccept({
        calledAeTitle: 'CALLEDAET',
        callingAeTitle: 'CALLINGAET',
        presentationContexts: [
          { id: pcId, result: PresentationContextResult.Accept, transferSyntax: TransferSyntax.ImplicitVRLittleEndian },
        ],
        maxPduLength: 16378,
        implementationClassUid: '2.25.1',
        implementationVersionName: 'PEER',
        asynchronousOperations: { invoked: 3, performed: 4 },
        roleSelections: [roleSelection],
        userIdentityServerResponse: 'ALLOWED',
      })
    );
    raw.readPdu();
    new AAssociateAC(association).read(raw);

    const context = association.getPresentationContext(pcId);
    expect(association.getPeerMaxPduLength()).to.be.eq(16378);
    expect(association.getImplementationClassUid()).to.be.eq(TestImplementationClassUid);
    expect(association.getImplementationVersion()).to.be.undefined;
    expect(association.getPeerImplementationClassUid()).to.be.eq('2.25.1');
    expect(association.getPeerImplementationVersion()).to.be.eq('PEER');
    expect(association.getNegotiateAsyncOps()).to.be.true;
    expect(association.getMaxAsyncOpsInvoked()).to.be.eq(3);
    expect(association.getMaxAsyncOpsPerformed()).to.be.eq(4);
    expect(association.getNegotiateUserIdentityServerResponse()).to.be.true;
    expect(association.getUserIdentityServerResponse()).to.be.eq('ALLOWED');
    expect(context.getResult()).to.be.eq(PresentationContextResult.Accept);
    expect(context.getAcceptedTransferSyntaxUid()).to.be.eq(TransferSyntax.ImplicitVRLittleEndian);
  });

  it('should ignore answers in an A-ASSOCIATE-AC PDU that do not match the proposed presentation contexts', () => {
    const sopClassUid = StorageClass.SecondaryCaptureImageStorage;
    const requester = new Association('CALLINGAET', 'CALLEDAET');
    [
      TransferSyntax.JpegBaseline,
      TransferSyntax.ExplicitVRLittleEndian,
      TransferSyntax.ImplicitVRLittleEndian,
    ].forEach((syntax) => {
      const pcId = requester.addPresentationContext(sopClassUid);
      requester.addTransferSyntaxToPresentationContext(pcId, syntax);
    });

    const accept = PresentationContextResult.Accept;
    const raw = new RawPdu(
      encodeAssociateAccept({
        calledAeTitle: 'CALLEDAET',
        callingAeTitle: 'CALLINGAET',
        presentationContexts: [
          // Accepted with a transfer syntax that was not proposed for the context
          { id: 1, result: accept, transferSyntax: TransferSyntax.ExplicitVRLittleEndian },
          { id: 3, result: accept, transferSyntax: TransferSyntax.ExplicitVRLittleEndian },
          { id: 5, result: accept, transferSyntax: TransferSyntax.ImplicitVRLittleEndian },
          // A context that was not proposed
          { id: 7, result: accept, transferSyntax: TransferSyntax.ImplicitVRLittleEndian },
          // A second answer for the same context
          { id: 5, result: PresentationContextResult.RejectUser, transferSyntax: TransferSyntax.ImplicitVRLittleEndian },
        ],
        maxPduLength: 16384,
        implementationClassUid: '2.25.1',
      })
    );
    raw.readPdu();

    new AAssociateAC(requester).read(raw);

    const [jpeg, explicit, implicit] = requester.getPresentationContexts().map((pc) => pc.context);
    expect(requester.getPresentationContexts()).to.have.length(3);
    expect(jpeg.getResult()).to.be.eq(PresentationContextResult.Proposed);
    expect(jpeg.getTransferSyntaxUids()).to.deep.equal([TransferSyntax.JpegBaseline]);
    expect(explicit.getResult()).to.be.eq(PresentationContextResult.Accept);
    expect(explicit.getAcceptedTransferSyntaxUid()).to.be.eq(TransferSyntax.ExplicitVRLittleEndian);
    expect(implicit.getResult()).to.be.eq(PresentationContextResult.Accept);
    expect(implicit.getAcceptedTransferSyntaxUid()).to.be.eq(TransferSyntax.ImplicitVRLittleEndian);
  });

  it('should read an A-ASSOCIATE-RJ PDU', () => {
    const raw = new RawPdu(encodeAssociateReject(1, 2, 3));
    raw.readPdu();

    const reject = new AAssociateRJ();
    reject.read(raw);

    expect(reject.getResult()).to.be.eq(1);
    expect(reject.getSource()).to.be.eq(2);
    expect(reject.getReason()).to.be.eq(3);
    expect(reject.toString()).to.be.a('string');
  });

  it('should correctly write and read an A-ABORT PDU', () => {
    const abort1 = new AAbort(5, 4);
    const pdu = abort1.write();

    const abort2 = new AAbort();
    abort2.read(pdu);

    expect(abort1.getSource()).to.be.eq(abort2.getSource());
    expect(abort1.getReason()).to.be.eq(abort2.getReason());
  });

  it('should correctly write and read a PDV', () => {
    const pcId = 2;
    const data = Buffer.from([3, 4, 5, 6, 7]);
    const command = false;
    const last = true;

    const pdu = new RawPdu(RawPduType.AAssociateRQ);
    const pdv1 = new Pdv(pcId, data, command, last);
    pdv1.write(pdu);

    const pdv2 = new Pdv();
    pdv2.read(pdu);

    expect(pcId).to.be.eq(pdv2.getPresentationContextId());
    expect(data).to.be.deep.eq(pdv2.getValue());
    expect(command).to.be.eq(pdv2.isCommand());
    expect(last).to.be.eq(pdv2.isLastFragment());
    expect(pdu.toString()).to.be.a('string');
  });

  it('should correctly write and read a P-DATA-TF PDU', () => {
    const pcId = 2;
    const data1 = Buffer.from([3, 4, 5, 6, 7]);
    const command1 = false;
    const last1 = true;
    const data2 = Buffer.from([7, 6, 5, 4, 3]);
    const command2 = true;
    const last2 = false;

    const pdv1 = new Pdv(pcId, data1, command1, last1);
    const pdv2 = new Pdv(pcId, data2, command2, last2);

    const pDataTF1 = new PDataTF();
    pDataTF1.addPdv(pdv1);
    pDataTF1.addPdv(pdv2);
    const pdu = pDataTF1.write();

    const pDataTF2 = new PDataTF();
    pDataTF2.read(pdu);

    const pdvs = pDataTF2.getPdvs();
    const pdv3 = pdvs[0];
    const pdv4 = pdvs[1];

    expect(pcId).to.be.eq(pdv3.getPresentationContextId());
    expect(data1).to.be.deep.eq(pdv3.getValue());
    expect(command1).to.be.eq(pdv3.isCommand());
    expect(last1).to.be.eq(pdv3.isLastFragment());

    expect(pcId).to.be.eq(pdv4.getPresentationContextId());
    expect(data2).to.be.deep.eq(pdv4.getValue());
    expect(command2).to.be.eq(pdv4.isCommand());
    expect(last2).to.be.eq(pdv4.isLastFragment());
  });
});

describe('PDU reading as strict as PS3.8 9.3', () => {
  const PeerUid = '2.25.1';
  const Accepted = [
    { id: 1, result: PresentationContextResult.Accept, transferSyntax: TransferSyntax.ImplicitVRLittleEndian },
  ];
  const UserInformation = [maximumLengthSubItem(16384), item(ItemType.ImplementationClassUid, Buffer.from(PeerUid))];

  function proposingAssociation() {
    const association = new Association('CALLINGAET', 'CALLEDAET');
    association.addPresentationContext(SopClass.Verification, 1);
    association.addTransferSyntaxToPresentationContext(1, TransferSyntax.ImplicitVRLittleEndian);
    association.addPresentationContext(SopClass.StudyRootQueryRetrieveInformationModelFind, 3);
    association.addTransferSyntaxToPresentationContext(3, TransferSyntax.ImplicitVRLittleEndian);
    return association;
  }

  function readAccept(items) {
    const association = proposingAssociation();
    const raw = new RawPdu(
      encodeAssociateAccept({ calledAeTitle: 'CALLEDAET', callingAeTitle: 'CALLINGAET', items })
    );
    raw.readPdu();
    new AAssociateAC(association).read(raw);
    return association;
  }

  function presentationContextItem(id, result, subItems) {
    return item(ItemType.PresentationContextAc, Buffer.concat([Buffer.from([id, 0, result, 0]), ...subItems]));
  }

  function transferSyntaxSubItem(uid) {
    return item(ItemType.TransferSyntax, Buffer.from(uid, 'latin1'));
  }

  function applicationContextItem() {
    return item(ItemType.ApplicationContext, Buffer.from(ApplicationContextName, 'latin1'));
  }

  function withLength(bytes, length) {
    const copy = Buffer.from(bytes);
    copy.writeUInt16BE(length, 2);
    return copy;
  }

  it('should read a valid A-ASSOCIATE-AC PDU', () => {
    const association = readAccept(acceptItems(Accepted, UserInformation));
    const context = association.getPresentationContext(1);

    expect(context.getResult()).to.be.eq(PresentationContextResult.Accept);
    expect(context.getAcceptedTransferSyntaxUid()).to.be.eq(TransferSyntax.ImplicitVRLittleEndian);
    expect(association.getPeerMaxPduLength()).to.be.eq(16384);
    expect(association.getPeerImplementationClassUid()).to.be.eq(PeerUid);
  });

  it('should skip items and user information sub-items of an unrecognized type (PS3.8 9.3.1)', () => {
    const [applicationContext, presentationContext] = acceptItems(Accepted, UserInformation);
    const association = readAccept([
      applicationContext,
      presentationContext,
      item(ItemType.UserInformation, Buffer.concat([...UserInformation, item(0x5f, Buffer.from([1, 2, 3]))])),
      item(0x60, Buffer.from([1, 2])),
    ]);

    expect(association.getPresentationContext(1).getResult()).to.be.eq(PresentationContextResult.Accept);
    expect(association.getPeerMaxPduLength()).to.be.eq(16384);
  });

  it('should read the PDU up to its last byte, a short last item included', () => {
    const [, presentationContext, userInformation] = acceptItems(Accepted, UserInformation);
    const emptyApplicationContext = item(ItemType.ApplicationContext, Buffer.alloc(0));

    expect(() => readAccept([presentationContext, userInformation, emptyApplicationContext])).to.not.throw();
    expect(() => readAccept([presentationContext, userInformation])).to.throw(/one application context item/);
  });

  it('should refuse an A-ASSOCIATE-AC PDU whose items do not fit in it or in their item', () => {
    const [applicationContext, presentationContext, userInformation] = acceptItems(Accepted, UserInformation);
    const longMaximumLength = withLength(maximumLengthSubItem(16384), 8);

    expect(() => readAccept([applicationContext, withLength(presentationContext, 0xffff), userInformation])).to.throw(
      /runs past the bytes left/
    );
    expect(() => readAccept([applicationContext, presentationContext, item(ItemType.UserInformation, longMaximumLength)])).to.throw(
      /runs past the bytes left/
    );
    expect(() => readAccept([applicationContext, presentationContext, userInformation, Buffer.from([0x60, 0])])).to.throw(
      /header of 2 bytes/
    );
  });

  it('should refuse an A-ASSOCIATE-AC PDU shorter than its fixed fields', () => {
    const raw = new RawPdu(encodePdu(PduType.AssociateAc, Buffer.alloc(67)));
    raw.readPdu();

    expect(() => new AAssociateAC(proposingAssociation()).read(raw)).to.throw(/shorter than the fixed fields/);
  });

  it('should refuse an accepted presentation context without exactly one transfer syntax sub-item', () => {
    const [applicationContext, , userInformation] = acceptItems(Accepted, UserInformation);
    const accepted = (subItems) => [
      applicationContext,
      presentationContextItem(1, PresentationContextResult.Accept, subItems),
      userInformation,
    ];
    const syntax = transferSyntaxSubItem(TransferSyntax.ImplicitVRLittleEndian);
    const abstractSyntax = item(0x30, Buffer.from(SopClass.Verification, 'latin1'));

    expect(() => readAccept(accepted([syntax, syntax]))).to.throw(/does not have one transfer syntax sub-item/);
    expect(() => readAccept(accepted([abstractSyntax]))).to.throw(/does not have one transfer syntax sub-item/);
    expect(() => readAccept(accepted([]))).to.throw(/header of 0 bytes/);
  });

  it('should not test the transfer syntax of a presentation context that was not accepted (PS3.8 9.3.3.2)', () => {
    const [applicationContext, presentationContext, userInformation] = acceptItems(Accepted, UserInformation);
    const association = readAccept([
      applicationContext,
      presentationContext,
      presentationContextItem(3, PresentationContextResult.RejectAbstractSyntaxNotSupported, [Buffer.from([9, 9])]),
      userInformation,
    ]);

    expect(association.getPresentationContext(3).getResult()).to.be.eq(
      PresentationContextResult.RejectAbstractSyntaxNotSupported
    );
  });

  it('should refuse a presentation context with an undefined result or shorter than its fixed fields', () => {
    const [applicationContext, , userInformation] = acceptItems(Accepted, UserInformation);
    const syntax = transferSyntaxSubItem(TransferSyntax.ImplicitVRLittleEndian);

    expect(() => readAccept([applicationContext, presentationContextItem(1, 5, [syntax]), userInformation])).to.throw(
      /result 5, which is not defined/
    );
    expect(() =>
      readAccept([applicationContext, presentationContextItem(1, PresentationContextResult.Proposed, [syntax]), userInformation])
    ).to.throw(/result 255, which is not defined/);
    expect(() =>
      readAccept([applicationContext, item(ItemType.PresentationContextAc, Buffer.from([1, 0, 0])), userInformation])
    ).to.throw(/shorter than its fixed fields/);
  });

  it('should refuse an A-ASSOCIATE-AC PDU without one application context item, one user information item and a presentation context item', () => {
    const [applicationContext, presentationContext, userInformation] = acceptItems(Accepted, UserInformation);
    const expected = /one application context item, one or more presentation context items and one user information item/;

    expect(() => readAccept([presentationContext, userInformation])).to.throw(expected);
    expect(() => readAccept([applicationContext, applicationContext, presentationContext, userInformation])).to.throw(expected);
    expect(() => readAccept([applicationContext, presentationContext])).to.throw(expected);
    expect(() => readAccept([applicationContext, presentationContext, userInformation, userInformation])).to.throw(expected);
    expect(() => readAccept([applicationContext, userInformation])).to.throw(expected);
  });

  it('should refuse user information without a sub-item, with a repeated sub-item or a sub-item of a wrong length', () => {
    const [applicationContext, presentationContext] = acceptItems(Accepted, UserInformation);
    const withUserInformation = (subItems) => [
      applicationContext,
      presentationContext,
      item(ItemType.UserInformation, Buffer.concat(subItems)),
    ];
    const implementationClassUid = item(ItemType.ImplementationClassUid, Buffer.from(PeerUid));
    const implementationVersion = item(0x55, Buffer.from('PEER'));
    const asynchronousOperations = item(0x53, Buffer.from([0, 1, 0, 1]));
    const serverResponse = item(0x59, Buffer.from([0, 2, 0x41, 0x42]));

    expect(() => readAccept(withUserInformation([]))).to.throw(/no sub-item/);
    [maximumLengthSubItem(16384), implementationClassUid, implementationVersion, asynchronousOperations, serverResponse].forEach(
      (subItem) => {
        expect(() => readAccept(withUserInformation([subItem, subItem]))).to.throw(/present more than once/);
      }
    );
    expect(() => readAccept(withUserInformation([item(ItemType.MaximumLength, Buffer.from([0, 1]))]))).to.throw(
      /fixed length 4, not 2/
    );
    expect(() => readAccept(withUserInformation([item(0x53, Buffer.from([0, 1]))]))).to.throw(/fixed length 4, not 2/);
    expect(() => readAccept(withUserInformation([item(0x59, Buffer.from([0]))]))).to.throw(/no server response length/);
    expect(() => readAccept(withUserInformation([item(0x59, Buffer.from([0, 3, 0x41, 0x42]))]))).to.throw(
      /does not fill its sub-item/
    );
    expect(readAccept(withUserInformation([serverResponse])).getUserIdentityServerResponse()).to.be.eq('AB');
  });

  it('should refuse A-ASSOCIATE-RJ, A-RELEASE and A-ABORT PDUs of a length other than 4', () => {
    const readers = [
      [PduType.AssociateRj, () => new AAssociateRJ()],
      [PduType.ReleaseRq, () => new AReleaseRQ()],
      [PduType.ReleaseRp, () => new AReleaseRP()],
      [PduType.Abort, () => new AAbort()],
    ];
    readers.forEach(([type, reader]) => {
      [3, 5].forEach((length) => {
        const raw = new RawPdu(encodePdu(type, Buffer.from([0, 1, 1, 0, 0].slice(0, length))));
        raw.readPdu();
        expect(() => reader().read(raw)).to.throw(/has the fixed length 4/);
      });
    });
  });

  it('should refuse an A-ASSOCIATE-RJ PDU whose result or source is not defined', () => {
    const read = (result, source) => {
      const raw = new RawPdu(encodeAssociateReject(result, source, 1));
      raw.readPdu();
      new AAssociateRJ().read(raw);
    };

    expect(() => read(1, 1)).to.not.throw();
    expect(() => read(2, 3)).to.not.throw();
    expect(() => read(0, 1)).to.throw(/result 0, which is not defined/);
    expect(() => read(3, 1)).to.throw(/result 3, which is not defined/);
    expect(() => read(1, 0)).to.throw(/source 0, which is not defined/);
    expect(() => read(1, 4)).to.throw(/source 4, which is not defined/);
  });

  it('should refuse a P-DATA-TF PDU without a PDV or with a PDV that does not fit, and take an empty fragment (PS3.8 E.1)', () => {
    const read = (body) => {
      const raw = new RawPdu(encodePdu(PduType.PDataTf, body));
      raw.readPdu();
      const pDataTf = new PDataTF();
      pDataTf.read(raw);
      return pDataTf;
    };
    const pdv = (length, rest) => {
      const header = Buffer.alloc(4);
      header.writeUInt32BE(length);
      return Buffer.concat([header, rest]);
    };

    expect(() => read(Buffer.alloc(0))).to.throw(/has no PDV/);
    expect(() => read(pdv(1, Buffer.from([1])))).to.throw(/PDV of length 1 does not fit/);
    expect(() => read(pdv(6, Buffer.from([1, 3, 0, 0])))).to.throw(/PDV of length 6 does not fit/);
    expect(() => read(Buffer.from([0, 0]))).to.throw();
    const empty = read(pdv(2, Buffer.from([1, 3])));
    expect(empty.getPdvs()).to.have.length(1);
    expect(empty.getPdvs()[0].getValue()).to.have.length(0);
    expect(empty.getPdvs()[0].isLastFragment()).to.be.true;
  });
});
