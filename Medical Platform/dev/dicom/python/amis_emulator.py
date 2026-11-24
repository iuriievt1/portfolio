# ADR-017, ADR-024, architektura.md 11, integrace-dicom.md 1, 3, 6.4, 8, 10, 11.1

import json
import logging
import os
import re
import threading
from collections.abc import Iterator
from dataclasses import dataclass
from pathlib import Path
from weakref import WeakKeyDictionary

from pydicom import dcmread
from pydicom.dataset import Dataset
from pydicom.multival import MultiValue
from pydicom.sequence import Sequence
from pydicom.uid import ExplicitVRLittleEndian, ImplicitVRLittleEndian, JPEGBaseline8Bit
from pynetdicom import AE, _config, evt
from pynetdicom.association import Association
from dicom_synthetic import CHARACTER_SET, PORT, STATUS_SUCCESS, person_name, sex_code
from pynetdicom.sop_class import (
    EncapsulatedPDFStorage,
    ModalityWorklistInformationFind,
    PatientRootQueryRetrieveInformationModelFind,
    SecondaryCaptureImageStorage,
    StudyRootQueryRetrieveInformationModelFind,
    Verification,
    VLPhotographicImageStorage,
)

# integrace-dicom.md 10, TS-059
MAX_PDU_LENGTH = 16384
# integrace-dicom.md 1, 3
STORAGE_CLASSES = [VLPhotographicImageStorage, SecondaryCaptureImageStorage, EncapsulatedPDFStorage]
STORAGE_SYNTAXES = [JPEGBaseline8Bit, ExplicitVRLittleEndian, ImplicitVRLittleEndian]
# integrace-dicom.md 1, 6.1
QUERY_CLASSES = [
    Verification,
    PatientRootQueryRetrieveInformationModelFind,
    StudyRootQueryRetrieveInformationModelFind,
    ModalityWorklistInformationFind,
]
QUERY_SYNTAXES = [ImplicitVRLittleEndian]
# PS3.5 9.1
UID_VALUE = re.compile(r"[0-9]+(\.[0-9]+)+")
MAX_UID_LENGTH = 64

STATUS_PENDING = 0xFF00
STATUS_CANCEL = 0xFE00
WARNING_FIRST = 0xB000
WARNING_LAST = 0xBFFF
# integrace-dicom.md 8.1
STORE_NOT_AUTHORIZED = 0xA706
STORE_DATASET_MISMATCH = 0xA900
STORE_DECODE_FAILURE = 0xC000
STORE_INSTANCE_MISMATCH = 0xC004
# integrace-dicom.md 8.2
FIND_OUT_OF_RESOURCES = 0xA700
FIND_IDENTIFIER_MISMATCH = 0xA900
FIND_NOT_AUTHORIZED = 0xC001

# PS3.8 9.3.4
REJECT_PERMANENT = 1
SOURCE_SERVICE_USER = 1
CALLING_NOT_RECOGNIZED = 3
CALLED_NOT_RECOGNIZED = 7
VALID_REJECT_REASONS = {1: {1, 2, 3, 7}, 2: {1, 2}, 3: {1, 2}}

ROLE_STORAGE = "storage"
ROLE_QUERY = "query"

STATUS_SCENARIO = re.compile(r"^(STORE|FIND)-([0-9A-F]{4})$")
REJECT_SCENARIO = re.compile(r"^RJ-([12])-([123])-([1-7])$")
STORE_ABORT_SCENARIO = "STORE-ABORT"
FIND_ABORT_SCENARIO = "FIND-ABORT"

# PS3.4 C.6.1, C.6.2
UNIQUE_KEY = {
    "PATIENT": "PatientID",
    "STUDY": "StudyInstanceUID",
    "SERIES": "SeriesInstanceUID",
    "IMAGE": "SOPInstanceUID",
}
MODEL_LEVELS = {
    PatientRootQueryRetrieveInformationModelFind: ("PATIENT", "STUDY", "SERIES", "IMAGE"),
    StudyRootQueryRetrieveInformationModelFind: ("STUDY", "SERIES", "IMAGE"),
}
STRIPPED_KEYS = ("PixelData", "EncapsulatedDocument")
CONTROL_KEYS = ("SpecificCharacterSet", "QueryRetrieveLevel")
RANGE_VRS = ("DA", "TM", "DT")
WILDCARDS = re.compile(r"[*?]")

LOGGER = logging.getLogger("amis")


@dataclass(frozen=True)
class Scenario:
    store_status: int | None = None
    find_status: int | None = None
    store_abort: bool = False
    find_abort: bool = False
    reject: tuple[int, int, int] | None = None


def scenario_of(called_ae_title: str, ae_title: str) -> Scenario | None:
    if called_ae_title == ae_title:
        return Scenario()
    if called_ae_title == STORE_ABORT_SCENARIO:
        return Scenario(store_abort=True)
    if called_ae_title == FIND_ABORT_SCENARIO:
        return Scenario(find_abort=True)
    status = STATUS_SCENARIO.match(called_ae_title)
    if status is not None:
        value = int(status.group(2), 16)
        return Scenario(store_status=value) if status.group(1) == "STORE" else Scenario(find_status=value)
    reject = REJECT_SCENARIO.match(called_ae_title)
    if reject is None:
        return None
    result, source, reason = (int(group) for group in reject.groups())
    if reason not in VALID_REJECT_REASONS[source]:
        return None
    return Scenario(reject=(result, source, reason))


def registrations(value: str) -> dict[tuple[str, str], frozenset[str]]:
    registered: dict[tuple[str, str], frozenset[str]] = {}
    for entry in filter(None, (part.strip() for part in value.split(";"))):
        peer, roles = entry.split("=")
        ae_title, address = peer.split("@")
        registered[(ae_title, address)] = frozenset(filter(None, roles.split("+")))
    return registered


def log(event: str, **fields: object) -> None:
    LOGGER.info(json.dumps({"event": event, **fields}))


def stripped(dataset: Dataset) -> Dataset:
    header = Dataset()
    header.update({element.tag: element for element in dataset if element.keyword not in STRIPPED_KEYS})
    return header


def values_of(value: object) -> list[str]:
    if isinstance(value, MultiValue):
        return [str(item) for item in value]
    return [str(value)]


def is_universal(value: object) -> bool:
    return value is None or value == "" or (isinstance(value, (MultiValue, Sequence)) and len(value) == 0)


def wildcard_pattern(query: str) -> re.Pattern[str]:
    escaped = "".join({"*": ".*", "?": "."}.get(character, re.escape(character)) for character in query)
    return re.compile(f"^{escaped}$", re.DOTALL)


# PS3.4 C.2.2.2
def value_matches(vr: str, query: object, value: object) -> bool:
    if is_universal(query):
        return True
    actual = "" if value is None else str(value)
    if vr == "UI":
        return actual in values_of(query)
    text = str(query)
    if vr in RANGE_VRS and "-" in text:
        low, high = text.split("-", 1)
        return (low == "" or actual >= low) and (high == "" or actual <= high)
    if WILDCARDS.search(text):
        return wildcard_pattern(text).match(actual) is not None
    return text == actual


def item_matches(query_item: Dataset, item: Dataset) -> bool:
    return all(
        value_matches(element.VR, element.value, item.get(element.keyword))
        for element in query_item
        if element.keyword not in CONTROL_KEYS
    )


def row_matches(identifier: Dataset, row: Dataset) -> bool:
    for element in identifier:
        if element.keyword in CONTROL_KEYS:
            continue
        if element.VR == "SQ":
            query_items = list(element.value or [])
            row_items = list(row.get(element.keyword) or [])
            if query_items and not any(item_matches(query_items[0], item) for item in row_items):
                return False
            continue
        if not value_matches(element.VR, element.value, row.get(element.keyword)):
            return False
    return True


def response_item(query_item: Dataset, item: Dataset) -> Dataset:
    response = Dataset()
    for element in query_item:
        response.add_new(element.tag, element.VR, item.get(element.keyword))
    return response


def response_of(identifier: Dataset, row: Dataset) -> Dataset:
    response = Dataset()
    response.SpecificCharacterSet = CHARACTER_SET
    for element in identifier:
        if element.keyword == "SpecificCharacterSet":
            continue
        if element.keyword == "QueryRetrieveLevel":
            response.QueryRetrieveLevel = element.value
            continue
        if element.VR == "SQ":
            query_items = list(element.value or [])
            row_items = [item for item in (row.get(element.keyword) or []) if not query_items or item_matches(query_items[0], item)]
            template = query_items[0] if query_items else Dataset()
            response.add_new(element.tag, "SQ", Sequence([response_item(template, item) for item in row_items[:1]]))
            continue
        response.add_new(element.tag, element.VR, row.get(element.keyword))
    return response


# ADR-004, architektura.md 11
def patient_key(row: Dataset) -> tuple[str, ...]:
    return (str(row.get("PatientID", "")), str(row.get("IssuerOfPatientID", "")))


class Archive:
    def __init__(self, storage: Path, registry: Path, worklist: Path, instances: Path) -> None:
        self._lock = threading.Lock()
        self._storage = storage
        self._instances: dict[str, Dataset] = {}
        self._patients = self._registry_patients(registry)
        self._worklist = [dcmread(path) for path in sorted(worklist.glob("*.wl"))]
        for path in sorted(instances.glob("*.dcm")):
            header = stripped(dcmread(path, stop_before_pixels=True))
            self._instances[header.SOPInstanceUID] = header

    @staticmethod
    def _registry_patients(registry: Path) -> list[Dataset]:
        patients = []
        for patient in json.loads(registry.read_text(encoding="utf-8"))["patients"]:
            row = Dataset()
            row.PatientName = person_name(patient)
            row.PatientID = patient["id"]
            row.IssuerOfPatientID = patient["issuer"]
            row.PatientBirthDate = patient["birthDate"].replace("-", "")
            row.PatientSex = sex_code(patient)
            patients.append(row)
        return patients

    def store(self, dataset: Dataset, encoded: bytes) -> None:
        (self._storage / f"{dataset.SOPInstanceUID}.dcm").write_bytes(encoded)
        with self._lock:
            self._instances[dataset.SOPInstanceUID] = stripped(dataset)

    def rows(self, level: str) -> list[Dataset]:
        with self._lock:
            instances = list(self._instances.values())
        if level == "IMAGE":
            return instances
        rows: dict[tuple[str, ...], Dataset] = {}
        if level == "PATIENT":
            rows.update({patient_key(patient): patient for patient in self._patients})
            for instance in instances:
                rows.setdefault(patient_key(instance), instance)
            return list(rows.values())
        for instance in instances:
            rows.setdefault((str(instance.get(UNIQUE_KEY[level])),), instance)
        return list(rows.values())

    def worklist(self) -> list[Dataset]:
        return self._worklist


class Emulator:
    def __init__(self, ae_title: str, registered: dict[tuple[str, str], frozenset[str]], archive: Archive, max_matches: int) -> None:
        self._ae_title = ae_title
        self._registered = registered
        self._archive = archive
        self._max_matches = max_matches
        self._scenarios: WeakKeyDictionary[Association, Scenario] = WeakKeyDictionary()
        self._roles: WeakKeyDictionary[Association, frozenset[str]] = WeakKeyDictionary()

    @staticmethod
    def _reject(association: Association, result: int, source: int, reason: int) -> None:
        association.acse.send_reject(result, source, reason)
        association.kill()

    def on_requested(self, event: evt.Event) -> None:
        association = event.assoc
        primitive = association.requestor.primitive
        called = primitive.called_ae_title.strip()
        calling = primitive.calling_ae_title.strip()
        address = association.requestor.address
        scenario = scenario_of(called, self._ae_title)
        roles = self._registered.get((calling, address))
        log("association-requested", called=called, calling=calling, address=address)
        if scenario is None:
            self._reject(association, REJECT_PERMANENT, SOURCE_SERVICE_USER, CALLED_NOT_RECOGNIZED)
            return
        # integrace-dicom.md 1, 10, TS-145
        if roles is None:
            self._reject(association, REJECT_PERMANENT, SOURCE_SERVICE_USER, CALLING_NOT_RECOGNIZED)
            return
        if scenario.reject is not None:
            self._reject(association, *scenario.reject)
            return
        self._scenarios[association] = scenario
        self._roles[association] = roles

    def on_echo(self, event: evt.Event) -> int:
        return STATUS_SUCCESS

    # integrace-dicom.md 8.1
    def on_store(self, event: evt.Event) -> int:
        scenario = self._scenarios.get(event.assoc, Scenario())
        if ROLE_STORAGE not in self._roles.get(event.assoc, frozenset()):
            return STORE_NOT_AUTHORIZED
        request = event.request
        try:
            dataset = event.dataset
            dataset.walk(lambda _dataset, _element: None)
        except Exception as error:
            log("store-decode-failure", sop_instance_uid=request.AffectedSOPInstanceUID, error=type(error).__name__)
            return STORE_DECODE_FAILURE
        if dataset.get("SOPClassUID") != request.AffectedSOPClassUID:
            return STORE_DATASET_MISMATCH
        if dataset.get("SOPInstanceUID") != request.AffectedSOPInstanceUID:
            return STORE_INSTANCE_MISMATCH
        uid = str(dataset.SOPInstanceUID)
        if len(uid) > MAX_UID_LENGTH or UID_VALUE.fullmatch(uid) is None:
            return STORE_DECODE_FAILURE
        if scenario.store_abort:
            event.assoc.abort()
            return STATUS_SUCCESS
        status = STATUS_SUCCESS if scenario.store_status is None else scenario.store_status
        if status == STATUS_SUCCESS or WARNING_FIRST <= status <= WARNING_LAST:
            self._archive.store(dataset, event.encoded_dataset(include_meta=True))
        log("stored", sop_instance_uid=request.AffectedSOPInstanceUID, status=f"{status:04X}")
        return status

    # integrace-dicom.md 6.4, 8.2, CS ř. 1866–1868
    def on_find(self, event: evt.Event) -> Iterator[tuple[int, Dataset | None]]:
        scenario = self._scenarios.get(event.assoc, Scenario())
        model = event.request.AffectedSOPClassUID
        identifier = event.identifier
        if model == ModalityWorklistInformationFind:
            rows = [row for row in self._archive.worklist() if row_matches(identifier, row)]
        else:
            if ROLE_QUERY not in self._roles.get(event.assoc, frozenset()):
                yield FIND_NOT_AUTHORIZED, None
                return
            level = str(identifier.get("QueryRetrieveLevel", ""))
            levels = MODEL_LEVELS.get(model, ())
            if level not in levels or not self._hierarchical(identifier, levels, level):
                yield FIND_IDENTIFIER_MISMATCH, None
                return
            rows = [row for row in self._archive.rows(level) if row_matches(identifier, row)]
        log("find", model=str(model), matches=len(rows))
        interrupted = scenario.find_abort or scenario.find_status not in (None, STATUS_SUCCESS)
        for index, row in enumerate(rows):
            if event.is_cancelled:
                yield STATUS_CANCEL, None
                return
            if index == self._max_matches:
                yield FIND_OUT_OF_RESOURCES, None
                return
            yield STATUS_PENDING, response_of(identifier, row)
            if interrupted:
                break
        if scenario.find_abort:
            event.assoc.abort()
            return
        if scenario.find_status is not None and scenario.find_status != STATUS_SUCCESS:
            yield scenario.find_status, None

    # PS3.4 C.4.1.2.2
    @staticmethod
    def _hierarchical(identifier: Dataset, levels: tuple[str, ...], level: str) -> bool:
        for higher in levels[: levels.index(level)]:
            value = identifier.get(UNIQUE_KEY[higher])
            if is_universal(value) or WILDCARDS.search(str(value)) or len(values_of(value)) != 1:
                return False
        return True


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    logging.getLogger("pynetdicom").setLevel(logging.WARNING)
    _config.LOG_REQUEST_IDENTIFIERS = False
    _config.LOG_RESPONSE_IDENTIFIERS = False

    ae_title = os.environ["AMIS_AE_TITLE"]
    data = Path(os.environ["AMIS_DATA"])
    storage = Path(os.environ["AMIS_STORAGE"])
    archive = Archive(storage, Path(os.environ["AMIS_REGISTRY"]), data / "worklist" / "WLMSCPFS", data / "instances")
    emulator = Emulator(ae_title, registrations(os.environ["AMIS_PEERS"]), archive, int(os.environ["AMIS_MAX_MATCHES"]))

    ae = AE(ae_title=ae_title)
    ae.maximum_pdu_size = MAX_PDU_LENGTH
    ae.require_called_aet = False
    for sop_class in STORAGE_CLASSES:
        ae.add_supported_context(sop_class, STORAGE_SYNTAXES)
    for sop_class in QUERY_CLASSES:
        ae.add_supported_context(sop_class, QUERY_SYNTAXES)
    handlers = [
        (evt.EVT_REQUESTED, emulator.on_requested),
        (evt.EVT_C_ECHO, emulator.on_echo),
        (evt.EVT_C_STORE, emulator.on_store),
        (evt.EVT_C_FIND, emulator.on_find),
    ]
    log("listening", ae_title=ae_title, port=PORT)
    ae.start_server(("0.0.0.0", PORT), block=True, evt_handlers=handlers)


if __name__ == "__main__":
    main()
