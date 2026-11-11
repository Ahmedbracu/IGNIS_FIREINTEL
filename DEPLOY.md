# IGNIS: deploy checklist

## The folder must look EXACTLY like this (repo root = this folder)
```
index.html
investigations.json
embeddings.json        <- exactly this name (not embeddings_1.json, not embeddings (1).json)
package.json
vercel.json
api/
  chat.js              <- must be INSIDE a folder called api
  health.js
```
Delete everything else from the repo (old chat.js at the top level, chat_claude.js, server_claude-local.js, FRAMEWORK.md, draft json, old embeddings files).

## Vercel settings
- Framework preset: **Other**. Build command: empty. Output directory: empty.
- Settings -> Environment Variables: name `IGNIS` = your Gemini key (all environments). Redeploy after adding it.
- Optional: `GEMINI_MODEL` = a model that has quota in your AI Studio rate-limit page.

## Check it worked
1. Open `/api/health` -> should show embeddings_json_records: 23, investigations_json_records: 23, env_IGNIS_set: true.
2. Open the site -> Ask AI -> ask a question.

## If something fails
| Symptom | Cause |
|---|---|
| `/api/health` is a 404 page | `api` folder is missing or files were uploaded flat |
| embeddings_json_records: "MISSING" | file is not named `embeddings.json` or is not in the root |
| env_IGNIS_set: false | variable not added, or you did not redeploy |
| Chat says "AI is busy" | Gemini free quota used up (answers still show instant matches) |
