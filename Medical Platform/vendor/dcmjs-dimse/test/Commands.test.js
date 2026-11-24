const {
  CCancelRequest,
  CEchoRequest,
  CEchoResponse,
  CFindRequest,
  CFindResponse,
  Command,
  CStoreRequest,
  CStoreResponse,
  Request,
  Response,
} = require('./../src/Command');
const {
  CommandFieldType,
  PresentationContextResult,
  Priority,
  SopClass,
  Status,
  StorageClass,
  TransferSyntax,
} = require('./../src/Constants');
const { PresentationContext } = require('./../src/Association');
const Dataset = require('./../src/Dataset');
const { part10File, storedDataset, writePart10File } = require('./support');

const fs = require('fs');
const path = require('path');

describe('Command', () => {
  it('should correctly create a command', () => {
    const command = new Command(
      new Dataset({
        CommandField: 1,
        CommandDataSetType: 0x0101,
      })
    );
    const commandDataset = command.getCommandDataset();

    expect(command.getCommandFieldType()).to.be.eq(1);
    expect(command.hasDataset()).to.be.false;
    expect(commandDataset.getElement('CommandField')).to.be.eq(1);
    expect(commandDataset.getElement('CommandDataSetType')).to.be.eq(0x0101);
    expect(commandDataset.toString()).to.be.a('string');
  });

  it('should correctly create a request', () => {
    const uid1 = Dataset.generateDerivedUid();
    const request1 = new Request(1, uid1, true);
    const commandDataset1 = request1.getCommandDataset();

    const uid2 = Dataset.generateDerivedUid();
    const request2 = new Request(2, uid2, false);
    const commandDataset2 = request2.getCommandDataset();

    expect(request1.toString()).to.be.a('string');
    expect(request1.getAffectedSopClassUid()).to.be.eq(uid1);
    expect(request1.hasDataset()).to.be.true;
    expect(commandDataset1.getElement('CommandField')).to.be.eq(1);

    expect(request2.getAffectedSopClassUid()).to.be.eq(uid2);
    expect(request2.hasDataset()).to.be.false;
    expect(commandDataset2.getElement('CommandField')).to.be.eq(2);
  });

  it('should correctly create a response', () => {
    const uid = Dataset.generateDerivedUid();
    const response = new Response(7, uid, false, 5, 'This is an error');
    const commandDataset = response.getCommandDataset();

    expect(response.toString()).to.be.a('string');
    expect(response.getStatus()).to.be.eq(5);
    expect(response.getErrorComment()).to.be.eq('This is an error');
    expect(response.hasDataset()).to.be.false;
    expect(commandDataset.getElement('CommandField')).to.be.eq(7);
    expect(commandDataset.getElement('AffectedSOPClassUID')).to.be.eq(uid);
  });

  it('should correctly create a C-ECHO request', () => {
    const request = new CEchoRequest();

    expect(request.getAffectedSopClassUid()).to.be.eq(SopClass.Verification);
    expect(request.getCommandFieldType()).to.be.eq(CommandFieldType.CEchoRequest);
    expect(request.hasDataset()).to.be.false;
  });

  it('should correctly create a C-ECHO response', () => {
    const response = new CEchoResponse(Status.ProcessingFailure);

    expect(response.getAffectedSopClassUid()).to.be.eq(SopClass.Verification);
    expect(response.getCommandFieldType()).to.be.eq(CommandFieldType.CEchoResponse);
    expect(response.getStatus()).to.be.eq(Status.ProcessingFailure);
    expect(response.hasDataset()).to.be.false;

  });

  it('should correctly create a C-FIND request', () => {
    const request = CFindRequest.createStudyFindRequest({
      PatientName: 'JOHN^DOE',
      PatientID: '12345678',
      AccessionNumber: '87654321',
    });
    const dataset = request.getDataset();

    expect(request.getAffectedSopClassUid()).to.be.eq(
      SopClass.StudyRootQueryRetrieveInformationModelFind
    );
    expect(request.getCommandFieldType()).to.be.eq(CommandFieldType.CFindRequest);
    expect(request.getPriority()).to.be.eq(Priority.Medium);
    expect(request.hasDataset()).to.be.true;
    expect(dataset.getElement('PatientName')).to.be.eq('JOHN^DOE');
    expect(dataset.getElement('PatientID')).to.be.eq('12345678');
    expect(dataset.getElement('AccessionNumber')).to.be.eq('87654321');
    expect(dataset.getElement('QueryRetrieveLevel')).to.be.eq('STUDY');
  });

  it('should correctly create a C-FIND response', () => {
    const response = new CFindResponse(Status.ProcessingFailure);

    expect(response.getAffectedSopClassUid()).to.be.eq(
      SopClass.StudyRootQueryRetrieveInformationModelFind
    );
    expect(response.getCommandFieldType()).to.be.eq(CommandFieldType.CFindResponse);
    expect(response.getStatus()).to.be.eq(Status.ProcessingFailure);
    expect(response.hasDataset()).to.be.false;

  });

  it('should correctly create a C-STORE request', () => {
    const sopClassUid = Dataset.generateDerivedUid();
    const sopInstanceUid = Dataset.generateDerivedUid();
    const dataset = storedDataset(
      {
        SOPClassUID: sopClassUid,
        SOPInstanceUID: sopInstanceUid,
        PatientName: 'SYNTHETIC^PATIENT',
        PatientID: 'SYNTHETIC-0010',
      },
      TransferSyntax.ImplicitVRLittleEndian
    );

    const request = new CStoreRequest(dataset, Priority.High);

    expect(request.getAffectedSopClassUid()).to.be.eq(sopClassUid);
    expect(request.getAffectedSopInstanceUid()).to.be.eq(sopInstanceUid);
    expect(request.getCommandFieldType()).to.be.eq(CommandFieldType.CStoreRequest);
    expect(request.getPriority()).to.be.eq(Priority.High);
    expect(request.hasDataset()).to.be.true;
    expect(request.getVariants()).to.have.length(1);
    expect(request.getVariants()[0]).to.be.eq(dataset);
  });

  it('should refuse a C-STORE request without stored bytes', () => {
    const elements = {
      SOPClassUID: StorageClass.SecondaryCaptureImageStorage,
      SOPInstanceUID: Dataset.generateDerivedUid(),
    };

    expect(() => new CStoreRequest(new Dataset(elements))).to.throw(/sends only stored bytes/);
    expect(() => new CStoreRequest()).to.throw(/sends only stored bytes/);
    expect(() => new CStoreRequest(1)).to.throw(/sends only stored bytes/);
  });

  it('should create a C-STORE request that sends the stored bytes of a part10 file', () => {
    const elements = {
      SOPClassUID: SopClass.Verification,
      SOPInstanceUID: Dataset.generateDerivedUid(),
      PatientID: 'SYNTHETIC-0002',
    };
    const fromDataset = new CStoreRequest(storedDataset(elements, TransferSyntax.ExplicitVRLittleEndian));
    expect(fromDataset.getDataset().isStored()).to.be.true;
    expect(fromDataset.getAffectedSopInstanceUid()).to.be.eq(elements.SOPInstanceUID);

    const file = part10File(elements, TransferSyntax.ExplicitVRLittleEndian);
    const fromFile = new CStoreRequest(file);
    expect(fromFile.getAffectedSopInstanceUid()).to.be.eq(elements.SOPInstanceUID);
    expect(fromFile.getDataset().isStored()).to.be.false;

    fromFile.loadFullDatasetIfNeeded();
    const stored = fromFile.getDataset().getStoredDataset();
    const fileBytes = fs.readFileSync(file);
    expect(fromFile.getDataset().isStored()).to.be.true;
    expect(fileBytes.subarray(fileBytes.length - stored.length).equals(stored)).to.be.true;
    expect(new Dataset(stored, TransferSyntax.ExplicitVRLittleEndian).getElement('PatientID')).to.be.eq(
      'SYNTHETIC-0002'
    );
    fs.rmSync(path.dirname(file), { recursive: true, force: true });
  });

  it('should refuse to send a part10 file that changed after the C-STORE request was created', () => {
    const elements = {
      SOPClassUID: SopClass.Verification,
      SOPInstanceUID: Dataset.generateDerivedUid(),
    };
    const file = part10File(elements, TransferSyntax.ExplicitVRLittleEndian);
    const request = new CStoreRequest(file);
    writePart10File(file, { ...elements, SOPInstanceUID: Dataset.generateDerivedUid() }, TransferSyntax.ExplicitVRLittleEndian);

    expect(() => request.loadFullDatasetIfNeeded()).to.throw(/changed since the request was created/);
    fs.rmSync(path.dirname(file), { recursive: true, force: true });
  });

  it('should create a C-STORE request from the variants of one SOP instance in order of preference', () => {
    const elements = {
      SOPClassUID: StorageClass.SecondaryCaptureImageStorage,
      SOPInstanceUID: Dataset.generateDerivedUid(),
    };
    const jpeg = storedDataset(elements, TransferSyntax.JpegBaseline);
    const explicit = storedDataset(elements, TransferSyntax.ExplicitVRLittleEndian);
    const request = new CStoreRequest([jpeg, explicit]);

    expect(request.getVariants()).to.have.length(2);
    expect(request.getVariants()[0]).to.be.eq(jpeg);
    expect(request.getVariants()[1]).to.be.eq(explicit);
    expect(request.getDataset()).to.be.eq(jpeg);
    expect(request.getAffectedSopClassUid()).to.be.eq(elements.SOPClassUID);
    expect(request.getAffectedSopInstanceUid()).to.be.eq(elements.SOPInstanceUID);
    expect(request.getSelectedPresentationContextId()).to.be.undefined;
  });

  it('should refuse C-STORE variants that are not stored datasets of one SOP instance in distinct transfer syntaxes', () => {
    const elements = {
      SOPClassUID: StorageClass.SecondaryCaptureImageStorage,
      SOPInstanceUID: Dataset.generateDerivedUid(),
    };
    const explicit = storedDataset(elements, TransferSyntax.ExplicitVRLittleEndian);

    expect(() => new CStoreRequest([])).to.throw(/at least one variant/);
    expect(
      () => new CStoreRequest([explicit, new Dataset(elements, TransferSyntax.ImplicitVRLittleEndian)])
    ).to.throw(/sends only stored bytes/);
    expect(
      () =>
        new CStoreRequest([
          explicit,
          storedDataset(
            { ...elements, SOPInstanceUID: Dataset.generateDerivedUid() },
            TransferSyntax.ImplicitVRLittleEndian
          ),
        ])
    ).to.throw(/must be one SOP instance/);
    expect(
      () =>
        new CStoreRequest([
          explicit,
          storedDataset(
            { ...elements, SOPClassUID: StorageClass.MrImageStorage },
            TransferSyntax.ImplicitVRLittleEndian
          ),
        ])
    ).to.throw(/must be one SOP instance/);
    expect(
      () =>
        new CStoreRequest([explicit, storedDataset(elements, TransferSyntax.ExplicitVRLittleEndian)])
    ).to.throw(/distinct transfer syntaxes/);
  });

  it('should send the C-STORE variant in the transfer syntax of the selected presentation context', () => {
    const elements = {
      SOPClassUID: StorageClass.SecondaryCaptureImageStorage,
      SOPInstanceUID: Dataset.generateDerivedUid(),
    };
    const jpeg = storedDataset(elements, TransferSyntax.JpegBaseline);
    const explicit = storedDataset(elements, TransferSyntax.ExplicitVRLittleEndian);
    const request = new CStoreRequest([jpeg, explicit]);

    const explicitContext = new PresentationContext(3, elements.SOPClassUID);
    explicitContext.setResult(PresentationContextResult.Accept, TransferSyntax.ExplicitVRLittleEndian);
    request.selectPresentationContext(explicitContext);
    expect(request.getDataset()).to.be.eq(explicit);
    expect(request.getSelectedPresentationContextId()).to.be.eq(3);

    const implicitContext = new PresentationContext(5, elements.SOPClassUID);
    implicitContext.setResult(PresentationContextResult.Accept, TransferSyntax.ImplicitVRLittleEndian);
    expect(() => request.selectPresentationContext(implicitContext)).to.throw(
      /no variant in the accepted transfer syntax/
    );
    expect(request.getDataset()).to.be.eq(explicit);
    expect(request.getSelectedPresentationContextId()).to.be.eq(3);
  });

  it('should correctly create a C-STORE response', () => {
    const response = new CStoreResponse(Status.Success);

    expect(response.getAffectedSopClassUid()).to.be.eq('');
    expect(response.getCommandFieldType()).to.be.eq(CommandFieldType.CStoreResponse);
    expect(response.getStatus()).to.be.eq(Status.Success);
    expect(response.hasDataset()).to.be.false;

  });

  it('should describe requests and responses without their element values', () => {
    const request = CFindRequest.createStudyFindRequest({ PatientID: 'SYNTHETIC-DESC-0001' });
    request.setMessageId(7);
    const response = new CFindResponse(Status.ProcessingFailure, 'SYNTHETIC ERROR COMMENT');
    response.setMessageIdBeingRespondedTo(7);
    response.setDataset(new Dataset({ PatientID: 'SYNTHETIC-DESC-0001' }));

    expect(request.toString()).to.be.eq('C-FIND RQ [HasDataset: true] [id: 7]');
    expect(response.toString()).to.match(/^C-FIND RSP \[HasDataset: true\] \[id: 7; status: .+\]$/);
    [request.toString(), response.toString()].forEach((description) => {
      expect(description).to.not.include('SYNTHETIC-DESC-0001');
      expect(description).to.not.include('SYNTHETIC ERROR COMMENT');
    });
  });

  it('should correctly create a C-CANCEL request', () => {
    const sopClassUid = Dataset.generateDerivedUid();
    const request = new CCancelRequest(sopClassUid, 2);

    expect(request.getAffectedSopClassUid()).to.be.eq(sopClassUid);
    expect(request.getCommandFieldType()).to.be.eq(CommandFieldType.CCancelRequest);
    expect(request.getMessageIdBeingRespondedTo()).to.be.eq(2);
    expect(request.hasDataset()).to.be.false;

    expect(() => {
      CCancelRequest.fromRequest(new CEchoRequest());
    }).to.throw(/instance of CFindRequest/);
    expect(() => {
      CCancelRequest.fromRequest(new CFindRequest());
    }).to.not.throw();
  });
});
