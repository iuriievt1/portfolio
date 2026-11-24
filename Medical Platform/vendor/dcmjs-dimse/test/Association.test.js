const { Association } = require('./../src/Association');
const { CFindRequest, CStoreRequest, Request } = require('./../src/Command');
const {
  CommandFieldType,
  PresentationContextResult,
  SopClass,
  StorageClass,
  TransferSyntax,
  UserIdentityType,
} = require('./../src/Constants');
const Dataset = require('./../src/Dataset');
const { storedDataset } = require('./support');

describe('Association', () => {
  it('should correctly construct an association', () => {
    const callingAet = 'CALLINGAET';
    const calledAet = 'CALLEDAET';

    const association = new Association(callingAet, calledAet);

    expect(association.getCallingAeTitle()).to.be.eq(callingAet);
    expect(association.getCalledAeTitle()).to.be.eq(calledAet);
    expect(association.toString()).to.be.a('string');
  });

  it('should correctly handle user identity and async ops', () => {
    const callingAet = 'CALLINGAET';
    const calledAet = 'CALLEDAET';

    const association = new Association(callingAet, calledAet);

    expect(association.getCallingAeTitle()).to.be.eq(callingAet);
    expect(association.getCalledAeTitle()).to.be.eq(calledAet);
    expect(association.getCalledAeTitle()).to.be.eq(calledAet);
    expect(association.getUserIdentityType()).to.be.eq(UserIdentityType.Username);
    expect(association.getNegotiateAsyncOps()).to.be.eq(false);
    expect(association.getMaxAsyncOpsInvoked()).to.be.eq(1);
    expect(association.getMaxAsyncOpsPerformed()).to.be.eq(1);
    expect(association.getNegotiateUserIdentity()).to.be.eq(false);
    expect(association.getUserIdentityPositiveResponseRequested()).to.be.eq(false);
    expect(association.getUserIdentityPrimaryField()).to.be.eq('');
    expect(association.getUserIdentitySecondaryField()).to.be.eq('');
    expect(association.getNegotiateUserIdentityServerResponse()).to.be.eq(false);
    expect(association.getUserIdentityServerResponse()).to.be.eq('');

    association.setNegotiateAsyncOps(true);
    association.setMaxAsyncOpsInvoked(3);
    association.setMaxAsyncOpsPerformed(4);
    association.setNegotiateUserIdentity(true);
    association.setUserIdentityType(1);
    association.setUserIdentityPositiveResponseRequested(true);
    association.setUserIdentityPrimaryField('JOHN');
    association.setUserIdentitySecondaryField('DOE');
    association.setNegotiateUserIdentityServerResponse(true);
    association.setUserIdentityServerResponse('ALLOWED');

    expect(association.getNegotiateAsyncOps()).to.be.eq(true);
    expect(association.getMaxAsyncOpsInvoked()).to.be.eq(3);
    expect(association.getMaxAsyncOpsPerformed()).to.be.eq(4);
    expect(association.getNegotiateUserIdentity()).to.be.eq(true);
    expect(association.getUserIdentityType()).to.be.eq(1);
    expect(association.getUserIdentityPositiveResponseRequested()).to.be.eq(true);
    expect(association.getUserIdentityPrimaryField()).to.be.eq('JOHN');
    expect(association.getUserIdentitySecondaryField()).to.be.eq('DOE');
    expect(association.getNegotiateUserIdentityServerResponse()).to.be.eq(true);
    expect(association.getUserIdentityServerResponse()).to.be.eq('ALLOWED');
  });

  it('should correctly add and clear presentation contexts', () => {
    const callingAet = 'CALLINGAET';
    const calledAet = 'CALLEDAET';

    const association = new Association(callingAet, calledAet);
    const pcId = association.addPresentationContext('1.2.3.4.5.6.7.8.9');
    association.addTransferSyntaxToPresentationContext(pcId, '9.8.7.6.5.4.3.2.1');
    const context = association.getPresentationContext(pcId);

    expect(context.getAbstractSyntaxUid()).to.be.eq('1.2.3.4.5.6.7.8.9');
    expect(context.getAcceptedTransferSyntaxUid()).to.be.eq('9.8.7.6.5.4.3.2.1');

    association.clearPresentationContexts();
    const contexts = association.getPresentationContexts();
    expect(contexts.length).to.be.eq(0);
  });

  it('should correctly set presentation context results', () => {
    const callingAet = 'CALLINGAET';
    const calledAet = 'CALLEDAET';

    const association = new Association(callingAet, calledAet);
    const pcId = association.addPresentationContext('1.2.3.4.5.6.7.8.9');
    association.addTransferSyntaxToPresentationContext(pcId, '9.8.7.6.5.4.3.2.1');
    const context = association.getPresentationContext(pcId);
    context.setResult(1, '9.8.7.6.5.4.3.2.1');

    expect(context.getAbstractSyntaxUid()).to.be.eq('1.2.3.4.5.6.7.8.9');
    expect(context.getAcceptedTransferSyntaxUid()).to.be.eq('9.8.7.6.5.4.3.2.1');
    expect(context.getResult()).to.be.eq(1);
  });

  it('should throw for unknown presentation contexts', () => {
    const callingAet = 'CALLINGAET';
    const calledAet = 'CALLEDAET';

    const association = new Association(callingAet, calledAet);
    const pcId = association.addPresentationContext('1.2.3.4.5.6.7.8.9');
    association.addTransferSyntaxToPresentationContext(pcId, '9.8.7.6.5.4.3.2.1');

    expect(() => {
      association.getPresentationContext(3);
    }).to.throw();
  });

  it('should correctly add presentation context from request', () => {
    const callingAet = 'CALLINGAET';
    const calledAet = 'CALLEDAET';

    const association = new Association(callingAet, calledAet);
    const request = new Request(1, SopClass.Verification, 1, false);
    const pcId = association.addPresentationContextFromRequest(request);
    const context = association.getPresentationContext(pcId);

    expect(context.getAbstractSyntaxUid()).to.be.eq(SopClass.Verification);
    expect(context.getAcceptedTransferSyntaxUid()).to.be.eq(TransferSyntax.ImplicitVRLittleEndian);
  });

  it('should correctly get the accepted presentation context for a request', () => {
    const callingAet = 'CALLINGAET';
    const calledAet = 'CALLEDAET';

    const association = new Association(callingAet, calledAet);
    const request = new Request(CommandFieldType.CEchoRequest, SopClass.Verification, false);
    let pcId = association.addPresentationContextFromRequest(request);
    const context = association.getPresentationContext(pcId);
    context.setResult(PresentationContextResult.Accept, TransferSyntax.ExplicitVRLittleEndian);

    expect(context.getAbstractSyntaxUid()).to.be.eq(SopClass.Verification);
    expect(context.getAcceptedTransferSyntaxUid()).to.be.eq(TransferSyntax.ExplicitVRLittleEndian);
  });

  it('should correctly choose the presentation context that exactly matches the transfer syntax when possible', () => {
    const callingAet = 'CALLINGAET';
    const calledAet = 'CALLEDAET';

    const association = new Association(callingAet, calledAet);
    const request = CFindRequest.createStudyFindRequest({ PatientID: 'SYNTHETIC-0011' });

    // Create association with two presentation contexts for the same abstract syntax but with different
    // transfer syntaxes
    const pcId1 = association.addPresentationContext(
      SopClass.StudyRootQueryRetrieveInformationModelFind
    );
    let context = association.getPresentationContext(pcId1);
    context.setResult(PresentationContextResult.Accept, TransferSyntax.ExplicitVRLittleEndian);
    const pcId2 = association.addPresentationContext(
      SopClass.StudyRootQueryRetrieveInformationModelFind
    );
    context = association.getPresentationContext(pcId2);
    context.setResult(PresentationContextResult.Accept, TransferSyntax.JpegBaseline);

    // Check that a request using ExplicitVRLittleEndian matches the first presentation context
    request.getDataset().setTransferSyntaxUid(TransferSyntax.ExplicitVRLittleEndian);
    expect(association.getAcceptedPresentationContextFromRequest(request).pcId).to.be.eq(pcId1);

    // Check that a request using JpegBaseline matches the second presentation context
    request.getDataset().setTransferSyntaxUid(TransferSyntax.JpegBaseline);
    expect(association.getAcceptedPresentationContextFromRequest(request).pcId).to.be.eq(pcId2);
  });

  it('should correctly add presentation contexts from a C-STORE request', () => {
    const callingAet = 'CALLINGAET';
    const calledAet = 'CALLEDAET';

    const association1 = new Association(callingAet, calledAet);
    const request1 = new CStoreRequest(
      storedDataset(
        { SOPClassUID: StorageClass.CtImageStorage, SOPInstanceUID: Dataset.generateDerivedUid() },
        TransferSyntax.ImplicitVRLittleEndian
      )
    );
    const pcId1 = association1.addPresentationContextFromRequest(request1);
    const request2 = new CStoreRequest(
      storedDataset(
        { SOPClassUID: StorageClass.CtImageStorage, SOPInstanceUID: Dataset.generateDerivedUid() },
        TransferSyntax.ImplicitVRLittleEndian
      )
    );
    const pcId2 = association1.addPresentationContextFromRequest(request2);
    expect(pcId1).to.be.eq(pcId2);

    const association2 = new Association(callingAet, calledAet);
    const request3 = new CStoreRequest(
      storedDataset(
        { SOPClassUID: StorageClass.CtImageStorage, SOPInstanceUID: Dataset.generateDerivedUid() },
        TransferSyntax.ImplicitVRLittleEndian
      )
    );
    const pcId3 = association2.addPresentationContextFromRequest(request3);
    const request4 = new CStoreRequest(
      storedDataset(
        { SOPClassUID: StorageClass.CtImageStorage, SOPInstanceUID: Dataset.generateDerivedUid() },
        TransferSyntax.Jpeg2000Lossless
      )
    );
    const pcId4 = association2.addPresentationContextFromRequest(request4);
    const request5 = new CStoreRequest(
      storedDataset(
        { SOPClassUID: StorageClass.CtImageStorage, SOPInstanceUID: Dataset.generateDerivedUid() },
        TransferSyntax.Jpeg2000Lossless
      )
    );
    const pcId5 = association2.addPresentationContextFromRequest(request5);
    const request6 = new CStoreRequest(
      storedDataset(
        { SOPClassUID: StorageClass.CtImageStorage, SOPInstanceUID: Dataset.generateDerivedUid() },
        TransferSyntax.JpegLossless
      )
    );
    const pcId6 = association2.addPresentationContextFromRequest(request6);
    expect(association2.getPresentationContexts().length).to.be.eq(3);
    expect(pcId3).not.to.be.eq(pcId4);
    expect(pcId4).to.be.eq(pcId5);
    expect(pcId5).not.to.be.eq(pcId6);

    const association3 = new Association(callingAet, calledAet);
    const request7 = new CStoreRequest(
      storedDataset(
        { SOPClassUID: StorageClass.CtImageStorage, SOPInstanceUID: Dataset.generateDerivedUid() },
        TransferSyntax.Jpeg2000Lossless
      )
    );
    const pcId7 = association3.addPresentationContextFromRequest(request7, [
      TransferSyntax.ImplicitVRLittleEndian,
      TransferSyntax.ExplicitVRLittleEndian,
    ]);
    const request8 = new CStoreRequest(
      storedDataset(
        { SOPClassUID: StorageClass.MrImageStorage, SOPInstanceUID: Dataset.generateDerivedUid() },
        TransferSyntax.ImplicitVRLittleEndian
      )
    );
    const pcId8 = association3.addPresentationContextFromRequest(request8);
    expect(pcId7).not.to.be.eq(pcId8);
    expect(association3.getPresentationContexts().length).to.be.eq(2);
    expect(association3.getPresentationContext(pcId7).getTransferSyntaxUids()).to.deep.equal([
      TransferSyntax.Jpeg2000Lossless,
    ]);
  });

  it('should keep the presentation contexts of C-STORE requests out of reach of other requests', () => {
    const association = new Association('CALLINGAET', 'CALLEDAET');
    const storeRequest = new CStoreRequest(
      storedDataset(
        {
          SOPClassUID: StorageClass.MrImageStorage,
          SOPInstanceUID: Dataset.generateDerivedUid(),
        },
        TransferSyntax.ExplicitVRLittleEndian
      )
    );
    const storePcId = association.addPresentationContextFromRequest(storeRequest);
    const otherPcId = association.addOrGetPresentationContext(StorageClass.MrImageStorage);
    association.addTransferSyntaxToPresentationContext(otherPcId, TransferSyntax.ImplicitVRLittleEndian);

    expect(association.getPresentationContext(storePcId).getTransferSyntaxUids()).to.deep.equal([
      TransferSyntax.ExplicitVRLittleEndian,
    ]);
    expect(otherPcId).not.to.be.eq(storePcId);
  });

  it('should send stored C-STORE bytes only on a context accepted with their transfer syntax', () => {
    const association = new Association('CALLINGAET', 'CALLEDAET');
    const request = new CStoreRequest(
      storedDataset(
        {
          SOPClassUID: StorageClass.SecondaryCaptureImageStorage,
          SOPInstanceUID: Dataset.generateDerivedUid(),
        },
        TransferSyntax.JpegBaseline
      )
    );
    const pcId = association.addPresentationContextFromRequest(request);
    const otherPcId = association.addPresentationContext(StorageClass.SecondaryCaptureImageStorage);
    association
      .getPresentationContext(otherPcId)
      .setResult(PresentationContextResult.Accept, TransferSyntax.ImplicitVRLittleEndian);
    const context = association.getPresentationContext(pcId);

    context.setResult(PresentationContextResult.RejectTransferSyntaxesNotSupported);
    expect(association.getAcceptedPresentationContextFromRequest(request)).to.be.undefined;

    context.setResult(PresentationContextResult.Accept, TransferSyntax.JpegBaseline);
    expect(association.getAcceptedPresentationContextFromRequest(request).pcId).to.be.eq(pcId);
  });

  it('should propose a presentation context for each variant of a C-STORE request in order of preference', () => {
    const association = new Association('CALLINGAET', 'CALLEDAET');
    const sopClassUid = StorageClass.SecondaryCaptureImageStorage;
    const elements = { SOPClassUID: sopClassUid, SOPInstanceUID: Dataset.generateDerivedUid() };
    const syntaxes = [
      TransferSyntax.JpegBaseline,
      TransferSyntax.ExplicitVRLittleEndian,
      TransferSyntax.ImplicitVRLittleEndian,
    ];
    const request = new CStoreRequest(syntaxes.map((syntax) => storedDataset(elements, syntax)));

    const pcId = association.addPresentationContextFromRequest(request, [
      TransferSyntax.ImplicitVRLittleEndian,
      TransferSyntax.ExplicitVRLittleEndian,
    ]);
    const contexts = association.getPresentationContexts();
    expect(pcId).to.be.eq(1);
    expect(contexts.map((pc) => pc.id)).to.deep.equal([1, 3, 5]);
    expect(contexts.map((pc) => pc.context.getAbstractSyntaxUid())).to.deep.equal([
      sopClassUid,
      sopClassUid,
      sopClassUid,
    ]);
    expect(contexts.map((pc) => pc.context.getTransferSyntaxUids())).to.deep.equal(
      syntaxes.map((syntax) => [syntax])
    );

    const otherInstance = new CStoreRequest([
      storedDataset(
        { SOPClassUID: sopClassUid, SOPInstanceUID: Dataset.generateDerivedUid() },
        TransferSyntax.ExplicitVRLittleEndian
      ),
    ]);
    expect(association.addPresentationContextFromRequest(otherInstance)).to.be.eq(3);
    expect(association.getPresentationContexts()).to.have.length(3);
  });

  it('should send the first variant in order of preference whose presentation context was accepted', () => {
    const association = new Association('CALLINGAET', 'CALLEDAET');
    const elements = {
      SOPClassUID: StorageClass.SecondaryCaptureImageStorage,
      SOPInstanceUID: Dataset.generateDerivedUid(),
    };
    const request = new CStoreRequest([
      storedDataset(elements, TransferSyntax.JpegBaseline),
      storedDataset(elements, TransferSyntax.ExplicitVRLittleEndian),
      storedDataset(elements, TransferSyntax.ImplicitVRLittleEndian),
    ]);
    association.addPresentationContextFromRequest(request);
    const [jpeg, explicit, implicit] = association.getPresentationContexts().map((pc) => pc.context);

    jpeg.setResult(PresentationContextResult.RejectTransferSyntaxesNotSupported);
    explicit.setResult(PresentationContextResult.Accept, TransferSyntax.ExplicitVRLittleEndian);
    implicit.setResult(PresentationContextResult.Accept, TransferSyntax.ImplicitVRLittleEndian);
    expect(association.getAcceptedPresentationContextFromRequest(request)).to.be.eq(explicit);

    jpeg.setResult(PresentationContextResult.Accept, TransferSyntax.JpegBaseline);
    expect(association.getAcceptedPresentationContextFromRequest(request)).to.be.eq(jpeg);

    [jpeg, explicit, implicit].forEach((context) => context.setResult(PresentationContextResult.RejectNoReason));
    expect(association.getAcceptedPresentationContextFromRequest(request)).to.be.undefined;
  });

  it('should send a C-STORE variant on its own presentation context before another context with its transfer syntax', () => {
    const association = new Association('CALLINGAET', 'CALLEDAET');
    const sopClassUid = StorageClass.SecondaryCaptureImageStorage;
    const otherPcId = association.addPresentationContext(sopClassUid);
    association.addTransferSyntaxToPresentationContext(otherPcId, TransferSyntax.ExplicitVRLittleEndian);
    const request = new CStoreRequest([
      storedDataset(
        { SOPClassUID: sopClassUid, SOPInstanceUID: Dataset.generateDerivedUid() },
        TransferSyntax.ExplicitVRLittleEndian
      ),
    ]);
    const ownPcId = association.addPresentationContextFromRequest(request);
    const other = association.getPresentationContext(otherPcId);
    const own = association.getPresentationContext(ownPcId);

    other.setResult(PresentationContextResult.Accept, TransferSyntax.ExplicitVRLittleEndian);
    own.setResult(PresentationContextResult.Accept, TransferSyntax.ExplicitVRLittleEndian);
    expect(association.getAcceptedPresentationContextFromRequest(request)).to.be.eq(own);

    own.setResult(PresentationContextResult.RejectUser);
    expect(association.getAcceptedPresentationContextFromRequest(request)).to.be.eq(other);
  });
});
