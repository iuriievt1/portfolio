const dcmjs = require('@veevoy/dcmjs');
const { DicomMetaDictionary } = dcmjs.data;

// dcmjs writes the values of these VRs in UTF-8; they are the ones whose repertoire a Specific Character Set
// replaces (PS3.5 6.1.2.3)
const CharacterSetVrs = ['SH', 'LO', 'ST', 'LT', 'PN', 'UC', 'UT'];
// The character set that matches the UTF-8 dcmjs writes, single-valued (integrace-dicom.md 5.7)
const Utf8CharacterSet = 'ISO_IR 192';
const MaxDefaultRepertoireCode = 0x7f;
const SpecificCharacterSetTag = '00080005';
const SequenceVr = 'SQ';

//#region CharacterSet
/**
 * Checks that the text of a data set the client encodes goes on the wire in its declared character set.
 * dcmjs writes text in UTF-8, so text outside the default repertoire (ISO 646) needs Specific Character Set
 * ISO_IR 192 as its only value, in the data set or in the sequence item that holds the text (PS3.5 7.5.3),
 * and is allowed only in the VRs that a character set applies to (PS3.5 6.1.2.3). A query whose text the PACS
 * would read in another character set matches nothing without saying so (integrace-dicom.md 6.4).
 * @param {Object} elements - Naturalized data set elements.
 * @returns {string|undefined} Where text is outside the declared character set, if anywhere.
 */
function characterSetProblem(elements) {
  const pending = [{ dict: DicomMetaDictionary.denaturalizeDataset(elements), characterSets: [], path: '' }];
  while (pending.length > 0) {
    const { dict, characterSets: inherited, path } = pending.pop();
    const declared = dict[SpecificCharacterSetTag];
    const characterSets = declared ? textValues(declared.Value) : inherited;
    for (const tag of Object.keys(dict)) {
      const { vr, Value: values } = dict[tag];
      const name = `${path}${DicomMetaDictionary.punctuateTag(tag)}`;
      if (vr === SequenceVr) {
        (values || []).forEach((item, index) => {
          pending.push({ dict: item, characterSets, path: `${name}[${index}]` });
        });
        continue;
      }
      if (!textValues(values).some(isOutsideDefaultRepertoire)) {
        continue;
      }
      if (!CharacterSetVrs.includes(vr)) {
        return `${name} of VR ${vr} has text outside the default repertoire, which its VR does not allow`;
      }
      if (characterSets.length !== 1 || characterSets[0] !== Utf8CharacterSet) {
        return `${name} has text outside the default repertoire, but the character set is ${
          characterSets.length > 0 ? characterSets.join('\\') : 'not declared'
        }, not ${Utf8CharacterSet}`;
      }
    }
  }
  return undefined;
}
//#endregion

//#region Private Functions
/**
 * Gets the strings of element values; a person name is an object of its component groups.
 * @param {Array|undefined} values - Element values.
 * @returns {Array<string>} Strings.
 */
function textValues(values) {
  return (values || []).flatMap((value) => {
    if (typeof value === 'string') {
      return [value];
    }
    if (value !== null && typeof value === 'object' && !(value instanceof ArrayBuffer)) {
      return Object.values(value).filter((component) => typeof component === 'string');
    }
    return [];
  });
}

/**
 * Checks whether a string has a character outside the default repertoire.
 * @param {string} text - Text.
 * @returns {boolean} Whether a character is outside the default repertoire.
 */
function isOutsideDefaultRepertoire(text) {
  for (const character of text) {
    if (character.codePointAt(0) > MaxDefaultRepertoireCode) {
      return true;
    }
  }
  return false;
}
//#endregion

//#region Exports
module.exports = { characterSetProblem };
//#endregion
