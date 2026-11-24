import AVKit
import ExpoModulesCore
import UIKit

private let shutterKeyEvent = "shutterKey"

struct SecuredPhoto: Record {
  @Field var image: EncryptedFile = EncryptedFile()
  @Field var thumbnail: EncryptedFile = EncryptedFile()
  @Field var width: Int = 0
  @Field var height: Int = 0
}

struct PhotoCrop: Record {
  @Field var x: Double = 0
  @Field var y: Double = 0
  @Field var width: Double = 0
  @Field var height: Double = 0

  // E18
  func pixelRect() throws -> PixelRect {
    guard [x, y, width, height].allSatisfy(\.isFinite), width > 0, height > 0 else {
      throw PhotoUnreadableException()
    }
    return PixelRect(x: x, y: y, width: width, height: height)
  }
}

// E18
final class PhotoUnreadableException: Exception, @unchecked Sendable {
  override var code: String { "photo-unreadable" }
  override var reason: String { "The photo cannot be prepared for sending" }

  static func whenUnreadable<Prepared>(_ preparation: () throws -> Prepared) throws -> Prepared {
    do {
      return try preparation()
    } catch is PhotoPreparationFailure {
      throw PhotoUnreadableException()
    }
  }
}

// TS-140, NAB-058, NAB-154, ADR-026, CAP-015-R14, CAP-015-R34, CAP-009-R09
public final class CameraModule: Module {
  private let files = EncryptedFiles(vault: Vault(), keys: MasterKeys.shared)
  private let queue = DispatchQueue(label: "cz.veevoy.ansora.core.mobile.camera")
  private var shutterKeys: AnyObject?

  public func definition() -> ModuleDefinition {
    Name("Camera")

    Events(shutterKeyEvent)

    AsyncFunction("securePhoto") { (photo: Data) -> SecuredPhoto in
      try self.secure { try PhotoPreparation.upright([UInt8](photo)) }
    }.runOnQueue(queue)

    AsyncFunction("rotatePhoto") { (path: String, wrappedKey: String, quarterTurns: Int) -> SecuredPhoto in
      let photo = try self.open(path: path, wrappedKey: wrappedKey)
      return try self.secure {
        try PhotoPreparation.readable { try LosslessJpeg.rotatedClockwise(photo, quarterTurns: quarterTurns) }
      }
    }.runOnQueue(queue)

    AsyncFunction("cropPhoto") { (path: String, wrappedKey: String, crop: PhotoCrop) -> SecuredPhoto in
      let rect = try crop.pixelRect()
      let photo = try self.open(path: path, wrappedKey: wrappedKey)
      return try self.secure { try PhotoPreparation.readable { try LosslessJpeg.cropped(photo, to: rect) } }
    }.runOnQueue(queue)

    OnStartObserving { [weak self] in
      DispatchQueue.main.async {
        self?.startShutterKeys()
      }
    }

    OnStopObserving { [weak self] in
      DispatchQueue.main.async {
        self?.stopShutterKeys()
      }
    }
  }

  // CAP-009-R02, CAP-009-R06, CAP-009-R17
  private func secure(_ prepare: () throws -> PreparedJpeg) throws -> SecuredPhoto {
    let photo = try PhotoUnreadableException.whenUnreadable(prepare)
    let thumbnail = try PhotoUnreadableException.whenUnreadable { try PhotoPreparation.thumbnail(of: photo.bytes) }
    let image = try files.store(Data(photo.bytes), in: .queue)
    do {
      let secured = SecuredPhoto()
      secured.image = image
      secured.thumbnail = try files.store(Data(thumbnail), in: .queue)
      secured.width = photo.width
      secured.height = photo.height
      return secured
    } catch {
      try? files.vault.remove(image.path)
      throw error
    }
  }

  private func open(path: String, wrappedKey: String) throws -> [UInt8] {
    [UInt8](try files.open(path: path, wrappedKey: wrappedKey, in: .queue))
  }

  // CAP-015-R10
  private func startShutterKeys() {
    guard #available(iOS 17.2, *), shutterKeys == nil, let window = keyWindow() else {
      return
    }
    let interaction = AVCaptureEventInteraction { [weak self] event in
      if event.phase == .ended {
        self?.sendEvent(shutterKeyEvent)
      }
    }
    window.addInteraction(interaction)
    shutterKeys = interaction
  }

  private func stopShutterKeys() {
    guard #available(iOS 17.2, *), let interaction = shutterKeys as? AVCaptureEventInteraction else {
      return
    }
    interaction.view?.removeInteraction(interaction)
    shutterKeys = nil
  }

  private func keyWindow() -> UIWindow? {
    UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .flatMap(\.windows)
      .first { $0.isKeyWindow }
  }
}
