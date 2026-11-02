import assert from "node:assert/strict";
import test from "node:test";
import { syncFailureDiagnostic, syncFailureMessage } from "../sync/engine.mjs";

test("sync diagnostics distinguish timeout, payload and permission failures", () => {
  assert.equal(syncFailureDiagnostic({ code: "57014" }, "upload_cloud_batch").timeout_or_abort, true);
  assert.equal(syncFailureDiagnostic({ code: "PGRST003" }, "upload_cloud_batch").timeout_or_abort, true);
  assert.equal(syncFailureDiagnostic({ message: "TimeoutError: request aborted" }, "upload_cloud_batch").timeout_or_abort, true);
  assert.equal(syncFailureDiagnostic({ status: 413 }, "upload_cloud_batch").payload_too_large, true);
  assert.equal(syncFailureDiagnostic({ code: "42501" }, "upload_cloud_batch").permission_denied, true);
  assert.equal(syncFailureDiagnostic({ cause: { code: "ECONNRESET" } }, "upload_cloud_batch").cause_code, "ECONNRESET");
});

test("staff see actual timeout and schema failure reasons instead of a generic connection error", () => {
  assert.match(syncFailureMessage({ code: "57014" }), /PostgreSQL.*timeout.*57014/);
  assert.match(syncFailureMessage({ code: "PGRST003" }), /database connection.*PGRST003/);
  assert.match(syncFailureMessage({ code: "PT409", status: 409, message: "Cloud conflict: menu_item_variants has unversioned data" }), /menu_item_variants.*PT409.*for review/);
  assert.match(syncFailureMessage({ name: "TimeoutError", message: "The operation was aborted due to timeout" }), /request timed out/);
  assert.match(syncFailureMessage({ code: "22023", message: "Local and cloud schemas differ for ingredients" }), /schemas differ for ingredients.*22023/);
  assert.match(syncFailureMessage({ status: 413 }), /too large.*413/);
});

test("sync diagnostics omit raw messages, record contents and credential-like values", () => {
  const diagnostic = syncFailureDiagnostic({
    code: "sb_secret_private-value",
    message: "Request failed for private customer with sb_secret_private-value",
    details: "Private order contents",
    row_data: { customer_name: "Private customer" },
    cause: { code: "Bearer secret" },
  }, "upload_cloud_batch");
  assert.equal(diagnostic.code, null);
  assert.equal(diagnostic.cause_code, null);
  assert.doesNotMatch(JSON.stringify(diagnostic), /secret|customer|contents|Bearer/);
  assert.equal(diagnostic.stage, "upload_cloud_batch");
});
