# SurakshaVaani (Gemini version)

Construction-site hazard reporting by voice in Indian languages. A supervisor or worker records a voice note. Gemini writes down what they said, translates it to English, names the hazard, rates how serious it is, and joins duplicate reports into one ticket. A ticket closes only with a photo of the fix. Gemini checks that photo, then writes the "it's fixed" callback in each reporter's own language.

## What's in the folder

| File | What it is |
| --- | --- |
| `public/index.html` | The app people see: the report screens, hazard log, patterns and toolbox talk |
| `server.js` | The small server: keeps the hazard log and makes every Gemini call, so your API key never reaches the browser |
| `seed-tickets.json` | The 9 example tickets the log starts with |
| `metadata.json` | Tells Google AI Studio the app needs the microphone and camera |
| `package.json` | The two libraries the server needs: `@google/genai` and `express` |

## Option A: put it in Google AI Studio

AI Studio imports existing code from GitHub, so the folder goes to GitHub first.

1. Sign in at https://github.com (a free account is fine). Click **New** to create a repository named `surakshavaani`. Keep it **Private** and click **Create repository**.
2. On the new repository's page, click **uploading an existing file**. Drag in everything from this folder **except `node_modules`**: `public`, `server.js`, `package.json`, `package-lock.json`, `metadata.json`, `seed-tickets.json`, `README.md`. Click **Commit changes**. (Or unzip `surakshavaani-gemini.zip` and drag in its contents.)
3. Open https://aistudio.google.com and go to **Build**. In the prompt box, click the **+** (Add files) button, then **Import from GitHub**. Connect your GitHub account and choose `surakshavaani`.
4. AI Studio sets up your Gemini key on the server by itself. If its assistant offers to change the code, say: *"Keep server.js and public/index.html as they are. Run it with npm start."*
5. Press the app preview. The status at the top should say **Gemini on**. Allow the microphone when you first press **Record voice note**.

To share it: **Deploy** gives a public link (Google Cloud Run). Every Gemini call from anyone using that link counts against your API key, and AI Studio warns you about costs before sharing.

## Option B: run it on your laptop

1. Install Node.js (version 20 or newer) from https://nodejs.org.
2. Get a Gemini API key at https://aistudio.google.com/apikey.
3. Open a terminal in this folder and run:

```bash
npm install
```

Then start it with your key (PowerShell):

```powershell
$env:GEMINI_API_KEY="paste-your-key-here"; npm start
```

4. Open http://localhost:3000 in Chrome.

On the same laptop, recording works. Other phones on your Wi-Fi can open `http://<your-laptop-ip>:3000` and file typed reports, but browsers only allow the microphone on secure (https) links, so phones need Option A's link to record.

## Good to know

- **Without a key**, the app still runs. Keyword rules rate typed reports and the sample notes have ready-made translations, but recording, the photo check, the callbacks and the toolbox talk need Gemini.
- **Model:** it uses `gemini-3.6-flash`. To use another model, set `GEMINI_MODEL` (for example `gemini-3.8-flash`).
- **Where the log is kept:** in `data/tickets.json` on the server. On AI Studio or Cloud Run that file can be wiped when the app restarts. For a permanent log, ask AI Studio's assistant: *"Store the tickets in Firestore instead of data/tickets.json. Only change the store functions at the top of server.js."*
- **Resetting a demo:** in the hazard log, **Clear reports filed in the demo** removes everything except the 9 examples. Deleting `data/tickets.json` and restarting does the same.
- Voice notes are capped at 30 seconds. The browser converts each recording to a WAV file, which Gemini reads reliably, before sending it.
