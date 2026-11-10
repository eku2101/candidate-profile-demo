const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
// Compile the complete application, then exercise its actual model declarations
// without browser event binding. Browser interactions are checked separately.
new vm.Script(script);
const model = script.slice(0, script.indexOf('    document.querySelectorAll(".role-button")'));
function run(scenario) {
  const context = vm.createContext({ assert });
  vm.runInContext(model + '\n' + scenario, context);
}

test('both intake forms ask independently and require deliberate choices', () => {
  for (const role of ['applicant', 'hiring']) {
    for (const key of ['Focus', 'Brainstorming', 'Communication', 'CheckIns']) {
      const id = role + key;
      const select = html.match(new RegExp('<select id="' + id + '" required>([\\s\\S]*?)</select>'));
      assert.ok(select, id + ' must be required');
      assert.match(select[1], /value="" disabled selected/);
      assert.match(select[1], /value="flexible"/);
      assert.ok(html.includes('<label for="' + id + '">'));
    }
  }
  assert.doesNotMatch(html, /introvert|extrovert|applicantWorkStyle|hiringTeamStyle/i);
});

test('quiet focus and frequent brainstorming can align simultaneously', () => run(`
  const person = publicApplicants.find(person => person.id === "alex");
  hiringCriteria = { ...privateApplicantSignals.alex };
  const result = calculateCompatibility(person);
  assert.equal(result.aligned, 7);
  assert.equal(result.total, 7);
  assert.equal(result.score, 98);
`));

test('each working habit affects the score independently and equally', () => run(`
  const person = publicApplicants[0];
  const opposite = { focus: "open", brainstorming: "occasional", communication: "live", checkIns: "frequent" };
  // Avoid the score ceiling while testing individual changes.
  const baseline = { ...privateApplicantSignals.alex, experience: "entry", environment: "enterprise" };
  hiringCriteria = { ...baseline };
  const matched = calculateCompatibility(person);
  const changes = [];
  for (const key of workPreferenceKeys) {
    hiringCriteria = { ...baseline, [key]: opposite[key] };
    const changed = calculateCompatibility(person);
    assert.ok(changed.score < matched.score, key);
    assert.equal(changed.aligned, matched.aligned - 1, key);
    changes.push(matched.score - changed.score);
  }
  assert.ok(changes.every(change => change === changes[0]));
`));

test('flexible preferences on either side get partial credit without a preferred personality', () => run(`
  const person = publicApplicants[0];
  const baseline = { ...privateApplicantSignals.alex, experience: "entry", environment: "enterprise" };
  hiringCriteria = { ...baseline };
  const exact = calculateCompatibility(person).score;
  hiringCriteria.communication = "live";
  const different = calculateCompatibility(person).score;
  hiringCriteria.communication = "flexible";
  const flexible = calculateCompatibility(person).score;
  assert.ok(different < flexible && flexible < exact);
  hiringCriteria.communication = "written";
  privateApplicantSignals.alex.communication = "flexible";
  assert.equal(calculateCompatibility(person).score, flexible);
`));

test('the launched applicant uses all four answers but the public object contains none', () => run(`
  applicantPreferences = { focus: "protected", brainstorming: "frequent", communication: "written", checkIns: "milestones", rhythm: "steady", environment: "remote" };
  hiringCriteria = { ...applicantPreferences, experience: "mid" };
  const result = calculateCompatibility({ id: "avery" });
  assert.equal(result.aligned, 7);
  applicantPreferences.communication = "live";
  assert.equal(calculateCompatibility({ id: "avery" }).aligned, 6);
  for (const person of publicApplicants) {
    for (const key of workPreferenceKeys) assert.ok(!(key in person));
  }
`));

test('changing team habits re-ranks remaining applicants and keeps reviewed applicants fixed', () => run(`
  // Equalize non-habit criteria to isolate the new matching behavior.
  for (const signal of Object.values(privateApplicantSignals)) {
    Object.assign(signal, { experience: "mid", rhythm: "steady", environment: "remote" });
  }
  hiringCriteria = { ...privateApplicantSignals.alex };
  rankRemainingApplicants();
  assert.equal(rankedApplicants[0].id, "alex");
  hiringCriteria = { ...privateApplicantSignals.jordan };
  rankRemainingApplicants();
  assert.equal(rankedApplicants[0].id, "jordan");
  currentIndex = 1;
  hiringCriteria = { ...privateApplicantSignals.alex };
  rankRemainingApplicants();
  assert.equal(rankedApplicants[0].id, "jordan");
  assert.equal(rankedApplicants[1].id, "alex");
  for (const person of rankedApplicants) {
    const result = calculateCompatibility(person);
    assert.ok(Number.isFinite(result.score) && result.score >= 48 && result.score <= 98);
  }
`));
