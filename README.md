# IGNIS FireIntel Dashboard

## Overview

IGNIS is an AI‑powered microgravity fire research and safety intelligence dashboard.  The UI allows researchers to explore experiments, filter by program, view detailed dossiers, and interact with an AI Research Assistant that answers questions using the Google AI Studio (Gemini) model and the data in **`investigations.json`**.

## Quick Start (Local Development)

1. **Clone the repository** (if you haven’t already)
   ```
   git clone https://github.com/Ahmedbracu/IGNIS_FIREINTEL.git
   cd IGNIS_FIREINTEL
   ```

2. **Install dependencies** (the project uses only the default React/Vite dependencies – no extra packages were added)
   ```
   npm install
   ```

3. **Set the Gemini API key**
   - Create a file named `.env.local` in the project root (it will be ignored by Git).
   - Add the following line, replacing `<YOUR_GEMINI_KEY>` with the key you created in Google AI Studio:
     ```
     VITE_IGNIS=<YOUR_GEMINI_KEY>
     ```
   - The backend reads the same variable via Vercel’s environment configuration (see step 5).

4. **Run the development server**
   ```
   npm run dev
   ```
   The app will be available at `http://localhost:5173`.  You can:
   - Open the site and try a greeting (`hi`, `hello`).
   - Ask a research‑oriented question, e.g. *“How does airflow affect flame spread rate?”*.
   - Verify that citations appear as `[ID]` links that open the corresponding experiment entry.

## Deploying to Vercel

1. **Push the changes to GitHub** (the Vercel project is linked to this repo)
   ```
   git add .
   git commit -m "IGNIS full‑stack fix"
   git push origin main
   ```
   Vercel will automatically start a new deployment.

2. **Configure Vercel environment variables**
   - In the Vercel dashboard → *Project Settings → Environment Variables* add:
     - **Key:** `IGNIS`
       **Value:** your Gemini API key.
     - (Optional) **Key:** `GEMINI_MODEL`
       **Value:** the Gemini model you wish to use (e.g. `gemini-1.5-pro`).
   - Set the scope to *Production* (and *Preview* if you test preview branches).

3. **Verify the deployment**
   - **Health endpoint**: `https://<your‑project>.vercel.app/api/health`
     - Should return JSON similar to:
       ```json
       {"embeddings_json_records":23,"investigations_json_records":23,"env_IGNIS_set":true}
       ```
   - **UI test**: Open the main URL, greet the assistant, and ask a data‑driven query.
   - **Citation check**: Answers should include source IDs like `[exp‑12]` that, when clicked, open the experiment details.

## Important Files Updated

| File | Purpose |
|------|---------|
| `vercel.json` | Rewrites all non‑API routes to `index.html` and configures the API function. |
| `api/chat.js` | Handles POST `/api/chat`, loads both embeddings and the full `investigations.json`, builds a system prompt, keeps a short conversation history, performs vector/keyword retrieval, and returns answer + citations. |
| `index.html` (React entry) | Loads the full dataset, maps program codes to UI names (`PROG_MAP`), expands filter pills, improves `DossierCard` rendering, replaces the old static AI note with a live chat component (`AiCopilotCard`). |
| `README.md` (this file) | Deployment and development instructions. |

## Testing Tips

- **Conversation history**: The backend keeps the last six user/assistant messages.  To test context, ask a follow‑up question that depends on the previous answer.
- **Offline fallback**: Temporarily remove the `IGNIS` env var or exhaust the Gemini quota; the API will return a friendly fallback message explaining that the AI service is unavailable.
- **Numeric chart data**: Only experiments with both `airflow_cms` and `flame_spread_rate_mms` are plotted.  Missing values are safely ignored.
- **Filter pills**: All programs (`Saffire, BASS, FLEX, SoFIE, ACME, Smoke, Modeling`) are now selectable.

## Future Enhancements (Optional)

- Persist chat history in `localStorage` so a user can refresh the page without losing context.
- Add a toggle to view raw JSON for power users.
- Introduce a lightweight vector store (e.g., `langchain` + `faiss`) for faster similarity search if the dataset grows.
- Implement server‑side caching of embeddings to reduce latency.

---

If you encounter any errors during deployment or have additional feature requests, let me know and I’ll help you adjust the code.
