# ADR-017, Q-028, integrace-dicom.md 5, 11, 11.3

import argparse
import datetime
import hashlib
import json
import re
import subprocess
import sys
import tempfile
import unicodedata
from collections.abc import Callable
from pathlib import Path

from pydicom import dcmread
from pydicom.dataset import Dataset
from pydicom.filebase import DicomBytesIO
from pydicom.filewriter import write_data_element
from pydicom.tag import Tag

VALIDATOR = "/usr/bin/dciodvfy"
VALIDATOR_PACKAGE = "dicom3tools"
VALIDATOR_ERROR_EXIT = 1
ERROR_PREFIX = "Error - "
WARNING_PREFIX = "Warning - "
MESSAGE_PREFIXES = (ERROR_PREFIX, WARNING_PREFIX)
OBJECT_PATTERN = "*.dcm"
REMOVED_KEYWORD = "SOPInstanceUID"
CONTROL_CATEGORY = "Cc"
UTF8 = "utf-8"

# PS3.3 A.32.4, A.45.1
IOD_NAMES = {"VLPhotographicImage", "EncapsulatedPDF"}
VALUE_INVALID = "Error - Value invalid for this VR - "
VALUE_INVALID_END = re.compile(r"> - [A-Z][^\n]*$")
INVALID_VALUES_SUMMARY = "Error - Dicom dataset contains invalid data values for Value Representations"
# PS3.5 6.2
VALUE_LENGTH = re.compile(
    re.escape(VALUE_INVALID) + r"\((0x[0-9a-f]{4}),(0x[0-9a-f]{4})\) (LO|SH|PN|ST|LT|UT) .*"
    r" - Length invalid for this VR = (\d+), expected <= (\d+)$",
    re.DOTALL,
)
# PS3.5 6.2
TAB_IN_TEXT = re.compile(
    re.escape(VALUE_INVALID) + r"\((0x[0-9a-f]{4}),(0x[0-9a-f]{4})\) (ST|LT|UT) .*"
    r" - Character invalid for this VR = '.?' \(0x9\)$",
    re.DOTALL,
)
TEXT_CONTROLS = {"\t", "\r", "\n", "\f"}
TAB = "\t"
MISSING_LATERALITY = "Error - Missing attribute Type 2C Conditional Element=<Laterality> Module=<GeneralSeries>"
# PS3.16 Annex L
UNPAIRED_UNKNOWN_TO_VALIDATOR = {"ANUS": "53505006", "LOWERTRUNK": "63337009"}
# PS3.16 Annex L
TERMS_UNKNOWN_TO_VALIDATOR = {"ANUS", "FOREARM", "LOWERLEG", "LOWERTRUNK", "UPPERARM"}
UNRECOGNIZED_BODY_PART = re.compile(
    r"^Warning - Unrecognized defined term <([A-Z]+)> for value 1 of attribute <Body Part Examined>$"
)
# integrace-dicom.md 5.4, 12
EXTENSION_WARNINGS = {
    "Warning - Attribute is not present in standard DICOM IOD - (0x0062,0x0020) UT Tracking ID",
    "Warning - Attribute is not present in standard DICOM IOD - (0x0062,0x0021) UI Tracking UID",
    "Warning - Attribute is not present in standard DICOM IOD - (0x0008,0x1070) PN Operators' Name",
    "Warning - Dicom dataset contains attributes not present in standard DICOM IOD"
    " - this is a Standard Extended SOP Class",
}
LENGTH_REASON = "PS3.5 6.2 counts characters and padding, which fit; dciodvfy counts UTF-8 bytes"
TAB_REASON = "PS3.5 6.2 allows TAB in ST, LT and UT; dicom3tools 1.00~20240118 does not"
LATERALITY_REASON = "PS3.16 Annex L pairs no such body part, so PS3.3 C.7.3.1 leaves Laterality out"
TERM_REASON = "PS3.16 Annex L defines the term; dicom3tools 1.00~20240118 does not know it"
EXTENSION_REASON = "Standard Extended SOP Class, integrace-dicom.md 5.4, 12"
SUMMARY_REASON = "every invalid value above is accepted"
# integrace-dicom.md 11.3
NEGATIVE_SOURCES = [
    ("image", "image-text-cs.dcm", "PhotometricInterpretation"),
    ("document-explicit", "document-explicit.dcm", "MIMETypeOfEncapsulatedDocument"),
    ("document-implicit", "document-implicit.dcm", "MIMETypeOfEncapsulatedDocument"),
]
MOVED_KEYWORD = "Modality"
OUT_OF_ORDER = "Error - Tags out of order"
MISSING_TYPE_1 = "Error - Missing attribute Type 1 Required Element=<{}>"
MISSING_TYPE_2 = "Error - Missing attribute Type 2 Required Element=<{}>"
MISSING_TYPE_2_KEYWORD = "PatientName"
# PS3.5 6.2 LO
LONG_STRING_MAX_LENGTH = 64
SERIES_DESCRIPTION_ERROR = VALUE_INVALID + "(0x0008,0x103e)"
IMAGE_COMMENTS_ERROR = VALUE_INVALID + "(0x0020,0x4000)"
# PS3.16 Annex L
KNEE_TERM = "KNEE"
KNEE_CODE = "72696002"
KNEE_MEANING = "Knee"
UNKNOWN_TERM = "NOTAPART"


def package_version() -> str:
    return subprocess.run(
        ["dpkg-query", "--show", "--showformat=${Version}", VALIDATOR_PACKAGE],
        check=True,
        capture_output=True,
        text=True,
    ).stdout


def is_open(message: str) -> bool:
    return message.startswith(VALUE_INVALID) and VALUE_INVALID_END.search(message) is None


def messages_of(output: str) -> list[str]:
    messages: list[str] = []
    for line in output.splitlines():
        if messages and is_open(messages[-1]) and not line.startswith(MESSAGE_PREFIXES):
            messages[-1] = f"{messages[-1]}\n{line}"
        elif line.strip():
            messages.append(line.rstrip())
    return messages


def validate(path: Path) -> dict:
    completed = subprocess.run(
        [VALIDATOR, str(path)], capture_output=True, text=True, errors="backslashreplace", check=False
    )
    messages = messages_of(f"{completed.stdout}\n{completed.stderr}")
    return {
        "exitCode": completed.returncode,
        "errors": [message for message in messages if message.startswith(ERROR_PREFIX)],
        "warnings": [message for message in messages if message.startswith(WARNING_PREFIX)],
        "others": [message for message in messages if not message.startswith(MESSAGE_PREFIXES)],
    }


def top_level_value(dataset: Dataset, group: str, element: str) -> str | None:
    tag = Tag(int(group, 16), int(element, 16))
    return str(dataset[tag].value) if tag in dataset else None


def length_fits(error: str, dataset: Dataset) -> bool:
    match = VALUE_LENGTH.match(error)
    value = None if match is None else top_level_value(dataset, match.group(1), match.group(2))
    if match is None or value is None:
        return False
    encoded = len(value.encode(UTF8))
    padded_characters = len(value) + encoded % 2
    return int(match.group(4)) == encoded and padded_characters <= int(match.group(5))


def tab_is_the_only_control(error: str, dataset: Dataset) -> bool:
    match = TAB_IN_TEXT.match(error)
    value = None if match is None else top_level_value(dataset, match.group(1), match.group(2))
    if value is None:
        return False
    controls = {character for character in value if unicodedata.category(character) == CONTROL_CATEGORY}
    return TAB in controls and controls <= TEXT_CONTROLS


def laterality_is_left_out(error: str, dataset: Dataset) -> bool:
    region_code = UNPAIRED_UNKNOWN_TO_VALIDATOR.get(dataset.get("BodyPartExamined", ""))
    regions = dataset.get("AnatomicRegionSequence", [])
    return (
        error == MISSING_LATERALITY
        and "Laterality" not in dataset
        and region_code is not None
        and len(regions) == 1
        and regions[0].get("CodeValue") == region_code
    )


def error_reason(error: str, dataset: Dataset) -> str | None:
    if length_fits(error, dataset):
        return LENGTH_REASON
    if tab_is_the_only_control(error, dataset):
        return TAB_REASON
    return LATERALITY_REASON if laterality_is_left_out(error, dataset) else None


def warning_reason(warning: str) -> str | None:
    if warning in EXTENSION_WARNINGS:
        return EXTENSION_REASON
    body_part = UNRECOGNIZED_BODY_PART.match(warning)
    return TERM_REASON if body_part is not None and body_part.group(1) in TERMS_UNKNOWN_TO_VALIDATOR else None


def accepted_errors_of(result: dict, dataset: Dataset) -> tuple[list[str], list[dict]]:
    errors, accepted = [], []
    for error in result["errors"]:
        reason = error_reason(error, dataset)
        if reason is None:
            errors.append(error)
        else:
            accepted.append({"message": error, "reason": reason})
    has_accepted_value = any(entry["message"].startswith(VALUE_INVALID) for entry in accepted)
    has_invalid_value = any(error.startswith(VALUE_INVALID) for error in errors)
    if INVALID_VALUES_SUMMARY in errors and has_accepted_value and not has_invalid_value:
        errors.remove(INVALID_VALUES_SUMMARY)
        accepted.append({"message": INVALID_VALUES_SUMMARY, "reason": SUMMARY_REASON})
    return errors, accepted


def accepted_warnings_of(result: dict) -> tuple[list[str], list[dict]]:
    warnings, accepted = [], []
    for warning in result["warnings"]:
        reason = warning_reason(warning)
        if reason is None:
            warnings.append(warning)
        else:
            accepted.append({"message": warning, "reason": reason})
    return warnings, accepted


def validate_builder_object(path: Path) -> dict:
    result = validate(path)
    errors, accepted = accepted_errors_of(result, dcmread(path))
    warnings, accepted_warnings = accepted_warnings_of(result)
    iods = [other for other in result["others"] if other in IOD_NAMES]
    unexpected = [other for other in result["others"] if other not in IOD_NAMES]
    expected_exit = VALIDATOR_ERROR_EXIT if accepted else 0
    return {
        "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        "iod": iods,
        "exitCode": result["exitCode"],
        "errors": errors,
        "warnings": warnings,
        "unexpectedOutput": unexpected,
        "accepted": accepted,
        "acceptedWarnings": accepted_warnings,
        "passes": not errors
        and not warnings
        and not unexpected
        and len(iods) == 1
        and result["exitCode"] == expected_exit,
        "raw": result,
    }


def element_bytes(element, is_implicit: bool) -> bytes:
    buffer = DicomBytesIO()
    buffer.is_little_endian = True
    buffer.is_implicit_VR = is_implicit
    write_data_element(buffer, element)
    return buffer.getvalue()


# integrace-dicom.md 11.3
def out_of_order(source: Path, target: Path) -> None:
    raw = source.read_bytes()
    dataset = dcmread(source)
    encoded = element_bytes(dataset[MOVED_KEYWORD], dataset.file_meta.TransferSyntaxUID.is_implicit_VR)
    start = raw.find(encoded)
    if start < 0 or raw.count(encoded) != 1:
        raise ValueError(f"{MOVED_KEYWORD} is not once in {source.name}")
    target.write_bytes(raw[:start] + raw[start + len(encoded):] + encoded)


def changed(source: Path, target: Path, change: Callable[[Dataset], None]) -> None:
    dataset = dcmread(source)
    change(dataset)
    dataset.save_as(target, enforce_file_format=True)


def without(source: Path, target: Path, keyword: str) -> None:
    changed(source, target, lambda dataset: delattr(dataset, keyword))


def with_value(keyword: str, value: str) -> Callable[[Dataset], None]:
    return lambda dataset: setattr(dataset, keyword, value)


def knee_without_laterality(dataset: Dataset) -> None:
    dataset.BodyPartExamined = KNEE_TERM
    region = dataset.AnatomicRegionSequence[0]
    region.CodeValue = KNEE_CODE
    region.CodeMeaning = KNEE_MEANING
    if "Laterality" in dataset:
        del dataset.Laterality


NegativeCase = tuple[str, str, str, Callable[[Path], None]]


def negative_cases(kind: str, source: Path, missing_type_1: str) -> list[NegativeCase]:
    def changed_by(change: Callable[[Dataset], None]) -> Callable[[Path], None]:
        return lambda target: changed(source, target, change)

    cases: list[NegativeCase] = [
        ("out-of-order", "errors", OUT_OF_ORDER, lambda target: out_of_order(source, target)),
        (f"without-{missing_type_1}", "errors", MISSING_TYPE_1.format(missing_type_1),
         lambda target: without(source, target, missing_type_1)),
        (f"without-{MISSING_TYPE_2_KEYWORD}", "errors", MISSING_TYPE_2.format(MISSING_TYPE_2_KEYWORD),
         lambda target: without(source, target, MISSING_TYPE_2_KEYWORD)),
    ]
    if kind != "image":
        return cases
    return cases + [
        ("series-description-of-65-letters", "errors", SERIES_DESCRIPTION_ERROR,
         changed_by(with_value("SeriesDescription", "x" * (LONG_STRING_MAX_LENGTH + 1)))),
        ("series-description-of-65-accented-letters", "errors", SERIES_DESCRIPTION_ERROR,
         changed_by(with_value("SeriesDescription", "č" * (LONG_STRING_MAX_LENGTH + 1)))),
        ("bell-after-a-tab-in-image-comments", "errors", IMAGE_COMMENTS_ERROR,
         changed_by(with_value("ImageComments", "Rána\t2\u0007"))),
        ("knee-without-laterality", "errors", MISSING_LATERALITY, changed_by(knee_without_laterality)),
        ("unknown-body-part", "warnings", f"Warning - Unrecognized defined term <{UNKNOWN_TERM}>",
         changed_by(with_value("BodyPartExamined", UNKNOWN_TERM))),
    ]


def negative_sample(directory: Path, kind: str, source: Path, case: NegativeCase) -> dict:
    name, field, expected, build = case
    target = directory / f"{kind}-{name}.dcm"
    sample = {"sample": target.name, "source": source.name, "expected": expected}
    try:
        build(target)
        outcome = validate_builder_object(target)
    except Exception as failure:  # noqa: BLE001
        return {**sample, "failure": repr(failure), "caught": False, "rejected": False}
    caught = any(message.startswith(expected) for message in outcome["raw"][field])
    rejected = any(message.startswith(expected) for message in outcome[field])
    return {**sample, **outcome["raw"], "caught": caught, "rejected": rejected}


def validate_negatives(objects: Path) -> dict:
    with tempfile.TemporaryDirectory() as directory:
        samples = [
            negative_sample(Path(directory), kind, objects / name, case)
            for kind, name, missing_type_1 in NEGATIVE_SOURCES
            for case in negative_cases(kind, objects / name, missing_type_1)
        ]
    missed = [sample["sample"] for sample in samples if not sample["caught"] or not sample["rejected"]]
    return {"samples": samples, "missed": missed, "result": "pass" if not missed else "fail"}


def self_test(source: Path) -> dict:
    valid = validate(source)
    with tempfile.TemporaryDirectory() as directory:
        broken_path = Path(directory) / "missing-type-1.dcm"
        without(source, broken_path, REMOVED_KEYWORD)
        broken = validate(broken_path)
    expected = MISSING_TYPE_1.format(REMOVED_KEYWORD)
    passes_valid = valid["exitCode"] == 0 and not valid["errors"]
    catches_broken = broken["exitCode"] != 0 and any(error.startswith(expected) for error in broken["errors"])
    return {
        "validSample": {"source": source.name, **valid},
        "brokenSample": {"source": source.name, "removed": f"{REMOVED_KEYWORD} (0008,0018), type 1", **broken},
        "result": "pass" if passes_valid and catches_broken else "fail",
    }


def validate_objects(objects: Path) -> dict:
    results = []
    for path in sorted(objects.glob(OBJECT_PATTERN)):
        outcome = validate_builder_object(path)
        del outcome["raw"]
        results.append({"file": path.name, **outcome})
    failed = [result["file"] for result in results if not result["passes"]]
    return {
        "checked": len(results),
        "failed": failed,
        "results": results,
        "result": "pass" if results and not failed else "fail",
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--self-test-source", type=Path, required=True)
    parser.add_argument("--objects", type=Path, required=True)
    parser.add_argument("--evidence", type=Path, required=True)
    arguments = parser.parse_args()

    self_test_result = self_test(arguments.self_test_source)
    objects_result = validate_objects(arguments.objects)
    negatives_result = validate_negatives(arguments.objects)
    passes = all(part["result"] == "pass" for part in (self_test_result, objects_result, negatives_result))
    result = "pass" if passes else "fail"
    evidence = {
        "check": "object-validation",
        "source": "ADR-017, Q-028, integrace-dicom.md 5, 11, 11.3",
        "checkedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "validator": {"tool": "dciodvfy", "package": VALIDATOR_PACKAGE, "version": package_version()},
        "selfTest": self_test_result,
        "objects": objects_result,
        "negatives": negatives_result,
        "result": result,
    }
    arguments.evidence.write_text(json.dumps(evidence, indent="\t", ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({"event": "object-validation-finished", "result": result}), file=sys.stderr)
    sys.exit(0 if passes else 1)


if __name__ == "__main__":
    main()
