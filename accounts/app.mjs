import {accountConfig} from './config.js?v=public-signup-1';
import {configReady,applicantFields,questions,questionLabels,normalizeApplicant,applicantIssues,importReviewedFields,wordCount,discussionPrompts} from './model.mjs';
import {createAccountAPI} from './api.mjs';
import {validateAuthInput,submitAuthentication,authErrorMessage,newPasswordError} from './auth-flow.mjs?v=public-signup-1';
const $=id=>document.getElementById(id);
const node=(tag,text,className)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(className)e.className=className;return e;};
const button=(text,fn,kind='secondary')=>{const e=node('button',text,'button '+kind);e.type='button';e.addEventListener('click',()=>run(e,fn));return e;};
let client,api,user,account,draft,version=0,publication=null,files=[],shares=[],teams=[],step=0,route='profile',dirty=false,revision=0,busy=false,authMode='signin',sessionEpoch=0,recovery=false,pendingEmail='';
function status(message,error=false){
  const local=!$('authPage').hidden?$('authStatus'):!$('confirmationPage').hidden?$('confirmationStatus'):null;
  const output=local||$('status');output.textContent=message;output.classList.toggle('error',error);
  if(local){$('status').textContent='';if(message)local.scrollIntoView({block:'nearest'});}
  if(error&&$('reviewDialog').open&&$('dialogStatus')){
    $('dialogStatus').textContent=message;$('dialogStatus').hidden=false;$('dialogStatus').scrollIntoView({block:'nearest'});
  }
}
async function run(control,fn){
  if(busy)return;busy=true;if(control){control.disabled=true;control.setAttribute('aria-busy','true');}
  try{await fn();}catch(error){status(error.message||'That request could not finish. Your unsaved work is still here.',true);}
  finally{busy=false;if(control?.isConnected){control.disabled=false;control.removeAttribute('aria-busy');}}
}
function showPage(id){for(const name of ['setupNotice','authPage','confirmationPage','recoveryPage','rolePage','workspace'])$(name).hidden=name!==id;}
function changed(){dirty=true;revision++;updateSaveStatus();}
function updateSaveStatus(){if($('draftSaveStatus'))$('draftSaveStatus').textContent=dirty?'Unsaved changes · Save before leaving this page.':version?'Saved to your account · Available on your other devices.':'New private draft · Nothing saved yet.';}
function dialog(title,build){const host=$('dialogBody');host.replaceChildren();const heading=node('h2',title);heading.id='dialogTitle';const error=node('p',undefined,'status error');error.id='dialogStatus';error.hidden=true;error.setAttribute('role','alert');host.append(heading,error);build(host);$('reviewDialog').showModal();}
function closeDialog(){$('reviewDialog').close();$('dialogBody').replaceChildren();}
function heading(eyebrow,title,intro){$('workspaceEyebrow').textContent=eyebrow;$('workspaceTitle').textContent=title;$('workspaceIntro').textContent=intro;}
function fieldsGrid(definitions,values,onChange,prefix){
  const grid=node('div',undefined,'form-grid');
  for(const [key,rule] of Object.entries(definitions)){
    const long=Boolean(rule.words)||['summary','experience','education','credentials','mission','values','wellbeing','support','community'].includes(key);
    const group=node('div',undefined,long?'full':'');
    const label=node('label',rule.label+(rule.required?' *':''));label.htmlFor=prefix+key;
    const input=node(long?'textarea':'input');input.id=label.htmlFor;input.value=values[key]||'';if(!long)input.type=key==='email'?'email':'text';
    const count=node('p',undefined,'counter');count.id=prefix+'count-'+key;input.setAttribute('aria-describedby',count.id);
    const refresh=()=>{const total=rule.words?wordCount(input.value):Array.from(input.value).length;count.textContent=`${total} / ${rule.words||rule.max} ${rule.words?'words':'characters'}`;count.classList.toggle('over-limit',total>(rule.words||rule.max));};
    input.addEventListener('input',()=>{values[key]=input.value;onChange();refresh();});refresh();group.append(label,input,count);grid.append(group);
  }return grid;
}
function questionForm(values,hiring=false){
  const grid=node('div',undefined,'form-grid');
  for(const [key,options] of Object.entries(questions)){
    if(!hiring&&key==='experience')continue;
    const group=node('div');const label=node('label',questionLabels[key]);label.htmlFor='answer-'+key;const select=node('select');select.id=label.htmlFor;const empty=node('option','Choose an answer');empty.value='';select.append(empty);
    for(const [value,text] of Object.entries(options)){const option=node('option',text);option.value=value;select.append(option);}select.value=values[key]||'';select.addEventListener('change',()=>{values[key]=select.value;changed();});group.append(label,select);grid.append(group);
  }return grid;
}
function publicApplicant(doc){return {...Object.fromEntries(Object.keys(applicantFields).filter(k=>!['email','phone'].includes(k)).map(k=>[k,doc.fields[k]])),featuredRoles:doc.featuredRoles};}
function renderApplicantStory(host,profile){
  host.append(node('h2',profile.name||'Your name'),node('p',[profile.role,profile.location].filter(Boolean).join(' · '),'card-meta'),node('p',profile.summary||'Add your introduction.','profile-lead profile-text'));
  for(const role of profile.featuredRoles||[])if(role.title.trim()){const section=node('section',undefined,'notice');section.append(node('h3',role.title),node('p',role.dates,'help'),node('p',role.summary,'profile-text'));host.append(section);}
  for(const key of Object.keys(applicantFields).filter(k=>!['name','role','location','summary','email','phone'].includes(k)))if(profile[key]){const section=node('details');section.append(node('summary',applicantFields[key].label),node('p',profile[key],'profile-text'));host.append(section);}
}
function currentFile(){return files.find(f=>f.id===draft?.resumeId);}
async function loadOwned(){
  const epoch=sessionEpoch;
  const [saved,published,documents,grants]=await Promise.all([api.draft(account.role,user.id),api.publication(account.role,user.id),api.files(),api.shares()]);
  if(epoch!==sessionEpoch)return false;
  draft=account.role==='applicant'?normalizeApplicant(saved?.document):{fields:ForwardTeams.normalizeFields(saved?.document?.fields),answers:ForwardTeams.normalizeAnswers(saved?.document?.answers)};
  version=saved?.version||0;publication=published;files=documents;shares=grants;dirty=false;revision=0;return true;
}
async function saveDraft(){
  const savingRevision=revision;const saved=await api.save(structuredClone(draft),version);version=saved.version;
  if(revision===savingRevision)dirty=false;updateSaveStatus();status(dirty?'Saved the previous edits. You have newer unsaved changes.':'Your private draft is saved to your account.');return saved;
}
async function navigate(next){route=next;renderNav();if(next==='profile')renderEditor();else if(next==='discover')await renderDiscovery();else await renderSharing();$('workspaceTitle').focus();window.scrollTo(0,0);}
function renderNav(){
  const items=account.role==='applicant'?[['profile','My profile'],['discover','Discover teams'],['sharing','Sharing']]:[['profile','My hiring profile'],['sharing','Applicants']];
  $('accountNav').replaceChildren(...items.map(([id,label])=>{const b=button(label,()=>navigate(id));if(route===id)b.setAttribute('aria-current','page');return b;}));$('accountNav').hidden=false;
}
function renderEditor(){
  showPage('workspace');heading(account.role==='applicant'?'YOUR APPLICANT WORKSPACE':'YOUR HIRING WORKSPACE',account.role==='applicant'?'Your story. Your way.':'Let applicants meet you, too.',account.role==='applicant'?'Save a private draft, then choose the hiring managers you want to share it with.':'Introduce your team, the opportunity, and how you work together.');
  const host=$('workspaceContent');host.replaceChildren();
  const saveStatus=node('div',undefined,'draft-status');const message=node('p');message.id='draftSaveStatus';saveStatus.append(message);
  saveStatus.append(button('Reload saved version',()=>{
    dialog('Reload your saved profile?',body=>{body.append(node('p','This replaces any unsaved edits in this tab with the version saved to your account.'),button('Reload saved version',async()=>{await loadOwned();closeDialog();renderEditor();status('Your saved profile has been loaded.');}));});
  }));host.append(saveStatus);
  const panel=node('section',undefined,'panel');
  const labels=account.role==='applicant'?['Work preferences','About you','Your top three','Values & teamwork','Review & share']:['Team questionnaire','Manager & role','Review & publish'];
  step=Math.min(step,labels.length-1);const steps=node('nav',undefined,'steps');steps.setAttribute('aria-label','Profile steps');
  labels.forEach((label,i)=>{const b=button(`${i+1}. ${label}`,()=>{step=i;renderEditor();});if(i===step)b.setAttribute('aria-current','step');steps.append(b);});panel.append(steps,node('p',`STEP ${step+1} OF ${labels.length}`,'eyebrow'),node('h2',labels[step]));
  if(step===0){panel.append(node('p','There is no ideal answer. Differences help start a conversation and never exclude someone.'));
    panel.append(node('p',account.role==='applicant'?'Your selected answers stay private. Managers you share with receive discussion questions about differences, without seeing your selected answers. You can compare your answers with a manager’s published answers when exploring a team.':'These team answers will be included when you publish your manager profile.','notice'));
    panel.append(questionForm(account.role==='applicant'?draft.preferences:draft.answers,account.role==='hiring'));
  }else if(account.role==='hiring'&&step===1){panel.append(fieldsGrid(ForwardTeams.fields,draft.fields,changed,'manager-'));}
  else if(account.role==='applicant'&&step===1){
    const upload=node('details');upload.append(node('summary','Start with your résumé'));const label=node('label','Choose a résumé · PDF, JPG, PNG, or WebP · up to 10 MB');label.htmlFor='cloudResume';const input=node('input');input.type='file';input.id='cloudResume';input.accept='.pdf,.jpg,.jpeg,.png,.webp';input.addEventListener('change',()=>run(input,()=>reviewResume(input.files[0])));
    upload.append(label,input,node('p','PDF text is read on this device. Review it before saving the document to your account. Images attach a document but do not autofill text.','help'));
    const pasteLabel=node('label','Or paste résumé text');pasteLabel.htmlFor='cloudPaste';const paste=node('textarea');paste.id='cloudPaste';upload.append(pasteLabel,paste,button('Review pasted résumé',()=>{if(paste.value.trim().length<25)throw new Error('Paste your résumé text first.');reviewImport(ForwardResume.parseResumeText(paste.value),null);}));
    upload.append(button('Import this browser’s demo profile',importBrowserDraft));panel.append(upload);
    panel.append(node('p',currentFile()?'Saved résumé: '+currentFile().name:'No résumé attached.','help'));
    panel.append(fieldsGrid(Object.fromEntries(Object.entries(applicantFields).slice(0,7)),draft.fields,changed,'applicant-'));
    const docs=node('details');docs.append(node('summary','Manage my documents'));renderFiles(docs);panel.append(docs);
  }else if(account.role==='applicant'&&step===2){
    panel.append(node('p','Feature up to three roles that best show your growth, contribution, and impact. Keep your full work history below.'));
    const suggestions=ForwardProfile.suggestRoles(draft.fields.experience);
    draft.featuredRoles.forEach((role,i)=>{const section=node('details');section.open=i===0;section.append(node('summary',`Featured role ${i+1}`));if(suggestions.length){const label=node('label','Choose from your work history');label.htmlFor='suggest-'+i;const select=node('select');select.id=label.htmlFor;select.append(new Option('Choose a role…',''));suggestions.forEach((r,j)=>select.append(new Option(r.title+' · '+r.dates,String(j))));select.addEventListener('change',()=>{if(select.value==='')return;draft.featuredRoles[i]={...suggestions[Number(select.value)]};changed();renderEditor();});section.append(label,select);}section.append(fieldsGrid({title:{label:'Role & organization',max:160},dates:{label:'Dates',max:80},summary:{label:'What did you contribute, and what changed?',words:100}},role,changed,'featured-'+i+'-'));section.append(button('Clear highlight',()=>{draft.featuredRoles[i]={title:'',dates:'',summary:''};changed();renderEditor();}));panel.append(section);});
    const full=node('details');full.append(node('summary','Full work history, education & achievements'),fieldsGrid(Object.fromEntries(['experience','education','credentials'].map(k=>[k,applicantFields[k]])),draft.fields,changed,'history-'));panel.append(full);
  }else if(account.role==='applicant'&&step===3){panel.append(fieldsGrid(Object.fromEntries(Object.entries(applicantFields).slice(10)),draft.fields,changed,'story-'));}
  else renderPublishing(panel);
  const actions=node('div',undefined,'actions');if(step>0)actions.append(button('← Back',()=>{step--;renderEditor();}));if(step<labels.length-1)actions.append(button('Continue →',()=>{if(step===0){const answers=account.role==='applicant'?draft.preferences:draft.answers;const missing=Object.keys(answers).find(k=>!answers[k]);if(missing){$('answer-'+missing).focus();throw new Error('Choose an answer to each question. Different preferences are welcome.');}}step++;renderEditor();},'primary'));panel.append(actions);host.append(panel);
  const strip=node('div',undefined,'save-strip');strip.append(node('p','Drafts are private until you choose to share.','help'));const controls=node('div',undefined,'actions');controls.append(button('Save private draft',saveDraft,'primary'));strip.append(controls);host.append(strip);updateSaveStatus();
}
function renderPublishing(panel){
  const applicant=account.role==='applicant';
  panel.append(node('p',publication?`A shared version exists. ${dirty||publication.version!==version?'Your latest draft edits are not shared yet.':'Your saved draft and shared version match.'}`:'No profile is shared yet.','notice'));
  if(applicant)renderApplicantStory(panel,publicApplicant(draft));else renderTeamStory(panel,{...draft.fields,answers:draft.answers});
  if(applicant)panel.append(node('p',currentFile()?'Résumé to include: '+currentFile().name:'No résumé will be included. You can still share your profile.','help'));
  panel.append(button(applicant?'Review sharing version →':'Review publication →',()=>{
    const issues=applicant?applicantIssues(draft,true):ForwardTeams.issues(draft.fields,draft.answers);
    if(issues.length)throw new Error(issues[0].message);
    const approvedRevision=revision;
    dialog(applicant?'Save the version managers can see?':'Publish your hiring profile?',body=>{
      body.append(node('p',applicant?'Only managers you explicitly share with can see this version. Managers already on your sharing list will see these updates, including the selected résumé. Your questionnaire answers and separate contact fields stay private.':'Signed-in Forward users will be able to see your manager profile, role description, and team questionnaire answers. Your private draft changes will stay private until you publish again.'));
      body.append(button(applicant?'Save sharing version':'Publish hiring profile',async()=>{
        if(approvedRevision!==revision)throw new Error('Your draft changed. Close this review and review it again.');
        await saveDraft();if(approvedRevision!==revision)throw new Error('New edits arrived during saving. Review them before publishing.');
        publication=await api.publish(account.role,version);closeDialog();renderEditor();status(applicant?'Sharing version saved. Choose managers in Discover teams or Sharing.':'Your hiring profile is published. Applicants can find it in Discover teams.');
      },'primary'));
    });
  },'primary'));
  if(publication)panel.append(button(applicant?'Unshare from everyone':'Unpublish hiring profile',()=>{
    dialog(applicant?'Withdraw all sharing?':'Unpublish your hiring profile?',body=>{body.append(node('p',applicant?'Managers will lose future access to your profile and résumé. This cannot retrieve files they already downloaded. Your private draft stays saved.':'Your manager profile will disappear from Discover teams. Your draft stays saved. Existing applicants who shared with you remain in your applicant list.'),button('Confirm withdrawal',async()=>{await api.unpublish();publication=null;shares=await api.shares();closeDialog();renderEditor();status('Sharing withdrawn. Your private draft is saved.');},'danger'));});
  },'danger'));
}
async function reviewResume(file){
  if(!file)return;
  if(file.size>10485760||!['application/pdf','image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Choose a PDF, JPG, PNG, or WebP no larger than 10 MB.');
  status(file.type==='application/pdf'?'Reading your PDF on this device…':'Review your document before uploading.');
  if(file.type==='application/pdf')reviewImport(await ForwardResume.extractPdf(file,status),file);
  else reviewImport({fields:{},warnings:['Image files attach your document without filling profile text.'],rawText:''},file);
}
function reviewImport(result,file,wholeProfile=null){
  let uploadedFile=null;
  const reviewed=Object.fromEntries(Object.keys(applicantFields).slice(0,10).map(key=>[key,result.fields[key]||'']));
  dialog('Review your résumé details',body=>{
    body.append(node('p',wholeProfile?'Review this browser’s saved information before copying it to your signed-in account. This replaces the current account draft fields and preferences. Photos are not copied.':'Check the extracted details before saving. Non-empty fields replace matching draft fields; your existing personal story, preferences, and highlights stay as written.'));
    for(const warning of result.warnings||[])body.append(node('p',warning,'notice'));
    body.append(fieldsGrid(Object.fromEntries(Object.entries(applicantFields).slice(0,10)),reviewed,()=>{},'import-'));
    const check=node('input');check.type='checkbox';check.id='ownResumeConfirmation';const label=node('label');label.append(check,document.createTextNode('This information is mine. '+(file?`Upload ${file.name} to my private account.`:'Save these details to my private account.')));body.append(label);
    body.append(button('Save résumé to my account',async()=>{
      if(!check.checked){check.focus();throw new Error('Confirm that this is your information before importing.');}
      const next=importReviewedFields(wholeProfile||draft,reviewed);
      if(file){if(!uploadedFile){uploadedFile=await api.fileRequest({method:'POST',file});files.push(uploadedFile);}next.resumeId=uploadedFile.id;}
      draft=next;changed();await saveDraft();closeDialog();step=2;renderEditor();status('Résumé information saved to your account. Choose the experiences you want to feature.');
    },'primary'));
  });
}
async function importBrowserDraft(){
  const record=ForwardResume.validateProfile(await ForwardResume.loadProfile());if(!record)throw new Error('No saved applicant profile was found in this browser. You can upload your résumé instead.');
  reviewImport({fields:record.fields,warnings:[],rawText:record.resumeText||''},record.resumeFile instanceof Blob?record.resumeFile:null,normalizeApplicant(record));
}
function renderFiles(host){
  if(!files.length){host.append(node('p','No documents uploaded.','help'));return;}
  files.forEach(file=>{const row=node('div',undefined,'file-row');const copy=node('div');copy.append(node('strong',file.name),node('small',`${(file.size/1024).toFixed(0)} KB${file.id===draft.resumeId?' · Selected for your draft':''}`));const actions=node('div',undefined,'file-actions');
    actions.append(button('Download',()=>downloadFile(file)));
    actions.append(button(file.id===draft.resumeId?'Detach':'Use this résumé',()=>{draft.resumeId=file.id===draft.resumeId?null:file.id;changed();renderEditor();}));
    if(file.id!==draft.resumeId&&file.id!==publication?.resume_id)actions.append(button('Delete',()=>dialog('Delete this unused document?',body=>{body.append(node('p',`${file.name} will be permanently removed from your account.`),button('Delete document',async()=>{await api.fileRequest({method:'DELETE',id:file.id});files=files.filter(f=>f.id!==file.id);closeDialog();renderEditor();status('Document removed.');},'danger'));}),'danger'));
    row.append(copy,actions);host.append(row);
  });
}
async function downloadFile(file){
  const blob=await api.fileRequest({id:file.id});if(!(blob instanceof Blob))throw new Error('The document response was invalid. Please try again.');
  const url=URL.createObjectURL(blob);const a=node('a');a.href=url;a.download=file.name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
function renderTeamStory(host,profile){
  host.append(node('h2',profile.managerName||'Your name'),node('p',[profile.managerTitle,profile.company].filter(Boolean).join(' · '),'card-meta'),node('p',profile.managerBio,'profile-text'));
  host.append(node('h3',profile.roleTitle||'Your opportunity'),node('p',[profile.location,profile.employmentType].filter(Boolean).join(' · '),'help'),node('p',profile.roleSummary,'profile-text'),node('h3','Culture, support & connection'),node('p',profile.teamStory||'Ask how this team supports people.','profile-text'));
  const answers=node('div',undefined,'team-answers');for(const key of Object.keys(questions)){const section=node('section',undefined,'team-answer');section.append(node('h3',questionLabels[key]),node('p',questions[key][profile.answers?.[key]]||'Not answered yet'));answers.append(section);}host.append(answers);
}
async function renderDiscovery(){
  heading('DISCOVER TEAMS','Choose your next team, too.','Meet the hiring manager and explore how the team works before sharing your story.');
  const host=$('workspaceContent');host.replaceChildren(node('p','Loading teams…'));teams=await api.teams();shares=await api.shares();host.replaceChildren();
  host.append(node('p','Manager and company descriptions are supplied by account holders. Forward has not independently verified their employment or vacancies. Review the person and organization before sharing your résumé.','notice'));
  const label=node('label','Search roles, managers, companies, or locations');label.htmlFor='teamSearch';const search=node('input');search.id='teamSearch';search.type='search';host.append(label,search);const count=node('p',undefined,'help');count.setAttribute('role','status');host.append(count);const cards=node('div',undefined,'cards');host.append(cards);
  const draw=()=>{cards.replaceChildren();const list=teams.filter(t=>[t.profile.managerName,t.profile.company,t.profile.roleTitle,t.profile.location].join(' ').toLowerCase().includes(search.value.trim().toLowerCase()));count.textContent=`${list.length}${teams.length===100?' of the 100 most recently updated':''} teams to explore`;for(const team of list){const card=node('article',undefined,'panel');card.append(node('p',team.profile.company,'eyebrow'),node('h2',team.profile.roleTitle),node('p',team.profile.managerName+' · '+team.profile.location,'card-meta'),node('p',team.profile.roleSummary),button('Meet the manager →',()=>showTeam(team),'primary'));cards.append(card);}if(!list.length)cards.append(node('p','No published teams match yet. Try another search or come back after a manager publishes a profile.','empty'));};search.addEventListener('input',draw);draw();
}
function showTeam(team){
  dialog('Meet the person behind the opportunity',body=>{
    renderTeamStory(body,team.profile);
    const prompts=discussionPrompts(draft.preferences,team.profile.answers);
    const section=node('section',undefined,'notice');section.append(node('h3','Questions to explore together'),node('p','These suggestions are shown only to you. Differences do not rank or disqualify either person.'));
    if(prompts.length){const list=node('ul');for(const p of prompts)list.append(node('li',p.question));section.append(list);}else section.append(node('p','What helps each of us do our best work, and what should we agree on before starting?'));body.append(section);
    const shared=shares.some(s=>s.manager_id===team.owner_id);body.append(button(shared?'Manage sharing':'Share my profile & résumé →',async()=>{
      if(shared){closeDialog();await navigate('sharing');return;}
      if(!publication)throw new Error('Save a sharing version in My profile → Review & share first.');
      closeDialog();dialog('Share with '+team.profile.managerName+'?',confirmation=>{
        confirmation.append(node('p',`You are sharing your saved profile and its attached résumé with ${team.profile.managerName} at ${team.profile.company}. They can view and download the résumé from their own device. Your résumé may include contact information. You can withdraw future access, but cannot retrieve copies already downloaded.`));
        renderApplicantStory(confirmation,publication.profile);
        const attachment=files.find(f=>f.id===publication.resume_id);confirmation.append(node('p',attachment?'Résumé included: '+attachment.name:'No résumé attached to this sharing version.','notice'));
        confirmation.append(button('Share with this manager',async()=>{await api.share(team.owner_id,publication.version);shares=await api.shares();closeDialog();status('Your profile is now shared with '+team.profile.managerName+'.');},'primary'));
      });
    },'primary'));
  });
}
async function renderSharing(){
  const applicant=account.role==='applicant';heading(applicant?'YOU CONTROL ACCESS':'APPLICANTS SHARED WITH YOU',applicant?'Your story. Your choice.':'Meet the people behind the résumé.',applicant?'Only the managers listed here can access your shared profile and résumé.':'These applicants chose to share their profiles and résumés with your account.');
  const host=$('workspaceContent');host.replaceChildren(node('p','Loading…'));
  if(applicant){[shares,teams]=await Promise.all([api.shares(),api.teams()]);host.replaceChildren();if(!shares.length)host.append(node('p','No managers have access yet. Explore Discover teams when you’re ready.','empty'));
    for(const grant of shares){const team=teams.find(t=>t.owner_id===grant.manager_id);const row=node('section',undefined,'panel sharing-row');const copy=node('div');copy.append(node('strong',team?.profile.managerName||'Manager with an unpublished profile'),node('p',team?.profile.company||'Account: '+grant.manager_id));row.append(copy,button('Withdraw access',()=>dialog('Withdraw this manager’s access?',body=>{body.append(node('p','Future profile views and résumé downloads will be blocked. Copies already downloaded cannot be retrieved.'),button('Withdraw access',async()=>{await api.withdraw(grant.manager_id);closeDialog();await renderSharing();status('Access withdrawn.');},'danger'));}),'danger'));host.append(row);}
  }else{
    const applicants=await api.applicants();host.replaceChildren();if(!applicants.length)host.append(node('p','No applicants have shared with you yet. Publish your hiring profile so applicants can meet you and choose to connect.','empty'));
    const cards=node('div',undefined,'cards');for(const person of applicants){const card=node('article',undefined,'panel');card.append(node('h2',person.profile.name),node('p',person.profile.role,'card-meta'),node('p',person.profile.summary),button('Read their full story →',()=>showSharedApplicant(person.owner_id),'primary'));cards.append(card);}host.append(cards);
  }
}
async function showSharedApplicant(id){
  const person=await api.publication('applicant',id);
  if(!person)throw new Error('This applicant is no longer sharing their profile with you.');
  const [documents,prompts]=await Promise.all([api.files(),api.prompts(id)]);
  dialog(person.profile.name,body=>{
    renderApplicantStory(body,person.profile);body.append(node('p','Featured roles are highlights. Read the full résumé for the complete experience and context.','notice'));
    const file=documents.find(f=>f.id===person.resume_id);if(file)body.append(button('Download résumé · '+file.name,()=>downloadFile(file),'primary'));else body.append(node('p','No résumé attached.'));
    body.append(node('h3','Start a conversation'),node('p','These are possible working agreements to explore, never reasons to disqualify someone. The applicant’s selected answers remain private.'));
    if(prompts?.length){const list=node('ul');for(const prompt of prompts)list.append(node('li',prompt.question));body.append(list);}else body.append(node('p','What helps each of us do our best work, and what should we agree on before starting?'));
  });
}
function setAuthMode(mode){
  if(mode!==authMode){
    $('authStatus').textContent='';
    $('authStatus').classList.remove('error');
    $('authEmail').removeAttribute('aria-invalid');
    $('authPassword').removeAttribute('aria-invalid');
  }
  authMode=mode;
  $('signInTab').setAttribute('aria-pressed',String(mode==='signin'));
  $('signUpTab').setAttribute('aria-pressed',String(mode==='signup'));
  $('authSubmit').textContent=mode==='signin'?'Sign in →':'Create account →';
  $('authPassword').autocomplete=mode==='signin'?'current-password':'new-password';
  $('authPassword').minLength=mode==='signin'?1:12;
  $('passwordHelp').textContent=mode==='signup'?'Use at least 12 characters. We’ll email you a confirmation link.':'Your session stays in this tab. Sign out when using a shared computer.';
}
async function handleSession(session,event){
  const epoch=++sessionEpoch;
  if(user&&session?.user?.id!==user.id){location.replace('accounts.html');return;}
  user=session?.user||null;
  $('accountIdentity').replaceChildren();$('accountNav').hidden=true;
  if(!user){draft=null;publication=null;files=[];shares=[];$('workspaceContent').replaceChildren();showPage('authPage');return;}
  const identity=node('span',user.email,'signed-email');
  const leave=async()=>{const result=await client.auth.signOut({scope:'local'});if(result.error)throw result.error;location.replace('accounts.html');};
  const signout=button('Sign out',async()=>{
    if(dirty){
      dialog('Sign out with unsaved changes?',body=>{
        body.append(node('p','Save your draft first to keep your latest edits.'),
          button('Save & sign out',async()=>{await saveDraft();await leave();},'primary'),
          button('Discard edits & sign out',async()=>{dirty=false;await leave();}));
      });
    }else await leave();
  });
  $('accountIdentity').append(identity,signout);
  if(event==='PASSWORD_RECOVERY'||recovery){recovery=true;showPage('recoveryPage');return;}
  const found=await api.account(user.id);if(epoch!==sessionEpoch)return;account=found;
  if(!account){showPage('rolePage');return;}
  if(!await loadOwned())return;step=0;route='profile';renderNav();renderEditor();
}
async function initialize(){
  if(!configReady(accountConfig)){showPage('setupNotice');return;}
  $('accountPreview').hidden=accountConfig.showAccountEntry!==false;
  const {createClient}=await import('./vendor/supabase.js');
  client=createClient(accountConfig.supabaseUrl,accountConfig.publishableKey,{auth:{storage:sessionStorage,persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'implicit',storageKey:'forward-account-session'}});api=createAccountAPI(client);
  if(new URLSearchParams(location.search).get('mode')==='signup')setAuthMode('signup');
  $('signInTab').addEventListener('click',()=>setAuthMode('signin'));$('signUpTab').addEventListener('click',()=>setAuthMode('signup'));
  const returnURL=new URL('accounts.html',location.href).href;
  $('authForm').noValidate=true;
  $('authForm').addEventListener('submit',event=>{
    event.preventDefault();if(busy)return;
    const mode=authMode,email=$('authEmail').value.trim(),password=$('authPassword').value;
    for(const id of ['authEmail','authPassword'])$(id).removeAttribute('aria-invalid');
    const issue=validateAuthInput({mode,email,password});
    if(issue){status(issue.message,true);$(issue.field).setAttribute('aria-invalid','true');$(issue.field).focus();return;}
    run($('authSubmit'),async()=>{
      $('signInTab').disabled=true;$('signUpTab').disabled=true;
      $('authSubmit').textContent=mode==='signup'?'Creating account…':'Signing in…';
      status(mode==='signup'?'Submitting your signup. Please wait…':'Signing in. Please wait…');
      try{
        const result=await submitAuthentication(client.auth,{mode,email,password,returnURL});
        $('authPassword').value='';
        if(result.kind==='confirmation'){
          pendingEmail=result.email;$('confirmationEmail').textContent=pendingEmail;$('confirmationStatus').textContent='';$('status').textContent='';
          showPage('confirmationPage');$('confirmationTitle').focus();$('confirmationTitle').scrollIntoView({block:'center'});
        }else{status('Signed in. Loading your workspace…');await handleSession(result.session);}
      }finally{$('signInTab').disabled=false;$('signUpTab').disabled=false;setAuthMode(mode);}
    });
  });
  $('confirmationResend').addEventListener('click',()=>run($('confirmationResend'),async()=>{
    status('Requesting another confirmation email…');
    const result=await client.auth.resend({type:'signup',email:pendingEmail,options:{emailRedirectTo:returnURL}});
    if(result.error)throw new Error(authErrorMessage(result.error));
    status('If confirmation is still needed, check your inbox and spam folder for a new link.');
  }));
  $('confirmationSignIn').addEventListener('click',()=>{showPage('authPage');setAuthMode('signin');$('authEmail').value=pendingEmail;status('After confirming your email, sign in here to open your profile.');$('authPassword').focus();});
  $('confirmationChangeEmail').addEventListener('click',()=>{showPage('authPage');setAuthMode('signup');status('Check your email address, then submit your signup.');$('authEmail').focus();});
  $('resetPassword').addEventListener('click',()=>run($('resetPassword'),async()=>{if(!$('authEmail').reportValidity())return;const result=await client.auth.resetPasswordForEmail($('authEmail').value.trim(),{redirectTo:returnURL});if(result.error)throw result.error;status('If an account exists for that email, you’ll receive a password-reset link.');}));
  $('resendConfirmation').addEventListener('click',()=>run($('resendConfirmation'),async()=>{if(!$('authEmail').reportValidity())return;const result=await client.auth.resend({type:'signup',email:$('authEmail').value.trim(),options:{emailRedirectTo:returnURL}});if(result.error)throw result.error;status('If confirmation is still needed, check your email for a new link.');}));
  $('recoveryForm').addEventListener('submit',event=>{
    event.preventDefault();
    run(event.submitter,async()=>{
      const password=$('newPassword').value;
      if(password!==$('confirmPassword').value)throw new Error('The passwords do not match.');
      const issue=newPasswordError(password);
      if(issue)throw new Error(issue);
      const result=await client.auth.updateUser({password});
      if(result.error)throw result.error;
      $('recoveryForm').reset();recovery=false;
      await handleSession((await client.auth.getSession()).data.session);
      status('Your password has been updated.');
    });
  });
  document.querySelectorAll('[data-account-role]').forEach(b=>b.addEventListener('click',()=>run(b,async()=>{account=await api.register(b.dataset.accountRole);await loadOwned();step=0;route='profile';renderNav();renderEditor();status('Your account is ready. Start with your work preferences.');})));
  client.auth.onAuthStateChange((event,session)=>{
    if(event==='TOKEN_REFRESHED')return;
    if(event==='PASSWORD_RECOVERY')recovery=true;
    if(event==='SIGNED_OUT'||(user&&session?.user?.id!==user.id)){location.replace('accounts.html');return;}
    if(event==='PASSWORD_RECOVERY'||event==='INITIAL_SESSION')setTimeout(()=>handleSession(session,event).catch(e=>status(e.message,true)),0);
  });
  window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
}
initialize().catch(error=>{showPage('setupNotice');status('Account access could not load. Please try again. '+error.message,true);});
