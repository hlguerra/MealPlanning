// ── js/screens/settings.js ────────────────────────────────────────────────────
window.APP = window.APP || {};
const { createElement: h, useState } = React;
const { Btn, Card, Input, PillToggle, SectionHeader } = window.APP;
const { fmt$, generateHouseholdId } = window.APP.utils;
const { MEAL_TYPES, MEAL_ICONS, PROTEINS, APPLIANCES } = window.APP;

// ── SettingsScreen ────────────────────────────────────────────────────────────
window.APP.SettingsScreen = function({ settings, saveSettings, myAppliances, setMyAppliances, costTotal, requestPin, showBanner }) {
  const [form,       setForm]       = useState({ ...settings });
  const [saved,      setSaved]      = useState(false);
  const [newPin1,    setNewPin1]    = useState("");
  const [newPin2,    setNewPin2]    = useState("");
  const [pinMsg,     setPinMsg]     = useState("");
  const [hhLoading,  setHhLoading]  = useState(false);
  const [hhMsg,      setHhMsg]      = useState("");
  const [joinId,     setJoinId]     = useState("");
  const [joinPin,    setJoinPin]    = useState("");
  const [joinMsg,    setJoinMsg]    = useState("");

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

  // ── PIN change ────────────────────────────────────────────────────────────
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

  // ── Create new household ──────────────────────────────────────────────────
  const createHousehold = async () => {
    setHhLoading(true); setHhMsg("");
    try {
      const newId = window.APP.generateHouseholdId();
      await window.APP.firebase.createHousehold(newId, form.householdName || "My Household");
      const updated = { ...form, householdId: newId };
      setForm(updated);
      saveSettings(updated);
      setHhMsg(`✓ Household created! Your ID is: ${newId}`);
    } catch {
      setHhMsg("Could not create household. Check your connection.");
    }
    setHhLoading(false);
  };

  // ── Join existing household ───────────────────────────────────────────────
  const joinHousehold = async () => {
    const id = joinId.trim().toUpperCase();
    const p  = joinPin.trim();
    if (!id)  { setJoinMsg("Enter a household ID."); return; }
    if (!p)   { setJoinMsg("Enter the household PIN."); return; }
    if (p !== form.pin && p !== settings.pin) { setJoinMsg("Incorrect PIN."); return; }

    setHhLoading(true); setJoinMsg("");
    try {
      const exists = await window.APP.firebase.householdExists(id);
      if (!exists) { setJoinMsg("Household not found. Check the ID."); setHhLoading(false); return; }
      const updated = { ...form, householdId: id };
      setForm(updated);
      saveSettings(updated);
      setJoinMsg(`✓ Joined household ${id}`);
      setJoinId(""); setJoinPin("");
    } catch {
      setJoinMsg("Could not join household. Check your connection.");
    }
    setHhLoading(false);
  };

  // ── Leave household ───────────────────────────────────────────────────────
  const leaveHousehold = () => {
    requestPin(() => {
      const updated = { ...form, householdId: "" };
      setForm(updated);
      saveSettings(updated);
      showBanner("Left household. Data is now local only.", "success");
    });
  };

  const hasHousehold = !!form.householdId;

  // ── Render ────────────────────────────────────────────────────────────────
  return h("div", null,
    h(SectionHeader, { title: "Settings" }),

    // ── Household ─────────────────────────────────────────────────────────────
    h(Card, { style: { marginBottom: 16 } },
      h("div", { className: "font-bold font-serif mb-12", style: { fontSize: 15 } }, "🏠 Household"),
      h(Input, { label: "Household / Family Name", value: form.householdName, onChange: v => upd("householdName", v), placeholder: "e.g. Haley's Meal Planning" }),
      h(Input, { label: "Default # of People", type: "number", value: form.people, onChange: v => upd("people", Math.max(1, +v)) }),
      h(Input, { label: "Default Zip Code (price comparisons)", value: form.zipCode || "", onChange: v => upd("zipCode", v), placeholder: "e.g. 44691" }),
    ),

    // ── Firebase sync / household management ──────────────────────────────────
    h(Card, { style: { marginBottom: 16 } },
      h("div", { className: "font-bold font-serif mb-12", style: { fontSize: 15 } }, "🔄 Sync & Household"),

      hasHousehold
        // ── Connected state ──────────────────────────────────────────────────
        ? h("div", null,
            h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", background: "#E8F4EC", borderRadius: 10, marginBottom: 12 } },
              h("div", null,
                h("div", { className: "accent font-bold", style: { fontSize: 14 } }, "✓ Sync active"),
                h("div", { className: "muted text-xs", style: { marginTop: 2 } }, `Household ID: ${form.householdId}`),
              ),
              h("div", { style: { fontSize: 20 } }, "☁️"),
            ),
            h("div", { className: "muted text-xs", style: { marginBottom: 12 } },
              "Grocery list, recipes, and API cost log sync automatically every 2 minutes across all devices sharing this household ID.",
            ),
            h("div", { className: "muted text-xs font-bold", style: { marginBottom: 6 } }, "Share with family:"),
            h("div", { style: { background: "#FFF8F0", border: "1.5px solid #F0E6D3", borderRadius: 8, padding: "10px 12px", fontSize: 13, fontFamily: "monospace", marginBottom: 12, wordBreak: "break-all" } },
              `ID: ${form.householdId} · PIN: ${form.pin}`,
            ),
            h("div", { className: "muted text-xs", style: { marginBottom: 12 } },
              "Give this ID and your app PIN to family members. They enter it under Settings → Join Household on their device.",
            ),
            h(Btn, { label: "Leave Household", variant: "danger", onClick: leaveHousehold, className: "btn-sm" }),
          )

        // ── Not connected state ───────────────────────────────────────────────
        : h("div", null,
            // Create new
            h("div", { className: "font-bold text-sm mb-8" }, "Create a new household"),
            h("div", { className: "muted text-xs", style: { marginBottom: 10 } },
              "Creates a new shared household in Firebase. Your grocery list, recipes, and cost log will sync to the cloud.",
            ),
            h(Btn, {
              label: hhLoading ? "Creating…" : "Create Household",
              icon: "☁️",
              onClick: createHousehold,
              disabled: hhLoading,
              style: { marginBottom: 8 },
            }),
            hhMsg && h("div", { className: hhMsg.startsWith("✓") ? "accent text-sm" : "warn text-sm", style: { marginBottom: 12 } }, hhMsg),

            h("div", { style: { borderTop: "1px solid #F0E6D3", margin: "16px 0" } }),

            // Join existing
            h("div", { className: "font-bold text-sm mb-8" }, "Join an existing household"),
            h("div", { className: "muted text-xs", style: { marginBottom: 10 } },
              "Enter a household ID and PIN shared by another household member.",
            ),
            h(Input, { label: "Household ID", value: joinId, onChange: v => setJoinId(v.toUpperCase()), placeholder: "e.g. AB12CD34" }),
            h(Input, { label: "Household PIN", type: "password", value: joinPin, onChange: setJoinPin, placeholder: "PIN" }),
            h(Btn, {
              label: hhLoading ? "Joining…" : "Join Household",
              variant: "ghost",
              onClick: joinHousehold,
              disabled: hhLoading,
            }),
            joinMsg && h("div", { className: joinMsg.startsWith("✓") ? "accent text-sm" : "warn text-sm", style: { marginTop: 8 } }, joinMsg),
          ),
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
        h(PillToggle, { options: PROTEINS, selected: form.defaultProteins || [], onToggle: toggleDefProtein }),
      ),
    ),

    // ── Appliances ────────────────────────────────────────────────────────────
    h(Card, { style: { marginBottom: 16 } },
      h("div", { className: "font-bold font-serif", style: { fontSize: 15, marginBottom: 4 } }, "🍳 My Appliances"),
      h("div", { className: "muted text-sm", style: { marginBottom: 14 } }, "The AI meal planner will prefer meals using these."),
      APPLIANCES.map(a =>
        h("label", { key: a, className: "appliance-row" },
          h("input", { type: "checkbox", checked: myAppliances.includes(a), onChange: () => toggleAppliance(a) }),
          h("span", { style: { fontSize: 14 } }, a),
        )
      ),
    ),

    // ── API cost ──────────────────────────────────────────────────────────────
    h(Card, { style: { marginBottom: 16 } },
      h("div", { className: "font-bold font-serif mb-12", style: { fontSize: 15 } }, "💳 API Usage (Rolling 30 Days)"),
      h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", background: "#FFF8F0", borderRadius: 12 } },
        h("div", { className: "muted font-bold", style: { fontSize: 14 } }, "Estimated usage"),
        h("div", { className: "font-bold", style: { fontSize: 24, color: costTotal > 8 ? "#C0392B" : "#2A7D4F" } }, fmt$(costTotal)),
      ),
      costTotal > 8 && h("div", { className: "cost-warning" }, "⚠️ Approaching your expected limit. Check your Anthropic dashboard."),
      h("div", { className: "muted text-xs", style: { marginTop: 10 } }, "Estimates based on typical token usage per feature. Actual charges may vary slightly."),
    ),

    // ── Change PIN ────────────────────────────────────────────────────────────
    h(Card, { style: { marginBottom: 16 } },
      h("div", { className: "font-bold font-serif mb-12", style: { fontSize: 15 } }, "🔐 Change PIN"),
      h(Input, { label: "New PIN",         type: "password", value: newPin1, onChange: setNewPin1, placeholder: "New PIN (min 4 digits)" }),
      h(Input, { label: "Confirm New PIN", type: "password", value: newPin2, onChange: setNewPin2, placeholder: "Repeat new PIN" }),
      pinMsg && h("div", { className: pinMsg.startsWith("✓") ? "accent text-sm" : "warn text-sm", style: { marginBottom: 8 } }, pinMsg),
      h(Btn, { label: "Update PIN", variant: "ghost", onClick: handleChangePin }),
      h("div", { className: "muted text-xs", style: { marginTop: 8 } }, "You will be asked to confirm your current PIN before the change is applied."),
    ),

    // ── Save ──────────────────────────────────────────────────────────────────
    h(Btn, {
      label: saved ? "✓ Saved!" : "Save Settings",
      onClick: saveAll,
      style: { width: "100%", background: saved ? "#2A7D4F" : "#D4622A", color: "#fff", border: "none", marginBottom: 8, justifyContent: "center" },
    }),
  );
};
