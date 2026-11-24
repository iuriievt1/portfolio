# ADR-011 ř. 46, ADR-018, ADR-005, NAB-468
readonly DEBIAN_SNAPSHOT=20261103T000000Z
readonly LEPTONICA_VERSION=1.87.0
readonly TESSERACT_VERSION=5.5.4
readonly LIBRARY_PACKAGES=(libjpeg62-turbo=1:2.1.5-4 libpng16-16t64=1.6.48-1+deb13u6)
readonly MODEL_PACKAGES=(tesseract-ocr-ces=1:4.1.0-2 tesseract-ocr-eng=1:4.1.0-2)
readonly PREFIX=/usr/local
readonly TESSERACT=$PREFIX/bin/tesseract
readonly SANDBOX=$PREFIX/bin/ocr-sandbox
readonly LICENSES=$PREFIX/share/doc
