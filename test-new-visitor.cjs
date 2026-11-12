const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const model=require('./profile-model.js');
const fields=require('./resume-tools.js').fields;
const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
const appScript=html.match(/<script>([\s\S]*?)<\/script>/)[1];
const profiles=fs.readFileSync(path.join(__dirname,'demo-applicants.js'),'utf8');
const appModel=profiles+'\n'+appScript.slice(0,appScript.indexOf('    document.querySelectorAll(".role-button")'));
function applicantHarness() {
  const inputs=Object.fromEntries(fields.map(key=>['profile'+key[0].toUpperCase()+key.slice(1)+'Input',{value:''}]));
  inputs.profileNameInput.value='Riley Park';
  inputs.profileRoleInput.value='Customer Experience Specialist';
  inputs.profileSummaryInput.value='I help customers and colleagues.';
  const context=vm.createContext({assert,document:{getElementById:id=>inputs[id]},
    profileWithinLimits:()=>model.violations({summary:inputs.profileSummaryInput.value}).length===0,
    featuredRoles:[],savedResumeFile:null});
  vm.runInContext(appModel+'\nshowToast=()=>{};applicantQuizComplete=true;applicantLaunched=true;',context);
  return {inputs,run:code=>vm.runInContext(code,context)};
}
test('removing a required field withdraws the local applicant until explicitly relaunched',()=>{
  for(const key of ['Name','Role','Summary']) {
    const h=applicantHarness();
    h.run('syncInteractiveApplicant();assert.equal(getInteractiveApplicant().name,"Riley Park")');
    h.inputs['profile'+key+'Input'].value='';
    h.run('assert.equal(getInteractiveApplicant(),null);syncInteractiveApplicant();assert.equal(applicantLaunched,false);assert.ok(!rankedApplicants.some(person=>person.id==="avery"))');
    h.inputs['profile'+key+'Input'].value='Restored value';
    h.run('syncInteractiveApplicant();assert.equal(getInteractiveApplicant(),null);applicantLaunched=true;syncInteractiveApplicant();assert.equal(rankedApplicants.filter(person=>person.id==="avery").length,1)');
  }
});
test('overlong edits remove the stale applicant without skipping the next person in the queue',()=>{
  const h=applicantHarness();
  h.run('rankedApplicants=[{id:"avery",name:"Old snapshot"},{id:"alex"},{id:"jordan"}];currentIndex=1');
  h.inputs.profileSummaryInput.value=Array(101).fill('word').join(' ');
  h.run('syncInteractiveApplicant();assert.equal(applicantLaunched,false);assert.equal(currentIndex,0);assert.equal(currentApplicant().id,"alex");assert.deepEqual(rankedApplicants.map(person=>person.id),["alex","jordan"])');
  assert.equal(model.count(h.inputs.profileSummaryInput.value),101,'keeps the full draft for editing');
});
test('fresh applicant and hiring forms contain no prefilled personal information',()=>{
  for(const key of fields) {
    const id='profile'+key[0].toUpperCase()+key.slice(1)+'Input';
    const tag=html.match(new RegExp('<(input|textarea)\\b[^>]*id="'+id+'"[^>]*>([^<]*)'));
    assert.ok(tag,id);
    assert.doesNotMatch(tag[0],/\bvalue="[^"]+"/,id);
    if(tag[1]==='textarea') assert.equal(tag[2].trim(),'',id);
  }
  assert.doesNotMatch(html.match(/<input id="hiringTeamName"[^>]*>/)[0],/\bvalue=/);
});
test('résumé review requires acknowledgement before combining existing information',()=>{
  const nodes={};
  const makeNode=()=>({value:'',children:[],append(...children){this.children.push(...children)},replaceChildren(){this.children=[]},focus(){}});
  const context=vm.createContext({ForwardProfile:model,$:id=>nodes[id]??(nodes[id]=makeNode()),document:{createElement:makeNode}});
  const controller=fs.readFileSync(path.join(__dirname,'profile-controller.js'),'utf8');
  vm.runInContext(controller.slice(0,controller.lastIndexOf('initializeProfileApp();')),context);
  context.result={fields:{name:'Riley Park'},rawText:'Riley Park',warnings:[]};
  vm.runInContext('showResumeImport(result)',context);
  assert.equal(nodes.resumeImportExistingProfile.hidden,true);
  assert.equal(nodes.confirmResumeOwner.required,false);
  nodes.profileNameInput.value='Someone Else';
  nodes.confirmResumeOwner.checked=true;
  vm.runInContext('showResumeImport(result)',context);
  assert.equal(nodes.resumeImportExistingProfile.hidden,false);
  assert.equal(nodes.confirmResumeOwner.required,true);
  assert.equal(nodes.confirmResumeOwner.checked,false,'each new import needs a deliberate choice');
  assert.equal(nodes.profileNameInput.value,'Someone Else','review never overwrites existing fields');
});
