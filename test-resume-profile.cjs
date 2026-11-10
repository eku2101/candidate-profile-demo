const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const resume = require('./resume-tools.js');
const controller = fs.readFileSync(path.join(__dirname, 'profile-controller.js'), 'utf8');
new vm.Script(controller);

const sample = `Alex Morgan
Learning Designer
Chicago, IL
alex@example.test | (312) 555-0142
PROFESSIONAL SUMMARY
Learning designer creating accessible experiences.
WORK EXPERIENCE
Learning Designer | Northstar Academy
2022 - Present
- Designed 12 learning modules.
Teaching Assistant | River School
2019 - 2022
- Supported literacy instruction.
EDUCATION
B.A. Education | Example University
2019
SKILLS
Curriculum design
Accessibility
CERTIFICATIONS
Inclusive Instruction Certificate
AWARDS
Community Teaching Award`;

test('imports identity, contact information, all jobs, education and credentials', () => {
  const { fields, rawText, warnings } = resume.parseResumeText(sample);
  assert.equal(fields.name, 'Alex Morgan');
  assert.equal(fields.role, 'Learning Designer');
  assert.equal(fields.location, 'Chicago, IL');
  assert.equal(fields.email, 'alex@example.test');
  assert.equal(fields.phone, '(312) 555-0142');
  assert.match(fields.experience, /Northstar Academy/);
  assert.match(fields.experience, /River School\n2019 - 2022/);
  assert.match(fields.education, /Example University/);
  assert.match(fields.credentials, /Community Teaching Award/);
  assert.equal(fields.skills, 'Curriculum design, Accessibility');
  assert.equal(fields.mission, '');
  assert.equal(rawText, sample);
  assert.deepEqual(warnings, []);
});

test('does not fabricate jobs or personal stories when sections are missing', () => {
  const result = resume.parseResumeText('Morgan Lee\nGraphic Designer\nhello@example.test\nA portfolio introduction without headings.');
  assert.equal(result.fields.experience, '');
  assert.equal(result.fields.education, '');
  assert.equal(result.fields.community, '');
  assert.ok(result.warnings.some(warning => warning.includes('work-history')));
  assert.match(result.rawText, /without headings/);
});

test('right-aligned dates stay attached to a job line', () => {
  const item = (str, x, y, width) => ({ str, transform: [1,0,0,1,x,y], width, height: 10 });
  const lines = resume.textItemsToLines([
    item('WORK EXPERIENCE', 48, 700, 110), item('Teacher | Example School', 48, 680, 150), item('2020 - 2024', 440, 680, 70),
    item('EDUCATION', 48, 600, 80), item('Example College', 48, 580, 100)
  ]);
  assert.ok(lines.includes('Teacher | Example School   2020 - 2024'));
  assert.match(resume.parseResumeText('Alex Morgan\n' + lines.join('\n')).fields.experience, /Teacher.*2020 - 2024/);
});

test('two columns keep education and experience in their own sections', () => {
  const item = (str, x, y, width = 90) => ({ str, transform: [1,0,0,1,x,y], width, height: 10 });
  const lines = resume.textItemsToLines([
    item('Jamie Taylor',48,750), item('SKILLS',48,680), item('EXPERIENCE',260,680),
    item('Analysis',48,660), item('Researcher',260,660), item('EDUCATION',48,620),
    item('Community Lab',260,640), item('Example College',48,600), item('2021 - Present',260,620)
  ]);
  const { fields } = resume.parseResumeText(lines.join('\n'));
  assert.match(fields.experience, /Researcher\nCommunity Lab\n2021 - Present/);
  assert.equal(fields.education, 'Example College');
  assert.equal(fields.skills, 'Analysis');
});

test('stored schema accepts missing optional fields and rejects invalid versions', () => {
  assert.equal(resume.validateProfile({ schemaVersion: 2, fields: {} }), null);
  assert.equal(resume.validateProfile({ schemaVersion: 1, fields: null }), null);
  const stored = resume.validateProfile({ schemaVersion: 1, fields: { name: 'Alex', experience: 'First job\nSecond job', skills: 123 } });
  assert.equal(stored.fields.experience, 'First job\nSecond job');
  assert.equal(stored.fields.skills, '');
  assert.equal(stored.fields.education, '');
});

function storageHarness(save) {
  const inputs = Object.fromEntries(resume.fields.map(key => ['profile' + key[0].toUpperCase() + key.slice(1) + 'Input', { value: '' }]));
  const status = { textContent: '' };
  const context = vm.createContext({ $, document: { querySelectorAll: () => [status] }, ForwardResume: { saveProfile: save },
    applicantPreferences: { focus: 'protected' }, applicantQuizComplete: true, applicantLaunched: false });
  function $(id) { return inputs[id]; }
  vm.runInContext(controller.slice(0, controller.lastIndexOf('initializeProfileApp();')), context);
  vm.runInContext('profileStorageReady = true;', context);
  return { inputs, status, save: () => vm.runInContext('saveApplicantProfile()', context) };
}

test('rapid edits save in order with the final work history intact', async () => {
  const writes = [];
  const h = storageHarness(async record => { await Promise.resolve(); writes.push(record); });
  h.inputs.profileExperienceInput.value = 'First job';
  const first = h.save();
  h.inputs.profileExperienceInput.value = 'First job\nSecond job';
  const second = h.save();
  assert.deepEqual(await Promise.all([first, second]), [true, true]);
  assert.equal(writes[0].fields.experience, 'First job');
  assert.equal(writes[1].fields.experience, 'First job\nSecond job');
  assert.match(h.status.textContent, /^Saved in this browser/);
});

test('storage failure never claims success and a later retry can save', async () => {
  let attempts = 0;
  const h = storageHarness(async () => { if (++attempts === 1) throw new Error('Quota exceeded'); });
  assert.equal(await h.save(), false);
  assert.match(h.status.textContent, /^Not saved:/);
  assert.equal(await h.save(), true);
  assert.match(h.status.textContent, /^Saved in this browser/);
});
