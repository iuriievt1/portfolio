const Constants = require('./../src/Constants');
const DcmjsDimse = require('./../src/index');
const packageJson = require('./../package.json');

const fs = require('fs');
const path = require('path');

/**
 * Reads the members of each namespace and the top level exports that index.d.ts declares.
 * @returns {Object} Declared member names by namespace, the top level ones under the empty name.
 */
function declaredExports() {
  const lines = fs.readFileSync(path.join(__dirname, '..', 'index.d.ts'), 'utf8').split('\n');
  const declared = { '': [] };
  let namespace = undefined;
  lines.forEach((line) => {
    const opened = line.match(/^export namespace (\w+) \{/);
    if (opened) {
      namespace = opened[1];
      declared[namespace] = [];
      return;
    }
    if (namespace !== undefined && line === '}') {
      namespace = undefined;
      return;
    }
    const member = namespace !== undefined && line.match(/^  export \{ (\w+) \};/);
    if (member) {
      declared[namespace].push(member[1]);
      return;
    }
    const topLevel = namespace === undefined && line.match(/^export \{ (.+) \};$/);
    if (topLevel) {
      declared[''].push(...topLevel[1].split(',').map((name) => name.trim()));
    }
  });
  return declared;
}

describe('Public entry point', () => {
  it('should expose the constants the client reports with', () => {
    ['AssociationOutcome', 'NotSentReason', 'TimeoutKind', 'Status', 'AbortReason', 'AbortSource'].forEach((name) => {
      expect(DcmjsDimse.constants[name]).to.deep.equal(Constants[name]);
    });
  });

  // Every value index.d.ts declares is there at run time
  it('should expose only the client, its requests and responses, and the version of the fork', () => {
    expect(Object.keys(DcmjsDimse).sort()).to.deep.equal(
      ['association', 'Client', 'constants', 'Dataset', 'log', 'requests', 'responses', 'Statistics', 'version'].sort()
    );
    expect(Object.keys(DcmjsDimse.requests).sort()).to.deep.equal(
      ['CCancelRequest', 'CEchoRequest', 'CFindRequest', 'CStoreRequest', 'Request'].sort()
    );
    expect(Object.keys(DcmjsDimse.responses).sort()).to.deep.equal(
      ['CEchoResponse', 'CFindResponse', 'CStoreResponse', 'Response'].sort()
    );
    expect(DcmjsDimse.version).to.be.eq(packageJson.version);
  });

  it('should have at run time every value that index.d.ts declares', () => {
    const declared = declaredExports();
    const missing = Object.entries(declared).flatMap(([namespace, members]) =>
      members.filter((member) => (namespace === '' ? DcmjsDimse[member] : DcmjsDimse[namespace][member]) === undefined)
    );

    expect(Object.keys(declared).sort()).to.deep.equal(['', 'association', 'constants', 'requests', 'responses']);
    expect(declared[''].length).to.be.greaterThan(0);
    expect(missing).to.deep.equal([]);
  });
});
