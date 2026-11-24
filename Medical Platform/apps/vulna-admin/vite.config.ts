import { fileURLToPath } from "node:url"
import { ADMIN_API_BASE_PATH } from "@ansora/contracts"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

const apiProxy = process.env.VITE_API_PROXY

// NAB-305, NAB-324, ADR-005
export default defineConfig({
	plugins: [react(), tailwindcss()],
	resolve: {
		alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
	},
	optimizeDeps: {
		include: ["@ansora/contracts"],
	},
	build: {
		outDir: "dist",
		sourcemap: true,
	},
	server: {
		port: 5173,
		proxy: apiProxy
			? { [ADMIN_API_BASE_PATH]: { target: apiProxy, rewrite: (path) => path.slice(ADMIN_API_BASE_PATH.length) } }
			: { "/api": "http://localhost:3000" },
	},
})
