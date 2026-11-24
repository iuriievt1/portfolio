import Expo
import ExpoModulesCore
import Foundation
import React

private let wifiOnlyKey = "ReactNetworkForceWifiOnly"

public final class NetworkPinningModule: Module {
  public func definition() -> ModuleDefinition {
    Name("NetworkPinning")

    AsyncFunction("setPins") { (host: String, fingerprints: [String]) in
      try PinStore.shared.replace(host: host, fingerprints: fingerprints)
      pinningLog.info("pins replaced for host \(host, privacy: .public): \(fingerprints.count) fingerprints")
    }
  }

  /// React Native's own session defaults plus the TLS floor ✓ CAP-010-R04.
  static func sessionConfiguration() -> URLSessionConfiguration {
    let configuration = URLSessionConfiguration.default
    if let wifiOnly = Bundle.main.object(forInfoDictionaryKey: wifiOnlyKey) as? Bool {
      configuration.allowsCellularAccess = !wifiOnly
    }
    configuration.httpShouldSetCookies = true
    configuration.httpCookieAcceptPolicy = .always
    configuration.httpCookieStorage = HTTPCookieStorage.shared
    configuration.tlsMinimumSupportedProtocolVersion = .TLSv12
    return configuration
  }
}

/// Both native sessions the app's JavaScript can reach get the same configuration before any request:
/// Expo's `fetch`, which is the global `fetch` since SDK 54, and React Native's, which still carries
/// `XMLHttpRequest` and image loading ✓ CAP-010-R04, CAP-010-R05.
public final class NetworkPinningSubscriber: ExpoAppDelegateSubscriber {
  @MainActor
  public func subscriberDidRegister() {
    RCTSetCustomNSURLSessionConfigurationProvider { NetworkPinningModule.sessionConfiguration() }
    ExpoFetchCustomExtension.setCustomURLSessionConfigurationProvider { NetworkPinningModule.sessionConfiguration() }
  }
}

/// Expo's `fetch` runs on a session whose delegate forwards only task-level events; a server-trust
/// challenge is a session-level event, so it is decided here for every host with pins
/// ✓ CAP-010-R05, CAP-010-R14. The same delegate carries Expo's development network inspector.
extension URLSessionSessionDelegateProxy {
  @objc(URLSession:didReceiveChallenge:completionHandler:)
  public func urlSession(
    _ session: URLSession,
    didReceive challenge: URLAuthenticationChallenge,
    completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void
  ) {
    SpkiPinning.decide(challenge, completionHandler: completionHandler)
  }
}

/// React Native's session delegate leaves server trust to the system; a pinned host is decided here,
/// at the session level for a direct connection and at the task level when a `URLProtocol` carries
/// the request and forwards the challenge ✓ CAP-010-R05, CAP-010-R14.
extension RCTHTTPRequestHandler {
  @objc(URLSession:didReceiveChallenge:completionHandler:)
  public func urlSession(
    _ session: URLSession,
    didReceive challenge: URLAuthenticationChallenge,
    completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void
  ) {
    SpkiPinning.decide(challenge, completionHandler: completionHandler)
  }

  @objc(URLSession:task:didReceiveChallenge:completionHandler:)
  public func urlSession(
    _ session: URLSession,
    task: URLSessionTask,
    didReceive challenge: URLAuthenticationChallenge,
    completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void
  ) {
    SpkiPinning.decide(challenge, completionHandler: completionHandler)
  }
}
