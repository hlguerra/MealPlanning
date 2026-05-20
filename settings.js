// ── js/screens/settings.js ────────────────────────────────────────────────────
window.APP = window.APP || {};
const { createElement: h, useState } = React;
const { Btn, Card, Input, PillToggle, SectionHeader } = window.APP;
const { fmt$ } = window.APP.utils;
const { MEAL_TYPES, MEAL_ICONS, PROTEINS, APPLIANCES } = window.APP;

// ── SettingsScreen ────────────────────────────────────────────────────────────
window.APP.SettingsScreen = function({ settings, saveSettings, myAppliances, setMyAppliances, costTotal, requestPin, showBanner }) {
  const [form,    setForm]    = useState({ ...settings });
  const [saved,   setSaved]   = useState(false);
  const [newPin1, setNewPin1] = useState("");
  const [newPin2, setNewPin2] = useState("");
  const [pinMsg,  setPinMsg]  = useState("");

  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const toggleDefMealType = t => upd("defaultMealTypes",
    (form.defaultMealTypes || []).includes(t)
      ? form.defaultMealTypes.filter(x => x !== t)
      : [...(form.defaultMealTypes || []), t]
  );

  const toggleDefProtein = p => upd("defaultProteins",
    (form.defaultProteins || []).includes(p)
      ? form.defaultProteins.filter(x => x !== p)
      : [...(form.defaultProteins || []), p]
  );

  const toggleAppliance = a =>
    setMyAppliances(ap => ap.includes(a) ? ap.filter(x => x !== a) : [...ap, a]);

  const saveAll = () => {
    saveSettings(form);
    setSaved(true);
    showBanner("✓ Settings saved", "success");
    setTimeout(() => setSaved(false), 1800);
  };

  // PIN change requires the current PIN first
  const handleChangePin = () => {
    if (!newPin1 || newPin1 !== newPin2) { setPinMsg("PINs don't match."); return; }
    if (newPin1.length < 4)              { setPinMsg("PIN must be at least 4 digits."); return; }

    requestPin(() => {
      const updated = { ...form, pin: newPin1 };
      setForm(updated);
      saveSettings(updated);
      setNewPin1(""); setNewPin2("");
      setPinMsg("✓ PIN updated!");
      setTimeout(() => setPinMsg(""), 2500);
    });
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return h("div", null,
    h(SectionHeader, { title: "Settings" }),

    // ── Household ─────────────────────────────────────────────────────────────
    h(Card, { style: { marginBottom: 16 } },
      h("div", { className: "font-bold font-serif mb-12", style: { fontSize: 15 } }, "🏠 Household"),
      h(Input, { label: "Household / Family Name", value: form.householdName, onChange: v => upd("householdName", v), placeholder: "e.g. Haley's Meal Planning" }),
      h(Input, { label: "Default # of People", type: "number", value: form.people, onChange: v => upd("people", Math.max(1, +v)) }),
      h(Input, { label: "Default Zip Code (price comparisons)", value: form.zipCode || "", onChange: v => upd("zipCode", v), placeholder: "e.g. 44691" }),
    ),

    // ── Meal planning defaults ─────────────────────────────────────────────────
    h(Card, { style: { marginBottom: 16 } },
      h("div", { className: "font-bold font-serif mb-12", style: { fontSize: 15 } }, "🗓 Meal Planning Defaults"),

      h("div", { style: { marginBottom: 14 } },
        h("div", { className: "form-label" }, "Default Meal Types"),
        h("div", { className: "flex gap-8" },
          MEAL_TYPES.map(t => {
            const on = (form.defaultMealTypes || []).includes(t);
            return h("button", {
              key: t, type: "button",
              className: `meal-type-btn ${on ? "active" : ""}`,
              onClick: () => toggleDefMealType(t),
            },
              h("span", { className: "meal-type-icon" }, MEAL_ICONS[t]),
              t,
            );
          }),
        ),
      ),

      h("div", null,
        h("div", { className: "form-label" }, "Default Proteins ",
          h("span", { className: "muted", style: { fontWeight: 400, fontSize: 11 } }, "(blank = any)"),
        ),
        h(PillToggle, {
          options: PROTEINS,
          selected: form.defaultProteins || [],
          onToggle: toggleDefProtein,
        }),
      ),
    ),

    // ── Appliances ────────────────────────────────────────────────────────────
    h(Card, { style: { marginBottom: 16 } },
      h("div", { className: "font-bold font-serif", style: { fontSize: 15, marginBottom: 4 } }, "🍳 My Appliances"),
      h("div", { className: "muted text-sm", style: { marginBottom: 14 } }, "The AI meal planner will prefer meals using these. Check what you own."),
      APPLIANCES.map(a =>
        h("label", { key: a, className: "appliance-row" },
          h("input", {
            type: "checkbox",
            checked: myAppliances.includes(a),
            onChange: () => toggleAppliance(a),
          }),
          h("span", { style: { fontSize: 14 } }, a),
        )
      ),
    ),

    // ── API cost (rolling 30 days) ─────────────────────────────────────────────
    h(Card, { style: { marginBottom: 16 } },
      h("div", { className: "font-bold font-serif mb-12", style: { fontSize: 15 } }, "💳 API Usage (Rolling 30 Days)"),
      h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", background: "#FFF8F0", borderRadius: 12 } },
        h("div", { className: "muted font-bold", style: { fontSize: 14 } }, "Estimated usage"),
        h("div", { className: "font-bold", style: { fontSize: 24, color: costTotal > 8 ? "#C0392B" : "#2A7D4F" } }, fmt$(costTotal)),
      ),
      costTotal > 8 && h("div", { className: "cost-warning" }, "⚠️ Approaching your expected limit. Check your Anthropic dashboard."),
      h("div", { className: "muted text-xs", style: { marginTop: 10 } }, "Estimates based on typical token usage per feature. Actual charges may vary slightly."),
    ),

    // ── Google Sheets sync ────────────────────────────────────────────────────
    h(Card, { style: { marginBottom: 16 } },
      h("div", { className: "font-bold font-serif mb-12", style: { fontSize: 15 } }, "📊 Google Sheets Sync"),
      h(Input, {
        label: "Shared Grocery List Sheet URL",
        value: form.googleSheetsUrl || "",
        onChange: v => upd("googleSheetsUrl", v),
        placeholder: "https://docs.google.com/spreadsheets/…",
      }),
      h("div", { className: "muted text-xs" }, "Paste your shared Sheet URL here. Full setup (grocery sync + API cost log) coming in Phase 2."),
    ),

    // ── Change PIN ────────────────────────────────────────────────────────────
    h(Card, { style: { marginBottom: 16 } },
      h("div", { className: "font-bold font-serif mb-12", style: { fontSize: 15 } }, "🔐 Change PIN"),
      h(Input, { label: "New PIN",         type: "password", value: newPin1, onChange: setNewPin1, placeholder: "New PIN (min 4 digits)" }),
      h(Input, { label: "Confirm New PIN", type: "password", value: newPin2, onChange: setNewPin2, placeholder: "Repeat new PIN" }),
      pinMsg && h("div", {
        className: pinMsg.startsWith("✓") ? "accent text-sm" : "warn text-sm",
        style: { marginBottom: 8 },
      }, pinMsg),
      h(Btn, { label: "Update PIN", variant: "ghost", onClick: handleChangePin }),
      h("div", { className: "muted text-xs", style: { marginTop: 8 } }, "You will be asked to confirm your current PIN before the change is applied."),
    ),

    // ── Save button ───────────────────────────────────────────────────────────
    h(Btn, {
      label: saved ? "✓ Saved!" : "Save Settings",
      onClick: saveAll,
      style: {
        width: "100%",
        background: saved ? "#2A7D4F" : "#D4622A",
        color: "#fff",
        border: "none",
        marginBottom: 8,
        justifyContent: "center",
      },
    }),
  );
};
