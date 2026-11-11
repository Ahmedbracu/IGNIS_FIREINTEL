// Open  https://YOUR-SITE.vercel.app/api/health  to see what is missing. Never prints secrets.
const fs = require('fs'), path = require('path');
try { require('../embeddings.json'); } catch (e) {} try { require('../investigations.json'); } catch (e) {}
const count = f => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, '..', f), 'utf8')).length; } catch (e) { return 'MISSING'; } };
module.exports = (req, res) => res.json({
  ok: true, node: process.version,
  embeddings_json_records: count('embeddings.json'), investigations_json_records: count('investigations.json'),
  env_IGNIS_set: !!process.env.IGNIS, model: process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite (default)' });
