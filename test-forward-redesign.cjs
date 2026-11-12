const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const model = require('./profile-model.js');
const history = `Designer | Studio A\n2022 - Present\n- Improved customer onboarding.\nTeacher | School B\n2019 - 2022\n- Supported colleagues.\nCoordinator | Program C\n2017 - 2019\n- Organized a community event.\nAssistant | Office D\n2015 - 2017\n- Helped customers.`;
test('suggests every dated role without choosing or removing full history', () => {
  const roles = model.suggestRoles(history);
  assert.equal(roles.length, 4);
  assert.equal(roles[0].title, 'Designer | Studio A');
  assert.equal(roles[2].dates, '2017 - 2019');
  assert.equal(roles[3].summary, '- Helped customers.');
  assert.ok(!roles[0].summary.includes('School B'));
  assert.equal(model.normalizeFeaturedRoles().filter(role => role.title).length, 0);
});
test('keeps only three public highlights and accepts older profiles without highlights', () => {
  assert.equal(model.normalizeFeaturedRoles(model.suggestRoles(history)).length, 3);
  assert.deepEqual(model.normalizeFeaturedRoles(undefined), Array.from({length:3}, () => ({title:'',dates:'',summary:''})));
  assert.equal(model.normalizeFeaturedRoles([{title:123,summary:'Retained draft'}])[0].title, '');
});
test('role suggestions preserve month names and numeric months in date ranges', () => {
  const roles = model.suggestRoles('Designer | A\nJan 2022 - Present\n- Built a tool.\nTeacher | B   09/2019 – 12/2021\n- Taught classes.');
  assert.equal(roles[0].title, 'Designer | A');
  assert.equal(roles[0].dates, 'Jan 2022 - Present');
  assert.equal(roles[1].title, 'Teacher | B');
  assert.equal(roles[1].dates, '09/2019 – 12/2021');
});
test('counts words, characters and comma-separated skills at boundaries', () => {
  assert.equal(model.count('  Working\n together\tmatters. '), 3);
  assert.equal(model.count('Design, , Teaching, Mentoring,', 'skills'), 3);
  assert.equal(model.count('A🌱', 'characters'), 2);
  assert.equal(model.violations({summary:Array(100).fill('word').join(' ')}).length, 0);
  assert.equal(model.violations({summary:Array(101).fill('word').join(' ')})[0].key, 'summary');
});
test('limits highlight writing while preserving full history and original draft text', () => {
  const fields = {experience:history.repeat(200), summary:'A short introduction'};
  const roles = [{title:'Designer', dates:'2022–Present', summary:Array(101).fill('detail').join(' ')}];
  const original = JSON.stringify({fields, roles});
  assert.equal(model.violations(fields, roles)[0].key, 'featured-0-summary');
  assert.equal(JSON.stringify({fields, roles}), original);
  assert.equal(model.violations(fields).length, 0);
});
test('one featured experience is enough, and an untitled highlight is flagged', () => {
  assert.deepEqual(model.violations({},[{title:'A first role',summary:'Supported the team.'}]), []);
  assert.equal(model.violations({},[{summary:'Needs a title'}])[0].key, 'featured-0-title');
});

const ui = fs.readFileSync(path.join(__dirname, 'forward-ui.js'), 'utf8');
const controller = fs.readFileSync(path.join(__dirname, 'profile-controller.js'), 'utf8');
new vm.Script(ui);
function timerHarness() {
  const timers = new Map(); let next = 0; let now = 0; let finishes = 0;
  const nodes = Object.fromEntries(['introOverlay','pauseIntro','introCopy','welcomeOverlay','welcomeClose','welcomeContinue','siteShell','welcomeTitle'].map(id => [id, {hidden:false, disabled:false, classList:{add(){},remove(){},toggle(){}}, setAttribute(){}, focus(){}}]));
  const context = vm.createContext({performance:{now:()=>now}, window:{setTimeout(fn,ms){const id=++next;timers.set(id,{fn,ms});return id;},clearTimeout(id){timers.delete(id);}}, document:{body:{classList:{add(){}}}}, $:id=>nodes[id], finishIntro(){finishes++;} });
  vm.runInContext(ui, context);
  return {nodes,timers,context,run:code=>vm.runInContext(code,context), setTime:value=>{now=value;}, get finishes(){return finishes;}};
}
test('every intro starts a fresh ten seconds and pausing preserves remaining time', () => {
  const h = timerHarness(); h.run('beginIntroPlayback()');
  assert.equal([...h.timers.values()][0].ms, 10000);
  h.setTime(3000); h.run('toggleIntroPlayback()'); assert.equal(h.timers.size, 0);
  h.setTime(7000); h.run('toggleIntroPlayback()'); assert.equal([...h.timers.values()][0].ms, 7000);
  h.run('beginIntroPlayback()'); assert.equal(h.timers.size, 1); assert.equal([...h.timers.values()][0].ms, 10000);
});
test('welcome close is hidden for five seconds, resets on replay and has no countdown', () => {
  const h = timerHarness(); h.run('showWelcome()');
  assert.equal(h.nodes.welcomeClose.hidden, true); assert.equal(h.nodes.welcomeContinue.disabled, true);
  const timer = [...h.timers.values()][0]; assert.equal(timer.ms, 5000); timer.fn();
  assert.equal(h.nodes.welcomeClose.hidden, false); assert.equal(h.nodes.welcomeContinue.disabled, false);
  h.run('showWelcome()'); assert.equal(h.nodes.welcomeClose.hidden, true);
});
function element(tag) { return {tag, children:[], textContent:'', append(...children){this.children.push(...children)}, replaceChildren(...children){this.children=children}}; }
test('employer links refer only to the current applicant’s original file and stale links are revoked', () => {
  const hosts = {appResume:element('section')}; const created = []; const revoked = [];
  const url = {createObjectURL(file){created.push(file);return 'blob:resume-'+created.length},revokeObjectURL(value){revoked.push(value)}};
  const context = vm.createContext({ForwardProfile:model, Blob, URL:url, document:{createElement:element}, $:id=>hosts[id]});
  vm.runInContext(controller.slice(0, controller.lastIndexOf('initializeProfileApp();')),context);
  const file = new Blob(['%PDF original bytes'],{type:'application/pdf'});
  context.person = {resumeFile:file,attachmentName:'original-resume.pdf'};
  vm.runInContext("renderResumeDownload('appResume', person)",context);
  const links = hosts.appResume.children[2].children;
  assert.equal(links[1].download,'original-resume.pdf'); assert.equal(links[1].href,'blob:resume-1'); assert.equal(created[0],file);
  vm.runInContext("renderResumeDownload('appResume', {name:'A different sample applicant'})",context);
  assert.deepEqual(revoked,['blob:resume-1']); assert.equal(created.length,1);
  assert.equal(hosts.appResume.children.at(-1).textContent,'No résumé is attached to this profile.');
});
test('saving featured roles snapshots edits without losing original work history', async () => {
  const resume = require('./resume-tools.js');
  const inputs = Object.fromEntries(resume.fields.map(key=>['profile'+key[0].toUpperCase()+key.slice(1)+'Input',{value:key==='experience'?history:''}]));
  const writes = [];
  const context = vm.createContext({ForwardProfile:model,ForwardResume:{saveProfile:async record=>writes.push(record)},$:id=>inputs[id],document:{querySelectorAll:()=>[]},applicantPreferences:{},applicantQuizComplete:true,applicantLaunched:false});
  vm.runInContext(controller.slice(0,controller.lastIndexOf('initializeProfileApp();')),context);
  vm.runInContext("profileStorageReady=true;featuredRoles[0]={title:'Selected role',dates:'2020–2024',summary:'My contribution'}",context);
  const saving = vm.runInContext('saveApplicantProfile()',context);
  vm.runInContext("featuredRoles[0].summary='A newer edit'",context);
  await saving;
  assert.equal(writes[0].featuredRoles[0].summary,'My contribution');
  assert.equal(writes[0].fields.experience,history);
});
