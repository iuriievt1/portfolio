# ADR-017, Q-040, architektura.md 11, integrace-dicom.md 11.1

PORT = 11112
STATUS_SUCCESS = 0x0000
# integrace-dicom.md 5.7, 10
CHARACTER_SET = "ISO_IR 192"
# PS3.3 C.7.1.1
SEX_CODES = {"female": "F", "male": "M", "other": "O"}


def person_name(patient: dict) -> str:
    return f"{patient['familyName']}^{patient['givenName']}"


def sex_code(patient: dict) -> str:
    return SEX_CODES.get(patient["sex"] or "", "")
