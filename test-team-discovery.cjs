const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const model = require('./team-model.js');
const ui = fs.readFileSync(path.join(__dirname, 'team-discovery.js'), 'utf8');
new vm.Script(ui);
const draft = () => model.normalizeFields(model.samples[0]);
const answers = () => ({...model.samples[0].answers});

test('publishing requires a manager, a role description, and every valid team answer', () => {
  assert.ok(model.issues({},{}).some(error=>error.key==='managerName'));
  assert.ok(model.issues(draft(),{}).some(error=>error.key==='answers'));
  assert.throws(()=>model.publish(draft(),{...answers(),focus:'unknown'}));
  assert.equal(model.issues({...draft(),managerBio:Array(76).fill('word').join(' ')},answers())[0].key,'managerBio');
  assert.equal(model.issues({...draft(),managerBio:Array(75).fill('word').join(' ')},answers()).length,0);
  assert.equal(model.publish(draft(),answers()).id,'local-team');
});
test('draft changes never silently change the published manager profile or team answers', () => {
  const fields=draft(), preferences=answers();
  const published=model.publish(fields,preferences);
  fields.managerName='An unsaved change';preferences.focus='open';
  assert.equal(published.managerName,model.samples[0].managerName);
  assert.equal(published.answers.focus,'protected');
  assert.equal(model.publish(fields,preferences).answers.focus,'open');
});
test('saved drafts stay unpublished and restored published profiles retain their own answer snapshot', () => {
  const state=model.restore({schemaVersion:1,draft:draft(),answers:answers(),questionnaireComplete:true});
  assert.equal(state.published,null);assert.equal(state.questionnaireComplete,true);
  state.published=model.publish(state.draft,state.answers);state.answers.focus='open';
  const restored=model.restore(JSON.parse(JSON.stringify(state)));
  assert.equal(restored.answers.focus,'open');assert.equal(restored.published.answers.focus,'protected');
  restored.published=null;
  assert.equal(model.listings(restored).length,3);
  assert.equal(restored.draft.managerName,state.draft.managerName);
});
test('malformed storage cannot create an incomplete published listing', () => {
  const bad=model.restore({schemaVersion:1,draft:{managerName:99},answers:{focus:'wrong'},questionnaireComplete:true,published:{managerName:'Partial'}});
  assert.equal(bad.draft.managerName,'');assert.equal(bad.questionnaireComplete,false);assert.equal(bad.published,null);
  assert.equal(model.restore({schemaVersion:999,published:model.samples[0]}).published,null);
});
test('sample jobs have complete manager profiles and are explicitly fictional', () => {
  assert.equal(new Set(model.samples.map(sample=>sample.id)).size,3);
  for(const sample of model.samples) {
    assert.equal(sample.sample,true);assert.deepEqual(model.issues(sample,sample.answers),[]);
    assert.ok(sample.managerBio);assert.ok(sample.teamStory);assert.ok(sample.roleSummary);
  }
});
test('job search uses explicit text and never removes a role because of work preferences', () => {
  const state=model.restore(null);const list=model.listings(state);
  assert.equal(model.search(list,'REMOTE')[0].id,'sample-learning');
  assert.equal(model.search(list,'jordan design')[0].id,'sample-design');
  assert.equal(model.search(list,'unknown-role').length,0);
  assert.equal(model.search(list,'').length,3);
  state.published=model.publish(draft(),{...answers(),focus:'open'});
  assert.equal(model.listings(state).length,4);
  assert.equal(model.search(model.listings(state),'').length,4);
});
function element() {return {children:[],textContent:'',append(...children){this.children.push(...children);},replaceChildren(...children){this.children=children;}};}
test('applicant comparison is optional and manager previews do not include the applicant’s private answers',()=>{
  const context=vm.createContext({ForwardTeams:model,discussionTopics:[{key:'focus',title:'Quiet focus'}],applicantQuizComplete:true,applicantPreferences:{focus:'open'},makeElement(tag,className,text){return {...element(),tag,className,textContent:text||''};}});
  vm.runInContext(ui,context);context.host=element();context.preferences=answers();
  vm.runInContext('renderTeamAnswers(host,preferences,false)',context);
  assert.equal(context.host.children[0].children.length,2);
  vm.runInContext('renderTeamAnswers(host,preferences,true)',context);
  assert.equal(context.host.children[0].children[2].textContent,'Your preference: Short blocks between interactions');
});
test('storage failure does not report publication or replace the last shared snapshot',()=>{
  const status=element();let fail=true;const writes=[];
  const context=vm.createContext({ForwardTeams:model,$:()=>status,localStorage:{setItem(key,value){if(fail)throw Error('Full');writes.push(value);}}});
  vm.runInContext(ui,context);context.next={...model.restore(null),published:model.publish(draft(),answers())};
  assert.equal(vm.runInContext('writeHiringState(next)',context),false);
  assert.equal(vm.runInContext('hasPublishedTeam()',context),false);
  assert.match(status.textContent,/Could not save/);
  fail=false;
  assert.equal(vm.runInContext('writeHiringState(next)',context),true);
  assert.equal(vm.runInContext('hasPublishedTeam()',context),true);
  assert.equal(JSON.parse(writes[0]).published.managerName,draft().managerName);
});
