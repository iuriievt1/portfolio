import { PEERS } from "../suite/peers"
import { WireProxy } from "./proxy"

const evidence = process.env.DICOM_WIRE_EVIDENCE
if (evidence === undefined || evidence === "") {
	throw new Error("DICOM_WIRE_EVIDENCE is required")
}

const proxy = new WireProxy(
	PEERS.map((peer) => ({ name: peer.host, listenPort: peer.proxyPort, targetHost: peer.host, targetPort: peer.port })),
	evidence,
)

process.once("SIGTERM", () => {
	proxy
		.stop()
		.then(() => process.exit(0))
		.catch((error: unknown) => {
			console.error(error)
			process.exit(1)
		})
})

proxy
	.start()
	.then(() => console.log(JSON.stringify({ event: "wire-proxy-listening", routes: PEERS.length })))
	.catch((error: unknown) => {
		console.error(error)
		process.exit(1)
	})
