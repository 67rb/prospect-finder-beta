const nameKey = value => String(value || "").trim().toLowerCase();

export function uniqueListMembers(list) {
  const members = Array.isArray(list?.members) ? list.members : [];
  return [...new Map(members.filter(name => typeof name === "string" && name.trim()).map(name => [nameKey(name), name.trim()])).values()];
}

export function normalizeLocalLists(lists) {
  return (Array.isArray(lists) ? lists : []).map(list => {
    const members = uniqueListMembers(list);
    return { ...list, members, count: members.length };
  });
}

export function listMemberRecords(list, contacts, companies) {
  const records = list?.type === "Companies" ? companies : contacts;
  const byName = new Map(records.map(record => [nameKey(record.name), record]));
  return uniqueListMembers(list).map(name => ({ name, record: byName.get(nameKey(name)) || null }));
}

export function resolveEnrollmentScope(scope, state, contacts) {
  const sequence = (state.sequences || []).find(item => item.name === scope.sequenceName);
  if (!sequence) return { people: [], error: "The selected sequence is no longer available." };
  const sourceList = scope.sourceListName ? (state.lists || []).find(list => list.type === "People" && list.name === scope.sourceListName) : null;
  if (scope.sourceListName && !sourceList) return { people: [], error: "The source people list is no longer available." };
  const members = sourceList ? new Set(uniqueListMembers(sourceList).map(nameKey)) : null;
  const enrolled = new Set((sequence.enrolledPeople || []).map(nameKey));
  const byName = new Map(contacts.map(person => [nameKey(person.name), person]));
  const requested = [...new Set((scope.contactNames || []).map(nameKey).filter(Boolean))];
  const people = requested.filter(name => byName.has(name) && !enrolled.has(name) && (!members || members.has(name))).map(name => byName.get(name));
  return { sequence, sourceList, people, excludedCount: requested.length - people.length, error: "" };
}

export function enrollmentPrompt(sequenceName, contacts, sourceListName) {
  return `Enroll only these contacts in the sequence named “${sequenceName}”: ${contacts.map(person => person.name).join("; ")}.${sourceListName ? ` They are selected from the People list “${sourceListName}”.` : ""} Show the exact contacts and sequence for review before applying. Do not enroll anyone else or send outreach.`;
}
