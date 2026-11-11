// Vercel function  POST /api/chat  { question, history? } -> { answer, sources }
// Needs (in the project ROOT, one level above this file): embeddings.json, investigations.json
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const load = f => { try { return JSON.parse(fs.readFileSync(path.join(root, f), 'utf8')); } catch (e) { return null; } };
try { require('../embeddings.json'); } catch (e) {} try { require('../investigations.json'); } catch (e) {} // lets Vercel bundle both files

const KEY = process.env.IGNIS;                                            // Gemini key (Vercel env variable)
const TEXT_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
const EMBED_MODEL = 'gemini-embedding-001', DIM = 768, K = 5;
const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const cache = new Map();

// ---------- Data Loading ----------
// records: use embeddings.json when present; otherwise fall back to investigations.json (keyword search only)
let records = load('embeddings.json');
const hasVectors = Array.isArray(records) && records.length > 0;
if (!hasVectors) records = (load('investigations.json') || []).map(r => ({ id: r.id, doc: JSON.stringify(r) }));

// Also load the full investigations.json for structured data the AI can reference
const investigations = load('investigations.json') || [];

// Build a compact data summary the AI always sees (key stats, all experiment IDs, programs)
function buildDataSummary() {
  const programs = [...new Set(investigations.map(i => i.prog).filter(Boolean))];
  const ids = investigations.map(i => i.id);
  const withData = investigations.filter(i => i.o2 != null || i.flow != null);
  const allTags = [...new Set(investigations.flatMap(i => i.tags || []))];

  return `DATABASE SUMMARY (${investigations.length} investigations):
Programs: ${programs.join(', ')}
All IDs: ${ids.join(', ')}
Investigations with numeric test data: ${withData.map(i => i.id).join(', ')}
Research tags: ${allTags.join(', ')}
Fuel states covered: solid, liquid, gas
Environments: spacecraft, lunar_base
Key conditions measured: O2%, pressure (kPa), airflow (cm/s), flame length (cm), spread rate`;
}

const DATA_SUMMARY = buildDataSummary();

// ---------- System Prompt ----------
const SYSTEM = `You are IGNIS, an AI-powered NASA microgravity fire research and safety intelligence assistant, built by team Off_Script for the NASA App Development Challenge.
You assist researchers exploring spacecraft fire safety data from the NASA Physical Sciences Informatics (PSI) database and related published papers.

ABOUT THIS WEB APPLICATION:
- This is the IGNIS FireIntel Dashboard — an AI-powered microgravity fire research and safety intelligence hub.
- It features a Research Explorer where users can search and filter experiments by program, conditions, fuel type, etc.
- Each experiment has a detailed profile (dossier) with conditions, findings, sensors, data gaps, and source links.
- The Combustion Propagation Matrix chart visualizes airflow vs. flame length for experiments that have numeric data.
- You are the AI Research Assistant built into the dashboard — you answer questions using the real experiment data.
- The dashboard currently holds data from ${investigations.length} investigations spanning programs like Saffire, BASS (MSG), FLEX (MDCA), SoFIE, ACME, Smoke, and Modeling studies.

PERSONALITY AND BEHAVIOR:
- Be warm, professional, and conversational. Greet users naturally. Use their name if they share it.
- For greetings like "hi", "hello", "hey", respond warmly and briefly describe what you can help with.
- For casual conversation (how are you, what can you do, who made you, what is this web about), respond naturally and then guide them toward the research data.
- You were created by team Off_Script for the NASA App Development Challenge.
- Always maintain scientific accuracy. Never invent data, numbers, or findings.

WHEN ANSWERING RESEARCH QUESTIONS:
- Draw on the RECORDS provided below to give evidence-based answers.
- Cite every investigation you use with square brackets: [SAFFIRE-IV] [FLEX-2]. One ID per bracket.
- Include specific numbers when available: O2 percentages, airflow speeds (cm/s), flame lengths (cm), pressures (kPa).
- Mention key_findings, test results, sensors used, and data_gaps when relevant.
- When comparing experiments, highlight differences in conditions and outcomes.
- If records don't cover a topic, say so honestly. Begin with 'NO_DATA:' and explain what's missing.
- If a record notes data_gaps or says details are "to be taken from PSI", mention that limitation.

FORMATTING:
- Plain text only. No LaTeX, no markdown headings, no bullet-point lists with asterisks.
- Write units naturally: O2, cm/s, mm/s, kPa, kW, W.
- Keep answers focused but thorough. A few sentences for simple questions, more for complex analysis.

${DATA_SUMMARY}`;

// ---------- Retrieval ----------
const tok = s => String(s).toLowerCase().match(/[a-z0-9\-]+/g) || [];
const docs = records.map(r => tok(r.doc));
const avg = docs.reduce((a, d) => a + d.length, 0) / Math.max(1, docs.length);

function keywordHits(q) {
  const qt = tok(q);
  const top = records.map((r, i) => {
    let s = 0;
    for (const t of qt) {
      const tf = docs[i].filter(x => x === t).length; if (!tf) continue;
      const df = docs.filter(d => d.includes(t)).length;
      s += Math.log(1 + (docs.length - df + .5) / (df + .5)) * (tf * 2.2) / (tf + 1.2 * (.25 + .75 * docs[i].length / avg));
    }
    return { r, s };
  }).filter(x => x.s > 0).sort((a, b) => b.s - a.s).slice(0, K).map(x => x.r);
  return top.length ? top : records.slice(0, K);
}

const post = async (url, body) => {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 160)}`);
  return r.json();
};

const cos = (a, b) => { let d = 0, x = 0, y = 0; for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; x += a[i] * a[i]; y += b[i] * b[i]; } return d / Math.sqrt(x * y); };

async function retrieve(q) {
  if (hasVectors) {
    try {
      const e = await post(`${BASE}/${EMBED_MODEL}:embedContent`, { model: `models/${EMBED_MODEL}`, content: { parts: [{ text: q }] }, taskType: 'RETRIEVAL_QUERY', outputDimensionality: DIM });
      return records.map(r => ({ r, s: cos(e.embedding.values, r.embedding) })).sort((a, b) => b.s - a.s).slice(0, K).map(x => x.r);
    } catch (err) { console.error('embedding failed, using keyword search:', err.message); }
  }
  return keywordHits(q);
}

// ---------- Detect if the question is conversational vs research ----------
function isConversational(q) {
  const lower = q.toLowerCase().trim();
  const greetings = ['hi', 'hello', 'hey', 'howdy', 'good morning', 'good evening', 'good afternoon',
    'sup', 'what\'s up', 'yo', 'hola', 'greetings', 'namaste', 'assalamu alaikum', 'salam'];
  const meta = ['who are you', 'what are you', 'what can you do', 'help me', 'how are you',
    'who made you', 'who built you', 'who created you', 'what is ignis', 'what\'s ignis',
    'tell me about yourself', 'introduce yourself', 'your name', 'thank', 'thanks', 'bye',
    'goodbye', 'see you', 'great job', 'awesome', 'nice', 'cool', 'ok', 'okay',
    'what is this', 'what\'s this', 'what does this do', 'what is this web', 'what\'s this web',
    'what is this website', 'what is this app', 'what is this about', 'how can you help',
    'what can you help', 'what do you know', 'are you ai', 'are you a bot', 'are you real'];
  if (greetings.some(g => lower === g || lower === g + '!' || lower === g + '.')) return true;
  if (meta.some(m => lower.includes(m))) return true;
  // Very short queries with no technical terms
  if (lower.split(/\s+/).length <= 3 && !lower.match(/flame|fire|o2|oxygen|airflow|pmma|sibal|saffire|bass|flex|sofie|acme|spread|burn|ignit|extinct|smoke|fuel|microgravity|combustion|material|droplet|cool\s*flame/)) return true;
  return false;
}

// ---------- Handler ----------
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'use POST' });
  if (!KEY) return res.status(500).json({ error: 'missing_key', hint: 'add Vercel env variable IGNIS and redeploy' });

  let body = req.body; if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const question = String((body && body.question) || '').slice(0, 500);
  const history = Array.isArray(body?.history) ? body.history.slice(-6) : []; // last 6 turns for context
  if (!question) return res.status(400).json({ error: 'no question' });

  // Cache check (only for research questions, not conversational)
  const ck = question.toLowerCase();
  if (!isConversational(question) && cache.has(ck)) return res.json(cache.get(ck));

  try {
    // Build conversation contents
    const contents = [];

    // Add conversation history for context
    for (const turn of history) {
      if (turn.role === 'user' && turn.text) {
        contents.push({ role: 'user', parts: [{ text: turn.text }] });
      } else if (turn.role === 'assistant' && turn.text) {
        contents.push({ role: 'model', parts: [{ text: turn.text }] });
      }
    }

    if (isConversational(question)) {
      // For greetings/meta questions: no retrieval needed, just chat
      contents.push({ role: 'user', parts: [{ text: question }] });
    } else {
      // For research questions: retrieve relevant records
      const hits = await retrieve(question);
      const recordsText = hits.map(h => h.doc).join('\n\n---\n\n');
      contents.push({ role: 'user', parts: [{ text: `RECORDS:\n${recordsText}\n\nQUESTION: ${question}` }] });
    }

    const g = await post(`${BASE}/${TEXT_MODEL}:generateContent`, {
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents,
      generationConfig: { temperature: isConversational(question) ? 0.7 : 0.1 }
    });

    const answer = (g.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('').trim();

    // Extract cited IDs from the answer
    const citedIds = [...new Set((answer.match(/\[([A-Z0-9\-]+)\]/g) || []).map(m => m.slice(1, -1)))];
    // Include retrieved source IDs too
    let sourceIds = citedIds;
    if (!isConversational(question)) {
      const hits = await retrieve(question);
      const retrievedIds = hits.map(h => h.id);
      sourceIds = [...new Set([...citedIds, ...retrievedIds])];
    }

    const out = { answer, sources: sourceIds };
    if (answer && !isConversational(question)) cache.set(ck, out);
    res.json(out);
  } catch (err) {
    console.error(err.message);
    const status = parseInt(err.message, 10) || 500;
    res.status(status === 429 ? 429 : 500).json({ error: 'llm_failed', status });
  }
};
