// ── js/screens/vote.js ────────────────────────────────────────────────────────
// This Week's Picks: each person votes 👍 / ➖ / 👎 on this week's 20 recipes.
// The 📖 My Recipes generator on the Meal Plan screen builds from these votes.
window.APP = window.APP || {};
const { createElement: h } = React;
const { Btn, Card, SectionHeader, EmptyState } = window.APP;

const VOTE_OPTIONS = [
  { value: "up",      icon: "👍", label: "Yes" },
  { value: "neutral", icon: "➖", label: "Either way" },
  { value: "down",    icon: "👎", label: "No" },
];

// ── VoteScreen ────────────────────────────────────────────────────────────────
window.APP.VoteScreen = function({ weeklyVotes, setWeeklyVotes, recipes, settings, voterName, setVoterName, onNav, onGenerate }) {
  const { votersFrom, voteProgress } = window.APP.voting;
  const voters = votersFrom(settings);
  const me     = voters.includes(voterName) ? voterName : null;
  const others = voters.filter(v => v !== me);

  const picks = (weeklyVotes?.recipeIds || []).map(id => recipes.find(r => r.id === id)).filter(Boolean);
  const progress = voteProgress(weeklyVotes, voters);
  const weekLabel = weeklyVotes?.weekKey
    ? new Date(`${weeklyVotes.weekKey}T00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : "";

  // Tapping your current vote again clears it
  const setVote = (recipeId, value) => setWeeklyVotes(w => {
    const forRecipe = { ...(w.votes?.[recipeId] || {}) };
    if (forRecipe[me] === value) delete forRecipe[me];
    else forRecipe[me] = value;
    return { ...w, votes: { ...(w.votes || {}), [recipeId]: forRecipe } };
  });

  const generateBtn = h(Btn, {
    label: "Generate Meal Plan from Picks",
    icon: "✨",
    onClick: onGenerate,
    className: "btn-full",
  });

  return h("div", null,
    h(SectionHeader, {
      title: "This Week's Picks",
      action: h(Btn, { label: "← Meal Plan", variant: "ghost", onClick: () => onNav("plan"), className: "btn-sm" }),
    }),
    weekLabel && h("div", { className: "muted text-sm", style: { marginTop: -8, marginBottom: 14 } }, `Week of ${weekLabel}`),

    !picks.length && h(EmptyState, {
      icon: "🗳",
      title: "No picks this week",
      sub: "Save some dinner recipes and this week's picks will show up here.",
    }),

    // ── Who's voting? (asked once per device) ────────────────────────────────
    picks.length > 0 && !me && h(Card, { style: { marginBottom: 16, textAlign: "center" } },
      h("div", { className: "font-bold font-serif mb-12", style: { fontSize: 16 } }, "Who's voting?"),
      h("div", { className: "flex gap-10" },
        voters.map(v => h(Btn, { key: v, label: v, onClick: () => setVoterName(v), style: { flex: 1, padding: "14px 0", fontSize: 16 } })),
      ),
      h("div", { className: "muted text-xs", style: { marginTop: 10 } }, "This device will remember. Names can be changed in Settings."),
    ),

    picks.length > 0 && me && h(React.Fragment, null,
      // ── Progress ───────────────────────────────────────────────────────────
      h(Card, { style: { marginBottom: 16 } },
        h("div", { className: "flex-between", style: { marginBottom: 10, fontSize: 13 } },
          h("div", null, "Voting as ", h("strong", null, me)),
          h("button", { className: "link-btn", onClick: () => setVoterName(null) }, "not you?"),
        ),
        h("div", { className: "flex gap-8", style: { marginBottom: 12 } },
          progress.map(p => h("div", { key: p.name, className: `vote-progress ${p.count === p.total ? "done" : ""}` },
            h("div", { className: "font-bold" }, p.name),
            h("div", { className: "text-sm" }, p.count === p.total ? "Done ✓" : `${p.count} / ${p.total} voted`),
          )),
        ),
        generateBtn,
        h("div", { className: "muted text-xs", style: { marginTop: 6, textAlign: "center" } },
          "Works even if not everyone has voted — unvoted recipes count as ➖."),
      ),

      // ── Recipes ────────────────────────────────────────────────────────────
      picks.map(r => {
        const votes = weeklyVotes.votes?.[r.id] || {};
        return h(Card, { key: r.id, className: "card-compact", style: { marginBottom: 10 } },
          h("div", { className: "flex-center gap-10" },
            r.photo
              ? h("img", { src: r.photo, alt: "", className: "vote-photo" })
              : h("div", { className: "vote-photo vote-photo-empty" }, "🍴"),
            h("div", { style: { flex: 1, minWidth: 0 } },
              h("div", { className: "font-bold", style: { fontSize: 15 } }, r.name),
              h("div", { className: "muted text-sm" }, (r.proteins || []).join(", ") || "—"),
              // Partner's status only — not which way they voted, so nobody's swayed
              others.length > 0 && h("div", { className: "muted text-xs", style: { marginTop: 2 } },
                others.map(o => `${o}: ${votes[o] ? "voted ✓" : "not yet"}`).join(" · ")),
            ),
          ),
          h("div", { className: "flex gap-8", style: { marginTop: 10 } },
            VOTE_OPTIONS.map(o => h("button", {
              key: o.value,
              type: "button",
              className: `vote-btn vote-${o.value} ${votes[me] === o.value ? "active" : ""}`,
              onClick: () => setVote(r.id, o.value),
              "aria-label": o.label,
              title: o.label,
            }, o.icon)),
          ),
        );
      }),

      h("div", { style: { marginTop: 16, marginBottom: 8 } }, generateBtn),
    ),
  );
};
