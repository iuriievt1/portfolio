import CryptoKit
import Foundation

/// HPKE (RFC 9180) sealing for one suite — DHKEM(P-256, HKDF-SHA256), HKDF-SHA256, AES-256-GCM,
/// base mode, one message: the envelope of the file copy sent to the server ✓ CAP-009-R13,
/// CAP-021-R21. Built on CryptoKit primitives so it runs from iOS 16.4; the server opens it with
/// the same construction and both are checked against the vectors of the RFC.
enum Hpke {
  struct Sealed {
    let enc: Data
    let ciphertext: Data
  }

  enum Failure: Error {
    case invalidRecipientKey
  }

  static let suite = "DHKEM(P-256, HKDF-SHA256), HKDF-SHA256, AES-256-GCM"

  private static let kemId: UInt16 = 0x0010
  private static let kdfId: UInt16 = 0x0001
  private static let aeadId: UInt16 = 0x0002
  private static let modeBase: UInt8 = 0x00
  private static let sharedSecretBytes = 32
  private static let keyBytes = 32
  private static let nonceBytes = 12
  private static let hashBytes = 32
  private static let versionLabel = Data("HPKE-v1".utf8)
  private static let kemSuiteId = Data("KEM".utf8) + bytes(of: kemId)
  private static let hpkeSuiteId = Data("HPKE".utf8) + bytes(of: kemId) + bytes(of: kdfId) + bytes(of: aeadId)
  private static let emptySalt = SymmetricKey(data: Data(count: hashBytes))

  /// Single-shot `Seal` ✓ RFC 9180 6.1; the ephemeral key is a parameter only so a vector can drive it.
  static func seal(
    _ plaintext: Data,
    recipientPublicKey: Data,
    info: Data = Data(),
    aad: Data = Data(),
    ephemeral: P256.KeyAgreement.PrivateKey = P256.KeyAgreement.PrivateKey()
  ) throws -> Sealed {
    guard let recipient = try? P256.KeyAgreement.PublicKey(x963Representation: recipientPublicKey) else {
      throw Failure.invalidRecipientKey
    }
    let enc = ephemeral.publicKey.x963Representation
    let dh = try ephemeral.sharedSecretFromKeyAgreement(with: recipient).withUnsafeBytes { Data($0) }
    let sharedSecret = extractAndExpand(dh, kemContext: enc + recipient.x963Representation)
    let schedule = keySchedule(sharedSecret, info: info)
    let box = try AES.GCM.seal(plaintext, using: schedule.key, nonce: try AES.GCM.Nonce(data: schedule.baseNonce), authenticating: aad)
    return Sealed(enc: enc, ciphertext: box.ciphertext + box.tag)
  }

  private static func extractAndExpand(_ dh: Data, kemContext: Data) -> Data {
    let eaePrk = labeledExtract(kemSuiteId, salt: emptySalt, label: "eae_prk", ikm: dh)
    return labeledExpand(kemSuiteId, prk: eaePrk, label: "shared_secret", info: kemContext, length: sharedSecretBytes)
  }

  /// `KeySchedule` for the base mode ✓ RFC 9180 5.1.
  private static func keySchedule(_ sharedSecret: Data, info: Data) -> (key: SymmetricKey, baseNonce: Data) {
    let pskIdHash = labeledExtract(hpkeSuiteId, salt: emptySalt, label: "psk_id_hash", ikm: Data())
    let infoHash = labeledExtract(hpkeSuiteId, salt: emptySalt, label: "info_hash", ikm: info)
    let context = Data([modeBase]) + pskIdHash + infoHash
    let secret = labeledExtract(hpkeSuiteId, salt: SymmetricKey(data: sharedSecret), label: "secret", ikm: Data())
    let key = labeledExpand(hpkeSuiteId, prk: secret, label: "key", info: context, length: keyBytes)
    let baseNonce = labeledExpand(hpkeSuiteId, prk: secret, label: "base_nonce", info: context, length: nonceBytes)
    return (SymmetricKey(data: key), baseNonce)
  }

  /// `LabeledExtract` ✓ RFC 9180 4; HKDF-Extract is HMAC with the salt as key.
  private static func labeledExtract(_ suiteId: Data, salt: SymmetricKey, label: String, ikm: Data) -> Data {
    Data(HMAC<SHA256>.authenticationCode(for: versionLabel + suiteId + Data(label.utf8) + ikm, using: salt))
  }

  /// `LabeledExpand` ✓ RFC 9180 4 over HKDF-Expand of RFC 5869.
  private static func labeledExpand(_ suiteId: Data, prk: Data, label: String, info: Data, length: Int) -> Data {
    let labeledInfo = bytes(of: UInt16(length)) + versionLabel + suiteId + Data(label.utf8) + info
    let key = SymmetricKey(data: prk)
    var output = Data()
    var previous = Data()
    var counter: UInt8 = 1
    while output.count < length {
      previous = Data(HMAC<SHA256>.authenticationCode(for: previous + labeledInfo + Data([counter]), using: key))
      output += previous
      counter += 1
    }
    return output.prefix(length)
  }

  private static func bytes(of value: UInt16) -> Data {
    Data([UInt8(value >> 8), UInt8(value & 0xff)])
  }
}

/// base64url without padding, the encoding of the server public key on the wire.
enum Base64Url {
  static func decode(_ text: String) -> Data? {
    var base64 = text.replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
    let remainder = base64.count % 4
    if remainder > 0 {
      base64 += String(repeating: "=", count: 4 - remainder)
    }
    return Data(base64Encoded: base64)
  }
}
