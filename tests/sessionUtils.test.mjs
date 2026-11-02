import assert from "node:assert/strict";
import test from "node:test";

import { restoreSessionUser } from "../src/utils/sessionUtils.js";

const cachedAdmin = { id: "admin-id", role: "SUPER_ADMIN" };
const authWithSession = (session) => ({
  getSession: async () => ({ data: { session }, error: null }),
});

test("rejects a cached admin profile when the Supabase session is missing", async () => {
  assert.equal(await restoreSessionUser(authWithSession(null), cachedAdmin), null);
});

test("rejects a cached admin profile belonging to another Supabase user", async () => {
  const auth = authWithSession({ user: { id: "different-user" } });
  assert.equal(await restoreSessionUser(auth, cachedAdmin), null);
});

test("waits for Supabase to restore the matching session", async () => {
  let resolveSession;
  const auth = {
    getSession: () => new Promise((resolve) => { resolveSession = resolve; }),
  };
  let restored = false;
  const pending = restoreSessionUser(auth, cachedAdmin).then((user) => {
    restored = true;
    return user;
  });
  await Promise.resolve();
  assert.equal(restored, false);
  resolveSession({ data: { session: { user: { id: cachedAdmin.id } } }, error: null });
  assert.deepEqual(await pending, cachedAdmin);
});

test("does not accept the cached profile when refreshing the session fails", async () => {
  const refreshError = new Error("Invalid refresh token");
  const auth = { getSession: async () => ({ data: { session: null }, error: refreshError }) };
  await assert.rejects(restoreSessionUser(auth, cachedAdmin), refreshError);
});

test("requires both Supabase configuration and a saved profile", async () => {
  assert.equal(await restoreSessionUser(null, cachedAdmin), null);
  assert.equal(await restoreSessionUser(authWithSession({ user: { id: "admin-id" } }), null), null);
});

test("rejects a saved profile without a user ID", async () => {
  assert.equal(await restoreSessionUser(authWithSession(null), { role: "SUPER_ADMIN" }), null);
});
