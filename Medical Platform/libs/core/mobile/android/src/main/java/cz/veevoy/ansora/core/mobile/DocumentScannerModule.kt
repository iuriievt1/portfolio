package cz.veevoy.ansora.core.mobile

import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import expo.modules.kotlin.types.Enumerable

class PageCorner : Record {
  @Field var x: Double = 0.0
  @Field var y: Double = 0.0

  internal fun point(): PagePoint = PagePoint(x, y)

  internal companion object {
    fun of(point: PagePoint): PageCorner = PageCorner().also {
      it.x = point.x
      it.y = point.y
    }
  }
}

class PageCorners : Record {
  @Field var topLeft: PageCorner = PageCorner()
  @Field var topRight: PageCorner = PageCorner()
  @Field var bottomRight: PageCorner = PageCorner()
  @Field var bottomLeft: PageCorner = PageCorner()

  // CAP-018-R10
  internal fun quad(): PageQuad =
    PageQuad.manual(listOf(topLeft, topRight, bottomRight, bottomLeft).map { it.point() })
      ?: throw PhotoUnreadableException()

  internal companion object {
    fun of(quad: PageQuad): PageCorners = PageCorners().also {
      it.topLeft = PageCorner.of(quad.topLeft)
      it.topRight = PageCorner.of(quad.topRight)
      it.bottomRight = PageCorner.of(quad.bottomRight)
      it.bottomLeft = PageCorner.of(quad.bottomLeft)
    }
  }
}

// CAP-018-R10, CAP-018-R11
class CroppedPage : Record {
  @Field var page: EncryptedFile = EncryptedFile()
  @Field var thumbnail: EncryptedFile = EncryptedFile()
  @Field var corners: PageCorners? = null
  @Field var width: Int = 0
  @Field var height: Int = 0
}

// CAP-018-R03, CAP-018-R08
class ScannedPage : Record {
  @Field var page: EncryptedFile = EncryptedFile()
  @Field var thumbnail: EncryptedFile = EncryptedFile()
  @Field var original: EncryptedFile = EncryptedFile()
  @Field var corners: PageCorners? = null
  @Field var width: Int = 0
  @Field var height: Int = 0

  internal companion object {
    fun of(cropped: CroppedPage, original: EncryptedFile): ScannedPage = ScannedPage().also {
      it.page = cropped.page
      it.thumbnail = cropped.thumbnail
      it.original = original
      it.corners = cropped.corners
      it.width = cropped.width
      it.height = cropped.height
    }
  }
}

// CAP-018-R02, CAP-009-R11
class CapturedPage : Record {
  @Field var id: String = ""
  @Field var preview: String? = null
}

// CAP-015-R10
enum class TorchMode(val value: String) : Enumerable {
  ON("on"),
  OFF("off"),
}

class ScannerNotReadyException :
  CodedException("scanner-not-ready", "The document scanner camera is not running or is already capturing", null)

private const val EDGES_CHANGE_EVENT = "onEdgesChange"
private const val CAMERA_UNAVAILABLE_EVENT = "onCameraUnavailable"

// NAB-191–195, Q-050, CAP-018-R02, CAP-018-R03, CAP-018-R04, CAP-018-R10, CAP-018-R11, CAP-018-R13
class DocumentScannerModule : Module() {
  private val pages by lazy {
    DocumentScannerPages(EncryptedFiles(Vault(appContext.reactContext ?: throw Exceptions.ReactContextLost()), MasterKeys()))
  }

  override fun definition() = ModuleDefinition {
    Name("DocumentScanner")

    AsyncFunction("recropPage") { original: EncryptedFile, corners: PageCorners, quarterTurns: Int ->
      pages.recrop(original, corners, quarterTurns)
    }

    AsyncFunction("scannedPage") { id: String ->
      pages.scanned(id)
    }

    OnActivityEntersForeground {
      DocumentScannerViews.enteredForeground(true)
    }

    OnActivityEntersBackground {
      DocumentScannerViews.enteredForeground(false)
    }

    View(DocumentScannerView::class) {
      Events(EDGES_CHANGE_EVENT, CAMERA_UNAVAILABLE_EVENT)

      Prop("isActive", false) { view: DocumentScannerView, isActive: Boolean ->
        view.isActive = isActive
      }

      Prop("torchMode", TorchMode.OFF) { view: DocumentScannerView, torchMode: TorchMode ->
        view.torchMode = torchMode
      }

      Prop("edgeColor") { view: DocumentScannerView, color: String? ->
        view.edgeColor = color?.let { CssColor.parse(it) }
      }

      Prop("edgeFillColor") { view: DocumentScannerView, color: String? ->
        view.edgeFillColor = color?.let { CssColor.parse(it) }
      }

      AsyncFunction("capturePage") { view: DocumentScannerView, promise: Promise ->
        view.capturePage(pages, promise)
      }.runOnQueue(Queues.MAIN)

      OnViewDestroys { view: DocumentScannerView ->
        view.tearDown()
      }
    }
  }
}
