import AVFoundation
import ExpoModulesCore
import UIKit

// A.1 Skener
private let edgeLineWidth: CGFloat = 3
private let edgeAnimationSeconds: CFTimeInterval = 0.1

// NAB-191–195, CAP-018-R02, CAP-018-R03, CAP-015-R10, E16
final class DocumentScannerView: ExpoView {
  let onEdgesChange = EventDispatcher()
  let onCameraUnavailable = EventDispatcher()

  var isActive = false {
    didSet {
      updateRunning()
    }
  }

  var torchMode = TorchMode.off {
    didSet {
      camera.setTorch(torchMode)
    }
  }

  // A.1 Skener
  var edgeColor: UIColor? {
    didSet {
      edgesLayer.strokeColor = edgeColor?.cgColor
    }
  }

  var edgeFillColor: UIColor? {
    didSet {
      edgesLayer.fillColor = edgeFillColor?.cgColor
    }
  }

  private let camera: DocumentScannerCamera
  private let previewLayer: AVCaptureVideoPreviewLayer
  private let edgesLayer = CAShapeLayer()
  private var isInForeground = true
  private var isRunning = false
  private var isCapturing = false
  private var isFound = false
  private var edges: PreviewEdges?

  required init(appContext: AppContext? = nil) {
    let camera = DocumentScannerCamera()
    self.camera = camera
    previewLayer = AVCaptureVideoPreviewLayer(session: camera.session)
    super.init(appContext: appContext)
    isInForeground = UIApplication.shared.applicationState != .background
    clipsToBounds = true
    backgroundColor = .black
    previewLayer.videoGravity = .resizeAspectFill
    layer.addSublayer(previewLayer)
    edgesLayer.strokeColor = nil
    edgesLayer.fillColor = nil
    edgesLayer.lineWidth = edgeLineWidth
    edgesLayer.lineJoin = .round
    layer.addSublayer(edgesLayer)
    camera.onEdges = { [weak self] update in
      DispatchQueue.main.async {
        self?.show(update)
      }
    }
    camera.onUnavailable = { [weak self] in
      self?.onCameraUnavailable([:])
    }
    observeApplication()
  }

  deinit {
    camera.tearDown()
  }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    updateRunning()
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    CATransaction.begin()
    CATransaction.setDisableActions(true)
    previewLayer.frame = bounds
    edgesLayer.frame = bounds
    CATransaction.commit()
    drawEdges(animated: false)
  }

  // CAP-018-R02
  func capturePage(_ promise: Promise) {
    guard isRunning, !isCapturing else {
      promise.reject(ScannerNotReadyException())
      return
    }
    isCapturing = true
    let preview = edges
    camera.capturePhoto { [weak self] result in
      DispatchQueue.main.async {
        self?.isCapturing = false
      }
      switch result {
      case let .success(photo):
        DocumentScannerPages.shared.capture(photo: photo, preview: preview, promise: promise)
      case let .failure(error):
        promise.reject(error)
      }
    }
  }

  private func updateRunning() {
    let shouldRun = isActive && window != nil && isInForeground
    guard shouldRun != isRunning else {
      return
    }
    isRunning = shouldRun
    guard shouldRun else {
      camera.stop()
      clearEdges()
      return
    }
    startCamera()
  }

  private func startCamera() {
    camera.run(torchMode: torchMode) { [weak self] in
      self?.previewLayer.connection?.rotateToPortrait()
    }
  }

  private func show(_ update: EdgesUpdate) {
    guard isRunning else {
      return
    }
    edges = update.edges
    drawEdges(animated: true)
    report(found: update.isFound)
  }

  private func clearEdges() {
    edges = nil
    drawEdges(animated: false)
    report(found: false)
  }

  private func report(found: Bool) {
    guard found != isFound else {
      return
    }
    isFound = found
    onEdgesChange(["found": found])
  }

  // A.1 Skener
  private func drawEdges(animated: Bool) {
    CATransaction.begin()
    CATransaction.setDisableActions(!animated)
    CATransaction.setAnimationDuration(edgeAnimationSeconds)
    edgesLayer.path = edges.map { edgesPath($0) }
    CATransaction.commit()
  }

  private func edgesPath(_ edges: PreviewEdges) -> CGPath {
    let points = edges.quad.layerPoints(frame: edges.frame, layer: bounds.size).corners
    let path = CGMutablePath()
    path.addLines(between: points)
    path.closeSubpath()
    return path
  }

  private func observeApplication() {
    let center = NotificationCenter.default
    center.addObserver(
      self, selector: #selector(enteredBackground), name: UIApplication.didEnterBackgroundNotification, object: nil)
    center.addObserver(
      self, selector: #selector(enteringForeground), name: UIApplication.willEnterForegroundNotification, object: nil)
    center.addObserver(
      self, selector: #selector(becameActive), name: UIApplication.didBecomeActiveNotification, object: nil)
  }

  @objc private func enteredBackground() {
    isInForeground = false
    updateRunning()
  }

  @objc private func enteringForeground() {
    isInForeground = true
    updateRunning()
  }

  // NAB-058
  @objc private func becameActive() {
    guard isRunning else {
      return
    }
    startCamera()
  }
}
