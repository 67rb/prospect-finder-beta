export function applyWorkflowEvent(state, trigger, contexts) {
  if (!contexts.length) return state;
  const active = (state.workflows || []).filter(workflow => workflow.status === "Active" && workflow.trigger === trigger);
  if (!active.length) return state;
  const tasks = [];
  let lists = [...(state.lists || [])];
  let sequences = [...(state.sequences || [])];
  const increment = contexts.length;
  active.forEach(workflow => contexts.forEach(context => {
    const steps = Array.isArray(workflow.steps) && workflow.steps.length ? workflow.steps : [workflow];
    steps.forEach(step => {
    if (step.action === "Create follow-up task") {
      const title = String(step.taskTitle || "Follow up with {{contact}}")
        .replaceAll("{{contact}}", context.contact || "this contact")
        .replaceAll("{{company}}", context.company || "")
        .replaceAll("{{list}}", context.list || "")
        .replaceAll("{{deal}}", context.deal || "")
        .replaceAll("{{stage}}", context.stage || "")
        .replaceAll("{{task}}", context.task || "")
        .replace(/\s+/g, " ").trim();
      tasks.push({ title, person: context.contact || "Unassigned", due: step.due || "Today", type: "Workflow", done: false, source: "local" });
    } else if (step.action === "Add contact to a list" && step.targetName && context.contact) {
      const target = lists.find(list => list.name === step.targetName);
      if (target) {
        const members = target.members || [];
        if (!members.includes(context.contact)) lists = lists.map(list => list.name === target.name ? { ...list, members: [...members, context.contact], count: Number(list.count || 0) + 1, updated: "Just now" } : list);
      } else lists = [{ name: step.targetName, type: "People", count: 1, updated: "Just now", description: "Created by a local workflow", members: [context.contact], source: "local" }, ...lists];
    } else if (step.action === "Enroll contact in a sequence" && step.targetName && context.contact) {
      sequences = sequences.map(sequence => {
        if (sequence.name !== step.targetName) return sequence;
        const enrolledPeople = sequence.enrolledPeople || [];
        if (enrolledPeople.includes(context.contact)) return sequence;
        const nextEnrolledPeople = [...enrolledPeople, context.contact];
        return sequence.source === "sample" || sequence.source === "apollo"
          ? { ...sequence, enrolledPeople: nextEnrolledPeople }
          : { ...sequence, enrolledPeople: nextEnrolledPeople, people: nextEnrolledPeople.length };
      });
    }
    });
  }));
  const matchingNames = new Set(active.map(workflow => workflow.name));
  return {
    ...state,
    tasks: [...tasks, ...(state.tasks || [])],
    lists,
    sequences,
    workflows: (state.workflows || []).map(workflow => {
      if (!matchingNames.has(workflow.name)) return workflow;
      return workflow.source === "sample"
        ? { ...workflow, localRuns: Number(workflow.localRuns || 0) + increment }
        : { ...workflow, runs: Number(workflow.runs || 0) + increment };
    }),
  };
}
