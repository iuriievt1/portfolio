# architektura.md 11, integrace-dicom.md 11.1

import os

from dicom_synthetic import PORT, STATUS_SUCCESS
from pynetdicom import AE
from pynetdicom.sop_class import Verification

HEALTHCHECK_AE_TITLE = "HEALTHCHECK"
LOOPBACK = "127.0.0.1"

ae = AE(ae_title=HEALTHCHECK_AE_TITLE)
ae.add_requested_context(Verification)
association = ae.associate(LOOPBACK, PORT, ae_title=os.environ["AMIS_AE_TITLE"])
if not association.is_established:
    raise SystemExit(1)
response = association.send_c_echo()
association.release()
raise SystemExit(0 if response.get("Status") == STATUS_SUCCESS else 1)
