/**
 * Keeps live/VOD audio playing when the device is in silent mode, on every iOS
 * version and device.
 *
 * The vendor `AudioSession.setCategory` (Bitmovin RN) only sets the category
 * from JS after launch and never activates the session. iOS 26 does not honour
 * that: the `.playback` category is reset before playback starts, so the
 * Ring/Silent switch silences the audio (video keeps playing).
 *
 * This plugin configures `.playback` + `.moviePlayback` + `.duckOthers` and
 * ACTIVATES the session natively at launch, then RE-ASSERTS it on audio
 * interruption end / route change / media-services reset / app foreground — so
 * `.playback` survives whatever the player or the OS does after launch. A
 * diagnostic NSLog records the real session state (category / options / route /
 * volume / activation result) at every (re)configuration.
 */

const { withAppDelegate } = require("@expo/config-plugins");

const IMPORT_ANCHOR = "import ReactAppDependencyProvider";
const BODY_ANCHOR = "    let delegate = ReactNativeDelegate()";

const AUDIO_HELPER = `import AVFoundation

enum BFBSAudioSession {
  static func configure() {
    let session = AVAudioSession.sharedInstance()
    do {
      try session.setCategory(.playback, mode: .moviePlayback, options: [.duckOthers])
      try session.setActive(true)
      NSLog("[audio] session OK category=\\(session.category.rawValue) options=\\(session.categoryOptions.rawValue) otherPlaying=\\(session.isOtherAudioPlaying) volume=\\(session.outputVolume) route=\\(session.currentRoute.outputs.map { $0.portType.rawValue }.joined(separator: ","))")
    } catch {
      NSLog("[audio] session FAILED \\(error.localizedDescription)")
    }
  }

  static func startObserving() {
    let center = NotificationCenter.default
    center.addObserver(forName: AVAudioSession.interruptionNotification, object: nil, queue: .main) { note in
      guard
        let info = note.userInfo,
        let raw = info[AVAudioSessionInterruptionTypeKey] as? UInt,
        AVAudioSession.InterruptionType(rawValue: raw) == .ended
      else { return }
      BFBSAudioSession.configure()
    }
    for name in [
      AVAudioSession.routeChangeNotification,
      AVAudioSession.mediaServicesWereResetNotification,
      UIApplication.didBecomeActiveNotification,
    ] {
      center.addObserver(forName: name, object: nil, queue: .main) { _ in
        BFBSAudioSession.configure()
      }
    }
  }
}
`;

const AUDIO_SETUP = `    BFBSAudioSession.configure()
    BFBSAudioSession.startObserving()

`;

module.exports = function withIosAudioSession(config) {
  return withAppDelegate(config, (appDelegateConfig) => {
    let contents = appDelegateConfig.modResults.contents;

    if (!contents.includes("enum BFBSAudioSession")) {
      contents = contents.replace(
        IMPORT_ANCHOR,
        `${IMPORT_ANCHOR}\n${AUDIO_HELPER}`,
      );
    }

    if (!contents.includes("BFBSAudioSession.startObserving()")) {
      contents = contents.replace(BODY_ANCHOR, `${AUDIO_SETUP}${BODY_ANCHOR}`);
    }

    appDelegateConfig.modResults.contents = contents;
    return appDelegateConfig;
  });
};
