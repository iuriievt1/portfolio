import ExpoModulesCore
import Foundation

private let sessionIdentifierSuffix = "background-queue"
private let uploadsDirectoryName = "uploads"
private let bodyExtension = "body"
private let resultExtension = "result"
private let boundaryPrefix = "ansora-vulna-"
private let lineBreak = "\r\n"
private let copyChunkBytes = 1_048_576
private let uploadFinishedEvent = "uploadFinished"
private let uploadFailedEvent = "uploadFailed"
private let uploadStage = "upload"
private let certificateFailure = "certificate"
private let networkFailure = "network"
private let httpMethod = "POST"
private let contentTypeHeader = "Content-Type"
private let retryAfterHeader = "Retry-After"
// RFC 9110, api/README.md 5
private let waitingStatuses: Set<Int> = [429, 503]
private let uploadIdPattern = "^[A-Za-z0-9_-]{1,128}$"
private let stemSeparator = "."
private let uploadSchemes: Set<String> = ["https", "http"]
private let certificateErrorCodes: Set<Int> = [
  NSURLErrorUserCancelledAuthentication,
  NSURLErrorSecureConnectionFailed,
  NSURLErrorServerCertificateHasBadDate,
  NSURLErrorServerCertificateUntrusted,
  NSURLErrorServerCertificateHasUnknownRoot,
  NSURLErrorServerCertificateNotYetValid,
]

struct UploadField: Record {
  @Field var name: String = ""
  @Field var value: String = ""
  @Field var contentType: String? = nil
}

struct UploadFile: Record {
  @Field var name: String = ""
  @Field var path: String = ""
  @Field var filename: String = ""
  @Field var contentType: String = "application/octet-stream"
}

struct UploadRequest: Record {
  @Field var id: String = ""
  @Field var url: String = ""
  @Field var headers: [String: String] = [:]
  @Field var fields: [UploadField] = []
  @Field var files: [UploadFile] = []
}

final class UploadIdInvalidException: GenericException<String>, @unchecked Sendable {
  override var code: String { "upload-id-invalid" }
  override var reason: String { "The upload id \(param) is not a short name of letters, digits, dash and underscore" }
}

final class UploadUrlInvalidException: GenericException<String>, @unchecked Sendable {
  override var code: String { "upload-url-invalid" }
  override var reason: String { "The upload address \(param) is not an http(s) address with a host" }
}

final class UploadFileMissingException: GenericException<String>, @unchecked Sendable {
  override var code: String { "upload-file-missing" }
  override var reason: String { "The file to upload is not readable at \(param)" }
}

final class UploadNotScheduledException: GenericException<String>, @unchecked Sendable {
  override var code: String { "upload-not-scheduled" }
  override var reason: String { "The upload \(param) was not started because the queue was erased" }
}

/// Background upload of one queue file with the device locked ✓ NAB-205, NAB-412. The system process
/// that sends it verifies the server by the same pins as the foreground ✓ CAP-010-R08, CAP-010-S06.
public final class BackgroundQueueModule: Module {
  public func definition() -> ModuleDefinition {
    Name("BackgroundQueue")

    Events(uploadFinishedEvent, uploadFailedEvent)

    // ADR-014
    Constant("announcesFiles") { false }

    OnCreate { [weak self] in
      BackgroundTransfer.shared.onResult = { [weak self] result in
        self?.sendEvent(result.failure == nil ? uploadFinishedEvent : uploadFailedEvent, result.payload)
      }
    }

    AsyncFunction("upload") { (request: UploadRequest) in
      try BackgroundTransfer.shared.start(request)
    }

    AsyncFunction("pending") { (promise: Promise) in
      BackgroundTransfer.shared.pending { promise.resolve($0) }
    }

    AsyncFunction("takeResults") { () -> [[String: Any]] in
      try BackgroundTransfer.shared.takeResults()
    }

    // CAP-007-R04
    AsyncFunction("cancelAll") { (promise: Promise) in
      BackgroundTransfer.shared.cancelAll { promise.resolve(nil) }
    }
  }
}

/// Keeps the completion handler the system hands over when it wakes the app for the session.
public final class BackgroundSessionHandler: ExpoAppDelegateSubscriber {
  private var completionHandlers: [String: () -> Void] = [:]

  public func application(
    _ application: UIApplication,
    handleEventsForBackgroundURLSession identifier: String,
    completionHandler: @escaping () -> Void
  ) {
    completionHandlers[identifier] = completionHandler
    BackgroundTransfer.shared.attach()
  }

  func invokeCompletionHandler(for identifier: String) {
    guard let handler = completionHandlers.removeValue(forKey: identifier) else {
      return
    }
    DispatchQueue.main.async(execute: handler)
  }
}

struct UploadResult {
  let id: String
  let status: Int?
  let body: String?
  let failure: String?
  let code: Int?

  var payload: [String: Any] {
    [
      "id": id,
      "stage": uploadStage,
      "status": orNull(status),
      "body": orNull(body),
      "failure": orNull(failure),
      "code": orNull(code),
    ]
  }

  private func orNull(_ value: Any?) -> Any {
    guard let value else {
      return NSNull()
    }
    return value
  }
}

final class BackgroundTransfer: NSObject, URLSessionDataDelegate {
  static let shared = BackgroundTransfer()

  var onResult: ((UploadResult) -> Void)?

  private let lock = NSLock()
  private var backgroundSession: URLSession?
  private var responses: [Int: Data] = [:]
  private let files = UploadFiles()
  private let bodiesLock = NSLock()
  private var startedStems: Set<String> = []
  private var isClosed = false

  private static let sessionIdentifier =
    [Bundle.main.bundleIdentifier, sessionIdentifierSuffix].compactMap { $0 }.joined(separator: ".")

  /// One session per process; the system matches it to the transfers by the identifier.
  private var session: URLSession {
    lock.lock()
    defer { lock.unlock() }
    if let backgroundSession {
      return backgroundSession
    }
    let configuration = URLSessionConfiguration.background(withIdentifier: Self.sessionIdentifier)
    configuration.sessionSendsLaunchEvents = true
    configuration.isDiscretionary = false
    configuration.urlCache = nil
    configuration.requestCachePolicy = .reloadIgnoringLocalCacheData
    configuration.tlsMinimumSupportedProtocolVersion = .TLSv12
    let created = URLSession(configuration: configuration, delegate: self, delegateQueue: nil)
    backgroundSession = created
    return created
  }

  func attach() {
    _ = session
  }

  func start(_ request: UploadRequest) throws {
    guard request.id.range(of: uploadIdPattern, options: .regularExpression) != nil else {
      throw UploadIdInvalidException(request.id)
    }
    guard let url = URL(string: request.url), let scheme = url.scheme, uploadSchemes.contains(scheme), url.host != nil else {
      throw UploadUrlInvalidException(request.url)
    }
    let stem = request.id + stemSeparator + UUID().uuidString
    let boundary = boundaryPrefix + UUID().uuidString
    bodiesLock.lock()
    defer { bodiesLock.unlock() }
    guard !isClosed else {
      throw UploadNotScheduledException(request.id)
    }
    startedStems.insert(stem)
    let body = try files.writeBody(stem: stem, boundary: boundary, fields: request.fields, files: request.files)
    var urlRequest = URLRequest(url: url)
    urlRequest.httpMethod = httpMethod
    for (name, value) in request.headers {
      urlRequest.setValue(value, forHTTPHeaderField: name)
    }
    urlRequest.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: contentTypeHeader)
    let task = session.uploadTask(with: urlRequest, fromFile: body)
    task.taskDescription = stem
    task.resume()
  }

  /// The queue asks what is in flight at every start; a body nobody is sending goes away at the same
  /// moment, so a crash between writing a body and handing it to the system leaves nothing behind.
  func pending(_ completion: @escaping ([String]) -> Void) {
    session.getAllTasks { [self] tasks in
      let stems = Set(tasks.compactMap(\.taskDescription))
      removeOrphanBodies(keeping: stems)
      completion(Array(Set(stems.map(Self.uploadId))))
    }
  }

  func takeResults() throws -> [[String: Any]] {
    try files.takeResults()
  }

  // CAP-007-R04
  func cancelAll(_ completion: @escaping () -> Void) {
    bodiesLock.lock()
    isClosed = true
    startedStems.removeAll()
    bodiesLock.unlock()
    session.getAllTasks { tasks in
      tasks.forEach { $0.cancel() }
      completion()
    }
  }

  /// The session talks to the server only; a host without pins gets nothing ✓ CAP-010-R06, CAP-010-R08.
  func urlSession(
    _ session: URLSession,
    didReceive challenge: URLAuthenticationChallenge,
    completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void
  ) {
    let space = challenge.protectionSpace
    guard space.authenticationMethod == NSURLAuthenticationMethodServerTrust, let trust = space.serverTrust else {
      completionHandler(.performDefaultHandling, nil)
      return
    }
    guard let pins = PinStore.shared.pins(for: space.host) else {
      pinningLog.error("background session refused host \(space.host, privacy: .public): no pins")
      completionHandler(.cancelAuthenticationChallenge, nil)
      return
    }
    guard SpkiPinning.evaluate(trust: trust, pins: pins) else {
      pinningLog.error("background session refused host \(space.host, privacy: .public): public key matches no fingerprint")
      completionHandler(.cancelAuthenticationChallenge, nil)
      return
    }
    completionHandler(.useCredential, URLCredential(trust: trust))
  }

  func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive data: Data) {
    lock.lock()
    defer { lock.unlock() }
    responses[dataTask.taskIdentifier, default: Data()].append(data)
  }

  func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
    lock.lock()
    let data = responses.removeValue(forKey: task.taskIdentifier)
    lock.unlock()
    guard let stem = task.taskDescription, !isErased(stem, error: error) else {
      return
    }
    if error == nil, resendsLater(task, stem: stem) {
      return
    }
    let result = UploadResult(
      id: Self.uploadId(of: stem),
      status: (task.response as? HTTPURLResponse)?.statusCode,
      body: data.flatMap { String(data: $0, encoding: .utf8) },
      failure: error.map { Self.failure(of: $0 as NSError) },
      code: (error as NSError?)?.code
    )
    bodiesLock.lock()
    startedStems.remove(stem)
    files.removeBody(stem: stem)
    bodiesLock.unlock()
    try? files.writeResult(result)
    onResult?(result)
  }

  // CAP-007-R04
  private func isErased(_ stem: String, error: Error?) -> Bool {
    bodiesLock.lock()
    defer { bodiesLock.unlock() }
    let isCancelled = (error as NSError?)?.code == NSURLErrorCancelled
    return isClosed || (isCancelled && files.existingBody(stem: stem) == nil)
  }

  // CAP-019-R13, RFC 9110
  private func resendsLater(_ task: URLSessionTask, stem: String) -> Bool {
    guard let response = task.response as? HTTPURLResponse, waitingStatuses.contains(response.statusCode),
          let seconds = Self.retryAfterSeconds(of: response), let request = task.originalRequest else {
      return false
    }
    bodiesLock.lock()
    defer { bodiesLock.unlock() }
    guard !isClosed, let body = files.existingBody(stem: stem) else {
      return false
    }
    let next = session.uploadTask(with: request, fromFile: body)
    next.taskDescription = stem
    next.earliestBeginDate = Date().addingTimeInterval(TimeInterval(seconds))
    next.resume()
    return true
  }

  private static func retryAfterSeconds(of response: HTTPURLResponse) -> Int? {
    guard let value = response.value(forHTTPHeaderField: retryAfterHeader),
          let seconds = Int(value.trimmingCharacters(in: .whitespaces)), seconds >= 0 else {
      return nil
    }
    return seconds
  }

  private func removeOrphanBodies(keeping stems: Set<String>) {
    bodiesLock.lock()
    defer { bodiesLock.unlock() }
    files.removeBodies(except: stems.union(startedStems))
  }

  func urlSessionDidFinishEvents(forBackgroundURLSession session: URLSession) {
    guard let identifier = session.configuration.identifier else {
      return
    }
    DispatchQueue.main.async {
      ExpoAppDelegateSubscriberRepository.getSubscriberOfType(BackgroundSessionHandler.self)?
        .invokeCompletionHandler(for: identifier)
    }
  }

  private static func failure(of error: NSError) -> String {
    certificateErrorCodes.contains(error.code) ? certificateFailure : networkFailure
  }

  /// Every attempt gets its own body, so a retry never truncates a file the system is still sending.
  private static func uploadId(of stem: String) -> String {
    stem.components(separatedBy: stemSeparator).first ?? stem
  }
}

/// Bodies and results live in the vault and open from the first unlock, like the queue key ✓ NAB-412.
private final class UploadFiles {
  private let fileManager = FileManager.default
  private let lock = NSLock()
  private let protection: [FileAttributeKey: Any] = [
    .protectionKey: FileProtectionType.completeUntilFirstUserAuthentication,
  ]

  func writeBody(stem: String, boundary: String, fields: [UploadField], files: [UploadFile]) throws -> URL {
    for file in files where !fileManager.isReadableFile(atPath: file.path) {
      throw UploadFileMissingException(file.path)
    }
    let url = try bodyURL(stem: stem)
    guard fileManager.createFile(atPath: url.path, contents: nil, attributes: protection) else {
      throw UploadFileMissingException(url.path)
    }
    do {
      try fill(url, boundary: boundary, fields: fields, files: files)
    } catch {
      try? fileManager.removeItem(at: url)
      throw error
    }
    return url
  }

  func existingBody(stem: String) -> URL? {
    guard let url = try? bodyURL(stem: stem), fileManager.isReadableFile(atPath: url.path) else {
      return nil
    }
    return url
  }

  func removeBody(stem: String) {
    guard let url = try? bodyURL(stem: stem) else {
      return
    }
    try? fileManager.removeItem(at: url)
  }

  func removeBodies(except stems: Set<String>) {
    guard let urls = try? fileManager.contentsOfDirectory(at: directory(), includingPropertiesForKeys: nil) else {
      return
    }
    for url in urls where url.pathExtension == bodyExtension {
      if !stems.contains(url.deletingPathExtension().lastPathComponent) {
        try? fileManager.removeItem(at: url)
      }
    }
  }

  private func fill(_ url: URL, boundary: String, fields: [UploadField], files: [UploadFile]) throws {
    let handle = try FileHandle(forWritingTo: url)
    defer { try? handle.close() }
    for field in fields {
      var head = "--\(boundary)\(lineBreak)Content-Disposition: form-data; name=\"\(field.name)\"\(lineBreak)"
      if let contentType = field.contentType {
        head += "Content-Type: \(contentType)\(lineBreak)"
      }
      try handle.write(contentsOf: Data((head + lineBreak + field.value + lineBreak).utf8))
    }
    for file in files {
      let head =
        "--\(boundary)\(lineBreak)Content-Disposition: form-data; name=\"\(file.name)\"; filename=\"\(file.filename)\"\(lineBreak)" +
        "Content-Type: \(file.contentType)\(lineBreak)\(lineBreak)"
      try handle.write(contentsOf: Data(head.utf8))
      try copy(from: URL(fileURLWithPath: file.path), to: handle)
      try handle.write(contentsOf: Data(lineBreak.utf8))
    }
    try handle.write(contentsOf: Data("--\(boundary)--\(lineBreak)".utf8))
  }

  func writeResult(_ result: UploadResult) throws {
    let url = try directory().appendingPathComponent(result.id).appendingPathExtension(resultExtension)
    let data = try JSONSerialization.data(withJSONObject: result.payload)
    lock.lock()
    defer { lock.unlock() }
    try data.write(to: url, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
  }

  func takeResults() throws -> [[String: Any]] {
    lock.lock()
    defer { lock.unlock() }
    let urls = try fileManager.contentsOfDirectory(at: try directory(), includingPropertiesForKeys: nil)
      .filter { $0.pathExtension == resultExtension }
    var results: [[String: Any]] = []
    for url in urls {
      if let data = fileManager.contents(atPath: url.path),
         let result = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] {
        results.append(result)
      }
      try fileManager.removeItem(at: url)
    }
    return results
  }

  private func copy(from source: URL, to handle: FileHandle) throws {
    let reader = try FileHandle(forReadingFrom: source)
    defer { try? reader.close() }
    while let chunk = try reader.read(upToCount: copyChunkBytes), !chunk.isEmpty {
      try handle.write(contentsOf: chunk)
    }
  }

  private func bodyURL(stem: String) throws -> URL {
    try directory().appendingPathComponent(stem).appendingPathExtension(bodyExtension)
  }

  private func directory() throws -> URL {
    let directory = try VaultLayout.root(fileManager: fileManager).appendingPathComponent(uploadsDirectoryName, isDirectory: true)
    guard !fileManager.fileExists(atPath: directory.path) else {
      return directory
    }
    try fileManager.createDirectory(at: directory, withIntermediateDirectories: true, attributes: protection)
    return directory
  }
}
