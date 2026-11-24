const { characterSetProblem } = require('./../src/CharacterSet');

describe('Character set of an encoded data set (PS3.5 6.1.2.3, 7.5.3)', () => {
  it('should take text of the default repertoire without a declared character set', () => {
    expect(characterSetProblem({ PatientName: 'NOVAK^JANA*', PatientID: '1000101', Modality: 'XC' })).to.be.undefined;
    expect(characterSetProblem({ SpecificCharacterSet: 'ISO_IR 100', PatientName: 'NOVAK*' })).to.be.undefined;
  });

  it('should take text outside the default repertoire with ISO_IR 192 as the only character set', () => {
    expect(characterSetProblem({ SpecificCharacterSet: 'ISO_IR 192', PatientName: 'Šťastná^Jana*' })).to.be.undefined;
    expect(
      characterSetProblem({
        SpecificCharacterSet: 'ISO_IR 192',
        ScheduledProcedureStepSequence: [{ ScheduledPerformingPhysicianName: 'Dvořák^Ondřej', ScheduledProcedureStepDescription: 'Ošetření' }],
      })
    ).to.be.undefined;
    expect(
      characterSetProblem({
        PatientName: 'NOVAK*',
        ScheduledProcedureStepSequence: [{ SpecificCharacterSet: 'ISO_IR 192', ScheduledProcedureStepDescription: 'Ošetření' }],
      })
    ).to.be.undefined;
  });

  it('should refuse text outside the default repertoire without ISO_IR 192 as the only character set', () => {
    expect(characterSetProblem({ PatientName: 'Šťastná*' })).to.match(/\(0010,0010\) has text outside the default repertoire, but the character set is not declared/);
    expect(characterSetProblem({ PatientName: 'Dupré*' })).to.match(/\(0010,0010\) has text outside the default repertoire/);
    // A character outside the Basic Multilingual Plane, which takes two UTF-16 code units
    expect(characterSetProblem({ PatientName: 'NOVAK\u{20BB7}' })).to.match(/\(0010,0010\) has text outside the default repertoire/);
    expect(characterSetProblem({ SpecificCharacterSet: 'ISO_IR 192', PatientName: 'NOVAK\u{20BB7}' })).to.be.undefined;
    expect(characterSetProblem({ SpecificCharacterSet: 'ISO_IR 100', PatientName: 'Šťastná*' })).to.match(/character set is ISO_IR 100, not ISO_IR 192/);
    expect(characterSetProblem({ SpecificCharacterSet: ['ISO_IR 192', 'ISO_IR 100'], PatientName: 'Šťastná*' })).to.match(/character set is ISO_IR 192\\ISO_IR 100, not ISO_IR 192/);
    expect(characterSetProblem({ PatientName: { Alphabetic: 'NOVAK', Ideographic: '肝' } })).to.match(/\(0010,0010\) has text outside/);
  });

  it('should refuse text outside the default repertoire in a sequence item that has no ISO_IR 192 of its own or inherited', () => {
    expect(
      characterSetProblem({ ScheduledProcedureStepSequence: [{ ScheduledPerformingPhysicianName: 'Dvořák' }] })
    ).to.match(/\(0040,0100\)\[0\]\(0040,0006\) has text outside the default repertoire, but the character set is not declared/);
    expect(
      characterSetProblem({
        SpecificCharacterSet: 'ISO_IR 192',
        ScheduledProcedureStepSequence: [{ SpecificCharacterSet: 'ISO_IR 100', ScheduledPerformingPhysicianName: 'Dvořák' }],
      })
    ).to.match(/\(0040,0100\)\[0\]\(0040,0006\) .* character set is ISO_IR 100/);
  });

  it('should refuse text outside the default repertoire in a VR that no character set applies to', () => {
    expect(characterSetProblem({ SpecificCharacterSet: 'ISO_IR 192', Modality: 'XČ' })).to.match(/\(0008,0060\) of VR CS has text outside the default repertoire/);
    expect(characterSetProblem({ SpecificCharacterSet: 'ISO_IR 192', StudyDate: '2026110Ř' })).to.match(/\(0008,0020\) of VR DA/);
  });

  it('should name no value in what it reports', () => {
    const problem = characterSetProblem({ PatientName: 'Šťastná^Jana*' });

    expect(problem).to.not.include('Šťastná');
  });
});
