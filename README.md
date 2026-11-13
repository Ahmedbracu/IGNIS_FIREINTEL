# IGNIS FireIntel Dashboard — Microgravity Fire Safety & Combustion Intelligence 

## Overview

IGNIS is an AI‑powered microgravity fire research and safety intelligence dashboard.  The UI allows researchers to explore experiments, filter by program, view detailed dossiers, and interact with an AI Research Assistant that answers questions using the Google AI Studio (Gemini) model and the data in **`investigations.json`**.

**Live App:** [ignis-woad-chi.vercel.app](https://ignis-woad-chi.vercel.app/)

IGNIS is a research dashboard and RAG-based Q&A assistant built around NASA's microgravity combustion experiments. Instead of digging through scattered technical reports to compare oxygen concentrations, airflow velocities, or flame spread rates, you can filter experiments by program, inspect sensor setups, and ask questions directly against the dataset. 

The assistant is strictly grounded in `investigations.json`—it cites exact experiment IDs and explicitly refuses to answer when asked about things outside the dataset (like Martian partial gravity or rocket propellants) rather than making up numbers.

## Data Sources

All experimental records, fuel configurations, and extinction limits in `investigations.json` were compiled from eight investigations in the **NASA Physical Sciences Informatics (PSI)** repository:

* **[PSI-98](https://psi.nasa.gov/physci/repo/data/investigations/PSI-98)** — Spacecraft Fire Safety Experiment-I (Saffire-I)
* **[PSI-99](https://psi.nasa.gov/physci/repo/data/investigations/PSI-99)** — Spacecraft Fire Experiment-II (Saffire-II)
* **[PSI-100](https://psi.nasa.gov/physci/repo/data/investigations/PSI-100)** — Spacecraft Fire Experiment-III (Saffire-III)
* **[PSI-25](https://psi.nasa.gov/physci/repo/data/investigations/PSI-25)** — Burning and Suppression of Solids-II (BASS-II)
* **[PSI-26](https://psi.nasa.gov/physci/repo/data/investigations/PSI-26)** — Burning and Suppression of Solids (BASS)
* **[PSI-68](https://psi.nasa.gov/physci/repo/data/investigations/PSI-68)** — Flame Extinction Experiment-2 (FLEX-2)
* **[PSI-69](https://psi.nasa.gov/physci/repo/data/investigations/PSI-69)** — Flame Extinction Experiment (FLEX)
* **[PSI-101](https://psi.nasa.gov/physci/repo/data/investigations/PSI-101)** — Smoke Aerosol Measurement Experiment-Reflight (SAME-R)

## How It's Built

* **Frontend:** React UI for browsing dossiers, filtering by program (`Saffire`, `BASS`, `FLEX`, `SAME`), and plotting airflow vs. flame spread rates.
* **Backend & Retrieval:** Serverless API routes on Vercel (`api/chat.js`) that load pre-computed vector embeddings (`embeddings.json`), run cosine similarity search against user queries, and pass the top matching records to the Gemini API.
* **AI & Development Workflow:** Powered by Google's Gemini API for embeddings and grounded synthesis. I also used Claude during development to break down the microgravity combustion concepts and plan the overall RAG and full-stack architecture.

## Project Structure

* `index.html` — Main React frontend, program filters, `DossierCard` views, and the chat interface (`AiCopilotCard`).
* `api/chat.js` — Handles `POST /api/chat`, performs vector retrieval over `embeddings.json`, maintains a 6-message conversation window, and returns cited answers.
* `api/health.js` — Health check endpoint (`/api/health`) to verify that the JSON records, embeddings, and environment variables are loaded properly.
* `investigations.json` & `embeddings.json` — The structured PSI experiment dataset and its corresponding vector embeddings.
* `vercel.json` — Handles API routing and SPA rewrites for Vercel deployment.
