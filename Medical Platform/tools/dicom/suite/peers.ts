// architektura.md 11, integrace-dicom.md 9.1, 11.1

export interface Peer {
	aeTitle: string
	host: string
	port: number
	proxyPort: number
}

export interface DicomTarget {
	peer: string
	aeTitle: string
	host: string
	port: number
}

const DICOM_PORT = 11_112
const PROXY_HOST = "127.0.0.1"

export const PEERS: readonly Peer[] = [
	{ aeTitle: "STORESCP", host: "dcmtk-store", port: DICOM_PORT, proxyPort: 11_201 },
	{ aeTitle: "DCMQRSCP", host: "dcmtk-qr", port: DICOM_PORT, proxyPort: 11_202 },
	{ aeTitle: "WLMSCPFS", host: "dcmtk-mwl", port: DICOM_PORT, proxyPort: 11_203 },
	{ aeTitle: "AMIS", host: "amis", port: DICOM_PORT, proxyPort: 11_204 },
	{ aeTitle: "DCM4CHEE", host: "dcm4chee", port: DICOM_PORT, proxyPort: 11_205 },
	{ aeTitle: "BASELINE", host: "hostile", port: DICOM_PORT, proxyPort: 11_206 },
]

export function throughProxy(peer: Peer): DicomTarget {
	return { peer: peer.host, aeTitle: peer.aeTitle, host: PROXY_HOST, port: peer.proxyPort }
}
