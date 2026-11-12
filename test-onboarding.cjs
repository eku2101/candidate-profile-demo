const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const source = fs.readFileSync(path.join(__dirname, 'onboarding.js'), 'utf8');
const ui = fs.readFileSync(path.join(__dirname, 'forward-ui.js'), 'utf8');
const app = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const appModel = app.slice(0, app.indexOf('    document.querySelectorAll(".role-button")'));

function node() {
  return { hidden:false, value:'', textContent:'', tagName:'BUTTON', classList:{add(){},remove(){},toggle(){}},
    setAttribute(){},removeAttribute(){},focus(){this.focused=true;},checkValidity(){return Boolean(this.value);},reportValidity(){this.reported=true;} };
}
function harness() {
  const nodes = {siteShell:node(),applicantQuizModal:node(),hiringQuizModal:node()};
  const calls = [];
  const context = vm.createContext({ document:{activeElement:node(),body:node()},$:id=>nodes[id],
    applicantQuizComplete:false,hiringQuizComplete:false,applicantLaunched:false,forwardPage:'home',
    applicantPreferences:{},hiringCriteria:{},renderForwardHome(){},renderApplicantPrivacyStatus(){},renderRoleBrief(){},hasPublishedTeam(){return false;},
    showRoleChooser(){calls.push('roles');},navigateForward(page){calls.push(page);},showApplicantPage(page){calls.push(page);},showBuilderStep(step){calls.push(step);},renderApplicantCard(){} });
  vm.runInContext(source,context);
  const run = code => vm.runInContext(code,context);
  for (const role of ['applicant','hiring']) {
    const suffixes = ['Focus','Brainstorming','Communication','CheckIns','Rhythm','Environment'];
    if (role === 'hiring') suffixes.unshift('Experience','TeamName');
    suffixes.forEach(suffix => { nodes[role+suffix]=node(); });
    const panels = Array.from({length:suffixes.length/2},(_,index)=>({hidden:false,querySelector:()=>node(),
      querySelectorAll:()=>suffixes.slice(index*2,index*2+2).map(suffix=>nodes[role+suffix])}));
    context.flow = {step:0,panels,markers:panels.map(node),progress:node(),back:node(),next:node(),submit:node(),error:node(),dialog:node(),exit:node(),savedNote:node()};
    run(`onboardingFlows.${role}=flow`);
  }
  return {context,nodes,calls,run};
}

test('all original preference questions require deliberate answers for both audiences', () => {
  for (const role of ['applicant','hiring']) {
    for (const key of ['Focus','Brainstorming','Communication','CheckIns','Rhythm','Environment']) {
      const select = html.match(new RegExp('<select id="'+role+key+'" required>([\\s\\S]*?)</select>'));
      assert.ok(select,role+key);
      assert.match(select[1],/value="" disabled selected/);
    }
  }
  for (const key of ['Focus','Brainstorming','Communication','CheckIns','Rhythm','Environment']) {
    const values = role => [...html.match(new RegExp('<select id="'+role+key+'" required>([\\s\\S]*?)</select>'))[1].matchAll(/value="([^"]*)"/g)].map(match=>match[1]);
    assert.deepEqual(values('applicant'),values('hiring'),key);
  }
});

test('choosing either role opens onboarding even for a returning visitor', () => {
  const calls=[]; const nodes={};
  const context=vm.createContext({document:{getElementById:id=>nodes[id]??=(node())},calls});
  vm.runInContext(appModel,context);
  vm.runInContext("setHeroForRole=()=>{};navigateForward=page=>calls.push(page);openWorkOnboarding=(role,entering)=>calls.push([role,entering]);applicantQuizComplete=true;hiringQuizComplete=true;setRole('applicant');setRole('hiring');",context);
  assert.equal(JSON.stringify(calls),JSON.stringify(['home',['applicant',true],'home',['hiring',true]]));
});

test('workspace navigation cannot bypass an incomplete questionnaire', () => {
  const h=harness(); vm.runInContext(ui,h.context);
  h.context.activeRole='applicant';
  h.run("navigateForward('profile')");
  assert.equal(h.run('activeOnboarding.role'),'applicant');
  assert.equal(h.nodes.siteShell.inert,true);
});

test('an unanswered step cannot advance and final validation opens the missing step', () => {
  const h=harness();
  assert.equal(h.run("submitOnboarding('applicant')"),false);
  assert.equal(h.run('onboardingFlows.applicant.step'),0);
  assert.equal(h.nodes.applicantFocus.reported,true);
  h.nodes.applicantFocus.value='protected';h.nodes.applicantBrainstorming.value='frequent';
  assert.equal(h.run("submitOnboarding('applicant')"),false);
  assert.equal(h.run('onboardingFlows.applicant.step'),1);
  h.run("showOnboardingStep('applicant',2)");
  assert.equal(h.run("submitOnboarding('applicant')"),false);
  assert.equal(h.run('onboardingFlows.applicant.step'),1);
  assert.equal(h.nodes.applicantCommunication.focused,true);
});

test('completed answers can be submitted and reopening discards unsaved preference edits', () => {
  const h=harness();
  const answers={focus:'protected',brainstorming:'frequent',communication:'written',checkIns:'milestones',rhythm:'steady',environment:'small'};
  h.context.applicantPreferences=answers;h.context.applicantQuizComplete=true;
  h.run("openWorkOnboarding('applicant',true)");
  assert.equal(h.nodes.applicantFocus.value,'protected');
  h.run("showOnboardingStep('applicant',2)");
  assert.equal(h.run("submitOnboarding('applicant')"),true);
  h.nodes.applicantFocus.value='open';
  h.run("leaveWorkOnboarding();openWorkOnboarding('applicant')");
  assert.equal(h.nodes.applicantFocus.value,'protected');
  assert.equal(answers.focus,'protected');
});

test('finishing onboarding routes applicants to their builder and new employers to their profile', () => {
  const h=harness();
  h.run("openWorkOnboarding('applicant',true);finishWorkOnboarding('applicant')");
  assert.deepEqual(h.calls,['builder',0]);
  assert.equal(h.nodes.siteShell.inert,false);
  h.run("openWorkOnboarding('hiring',true);finishWorkOnboarding('hiring')");
  assert.equal(h.calls.at(-1),'profile');
});

test('leaving unfinished onboarding returns to role selection and editing preserves the current page', () => {
  const h=harness();
  h.run("openWorkOnboarding('applicant',true);leaveWorkOnboarding()");
  assert.deepEqual(h.calls,['roles']);
  assert.equal(h.nodes.siteShell.inert,false);
  h.context.applicantQuizComplete=true;
  h.run("openWorkOnboarding('applicant');finishWorkOnboarding('applicant')");
  assert.deepEqual(h.calls,['roles']);
});
