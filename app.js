/* Arsenal Home Games — Ticket Tracker
   Plain JS + Supabase (no build step). See README.md for setup. */

(function () {
  "use strict";

  const cfg = window.APP_CONFIG || {};
  const notConfigured =
    !cfg.SUPABASE_URL ||
    !cfg.SUPABASE_ANON_KEY ||
    cfg.SUPABASE_URL.includes("YOUR-PROJECT-REF") ||
    cfg.SUPABASE_ANON_KEY.includes("YOUR-ANON-PUBLIC-KEY");

  const els = {
    setupBanner: document.getElementById("setupBanner"),
    matchList: document.getElementById("matchList"),
    tabs: document.getElementById("tabs"),
    addMatchBtn: document.getElementById("addMatchBtn"),
    overlay: document.getElementById("matchOverlay"),
    form: document.getElementById("matchForm"),
    modalTitle: document.getElementById("matchModalTitle"),
    cancelMatchBtn: document.getElementById("cancelMatchBtn"),
    toast: document.getElementById("toast"),
    themeToggle: document.getElementById("themeToggle"),
    searchInput: document.getElementById("searchInput"),
    searchClear: document.getElementById("searchClear"),
    statUpcoming: document.getElementById("statUpcoming"),
    statOpenRequests: document.getElementById("statOpenRequests"),
    statUsedSeason: document.getElementById("statUsedSeason"),
    statNext: document.getElementById("statNext"),
    tallyCard: document.getElementById("tallyCard"),
    tallyRow: document.getElementById("tallyRow"),
  };

  if (notConfigured) {
    els.setupBanner.hidden = false;
    els.matchList.innerHTML =
      '<div class="empty-state">Connect the app to Supabase (see the banner above) to get started.</div>';
    return;
  }

  const supabase = window.supabase.createClient(
    cfg.SUPABASE_URL,
    cfg.SUPABASE_ANON_KEY
  );

  let people = [];
  let matches = [];
  let statuses = []; // ticket_status rows
  let activeTab = "upcoming";
  let searchQuery = "";
  let toastTimer = null;

  // ---------- theme ----------
  const savedTheme = localStorage.getItem("arsenal-tracker-theme");
  if (savedTheme) document.documentElement.setAttribute("data-theme", savedTheme);
  els.themeToggle.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme");
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("arsenal-tracker-theme", next);
  });

  // ---------- toast ----------
  function toast(msg) {
    els.toast.textContent = msg;
    els.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove("show"), 2200);
  }

  // ---------- data loading ----------
  async function loadAll() {
    const [{ data: p, error: pErr }, { data: m, error: mErr }, { data: s, error: sErr }] =
      await Promise.all([
        supabase.from("people").select("*").order("sort_order"),
        supabase.from("matches").select("*").order("kickoff"),
        supabase.from("ticket_status").select("*"),
      ]);
    if (pErr || mErr || sErr) {
      console.error(pErr || mErr || sErr);
      toast("Couldn't load data — check your Supabase setup.");
      return;
    }
    people = p || [];
    matches = m || [];
    statuses = s || [];
    render();
  }

  function statusFor(matchId, personId) {
    return (
      statuses.find((s) => s.match_id === matchId && s.person_id === personId) ||
      { match_id: matchId, person_id: personId, requested: false, requested_qty: 1, used: false, declined: false }
    );
  }

  async function upsertStatus(matchId, personId, patch) {
    const existing = statusFor(matchId, personId);
    const payload = {
      match_id: matchId,
      person_id: personId,
      requested: existing.requested,
      requested_qty: existing.requested_qty || 1,
      used: existing.used,
      declined: existing.declined || false,
      ...patch,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase
      .from("ticket_status")
      .upsert(payload, { onConflict: "match_id,person_id" });
    if (error) {
      console.error(error);
      toast("Update failed — try again.");
      return;
    }
    // optimistic local update, full refresh follows via realtime/loadAll
    const idx = statuses.findIndex((s) => s.match_id === matchId && s.person_id === personId);
    if (idx >= 0) statuses[idx] = { ...statuses[idx], ...payload };
    else statuses.push(payload);
    render();
  }

  // ---------- helpers ----------
  function fmtDate(d) {
    return d.toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }
  function fmtTime(d) {
    const h = d.getHours(),
      m = d.getMinutes();
    if (h === 0 && m === 0) return null;
    return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  }
  function daysUntil(d) {
    const now = new Date();
    const a = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const b = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    return Math.round((b - a) / 86400000);
  }
  function countdownLabel(days) {
    if (days === 0) return "Today";
    if (days === 1) return "Tomorrow";
    if (days > 1) return `In ${days} days`;
    if (days === -1) return "Yesterday";
    return `${Math.abs(days)} days ago`;
  }

  // ---------- rendering ----------
  function render() {
    renderStats();
    renderTally();
    renderMatchList();
  }

  function renderTally() {
    if (!people.length) {
      els.tallyCard.hidden = true;
      return;
    }
    els.tallyCard.hidden = false;
    els.tallyRow.innerHTML = people
      .map((person) => {
        const used = statuses
          .filter((s) => s.person_id === person.id && s.used)
          .reduce((sum, s) => sum + (s.requested_qty || 1), 0);
        return `
          <div class="tally-person">
            <div class="n">${used}</div>
            <div class="l">${escapeHtml(person.name)}</div>
          </div>`;
      })
      .join("");
  }

  function renderStats() {
    const now = new Date();
    const upcoming = matches.filter((m) => new Date(m.kickoff) >= now);
    const openRequests = statuses.filter((s) => s.requested && !s.used).length;
    const usedSeason = statuses.reduce((sum, s) => sum + (s.used ? s.requested_qty || 1 : 0), 0);
    els.statUpcoming.textContent = upcoming.length;
    els.statOpenRequests.textContent = openRequests;
    els.statUsedSeason.textContent = usedSeason;
    if (upcoming.length) {
      const next = upcoming.slice().sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff))[0];
      els.statNext.textContent = next.opponent;
      els.statNext.title = fmtDate(new Date(next.kickoff));
    } else {
      els.statNext.textContent = "—";
    }
  }

  function matchesSearch(m) {
    if (!searchQuery) return true;
    const haystack = `${m.opponent} ${m.competition} ${m.notes || ""}`.toLowerCase();
    return haystack.includes(searchQuery);
  }

  function renderMatchList() {
    const now = new Date();
    let list = matches.slice().sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff));
    if (activeTab === "upcoming") {
      list = list.filter((m) => new Date(m.kickoff) >= now);
    } else if (activeTab === "past") {
      list = list.filter((m) => new Date(m.kickoff) < now).reverse();
    }

    const filtered = list.filter(matchesSearch);

    if (!filtered.length) {
      if (searchQuery) {
        // Nothing in the current tab matched — if it exists in another tab,
        // offer a one-tap way to widen the search instead of a dead end.
        const existsElsewhere = activeTab !== "all" && matches.some(matchesSearch);
        els.matchList.innerHTML = `
          <div class="empty-state">
            No games match “${escapeHtml(els.searchInput.value.trim())}”${
          activeTab === "all" ? "" : ` in ${activeTab}`
        }.
            ${
              existsElsewhere
                ? `<br><button class="mini-btn outline-critical search-all-btn" id="searchAllBtn">Search all games instead</button>`
                : ""
            }
          </div>`;
        const searchAllBtn = document.getElementById("searchAllBtn");
        if (searchAllBtn) {
          searchAllBtn.addEventListener("click", () => {
            activeTab = "all";
            els.tabs
              .querySelectorAll("button")
              .forEach((b) => b.classList.toggle("active", b.dataset.tab === "all"));
            renderMatchList();
          });
        }
        return;
      }
      els.matchList.innerHTML = `<div class="empty-state">No ${
        activeTab === "all" ? "" : activeTab
      } games yet. Tap “+ Add game” to add one.</div>`;
      return;
    }

    els.matchList.innerHTML = filtered.map((m) => matchCardHtml(m, now, searchQuery)).join("");
    attachCardHandlers();
  }

  function matchCardHtml(m, now, query) {
    const d = new Date(m.kickoff);
    const isPast = d < now;
    const days = daysUntil(d);
    const time = fmtTime(d);

    const peopleRows = people
      .map((person) => {
        const st = statusFor(m.id, person.id);
        let pillClass = "none",
          pillLabel = "Not requested";
        if (st.used) {
          pillClass = "used";
          pillLabel = "✓ Used";
        } else if (st.declined) {
          pillClass = "declined";
          pillLabel = "Can't make it";
        } else if (st.requested) {
          pillClass = "requested";
          pillLabel = "Requested";
        }

        let actions = "";
        if (st.declined) {
          actions = `<button class="mini-btn ghost" data-action="undo-decline" data-match="${m.id}" data-person="${person.id}">I can make it after all</button>`;
        } else if (!st.requested && !st.used) {
          actions = `
            <button class="mini-btn primary" data-action="request" data-match="${m.id}" data-person="${person.id}">Request ticket</button>
            <button class="mini-btn outline-critical" data-action="decline" data-match="${m.id}" data-person="${person.id}">Can't make it</button>`;
        } else if (st.requested && !st.used) {
          actions = `
            <div class="qty-stepper">
              <button data-action="qty-dec" data-match="${m.id}" data-person="${person.id}" ${
            (st.requested_qty || 1) <= 1 ? "disabled" : ""
          }>–</button>
              <span class="n">${st.requested_qty || 1}</span>
              <button data-action="qty-inc" data-match="${m.id}" data-person="${person.id}">+</button>
            </div>
            <button class="mini-btn good" data-action="confirm-used" data-match="${m.id}" data-person="${person.id}">Confirm used</button>
            <button class="mini-btn ghost" data-action="cancel-request" data-match="${m.id}" data-person="${person.id}">Cancel</button>`;
        } else if (st.used) {
          actions = `
            <div class="qty-stepper">
              <button data-action="qty-dec" data-match="${m.id}" data-person="${person.id}" ${
            (st.requested_qty || 1) <= 1 ? "disabled" : ""
          }>–</button>
              <span class="n">${st.requested_qty || 1}</span>
              <button data-action="qty-inc" data-match="${m.id}" data-person="${person.id}">+</button>
            </div>
            <button class="mini-btn ghost" data-action="undo-used" data-match="${m.id}" data-person="${person.id}">Undo</button>`;
        }

        return `
          <div class="person-row">
            <span class="name">${person.name}${
          !person.is_regular ? '<span class="tag">spare</span>' : ""
        }</span>
            <div class="person-actions">
              <span class="status-pill ${pillClass}">${pillLabel}</span>
              ${actions}
            </div>
          </div>`;
      })
      .join("");

    return `
      <div class="match-card" data-match-id="${m.id}">
        <div class="row-top">
          <div>
            <h3>Arsenal vs ${highlightMatch(m.opponent, query)}</h3>
            <div class="match-meta">
              <span class="badge">${highlightMatch(m.competition, query)}</span>
              <span>${fmtDate(d)}${time ? " · " + time : ""}</span>
              <span class="badge ${isPast ? "past" : "countdown"}">${countdownLabel(days)}</span>
            </div>
          </div>
          <div class="card-actions">
            <button title="Edit" data-action="edit-match" data-match="${m.id}">✎</button>
            <button title="Delete" data-action="delete-match" data-match="${m.id}">🗑</button>
          </div>
        </div>
        <div class="people-grid">${peopleRows}</div>
        <div class="match-notes">
          <label class="match-notes-label" for="notes-${m.id}">Notes</label>
          <textarea
            id="notes-${m.id}"
            class="match-notes-input"
            data-action="match-notes"
            data-match="${m.id}"
            placeholder="e.g. Barry couldn't make it, sold his ticket to Dave"
          >${escapeHtml(m.notes || "")}</textarea>
        </div>
      </div>`;
  }

  function escapeHtml(str) {
    return String(str || "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[c]));
  }

  function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  // Escapes first, then wraps the matched substring in <mark> — safe against
  // the search query itself containing HTML-ish characters.
  function highlightMatch(str, query) {
    const safe = escapeHtml(str);
    if (!query) return safe;
    const re = new RegExp(escapeRegExp(escapeHtml(query)), "ig");
    return safe.replace(re, (hit) => `<mark>${hit}</mark>`);
  }

  function attachCardHandlers() {
    els.matchList.querySelectorAll("button[data-action]").forEach((btn) => {
      btn.addEventListener("click", onCardAction);
    });
    els.matchList.querySelectorAll('textarea[data-action="match-notes"]').forEach((ta) => {
      ta.addEventListener("blur", onMatchNotesBlur);
      // Cmd/Ctrl+Enter saves and closes the keyboard without needing to tap away.
      ta.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          ta.blur();
        }
      });
    });
  }

  async function onMatchNotesBlur(e) {
    const ta = e.currentTarget;
    const matchId = Number(ta.dataset.match);
    const notes = ta.value.trim();
    const match = matches.find((m) => m.id === matchId);
    if (!match || match.notes === notes) return; // unchanged, skip the write
    const { error } = await supabase.from("matches").update({ notes }).eq("id", matchId);
    if (error) {
      console.error(error);
      toast("Note failed to save — try again");
      return;
    }
    match.notes = notes;
    toast("Note saved");
  }

  async function onCardAction(e) {
    const btn = e.currentTarget;
    const action = btn.dataset.action;
    const matchId = Number(btn.dataset.match);
    const personId = btn.dataset.person ? Number(btn.dataset.person) : null;

    if (action === "request") {
      await upsertStatus(matchId, personId, { requested: true, requested_qty: 1, used: false, declined: false });
      toast("Ticket requested");
    } else if (action === "cancel-request") {
      await upsertStatus(matchId, personId, { requested: false, requested_qty: 1, used: false });
      toast("Request cancelled");
    } else if (action === "decline") {
      await upsertStatus(matchId, personId, {
        declined: true,
        requested: false,
        requested_qty: 1,
        used: false,
      });
      toast("Marked as can't make it");
    } else if (action === "undo-decline") {
      await upsertStatus(matchId, personId, { declined: false });
    } else if (action === "confirm-used") {
      await upsertStatus(matchId, personId, { used: true });
      toast("Marked as used ✓");
    } else if (action === "undo-used") {
      await upsertStatus(matchId, personId, { used: false });
    } else if (action === "qty-inc") {
      const st = statusFor(matchId, personId);
      await upsertStatus(matchId, personId, { requested_qty: Math.min(4, (st.requested_qty || 1) + 1) });
    } else if (action === "qty-dec") {
      const st = statusFor(matchId, personId);
      await upsertStatus(matchId, personId, { requested_qty: Math.max(1, (st.requested_qty || 1) - 1) });
    } else if (action === "edit-match") {
      openMatchModal(matches.find((m) => m.id === matchId));
    } else if (action === "delete-match") {
      if (confirm("Delete this game? This also removes everyone's ticket status for it.")) {
        const { error } = await supabase.from("matches").delete().eq("id", matchId);
        if (error) {
          toast("Delete failed");
        } else {
          matches = matches.filter((m) => m.id !== matchId);
          statuses = statuses.filter((s) => s.match_id !== matchId);
          render();
          toast("Game deleted");
        }
      }
    }
  }

  // ---------- tabs ----------
  els.tabs.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-tab]");
    if (!btn) return;
    activeTab = btn.dataset.tab;
    els.tabs.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b === btn));
    renderMatchList();
  });

  // ---------- search ----------
  function updateSearchClearVisibility() {
    els.searchClear.hidden = !els.searchInput.value;
  }
  els.searchInput.addEventListener("input", () => {
    searchQuery = els.searchInput.value.trim().toLowerCase();
    updateSearchClearVisibility();
    renderMatchList();
  });
  els.searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && els.searchInput.value) {
      e.preventDefault();
      els.searchInput.value = "";
      searchQuery = "";
      updateSearchClearVisibility();
      renderMatchList();
    }
  });
  els.searchClear.addEventListener("click", () => {
    els.searchInput.value = "";
    searchQuery = "";
    updateSearchClearVisibility();
    renderMatchList();
    els.searchInput.focus();
  });

  // ---------- add / edit modal ----------
  function openMatchModal(match) {
    els.form.reset();
    document.getElementById("matchId").value = match ? match.id : "";
    els.modalTitle.textContent = match ? "Edit game" : "Add a home game";
    if (match) {
      const d = new Date(match.kickoff);
      document.getElementById("opponent").value = match.opponent;
      document.getElementById("competition").value = match.competition;
      document.getElementById("kickoffDate").value = toDateInputValue(d);
      const t = fmtTime24(d);
      document.getElementById("kickoffTime").value = t;
      document.getElementById("notes").value = match.notes || "";
    }
    els.overlay.hidden = false;
    document.getElementById("opponent").focus();
  }
  function toDateInputValue(d) {
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  function fmtTime24(d) {
    if (d.getHours() === 0 && d.getMinutes() === 0) return "";
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function closeModal() {
    els.overlay.hidden = true;
  }

  els.addMatchBtn.addEventListener("click", () => openMatchModal(null));
  els.cancelMatchBtn.addEventListener("click", closeModal);
  els.overlay.addEventListener("click", (e) => {
    if (e.target === els.overlay) closeModal();
  });

  els.form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.getElementById("matchId").value;
    const opponent = document.getElementById("opponent").value.trim();
    const competition = document.getElementById("competition").value;
    const date = document.getElementById("kickoffDate").value;
    const time = document.getElementById("kickoffTime").value || "15:00";
    const notes = document.getElementById("notes").value.trim();
    if (!opponent || !date) return;

    const kickoff = new Date(`${date}T${time}:00`).toISOString();
    const payload = { opponent, competition, kickoff, notes };

    let error;
    if (id) {
      ({ error } = await supabase.from("matches").update(payload).eq("id", Number(id)));
    } else {
      ({ error } = await supabase.from("matches").insert(payload));
    }
    if (error) {
      console.error(error);
      toast("Couldn't save game");
      return;
    }
    closeModal();
    toast(id ? "Game updated" : "Game added");
    await loadAll();
  });

  // ---------- realtime ----------
  supabase
    .channel("ticket-tracker-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, loadAll)
    .on("postgres_changes", { event: "*", schema: "public", table: "ticket_status" }, loadAll)
    .subscribe();

  // ---------- init ----------
  loadAll();
})();
