import AVFoundation
import ExpoModulesCore
import QuartzCore

// CAP-018-R02
private let analysisInterval: CFTimeInterval = 0.1

struct EdgesUpdate {
  let edges: PreviewEdges?
  let isFound: Bool
}

// NAB-191, CAP-018-R02, CAP-018-R04, CAP-015-R10
final class DocumentScannerCamera: NSObject, AVCaptureVideoDataOutputSampleBufferDelegate {
  let session = AVCaptureSession()
  var onEdges: ((EdgesUpdate) -> Void)?
  var onUnavailable: (() -> Void)?

  private let sessionQueue = DispatchQueue(label: "cz.veevoy.ansora.core.mobile.document-scanner.session")
  private let videoQueue = DispatchQueue(label: "cz.veevoy.ansora.core.mobile.document-scanner.video")
  private let photoOutput = AVCapturePhotoOutput()
  private let videoOutput = AVCaptureVideoDataOutput()
  private var runtimeErrors: NSObjectProtocol?

  private var device: AVCaptureDevice?
  private var isConfigured = false
  private var shouldRun = false
  private var torchMode = TorchMode.off
  private var captures: [Int64: PhotoCapture] = [:]

  private var isAnalysing = false
  private var lastAnalysis: CFTimeInterval = 0
  private var tracker = EdgeTracker()

  override init() {
    super.init()
    runtimeErrors = NotificationCenter.default.addObserver(
      forName: AVCaptureSession.runtimeErrorNotification, object: session, queue: nil
    ) { [weak self] _ in
      self?.restartAfterRuntimeError()
    }
  }

  deinit {
    if let runtimeErrors {
      NotificationCenter.default.removeObserver(runtimeErrors)
    }
    let session = session
    sessionQueue.async {
      session.stopRunning()
    }
  }

  // NAB-058, E16
  func run(torchMode: TorchMode, onRunning: @escaping () -> Void) {
    videoQueue.async {
      guard !self.isAnalysing else {
        return
      }
      self.tracker.reset()
      self.isAnalysing = true
    }
    sessionQueue.async {
      self.shouldRun = true
      self.torchMode = torchMode
      guard AVCaptureDevice.authorizationStatus(for: .video) == .authorized, self.configureIfNeeded() else {
        self.reportUnavailable()
        return
      }
      self.photoOutput.connection(with: .video)?.rotateToPortrait()
      if !self.session.isRunning {
        self.session.startRunning()
      }
      self.applyTorch()
      DispatchQueue.main.async(execute: onRunning)
    }
  }

  func stop() {
    videoQueue.async {
      self.isAnalysing = false
      self.tracker.reset()
    }
    sessionQueue.async {
      self.shouldRun = false
      self.session.stopRunning()
    }
  }

  func tearDown() {
    stop()
    sessionQueue.async {
      self.session.beginConfiguration()
      self.session.inputs.forEach(self.session.removeInput)
      self.session.outputs.forEach(self.session.removeOutput)
      self.session.commitConfiguration()
      self.videoOutput.setSampleBufferDelegate(nil, queue: nil)
      self.device = nil
      self.isConfigured = false
    }
  }

  // CAP-015-R10
  func setTorch(_ mode: TorchMode) {
    sessionQueue.async {
      self.torchMode = mode
      self.applyTorch()
    }
  }

  // CAP-018-R02
  func capturePhoto(_ completion: @escaping (Result<Data, Error>) -> Void) {
    sessionQueue.async {
      guard self.session.isRunning else {
        completion(.failure(ScannerNotReadyException()))
        return
      }
      let settings = self.photoSettings()
      let id = settings.uniqueID
      let capture = PhotoCapture { result in
        self.sessionQueue.async {
          self.captures[id] = nil
        }
        completion(result)
      }
      self.captures[id] = capture
      self.photoOutput.capturePhoto(with: settings, delegate: capture)
    }
  }

  func captureOutput(_ output: AVCaptureOutput, didOutput sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) {
    let now = CACurrentMediaTime()
    guard isAnalysing, now - lastAnalysis >= analysisInterval, let buffer = CMSampleBufferGetImageBuffer(sampleBuffer)
    else {
      return
    }
    lastAnalysis = now
    tracker.track(PageDetection.page(in: buffer, orientation: PageGeometry.portraitVisionOrientation))
    let frame = PageGeometry.portraitSize(width: CVPixelBufferGetWidth(buffer), height: CVPixelBufferGetHeight(buffer))
    let edges = tracker.quad.map { PreviewEdges(quad: $0, frame: frame) }
    onEdges?(EdgesUpdate(edges: edges, isFound: tracker.isFound))
  }

  private func reportUnavailable() {
    guard let onUnavailable else {
      return
    }
    DispatchQueue.main.async(execute: onUnavailable)
  }

  private func configureIfNeeded() -> Bool {
    guard !isConfigured else {
      return true
    }
    guard let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back),
      let input = try? AVCaptureDeviceInput(device: device)
    else {
      return false
    }
    session.beginConfiguration()
    guard session.canAddInput(input) else {
      session.commitConfiguration()
      return false
    }
    session.addInput(input)
    if session.canSetSessionPreset(.photo) {
      session.sessionPreset = .photo
    }
    guard session.canAddOutput(photoOutput), session.canAddOutput(videoOutput) else {
      session.removeInput(input)
      session.commitConfiguration()
      return false
    }
    session.addOutput(photoOutput)
    videoOutput.alwaysDiscardsLateVideoFrames = true
    videoOutput.setSampleBufferDelegate(self, queue: videoQueue)
    session.addOutput(videoOutput)
    session.commitConfiguration()
    configurePhotoDimensions(of: device)
    configureFocus(of: device)
    self.device = device
    isConfigured = true
    return true
  }

  // CAP-018-R02
  private func configurePhotoDimensions(of device: AVCaptureDevice) {
    let supported = device.activeFormat.supportedMaxPhotoDimensions.map { (width: Int($0.width), height: Int($0.height)) }
    guard let largest = PageGeometry.photoDimensions(supported: supported) else {
      return
    }
    photoOutput.maxPhotoDimensions = CMVideoDimensions(width: Int32(largest.width), height: Int32(largest.height))
  }

  // NAB-194
  private func configureFocus(of device: AVCaptureDevice) {
    guard (try? device.lockForConfiguration()) != nil else {
      return
    }
    if device.isFocusModeSupported(.continuousAutoFocus) {
      device.focusMode = .continuousAutoFocus
    }
    if device.isAutoFocusRangeRestrictionSupported {
      device.autoFocusRangeRestriction = .near
    }
    if device.isExposureModeSupported(.continuousAutoExposure) {
      device.exposureMode = .continuousAutoExposure
    }
    device.unlockForConfiguration()
  }

  private func photoSettings() -> AVCapturePhotoSettings {
    let settings =
      photoOutput.availablePhotoCodecTypes.contains(.jpeg)
      ? AVCapturePhotoSettings(format: [AVVideoCodecKey: AVVideoCodecType.jpeg])
      : AVCapturePhotoSettings()
    settings.maxPhotoDimensions = photoOutput.maxPhotoDimensions
    settings.photoQualityPrioritization = .balanced
    if photoOutput.supportedFlashModes.contains(.off) {
      settings.flashMode = .off
    }
    return settings
  }

  // CAP-015-R10
  private func applyTorch() {
    guard let device, session.isRunning, device.hasTorch else {
      return
    }
    let mode: AVCaptureDevice.TorchMode = torchMode == .on ? .on : .off
    guard device.torchMode != mode, device.isTorchModeSupported(mode), mode == .off || device.isTorchAvailable,
      (try? device.lockForConfiguration()) != nil
    else {
      return
    }
    device.torchMode = mode
    device.unlockForConfiguration()
  }

  private func restartAfterRuntimeError() {
    sessionQueue.async {
      guard self.shouldRun, !self.session.isRunning else {
        return
      }
      self.session.startRunning()
      self.applyTorch()
    }
  }
}

private final class PhotoCapture: NSObject, AVCapturePhotoCaptureDelegate {
  private let completion: (Result<Data, Error>) -> Void
  private var photo: Data?
  private var failure: Error?

  init(completion: @escaping (Result<Data, Error>) -> Void) {
    self.completion = completion
  }

  func photoOutput(_ output: AVCapturePhotoOutput, didFinishProcessingPhoto photo: AVCapturePhoto, error: Error?) {
    guard error == nil, let data = photo.fileDataRepresentation() else {
      failure = PhotoUnreadableException()
      return
    }
    self.photo = data
  }

  func photoOutput(
    _ output: AVCapturePhotoOutput, didFinishCaptureFor resolvedSettings: AVCaptureResolvedPhotoSettings, error: Error?
  ) {
    guard error == nil, let photo else {
      completion(.failure(failure ?? PhotoUnreadableException()))
      return
    }
    completion(.success(photo))
  }
}

extension AVCaptureConnection {
  func rotateToPortrait() {
    if #available(iOS 17.0, *) {
      if isVideoRotationAngleSupported(PageGeometry.portraitRotationAngle) {
        videoRotationAngle = PageGeometry.portraitRotationAngle
      }
      return
    }
    if isVideoOrientationSupported {
      videoOrientation = .portrait
    }
  }
}
