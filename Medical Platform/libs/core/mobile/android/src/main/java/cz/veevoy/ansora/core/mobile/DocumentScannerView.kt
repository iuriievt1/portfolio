package cz.veevoy.ansora.core.mobile

import android.animation.ValueAnimator
import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.camera.view.PreviewView
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import java.lang.ref.WeakReference

// A.1 Skener
private const val EDGE_LINE_WIDTH_DP = 3f
private const val EDGE_ANIMATION_MILLISECONDS = 100L

// NAB-191–195, CAP-018-R02, CAP-018-R03, CAP-015-R10, E16
class DocumentScannerView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  override val shouldUseAndroidLayout = true

  private val onEdgesChange by EventDispatcher()
  private val onCameraUnavailable by EventDispatcher()

  var isActive = false
    set(value) {
      field = value
      updateRunning()
    }

  var torchMode = TorchMode.OFF
    set(value) {
      field = value
      camera.setTorch(value)
    }

  // A.1 Skener
  var edgeColor: Int? = null
    set(value) {
      field = value
      edgesView.strokeColor = value
    }

  var edgeFillColor: Int? = null
    set(value) {
      field = value
      edgesView.fillColor = value
    }

  private val previewView = PreviewView(context).apply {
    scaleType = PreviewView.ScaleType.FILL_CENTER
    implementationMode = PreviewView.ImplementationMode.COMPATIBLE
  }
  private val edgesView = EdgesOverlay(context)
  private val camera = DocumentScannerCamera(context, previewView)
  private var isInForeground = true
  private var isRunning = false
  private var isCapturing = false
  private var isFound = false
  private var edges: PreviewEdges? = null

  init {
    setBackgroundColor(Color.BLACK)
    clipChildren = true
    val frame = FrameLayout(context)
    frame.addView(previewView, FrameLayout.LayoutParams(MATCH, MATCH))
    frame.addView(edgesView, FrameLayout.LayoutParams(MATCH, MATCH))
    addView(frame, LayoutParams(MATCH, MATCH))
    camera.onEdges = { update -> show(update) }
    camera.onUnavailable = { onCameraUnavailable(mapOf()) }
    DocumentScannerViews.add(this)
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    updateRunning()
  }

  override fun onDetachedFromWindow() {
    super.onDetachedFromWindow()
    updateRunning()
  }

  override fun onSizeChanged(width: Int, height: Int, oldWidth: Int, oldHeight: Int) {
    super.onSizeChanged(width, height, oldWidth, oldHeight)
    drawEdges(animated = false)
  }

  // CAP-018-R02
  internal fun capturePage(pages: DocumentScannerPages, promise: Promise) {
    if (!isRunning || !camera.isRunning || isCapturing) {
      promise.reject(ScannerNotReadyException())
      return
    }
    isCapturing = true
    val preview = edges
    camera.capturePhoto { result ->
      post { isCapturing = false }
      result.fold(
        onSuccess = { photo -> pages.capture(photo, preview, promise) },
        onFailure = { failure -> promise.reject(failure as? CodedException ?: PhotoUnreadableException()) },
      )
    }
  }

  internal fun enteredForeground(isForeground: Boolean) {
    isInForeground = isForeground
    updateRunning()
  }

  internal fun tearDown() {
    DocumentScannerViews.remove(this)
    isRunning = false
    camera.tearDown()
  }

  private fun updateRunning() {
    val shouldRun = isActive && isAttachedToWindow && isInForeground
    if (shouldRun == isRunning) {
      return
    }
    isRunning = shouldRun
    if (!shouldRun) {
      camera.stop()
      clearEdges()
      return
    }
    camera.run(torchMode)
  }

  private fun show(update: EdgesUpdate) {
    if (!isRunning) {
      return
    }
    edges = update.edges
    drawEdges(animated = true)
    report(update.isFound)
  }

  private fun clearEdges() {
    edges = null
    drawEdges(animated = false)
    report(false)
  }

  private fun report(found: Boolean) {
    if (found == isFound) {
      return
    }
    isFound = found
    onEdgesChange(mapOf("found" to found))
  }

  // A.1 Skener
  private fun drawEdges(animated: Boolean) {
    val current = edges
    val layer = PageSize(width.toDouble(), height.toDouble())
    edgesView.show(current?.let { it.quad.layerPoints(it.frame, layer) }, animated)
  }

  private companion object {
    const val MATCH = ViewGroup.LayoutParams.MATCH_PARENT
  }
}

// A.1 Skener
private class EdgesOverlay(context: Context) : View(context) {
  var strokeColor: Int? = null
    set(value) {
      field = value
      invalidate()
    }

  var fillColor: Int? = null
    set(value) {
      field = value
      invalidate()
    }

  private val stroke = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    style = Paint.Style.STROKE
    strokeWidth = EDGE_LINE_WIDTH_DP * resources.displayMetrics.density
    strokeJoin = Paint.Join.ROUND
  }
  private val fill = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.FILL }
  private val path = Path()
  private var shown: PageQuad? = null
  private var animator: ValueAnimator? = null

  fun show(target: PageQuad?, animated: Boolean) {
    animator?.cancel()
    val from = shown
    if (target == null || from == null || !animated) {
      shown = target
      invalidate()
      return
    }
    animator = ValueAnimator.ofFloat(0f, 1f).apply {
      duration = EDGE_ANIMATION_MILLISECONDS
      addUpdateListener { animation ->
        shown = from.interpolated(target, (animation.animatedValue as Float).toDouble())
        invalidate()
      }
      start()
    }
  }

  override fun onDraw(canvas: Canvas) {
    super.onDraw(canvas)
    val quad = shown ?: return
    path.reset()
    val corners = quad.corners
    path.moveTo(corners[0].x.toFloat(), corners[0].y.toFloat())
    for (corner in corners.drop(1)) {
      path.lineTo(corner.x.toFloat(), corner.y.toFloat())
    }
    path.close()
    fillColor?.let {
      fill.color = it
      canvas.drawPath(path, fill)
    }
    strokeColor?.let {
      stroke.color = it
      canvas.drawPath(path, stroke)
    }
  }
}

internal object DocumentScannerViews {
  private val views = mutableListOf<WeakReference<DocumentScannerView>>()

  @Synchronized
  fun add(view: DocumentScannerView) {
    views.removeAll { it.get() == null }
    views.add(WeakReference(view))
  }

  @Synchronized
  fun remove(view: DocumentScannerView) {
    views.removeAll { it.get() == null || it.get() === view }
  }

  fun enteredForeground(isForeground: Boolean) {
    val live = synchronized(this) { views.mapNotNull { it.get() } }
    live.forEach { view -> view.post { view.enteredForeground(isForeground) } }
  }
}
