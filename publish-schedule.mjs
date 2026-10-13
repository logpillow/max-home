import { readFile, writeFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY repository secrets.');
}

const db = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
});
const { data: rows, error } = await db
  .from('visits')
  .select('id,name,start_date,end_date,arrival_period,departure_period,status')
  .order('start_date', { ascending: true });
if (error) throw new Error(`Supabase request failed: ${error.message}`);
if (!Array.isArray(rows)) throw new Error('Supabase returned an unexpected response.');

// Keep the public snapshot limited to fields used by the public calendar.
const visits = rows.map(v => ({
  id: v.id,
  name: v.name,
  start_date: v.start_date,
  end_date: v.end_date,
  arrival_period: v.arrival_period,
  departure_period: v.departure_period,
  status: v.status
}));

const path = 'visits.json';
let previous = null;
try { previous = JSON.parse(await readFile(path, 'utf8')); } catch {}
const stable = value => JSON.stringify(value);
const changed = !previous || !Array.isArray(previous.visits) || stable(previous.visits) !== stable(visits);
const now = new Date().toISOString();
const snapshot = {
  lastUpdated: changed || !previous?.lastUpdated ? now : previous.lastUpdated,
  lastCheckedAt: now,
  visits
};
await writeFile(path, JSON.stringify(snapshot, null, 2) + '\n', 'utf8');
console.log(changed
  ? `Published ${visits.length} visit(s); schedule data changed.`
  : `Checked Supabase successfully; no schedule changes (${visits.length} visit(s)).`);
