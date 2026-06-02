import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabase.js";

// ─── Categories ───────────────────────────────────────────────────────────────
const CATEGORIES = [
  { id: "fastest_5k",      label: "Fastest 5K",           unit: "min",  icon: "⚡", lowerIsBetter: true,  placeholder: "e.g. 22:45",   hint: "Format: MM:SS" },
  { id: "fastest_10k",     label: "Fastest 10K",          unit: "min",  icon: "🔥", lowerIsBetter: true,  placeholder: "e.g. 48:30",   hint: "Format: MM:SS" },
  { id: "fastest_half",    label: "Fastest Half Marathon", unit: "min",  icon: "🎯", lowerIsBetter: true,  placeholder: "e.g. 1:52:00", hint: "Format: H:MM:SS" },
  { id: "fastest_marathon",label: "Fastest Marathon",     unit: "min",  icon: "👑", lowerIsBetter: true,  placeholder: "e.g. 3:45:00", hint: "Format: H:MM:SS" },
  { id: "longest_week",    label: "Longest Week",         unit: "km",   icon: "📏", lowerIsBetter: false, placeholder: "e.g. 67.5",    hint: "Total km in one week" },
  { id: "longest_run",     label: "Longest Single Run",   unit: "km",   icon: "🏃", lowerIsBetter: false, placeholder: "e.g. 32.1",    hint: "Distance in km" },
  { id: "streak",          label: "Longest Streak",       unit: "days", icon: "🔆", lowerIsBetter: false, placeholder: "e.g. 21",      hint: "Consecutive days running" },
  { id: "monthly_km",      label: "Monthly KM",           unit: "km",   icon: "📅", lowerIsBetter: false, placeholder: "e.g. 210",     hint: "Total km in one month" },
];

// ─── Monthly challenge schedule (rotates automatically) ───────────────────────
const CHALLENGE_SCHEDULE = [
  { month: 0,  catId: "monthly_km",      title: "New Year KM Blitz",      blurb: "Kick off the year. Most km wins." },
  { month: 1,  catId: "streak",          title: "February Streak",         blurb: "Run every day. Who lasts longest?" },
  { month: 2,  catId: "longest_run",     title: "Spring Distance",         blurb: "Log your longest single run this month." },
  { month: 3,  catId: "fastest_5k",      title: "April Speed Test",        blurb: "Fastest 5K of the month takes the crown." },
  { month: 4,  catId: "monthly_km",      title: "May Mileage",             blurb: "Rack up the km. Every run counts." },
  { month: 5,  catId: "fastest_10k",     title: "June 10K Challenge",      blurb: "Post your fastest 10K this month." },
  { month: 6,  catId: "longest_week",    title: "Summer Big Week",         blurb: "Who can run the most in a single week?" },
  { month: 7,  catId: "streak",          title: "August Daily Grind",      blurb: "Consistency wins. Longest streak takes it." },
  { month: 8,  catId: "fastest_half",    title: "September Half Attack",   blurb: "Best half marathon time wins." },
  { month: 9,  catId: "monthly_km",      title: "October Volume",          blurb: "Autumn air, maximum km." },
  { month: 10, catId: "fastest_5k",      title: "November PB Hunt",        blurb: "Chase a personal best 5K." },
  { month: 11, catId: "longest_run",     title: "December Epic Run",       blurb: "End the year with your longest adventure." },
];

const AVATARS = ["🏃","🦅","🐆","🦁","🐺","🦊","🦋","🐉","🦄","🌪️","⚡","🔥","🎽","👟","🥾","🌄"];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function parseTime(str) {
  if (!str) return null;
  const parts = str.trim().split(":").map(Number);
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return parseFloat(str) * 60;
}

function formatDisplay(val, cat) {
  if (cat.lowerIsBetter) {
    const s = Math.round(Number(val));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
    return `${m}:${String(sec).padStart(2,"0")}`;
  }
  return `${parseFloat(val).toFixed(1)}`;
}

function toStoredValue(raw, cat) {
  return cat.lowerIsBetter ? parseTime(raw) : parseFloat(raw);
}

function getRank(i) {
  if (i === 0) return { emoji: "🥇", cls: "gold" };
  if (i === 1) return { emoji: "🥈", cls: "silver" };
  if (i === 2) return { emoji: "🥉", cls: "bronze" };
  return { emoji: null, cls: "rest" };
}

function getBarWidth(val, allVals, cat) {
  if (allVals.length < 2) return 85;
  const max = Math.max(...allVals), min = Math.min(...allVals);
  if (max === min) return 85;
  if (cat.lowerIsBetter) return 90 - ((val - min) / (max - min)) * 55;
  return 35 + ((val - min) / (max - min)) * 55;
}

function getDaysLeft() {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return end.getDate() - now.getDate();
}

function getMonthName(offset = 0) {
  return new Date(new Date().getFullYear(), new Date().getMonth() + offset, 1)
    .toLocaleString("default", { month: "long" });
}

function getCurrentChallenge() {
  const m = new Date().getMonth();
  return CHALLENGE_SCHEDULE[m];
}

function getPrevChallenge() {
  const m = (new Date().getMonth() + 11) % 12;
  return CHALLENGE_SCHEDULE[m];
}

// ─── CSS ──────────────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:ital,wght@0,300;0,400;0,500;1,300&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body, #root { min-height: 100vh; }
  body { background: #080810; color: #ede9e0; font-family: 'DM Mono', monospace; }

  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-track { background: #0d0d18; }
  ::-webkit-scrollbar-thumb { background: #2a2a3e; border-radius: 2px; }

  .bebas { font-family: 'Bebas Neue', cursive; }

  .app { min-height: 100vh; display: flex; flex-direction: column; }

  /* ── Header ── */
  .header {
    padding: 28px 24px 22px;
    background: #080810;
    border-bottom: 1px solid #15151f;
    position: relative; overflow: hidden;
  }
  .header::after {
    content: ''; position: absolute;
    bottom: 0; left: 0; right: 0; height: 1px;
    background: linear-gradient(90deg, transparent, #ff4d1a44, transparent);
  }
  .header-glow {
    position: absolute; top: -80px; left: -60px;
    width: 320px; height: 220px;
    background: radial-gradient(ellipse, rgba(255,77,26,0.07) 0%, transparent 70%);
    pointer-events: none;
  }
  .header-inner { max-width: 760px; margin: 0 auto; position: relative; }
  .logo { display: flex; align-items: baseline; line-height: 1; }
  .logo-pace  { font-family: 'Bebas Neue', cursive; font-size: 58px; letter-spacing: 0.03em; color: #ede9e0; }
  .logo-board { font-family: 'Bebas Neue', cursive; font-size: 58px; letter-spacing: 0.03em; color: #ff4d1a; }
  .logo-dot   { width: 8px; height: 8px; border-radius: 50%; background: #ff4d1a; margin-left: 10px; margin-bottom: 12px; flex-shrink: 0; }
  .tagline    { font-size: 10px; letter-spacing: 0.14em; color: #3a3a52; text-transform: uppercase; margin-top: 4px; }

  /* ── Challenge Banner ── */
  .challenge-wrap { background: #0b0b14; border-bottom: 1px solid #15151f; }
  .challenge-inner { max-width: 760px; margin: 0 auto; padding: 0 24px; }

  .challenge-banner {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 16px;
    align-items: center;
    padding: 18px 0 16px;
    border-bottom: 1px solid #111120;
  }
  .challenge-eyebrow {
    font-size: 9px; letter-spacing: 0.18em; text-transform: uppercase;
    color: #ff4d1a; margin-bottom: 5px;
  }
  .challenge-title {
    font-family: 'Bebas Neue', cursive;
    font-size: 24px; letter-spacing: 0.05em; color: #ede9e0;
    margin-bottom: 3px;
  }
  .challenge-blurb { font-size: 11px; color: #4a4a68; }

  .countdown-block { text-align: right; flex-shrink: 0; }
  .countdown-num {
    font-family: 'Bebas Neue', cursive;
    font-size: 42px; line-height: 1; color: #ff4d1a;
    letter-spacing: 0.02em;
  }
  .countdown-label { font-size: 9px; letter-spacing: 0.12em; color: #3a3a52; text-transform: uppercase; }

  .prev-winner {
    display: flex; align-items: center; gap: 10px;
    padding: 10px 0 12px;
    font-size: 11px; color: #3a3a52;
  }
  .prev-winner-badge {
    background: rgba(255,208,96,0.08);
    border: 1px solid rgba(255,208,96,0.15);
    padding: 3px 10px;
    font-size: 10px; color: #a08020;
    letter-spacing: 0.06em;
    white-space: nowrap;
  }
  .prev-winner-name { color: #6a6a88; }

  /* ── Tabs ── */
  .tabs-wrap { background: #0b0b14; border-bottom: 1px solid #15151f; overflow-x: auto; scrollbar-width: none; }
  .tabs-wrap::-webkit-scrollbar { display: none; }
  .tabs-inner { max-width: 760px; margin: 0 auto; display: flex; }
  .tab {
    flex-shrink: 0; background: transparent;
    border: none; border-bottom: 2px solid transparent;
    color: #3d3d58; padding: 12px 18px; cursor: pointer;
    font-family: 'DM Mono', monospace; font-size: 11px;
    letter-spacing: 0.06em; transition: all 0.2s; white-space: nowrap;
  }
  .tab:hover { color: #8a8aaa; border-bottom-color: #2a2a3e; }
  .tab.active { color: #ede9e0; border-bottom-color: #ff4d1a; }
  .tab.challenge-tab { color: #884422; }
  .tab.challenge-tab.active { color: #ff4d1a; border-bottom-color: #ff4d1a; }
  .tab-pip {
    display: inline-block; width: 5px; height: 5px;
    border-radius: 50%; background: #ff4d1a;
    margin-left: 5px; margin-bottom: 2px; vertical-align: middle;
  }

  /* ── Main ── */
  .main { flex: 1; max-width: 760px; margin: 0 auto; width: 100%; padding: 24px; }
  .board-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; gap: 16px; }
  .board-title { font-family: 'Bebas Neue', cursive; font-size: 30px; letter-spacing: 0.05em; }
  .board-count { font-size: 10px; color: #3a3a52; text-transform: uppercase; letter-spacing: 0.1em; margin-top: 3px; }
  .board-subtitle { font-size: 11px; color: #3a3a52; margin-top: 4px; font-style: italic; }

  /* ── Challenge active indicator ── */
  .live-pill {
    display: inline-flex; align-items: center; gap: 5px;
    background: rgba(255,77,26,0.08); border: 1px solid rgba(255,77,26,0.2);
    padding: 3px 10px; font-size: 9px; letter-spacing: 0.1em;
    color: #ff4d1a; text-transform: uppercase; margin-top: 5px;
  }
  .live-dot {
    width: 5px; height: 5px; border-radius: 50%; background: #ff4d1a;
    animation: pulse 1.4s ease-in-out infinite;
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50%       { opacity: 0.4; transform: scale(0.7); }
  }

  /* ── Add button ── */
  .btn-add {
    background: #ff4d1a; color: #fff; border: none;
    padding: 11px 22px; font-family: 'Bebas Neue', cursive;
    font-size: 17px; letter-spacing: 0.08em; cursor: pointer;
    transition: all 0.18s; white-space: nowrap; flex-shrink: 0;
  }
  .btn-add:hover { background: #ff6633; transform: translateY(-1px); box-shadow: 0 4px 20px rgba(255,77,26,0.3); }
  .btn-add:active { transform: translateY(0); }
  .btn-add:disabled { background: #2a2a3e; color: #555; cursor: not-allowed; transform: none; box-shadow: none; }

  /* ── Board ── */
  .board { border: 1px solid #15151f; background: #0b0b14; }
  .entry {
    display: grid; grid-template-columns: 52px 1fr auto;
    gap: 12px; align-items: center;
    padding: 14px 18px; border-bottom: 1px solid #111120;
    transition: background 0.15s;
    animation: fadeSlide 0.3s ease both;
  }
  .entry:last-child { border-bottom: none; }
  .entry:hover { background: rgba(255,255,255,0.015); }
  .entry:hover .entry-actions { opacity: 1; }

  @keyframes fadeSlide {
    from { opacity: 0; transform: translateX(-8px); }
    to   { opacity: 1; transform: translateX(0); }
  }

  .rank-col { text-align: center; }
  .rank-emoji { font-size: 24px; line-height: 1; }
  .rank-num   { font-size: 12px; color: #3a3a52; font-variant-numeric: tabular-nums; }

  .entry-name   { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
  .entry-avatar { font-size: 18px; line-height: 1; }
  .entry-runner { font-size: 14px; font-weight: 500; color: #ede9e0; }
  .entry-date   { font-size: 10px; color: #2e2e44; margin-left: 2px; }

  .bar-track { height: 2px; background: #15151f; border-radius: 1px; overflow: hidden; }
  .bar-fill  { height: 100%; border-radius: 1px; transition: width 0.7s cubic-bezier(0.16,1,0.3,1); }
  .gold   .bar-fill { background: linear-gradient(90deg, #d4a017, #ffd060); }
  .silver .bar-fill { background: linear-gradient(90deg, #7a8fa8, #b8cad8); }
  .bronze .bar-fill { background: linear-gradient(90deg, #9a5c28, #d4894a); }
  .rest   .bar-fill { background: linear-gradient(90deg, #cc3d14, #ff6644); }

  .value-col { text-align: right; display: flex; align-items: center; gap: 6px; }
  .value-num  { font-family: 'Bebas Neue', cursive; font-size: 26px; letter-spacing: 0.04em; line-height: 1; }
  .value-unit { font-size: 9px; color: #3a3a52; text-transform: uppercase; letter-spacing: 0.1em; display: block; margin-top: 2px; }
  .gold   .value-num { color: #ffd060; }
  .silver .value-num { color: #b8cad8; }
  .bronze .value-num { color: #d4894a; }
  .rest   .value-num { color: #ff4d1a; }

  .entry-actions { opacity: 0; transition: opacity 0.18s; display: flex; gap: 2px; }
  .icon-btn { background: transparent; border: none; cursor: pointer; padding: 5px 7px; color: #2e2e44; font-size: 13px; transition: color 0.15s; line-height: 1; }
  .icon-btn:hover { color: #ede9e0; }
  .icon-btn.del:hover { color: #ff4d1a; }

  /* ── Empty ── */
  .empty { text-align: center; padding: 64px 20px; }
  .empty-icon  { font-size: 44px; margin-bottom: 14px; }
  .empty-title { font-family: 'Bebas Neue', cursive; font-size: 24px; letter-spacing: 0.06em; color: #2a2a3e; }
  .empty-sub   { font-size: 11px; color: #1e1e2e; margin-top: 6px; letter-spacing: 0.06em; }

  /* ── State msgs ── */
  .state-msg { text-align: center; padding: 48px 20px; font-size: 12px; color: #3a3a52; letter-spacing: 0.08em; }
  .error-msg { color: #ff4d1a; }

  /* ── Modal ── */
  .overlay {
    position: fixed; inset: 0; background: rgba(4,4,10,0.88);
    display: flex; align-items: center; justify-content: center;
    z-index: 50; backdrop-filter: blur(6px); padding: 20px;
  }
  .modal {
    background: #0f0f1c; border: 1px solid #1e1e30;
    padding: 32px; width: 100%; max-width: 430px;
    animation: popIn 0.22s ease both;
  }
  @keyframes popIn {
    from { opacity: 0; transform: scale(0.94) translateY(8px); }
    to   { opacity: 1; transform: scale(1) translateY(0); }
  }
  .modal-title { font-family: 'Bebas Neue', cursive; font-size: 26px; letter-spacing: 0.06em; margin-bottom: 24px; }

  .field { margin-bottom: 18px; }
  .field-label { font-size: 9px; letter-spacing: 0.14em; color: #3a3a52; text-transform: uppercase; margin-bottom: 6px; }
  .field-hint  { font-size: 9px; color: #2a2a3e; margin-top: 4px; }
  .field-input {
    width: 100%; background: #080810; border: 1px solid #1e1e30;
    color: #ede9e0; padding: 11px 14px;
    font-family: 'DM Mono', monospace; font-size: 14px;
    outline: none; transition: border-color 0.2s;
  }
  .field-input:focus { border-color: #ff4d1a; }
  .field-input.error { border-color: #ff4d1a80; }
  .field-error { font-size: 10px; color: #ff4d1a; margin-top: 4px; }

  .avatar-grid { display: flex; flex-wrap: wrap; gap: 7px; }
  .av-btn {
    width: 38px; height: 38px; background: #080810;
    border: 1px solid #1e1e30; font-size: 18px; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: all 0.15s; line-height: 1;
  }
  .av-btn:hover { border-color: #3a3a52; }
  .av-btn.sel   { border-color: #ff4d1a; background: rgba(255,77,26,0.08); }

  .modal-actions { display: flex; gap: 10px; margin-top: 26px; }
  .btn-ghost {
    background: transparent; border: 1px solid #1e1e30; color: #3a3a52;
    padding: 11px 20px; font-family: 'DM Mono', monospace; font-size: 11px;
    cursor: pointer; transition: all 0.18s; letter-spacing: 0.04em;
  }
  .btn-ghost:hover { border-color: #3a3a52; color: #ede9e0; }

  /* ── Challenge toggle inside modal ── */
  .challenge-toggle {
    display: flex; align-items: center; gap: 10px;
    padding: 12px 14px; background: rgba(255,77,26,0.06);
    border: 1px solid rgba(255,77,26,0.15); cursor: pointer;
    margin-bottom: 18px; transition: background 0.15s;
  }
  .challenge-toggle:hover { background: rgba(255,77,26,0.1); }
  .challenge-toggle input { accent-color: #ff4d1a; width: 15px; height: 15px; cursor: pointer; }
  .challenge-toggle-label { font-size: 11px; color: #cc5533; letter-spacing: 0.04em; flex: 1; }
  .challenge-toggle-sub   { font-size: 9px; color: #664422; margin-top: 2px; }

  /* ── Toast ── */
  .toast {
    position: fixed; bottom: 24px; left: 50%;
    transform: translateX(-50%);
    background: #ff4d1a; color: #fff;
    padding: 11px 28px; font-family: 'Bebas Neue', cursive;
    font-size: 17px; letter-spacing: 0.1em; z-index: 200;
    animation: toastIn 0.25s ease, toastOut 0.3s ease 1.8s forwards;
    white-space: nowrap;
  }
  @keyframes toastIn  { from { opacity:0; transform: translateX(-50%) translateY(12px); } to { opacity:1; transform: translateX(-50%) translateY(0); } }
  @keyframes toastOut { to   { opacity:0; transform: translateX(-50%) translateY(12px); } }

  /* ── Footer ── */
  .footer { font-size: 10px; color: #1e1e2e; text-align: center; padding: 16px; letter-spacing: 0.08em; text-transform: uppercase; }

  @media (max-width: 480px) {
    .logo-pace, .logo-board { font-size: 42px; }
    .challenge-banner { grid-template-columns: 1fr; }
    .countdown-block { text-align: left; }
    .entry { grid-template-columns: 40px 1fr auto; padding: 12px 12px; }
  }
`;

// ─── App ──────────────────────────────────────────────────────────────────────
const CHALLENGE_TAB = "__challenge__";

export default function App() {
  const [tab, setTab] = useState(CHALLENGE_TAB);
  const [entries, setEntries] = useState([]);
  const [challengeEntries, setChallengeEntries] = useState([]);
  const [prevWinner, setPrevWinner] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editEntry, setEditEntry] = useState(null);
  const [form, setForm] = useState({ name: "", value: "", avatar: "🏃", forChallenge: false });
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [daysLeft] = useState(getDaysLeft());

  const currentChallenge = getCurrentChallenge();
  const prevChallenge = getPrevChallenge();
  const isChallenge = tab === CHALLENGE_TAB;
  const activeCat = isChallenge
    ? CATEGORIES.find(c => c.id === currentChallenge.catId)
    : CATEGORIES.find(c => c.id === tab);

  // ── Fetch main entries ──
  const fetchEntries = useCallback(async () => {
    if (isChallenge) return;
    setLoading(true); setLoadError(null);
    const { data, error } = await supabase
      .from("entries").select("*").eq("category", tab)
      .order("value", { ascending: activeCat.lowerIsBetter });
    if (error) { setLoadError(error.message); setLoading(false); return; }
    setEntries(data || []);
    setLoading(false);
  }, [tab, isChallenge, activeCat]);

  // ── Fetch challenge entries ──
  const fetchChallengeEntries = useCallback(async () => {
    if (!isChallenge) return;
    setLoading(true); setLoadError(null);
    const monthKey = `challenge_${new Date().getFullYear()}_${new Date().getMonth()}`;
    const { data, error } = await supabase
      .from("entries").select("*").eq("category", monthKey)
      .order("value", { ascending: activeCat.lowerIsBetter });
    if (error) { setLoadError(error.message); setLoading(false); return; }
    setChallengeEntries(data || []);

    // Fetch last month's winner
    const prevMonth = new Date().getMonth() === 0 ? 11 : new Date().getMonth() - 1;
    const prevYear  = new Date().getMonth() === 0 ? new Date().getFullYear() - 1 : new Date().getFullYear();
    const prevKey   = `challenge_${prevYear}_${prevMonth}`;
    const prevCat   = CATEGORIES.find(c => c.id === prevChallenge.catId);
    const { data: pd } = await supabase
      .from("entries").select("*").eq("category", prevKey)
      .order("value", { ascending: prevCat.lowerIsBetter }).limit(1);
    if (pd && pd.length > 0) setPrevWinner({ ...pd[0], prevCat });
    setLoading(false);
  }, [isChallenge, activeCat, prevChallenge]);

  useEffect(() => { isChallenge ? fetchChallengeEntries() : fetchEntries(); }, [tab, fetchEntries, fetchChallengeEntries, isChallenge]);

  // ── Realtime ──
  useEffect(() => {
    const catKey = isChallenge
      ? `challenge_${new Date().getFullYear()}_${new Date().getMonth()}`
      : tab;
    const channel = supabase.channel(`entries:${catKey}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "entries", filter: `category=eq.${catKey}` },
        () => isChallenge ? fetchChallengeEntries() : fetchEntries())
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [tab, isChallenge, fetchEntries, fetchChallengeEntries]);

  const displayEntries = isChallenge ? challengeEntries : entries;
  const sorted = [...displayEntries].sort((a, b) =>
    activeCat.lowerIsBetter ? Number(a.value) - Number(b.value) : Number(b.value) - Number(a.value)
  );
  const allVals = sorted.map(e => Number(e.value));

  // ── Validate ──
  function validate() {
    const errs = {};
    if (!form.name.trim()) errs.name = "Name is required";
    if (!form.value.trim()) { errs.value = "Value is required"; }
    else if (activeCat.lowerIsBetter) {
      if (!parseTime(form.value) || isNaN(parseTime(form.value))) errs.value = "Use MM:SS or H:MM:SS format";
    } else {
      if (isNaN(parseFloat(form.value))) errs.value = "Must be a number";
    }
    return errs;
  }

  // ── Submit ──
  async function handleSubmit() {
    const errs = validate();
    if (Object.keys(errs).length) { setFormErrors(errs); return; }
    setSaving(true);

    const storedVal = toStoredValue(form.value, activeCat);
    const categoryKey = (isChallenge || form.forChallenge)
      ? `challenge_${new Date().getFullYear()}_${new Date().getMonth()}`
      : tab;

    const payload = { name: form.name.trim(), avatar: form.avatar, category: categoryKey, value: storedVal, raw: form.value.trim() };
    let error;
    if (editEntry) {
      ({ error } = await supabase.from("entries").update(payload).eq("id", editEntry.id));
    } else {
      ({ error } = await supabase.from("entries").upsert({ ...payload }, { onConflict: "name,category" }));
    }

    setSaving(false);
    if (error) { setFormErrors({ general: error.message }); return; }
    showToast(`${form.name.trim()} is on the board!`);
    closeForm();
    isChallenge ? fetchChallengeEntries() : fetchEntries();
  }

  async function handleDelete(id) {
    await supabase.from("entries").delete().eq("id", id);
    isChallenge ? fetchChallengeEntries() : fetchEntries();
  }

  function openEdit(e) {
    setEditEntry(e);
    setForm({ name: e.name, value: e.raw || formatDisplay(e.value, activeCat), avatar: e.avatar, forChallenge: false });
    setFormErrors({}); setShowForm(true);
  }

  function closeForm() {
    setShowForm(false); setEditEntry(null);
    setForm({ name: "", value: "", avatar: "🏃", forChallenge: false });
    setFormErrors({});
  }

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(null), 2200); }

  const openAddForm = () => {
    closeForm();
    setForm(f => ({ ...f, forChallenge: isChallenge }));
    setShowForm(true);
  };

  // ── Render ──
  return (
    <>
      <style>{CSS}</style>
      <div className="app">

        {/* Header */}
        <header className="header">
          <div className="header-glow" />
          <div className="header-inner">
            <div className="logo">
              <span className="logo-pace">PACE</span>
              <span className="logo-board">BOARD</span>
              <span className="logo-dot" />
            </div>
            <div className="tagline">Group running leaderboard — who's got the legs?</div>
          </div>
        </header>

        {/* Monthly Challenge Banner */}
        <div className="challenge-wrap">
          <div className="challenge-inner">
            <div className="challenge-banner">
              <div>
                <div className="challenge-eyebrow">🏆 {getMonthName()} Challenge — Active Now</div>
                <div className="challenge-title">{currentChallenge.title}</div>
                <div className="challenge-blurb">{currentChallenge.blurb} · {activeCat && isChallenge ? activeCat.label : CATEGORIES.find(c => c.id === currentChallenge.catId)?.label}</div>
              </div>
              <div className="countdown-block">
                <div className="countdown-num">{daysLeft}</div>
                <div className="countdown-label">days left</div>
              </div>
            </div>
            {prevWinner && (
              <div className="prev-winner">
                <span className="prev-winner-badge">🏆 {getMonthName(-1)} winner</span>
                <span className="prev-winner-name">{prevWinner.avatar} {prevWinner.name} — {formatDisplay(prevWinner.value, prevWinner.prevCat)} {prevWinner.prevCat.unit}</span>
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <nav className="tabs-wrap">
          <div className="tabs-inner">
            <button className={`tab challenge-tab ${tab === CHALLENGE_TAB ? "active" : ""}`} onClick={() => setTab(CHALLENGE_TAB)}>
              🏆 {getMonthName()} Challenge <span className="tab-pip" />
            </button>
            {CATEGORIES.map(c => (
              <button key={c.id} className={`tab ${tab === c.id ? "active" : ""}`} onClick={() => setTab(c.id)}>
                {c.icon} {c.label}
              </button>
            ))}
          </div>
        </nav>

        {/* Main */}
        <main className="main">
          <div className="board-header">
            <div>
              {isChallenge ? (
                <>
                  <div className="board-title bebas">🏆 {currentChallenge.title}</div>
                  <div className="board-count">{sorted.length} runner{sorted.length !== 1 ? "s" : ""} competing</div>
                  <div className="live-pill"><span className="live-dot" /> Live · Resets {getMonthName(1)} 1</div>
                </>
              ) : (
                <>
                  <div className="board-title bebas">{activeCat.icon} {activeCat.label}</div>
                  <div className="board-count">{sorted.length} runner{sorted.length !== 1 ? "s" : ""} on the board</div>
                  {currentChallenge.catId === tab && (
                    <div className="board-subtitle">Also the active monthly challenge →</div>
                  )}
                </>
              )}
            </div>
            <button className="btn-add" onClick={openAddForm} disabled={saving}>
              + Add Entry
            </button>
          </div>

          <div className="board">
            {loading ? (
              <div className="state-msg">Loading…</div>
            ) : loadError ? (
              <div className="state-msg error-msg">⚠ {loadError}</div>
            ) : sorted.length === 0 ? (
              <div className="empty">
                <div className="empty-icon">{isChallenge ? "🏆" : "🏁"}</div>
                <div className="empty-title">{isChallenge ? "Challenge is open!" : "No entries yet"}</div>
                <div className="empty-sub">{isChallenge ? `Be the first to post for ${currentChallenge.title}` : "Be the first on the board"}</div>
              </div>
            ) : sorted.map((entry, i) => {
              const rank = getRank(i);
              const barW = getBarWidth(Number(entry.value), allVals, activeCat);
              return (
                <div key={entry.id} className={`entry ${rank.cls}`} style={{ animationDelay: `${i * 40}ms` }}>
                  <div className="rank-col">
                    {rank.emoji ? <div className="rank-emoji">{rank.emoji}</div> : <div className="rank-num">#{i + 1}</div>}
                  </div>
                  <div>
                    <div className="entry-name">
                      <span className="entry-avatar">{entry.avatar}</span>
                      <span className="entry-runner">{entry.name}</span>
                      <span className="entry-date">{entry.created_at ? new Date(entry.created_at).toLocaleDateString() : ""}</span>
                    </div>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: `${barW}%` }} />
                    </div>
                  </div>
                  <div className="value-col">
                    <div>
                      <div className="value-num">{formatDisplay(entry.value, activeCat)}</div>
                      <span className="value-unit">{activeCat.unit}</span>
                    </div>
                    <div className="entry-actions">
                      <button className="icon-btn" onClick={() => openEdit(entry)} title="Edit">✏️</button>
                      <button className="icon-btn del" onClick={() => handleDelete(entry.id)} title="Delete">✕</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </main>

        <footer className="footer">Paceboard · data synced live · {getMonthName()} challenge ends in {daysLeft} days</footer>
      </div>

      {/* Modal */}
      {showForm && (
        <div className="overlay" onClick={e => { if (e.target === e.currentTarget) closeForm(); }}>
          <div className="modal">
            <div className="modal-title bebas">
              {editEntry ? "Edit Entry" : isChallenge ? `Enter ${currentChallenge.title}` : `Add to ${activeCat.label}`}
            </div>

            {formErrors.general && <div className="field-error" style={{ marginBottom: 14 }}>⚠ {formErrors.general}</div>}

            {/* Challenge opt-in toggle (only on non-challenge tabs where cat matches) */}
            {!isChallenge && !editEntry && (
              <label className="challenge-toggle">
                <input type="checkbox" checked={form.forChallenge}
                  onChange={e => setForm(f => ({ ...f, forChallenge: e.target.checked }))} />
                <div>
                  <div className="challenge-toggle-label">🏆 Also enter {getMonthName()} Challenge</div>
                  <div className="challenge-toggle-sub">{currentChallenge.title} — {daysLeft} days left</div>
                </div>
              </label>
            )}

            <div className="field">
              <div className="field-label">Your Name</div>
              <input className={`field-input ${formErrors.name ? "error" : ""}`}
                value={form.name} placeholder="e.g. Sarah K."
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                onKeyDown={e => e.key === "Enter" && handleSubmit()} />
              {formErrors.name && <div className="field-error">{formErrors.name}</div>}
            </div>

            <div className="field">
              <div className="field-label">{isChallenge ? CATEGORIES.find(c => c.id === currentChallenge.catId)?.label : activeCat.label}</div>
              <input className={`field-input ${formErrors.value ? "error" : ""}`}
                value={form.value} placeholder={activeCat.placeholder}
                onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
                onKeyDown={e => e.key === "Enter" && handleSubmit()} />
              <div className="field-hint">{activeCat.hint}</div>
              {formErrors.value && <div className="field-error">{formErrors.value}</div>}
            </div>

            <div className="field">
              <div className="field-label">Avatar</div>
              <div className="avatar-grid">
                {AVATARS.map(a => (
                  <button key={a} className={`av-btn ${form.avatar === a ? "sel" : ""}`}
                    onClick={() => setForm(f => ({ ...f, avatar: a }))}>{a}</button>
                ))}
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn-add" style={{ flex: 1 }} onClick={handleSubmit} disabled={saving}>
                {saving ? "Saving…" : editEntry ? "Save Changes" : "Add to Board"}
              </button>
              <button className="btn-ghost" onClick={closeForm}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">🏆 {toast}</div>}
    </>
  );
}
