import CryptoKit
import ExpoModulesCore
import Foundation
import os
import Security

private let fingerprintPrefix = "sha256/"
private let fingerprintBase64Length = 44
private let minimumFingerprints = 2
private let sequenceTag: UInt8 = 0x30
private let versionTag: UInt8 = 0xa0
private let longLengthFlag: UInt8 = 0x80
private let longLengthMask: UInt8 = 0x7f
private let maximumLengthBytes = 4
private let fieldsBeforeSubjectPublicKeyInfo = 5
let pinsFileName = "pins.json"

/// Operational log of the pinning decisions: host and verdict only, never key material.
let pinningLog = Logger(subsystem: "cz.veevoy.ansora.core.mobile", category: "network-pinning")

final class InvalidFingerprintException: GenericException<String>, @unchecked Sendable {
  override var code: String { "pinning-fingerprint-invalid" }
  override var reason: String { "The fingerprint \(param) is not sha256/ followed by a base64 SHA-256 of the SPKI" }
}

final class TooFewFingerprintsException: GenericException<Int>, @unchecked Sendable {
  override var code: String { "pinning-fingerprints-too-few" }
  override var reason: String { "Pinning needs a primary and a backup fingerprint, got \(param)" }
}

final class EmptyHostException: Exception, @unchecked Sendable {
  override var code: String { "pinning-host-empty" }
  override var reason: String { "The pinned host is empty" }
}

final class PinsNotPersistedException: Exception, @unchecked Sendable {
  override var code: String { "pinning-pins-not-persisted" }
  override var reason: String { "The pins could not be kept for the background session" }
}

/// Fingerprints per host ✓ CAP-010-R06; read on the network threads, replaced from JavaScript ✓ CAP-010-R07.
/// They also live in a file: the background session challenges the app before JavaScript runs ✓ CAP-010-R08.
final class PinStore: @unchecked Sendable {
  static let shared = PinStore()

  private let lock = NSLock()
  private let file = PinFile()
  private lazy var pinsByHost: [String: Set<String>] = file.load()

  func replace(host: String, fingerprints: [String]) throws {
    let key = host.trimmingCharacters(in: .whitespaces).lowercased()
    guard !key.isEmpty else {
      throw EmptyHostException()
    }
    let pins = try Self.validated(fingerprints)
    lock.lock()
    defer { lock.unlock() }
    pinsByHost[key] = pins
    do {
      try file.save(pinsByHost)
    } catch {
      throw PinsNotPersistedException()
    }
  }

  func pins(for host: String) -> Set<String>? {
    lock.lock()
    defer { lock.unlock() }
    return pinsByHost[host.lowercased()]
  }

  static func validated(_ fingerprints: [String]) throws -> Set<String> {
    let pins = Set(fingerprints)
    if let malformed = pins.first(where: { !SpkiPinning.isFingerprint($0) }) {
      throw InvalidFingerprintException(malformed)
    }
    guard pins.count >= minimumFingerprints else {
      throw TooFewFingerprintsException(pins.count)
    }
    return pins
  }
}

/// `vault/pins.json`, readable from the first unlock like the queue ✓ NAB-412.
private struct PinFile {
  private let fileManager = FileManager.default

  func load() -> [String: Set<String>] {
    guard let url = try? url(), let data = fileManager.contents(atPath: url.path),
          let stored = (try? JSONSerialization.jsonObject(with: data)) as? [String: [String]] else {
      return [:]
    }
    return stored.compactMapValues { try? PinStore.validated($0) }
  }

  func save(_ pinsByHost: [String: Set<String>]) throws {
    let data = try JSONSerialization.data(withJSONObject: pinsByHost.mapValues { $0.sorted() })
    try data.write(to: try url(), options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
  }

  private func url() throws -> URL {
    try VaultLayout.root(fileManager: fileManager).appendingPathComponent(pinsFileName)
  }
}

enum SpkiPinning {
  static func isFingerprint(_ value: String) -> Bool {
    guard value.hasPrefix(fingerprintPrefix) else {
      return false
    }
    let encoded = String(value.dropFirst(fingerprintPrefix.count))
    guard encoded.count == fingerprintBase64Length, let decoded = Data(base64Encoded: encoded) else {
      return false
    }
    return decoded.count == SHA256.byteCount
  }

  static func fingerprint(of certificate: SecCertificate) -> String? {
    guard let subjectPublicKeyInfo = subjectPublicKeyInfo(in: SecCertificateCopyData(certificate) as Data) else {
      return nil
    }
    return fingerprintPrefix + Data(SHA256.hash(data: subjectPublicKeyInfo)).base64EncodedString()
  }

  /// One decision for every server-trust challenge of a pinned host ✓ CAP-010-R05, CAP-010-R06.
  static func decide(
    _ challenge: URLAuthenticationChallenge,
    completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void
  ) {
    let space = challenge.protectionSpace
    guard space.authenticationMethod == NSURLAuthenticationMethodServerTrust, let trust = space.serverTrust else {
      completionHandler(.performDefaultHandling, nil)
      return
    }
    guard let pins = PinStore.shared.pins(for: space.host) else {
      pinningLog.info("host \(space.host, privacy: .public) has no pins, system trust decides")
      completionHandler(.performDefaultHandling, nil)
      return
    }
    guard evaluate(trust: trust, pins: pins) else {
      pinningLog.error("host \(space.host, privacy: .public) refused: public key matches no fingerprint")
      completionHandler(.cancelAuthenticationChallenge, nil)
      return
    }
    pinningLog.info("host \(space.host, privacy: .public) accepted by fingerprint")
    completionHandler(.useCredential, URLCredential(trust: trust))
  }

  /// The system validates the chain and the host name first; the pin then decides ✓ CAP-010-R05, R06.
  static func evaluate(trust: SecTrust, pins: Set<String>) -> Bool {
    var error: CFError?
    guard SecTrustEvaluateWithError(trust, &error) else {
      return false
    }
    guard let chain = SecTrustCopyCertificateChain(trust) as? [SecCertificate],
          let leaf = chain.first,
          let fingerprint = fingerprint(of: leaf) else {
      return false
    }
    return pins.contains(fingerprint)
  }

  /// RFC 5280: Certificate ::= SEQUENCE { tbsCertificate ::= SEQUENCE { [0] version OPTIONAL, serialNumber,
  /// signature, issuer, validity, subject, subjectPublicKeyInfo, ... }, ... }. Returns the whole SPKI element.
  static func subjectPublicKeyInfo(in der: Data) -> Data? {
    let bytes = [UInt8](der)
    guard let certificate = DerElement(bytes, at: 0), certificate.tag == sequenceTag,
          let tbsCertificate = DerElement(bytes, at: certificate.contentStart), tbsCertificate.tag == sequenceTag else {
      return nil
    }
    var cursor = tbsCertificate.contentStart
    if let version = DerElement(bytes, at: cursor), version.tag == versionTag {
      cursor = version.end
    }
    for _ in 0..<fieldsBeforeSubjectPublicKeyInfo {
      guard let field = DerElement(bytes, at: cursor), field.end <= tbsCertificate.end else {
        return nil
      }
      cursor = field.end
    }
    guard let subjectPublicKeyInfo = DerElement(bytes, at: cursor), subjectPublicKeyInfo.tag == sequenceTag,
          subjectPublicKeyInfo.end <= tbsCertificate.end else {
      return nil
    }
    return Data(bytes[cursor..<subjectPublicKeyInfo.end])
  }
}

/// One tag-length-value element of DER with every read bounds-checked.
private struct DerElement {
  let tag: UInt8
  let contentStart: Int
  let end: Int

  init?(_ bytes: [UInt8], at offset: Int) {
    guard offset + 1 < bytes.count else {
      return nil
    }
    tag = bytes[offset]
    let first = bytes[offset + 1]
    var length = Int(first)
    var cursor = offset + 2
    if first & longLengthFlag != 0 {
      let count = Int(first & longLengthMask)
      guard count > 0, count <= maximumLengthBytes, cursor + count <= bytes.count else {
        return nil
      }
      length = 0
      for byte in bytes[cursor..<cursor + count] {
        length = length << 8 | Int(byte)
      }
      cursor += count
    }
    guard cursor + length <= bytes.count else {
      return nil
    }
    contentStart = cursor
    end = cursor + length
  }
}
