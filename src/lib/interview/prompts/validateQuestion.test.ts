import test from "node:test";
import assert from "node:assert/strict";
import { validateInterviewQuestion } from "./validateQuestion";

// docs/17 §3 ALLOWED — contrast that resolves to the choice made, PLUS the three words
// the old gate wrongly banned (compromise / cut / lost) used as decision rationale.
const ALLOWED = [
  "What did you try before this landed?",
  "What was the alternative you considered and set aside?",
  "What made you choose the oak over the walnut here?",
  "What almost made the cut?",
  "The client wanted marble, you saw quartzite — how did you resolve it?",
  "The kitchen island was a compromise between the budget and your vision — how did you land it?",
  "You cut the original lighting plan — what replaced it, and why is it better?",
  "That fabric was your first choice but it was lost to lead times — what did you land on instead?",
];

// docs/17 §3 BARRED — grievance / regret / loss-dwelling.
const BARRED = [
  "What do you regret about this project?",
  "Knowing what you know now, what would you change?",
  "What went wrong during the build?",
  "What did you have to give up or settle for?",
  "What was your biggest mistake here?",
  "What frustrated you most about the process?",
  "What's the worst part of how it turned out?",
  "Is there anything you'd have done differently?",
];

test("arrival-safe questions pass (incl. compromise/cut/lost as rationale)", () => {
  for (const q of ALLOWED) {
    const r = validateInterviewQuestion(q);
    assert.equal(r.ok, true, `expected OK but barred (${r.violation}): ${q}`);
  }
});

test("grievance / regret / loss-dwelling questions are barred", () => {
  for (const q of BARRED) {
    const r = validateInterviewQuestion(q);
    assert.equal(r.ok, false, `expected barred but passed: ${q}`);
  }
});

test("empty input is rejected", () => {
  assert.equal(validateInterviewQuestion("").ok, false);
});
