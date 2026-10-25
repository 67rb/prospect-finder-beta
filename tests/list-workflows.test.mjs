import test from "node:test";
import assert from "node:assert/strict";
import { listMemberRecords, normalizeLocalLists, resolveEnrollmentScope } from "../src/listWorkflows.js";

const maya = { name: "Maya Patel", company: "Northstar Labs" };
const sofia = { name: "Sofia Martinez", company: "Pioneer Cloud" };
const state = {
  sequences: [{ name: "Maya Patel outreach", enrolledPeople: [] }],
  lists: [{ name: "Priority prospects", type: "People", members: [maya.name, sofia.name] }],
};

test("enrollment includes only selected contacts when a sequence is named after another contact", () => {
  const result = resolveEnrollmentScope({ sequenceName: "Maya Patel outreach", contactNames: [sofia.name] }, state, [maya, sofia]);
  assert.deepEqual(result.people, [sofia]);
});

test("a reviewed enrollment excludes a person removed from its source list", () => {
  const scope = { sequenceName: state.sequences[0].name, contactNames: [maya.name, sofia.name], sourceListName: "Priority prospects" };
  const changed = { ...state, lists: [{ ...state.lists[0], members: [sofia.name] }] };
  const result = resolveEnrollmentScope(scope, changed, [maya, sofia]);
  assert.deepEqual(result.people, [sofia]);
  assert.equal(result.excludedCount, 1);
});

test("missing source lists and sequences cannot silently widen an enrollment", () => {
  const scope = { sequenceName: state.sequences[0].name, contactNames: [sofia.name], sourceListName: "Deleted list" };
  assert.equal(resolveEnrollmentScope(scope, state, [maya, sofia]).people.length, 0);
  assert.ok(resolveEnrollmentScope(scope, state, [maya, sofia]).error);
  assert.ok(resolveEnrollmentScope({ ...scope, sequenceName: "Deleted sequence" }, state, [maya, sofia]).error);
});

test("already enrolled contacts are excluded without case-sensitive duplicates", () => {
  const changed = { ...state, sequences: [{ ...state.sequences[0], enrolledPeople: ["sofia martinez"] }] };
  assert.deepEqual(resolveEnrollmentScope({ sequenceName: changed.sequences[0].name, contactNames: [sofia.name] }, changed, [maya, sofia]).people, []);
});

test("local counts reflect distinct saved membership and retain unresolved member names", () => {
  const [list] = normalizeLocalLists([{ name: "Targets", count: 24, type: "People", members: ["Maya Patel", "MAYA PATEL", "Missing contact", "", null] }]);
  assert.equal(list.count, 2);
  const records = listMemberRecords(list, [maya], []);
  assert.equal(records.find(item => item.record)?.record, maya);
  assert.equal(records.find(item => item.name === "Missing contact")?.record, null);
});
