// SurakshaVaani server: keeps the hazard log and makes every Gemini call.
// The Gemini key stays here, on the server, and never reaches the browser.
import express from "express";
import { GoogleGenAI } from "@google/genai";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
let KEY = process.env.GEMINI_API_KEY || process.env.API_KEY || "";
try {
  const envPath = path.join(ROOT, "..", ".dev.env.json");
  if (fs.existsSync(envPath)) {
    const raw = JSON.parse(fs.readFileSync(envPath, "utf8"));
    if (raw && raw.GEMINI_API_KEY && (!KEY || KEY.startsWith("MY_") || !KEY.startsWith("AQ."))) {
      KEY = raw.GEMINI_API_KEY;
    }
  }
} catch {}
const MODEL = process.env.GEMINI_MODEL || "gemini-flash-lite-latest";
const ai = KEY ? new GoogleGenAI({
  apiKey: KEY,
  httpOptions: {
    headers: { "User-Agent": "aistudio-build" },
    ...(process.env.GEMINI_BASE_URL ? { baseUrl: process.env.GEMINI_BASE_URL } : {})
  }
}) : null;

/* ---------- Reference data (same as the page) ---------- */
const H = 3600e3;
const STARTED = Date.now();
const CONSTRUCTION_SITES = [
  {
    id: "site-hinjewadi",
    name: "Metro Line 4 - Hinjewadi Station Project",
    shortName: "Metro Line 4 (Pune)",
    code: "PUN-MTR-04",
    city: "Pune, Maharashtra",
    lead: "Priya Sharma (Chief Safety Eng)",
    leadShort: "Priya Sharma",
    badge: "SE-8821",
    icon: "🚇",
    radio: "VHF Channel 04 (156.200 MHz)",
    radioShort: "VHF Ch 04",
    defaultZone: "Tower B",
    totalCrew: 320,
    description: "Elevated viaduct, station box civil works, pier casting, and pedestrian concourse."
  },
  {
    id: "site-cyber-gateway",
    name: "Cyber Gateway Commercial Towers - Phase 2",
    shortName: "Cyber Gateway (Bengaluru)",
    code: "BLR-CGW-02",
    city: "Whitefield, Bengaluru",
    lead: "Rajesh Iyer (Senior Safety Lead)",
    leadShort: "Rajesh Iyer",
    badge: "SE-6419",
    icon: "🏢",
    radio: "VHF Channel 02 (156.100 MHz)",
    radioShort: "VHF Ch 02",
    defaultZone: "Tower A",
    totalCrew: 280,
    description: "Twin 32-floor commercial towers, deep basement shoring, perimeter glazing, and MEP substation."
  },
  {
    id: "site-hsr-c3",
    name: "High-Speed Rail Viaduct - Package C3",
    shortName: "High-Speed Rail (Surat)",
    code: "HSR-PKG-C3",
    city: "Surat / Navsari Corridor",
    lead: "Anil Kulkarni (Viaduct Safety In-Charge)",
    leadShort: "Anil Kulkarni",
    badge: "SE-9104",
    icon: "🚄",
    radio: "VHF Channel 06 (156.300 MHz)",
    radioShort: "VHF Ch 06",
    defaultZone: "Batching plant",
    totalCrew: 410,
    description: "Bullet train viaduct launching girder, span pre-casting yard, and high-tension overhead electrification."
  },
  {
    id: "site-coastal-exp",
    name: "Coastal Expressway Bridge Expansion",
    shortName: "Coastal Expressway (Mumbai)",
    code: "MUM-CST-01",
    city: "Worli-Bandra, Mumbai",
    lead: "Sunita Rao (Marine Safety Officer)",
    leadShort: "Sunita Rao",
    badge: "SE-7230",
    icon: "🌉",
    radio: "VHF Channel 08 (156.400 MHz)",
    radioShort: "VHF Ch 08",
    defaultZone: "Scaffolding yard",
    totalCrew: 240,
    description: "Marine sea link bridges, heavy crawler cranes, offshore piling barge, and tidal zone staging."
  }
];
const SITE_ZONES = [
  {
    id: "zone-tower-b",
    name: "Tower B - Excavation & Foundation",
    shortName: "Tower B",
    code: "ZONE-B",
    icon: "🏗️",
    risk: "high",
    supervisor: "Rameshwar Sen (Substructure In-Charge)",
    workersCount: 38,
    operations: "Deep sheet piling, soil anchoring & foundation pouring",
    description: "Deep foundation pit, lift shaft pit, perimeter edge protection, tower crane TC-02"
  },
  {
    id: "zone-tower-a",
    name: "Tower A - Core & Shell (Fl 1-28)",
    shortName: "Tower A",
    code: "ZONE-A",
    icon: "🏢",
    risk: "high",
    supervisor: "Vikram Chauhan (Tower Lead)",
    workersCount: 46,
    operations: "Active climbing formwork, rebar tying & tandem lifting",
    description: "High-rise superstructure, external suspended staging, edge protection, passenger hoists"
  },
  {
    id: "zone-basement",
    name: "Basement & Deep Excavation",
    shortName: "Basement & excavation",
    code: "ZONE-EX",
    icon: "🚜",
    risk: "high",
    supervisor: "Ramesh Kumar (Earthworks Foreman)",
    workersCount: 24,
    operations: "Excavation shoring, dewatering pumps & heavy dumpers",
    description: "Retaining wall anchors, sump dewatering lines, blind spot hauling routes"
  },
  {
    id: "zone-scaffolding",
    name: "Scaffolding & Staging Yard",
    shortName: "Scaffolding yard",
    code: "ZONE-SF",
    icon: "🪜",
    risk: "medium",
    supervisor: "Om Prakash (Scaffold Inspector)",
    workersCount: 18,
    operations: "Cuplock staging stacking, tube & coupler load inspection",
    description: "Component segregation, green/red scaftagging, base jack leveling and storage"
  },
  {
    id: "zone-batching",
    name: "Batching Plant & Equipment Yard",
    shortName: "Batching plant",
    code: "ZONE-BP",
    icon: "🏭",
    risk: "high",
    supervisor: "Gurpreet Singh (Plant In-Charge)",
    workersCount: 22,
    operations: "Transit mixer washout, cement silo pneumatics & aggregate conveyors",
    description: "Automated batching console, high-pressure washing, heavy transit mixer traffic"
  },
  {
    id: "zone-substation",
    name: "Electrical Substation & DG Trench",
    shortName: "Electrical substation",
    code: "ZONE-ES",
    icon: "⚡",
    risk: "critical",
    supervisor: "Anand Swamy (Chief Electrical Officer)",
    workersCount: 14,
    operations: "11kV HT line cabling, transformer commissioning & trench earthing",
    description: "Temporary power distribution boxes (TPDB), LOTO lockout tags, diesel generator exhaust"
  },
  {
    id: "zone-roads-gate",
    name: "Site Roads & Gate 3 Corridor",
    shortName: "Site roads & gate",
    code: "ZONE-GT",
    icon: "🚧",
    risk: "medium",
    supervisor: "Mahesh Yadav (Traffic Marshal)",
    workersCount: 16,
    operations: "Biometric turnstiles, heavy vehicle marshaling & pedestrian barrier",
    description: "Pedestrian walkways, wheel wash bay, boom barriers & mandatory PPE gatekeeper check"
  },
  {
    id: "zone-labour-camp",
    name: "Labour Camp & Welfare Quarters",
    shortName: "Labour camp",
    code: "ZONE-LC",
    icon: "🏕️",
    risk: "low",
    supervisor: "Pradip Mondal (Welfare Officer)",
    workersCount: 55,
    operations: "Worker dormitories, potable water storage & first-aid clinic",
    description: "Living accommodations, hydration stations, fire extinguisher points & cafeteria mess"
  }
];
const ZONES = [...new Set([...SITE_ZONES.map(z => z.shortName), ...SITE_ZONES.map(z => z.name)])];
const CATS = [
  { id: "fall", label: "Fall from height", sev: "high" },
  { id: "electrical", label: "Electrical", sev: "high" },
  { id: "collapse", label: "Excavation or collapse", sev: "high" },
  { id: "lifting", label: "Crane and lifting", sev: "high" },
  { id: "struck", label: "Struck by vehicle or object", sev: "medium" },
  { id: "fire", label: "Fire", sev: "high" },
  { id: "ppe", label: "Missing PPE", sev: "medium" },
  { id: "heat", label: "Heat and welfare", sev: "medium" },
  { id: "housekeeping", label: "Housekeeping and trips", sev: "low" },
  { id: "other", label: "Other", sev: "medium" }
];
const CAT = Object.fromEntries(CATS.map(c => [c.id, c]));
const SEVRANK = { high: 3, medium: 2, low: 1 };
const catLabel = id => (CAT[id] || CAT.other).label;

/* ---------- Store: one JSON file. Swap these functions for Firestore to make it permanent. ---------- */
const DATA_DIR = path.join(ROOT, "data");
const DATA_FILE = path.join(DATA_DIR, "tickets.json");
const tickets = new Map();   // id -> ticket
let rev = 1;                 // bumps on every change, so pages only re-download when something changed
let saveTimer = null;

function loadStore() {
  let list = null;
  try {
    if (fs.existsSync(DATA_FILE)) {
      list = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    } else {
      const seedFile = path.join(ROOT, "seed-tickets.json");
      if (fs.existsSync(seedFile)) {
        list = JSON.parse(fs.readFileSync(seedFile, "utf8"));
        fs.mkdirSync(DATA_DIR, { recursive: true });
        fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2));
      }
    }
  } catch {}
  if (!Array.isArray(list)) list = [];
  for (const t of list) tickets.set(t.id, t);
}
function saveSoon() {
  rev++;
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify([...tickets.values()], null, 2));
  } catch (e) {
    console.error("Couldn't save the log:", e.message);
  }
}
const tCreated = t => t.seeded ? STARTED - (t.seedAgeHours || 0) * H : (t.createdAt || STARTED);
function nextCode() {
  let max = 100;
  for (const t of tickets.values()) { const n = parseInt(String(t.code || "").replace(/\D/g, ""), 10); if (n > max) max = n; }
  return "SV-" + (max + 1);
}
const newId = () => "t" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/* ---------- Gemini helpers ---------- */
function dataUrlPart(u) {
  const m = /^data:([^;,]+);base64,(.+)$/.exec(String(u || ""));
  return m ? { inlineData: { mimeType: m[1], data: m[2] } } : null;
}
async function gemJSON(prompt, parts = []) {
  if (!ai) throw new Error("Gemini AI client is not configured");
  const hasAudio = parts.some(p => p && p.inlineData && String(p.inlineData.mimeType || "").startsWith("audio/"));
  const candidateModels = hasAudio
    ? ["gemini-3-flash-preview", "gemini-flash-latest"]
    : ["gemini-flash-lite-latest", "gemini-3-flash-preview", "gemini-flash-latest"];
  let lastError = null;

  for (const targetModel of candidateModels) {
    try {
      const res = await ai.models.generateContent({
        model: targetModel,
        contents: [{ role: "user", parts: [{ text: prompt }, ...parts] }],
        config: { responseMimeType: "application/json", temperature: 0.2 }
      });
      const txt = res.text || "";
      try { return JSON.parse(txt); }
      catch {
        const m = txt.match(/\{[\s\S]*\}/);
        if (m) return JSON.parse(m[0]);
      }
    } catch (err) {
      lastError = err;
      console.warn(`Gemini API call on model ${targetModel} notice:`, err.message || err);
    }
  }
  throw lastError || new Error("Gemini did not return valid JSON");
}

/* ---------- Text Deduplication & Sanitization ---------- */
function cleanDeduplicatedText(str) {
  if (!str || typeof str !== "string") return "";
  let text = str.replace(/\s+/g, " ").trim();
  // 1. Remove immediate consecutive duplicate words
  text = text.replace(/\b(\w+)( \1\b)+/gi, "$1");
  // 2. Remove immediate consecutive duplicate multi-word phrases
  const words = text.split(" ");
  const n = words.length;
  for (let len = Math.floor(n / 2); len >= 2; len--) {
    for (let i = 0; i <= n - 2 * len; i++) {
      const p1 = words.slice(i, i + len).join(" ").toLowerCase();
      const p2 = words.slice(i + len, i + 2 * len).join(" ").toLowerCase();
      if (p1 === p2) {
        words.splice(i + len, len);
        return cleanDeduplicatedText(words.join(" "));
      }
    }
  }
  return words.join(" ");
}

//* ---------- Triage & Real-time Translation ---------- */
function getEmptyReplyNative(lang = "") {
  return getVoiceUnclearReplyNative(lang);
}

function getVoiceUnclearReplyNative(lang = "") {
  const map = {
    Odia: "କୌଣସି ସ୍ପଷ୍ଟ ସ୍ୱର ଶୁଣାଗଲା ନାହିଁ। ଦୟାକରି ପୁଣି ଥରେ ସ୍ପଷ୍ଟ ଭାବରେ ରେକର୍ଡ କରନ୍ତୁ କିମ୍ବା ଫଟୋ ଅପଲୋଡ୍ କରନ୍ତୁ।",
    Bhojpuri: "कवनो साफ़ आवाज़ ना मिलल। रउआ फेर से साफ़ आवाज़ में रिकार्ड करीं या फ़ोटो अपलोड करीं।",
    Hindi: "आपकी आवाज़ साफ़ नहीं आई। कृपया दोबारा साफ़ आवाज़ में रिकॉर्ड करें या फ़ोटो अपलोड करें।",
    Tamil: "தெளிவான குரல் பதிவு கேட்கவில்லை. தயவுசெய்து மீண்டும் தெளிவாக பதிவு செய்யவும் அல்லது புகைப்படத்தைப் பதிவேற்றவும்.",
    Bengali: "কোনো স্পষ্ট আওয়াজ শোনা যায়নি। অনুগ্রহ করে আবার স্পষ্ট করে রেকর্ড করুন বা ছবি আপলোড করুন।",
    Telugu: "స్పష్టమైన వాయిస్ వినబడలేదు. దయచేసి మళ్లీ స్పష్టంగా రికార్డ్ చేయండి లేదా ఫోటోను అప్‌లోడ్ చేయండి.",
    Marathi: "कोणताही स्पष्ट आवाज ऐकू आला नाही. कृपया पुन्हा स्पष्टपणे रेकॉर्ड करा किंवा फोटो अपलोड करा.",
    English: "Voice was not clear. Please record again clearly or upload a picture of the hazard."
  };
  const key = Object.keys(map).find(k => k.toLowerCase() === String(lang).toLowerCase());
  return map[key] || map[lang] || map.English;
}

function getNotApplicableReplyNative(lang = "") {
  const map = {
    Odia: "ଏହି ବାର୍ତ୍ତାରେ କୌଣସି ସୁରକ୍ଷା ବିପଦ ଚିହ୍ନଟ ହୋଇନାହିଁ। ଯଦି ସାଇଟ୍‌ରେ କୌଣସି ବିପଦ ବା ଅସୁରକ୍ଷିତ ସ୍ଥିତି ଅଛି, ତେବେ ରେକର୍ଡ କରନ୍ତୁ କିମ୍ବା ଫଟୋ ଅପଲୋଡ୍ କରନ୍ତୁ।",
    Bhojpuri: "ई संदेश में कवनो सुरक्षा खतरा ना मिलल। अगर साइट पर कवनो खतरा बा, त फेर से रिकार्ड करीं या फोटो अपलोड करीं।",
    Hindi: "इस संदेश में कोई सुरक्षा खतरा नहीं पाया गया। यदि साइट पर कोई खतरा या असुरक्षित स्थिति है, तो कृपया रिकॉर्ड करें या फोटो अपलोड करें।",
    Tamil: "இந்த செய்தியில் எந்த பாதுகாப்பு ஆபத்தும் குறிப்பிடப்படவில்லை. தளத்தில் ஏதேனும் ஆபத்து இருந்தால், தயவுசெய்து பதிவு செய்யவும் அல்லது புகைப்படம் பதிவேற்றவும்.",
    Bengali: "এই বার্তায় কোনো সুরক্ষা ঝুঁকি পাওয়া যায়নি। সাইটে কোনো বিপদ বা অনিরাপদ পরিস্থিতি থাকলে দয়া করে রেকর্ড করুন বা ছবি আপলোড করুন।",
    Telugu: "ఈ సందేశంలో ఎటువంటి భద్రతా ప్రమాదం గుర్తించబడలేదు. సైట్‌లో ఏదైనా ప్రమాదం ఉంటే, దయచేసి రికార్డ్ చేయండి లేదా ఫోటోను అప్‌లోడ్ చేయండి.",
    Marathi: "या संदेशात कोणताही सुरक्षेचा धोका आढळला नाही. साइटवर काही धोका असल्यास कृपया रेकॉर्ड करा किंवा फोटो अपलोड करा.",
    English: "No safety hazard identified in this message. If there is a hazard or dangerous condition on site, please record what the issue is, or upload a picture."
  };
  const key = Object.keys(map).find(k => k.toLowerCase() === String(lang).toLowerCase());
  return map[key] || map[lang] || map.English;
}

function rulesTriage(text, langName = "", zone = "") {
  const trimmed = String(text || "").trim();
  let detectedLang = langName || "English";

  // Language detection heuristics if not explicitly passed
  if (/[\u0B00-\u0B7F]/.test(trimmed)) detectedLang = "Odia";
  else if (/[\u0B80-\u0BFF]/.test(trimmed)) detectedLang = "Tamil";
  else if (/[\u0980-\u09FF]/.test(trimmed)) detectedLang = "Bengali";
  else if (/[\u0C00-\u0C7F]/.test(trimmed)) detectedLang = "Telugu";
  else if (/[\u0C80-\u0CFF]/.test(trimmed)) detectedLang = "Kannada";
  else if (/[\u0900-\u097F]/.test(trimmed)) {
    if (langName === "Bhojpuri" || /बा|हवे|रेलिंगवा|खनवा|पनिया|लइका|मटिया|करंटवा/.test(trimmed)) detectedLang = "Bhojpuri";
    else if (langName === "Marathi" || /आहे|कठडा|धोका|पडला|झाला|कामगार|नाही/.test(trimmed)) detectedLang = "Marathi";
    else detectedLang = langName || "Hindi";
  } else if (langName) {
    detectedLang = langName;
  }

  // 1. EMPTY / UNCLEAR VOICE / INAUDIBLE
  const isUnclearNoise = !trimmed ||
    /^((\.|\?|!|\s)+|\[.*(inaudible|unclear|silent|audio).*\]|umm+|uhh+|hmm+|shh+|noise|static|inaudible)$/i.test(trimmed) ||
    (trimmed.length < 3 && !/[\u0900-\u0D7F]/.test(trimmed));

  if (isUnclearNoise) {
    return {
      is_hazard: false,
      status: "voice_unclear",
      reason: "voice_not_clear",
      language: detectedLang,
      original: "",
      english: "",
      reply_native: getVoiceUnclearReplyNative(detectedLang),
      reply_en: "Voice was not clear. Please record again clearly or upload a picture of the hazard."
    };
  }

  const s = trimmed.toLowerCase();
  const has = (...w) => w.some(x => s.includes(x));

  let category = null;
  let engSummary = "";
  let engDesc = "";
  let engAction = "";

  // Category detection across Indian scripts and transliterations (Hindi, Bhojpuri, Odia, Bengali, Tamil, Telugu, Marathi, English)
  if (has("wire","तार","तारवा","current","करंट","करंटवा","बिजली","shock","electric","ତାର","ବିଦ୍ୟୁତ୍","ଶକ୍","மின்","மின்கம்பி","மின்சாரம்","ஒயர்","ஷாக்","கரண்ட்","বিদ্যুৎ","শক","বৈদ্যুতিক","వైర్","వైరు","విద్యుత్","షార్ట్","కరెంట్","वायर","वीज")) {
    category = "electrical";
    engSummary = "Exposed Live Electrical Cable";
    engDesc = "Exposed wiring or live electrical current hazard near wet site area.";
    engAction = "De-energize main breaker, isolate water, and inspect cable insulation.";
  } else if (has("railing","रेलिंग","रेलिंगवा","कठडा","edge","किनार","गिर","ऊँचाई","ऊंचाई","harness","हार्नेस","net","जाली","shaft","शाफ्ट","scaffold","ମହଲା","ରେଲିଙ୍ଗ୍","କିନାରା","ரெய்லிங்","விழும்","மாடி விளிம்பு","கைப்பிடி","தளர்வாக","রিলিং","রেলিং","পড়ে","రైలింగ్","అంచు","పడిపో","పడటం","пада")) {
    category = "fall";
    engSummary = "Loose Edge Protection Railing";
    engDesc = "Perimeter edge railing is loose or missing with risk of falling from height.";
    engAction = "Barricade perimeter edge immediately and verify railing anchor clamps.";
  } else if (has("trench","खुदाई","खनवा","मिट्टी","मटिया","माटी","collapse","धंस","गिरल","ଖୋଳା","ମାଟି","ଧସି","பள்ளம்","குழி","மண் சரிவு","গর্ত","ভাঙন","గుంత","కూలిపో","खड्डा","माती खचली")) {
    category = "collapse";
    engSummary = "Excavation Pit Collapse Risk";
    engDesc = "Deep excavation trench missing barricade netting or showing soil subsidence.";
    engAction = "Clear excavation perimeter and install high-visibility warning barricades.";
  } else if (has("crane","क्रेन","கிரேன்","sling","lift","hook","ସିଗନାଲ","தூக்குகிறார்","ক্রেন","హైడ్రా","क्रेनची")) {
    category = "lifting";
    engSummary = "Crane Lifting Operation Hazard";
    engDesc = "Crane or hoist lifting heavy load without designated signalman or clear path.";
    engAction = "Pause lifting operations until a certified rigger is on station.";
  } else if (has("truck","ट्रक","ट्रकवा","ଟ୍ରକ୍","vehicle","falling","गिरा","dumper","डम्पर","வண்டி","லாரி","গাড়ি","డంపర్","गाडी")) {
    category = "struck";
    engSummary = "Vehicle Movement & Traffic Hazard";
    engDesc = "Heavy site dumpers or vehicles operating near unbarricaded worker walkway.";
    engAction = "Enforce segregated pedestrian lane and post traffic marshals.";
  } else if (has("fire","आग","आगि","আগুন","ନିଆଁ","தீ","நெருப்பு","மంటలు","अग्नि")) {
    category = "fire";
    engSummary = "Fire Safety & Flammable Hazard";
    engDesc = "Fire or hot work sparks near combustible construction materials.";
    engAction = "Extinguish hot sparks immediately and deploy dry-chemical fire extinguisher.";
  } else if (has("helmet","हेलमेट","gloves","boots","ppe","ହେଲମେଟ୍","ஹெல்மெட்","கவசம்","হেলমেট","హెల్మెట్")) {
    category = "ppe";
    engSummary = "Missing Mandatory PPE";
    engDesc = "Workers operating without mandatory safety helmets, safety shoes or eye protection.";
    engAction = "Halt unequipped workers and supply certified PPE before resuming work.";
  } else if (has("water","पानी","पनिया","जल","garmi","गर्मी","heat","ঘাম","গরম","dizzy","चक्कर","ପାଣି","நீர்","தாகம்","నీరు","उष्णता")) {
    category = "heat";
    engSummary = "Worker Heat Stress & Welfare";
    engDesc = "Worker showing heat exhaustion symptoms; drinking water station required.";
    engAction = "Provide shaded rest area, ORS hydration, and monitor vital signs.";
  } else if (has("hazard","danger","dangerous","risk","unsafe","accident","broken","leak","crack","खतरा","असुरक्षित","दुर्घटना","टूटा","বিପଦ","ଦୁର୍ଘଟଣା","ஆபத்து","விபத்து","ঝুঁকি","విపత్తు","धोका")) {
    category = "other";
    engSummary = "Reported Construction Hazard";
    engDesc = "Hazard reported on site. Inspect the location immediately.";
    engAction = "Inspect the location and make it safe.";
  }

  // If no hazard keyword was found, flag cleanly as NOT APPLICABLE
  if (!category) {
    return {
      is_hazard: false,
      status: "not_applicable",
      reason: "no_hazard_mentioned",
      language: detectedLang,
      original: trimmed,
      english: trimmed,
      reply_native: getNotApplicableReplyNative(detectedLang),
      reply_en: "No safety hazard identified in this message. If there is a hazard or dangerous condition on site, please record what the issue is, or upload a picture."
    };
  }

  let photoPromptNative = `कृपया इस खतरे (${engSummary}) की एक स्पष्ट फोटो खींचकर भेजें ताकि सुरक्षा टीम तुरंत कार्रवाई कर सके।`;
  if (detectedLang === "Odia") {
    photoPromptNative = `ଦୟାକରି ଏହି ବିପଦର (${engSummary}) ଏକ ସ୍ପଷ୍ଟ ଫଟୋ ଉଠାଇ ପଠାନ୍ତୁ ଯାହାଦ୍ୱାରା ସୁରକ୍ଷା ଟିମ୍ ତୁରନ୍ତ ଯାଞ୍ଚ କରିପାରିବେ।`;
  } else if (detectedLang === "Bhojpuri") {
    photoPromptNative = `रउआ से निहोरा बा कि ई खतरा (${engSummary}) के एगो साफ फोटो खींच के भेजीं ताकि सुरक्षा टीम तुरंते कार्रवाई कर सके।`;
  } else if (detectedLang === "Tamil") {
    photoPromptNative = `பாதுகாப்புக் குழு உடனடியாக நடவடிக்கை எடுக்க, தயவுசெய்து இந்த ஆபத்தின் (${engSummary}) ஒரு தெளிவான புகைப்படத்தை எடுத்து அனுப்பவும்.`;
  } else if (detectedLang === "Bengali") {
    photoPromptNative = `অনুগ্রহ করে এই বিপদের (${engSummary}) একটি স্পষ্ট ছবি তুলে পাঠান যাতে সুরক্ষা দল দ্রুত সমাধান করতে পারে।`;
  } else if (detectedLang === "Telugu") {
    photoPromptNative = `భద్రతా బృందం తక్షణమే సరిదిద్దడానికి దయచేసి ఈ ప్రమాదం (${engSummary}) స్పష్టమైన ఫోటో తీసి పంపండి.`;
  } else if (detectedLang === "Marathi") {
    photoPromptNative = `सुरक्षा पथकाने तातडीने तपासणी करण्यासाठी कृपया या धोक्याचा (${engSummary}) एक स्पष्ट फोटो काढून पाठवा.`;
  } else if (detectedLang === "English") {
    photoPromptNative = `Please take or share a clear photo of the ${engSummary.toLowerCase()} so the site safety team can verify and fix it immediately.`;
  }
  const photoPromptEn = `Please take or share a clear photo of the ${engSummary.toLowerCase()} so the site safety team can verify and fix it immediately.`;

  return {
    is_hazard: true,
    status: "hazard",
    language: detectedLang,
    english: engDesc,
    summary: engSummary,
    category,
    severity: CAT[category].sev,
    action: engAction,
    photoPromptNative,
    photoPromptEn,
    duplicate_of: null,
    source: "rules"
  };
}

async function triage({ text, audio, zone, chan, photo, pre, langName }) {
  text = cleanDeduplicatedText(text);
  const open = [...tickets.values()].filter(t => t.status !== "fixed" && t.zone === zone).slice(0, 10)
    .map(t => ({ code: t.code, category: t.category, summary: t.summary, english: t.english }));
  const expectedLang = langName || "Regional Indian language";
  let aiError = "";
  if (ai) {
    const parts = [];
    if (audio && audio.data) parts.push({ inlineData: { mimeType: audio.mimeType || "audio/wav", data: audio.data } });
    const img = photo ? dataUrlPart(photo) : null;
    if (img) parts.push(img);
    const who = chan === "worker" ? "construction worker (via voice/phone)" : "site supervisor (via voice note)";
    const prompt = `You are the real-time translation and triage engine of SurakshaVaani, an industrial safety assistant on construction sites in India.
A ${who} has communicated via voice note or text.
The reporter's designated working language is: ${expectedLang}.
The report may be in ${expectedLang} (or another Indian language/dialect: Bhojpuri, Odia, Bengali, Tamil, Telugu, Marathi, Hindi, English).
${audio ? `CRITICAL VOICE AUDIO INSTRUCTION:
The worker's voice recording is attached. Listen to the audio with extreme care.
1. Check whether there is intelligible human speech. If the audio is silent, background hum/static, rustling, breathing, or inaudible without clear words, classify it as CASE 1 (EMPTY / INAUDIBLE).
2. If words are spoken, transcribe what the speaker said in ${expectedLang} (or whichever language is spoken) accurately.` : ""}
${text ? `Worker's report / transcript draft: """${String(text).slice(0, 1500)}"""` : ""}
${img ? "A site photo is attached for visual hazard context." : ""}

CRITICAL CLASSIFICATION & TRIAGE RULES:
Evaluate what was said or shown:

CASE 1: VOICE NOT CLEAR / INAUDIBLE / SILENT / NO SPEECH / BACKGROUND NOISE ONLY
If the recording contains no clear intelligible human speech, or is inaudible, silent, muffled, distorted, drowned out by construction machinery/wind, or if the report is empty/unclear:
Return JSON:
{
  "is_hazard": false,
  "status": "voice_unclear",
  "reason": "voice_not_clear",
  "language": "${expectedLang}",
  "original": "",
  "english": "",
  "reply_native": "Automated message in ${expectedLang} stating the voice was not clear and requesting the worker to record again clearly or upload a picture (e.g. आपकी आवाज़ साफ़ नहीं आई। कृपया दोबारा साफ़ आवाज़ में बोलें या फ़ोटो अपलोड करें।)",
  "reply_en": "Voice was not clear. Please record again clearly or upload a picture of the hazard."
}

CASE 2: NOT A SAFETY HAZARD / NOT APPLICABLE
If there is intelligible speech or text, but it does NOT report any construction safety hazard, dangerous physical condition, or near-miss on site (e.g., greetings like 'hello', 'good morning', 'namaste', 'vanakkam', 'hi sir', mic testing like 'hello check 1 2 3', questions about food/lunch, salary, time, general chit-chat):
Return JSON:
{
  "is_hazard": false,
  "status": "not_applicable",
  "reason": "no_hazard_mentioned",
  "language": "${expectedLang}",
  "original": "clean coherent transcript in original script",
  "english": "clean concise English translation of what was said",
  "reply_native": "Polite explanation in ${expectedLang} stating no safety hazard was identified and asking to record the safety hazard or upload a photo if there is a site danger",
  "reply_en": "No safety hazard identified in this message. If there is a hazard or dangerous condition on site, please record what the issue is, or upload a picture."
}

CASE 3: GENUINE CONSTRUCTION SAFETY HAZARD (ISSUE REGISTERED)
If a real hazard or dangerous physical condition on site is reported (e.g. edge protection missing, exposed live wire, trench cave-in, crane/rigging danger, vehicle traffic risk, fire/hot work, missing PPE, heat stress, falling debris, slippery surface, scaffold defect, etc.):
The Safety Dashboard used by site engineers is strictly in English. Regardless of source language:
1. "is_hazard": true
2. "status": "hazard"
3. "registered": true
4. "language": Detect the source language name accurately ("${expectedLang}", "Odia", "Tamil", "Hindi", "Bhojpuri", "Bengali", "Telugu", "Marathi", "English").
5. "english": Accurate, complete, fluent English translation of the report in 1-2 sentences without duplicate phrases.
6. "summary": Concise English hazard headline (3 to 7 words). MUST BE IN ENGLISH (e.g., "Loose Edge Protection Railing on 5th Floor", "Exposed High-Voltage Cable in Water", "Excavation Pit Cave-In Hazard").
7. "category": One of: ${CATS.map(c => c.id).join(", ")}
8. "severity": "high" if life-threatening/serious (falls, electrocution, collapse, crane, fire); "medium" for injury/health risk; "low" for minor risk.
9. "action": Immediate engineering safety action for site supervisor in English (at most 15 words).
10. "original": Clean transcription/text in the reporter's native language and script without repetitions.
11. "photo_prompt_native": In the worker's spoken native language (${expectedLang}), polite request asking them to take or send a clear photo of the exact hazard described.
12. "photo_prompt_en": The same photo request formulated in concise, clear English.
13. "duplicate_of": code of an open ticket in zone that describes the SAME hazard, or null.

Zone chosen by the reporter: ${zone}
Open tickets already in this zone (JSON): ${JSON.stringify(open)}

Reply with only one JSON object conforming to Case 1, Case 2, or Case 3.`;

    try {
      const r = await gemJSON(prompt, parts);
      if (r && typeof r === "object") {
        if (r.is_hazard === false || r.status === "empty" || r.status === "voice_unclear" || r.status === "not_applicable") {
          const isUnclear = r.status === "voice_unclear" || r.status === "empty" || r.reason === "inaudible" || r.reason === "voice_not_clear";
          const status = isUnclear ? "voice_unclear" : "not_applicable";
          return {
            is_hazard: false,
            status,
            reason: isUnclear ? "voice_not_clear" : (r.reason || "no_hazard_mentioned"),
            original: cleanDeduplicatedText(r.original || text || ""),
            english: cleanDeduplicatedText(r.english || text || ""),
            language: String(r.language || expectedLang || "Regional"),
            reply_native: String(r.reply_native || "").trim() || (isUnclear ? getVoiceUnclearReplyNative(expectedLang) : getNotApplicableReplyNative(expectedLang)),
            reply_en: String(r.reply_en || "").trim() || (isUnclear ? "Voice was not clear. Please record again clearly or upload a picture of the hazard." : "No safety hazard identified in this message. If there is a hazard or dangerous condition on site, please record what the issue is, or upload a picture."),
            source: "ai"
          };
        }

        if (r.english) {
          const category = CAT[r.category] ? r.category : "other";
          const severity = SEVRANK[r.severity] ? r.severity : CAT[category].sev;
          const dup = open.find(o => o.code === r.duplicate_of) ? r.duplicate_of : null;
          const cleanedOrig = cleanDeduplicatedText(r.original || text || (audio ? `[Voice recording in ${expectedLang}]` : ""));
          const cleanedEng = cleanDeduplicatedText(String(r.english));
          const cleanedSummary = cleanDeduplicatedText(String(r.summary || catLabel(category)).slice(0, 80));
          const photoPromptNative = String(r.photo_prompt_native || "").trim() || `कृपया इस खतरे (${cleanedSummary}) की एक फोटो खींचकर भेजें।`;
          const photoPromptEn = String(r.photo_prompt_en || "").trim() || `Please take or share a photo of the ${cleanedSummary.toLowerCase()} so the safety team can verify and fix it.`;
          return {
            is_hazard: true,
            status: "hazard",
            original: cleanedOrig,
            language: String(r.language || expectedLang || "Regional"),
            english: cleanedEng,
            summary: cleanedSummary,
            category,
            severity,
            action: String(r.action || "Inspect the location and make it safe."),
            photoPromptNative,
            photoPromptEn,
            duplicate_of: dup,
            photoNote: img && r.photo_note ? String(r.photo_note).slice(0, 140) : "",
            source: "ai"
          };
        }
      }
      aiError = "Gemini's answer was missing the translation.";
    } catch (e) {
      aiError = e.message || String(e);
      console.error("Triage with Gemini failed:", aiError);
    }
  }

  // Fallback: rule-based translation across Indian scripts
  const base = pre && pre.text === text && pre.pre ? { ...pre.pre, source: "sample" } : rulesTriage(text, langName, zone);
  if (!base.is_hazard) {
    return {
      ...base,
      source: "rules",
      aiError
    };
  }

  const dupT = [...tickets.values()].find(t => t.status !== "fixed" && t.zone === zone && t.category === base.category && Date.now() - tCreated(t) < 12 * H);
  const cleanBaseOrig = cleanDeduplicatedText(text || (audio ? `[Voice note in ${expectedLang}] ${base.summary}` : base.summary) || "Voice hazard report");
  const cleanBaseEng = cleanDeduplicatedText(base.english || text || ("Hazard reported at " + zone));
  return {
    is_hazard: true,
    status: "hazard",
    ...base,
    original: cleanBaseOrig,
    duplicate_of: dupT ? dupT.code : null,
    english: cleanBaseEng,
    language: base.language || expectedLang,
    aiError
  };
}

/* ---------- App ---------- */
loadStore();
const app = express();

// AI Studio internal control plane & container readiness probes
app.use((req, res, next) => {
  if (req.path.startsWith("/__aistudio_internal_control_plane") || req.url.startsWith("/__aistudio_internal_control_plane")) {
    return res.status(200).json({ status: "ok", ready: true, state: "ready", healthy: true });
  }
  if (req.path === "/healthz" || req.path === "/health" || req.path === "/_health") {
    return res.status(200).json({ status: "ok" });
  }
  next();
});

app.use(express.json({ limit: "25mb" }));
app.use(express.static(path.join(ROOT, "public"), {
  etag: false,
  maxAge: 0,
  setHeaders: (res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  }
}));

app.get("/api/config", (req, res) => res.json({ ai: !!ai, model: ai ? MODEL : null, keyPrefix: KEY ? KEY.slice(0, 4) : "none" }));

// Construction mega-projects catalog
app.get("/api/sites", (req, res) => {
  const all = [...tickets.values()];
  const enriched = CONSTRUCTION_SITES.map(s => {
    const openHazards = all.filter(t => t.status !== "fixed" && (
      t.siteId === s.id || String(t.site || "").toLowerCase().includes(s.shortName.toLowerCase()) || String(t.site || "").toLowerCase().includes(s.name.toLowerCase())
    )).length;
    const resolvedHazards = all.filter(t => t.status === "fixed" && (
      t.siteId === s.id || String(t.site || "").toLowerCase().includes(s.shortName.toLowerCase()) || String(t.site || "").toLowerCase().includes(s.name.toLowerCase())
    )).length;
    return { ...s, openHazards, resolvedHazards, totalHazards: openHazards + resolvedHazards };
  });
  res.json({ sites: enriched });
});

// Demo site zones catalog for site-wide navigation and shifting
app.get("/api/site-zones", (req, res) => {
  const all = [...tickets.values()];
  const enriched = SITE_ZONES.map(z => {
    const openHazards = all.filter(t => t.status !== "fixed" && (
      t.zone === z.shortName || t.zone === z.name || String(t.zone || "").toLowerCase().includes(z.shortName.toLowerCase())
    )).length;
    const resolvedHazards = all.filter(t => t.status === "fixed" && (
      t.zone === z.shortName || t.zone === z.name || String(t.zone || "").toLowerCase().includes(z.shortName.toLowerCase())
    )).length;
    return { ...z, openHazards, resolvedHazards, totalHazards: openHazards + resolvedHazards };
  });
  res.json({ zones: enriched });
});

app.get("/api/tickets", (req, res) => {
  if (Number(req.query.since) === rev) return res.json({ rev, same: true });
  res.json({ rev, startedAt: STARTED, tickets: [...tickets.values()] });
});

// Deduplication cache for exact retry requests
const recentClientRequests = new Map();

// File a report: triage it with Gemini AI, register genuine hazards on the dashboard
app.post("/api/reports", async (req, res) => {
  const b = req.body || {};
  const text = String(b.text || "").trim();
  const rawZone = String(b.zone || "").trim();
  const matchedZone = ZONES.find(z => z.toLowerCase() === rawZone.toLowerCase()) ||
    SITE_ZONES.find(z => z.id === b.zoneId || z.name.toLowerCase() === rawZone.toLowerCase() || z.shortName.toLowerCase() === rawZone.toLowerCase())?.name ||
    rawZone ||
    ZONES[0];
  const zone = matchedZone;
  const chan = b.chan === "worker" ? "worker" : "supervisor";

  const audio = b.audio && typeof b.audio.data === "string" && b.audio.data.trim().length > 80 ? b.audio : null;
  const photo = typeof b.photo === "string" && b.photo.startsWith("data:image/") ? b.photo : null;

  // Immediate rejection if worker hit record and sent an empty note, silent audio, or no speech
  if ((!text && !audio && !photo) || (!text && b.isSilent)) {
    const lang = b.langName || "Hindi";
    return res.json({
      ok: true,
      kind: "voice_unclear",
      is_hazard: false,
      status: "voice_unclear",
      reason: "voice_not_clear",
      original: "",
      english: "",
      language: lang,
      replyNative: getVoiceUnclearReplyNative(lang),
      replyEn: "Voice was not clear. Please record again clearly or upload a picture of the hazard.",
      zone
    });
  }

  const clientMsgId = String(b.clientMsgId || "");
  const now = Date.now();
  if (clientMsgId && recentClientRequests.has(clientMsgId)) {
    return res.json(recentClientRequests.get(clientMsgId));
  }

  const tri = await triage({ text, audio, zone, chan, photo, pre: b.pre, langName: b.langName });

  // 1. REJECT IF NOT A HAZARD (Unclear voice or Not Applicable message) - DO NOT REGISTER A TICKET!
  if (!tri.is_hazard) {
    const isUnclear = tri.status === "voice_unclear" || tri.status === "empty" || tri.reason === "inaudible" || tri.reason === "voice_not_clear";
    const statusType = isUnclear ? "voice_unclear" : "not_applicable";
    const rejectedPayload = {
      ok: true,
      kind: isUnclear ? "voice_unclear" : "rejected",
      is_hazard: false,
      status: statusType,
      reason: isUnclear ? "voice_not_clear" : (tri.reason || "no_hazard_mentioned"),
      original: tri.original || text || "",
      english: tri.english || "",
      language: tri.language || b.langName || "Regional",
      replyNative: tri.reply_native || (isUnclear ? getVoiceUnclearReplyNative(b.langName) : getNotApplicableReplyNative(b.langName)),
      replyEn: tri.reply_en || (isUnclear ? "Voice was not clear. Please record again clearly or upload a picture of the hazard." : "No safety hazard identified in this message. If there is a hazard or dangerous condition on site, please record what the issue is, or upload a picture."),
      zone
    };
    if (clientMsgId) {
      recentClientRequests.set(clientMsgId, rejectedPayload);
      setTimeout(() => recentClientRequests.delete(clientMsgId), 10000);
    }
    return res.json(rejectedPayload);
  }

  // 2. GENUINE HAZARD: Register ticket for dashboard
  const original = tri.original || text || (audio ? `[Voice recording in ${tri.language || b.langName || "Regional"}]` : "Hazard report");
  const report = { at: now, channel: chan, reporter: b.anonymous ? "" : String(b.reporter || "").slice(0, 60), anonymous: !!b.anonymous,
    language: tri.language || String(b.langName || ""), original, english: tri.english };
  if (photo && photo.length < 500000) { report.photo = photo; if (tri.photoNote) report.photoNote = tri.photoNote; }
  if (typeof b.clip === "string" && b.clip.startsWith("data:audio/") && b.clip.length < 400000) report.clip = b.clip;

  // Check if an existing open ticket in this zone shares this category to link repeat recurrence
  const existingInZoneCat = [...tickets.values()].find(t => t.status !== "fixed" && t.zone === zone && t.category === tri.category);
  const isRecurrence = !!existingInZoneCat;

  const site = String(b.site || "Metro Line 4 - Hinjewadi Station Project");
  const siteId = String(b.siteId || "site-hinjewadi");

  // Every genuine hazard voice note gets its OWN registered ticket so issues appear in the dashboard
  const t = { id: newId(), code: nextCode(), createdAt: now, lastReportAt: now, site, siteId, zone, category: tri.category, severity: tri.severity,
    summary: tri.summary, english: tri.english, original, language: report.language, action: tri.action,
    photoPromptNative: tri.photoPromptNative || "", photoPromptEn: tri.photoPromptEn || "",
    channel: chan, status: "open", aiSource: tri.source, reports: [report], photo: report.photo || null, fixedAt: null, fixPhoto: null, fixNote: "",
    isRepeat: isRecurrence, linkedCode: existingInZoneCat ? existingInZoneCat.code : null };
  t._tri = tri;

  tickets.set(t.id, t);
  saveSoon();

  const responsePayload = {
    kind: "created",
    registered: true,
    message: `Issue registered successfully. Ticket #${t.code} logged on dashboard.`,
    ticket: t,
    tri,
    isRepeat: isRecurrence,
    linkedCode: t.linkedCode
  };
  if (clientMsgId) {
    recentClientRequests.set(clientMsgId, responsePayload);
    setTimeout(() => recentClientRequests.delete(clientMsgId), 10000);
  }

  res.json(responsePayload);
});

// Sync tickets from client storage (ensures tickets survive server restarts and cold starts)
app.post("/api/tickets/sync", (req, res) => {
  const incoming = req.body && Array.isArray(req.body.tickets) ? req.body.tickets : [];
  let added = 0;
  for (const t of incoming) {
    if (t && t.id && !tickets.has(t.id)) {
      tickets.set(t.id, t);
      added++;
    }
  }
  if (added > 0) {
    saveSoon();
  }
  res.json({ ok: true, total: tickets.size, added });
});

// Clear all tickets on the server
app.post("/api/tickets/clear", (req, res) => {
  tickets.clear();
  rev++;
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DATA_FILE, "[]");
  } catch (e) {
    console.error("Couldn't clear tickets file:", e.message);
  }
  res.json({ ok: true, count: 0, tickets: [] });
});
app.delete("/api/tickets", (req, res) => {
  tickets.clear();
  rev++;
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DATA_FILE, "[]");
  } catch (e) {
    console.error("Couldn't clear tickets file:", e.message);
  }
  res.json({ ok: true, count: 0, tickets: [] });
});

// Upload/attach photo evidence to an existing ticket
app.post("/api/tickets/:id/photo", (req, res) => {
  const t = tickets.get(req.params.id) || [...tickets.values()].find(x => x.code === req.params.id);
  if (!t) return res.status(404).json({ error: "That ticket no longer exists." });
  const p = req.body || {};
  if (!p.photo) return res.status(400).json({ error: "No photo provided." });
  t.photo = p.photo;
  if (p.photoNote) t.photoNote = p.photoNote;
  if (!t.reports) t.reports = [];
  if (t.reports.length > 0) {
    t.reports[t.reports.length - 1].photo = p.photo;
    if (p.photoNote) t.reports[t.reports.length - 1].photoNote = p.photoNote;
  }
  rev++;
  saveSoon();
  res.json({ ok: true, ticket: t });
});

// Shift or reassign ticket zone
app.patch("/api/tickets/:id/zone", (req, res) => {
  const t = tickets.get(req.params.id) || [...tickets.values()].find(x => x.code === req.params.id);
  if (!t) return res.status(404).json({ error: "That ticket no longer exists." });
  const { zone, shiftReason } = req.body || {};
  if (!zone) return res.status(400).json({ error: "No target site zone specified." });
  const oldZone = t.zone;
  t.zone = zone;
  if (!t.zoneHistory) t.zoneHistory = [];
  t.zoneHistory.push({
    from: oldZone,
    to: zone,
    at: Date.now(),
    reason: shiftReason || "Reassigned by Site Safety Officer"
  });
  rev++;
  saveSoon();
  res.json({ ok: true, ticket: t, oldZone, newZone: zone });
});

// Close, reopen or annotate a ticket.
const PATCHABLE = ["status", "fixedAt", "fixPhoto", "fixNote", "fixCheck", "callbacks", "photo", "photoNote", "zone", "zoneHistory", "site", "siteId"];
app.patch("/api/tickets/:id", (req, res) => {
  const t = tickets.get(req.params.id) || [...tickets.values()].find(x => x.code === req.params.id);
  if (!t) return res.status(404).json({ error: "That ticket no longer exists." });
  const p = req.body || {};
  if (typeof p.fixPhoto === "string" && p.fixPhoto.length > 600000) return res.status(413).json({ error: "That photo is too large to store. Try another." });
  for (const k of PATCHABLE) if (k in p) t[k] = p[k];
  saveSoon();
  res.json({ ticket: t });
});

// Before closing: Gemini checks the fix photo and writes the callback in each reporter's language.
app.post("/api/tickets/:id/check-fix", async (req, res) => {
  const t = tickets.get(req.params.id);
  if (!t) return res.status(404).json({ error: "That ticket no longer exists." });
  if (!ai) return res.json({ check: null, callbacks: null, ai: false });
  const { note = "", photo = "" } = req.body || {};
  const langs = [...new Set((t.reports || []).map(r => r.language).filter(Boolean))].slice(0, 5);
  if (!langs.length) langs.push("English");
  const after = dataUrlPart(photo);
  const before = (t.reports || []).map(r => dataUrlPart(r.photo)).find(Boolean);
  const parts = after ? (before ? [before, after] : [after]) : [];
  const photos = !after ? "" : before
    ? "Two photos are attached: first the photo of the hazard that a reporter sent, then the engineer's photo of the fix."
    : "One photo is attached: the engineer's photo of the fix.";
  const prompt = `You are the closing step of SurakshaVaani, a construction-site hazard log in India. The safety engineer wants to close ticket ${t.code}.
Hazard: ${t.summary}. ${t.english}
Zone: ${t.zone}. Action that was asked for: ${t.action || "make it safe"}
Engineer's note on what was done: ${String(note || "(none)").slice(0, 300)}
${photos}
${after ? `
1. Decide whether the fix photo shows that this hazard has been made safe. verdict "fixed" if it clearly does; "unclear" if the photo is too dark, blurred or far away to tell; "not_fixed" if it shows the hazard still there, or shows something unrelated to this hazard. reason: one plain sentence for the engineer, at most 25 words, saying what you can see.
2.` : "1."} Write a short spoken callback message for the people who reported it, in each of these languages: ${langs.join(", ")}. Use each language's own script (Hinglish in Latin script). Say the ticket code ${t.code}, what was fixed and where, and thank them for speaking up. At most 30 words each, warm and plain, as a phone line would say it.

Reply with only one JSON object: {${after ? `"verdict": "fixed|unclear|not_fixed", "reason": "...", ` : ""}"callbacks": {"<language name exactly as listed>": "message"}}`;
  try {
    const r = await gemJSON(prompt, parts);
    const got = r && typeof r.callbacks === "object" && r.callbacks ? r.callbacks : {};
    const callbacks = {};
    for (const l of langs) {
      const k = Object.keys(got).find(x => x.toLowerCase() === l.toLowerCase());
      if (k && typeof got[k] === "string" && got[k].trim()) callbacks[l] = got[k].trim().slice(0, 400);
    }
    const check = after && ["fixed", "unclear", "not_fixed"].includes(r.verdict) ? { verdict: r.verdict, reason: String(r.reason || "").slice(0, 240), at: Date.now() } : null;
    res.json({ check, callbacks: Object.keys(callbacks).length ? callbacks : null, ai: true });
  } catch (e) {
    console.error("Fix check with Gemini failed:", e.message || e);
    res.status(502).json({ error: "Couldn't reach Gemini, so the ticket closed without the photo check." });
  }
});

// Morning toolbox talk, streamed as Gemini writes it.
app.post("/api/talk", async (req, res) => {
  if (!ai) return res.status(503).json({ error: "The toolbox talk needs Gemini, which is not connected." });
  const lang = String((req.body || {}).lang || "Hindi").slice(0, 30);
  const now = Number((req.body || {}).now) || Date.now();
  const all = [...tickets.values()];
  const open = all.filter(t => t.status !== "fixed").sort((a, b) => SEVRANK[b.severity] - SEVRANK[a.severity]).slice(0, 8)
    .map(t => ({ hazard: t.summary, zone: t.zone, severity: t.severity, hours_open: Math.round((now - tCreated(t)) / H), reports: (t.reports || []).length, action: t.action }));
  const grid = {};
  for (const t of all) { const k = t.zone + " | " + catLabel(t.category); grid[k] = (grid[k] || 0) + 1; }
  const repeats = Object.entries(grid).filter(([, n]) => n >= 2).map(([k, n]) => ({ where_and_type: k, tickets: n }));
  const fixed = all.filter(t => t.status === "fixed").sort((a, b) => (b.fixedAt || 0) - (a.fixedAt || 0)).slice(0, 4)
    .map(t => ({ hazard: t.summary, zone: t.zone, fix: t.fixNote || "" }));
  const prompt = `You write the morning toolbox talk for a construction site in India. The safety officer reads it out to the workers at the 8 am briefing.
Write it in ${lang}${lang === "English" ? "" : ", in that language's own script"}, in simple spoken words that a worker with little schooling understands. About 150 to 200 words, under two minutes aloud. Plain text only: no headings, no bullet symbols, no markdown, short paragraphs.
Cover, in this order: greet the crew; the one or two most dangerous open hazards, exactly where they are and what to do or avoid today; one hazard that keeps coming back and the habit that prevents it; thank the people who reported hazards (no names) and give one example of something that was fixed; end by reminding them anyone can report a hazard by a missed call to the site line or a voice note to their supervisor, and that workers can stay anonymous.
Use only facts from the log below. Do not invent numbers or places.

OPEN HAZARDS: ${JSON.stringify(open)}
HAZARDS THAT KEEP COMING BACK: ${JSON.stringify(repeats)}
RECENTLY FIXED: ${JSON.stringify(fixed)}`;
  try {
    const stream = await ai.models.generateContentStream({ model: MODEL, contents: [{ role: "user", parts: [{ text: prompt }] }], config: { temperature: 0.6 } });
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    for await (const chunk of stream) { if (chunk.text) res.write(chunk.text); }
    res.end();
  } catch (e) {
    console.error("Toolbox talk with Gemini failed:", e.message || e);
    if (!res.headersSent) res.status(502).json({ error: "Couldn't write the talk. Try again." });
    else res.end();
  }
});

// Remove tickets filed during a demo; the example tickets stay.
app.delete("/api/demo-reports", (req, res) => {
  let n = 0;
  for (const [id, t] of tickets) if (!t.seeded) { tickets.delete(id); n++; }
  if (n) saveSoon();
  res.json({ deleted: n });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`SurakshaVaani is running at http://0.0.0.0:${PORT}`);
  console.log(ai ? `Gemini connected (model ${MODEL}).` : "No GEMINI_API_KEY set: running with keyword rules instead of Gemini.");
});
