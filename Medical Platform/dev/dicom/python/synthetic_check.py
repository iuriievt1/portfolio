# ADR-017, Q-040, Q-102, architektura.md 11, integrace-dicom.md 11

import argparse
import datetime
import hashlib
import json
import logging
import sys
from pathlib import Path

from dicom_synthetic import PORT, STATUS_SUCCESS
from pydicom import dcmread
from pydicom.dataset import Dataset
from pynetdicom import AE, _config
from pynetdicom.sop_class import (
    ModalityWorklistInformationFind,
    PatientRootQueryRetrieveInformationModelFind,
    StudyRootQueryRetrieveInformationModelFind,
)

CALLING_AE_TITLE = "SYNTHETIC-CHECK"
PENDING_STATUSES = (0xFF00, 0xFF01)
DATA_SUFFIXES = (".dcm", ".wl")
QUERY_RETRIEVE_PEERS = (("DCMQRSCP", "dcmtk-qr"), ("AMIS", "amis"), ("DCM4CHEE", "dcm4chee"))
WORKLIST_PEERS = (("WLMSCPFS", "dcmtk-mwl"), ("AMIS", "amis"))
REGISTRY_IN_REPOSITORY = "quality/data/synteticka-sada/registry.json"


def identity(dataset: Dataset) -> tuple[str, str]:
    return str(dataset.get("PatientID", "") or ""), str(dataset.get("IssuerOfPatientID", "") or "")


def patient_query() -> Dataset:
    identifier = Dataset()
    identifier.QueryRetrieveLevel = "PATIENT"
    identifier.PatientID = ""
    identifier.IssuerOfPatientID = ""
    return identifier


def study_query() -> Dataset:
    identifier = patient_query()
    identifier.QueryRetrieveLevel = "STUDY"
    identifier.StudyInstanceUID = ""
    return identifier


def worklist_query() -> Dataset:
    identifier = Dataset()
    identifier.PatientID = ""
    identifier.IssuerOfPatientID = ""
    return identifier


class Registry:
    def __init__(self, path: Path) -> None:
        content = path.read_bytes()
        patients = json.loads(content)["patients"]
        self.sha256 = hashlib.sha256(content).hexdigest()
        self.pairs = {(patient["id"], patient["issuer"]) for patient in patients}
        self.ids = {patient["id"] for patient in patients}

    def classify(self, datasets: list[Dataset]) -> tuple[int, int]:
        foreign = 0
        issuer_missing = 0
        for dataset in datasets:
            patient_id, issuer = identity(dataset)
            if issuer == "":
                if patient_id in self.ids:
                    issuer_missing += 1
                else:
                    foreign += 1
            elif (patient_id, issuer) not in self.pairs:
                foreign += 1
        return foreign, issuer_missing


def check_files(registry: Registry, data: Path) -> dict:
    paths = sorted(path for path in data.rglob("*") if path.suffix in DATA_SUFFIXES)
    foreign_files = []
    issuer_missing = 0
    for path in paths:
        foreign, missing = registry.classify([dcmread(path, stop_before_pixels=True)])
        issuer_missing += missing
        if foreign > 0:
            foreign_files.append(str(path.relative_to(data)))
    return {
        "checked": len(paths),
        "foreign": foreign_files,
        "issuerMissing": issuer_missing,
        "result": "pass" if paths and not foreign_files and issuer_missing == 0 else "fail",
    }


def find(called_ae_title: str, host: str, model: str, identifier: Dataset) -> tuple[list[Dataset], int | None]:
    ae = AE(ae_title=CALLING_AE_TITLE)
    ae.add_requested_context(model)
    association = ae.associate(host, PORT, ae_title=called_ae_title)
    if not association.is_established:
        raise ConnectionError(f"association with {called_ae_title}@{host} not established")
    matches: list[Dataset] = []
    final_status: int | None = None
    try:
        for status, match in association.send_c_find(identifier, model):
            code = status.get("Status") if status else None
            if code in PENDING_STATUSES and match is not None:
                matches.append(match)
            elif code is not None:
                final_status = code
    finally:
        association.release()
    return matches, final_status


def check_query(registry: Registry, called_ae_title: str, host: str, query: str, model: str, identifier: Dataset) -> dict:
    entry: dict = {"peer": f"{called_ae_title}@{host}", "query": query}
    try:
        matches, final_status = find(called_ae_title, host, model, identifier)
    except ConnectionError as error:
        return {**entry, "result": "fail", "reason": str(error)}
    foreign, issuer_missing = registry.classify(matches)
    complete = final_status == STATUS_SUCCESS
    return {
        **entry,
        "matches": len(matches),
        "finalStatus": None if final_status is None else f"{final_status:04X}",
        "complete": complete,
        "foreign": foreign,
        "issuerMissing": issuer_missing,
        "result": "pass" if complete and matches and foreign == 0 else "fail",
    }


def main() -> None:
    logging.basicConfig(level=logging.WARNING)
    _config.LOG_REQUEST_IDENTIFIERS = False
    _config.LOG_RESPONSE_IDENTIFIERS = False
    parser = argparse.ArgumentParser()
    parser.add_argument("--registry", type=Path, required=True)
    parser.add_argument("--data", type=Path, required=True)
    parser.add_argument("--evidence", type=Path, required=True)
    arguments = parser.parse_args()

    registry = Registry(arguments.registry)
    queries = [
        check_query(registry, ae, host, "patient-root PATIENT", PatientRootQueryRetrieveInformationModelFind, patient_query())
        for ae, host in QUERY_RETRIEVE_PEERS
    ]
    queries += [
        check_query(registry, ae, host, "study-root STUDY", StudyRootQueryRetrieveInformationModelFind, study_query())
        for ae, host in QUERY_RETRIEVE_PEERS
    ]
    queries += [
        check_query(registry, ae, host, "modality worklist", ModalityWorklistInformationFind, worklist_query())
        for ae, host in WORKLIST_PEERS
    ]
    files = check_files(registry, arguments.data)
    result = "pass" if files["result"] == "pass" and all(query["result"] == "pass" for query in queries) else "fail"
    evidence = {
        "check": "synthetic-data",
        "source": "ADR-017, Q-040, integrace-dicom.md 11",
        "checkedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "registry": {"path": REGISTRY_IN_REPOSITORY, "sha256": registry.sha256, "patients": len(registry.pairs)},
        "files": files,
        "queries": queries,
        "result": result,
    }
    arguments.evidence.write_text(json.dumps(evidence, indent="\t", ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({"event": "synthetic-check-finished", "result": result}), file=sys.stderr)
    sys.exit(0 if result == "pass" else 1)


if __name__ == "__main__":
    main()
