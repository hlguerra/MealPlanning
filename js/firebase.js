// ── js/firebase.js ────────────────────────────────────────────────────────────
// Firebase helpers are initialized in index.html as an ES module
// because the Firebase SDK functions must stay in module scope.
//
// All helpers are attached to window.APP.firebase in index.html:
//
//   authReady                          → Promise<User>  (anonymous sign-in)
//   getIdToken()                       → Promise<string>  (for the AI proxy)
//   subscribe(id, path, field, onData, onError) → unsubscribe
//   mergeWrite(id, path, field, merge) → Promise<value written>  (transaction)
//   ensureMember(id, pin)              → Promise<boolean>  (PIN checked by rules)
//   createHousehold(id, name, pin)     → Promise<void>
//   setHouseholdPin(id, pin)           → Promise<void>
//   leaveHousehold(id)                 → Promise<void>
//
// To sync a new collection, add it to SYNCED in sync.js and pass its setter to
// startSync / its value to schedulePush in app.js. Access is controlled by
// firestore.rules (deploy with `firebase deploy --only firestore:rules`).
