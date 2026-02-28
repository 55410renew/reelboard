import { useState, useEffect, useRef } from "react";
import { db } from "./firebase";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";

const GENRES = ["Drama","Comedy","Action","Thriller","Sci-Fi","Horror","Romance","Animation","Documentary","Fantasy"];

const PALETTE = [
  "#E63946","#F4A261","#2A9D8F","#E9C46A","#457B9D",
  "#A8DADC","#6D6875","#B5838D","#52B788","#F77F00"
];

const DEFAULT_NAMES = ["Alex","Blake","Casey","Dana","Ellis","Fran","Grey","Harper","Indigo","Jules"];

const REACTIONS = [
  { key: "wantToWatch", emoji: "🎟", label: "Want to Watch" },
  { key: "loveIt",      emoji: "❤️",  label: "Love It" },
  { key: "seenIt",      emoji: "🎬",  label: "Seen It" },
];

const GENRE_COLORS = {
  Drama: "#7B2D8B", Comedy: "#F4A261", Action: "#E63946", Thriller: "#1D3557",
  "Sci-Fi": "#457B9D", Horror: "#2D2D2D", Romance: "#B5838D", Animation: "#52B788",
  Documentary: "#6D6875", Fantasy: "#A8DADC"
};

// Firestore document reference — all 10 users stored in one doc
const BOARD_DOC = doc(db, "reelboard", "main");

function buildFreshState() {
  return DEFAULT_NAMES.map((name, i) => ({
    id: i, name, color: PALETTE[i],
    slots: Array(10).fill(null).map((_, j) => ({
      id: j, title: "", description: "", genre: "", rating: 0,
      votes: { wantToWatch: [], loveIt: [], seenIt: [] },
    })),
  }));
}

function StarRating({ value, onChange, size = 18 }) {
  const [hover, setHover] = useState(0);
  return (
    <div style={{ display: "flex", gap: 3 }}>
      {[1,2,3,4,5].map(s => (
        <span key={s}
          onMouseEnter={() => onChange && setHover(s)}
          onMouseLeave={() => onChange && setHover(0)}
          onClick={() => onChange && onChange(s === value ? 0 : s)}
          style={{ fontSize: size, cursor: onChange ? "pointer" : "default",
            color: s <= (hover || value) ? "#F4C430" : "#ddd",
            transition: "color 0.1s, transform 0.1s",
            transform: s <= (hover || value) && onChange ? "scale(1.2)" : "scale(1)",
            lineHeight: 1, userSelect: "none", display: "inline-block" }}>★</span>
      ))}
    </div>
  );
}

function Modal({ children, onClose }) {
  useEffect(() => {
    const h = e => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(10,5,20,0.75)", backdropFilter: "blur(10px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20, animation: "fadeIn 0.15s ease" }}>
      {children}
    </div>
  );
}

function VoteBar({ slot, activeUserId, onVote, ownerUserId }) {
  const canVote = activeUserId !== ownerUserId;
  return (
    <div style={{ display: "flex", gap: 6, marginTop: 14, flexWrap: "wrap" }}>
      {REACTIONS.map(r => {
        const voters = slot.votes?.[r.key] || [];
        const voted = voters.includes(activeUserId);
        const count = voters.length;
        return (
          <button key={r.key}
            onClick={e => { e.stopPropagation(); canVote && onVote(r.key); }}
            title={canVote ? (voted ? `Remove "${r.label}"` : r.label) : "Can't vote on your own pick"}
            style={{ display: "flex", alignItems: "center", gap: 6,
              padding: "5px 12px", borderRadius: 20,
              border: `1.5px solid ${voted ? "#F4C430" : "rgba(255,255,255,0.15)"}`,
              background: voted ? "rgba(244,196,48,0.18)" : "rgba(255,255,255,0.06)",
              color: voted ? "#F4C430" : "rgba(255,255,255,0.55)",
              fontSize: 12, fontFamily: "'DM Mono', monospace",
              cursor: canVote ? "pointer" : "not-allowed",
              transition: "all 0.15s", opacity: !canVote ? 0.35 : 1,
              fontWeight: voted ? 600 : 400 }}>
            <span style={{ fontSize: 14 }}>{r.emoji}</span>
            <span>{r.label}</span>
            {count > 0 && (
              <span style={{ background: voted ? "rgba(244,196,48,0.25)" : "rgba(255,255,255,0.1)",
                borderRadius: 10, padding: "1px 7px", fontSize: 11,
                color: voted ? "#F4C430" : "rgba(255,255,255,0.5)", fontWeight: 700 }}>
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default function MovieBoard() {
  const [users, setUsers] = useState(null);
  const [activeUserId, setActiveUserId] = useState(0);
  const [view, setView] = useState("board");
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState({ title: "", description: "", genre: "", rating: 0 });
  const [filterGenre, setFilterGenre] = useState("");
  const [filterUser, setFilterUser] = useState("");
  const [sortBy, setSortBy] = useState("recent");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [renamingUser, setRenamingUser] = useState(null);
  const [renameVal, setRenameVal] = useState("");
  const toastTimer = useRef(null);

  // ── FIREBASE: subscribe to real-time updates ──
  useEffect(() => {
    const unsub = onSnapshot(BOARD_DOC, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        // Migrate: ensure votes exist on all slots
        const migrated = data.users.map(u => ({
          ...u,
          slots: u.slots.map(s => ({
            ...s,
            votes: s.votes || { wantToWatch: [], loveIt: [], seenIt: [] }
          }))
        }));
        setUsers(migrated);
      } else {
        // First time — seed the database with fresh state
        const fresh = buildFreshState();
        setDoc(BOARD_DOC, { users: fresh });
        setUsers(fresh);
      }
      setLoading(false);
    }, (err) => {
      console.error("Firebase error:", err);
      setUsers(buildFreshState());
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // ── FIREBASE: write updated state ──
  async function persist(newUsers) {
    setSaving(true);
    try {
      await setDoc(BOARD_DOC, { users: newUsers });
    } catch (e) {
      console.error("Save failed:", e);
    }
    setSaving(false);
  }

  function showToast(msg) {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2500);
  }

  function openEdit(userId, slotId) {
    const slot = users.find(u => u.id === userId).slots[slotId];
    setForm({ title: slot.title, description: slot.description, genre: slot.genre, rating: slot.rating });
    setEditTarget({ userId, slotId });
  }

  async function saveEdit() {
    if (!form.title.trim()) return;
    const newUsers = users.map(u =>
      u.id !== editTarget.userId ? u : {
        ...u, slots: u.slots.map((s, i) =>
          i !== editTarget.slotId ? s : { ...s, ...form, title: form.title.trim(), description: form.description.trim() }
        )
      }
    );
    setUsers(newUsers); await persist(newUsers);
    setEditTarget(null); showToast("Saved 🎬");
  }

  async function clearSlot(userId, slotId) {
    const newUsers = users.map(u =>
      u.id !== userId ? u : {
        ...u, slots: u.slots.map((s, i) =>
          i !== slotId ? s : { id: i, title: "", description: "", genre: "", rating: 0, votes: { wantToWatch: [], loveIt: [], seenIt: [] } }
        )
      }
    );
    setUsers(newUsers); await persist(newUsers); showToast("Cleared");
  }

  async function handleVote(ownerUserId, slotIdx, reactionKey) {
    if (activeUserId === ownerUserId) return;
    const newUsers = users.map(u =>
      u.id !== ownerUserId ? u : {
        ...u, slots: u.slots.map((s, i) => {
          if (i !== slotIdx) return s;
          const current = s.votes?.[reactionKey] || [];
          const already = current.includes(activeUserId);
          return { ...s, votes: { ...s.votes, [reactionKey]: already ? current.filter(id => id !== activeUserId) : [...current, activeUserId] } };
        })
      }
    );
    setUsers(newUsers); await persist(newUsers);
  }

  async function saveRename() {
    if (!renameVal.trim()) return;
    const newUsers = users.map(u => u.id !== renamingUser ? u : { ...u, name: renameVal.trim() });
    setUsers(newUsers); await persist(newUsers); setRenamingUser(null);
  }

  if (loading) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      height: "100vh", background: "#0D0208",
      backgroundImage: "radial-gradient(ellipse at 50% 50%, #1a0a2e 0%, #0D0208 70%)" }}>
      <div style={{ fontFamily: "'Cinzel Decorative', cursive", fontSize: 28, color: "#F4C430", letterSpacing: 6, marginBottom: 12 }}>🎞</div>
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#666", letterSpacing: 5, textTransform: "uppercase" }}>
        Opening the curtains…
      </div>
    </div>
  );

  const activeUser = users.find(u => u.id === activeUserId);
  const totalVotesOn = s => Object.values(s.votes || {}).reduce((n, a) => n + a.length, 0);
  const totalPicks = users.flatMap(u => u.slots).filter(s => s.title).length;

  let allPicks = users.flatMap(u =>
    u.slots.map((s, i) => ({ ...s, userName: u.name, userColor: u.color, userId: u.id, slotIdx: i }))
  ).filter(p => p.title)
    .filter(p => !filterGenre || p.genre === filterGenre)
    .filter(p => !filterUser || p.userId === parseInt(filterUser));

  if (sortBy === "votes")  allPicks.sort((a, b) => totalVotesOn(b) - totalVotesOn(a));
  if (sortBy === "rating") allPicks.sort((a, b) => (b.rating||0) - (a.rating||0));

  const topPicks = [...users.flatMap(u =>
    u.slots.map((s, i) => ({ ...s, userName: u.name, userColor: u.color, userId: u.id, slotIdx: i }))
  ).filter(p => p.title && totalVotesOn(p) > 0)].sort((a,b) => totalVotesOn(b)-totalVotesOn(a)).slice(0,3);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700;900&family=Cinzel+Decorative:wght@400;700&family=Lora:ital,wght@0,400;0,600;1,400;1,600&family=DM+Mono:wght@300;400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0D0208; }
        @keyframes fadeIn  { from { opacity:0; transform:translateY(6px);  } to { opacity:1; transform:translateY(0); } }
        @keyframes slideUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        @keyframes toastIn { from { opacity:0; transform:translateX(16px); } to { opacity:1; transform:translateX(0); } }
        @keyframes shimmer { 0%,100% { opacity:0.6; } 50% { opacity:1; } }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: #0D0208; }
        ::-webkit-scrollbar-thumb { background: #3a2040; border-radius: 4px; }
        .pick-card { transition: transform 0.22s cubic-bezier(.22,.68,0,1.4), box-shadow 0.22s ease !important; }
        .pick-card:hover { transform: translateY(-5px) scale(1.01) !important; box-shadow: 0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(244,196,48,0.15) !important; }
        .slot-card { transition: all 0.2s ease !important; }
        .slot-card:hover { transform: translateY(-2px) !important; box-shadow: 0 8px 30px rgba(0,0,0,0.5) !important; }
        .slot-card:hover .add-hint { opacity: 1 !important; }
        .utab { transition: all 0.22s cubic-bezier(.22,.68,0,1.2) !important; }
        .utab:hover { transform: scale(1.06) !important; }
        .clrbtn:hover { color: #E63946 !important; border-color: #E63946 !important; }
        select, input, textarea { outline: none; }
        .gold-text {
          background: linear-gradient(135deg, #F4C430 0%, #FFD700 40%, #C8960C 70%, #F4C430 100%);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
        }
        .card-glow:hover { box-shadow: 0 0 30px var(--glow-color), 0 20px 60px rgba(0,0,0,0.7) !important; }
      `}</style>

      <div style={{ minHeight: "100vh", background: "#0D0208",
        backgroundImage: `radial-gradient(ellipse at 20% 0%, #1a0535 0%, transparent 50%),
          radial-gradient(ellipse at 80% 100%, #0a1535 0%, transparent 50%),
          radial-gradient(ellipse at 50% 50%, #150820 0%, transparent 80%)`,
        color: "#f0e8d0", fontFamily: "'Lora', serif" }}>

        {/* ══ HEADER ══ */}
        <header style={{ position: "relative", overflow: "hidden",
          borderBottom: "3px solid #F4C430",
          background: "linear-gradient(180deg, #1a0535 0%, #0D0208 100%)" }}>
          <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 28, background: "#111",
            borderRight: "2px solid #222",
            backgroundImage: "repeating-linear-gradient(to bottom, transparent 0px, transparent 12px, #333 12px, #333 14px, transparent 14px, transparent 20px)" }} />
          <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 28, background: "#111",
            borderLeft: "2px solid #222",
            backgroundImage: "repeating-linear-gradient(to bottom, transparent 0px, transparent 12px, #333 12px, #333 14px, transparent 14px, transparent 20px)" }} />
          <div style={{ padding: "32px 64px 24px" }}>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10,
                letterSpacing: 6, color: "#F4C430", textTransform: "uppercase", marginBottom: 10, opacity: 0.8 }}>
                ✦ Now Screening ✦
              </div>
              <h1 className="gold-text" style={{ fontFamily: "'Cinzel Decorative', cursive",
                fontSize: "clamp(28px, 5vw, 56px)", fontWeight: 700, letterSpacing: "0.05em", lineHeight: 1.1, marginBottom: 6 }}>
                The Reel Board
              </h1>
              <div style={{ fontFamily: "'Lora', serif", fontStyle: "italic",
                fontSize: 14, color: "rgba(244,196,48,0.6)", letterSpacing: 2 }}>
                A Shared Cinema Experience
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: 32, marginBottom: 20,
              padding: "10px 0", borderTop: "1px solid rgba(244,196,48,0.15)", borderBottom: "1px solid rgba(244,196,48,0.15)" }}>
              {[["🎞", totalPicks, "Picks"], ["👥", users.length, "Members"],
                ["❤️", users.flatMap(u=>u.slots).reduce((n,s)=>n+totalVotesOn(s),0), "Reactions"]
              ].map(([icon, val, label]) => (
                <div key={label} style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: "'Cinzel', serif", fontSize: 22, color: "#F4C430", fontWeight: 700 }}>{icon} {val}</div>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: 3, color: "rgba(240,232,208,0.4)", textTransform: "uppercase" }}>{label}</div>
                </div>
              ))}
              <div style={{ textAlign: "center", alignSelf: "center" }}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: 2,
                  color: saving ? "#F4A261" : "#2A9D8F", textTransform: "uppercase" }}>
                  {saving ? "● Saving…" : "● Live"}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: 12 }}>
              {[["board","🎭 Everyone's Picks"],["mylist","🎟 My List"]].map(([v,label]) => (
                <button key={v} onClick={() => setView(v)} style={{
                  padding: "10px 28px", border: view===v ? "2px solid #F4C430" : "2px solid rgba(244,196,48,0.25)",
                  borderRadius: 2, background: view===v ? "linear-gradient(135deg, #F4C430 0%, #C8960C 100%)" : "rgba(244,196,48,0.06)",
                  color: view===v ? "#0D0208" : "#F4C430", fontFamily: "'Cinzel', serif",
                  fontSize: 13, fontWeight: view===v ? 700 : 600, letterSpacing: 2, textTransform: "uppercase",
                  cursor: "pointer", transition: "all 0.2s" }}>{label}</button>
              ))}
            </div>
          </div>
        </header>

        {/* ══ USER ROW ══ */}
        <div style={{ background: "linear-gradient(180deg, rgba(18,4,36,0.98) 0%, rgba(10,2,20,0.95) 100%)",
          borderBottom: "2px solid rgba(244,196,48,0.3)", borderTop: "1px solid rgba(244,196,48,0.08)",
          padding: "20px 48px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10,
            letterSpacing: 4, color: "rgba(244,196,48,0.6)", textTransform: "uppercase", marginRight: 6, whiteSpace: "nowrap" }}>
            🎟 You are:
          </span>
          {users.map(u => {
            const isActive = activeUserId === u.id;
            const pickCount = u.slots.filter(s => s.title).length;
            return (
              <button key={u.id} className="utab"
                onClick={() => setActiveUserId(u.id)}
                onDoubleClick={() => { setRenamingUser(u.id); setRenameVal(u.name); }}
                title="Click to select · Double-click to rename"
                style={{ padding: "10px 20px", borderRadius: 32,
                  border: `3px solid ${isActive ? u.color : u.color + "88"}`,
                  background: isActive
                    ? `linear-gradient(135deg, ${u.color} 0%, ${u.color}dd 100%)`
                    : `linear-gradient(135deg, ${u.color}30 0%, ${u.color}18 100%)`,
                  color: isActive ? "#fff" : u.color,
                  fontFamily: "'Cinzel', serif", fontSize: isActive ? 14 : 13, fontWeight: 700,
                  letterSpacing: "0.08em", cursor: "pointer", transition: "all 0.22s cubic-bezier(.22,.68,0,1.2)",
                  boxShadow: isActive
                    ? `0 0 24px ${u.color}aa, 0 0 48px ${u.color}44, 0 4px 16px rgba(0,0,0,0.6)`
                    : `0 0 8px ${u.color}44, 0 2px 8px rgba(0,0,0,0.4)`,
                  textShadow: isActive ? `0 0 12px ${u.color}88, 0 1px 4px rgba(0,0,0,0.6)` : "none",
                  transform: isActive ? "scale(1.08)" : "scale(1)",
                  display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%",
                  background: isActive ? "#fff" : u.color,
                  boxShadow: isActive ? `0 0 8px #fff, 0 0 16px ${u.color}` : `0 0 6px ${u.color}cc`,
                  flexShrink: 0, animation: isActive ? "shimmer 1.8s ease-in-out infinite" : "none" }} />
                {u.name}
                {pickCount > 0 && (
                  <span style={{ background: isActive ? "rgba(0,0,0,0.3)" : u.color + "40",
                    border: `1.5px solid ${isActive ? "rgba(255,255,255,0.35)" : u.color + "88"}`,
                    borderRadius: 12, padding: "2px 8px", fontSize: 11, fontWeight: 700,
                    color: isActive ? "#fff" : u.color, fontFamily: "'DM Mono', monospace",
                    letterSpacing: 0, lineHeight: 1.4 }}>
                    {pickCount}
                  </span>
                )}
              </button>
            );
          })}
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9,
            color: "rgba(255,255,255,0.18)", marginLeft: 4, letterSpacing: 1, alignSelf: "center" }}>
            double-click to rename
          </span>
        </div>

        <main style={{ padding: "36px 48px" }}>

          {/* ══ BOARD VIEW ══ */}
          {view === "board" && (
            <div style={{ animation: "slideUp 0.35s ease" }}>
              {topPicks.length > 0 && (
                <div style={{ marginBottom: 40 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
                    <div style={{ flex: 1, height: 1, background: "linear-gradient(to right, transparent, rgba(244,196,48,0.4))" }} />
                    <h2 style={{ fontFamily: "'Cinzel Decorative', cursive", fontSize: 18, color: "#F4C430", letterSpacing: 3, whiteSpace: "nowrap" }}>
                      🏆 Box Office Champions
                    </h2>
                    <div style={{ flex: 1, height: 1, background: "linear-gradient(to left, transparent, rgba(244,196,48,0.4))" }} />
                  </div>
                  <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center" }}>
                    {topPicks.map((p, i) => (
                      <div key={`top-${p.userId}-${p.slotIdx}`} style={{
                        background: `linear-gradient(135deg, ${p.userColor}22 0%, rgba(0,0,0,0.6) 100%)`,
                        border: `2px solid ${p.userColor}`, borderRadius: 8, padding: "18px 22px",
                        display: "flex", alignItems: "center", gap: 16, boxShadow: `0 4px 24px ${p.userColor}33`, minWidth: 260 }}>
                        <div style={{ fontFamily: "'Cinzel Decorative', cursive", fontSize: 36,
                          color: ["#F4C430","#C0C0C0","#CD7F32"][i],
                          lineHeight: 1, textShadow: `0 0 20px ${["#F4C430","#C0C0C0","#CD7F32"][i]}66` }}>
                          {["①","②","③"][i]}
                        </div>
                        <div>
                          <div style={{ fontFamily: "'Cinzel', serif", fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 4 }}>{p.title}</div>
                          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: p.userColor, letterSpacing: 1, marginBottom: 8 }}>Picked by {p.userName}</div>
                          <div style={{ display: "flex", gap: 10 }}>
                            {REACTIONS.map(r => { const c = (p.votes?.[r.key]||[]).length; return c > 0 ? (
                              <span key={r.key} style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "rgba(255,255,255,0.55)", display:"flex", alignItems:"center", gap:4 }}>
                                {r.emoji} <strong style={{ color: "#fff" }}>{c}</strong>
                              </span>) : null; })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap", alignItems: "center",
                padding: "16px 20px", background: "rgba(0,0,0,0.3)", borderRadius: 8, border: "1px solid rgba(244,196,48,0.1)" }}>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "rgba(244,196,48,0.5)", letterSpacing: 3, textTransform: "uppercase" }}>Filter:</span>
                <select value={filterGenre} onChange={e => setFilterGenre(e.target.value)}
                  style={{ background: "#1a0a2e", border: "1px solid rgba(244,196,48,0.2)", color: filterGenre ? "#f0e8d0" : "rgba(240,232,208,0.4)", fontFamily: "'DM Mono', monospace", fontSize: 12, padding: "6px 12px", borderRadius: 4, cursor: "pointer" }}>
                  <option value="">All genres</option>
                  {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
                <select value={filterUser} onChange={e => setFilterUser(e.target.value)}
                  style={{ background: "#1a0a2e", border: "1px solid rgba(244,196,48,0.2)", color: filterUser ? "#f0e8d0" : "rgba(240,232,208,0.4)", fontFamily: "'DM Mono', monospace", fontSize: 12, padding: "6px 12px", borderRadius: 4, cursor: "pointer" }}>
                  <option value="">All members</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
                <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "rgba(244,196,48,0.4)", letterSpacing: 2, textTransform: "uppercase" }}>Sort:</span>
                  {[["recent","Recent"],["votes","Most Reacted"],["rating","Top Rated"]].map(([v,label]) => (
                    <button key={v} onClick={() => setSortBy(v)} style={{ padding: "5px 14px",
                      border: `1px solid ${sortBy===v ? "#F4C430" : "rgba(244,196,48,0.2)"}`, borderRadius: 16,
                      background: sortBy===v ? "rgba(244,196,48,0.15)" : "transparent",
                      color: sortBy===v ? "#F4C430" : "rgba(240,232,208,0.45)",
                      fontFamily: "'DM Mono', monospace", fontSize: 11, cursor: "pointer", transition: "all 0.15s", fontWeight: sortBy===v ? 600 : 400 }}>{label}</button>
                  ))}
                </div>
                {(filterGenre || filterUser) && (
                  <button onClick={() => { setFilterGenre(""); setFilterUser(""); }}
                    style={{ padding: "5px 12px", border: "1px solid rgba(230,57,70,0.4)", borderRadius: 4, background: "rgba(230,57,70,0.1)", color: "#E63946", fontFamily: "'DM Mono', monospace", fontSize: 11, cursor: "pointer" }}>
                    clear ×
                  </button>
                )}
              </div>

              {allPicks.length === 0 ? (
                <div style={{ textAlign: "center", padding: "100px 0" }}>
                  <div style={{ fontSize: 48, marginBottom: 16 }}>🎞</div>
                  <div style={{ fontFamily: "'Cinzel', serif", fontSize: 20, color: "rgba(244,196,48,0.3)", letterSpacing: 3 }}>The House Lights Are Up</div>
                  <div style={{ fontFamily: "'Lora', serif", fontStyle: "italic", fontSize: 14, color: "rgba(240,232,208,0.2)", marginTop: 8 }}>No picks yet — add yours to begin the show</div>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px,1fr))", gap: 20 }}>
                  {allPicks.map((pick, i) => {
                    const gc = GENRE_COLORS[pick.genre] || pick.userColor;
                    return (
                      <div key={`${pick.userId}-${pick.slotIdx}-${i}`} className="pick-card card-glow"
                        style={{ "--glow-color": pick.userColor + "44", background: `linear-gradient(145deg, #1a0a2e 0%, #0e0618 100%)`,
                          border: `1px solid ${pick.userColor}44`, borderRadius: 10, padding: "0",
                          animation: `fadeIn 0.35s ease ${i*0.04}s both`, overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.5)" }}>
                        <div style={{ background: `linear-gradient(135deg, ${pick.userColor} 0%, ${gc} 100%)`, padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontFamily: "'Cinzel', serif", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.95)", letterSpacing: 2, textTransform: "uppercase", textShadow: "0 1px 3px rgba(0,0,0,0.4)" }}>{pick.userName}</span>
                          {pick.genre && <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "rgba(255,255,255,0.8)", textTransform: "uppercase", letterSpacing: 2, background: "rgba(0,0,0,0.25)", borderRadius: 10, padding: "3px 9px" }}>{pick.genre}</span>}
                        </div>
                        <div style={{ padding: "18px 18px 16px" }}>
                          <div style={{ fontFamily: "'Cinzel', serif", fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 8, lineHeight: 1.3, letterSpacing: "0.02em" }}>{pick.title}</div>
                          {pick.rating > 0 && <div style={{ marginBottom: 10 }}><StarRating value={pick.rating} size={16} /></div>}
                          {pick.description && <p style={{ fontFamily: "'Lora', serif", fontStyle: "italic", fontSize: 13, color: "rgba(240,232,208,0.6)", lineHeight: 1.7, marginBottom: 4 }}>"{pick.description.length > 120 ? pick.description.slice(0,120)+"…" : pick.description}"</p>}
                          <VoteBar slot={pick} activeUserId={activeUserId} ownerUserId={pick.userId} onVote={key => handleVote(pick.userId, pick.slotIdx, key)} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ══ MY LIST VIEW ══ */}
          {view === "mylist" && (
            <div style={{ animation: "slideUp 0.35s ease" }}>
              <div style={{ marginBottom: 28, textAlign: "center" }}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: 4, color: activeUser.color, textTransform: "uppercase", marginBottom: 8, opacity: 0.8 }}>Your Screening Selection</div>
                <h2 style={{ fontFamily: "'Cinzel Decorative', cursive", fontSize: 28, color: "#fff", letterSpacing: "0.05em" }}>{activeUser.name}'s Picks</h2>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "rgba(240,232,208,0.3)", marginTop: 8, letterSpacing: 2 }}>{activeUser.slots.filter(s=>s.title).length} of 10 slots filled</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px,1fr))", gap: 14 }}>
                {activeUser.slots.map((slot, i) => (
                  <div key={i} className="slot-card"
                    style={{ background: slot.title ? `linear-gradient(145deg, #1a0a2e 0%, #0e0618 100%)` : "rgba(255,255,255,0.03)",
                      border: `2px solid ${slot.title ? activeUser.color+"66" : "rgba(255,255,255,0.07)"}`,
                      borderRadius: 10, padding: "18px", cursor: "pointer",
                      animation: `fadeIn 0.3s ease ${i*0.04}s both`, minHeight: 150, position: "relative",
                      display: "flex", flexDirection: "column", boxShadow: slot.title ? `0 4px 20px ${activeUser.color}22` : "none" }}
                    onClick={() => openEdit(activeUser.id, i)}>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: 3, color: "rgba(244,196,48,0.25)", textTransform: "uppercase", marginBottom: 12 }}>Slot {String(i+1).padStart(2,"0")}</div>
                    {slot.title ? (
                      <>
                        <div style={{ fontFamily: "'Cinzel', serif", fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 6, lineHeight: 1.3, flex: 1, letterSpacing: "0.02em" }}>{slot.title}</div>
                        {slot.rating > 0 && <StarRating value={slot.rating} size={15} />}
                        {slot.genre && <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: activeUser.color, marginTop: 8, letterSpacing: 2, textTransform: "uppercase", fontWeight: 600 }}>{slot.genre}</div>}
                        {slot.description && <p style={{ fontFamily: "'Lora', serif", fontStyle: "italic", fontSize: 12, color: "rgba(240,232,208,0.4)", marginTop: 8, lineHeight: 1.6 }}>"{slot.description.length > 70 ? slot.description.slice(0,70)+"…" : slot.description}"</p>}
                        {totalVotesOn(slot) > 0 && (
                          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                            {REACTIONS.map(r => { const count = (slot.votes?.[r.key]||[]).length; if (!count) return null;
                              const names = (slot.votes?.[r.key]||[]).map(id => users.find(u=>u.id===id)?.name||"?").join(", ");
                              return <span key={r.key} title={`${r.label}: ${names}`} style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: "rgba(244,196,48,0.6)", display:"flex", alignItems:"center", gap:4 }}>{r.emoji} <strong style={{ color: "#F4C430" }}>{count}</strong></span>; })}
                          </div>
                        )}
                        <button className="clrbtn" onClick={e => { e.stopPropagation(); clearSlot(activeUser.id, i); }}
                          style={{ position: "absolute", top: 12, right: 12, background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.2)", fontFamily: "'DM Mono', monospace", fontSize: 9, padding: "3px 8px", borderRadius: 4, cursor: "pointer", transition: "color 0.2s, border-color 0.2s", letterSpacing: 1 }}>clear</button>
                      </>
                    ) : (
                      <div className="add-hint" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", opacity: 0.25, transition: "opacity 0.2s" }}>
                        <div style={{ fontSize: 32, marginBottom: 8, color: activeUser.color }}>🎬</div>
                        <div style={{ fontFamily: "'Cinzel', serif", fontSize: 11, letterSpacing: 3, textTransform: "uppercase", color: "rgba(255,255,255,0.4)" }}>Add a Pick</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>

        {/* ══ EDIT MODAL ══ */}
        {editTarget !== null && (
          <Modal onClose={() => setEditTarget(null)}>
            <div style={{ background: "linear-gradient(145deg, #1a0a2e 0%, #0e0618 100%)",
              border: `2px solid ${activeUser.color}66`, borderRadius: 14, padding: 36, width: "100%", maxWidth: 500,
              animation: "slideUp 0.22s ease", boxShadow: `0 30px 80px rgba(0,0,0,0.8), 0 0 0 1px ${activeUser.color}33` }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: 4, color: activeUser.color, textTransform: "uppercase", marginBottom: 10, opacity: 0.8 }}>{form.title ? "Edit Pick" : "New Pick"}</div>
              <div style={{ fontFamily: "'Cinzel Decorative', cursive", fontSize: 22, color: "#fff", marginBottom: 28, letterSpacing: "0.05em" }}>{form.title || "Add a Movie"}</div>
              <label style={{ display: "block", marginBottom: 18 }}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: 3, color: "rgba(244,196,48,0.6)", textTransform: "uppercase", marginBottom: 8 }}>Movie Title *</div>
                <input autoFocus value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} onKeyDown={e => e.key === "Enter" && saveEdit()} placeholder="e.g. Cinema Paradiso"
                  style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: `2px solid ${form.title ? activeUser.color : "rgba(255,255,255,0.1)"}`, color: "#fff", fontFamily: "'Cinzel', serif", fontSize: 18, fontWeight: 600, padding: "12px 16px", borderRadius: 8, transition: "border-color 0.2s", letterSpacing: "0.04em" }} />
              </label>
              <label style={{ display: "block", marginBottom: 18 }}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: 3, color: "rgba(244,196,48,0.6)", textTransform: "uppercase", marginBottom: 8 }}>Genre</div>
                <select value={form.genre} onChange={e => setForm(f => ({ ...f, genre: e.target.value }))}
                  style={{ width: "100%", background: "#1a0a2e", border: "2px solid rgba(255,255,255,0.1)", color: form.genre ? "#f0e8d0" : "rgba(240,232,208,0.35)", fontFamily: "'DM Mono', monospace", fontSize: 13, padding: "11px 16px", borderRadius: 8 }}>
                  <option value="">Select genre…</option>
                  {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </label>
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: 3, color: "rgba(244,196,48,0.6)", textTransform: "uppercase", marginBottom: 10 }}>Your Rating</div>
                <StarRating value={form.rating} onChange={r => setForm(f => ({ ...f, rating: r }))} size={24} />
              </div>
              <label style={{ display: "block", marginBottom: 28 }}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: 3, color: "rgba(244,196,48,0.6)", textTransform: "uppercase", marginBottom: 8 }}>Why you love it</div>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="A short note about this film…" rows={3}
                  style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "2px solid rgba(255,255,255,0.1)", color: "#f0e8d0", fontFamily: "'Lora', serif", fontStyle: "italic", fontSize: 14, padding: "12px 16px", borderRadius: 8, resize: "vertical", lineHeight: 1.7 }} />
              </label>
              <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                <button onClick={() => setEditTarget(null)} style={{ padding: "11px 24px", border: "1px solid rgba(255,255,255,0.15)", background: "transparent", color: "rgba(240,232,208,0.5)", fontFamily: "'Cinzel', serif", fontSize: 12, letterSpacing: 2, borderRadius: 6, cursor: "pointer" }}>Cancel</button>
                <button onClick={saveEdit} disabled={!form.title.trim()} style={{ padding: "11px 28px", border: "none", background: form.title.trim() ? `linear-gradient(135deg, #F4C430 0%, #C8960C 100%)` : "rgba(255,255,255,0.1)", color: form.title.trim() ? "#0D0208" : "rgba(255,255,255,0.2)", fontFamily: "'Cinzel', serif", fontSize: 12, letterSpacing: 2, fontWeight: 700, borderRadius: 6, cursor: form.title.trim() ? "pointer" : "default", transition: "opacity 0.2s", boxShadow: form.title.trim() ? "0 4px 16px rgba(244,196,48,0.4)" : "none" }}>Save Pick</button>
              </div>
            </div>
          </Modal>
        )}

        {/* ══ RENAME MODAL ══ */}
        {renamingUser !== null && (
          <Modal onClose={() => setRenamingUser(null)}>
            <div style={{ background: "linear-gradient(145deg, #1a0a2e 0%, #0e0618 100%)", border: "1px solid rgba(244,196,48,0.3)", borderRadius: 14, padding: 30, width: "100%", maxWidth: 380, animation: "slideUp 0.2s ease", boxShadow: "0 30px 80px rgba(0,0,0,0.8)" }}>
              <div style={{ fontFamily: "'Cinzel Decorative', cursive", fontSize: 20, color: "#F4C430", marginBottom: 20 }}>Rename Member</div>
              <input autoFocus value={renameVal} onChange={e => setRenameVal(e.target.value)} onKeyDown={e => { if (e.key==="Enter") saveRename(); if (e.key==="Escape") setRenamingUser(null); }}
                style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "2px solid rgba(244,196,48,0.3)", color: "#fff", fontFamily: "'Cinzel', serif", fontSize: 16, padding: "12px 16px", borderRadius: 8, marginBottom: 18, letterSpacing: 2 }} />
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button onClick={() => setRenamingUser(null)} style={{ padding: "10px 20px", border: "1px solid rgba(255,255,255,0.15)", background: "transparent", color: "rgba(240,232,208,0.5)", fontFamily: "'Cinzel', serif", fontSize: 11, letterSpacing: 2, borderRadius: 6, cursor: "pointer" }}>Cancel</button>
                <button onClick={saveRename} style={{ padding: "10px 22px", border: "none", background: "linear-gradient(135deg, #F4C430 0%, #C8960C 100%)", color: "#0D0208", fontFamily: "'Cinzel', serif", fontSize: 11, fontWeight: 700, letterSpacing: 2, borderRadius: 6, cursor: "pointer" }}>Rename</button>
              </div>
            </div>
          </Modal>
        )}

        {/* ══ TOAST ══ */}
        {toast && (
          <div style={{ position: "fixed", bottom: 28, right: 28, background: "linear-gradient(135deg, #1a0a2e 0%, #0e0618 100%)", border: "1px solid rgba(244,196,48,0.4)", color: "#F4C430", fontFamily: "'Cinzel', serif", fontSize: 13, letterSpacing: 2, padding: "14px 24px", borderRadius: 8, animation: "toastIn 0.2s ease", boxShadow: "0 8px 32px rgba(0,0,0,0.6), 0 0 20px rgba(244,196,48,0.15)", zIndex: 200 }}>
            {toast}
          </div>
        )}

      </div>
    </>
  );
}
