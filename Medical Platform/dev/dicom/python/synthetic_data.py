# ADR-017, ADR-024, Q-040, architektura.md 11, kvalita-rizika-a-pouzitelnost.md 7.3, integrace-dicom.md 11

import argparse
import datetime
import json
import shutil
import uuid
from pathlib import Path

from dicom_synthetic import CHARACTER_SET, person_name, sex_code
from pydicom.dataset import Dataset, FileMetaDataset
from pydicom.sequence import Sequence
from pydicom.uid import ExplicitVRLittleEndian

ENCAPSULATED_PDF_STORAGE = "1.2.840.10008.5.1.4.1.1.104.1"
VL_PHOTOGRAPHIC_IMAGE_STORAGE = "1.2.840.10008.5.1.4.1.1.77.1.4"
MODALITY_WORKLIST_FIND = "1.2.840.10008.5.1.4.31"
UID_ROOT = "2.25."
UID_NAMESPACE = uuid.uuid5(uuid.NAMESPACE_URL, "urn:vulna:synthetic:dicom")
MANUFACTURER = "veevoy synthetic"
WORKLIST_AE_TITLE = "WLMSCPFS"
WORKLIST_LOCKFILE = "lockfile"
SCHEDULED_STATION_AE_TITLE = "VULNA"
PHOTOGRAPH_MODALITY = "XC"
DOCUMENT_MODALITY = "DOC"
# integrace-dicom.md 6.4, Q-035
NESTED_DESCRIPTION = "Převaz a fotodokumentace rány"
# PS3.4 K.6.1.2.2
REQUESTED_PROCEDURE_DESCRIPTION = "Fotodokumentace rány"
DOCUMENT_TITLE = "Syntetický dokument"
PHOTO_ROWS = 48
PHOTO_COLUMNS = 64
RGB_SAMPLES = 3
RED_STEP = 5
GREEN_STEP = 4
BLUE_LEVEL = 128
STUDY_TIME = "080000"

def uid(name: str) -> str:
    return UID_ROOT + str(uuid.uuid5(UID_NAMESPACE, name).int)


def dicom_date(value: datetime.date) -> str:
    return value.strftime("%Y%m%d")


def dicom_time(value: str | None) -> str:
    return "" if value is None else value.replace(":", "")


def minimal_pdf() -> bytes:
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] >>",
    ]
    body = bytearray(b"%PDF-1.4\n")
    offsets = []
    for number, content in enumerate(objects, start=1):
        offsets.append(len(body))
        body += b"%d 0 obj\n" % number + content + b"\nendobj\n"
    xref = len(body)
    body += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objects) + 1)
    for offset in offsets:
        body += b"%010d 00000 n \n" % offset
    body += b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (len(objects) + 1, xref)
    return bytes(body)


def even(value: bytes) -> bytes:
    return value if len(value) % 2 == 0 else value + b"\0"


def file_meta(sop_class_uid: str, sop_instance_uid: str) -> FileMetaDataset:
    meta = FileMetaDataset()
    meta.MediaStorageSOPClassUID = sop_class_uid
    meta.MediaStorageSOPInstanceUID = sop_instance_uid
    meta.TransferSyntaxUID = ExplicitVRLittleEndian
    return meta


def patient_module(dataset: Dataset, patient: dict) -> None:
    dataset.SpecificCharacterSet = CHARACTER_SET
    dataset.PatientName = person_name(patient)
    dataset.PatientID = patient["id"]
    dataset.IssuerOfPatientID = patient["issuer"]
    dataset.PatientBirthDate = patient["birthDate"].replace("-", "")
    dataset.PatientSex = sex_code(patient)


def instance(patient: dict, study_key: str, sop_class_uid: str, modality: str, today: datetime.date) -> Dataset:
    dataset = Dataset()
    patient_module(dataset, patient)
    dataset.StudyInstanceUID = uid(f"study/{study_key}")
    dataset.StudyDate = dicom_date(today)
    dataset.StudyTime = STUDY_TIME
    dataset.StudyID = "1"
    dataset.AccessionNumber = ""
    dataset.ReferringPhysicianName = ""
    dataset.SeriesInstanceUID = uid(f"series/{study_key}/{modality}")
    dataset.SeriesNumber = 1
    dataset.Modality = modality
    dataset.Manufacturer = MANUFACTURER
    dataset.SOPClassUID = sop_class_uid
    dataset.SOPInstanceUID = uid(f"instance/{study_key}/{modality}")
    dataset.InstanceNumber = 1
    dataset.ContentDate = dicom_date(today)
    dataset.ContentTime = STUDY_TIME
    dataset.file_meta = file_meta(sop_class_uid, dataset.SOPInstanceUID)
    return dataset


def document(patient: dict, study_key: str, today: datetime.date) -> Dataset:
    dataset = instance(patient, study_key, ENCAPSULATED_PDF_STORAGE, DOCUMENT_MODALITY, today)
    dataset.ConversionType = "SD"
    dataset.BurnedInAnnotation = "YES"
    dataset.DocumentTitle = DOCUMENT_TITLE
    dataset.ConceptNameCodeSequence = Sequence()
    dataset.AcquisitionDateTime = dicom_date(today) + STUDY_TIME
    dataset.MIMETypeOfEncapsulatedDocument = "application/pdf"
    dataset.EncapsulatedDocument = even(minimal_pdf())
    return dataset


def photograph(patient: dict, study_key: str, today: datetime.date) -> Dataset:
    dataset = instance(patient, study_key, VL_PHOTOGRAPHIC_IMAGE_STORAGE, PHOTOGRAPH_MODALITY, today)
    dataset.ImageType = ["ORIGINAL", "PRIMARY"]
    dataset.AcquisitionDateTime = dicom_date(today) + STUDY_TIME
    dataset.AcquisitionContextSequence = Sequence()
    dataset.LossyImageCompression = "00"
    dataset.SamplesPerPixel = RGB_SAMPLES
    dataset.PhotometricInterpretation = "RGB"
    dataset.PlanarConfiguration = 0
    dataset.Rows = PHOTO_ROWS
    dataset.Columns = PHOTO_COLUMNS
    dataset.BitsAllocated = 8
    dataset.BitsStored = 8
    dataset.HighBit = 7
    dataset.PixelRepresentation = 0
    dataset.PixelData = bytes(
        value
        for row in range(PHOTO_ROWS)
        for column in range(PHOTO_COLUMNS)
        for value in (row * RED_STEP, column * GREEN_STEP, BLUE_LEVEL)
    )
    return dataset


def worklist_item(patient: dict, encounter: dict, number: str, today: datetime.date) -> Dataset:
    dataset = Dataset()
    patient_module(dataset, patient)
    dataset.AccessionNumber = encounter["accessionNumber"] or ""
    dataset.AdmissionID = encounter["admissionId"] or ""
    dataset.StudyInstanceUID = uid(f"worklist/{number}")
    dataset.RequestedProcedureID = number
    dataset.RequestedProcedureDescription = REQUESTED_PROCEDURE_DESCRIPTION
    step = Dataset()
    step.Modality = PHOTOGRAPH_MODALITY
    step.ScheduledStationAETitle = SCHEDULED_STATION_AE_TITLE
    step.ScheduledProcedureStepStartDate = dicom_date(today + datetime.timedelta(days=encounter["dayOffset"]))
    step.ScheduledProcedureStepStartTime = dicom_time(encounter["time"])
    step.ScheduledProcedureStepID = number
    step.ScheduledProcedureStepDescription = NESTED_DESCRIPTION
    dataset.ScheduledProcedureStepSequence = Sequence([step])
    dataset.file_meta = file_meta(MODALITY_WORKLIST_FIND, uid(f"worklist-file/{number}"))
    return dataset


def clear(directory: Path) -> None:
    for child in directory.iterdir():
        if child.is_dir():
            shutil.rmtree(child)
        else:
            child.unlink()


def generate(registry_path: Path, output: Path, today: datetime.date) -> None:
    registry = json.loads(registry_path.read_text(encoding="utf-8"))
    patients = {patient["key"]: patient for patient in registry["patients"]}
    clear(output)

    instances = output / "instances"
    instances.mkdir()
    for key, patient in patients.items():
        document(patient, key, today).save_as(instances / f"{key}.dcm", enforce_file_format=True)

    worklist = output / "worklist" / WORKLIST_AE_TITLE
    worklist.mkdir(parents=True)
    (worklist / WORKLIST_LOCKFILE).touch()
    for index, encounter in enumerate(registry["scheduledEncounters"], start=1):
        number = f"{index:04d}"
        item = worklist_item(patients[encounter["patient"]], encounter, number, today)
        item.save_as(worklist / f"{number}.wl", enforce_file_format=True)

    smoke = output / "smoke"
    smoke.mkdir()
    smoke_patient = next(iter(patients.values()))
    document(smoke_patient, "smoke", today).save_as(smoke / "document.dcm", enforce_file_format=True)
    photograph(smoke_patient, "smoke", today).save_as(smoke / "photograph.dcm", enforce_file_format=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--registry", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    arguments = parser.parse_args()
    generate(arguments.registry, arguments.output, datetime.date.today())


if __name__ == "__main__":
    main()
