const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
new vm.Script(script);
const model = script.slice(0, script.indexOf('    document.querySelectorAll(".role-button")'));
function run(scenario, extras = {}) {
  vm.runInContext(model + '\n' + scenario, vm.createContext({ assert, ...extras }));
}

test('both forms keep independent, deliberate work-preference choices', () => {
  for (const role of ['applicant', 'hiring']) {
    for (const key of ['Focus', 'Brainstorming', 'Communication', 'CheckIns']) {
      const id = role + key;
      const select = html.match(new RegExp('<select id="' + id + '" required>([\\s\\S]*?)</select>'));
      assert.ok(select, id);
      assert.match(select[1], /value="" disabled selected/);
      assert.match(select[1], /value="flexible"/);
    }
  }
  assert.doesNotMatch(html, /introvert|extrovert|fitMeter|% shared direction/i);
});

test('every concrete difference produces an actionable prompt for each audience', () => run(`
  const applicant = { focus: "protected", brainstorming: "occasional", communication: "written", checkIns: "milestones", rhythm: "steady", environment: "enterprise" };
  const team = { focus: "open", brainstorming: "frequent", communication: "live", checkIns: "frequent", rhythm: "fast", environment: "remote" };
  const forApplicant = getDiscussionPrompts(applicant, team, "applicant");
  const forHiring = getDiscussionPrompts(applicant, team, "hiring");
  assert.equal(forApplicant.length, 6);
  assert.equal(forHiring.length, 6);
  for (let index = 0; index < 6; index++) {
    assert.equal(forApplicant[index].key, forHiring[index].key);
    assert.notEqual(forApplicant[index].question, forHiring[index].question);
    assert.ok(forApplicant[index].question.endsWith("?"));
    assert.ok(forHiring[index].question.endsWith("?"));
    assert.ok(forApplicant[index].step.length > 30);
  }
`));

test('equal, flexible, and unanswered choices do not create a false difference', () => run(`
  const preferences = { ...privateApplicantSignals.alex };
  assert.equal(getDiscussionPrompts(preferences, preferences, "applicant").length, 0);
  for (const topic of discussionTopics) {
    const team = { ...preferences, [topic.key]: "flexible" };
    assert.equal(getDiscussionPrompts(preferences, team, "applicant").length, 0);
    assert.equal(getDiscussionPrompts(team, preferences, "hiring").length, 0);
  }
  assert.equal(getDiscussionPrompts({}, preferences, "hiring").length, 0);
  assert.equal(getDiscussionPrompts(null, null, "applicant").length, 0);
`));

test('changing any applicant or team preference cannot lower rank or remove anyone', () => run(`
  applicantPreferences = { ...privateApplicantSignals.alex };
  rankedApplicants.push({ id: "avery" });
  hiringCriteria = { ...privateApplicantSignals.alex };
  rankRemainingApplicants();
  const originalOrder = rankedApplicants.map(person => person.id).join(",");
  const scores = rankedApplicants.map(person => experienceRank(person)).join(",");
  const alternatives = { focus: "open", brainstorming: "occasional", communication: "live", checkIns: "frequent", rhythm: "fast", environment: "startup" };
  for (const [key, value] of Object.entries(alternatives)) {
    hiringCriteria[key] = value;
    applicantPreferences[key] = value;
    privateApplicantSignals.alex[key] = value;
    rankRemainingApplicants();
    assert.equal(rankedApplicants.map(person => person.id).join(","), originalOrder, key);
    assert.equal(rankedApplicants.map(person => experienceRank(person)).join(","), scores, key);
    assert.equal(rankedApplicants.length, 5);
  }
`));

test('editing a saved preference replaces its discussion topic without changing experience order', () => run(`
  applicantPreferences = { ...privateApplicantSignals.alex };
  hiringCriteria = { ...privateApplicantSignals.alex, communication: "live" };
  const person = { id: "avery" };
  assert.equal(getDiscussionPrompts(getMatchingProfile(person), hiringCriteria, "applicant")[0].key, "communication");
  const before = experienceRank(person);
  applicantPreferences.communication = "live";
  assert.equal(getDiscussionPrompts(getMatchingProfile(person), hiringCriteria, "applicant").length, 0);
  applicantPreferences.checkIns = "frequent";
  const prompts = getDiscussionPrompts(getMatchingProfile(person), hiringCriteria, "hiring");
  assert.equal(prompts.length, 1);
  assert.equal(prompts[0].key, "checkIns");
  assert.equal(experienceRank(person), before);
  for (const publicPerson of publicApplicants) {
    for (const topic of discussionTopics) assert.ok(!(topic.key in publicPerson));
  }
`));

test('experience still orders remaining applicants and reviewed positions stay fixed', () => run(`
  hiringCriteria.experience = "senior";
  rankRemainingApplicants();
  assert.equal(rankedApplicants[0].id, "alex");
  currentIndex = 1;
  hiringCriteria.experience = "mid";
  rankRemainingApplicants();
  assert.equal(rankedApplicants[0].id, "alex");
  assert.equal(rankedApplicants[1].id, "jordan");
  assert.equal(rankedApplicants.length, 4);
`));

test('rendering refreshed prompts clears stale topics and safely renders context text', () => {
  function element(tag) {
    return { tag, children: [], textContent: '', append(...children) { this.children.push(...children); }, replaceChildren(...children) { this.children = children; } };
  }
  const host = element('article');
  const document = { getElementById: () => host, createElement: element };
  run(`
    const applicant = { ...privateApplicantSignals.alex };
    const team = { ...applicant, communication: "live" };
    renderDiscussionPanel("test", "hiring", applicant, team, "<b>Example team</b>");
  `, { document });
  assert.equal(host.children.filter(child => child.tag === 'details').length, 1);
  assert.equal(host.children[1].textContent, '<b>Example team</b>');
  run(`
    renderDiscussionPanel("test", "applicant", privateApplicantSignals.alex, privateApplicantSignals.alex, "Sample team");
  `, { document });
  assert.equal(host.children.filter(child => child.tag === 'details').length, 0);
  assert.ok(host.children.some(child => child.textContent.includes('No specific differences')));
});
