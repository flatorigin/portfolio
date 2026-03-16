// =======================================
// file: frontend/src/components/SavedProfilesGrid.jsx
// Dashboard section: Saved Profiles (liked public profiles)
// - 3 columns like Explore
// - show max 6 cards
// - delayed tooltip (1s) shows: name + location + first line of bio
// =======================================
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import { Card } from "../ui";

function toInitial(nameOrUsername) {
  const s = (nameOrUsername || "").trim();
  return s ? s[0].toUpperCase() : "U";
}

function oneLine(s) {
  return (s || "").replace(/\s+/g, " ").trim();
}

export default function SavedProfilesGrid() {
  const authed = !!localStorage.getItem("access");
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState([]);
  const [error, setError] = useState("");

  // tooltip state
  const [tip, setTip] = useState({ open: false, x: 0, y: 0, p: null });
  const timerRef = useRef(null);

  // Always use the correct backend path (accounts URLs are under /api/)
  const API_PATH = "/api/profiles/liked/";

  // Re-fetch when likes change
  useEffect(() => {
    const handler = () => {
      api
        .get(API_PATH)
        .then(({ data }) => {
          setProfiles(Array.isArray(data) ? data : []);
        })
        .catch(() => {
          /* silent */
        });
    };

    window.addEventListener("profiles:liked_changed", handler);
    return () => window.removeEventListener("profiles:liked_changed", handler);
  }, []);

  // Initial load
  useEffect(() => {
    let alive = true;

    if (!authed) {
      setLoading(false);
      setProfiles([]);
      setError("");
      return;
    }

    (async () => {
      setLoading(true);
      setError("");
      try {
        const { data } = await api.get(API_PATH);
        if (!alive) return;
        setProfiles(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!alive) return;
        setProfiles([]);
        setError("Could not load saved profiles.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [authed]);

  const shown = useMemo(() => profiles.slice(0, 6), [profiles]);

  const onEnter = (evt, p) => {
    if (timerRef.current) clearTimeout(timerRef.current);

    const rect = evt.currentTarget.getBoundingClientRect();
    const x = rect.left + rect.width / 2;

    // anchor tooltip above the card
    const y = rect.top;

    timerRef.current = setTimeout(() => {
      setTip({ open: true, x, y, p });
    }, 1000); // ✅ 1s delay
  };

  const onLeave = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setTip({ open: false, x: 0, y: 0, p: null });
  };

  // Put tooltip a bit above the card so it doesn’t overlap it
  const tooltipTop = Math.max(12, tip.y - 140);

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-800">Saved profiles</div>
          <div className="text-xs text-slate-500">People you liked</div>
        </div>
        <div className="text-[11px] text-slate-500">{profiles.length} saved</div>
      </div>

      {loading ? (
        <div className="text-sm text-slate-500">Loading…</div>
      ) : error ? (
        <div className="text-sm text-red-600">{error}</div>
      ) : shown.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
          No saved profiles yet. Like someone’s profile to pin them here.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((p) => {
            const name = p.display_name || p.username || "User";
            const tag = oneLine(p.tag || "");
            const bio = oneLine(p.bio_preview || "");

            return (
              <Link
                key={p.username || p.id}
                to={`/profiles/${p.username}`}
                className="group"
                onMouseEnter={(e) => onEnter(e, p)}
                onMouseLeave={onLeave}
                onFocus={(e) => onEnter(e, p)}
                onBlur={onLeave}
              >
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
                  <div className="flex items-center gap-3 p-4">
                    {p.avatar_url ? (
                      <img
                        src={p.avatar_url}
                        alt={name}
                        className="h-12 w-12 rounded-full object-cover"
                        onError={(e) => {
                          // fallback to initial if image fails
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                        {toInitial(name)}
                      </div>
                    )}

                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-900">
                        {name}
                      </div>

                      {/* small tag under name */}
                      <div className="truncate text-xs text-slate-500">
                        {tag || "—"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tooltip (desktop hover) */}
                {tip.open && tip.p?.username === p.username ? (
                  <div
                    className="fixed z-[80] w-[320px] -translate-x-1/2 rounded-2xl border border-slate-200 bg-white p-3 text-xs text-slate-700 shadow-2xl"
                    style={{ left: tip.x, top: tooltipTop }}
                  >
                    <div className="text-sm font-semibold text-slate-900">{name}</div>
                    {tag ? (
                      <div className="mt-1 text-[11px] text-slate-500">{tag}</div>
                    ) : null}
                    {bio ? (
                      <div className="mt-2 text-[11px] text-slate-700">
                        {bio.length > 80 ? bio.slice(0, 80) + "…" : bio}
                      </div>
                    ) : (
                      <div className="mt-2 text-[11px] text-slate-500">No bio yet.</div>
                    )}
                  </div>
                ) : null}
              </Link>
            );
          })}
        </div>
      )}

      {profiles.length > 6 ? (
        <div className="mt-3 text-[11px] text-slate-500">
          Showing 6 of {profiles.length}. (Pagination/scroll can be added next.)
        </div>
      ) : null}
    </Card>
  );
}