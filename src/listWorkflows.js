import { contactPhoneHref, normalizeLinkedInUrl } from "./contactUtils.js";
import { isPlaceholderEmail } from "./demoData.js";

const nameKey = value => String(value || "").trim().toLowerCase();

export function sequenceChannels(sequence) {
  const known = new Map([["email", "Email"], ["call", "Call"], ["linkedin", "LinkedIn"]]);
  return [...new Set((sequence?.stepPlan || []).map(step => known.get(String(step.channel || "").trim().toLowerCase())).filter(Boolean))];
}

export function sequenceContactChannels(sequence, person) {
  return sequenceChannels(sequence).map(channel => {
    let onFile = false;
    if (channel === "Email") {
      const email = String(person?.email || "").trim();
      onFile = /^[^\s@]+@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i.test(email) && !isPlaceholderEmail(email);
    } else if (channel === "Call") {
      onFile = Boolean(contactPhoneHref(person?.phone));
    } else if (channel === "LinkedIn") {
      onFile = Boolean(normalizeLinkedInUrl(person?.linkedinUrl));
    }
    return { channel, onFile };
  });
}

export function sequenceChannelGaps(sequence, person) {
  return sequenceContactChannels(sequence, person).filter(item => !item.onFile).map(item => item.channel);
}

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

export function enrollmentPrompt(sequence, contacts, sourceListName) {
  const name = typeof sequence === "string" ? sequence : sequence?.name || "the selected sequence";
  const gaps = contacts.map(person => ({ name: person.name, channels: sequenceChannelGaps(typeof sequence === "string" ? null : sequence, person) })).filter(item => item.channels.length);
  const gapSummary = gaps.length ? ` Missing saved channel fields: ${gaps.map(item => `${item.name} (${item.channels.join(", ")})`).join("; ")}. Note these are field-presence checks only; do not describe other addresses, numbers, or profiles as verified.` : " Note that channel fields on file are not independently verified.";
  return `Enroll only these contacts in the sequence named “${name}”: ${contacts.map(person => person.name).join("; ")}.${sourceListName ? ` They are selected from the People list “${sourceListName}”.` : ""}${gapSummary} Show the exact contacts, sequence, and any missing channel fields for review before applying. This updates a local sequence plan; do not enroll anyone else or send outreach.`;
}
