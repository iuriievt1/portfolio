#!/bin/sh
# libjpeg-turbo
set -e
cd "$(dirname "$0")"
build="${TMPDIR:-/tmp}/lossless-jpeg-tests-build"
mkdir -p "$build"
swiftc -O -parse-as-library ../Jpeg/*.swift ../PhotoPreparation.swift LosslessJpegTests.swift -o "$build/lossless-jpeg-tests"
"$build/lossless-jpeg-tests"
swiftc -O -parse-as-library ../Argon2.swift Argon2/Argon2Tests.swift -o "$build/argon2-tests"
"$build/argon2-tests"
swiftc -O -parse-as-library ../Jpeg/*.swift ../PhotoPreparation.swift ../DocumentScannerGeometry.swift ../DocumentScannerDetection.swift ../DocumentScannerImaging.swift ../FileBatch.swift DocumentScanner/DocumentScannerTests.swift -o "$build/document-scanner-tests"
"$build/document-scanner-tests"
swiftc -O -parse-as-library ../VaultLayout.swift VaultLayout/VaultLayoutTests.swift -o "$build/vault-layout-tests"
"$build/vault-layout-tests"
swiftc -O -parse-as-library ../IntegrityDetection.swift ../DeviceIntegrityEvidence.swift Integrity/IntegrityDetectionTests.swift -o "$build/integrity-detection-tests"
"$build/integrity-detection-tests"
swiftc -O -parse-as-library ../IntegrityDetection.swift ../IntegrityMonitor.swift Integrity/IntegrityMonitorTests.swift -o "$build/integrity-monitor-tests"
"$build/integrity-monitor-tests"
