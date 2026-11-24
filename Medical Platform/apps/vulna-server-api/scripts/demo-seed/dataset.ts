import { BODY_VIEW, LATERALITY } from "@ansora/contracts"
import type { DemoDataset, DemoPatient } from "./demo-types"

const TITLE = {
	CONSENT: "photo-consent",
	MEDICAL_REPORT: "medical-report",
	LAB_RESULTS: "lab-results",
	REQUEST_FORM: "request-form",
	DISCHARGE_REPORT: "discharge-report",
} as const

// Figma 07 C.2, Figma 08 A.1
const PROCHAZKOVA_EVA: DemoPatient = {
	key: "prochazkova-eva",
	identifier: "0098812",
	visits: [
		{ key: "v0", startedAt: "2026-08-07T13:30:00+02:00", completedAt: "2026-08-07T13:50:00+02:00" },
		{ key: "v1", startedAt: "2026-08-14T08:50:00+02:00", completedAt: "2026-08-14T09:25:00+02:00" },
		{ key: "v2", startedAt: "2026-08-27T10:05:00+02:00", completedAt: "2026-08-27T10:50:00+02:00" },
		{ key: "v3", startedAt: "2026-09-04T14:25:00+02:00", completedAt: "2026-09-04T15:10:00+02:00" },
		{ key: "v4", startedAt: "2026-09-12T09:00:00+02:00", completedAt: "2026-09-12T09:55:00+02:00" },
		{ key: "v5", startedAt: "2026-09-26T11:00:00+02:00", completedAt: "2026-09-26T11:30:00+02:00" },
	],
	wounds: [
		{
			key: "right-lower-leg",
			regionCode: "25763004",
			view: BODY_VIEW.ANTERIOR,
			laterality: LATERALITY.RIGHT,
			woundType: "leg-ulcer",
			change: { changedAt: "2026-08-20T10:00:00+02:00", from: "traumatic-wound", to: "leg-ulcer" },
			records: [
				{
					visit: "v1",
					closedAt: "2026-08-14T08:58:00+02:00",
					healingPhase: "inflammatory",
					note: "Oděrka po pádu, spodina čistá, drobné krvácení.",
					photos: ["wound-8.jpg"],
				},
				{
					visit: "v2",
					closedAt: "2026-08-27T10:12:00+02:00",
					healingPhase: "sloughy",
					note: "Spodina krytá fibrinovým povlakem, okolí zarudlé, bolestivé při převazu.",
					photos: ["wound-6.jpg", "wound-7.jpg"],
				},
				{
					visit: "v3",
					closedAt: "2026-09-04T14:31:00+02:00",
					healingPhase: "granulating",
					note: "Spodina granuluje, okraje mírně macerované, slabá serózní sekrece.",
					photos: ["wound-4.jpg", "wound-5.jpg"],
				},
				{
					visit: "v4",
					closedAt: "2026-09-12T09:10:00+02:00",
					healingPhase: "granulating",
					note: "Okraje klidné, spodina granuluje, bez sekrece.",
					photos: ["wound-1.jpg", "wound-2.jpg", "wound-3.jpg"],
				},
			],
		},
		{
			key: "left-thigh",
			regionCode: "450693000",
			view: BODY_VIEW.ANTERIOR,
			laterality: LATERALITY.LEFT,
			woundType: "pressure-ulcer",
			change: undefined,
			records: [
				{
					visit: "v2",
					closedAt: "2026-08-27T10:20:00+02:00",
					healingPhase: "sloughy",
					note: "Defekt 2 × 1,5 cm s fibrinovým povlakem, okolí zarudlé.",
					photos: ["wound-9.jpg", "wound-10.jpg"],
				},
				{
					visit: "v3",
					closedAt: "2026-09-04T14:38:00+02:00",
					healingPhase: "sloughy",
					note: undefined,
					photos: ["wound-10.jpg"],
				},
				{
					visit: "v4",
					closedAt: "2026-09-12T09:16:00+02:00",
					healingPhase: "granulating",
					note: "Povlak ustupuje, spodina růžová.",
					photos: ["wound-9.jpg"],
				},
			],
		},
		{
			key: "right-breast",
			regionCode: "82038008",
			view: BODY_VIEW.ANTERIOR,
			laterality: LATERALITY.RIGHT,
			woundType: "radiation-dermatitis",
			change: undefined,
			records: [
				{
					visit: "v3",
					closedAt: "2026-09-04T14:44:00+02:00",
					healingPhase: "inflammatory",
					note: "Erytém v ozařovaném poli, bez mokvání.",
					photos: ["wound-11.jpg"],
				},
				{
					visit: "v4",
					closedAt: "2026-09-12T09:33:00+02:00",
					healingPhase: "epithelializing",
					note: undefined,
					photos: ["wound-11.jpg", "wound-12.jpg"],
				},
			],
		},
		{
			key: "left-foot",
			regionCode: "60496002",
			view: BODY_VIEW.ANTERIOR,
			laterality: LATERALITY.LEFT,
			woundType: "diabetic-foot",
			change: undefined,
			records: [
				{
					visit: "v3",
					closedAt: "2026-09-04T14:49:00+02:00",
					healingPhase: "necrotic",
					note: "Suchá nekróza na hřbetu nohy, okolí klidné.",
					photos: ["wound-12.jpg"],
				},
				{
					visit: "v4",
					closedAt: "2026-09-12T09:38:00+02:00",
					healingPhase: "sloughy",
					note: undefined,
					photos: ["wound-12.jpg"],
				},
			],
		},
		{
			key: "right-forearm",
			regionCode: "70559009",
			view: BODY_VIEW.ANTERIOR,
			laterality: LATERALITY.RIGHT,
			woundType: "burn",
			change: undefined,
			records: [
				{
					visit: "v5",
					closedAt: "2026-09-26T11:05:00+02:00",
					healingPhase: "epithelializing",
					note: "Drobná popálenina od horké vody, puchýř odstraněn.",
					photos: ["wound-10.jpg"],
				},
			],
		},
		{
			key: "sacrum",
			regionCode: "51027004",
			view: BODY_VIEW.POSTERIOR,
			laterality: null,
			woundType: "pressure-ulcer",
			change: undefined,
			records: [
				{
					visit: "v1",
					closedAt: "2026-08-14T09:05:00+02:00",
					healingPhase: "necrotic",
					note: "Černá nekróza 3 × 2 cm, okolí bez známek infekce.",
					photos: ["wound-9.jpg"],
				},
				{
					visit: "v2",
					closedAt: "2026-08-27T10:26:00+02:00",
					healingPhase: "sloughy",
					note: undefined,
					photos: ["wound-9.jpg", "wound-11.jpg"],
				},
				{
					visit: "v4",
					closedAt: "2026-09-12T09:21:00+02:00",
					healingPhase: "granulating",
					note: "Po nekrektomii spodina granuluje.",
					photos: ["wound-11.jpg"],
				},
			],
		},
		{
			key: "right-heel",
			regionCode: "84607009",
			view: BODY_VIEW.POSTERIOR,
			laterality: LATERALITY.RIGHT,
			woundType: "pressure-ulcer",
			change: undefined,
			records: [
				{
					visit: "v2",
					closedAt: "2026-08-27T10:31:00+02:00",
					healingPhase: "inflammatory",
					note: "Zarudnutí paty, kůže neporušená.",
					photos: ["wound-12.jpg"],
				},
				{
					visit: "v4",
					closedAt: "2026-09-12T09:27:00+02:00",
					healingPhase: "epithelializing",
					note: undefined,
					photos: ["wound-12.jpg"],
				},
			],
		},
		{
			key: "left-buttock",
			regionCode: "22180002",
			view: BODY_VIEW.POSTERIOR,
			laterality: LATERALITY.LEFT,
			woundType: "pressure-ulcer",
			change: undefined,
			records: [
				{
					visit: "v5",
					closedAt: "2026-09-26T11:12:00+02:00",
					healingPhase: "inflammatory",
					note: "Nový defekt 1 × 1 cm, polohování dvouhodinové.",
					photos: ["wound-11.jpg"],
				},
			],
		},
		{
			key: "lower-back",
			regionCode: "113182001",
			view: BODY_VIEW.POSTERIOR,
			laterality: null,
			woundType: "surgical-wound",
			change: undefined,
			records: [
				{
					visit: "v3",
					closedAt: "2026-09-04T14:55:00+02:00",
					healingPhase: "granulating",
					note: "Jizva po operaci páteře, dehiscence 2 cm.",
					photos: ["wound-10.jpg", "wound-9.jpg"],
				},
				{
					visit: "v4",
					closedAt: "2026-09-12T09:44:00+02:00",
					healingPhase: "epithelializing",
					note: undefined,
					photos: ["wound-10.jpg"],
				},
			],
		},
		{
			key: "left-calf",
			regionCode: "47224004",
			view: BODY_VIEW.POSTERIOR,
			laterality: LATERALITY.LEFT,
			woundType: "leg-ulcer",
			change: undefined,
			records: [
				{
					visit: "v5",
					closedAt: "2026-09-26T11:18:00+02:00",
					healingPhase: "sloughy",
					note: undefined,
					photos: ["wound-12.jpg", "wound-11.jpg"],
				},
			],
		},
	],
	documents: [
		{
			key: "discharge-report",
			visit: "v0",
			closedAt: "2026-08-07T13:40:00+02:00",
			title: TITLE.DISCHARGE_REPORT,
			pages: ["page-2.jpg"],
		},
		{
			key: "request-form",
			visit: "v1",
			closedAt: "2026-08-14T09:15:00+02:00",
			title: TITLE.REQUEST_FORM,
			pages: ["page-1.jpg"],
		},
		{
			key: "lab-results",
			visit: "v2",
			closedAt: "2026-08-27T10:40:00+02:00",
			title: TITLE.LAB_RESULTS,
			pages: ["page-3.jpg"],
		},
		{
			key: "medical-report",
			visit: "v3",
			closedAt: "2026-09-04T15:02:00+02:00",
			title: TITLE.MEDICAL_REPORT,
			pages: ["page-1.jpg", "page-2.jpg", "page-3.jpg"],
		},
		{
			key: "photo-consent",
			visit: "v4",
			closedAt: "2026-09-12T09:06:00+02:00",
			title: TITLE.CONSENT,
			pages: ["page-2.jpg"],
		},
	],
}

const SVOBODOVA_MARIE: DemoPatient = {
	key: "svobodova-marie",
	identifier: "1000203",
	visits: [
		{ key: "v1", startedAt: "2026-09-10T08:15:00+02:00", completedAt: "2026-09-10T08:45:00+02:00" },
		{ key: "v2", startedAt: "2026-09-24T08:20:00+02:00", completedAt: "2026-09-24T08:40:00+02:00" },
	],
	wounds: [
		{
			key: "sacrum",
			regionCode: "51027004",
			view: BODY_VIEW.POSTERIOR,
			laterality: null,
			woundType: "pressure-ulcer",
			change: undefined,
			records: [
				{
					visit: "v1",
					closedAt: "2026-09-10T08:22:00+02:00",
					healingPhase: "necrotic",
					note: "Nekróza krytá krustou, okolí klidné.",
					photos: ["wound-9.jpg"],
				},
				{
					visit: "v2",
					closedAt: "2026-09-24T08:28:00+02:00",
					healingPhase: "sloughy",
					note: undefined,
					photos: ["wound-11.jpg", "wound-9.jpg"],
				},
			],
		},
		{
			key: "left-heel",
			regionCode: "84607009",
			view: BODY_VIEW.POSTERIOR,
			laterality: LATERALITY.LEFT,
			woundType: "pressure-ulcer",
			change: undefined,
			records: [
				{
					visit: "v1",
					closedAt: "2026-09-10T08:31:00+02:00",
					healingPhase: "inflammatory",
					note: undefined,
					photos: ["wound-12.jpg"],
				},
			],
		},
		{
			key: "right-elbow",
			regionCode: "181536004",
			view: BODY_VIEW.POSTERIOR,
			laterality: LATERALITY.RIGHT,
			woundType: "traumatic-wound",
			change: undefined,
			records: [
				{
					visit: "v2",
					closedAt: "2026-09-24T08:35:00+02:00",
					healingPhase: "granulating",
					note: "Oděrka po pádu z lůžka.",
					photos: ["wound-10.jpg"],
				},
			],
		},
	],
	documents: [],
}

// CAP-018-R15, quality/data/synteticka-sada
export const DEMO_DATASET: DemoDataset = {
	patientIdSystem: "urn:vulna:synthetic:patient-id",
	issuer: "MOU",
	titles: [
		{
			code: TITLE.MEDICAL_REPORT,
			names: { cs: "Lékařská zpráva", en: "Medical report" },
		},
		{
			code: TITLE.CONSENT,
			names: {
				cs: "Souhlas s pořízením fotodokumentace ran a kožních defektů",
				en: "Consent to photo documentation of wounds and skin defects",
			},
		},
		{
			code: TITLE.LAB_RESULTS,
			names: { cs: "Laboratorní výsledky", en: "Laboratory results" },
		},
		{
			code: TITLE.REQUEST_FORM,
			names: { cs: "Žádanka", en: "Request form" },
		},
		{
			code: TITLE.DISCHARGE_REPORT,
			names: { cs: "Propouštěcí zpráva", en: "Discharge report" },
		},
	],
	patients: [PROCHAZKOVA_EVA, SVOBODOVA_MARIE],
}
