package cz.veevoy.ansora.core.mobile

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.SystemClock
import android.util.Log
import android.util.Size
import androidx.camera.core.Camera
import androidx.camera.core.CameraSelector
import androidx.camera.core.CameraState
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.core.resolutionselector.AspectRatioStrategy
import androidx.camera.core.resolutionselector.ResolutionSelector
import androidx.camera.core.resolutionselector.ResolutionStrategy
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.LifecycleRegistry
import java.util.concurrent.Executors

private const val LOG_TAG = "DocumentScanner"
// CAP-018-R02
private const val ANALYSIS_INTERVAL_MILLISECONDS = 100L
private val ANALYSIS_SIZE = Size(640, 480)
private val LARGEST_PHOTO_SIZE = Size(4032, 3024)

internal class EdgesUpdate(val edges: PreviewEdges?, val isFound: Boolean)

// NAB-191, CAP-018-R02, CAP-018-R04, CAP-015-R10, E16
internal class DocumentScannerCamera(private val context: Context, private val previewView: PreviewView) : LifecycleOwner {
  var onEdges: ((EdgesUpdate) -> Unit)? = null
  var onUnavailable: (() -> Unit)? = null

  private val registry = LifecycleRegistry(this)
  override val lifecycle: Lifecycle get() = registry

  private val mainExecutor = ContextCompat.getMainExecutor(context)
  private val analysisExecutor = Executors.newSingleThreadExecutor()
  private val captureExecutor = Executors.newSingleThreadExecutor()
  private val fourByThree = AspectRatioStrategy.RATIO_4_3_FALLBACK_AUTO_STRATEGY
  private val preview = Preview.Builder()
    .setResolutionSelector(ResolutionSelector.Builder().setAspectRatioStrategy(fourByThree).build())
    .build()
  private val analysis = ImageAnalysis.Builder()
    .setResolutionSelector(
      ResolutionSelector.Builder()
        .setAspectRatioStrategy(fourByThree)
        .setResolutionStrategy(
          ResolutionStrategy(ANALYSIS_SIZE, ResolutionStrategy.FALLBACK_RULE_CLOSEST_HIGHER_THEN_LOWER),
        )
        .build(),
    )
    .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
    .build()
  // CAP-018-R02
  private val photo = ImageCapture.Builder()
    .setCaptureMode(ImageCapture.CAPTURE_MODE_MAXIMIZE_QUALITY)
    .setFlashMode(ImageCapture.FLASH_MODE_OFF)
    .setResolutionSelector(
      ResolutionSelector.Builder()
        .setAspectRatioStrategy(fourByThree)
        .setResolutionStrategy(
          ResolutionStrategy(LARGEST_PHOTO_SIZE, ResolutionStrategy.FALLBACK_RULE_CLOSEST_LOWER_THEN_HIGHER),
        )
        .build(),
    )
    .build()

  private var provider: ProcessCameraProvider? = null
  private var camera: Camera? = null
  private var shouldRun = false
  private var torchMode = TorchMode.OFF
  private var isTornDown = false

  private val tracker = EdgeTracker()
  private var lastAnalysis = 0L

  @Volatile private var isAnalysing = false

  init {
    registry.currentState = Lifecycle.State.CREATED
    preview.setSurfaceProvider(previewView.surfaceProvider)
    analysis.setAnalyzer(analysisExecutor, ::analyse)
  }

  val isRunning: Boolean get() = camera != null && registry.currentState.isAtLeast(Lifecycle.State.RESUMED)

  // NAB-058, E16
  fun run(torchMode: TorchMode) {
    if (isTornDown) {
      return
    }
    shouldRun = true
    this.torchMode = torchMode
    analysisExecutor.execute {
      tracker.reset()
      isAnalysing = true
    }
    if (ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
      reportUnavailable()
      return
    }
    val bound = provider
    if (bound != null) {
      resume(bound)
      return
    }
    val future = ProcessCameraProvider.getInstance(context)
    future.addListener(
      {
        val ready = runCatching { future.get() }.getOrNull()
        if (ready == null) {
          reportUnavailable()
          return@addListener
        }
        provider = ready
        if (shouldRun && !isTornDown) {
          resume(ready)
        }
      },
      mainExecutor,
    )
  }

  fun stop() {
    shouldRun = false
    isAnalysing = false
    analysisExecutor.execute { tracker.reset() }
    if (!isTornDown) {
      registry.currentState = Lifecycle.State.CREATED
    }
  }

  fun tearDown() {
    stop()
    isTornDown = true
    provider?.unbind(preview, analysis, photo)
    camera = null
    registry.currentState = Lifecycle.State.DESTROYED
    analysisExecutor.shutdown()
    captureExecutor.shutdown()
  }

  // CAP-015-R10
  fun setTorch(mode: TorchMode) {
    torchMode = mode
    applyTorch()
  }

  // CAP-018-R02
  fun capturePhoto(onResult: (Result<CapturedPhoto>) -> Unit) {
    if (!isRunning) {
      onResult(Result.failure(ScannerNotReadyException()))
      return
    }
    photo.takePicture(
      captureExecutor,
      object : ImageCapture.OnImageCapturedCallback() {
        override fun onCaptureSuccess(image: ImageProxy) {
          val captured = runCatching { image.use { CapturedPhoto(jpegOf(it), it.imageInfo.rotationDegrees) } }
          onResult(captured.recoverCatching { failure -> throw unreadable(failure) })
        }

        override fun onError(exception: ImageCaptureException) {
          onResult(Result.failure(unreadable(exception)))
        }
      },
    )
  }

  private fun resume(provider: ProcessCameraProvider) {
    if (camera == null) {
      val bound = runCatching {
        provider.bindToLifecycle(this, CameraSelector.DEFAULT_BACK_CAMERA, preview, analysis, photo)
      }.getOrElse { failure ->
        Log.w(LOG_TAG, "The scanner camera could not be started", failure)
        reportUnavailable()
        return
      }
      camera = bound
      bound.cameraInfo.cameraState.observe(this) { state -> reportFatal(state) }
    }
    registry.currentState = Lifecycle.State.RESUMED
    applyTorch()
  }

  private fun applyTorch() {
    val current = camera ?: return
    if (!current.cameraInfo.hasFlashUnit() || !isRunning) {
      return
    }
    current.cameraControl.enableTorch(torchMode == TorchMode.ON)
  }

  private fun reportFatal(state: CameraState) {
    val code = state.error?.code ?: return
    if (code == CameraState.ERROR_CAMERA_DISABLED || code == CameraState.ERROR_CAMERA_FATAL_ERROR) {
      reportUnavailable()
    }
  }

  private fun reportUnavailable() {
    mainExecutor.execute { onUnavailable?.invoke() }
  }

  // CAP-018-R02
  private fun analyse(image: ImageProxy) {
    image.use {
      val now = SystemClock.elapsedRealtime()
      if (!isAnalysing || now - lastAnalysis < ANALYSIS_INTERVAL_MILLISECONDS) {
        return
      }
      lastAnalysis = now
      val rotation = it.imageInfo.rotationDegrees
      val detected = PageDetection.page(luminanceOf(it))?.let { quad -> PageGeometry.upright(quad, rotation) }
      tracker.track(detected)
      val frame = PageGeometry.uprightSize(it.width, it.height, rotation)
      val update = EdgesUpdate(tracker.quad?.let { quad -> PreviewEdges(quad, frame) }, tracker.isFound)
      mainExecutor.execute { onEdges?.invoke(update) }
    }
  }

  private fun luminanceOf(image: ImageProxy): Luminance {
    val plane = image.planes[0]
    val buffer = plane.buffer
    val width = image.width
    val height = image.height
    val values = IntArray(width * height)
    val row = ByteArray(plane.rowStride)
    for (y in 0 until height) {
      buffer.position(y * plane.rowStride)
      val length = minOf(plane.rowStride, buffer.remaining())
      buffer.get(row, 0, length)
      for (x in 0 until width) {
        values[y * width + x] = row[x * plane.pixelStride].toInt() and 0xFF
      }
    }
    return Luminance(width, height, values)
  }

  private fun jpegOf(image: ImageProxy): ByteArray {
    val buffer = image.planes[0].buffer
    buffer.rewind()
    return ByteArray(buffer.remaining()).also { buffer.get(it) }
  }

  // E18
  private fun unreadable(failure: Throwable): Exception {
    Log.w(LOG_TAG, "The page photo could not be taken", failure)
    return PhotoUnreadableException()
  }
}
