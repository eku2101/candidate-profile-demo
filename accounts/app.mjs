import {accountConfig} from './config.js?v=public-signup-1';
import {configReady,applicantFields,hiringBackgroundFields,hiringResumeFields,questions,questionLabels,normalizeApplicant,normalizeImages,applicantIssues,importReviewedFields,wordCount,discussionPrompts} from './model.mjs?v=hiring-resume-1';
import {createAccountAPI} from './api.mjs?v=hiring-feedback-1';
import {validateAuthInput,submitAuthentication,authErrorMessage,newPasswordError} from './auth-flow.mjs?v=public-signup-1';
import {installHelpChat} from './help-chat.mjs?v=vera-portrait-1';
const $=id=>document.getElementById(id);
const node=(tag,text,className)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(className)e.className=className;return e;};
const button=(text,fn,kind='secondary')=>{const e=node('button',text,'button '+kind);e.type='button';e.addEventListener('click',()=>run(e,fn));return e;};
let client,api,user,account,draft,version=0,publication=null,files=[],shares=[],teams=[],step=0,route='profile',dirty=false,revision=0,busy=false,authMode='signin',sessionEpoch=0,recovery=false,pendingEmail='';
let stopChat=()=>{};
let stopFeedback=()=>{};
let employerVerification=null;
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
    const long=Boolean(rule.words)||rule.max>1000||['summary','experience','education','credentials','mission','values','wellbeing','support','community'].includes(key);
    const group=node('div',undefined,long?'full':'');
    const label=node('label',rule.label+(rule.required?' *':''));label.htmlFor=prefix+key;
    const input=node(long?'textarea':'input');input.id=label.htmlFor;input.value=values[key]||'';if(!long)input.type=key==='email'?'email':'text';
    const count=node('p',undefined,'counter');count.id=prefix+'count-'+key;input.setAttribute('aria-describedby',count.id);
    const wordLimit=rule.words===true?rule.max:rule.words;
    const limit=wordLimit||rule.max;
    const refresh=()=>{const total=wordLimit?wordCount(input.value):Array.from(input.value).length;count.textContent=`${total} / ${limit} ${wordLimit?'words':'characters'}`;count.classList.toggle('over-limit',total>limit);};
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
function publicApplicant(doc){return {...Object.fromEntries(Object.keys(applicantFields).filter(k=>!['email','phone'].includes(k)).map(k=>[k,doc.fields[k]])),featuredRoles:doc.featuredRoles,images:doc.images};}
function renderApplicantStory(host,profile){
  const identity=node('div',undefined,'profile-identity');
  identity.append(node('h2',profile.name||'Your name'),node('p',[profile.role,profile.location].filter(Boolean).join(' · '),'card-meta'));
  prependPortrait(identity,profile);
  host.append(identity,node('p',profile.summary||'Add your introduction.','profile-lead profile-text'));
  appendShowcase(host,profile,'Project image');
  for(const role of profile.featuredRoles||[])if(role.title.trim()){const section=node('section',undefined,'notice');section.append(node('h3',role.title),node('p',role.dates,'help'),node('p',role.summary,'profile-text'));host.append(section);}
  for(const key of Object.keys(applicantFields).filter(k=>!['name','role','location','summary','email','phone'].includes(k)))if(profile[key]){const section=node('details');section.append(node('summary',applicantFields[key].label),node('p',profile[key],'profile-text'));host.append(section);}
}
function currentFile(){return files.find(f=>f.id===draft?.resumeId);}
function profileImage(profile,slot,alt){
  const demo=profile.demoImages?.[slot];
  const id=profile.images?.[slot];
  if(!demo&&!id)return null;
  const img=node('img',undefined,slot==='portrait'?'profile-portrait':'profile-showcase-image');
  img.alt=alt;
  img.decoding='async';
  if(demo)img.src='assets/'+demo;
  else{
    img.hidden=true;
    api.fileRequest({id}).then(blob=>{
      if(!img.isConnected||!(blob instanceof Blob))return;
      const url=URL.createObjectURL(new Blob([blob],{type:'image/jpeg'}));
      img.addEventListener('load',()=>{img.hidden=false;URL.revokeObjectURL(url);},{once:true});
      img.addEventListener('error',()=>{img.remove();URL.revokeObjectURL(url);},{once:true});
      img.src=url;
    }).catch(()=>img.remove());
  }
  return img;
}
function prependPortrait(host,profile){
  const portrait=profileImage(profile,'portrait','');
  if(portrait)host.prepend(portrait);
}
function appendShowcase(host,profile,label){
  const image=profileImage(profile,'showcase',profile.demoImages?.alt||label);
  if(!image)return;
  const figure=node('figure',undefined,'profile-showcase');
  figure.append(image,node('figcaption',label));
  host.append(figure);
}
async function prepareProfileImage(file,slot){
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||!file.size||file.size>10*1024*1024){
    throw new Error('Choose a JPG, PNG, or WebP image up to 10 MB.');
  }
  let bitmap;
  try{bitmap=await createImageBitmap(file);}
  catch{throw new Error('Forward could not read that image. Try exporting it as a JPG or PNG.');}
  try{
    const scale=Math.min(1,(slot==='portrait'?640:1400)/Math.max(bitmap.width,bitmap.height));
    const canvas=node('canvas');
    canvas.width=Math.max(1,Math.round(bitmap.width*scale));
    canvas.height=Math.max(1,Math.round(bitmap.height*scale));
    const context=canvas.getContext('2d',{alpha:false});
    if(!context)throw new Error('Image preparation is unavailable in this browser.');
    context.fillStyle='#ffffff';
    context.fillRect(0,0,canvas.width,canvas.height);
    context.drawImage(bitmap,0,0,canvas.width,canvas.height);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.86));
    if(!blob||blob.size>2*1024*1024)throw new Error('Choose a smaller image and try again.');
    return new File([blob],file.name.replace(/\.[^.]+$/,'')+'.jpg',{type:'image/jpeg'});
  }finally{bitmap.close();}
}
function renderImageEditor(host){
  const section=node('section',undefined,'notice profile-image-editor');
  section.append(node('h3','Profile images'),node('p','Add an optional portrait and one image. Save your draft to keep your choices, then review and publish when you’re ready.','help'));
  const grid=node('div',undefined,'form-grid');
  const showcaseLabel=account.role==='applicant'?'Project image':'Team image';
  for(const [slot,title] of [['portrait','Profile picture'],['showcase',showcaseLabel]]){
    const group=node('div');
    const input=node('input');
    input.id='profile-image-'+slot;
    input.type='file';
    input.accept='.jpg,.jpeg,.png,.webp';
    const label=node('label',title);
    label.htmlFor=input.id;
    input.addEventListener('change',()=>run(input,async()=>{
      const file=input.files[0];
      if(!file)return;
      try{
        status('Preparing and uploading your image…');
        const prepared=await prepareProfileImage(file,slot);
        const uploaded=await api.fileRequest({method:'POST',file:prepared,kind:slot});
        files.push(uploaded);
        draft.images[slot]=uploaded.id;
        changed();
        renderEditor();
        status('Image added. Save your private draft to keep this change.');
      }finally{input.value='';}
    }));
    group.append(label,input);
    const current=profileImage(draft,slot,slot==='portrait'?'Profile picture preview':title+' preview');
    if(current){
      group.append(current,button('Remove '+title.toLowerCase(),()=>{
        draft.images[slot]=null;
        changed();
        renderEditor();
      }));
    }
    const unused=files.filter(file=>file.kind===slot&&file.id!==draft.images[slot]&&file.id!==publication?.profile.images?.[slot]);
    if(unused.length){
      const manage=node('details');
      manage.append(node('summary','Manage unused images'));
      for(const file of unused){
        const row=node('div',undefined,'file-row');
        row.append(node('span',file.name),button('Use image',()=>{
          draft.images[slot]=file.id;
          changed();
          renderEditor();
        }),button('Delete image',()=>dialog('Delete this unused image?',body=>{
          body.append(node('p',file.name),button('Delete image',async()=>{
            await api.fileRequest({method:'DELETE',id:file.id});
            files=files.filter(item=>item.id!==file.id);
            closeDialog();
            renderEditor();
            status('Image deleted.');
          },'danger'));
        }),'danger'));
        manage.append(row);
      }
      group.append(manage);
    }
    grid.append(group);
  }
  section.append(grid);
  host.append(section);
}
async function loadOwned(){
  const epoch=sessionEpoch;
  const [saved,published,documents,grants,verification]=await Promise.all([
    api.draft(account.role,user.id),api.publication(account.role,user.id),api.files(user.id),api.shares(),
    account.role==='hiring'?api.employerStatus():null
  ]);
  if(epoch!==sessionEpoch)return false;
  employerVerification=verification;
  if(account.role==='applicant')draft=normalizeApplicant(saved?.document);
  else{
    const document=saved?.document;
    const background=Object.fromEntries(Object.keys(hiringBackgroundFields).map(key=>[key,typeof document?.fields?.[key]==='string'?document.fields[key]:'']));
    draft={fields:{...ForwardTeams.normalizeFields(document?.fields),...background},answers:ForwardTeams.normalizeAnswers(document?.answers),images:normalizeImages(document?.images),resumeId:typeof document?.resumeId==='string'?document.resumeId:null};
  }
  version=saved?.version||0;publication=published;files=documents;shares=grants;dirty=false;revision=0;return true;
}
async function saveDraft(){
  const savingRevision=revision;const saved=await api.save(structuredClone(draft),version);version=saved.version;
  if(revision===savingRevision)dirty=false;updateSaveStatus();status(dirty?'Saved the previous edits. You have newer unsaved changes.':'Your private draft is saved to your account.');return saved;
}
async function navigate(next,connectionId){
  stopChat();
  route=next;
  renderNav();
  if(next==='profile')renderEditor();
  else if(next==='discover')await renderDiscovery();
  else if(next==='messages')await renderMessages(connectionId);
  else if(next==='views')await renderProfileViews();
  else if(next==='feedback'){
    $('feedbackNotice').hidden=true;
    await renderFeedback();
  }
  else await renderSharing();
  $('workspaceTitle').focus();
  window.scrollTo(0,0);
}
function renderNav(){
  const items=account.role==='applicant'?[['profile','My profile'],['discover','Discover teams'],['sharing','Sharing']]:[['profile','My hiring profile'],['sharing','Applicants']];
  items.push(['messages','Messages']);
  items.push(['views','Profile views']);
  if(account.role==='applicant')items.push(['feedback','Feedback']);
  $('accountNav').replaceChildren(...items.map(([id,label])=>{const b=button(label,()=>navigate(id));if(route===id)b.setAttribute('aria-current','page');return b;}));$('accountNav').hidden=false;
}
function renderEditor(){
  showPage('workspace');heading(account.role==='applicant'?'YOUR APPLICANT WORKSPACE':'YOUR HIRING WORKSPACE',account.role==='applicant'?'Your story. Your way.':'Let applicants meet you, too.',account.role==='applicant'?'Save a private draft, then choose the hiring managers you want to share it with.':'Introduce your team, the opportunity, and how you work together.');
  const host=$('workspaceContent');host.replaceChildren();
  const saveStatus=node('div',undefined,'draft-status');const message=node('p');message.id='draftSaveStatus';saveStatus.append(message);
  saveStatus.append(button('Reload saved version',()=>{
    dialog('Reload your saved profile?',body=>{body.append(node('p','This replaces any unsaved edits in this tab with the version saved to your account.'),button('Reload saved version',async()=>{await loadOwned();closeDialog();renderEditor();status('Your saved profile has been loaded.');}));});
  }));
  saveStatus.append(button('See example profiles',()=>showExampleProfiles(account.role)));
  host.append(saveStatus);
  const panel=node('section',undefined,'panel');
  const labels=account.role==='applicant'?['Work preferences','About you','Your top three','Values & teamwork','Review & share']:['Team questionnaire','Manager & role','Review & publish'];
  step=Math.min(step,labels.length-1);const steps=node('nav',undefined,'steps');steps.setAttribute('aria-label','Profile steps');
  labels.forEach((label,i)=>{const b=button(`${i+1}. ${label}`,()=>{step=i;renderEditor();});if(i===step)b.setAttribute('aria-current','step');steps.append(b);});panel.append(steps,node('p',`STEP ${step+1} OF ${labels.length}`,'eyebrow'),node('h2',labels[step]));
  if(step<=1)renderResumeUpload(panel);
  if(step===0){panel.append(node('p','There is no ideal answer. Differences help start a conversation and never exclude someone.'));
    panel.append(node('p',account.role==='applicant'?'Your selected answers stay private. Managers you share with receive discussion questions about differences, without seeing your selected answers. You can compare your answers with a manager’s published answers when exploring a team.':'These team answers will be included when you publish your manager profile.','notice'));
    panel.append(questionForm(account.role==='applicant'?draft.preferences:draft.answers,account.role==='hiring'));
  }else if(account.role==='hiring'&&step===1){
    const managerFields=Object.entries(ForwardTeams.fields);
    const identity=managerFields.filter(([key])=>!['teamStory','roleTitle','employmentType','roleSummary'].includes(key));
    const listing=managerFields.filter(([key])=>['teamStory','roleTitle','employmentType','roleSummary'].includes(key));
    panel.append(node('h3','About the manager'),fieldsGrid(Object.fromEntries(identity),draft.fields,changed,'manager-'));
    const background=node('details');
    background.open=Object.keys(hiringBackgroundFields).some(key=>draft.fields[key]);
    background.append(node('summary','Professional background'),fieldsGrid(hiringBackgroundFields,draft.fields,changed,'manager-'));
    panel.append(background);
    renderImageEditor(panel);
    panel.append(node('h3','Role and team'),fieldsGrid(Object.fromEntries(listing),draft.fields,changed,'manager-'));
  }
  else if(account.role==='applicant'&&step===1){
    panel.append(fieldsGrid(Object.fromEntries(Object.entries(applicantFields).slice(0,7)),draft.fields,changed,'applicant-'));
    const history=node('details');
    history.open=Boolean(draft.fields.experience||draft.fields.education||draft.fields.credentials);
    history.append(node('summary','Full work history, education & achievements'),fieldsGrid(Object.fromEntries(Object.entries(applicantFields).slice(7,10)),draft.fields,changed,'history-'));
    panel.append(history);
    renderImageEditor(panel);
  }else if(account.role==='applicant'&&step===2){
    panel.append(node('p','Feature up to three roles that best show your growth, contribution, and impact. You can edit your full work history under About you.'));
    const suggestions=ForwardProfile.suggestRoles(draft.fields.experience);
    draft.featuredRoles.forEach((role,i)=>{const section=node('details');section.open=i===0;section.append(node('summary',`Featured role ${i+1}`));if(suggestions.length){const label=node('label','Choose from your work history');label.htmlFor='suggest-'+i;const select=node('select');select.id=label.htmlFor;select.append(new Option('Choose a role…',''));suggestions.forEach((r,j)=>select.append(new Option(r.title+' · '+r.dates,String(j))));select.addEventListener('change',()=>{if(select.value==='')return;draft.featuredRoles[i]={...suggestions[Number(select.value)]};changed();renderEditor();});section.append(label,select);}section.append(fieldsGrid({title:{label:'Role & organization',max:160},dates:{label:'Dates',max:80},summary:{label:'What did you contribute, and what changed?',words:100}},role,changed,'featured-'+i+'-'));section.append(button('Clear highlight',()=>{draft.featuredRoles[i]={title:'',dates:'',summary:''};changed();renderEditor();}));panel.append(section);});
  }else if(account.role==='applicant'&&step===3){panel.append(fieldsGrid(Object.fromEntries(Object.entries(applicantFields).slice(10)),draft.fields,changed,'story-'));}
  else renderPublishing(panel);
  if(step===1){
    const docs=node('details');
    docs.append(node('summary','Manage my documents'));
    renderFiles(docs);
    panel.append(docs);
  }
  const actions=node('div',undefined,'actions');if(step>0)actions.append(button('← Back',()=>{step--;renderEditor();}));if(step<labels.length-1)actions.append(button('Continue →',()=>{if(step===0){const answers=account.role==='applicant'?draft.preferences:draft.answers;const missing=Object.keys(answers).find(k=>!answers[k]);if(missing){$('answer-'+missing).focus();throw new Error('Choose an answer to each question. Different preferences are welcome.');}}step++;renderEditor();},'primary'));panel.append(actions);host.append(panel);
  const strip=node('div',undefined,'save-strip');strip.append(node('p','Drafts are private until you choose to share.','help'));const controls=node('div',undefined,'actions');controls.append(button('Save private draft',saveDraft,'primary'));strip.append(controls);host.append(strip);updateSaveStatus();
}
const exampleApplicants=[
  {
      name:'Casey Park',
      role:'Learning Experience Designer',
      location:'New York, NY',
      demoImages:{portrait:'demo-applicant-portrait.jpg',showcase:'demo-applicant-project.jpg',alt:'A tablet and facilitator cards from a volunteer onboarding project.'},
      summary:'I turn complex processes into clear learning materials. I work with subject experts, test drafts with learners, and revise based on what people get stuck on.',
      skills:'Instructional design, learner interviews, accessibility, usability testing',
      featuredRoles:[
        {title:'Learning Designer · Harbor Learning Lab',dates:'2024–present',summary:'Redesigned volunteer onboarding using learner interviews and a short pilot. Completion rose from 68% to 84% over the next two cohorts.'},
        {title:'Program Assistant · Northside Community Workshop',dates:'2022–2024',summary:'Created a plain-language facilitator guide that helped new volunteers run their first workshop.'}
      ],
      experience:'Learning Designer · Harbor Learning Lab (2024–present)\nProgram Assistant · Northside Community Workshop (2022–2024)',
      values:'I share drafts early, ask whose perspective is missing, and document decisions so colleagues can build on the work.'
  },
  {
    name:'Amara Brooks',
    role:'Community Programs Coordinator',
    location:'Philadelphia, PA',
    summary:'I plan community programs and help volunteers feel prepared. I use feedback from participants and partner organizations to make events easier to attend and run.',
    skills:'Volunteer coordination, event logistics, community outreach, program evaluation',
    featuredRoles:[
      {title:'Program Coordinator · Linden Neighborhood Workshop',dates:'2024–present',summary:'Worked with local partners to move registration to a simpler form and add a phone option. We filled all 40 workshop places and reached 12 first-time participants.'},
      {title:'Volunteer Lead · Cedar Street Garden',dates:'2022–2024',summary:'Created a short orientation and paired new volunteers with experienced ones. More people felt ready to lead their own shifts.'}
    ],
    experience:'Program Coordinator · Linden Neighborhood Workshop (2024–present)\nVolunteer Lead · Cedar Street Garden (2022–2024)',
    support:'I share schedules early, explain who owns each task, and make time for a quick debrief after events.'
  },
  {
    name:'Mateo Ellis',
    role:'Customer Operations Specialist',
    location:'Denver, CO',
    summary:'I help service teams spot recurring problems and improve how they handle them. I’m comfortable turning feedback into a clear process that teammates can use.',
    skills:'Customer support, process documentation, spreadsheet reporting, peer training',
    featuredRoles:[
      {title:'Support Associate · Summit Loop Equipment',dates:'2023–present',summary:'Reviewed a month of support tickets and found that unclear return instructions caused repeat questions. I rewrote the guide and helped the team reduce follow-up requests by 20% over the next month.'},
      {title:'Shift Lead · Orchard Corner Market',dates:'2021–2023',summary:'Tested a short closing checklist with teammates. It gave the opening crew a consistent handoff and reduced missed restocking tasks.'}
    ],
    experience:'Support Associate · Summit Loop Equipment (2023–present)\nShift Lead · Orchard Corner Market (2021–2023)',
    values:'I describe problems without blaming people and ask the team to test changes before making them permanent.'
  }
];

function showExampleProfiles(initialRole){
  dialog('Example profiles',body=>{
    body.append(node('p','Every profile here is labeled FAKE. Use the examples to see what to write in your own profile.','notice'));
    const controls=node('div',undefined,'example-controls');
    const label=node('label','Choose an example');
    const select=node('select');
    label.htmlFor=select.id='example-profile-select';
    const preview=node('section',undefined,'example-preview');
    preview.setAttribute('aria-label','Selected example profile');
    let role=initialRole;
    const applicants=button('Applicant examples',()=>switchRole('applicant'));
    const managers=button('Hiring manager examples',()=>switchRole('hiring'));
    controls.append(applicants,managers);
    body.append(controls,label,select,preview);
    const options=()=>role==='applicant'?exampleApplicants:[ForwardTeams.samples[2],...ForwardTeams.samples.slice(0,2)];

    function draw(){
      const profile=options()[Number(select.value)];
      preview.replaceChildren(node('strong','FAKE','fake-label'));
      if(role==='applicant')renderApplicantStory(preview,profile);
      else{
        const demoImages=profile===ForwardTeams.samples[2]
          ? {portrait:'demo-manager-portrait.jpg',showcase:'demo-manager-team.jpg',alt:'A learning design team plans a lesson together around a table.'}
          : undefined;
        renderTeamStory(preview,{...profile,demoImages});
      }
    }

    function switchRole(next){
      role=next;
      applicants.setAttribute('aria-pressed',String(role==='applicant'));
      managers.setAttribute('aria-pressed',String(role==='hiring'));
      select.replaceChildren(...options().map((profile,index)=>new Option(
        'FAKE · '+(profile.name||profile.managerName)+' · '+(profile.role||profile.managerTitle),String(index)
      )));
      draw();
    }
    select.addEventListener('change',draw);
    switchRole(role);
  });
}

async function renderProfileViews(){
  heading('PROFILE VIEWS','Who viewed your profile?','See who opened your full profile and when. Names appear when the viewer has a profile you can access.');
  const host=$('workspaceContent');
  host.replaceChildren(node('p','Loading profile views…'));
  const viewers=await api.profileViewers();
  host.replaceChildren(button('Refresh profile views',renderProfileViews));
  if(!viewers.length){
    host.append(node('p','No profile views yet. Views start when someone opens your shared or published profile.','empty'));
    return;
  }
  const list=node('ul',undefined,'profile-views');
  const format=new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'});
  for(const viewer of viewers){
    const role=viewer.viewer_role==='hiring'?'Hiring manager':'Applicant';
    const entry=node('li',undefined,'panel');
    const time=node('time',format.format(new Date(viewer.viewed_at)));
    time.dateTime=viewer.viewed_at;
    entry.append(node('strong',viewer.viewer_name||role),node('span',viewer.viewer_name?role:'Name unavailable','help'),time);
    list.append(entry);
  }
  host.append(list);
}

function renderEmployerVerification(panel){
  const sameCompany=employerVerification?.company.toLowerCase()===draft.fields.company.trim().toLowerCase();
  const verification=sameCompany?employerVerification.status:null;
  if(verification==='approved'){
    panel.append(node('p','Employer verified. Confirm or republish your opening every 30 days to keep it in Discover teams.','notice'));
    if(publication){
      const renewBy=new Date(new Date(publication.updated_at).getTime()+30*86400000);
      panel.append(node('p',renewBy>new Date()
        ?'Confirm this opening by '+renewBy.toLocaleDateString()+'.'
        :'This opening is hidden until you confirm that it’s still open.','help'));
    }
    return;
  }
  const section=node('section',undefined,'notice');
  section.append(node('h3','Verify your employer'));
  if(verification==='pending'){
    section.append(node('p','Your request is pending review. Check back here for a decision.'));
  }else{
    section.append(node('p',verification==='rejected'
      ?'Forward couldn’t verify this request. Check your company name and official website before submitting again.'
      :'Forward reviews your affiliation with the company before you can publish a role. Use your official company website.'));
    const label=node('label','Official company website');
    const input=node('input');
    input.id=label.htmlFor='employerWebsite';
    input.type='url';
    input.placeholder='https://example.org';
    input.maxLength=250;
    input.required=true;
    section.append(label,input,button('Request verification',async()=>{
      if(!input.reportValidity())return;
      if(!/^https:\/\//i.test(input.value.trim()))throw new Error('Enter a website starting with https://.');
      if(!draft.fields.company.trim())throw new Error('Add your company name in Manager & role first.');
      await saveDraft();
      await api.requestVerification(input.value.trim());
      employerVerification=await api.employerStatus();
      renderEditor();
      status('Employer verification requested.');
    },'primary'));
  }
  section.append(button('Check verification status',async()=>{
    employerVerification=await api.employerStatus();
    renderEditor();
  }));
  panel.append(section);
}

function renderPublishing(panel){
  const applicant=account.role==='applicant';
  panel.append(node('p',publication?`A shared version exists. ${dirty||publication.version!==version?'Your latest draft edits are not shared yet.':'Your saved draft and shared version match.'}`:'No profile is shared yet.','notice'));
  if(applicant)renderApplicantStory(panel,publicApplicant(draft));
  else{
    renderEmployerVerification(panel);
    renderTeamStory(panel,{...draft.fields,answers:draft.answers,images:draft.images});
  }
  if(applicant){
    panel.append(node('p',currentFile()?'Résumé to include: '+currentFile().name:'No résumé will be included. You can still share your profile.','help'));
    panel.append(button('Preview as a hiring manager',()=>dialog('Hiring manager preview',body=>{
      renderApplicantStory(body,publicApplicant(draft));
      const file=currentFile();
      if(file)body.append(button('Download résumé · '+file.name,()=>downloadFile(file)));
      else body.append(node('p','No résumé attached.'));
    })));
  }
  const canPublish=applicant||(employerVerification?.status==='approved'
    &&employerVerification.company.toLowerCase()===draft.fields.company.trim().toLowerCase());
  if(canPublish)panel.append(button(applicant?'Review sharing version →':publication?'Review & renew opening →':'Review publication →',()=>{
    const issues=applicant?applicantIssues(draft,true):ForwardTeams.issues(draft.fields,draft.answers);
    if(issues.length)throw new Error(issues[0].message);
    if(!applicant){
      const oversized=Object.entries(hiringBackgroundFields).find(([key,field])=>Array.from(draft.fields[key].trim()).length>field.max);
      if(oversized)throw new Error('Shorten '+oversized[1].label.toLowerCase()+' to '+oversized[1].max+' characters.');
    }
    const approvedRevision=revision;
    dialog(applicant?'Save the version managers can see?':'Publish your hiring profile?',body=>{
    body.append(node('p',applicant?'Only managers you explicitly share with can see this version, including any profile images and the selected résumé. Your questionnaire answers and separate contact fields stay private.':'Signed-in Forward users will see your manager profile, professional background, role description, team questionnaire answers, and profile images. Your original résumé stays private.'));
      body.append(button(applicant?'Save sharing version':'Publish hiring profile',async()=>{
        if(approvedRevision!==revision)throw new Error('Your draft changed. Close this review and review it again.');
        await saveDraft();if(approvedRevision!==revision)throw new Error('New edits arrived during saving. Review them before publishing.');
        publication=await api.publish(account.role,version);closeDialog();renderEditor();status(applicant?'Sharing version saved. Choose managers in Discover teams or Sharing.':'Your hiring profile is published. Applicants can find it in Discover teams.');
      },'primary'));
    });
  },'primary'));
  if(publication)panel.append(button(applicant?'Unshare from everyone':'Close role & notify applicants',()=>{
    dialog(applicant?'Withdraw all sharing?':'Close this role?',body=>{
      body.append(node('p',applicant?'Managers will lose access to your profile and résumé. Your chats with them will be removed for both people. Copies already downloaded cannot be retrieved.':'The opening will leave Discover teams. Applicants currently sharing with you will receive a private update. Each applicant can withdraw your access from Sharing.'));
      body.append(button(applicant?'Confirm withdrawal':'Close role & send updates',async()=>{
        await api.unpublish();
        publication=null;
        shares=await api.shares();
        closeDialog();
        renderEditor();
        status(applicant?'Sharing withdrawn. Your private draft is saved.':'Role closed. Applicants who shared with you can see the update in Feedback.');
      },'danger'));
    });
  },'danger'));
}
function renderResumeUpload(panel){
  const upload=node('section',undefined,'notice resume-upload');
  const title=node('h3','Upload and autofill from your résumé');
  const label=node('label','Choose a résumé file (up to 10 MB)');
  label.htmlFor='cloudResume';
  const input=node('input');
  input.type='file';
  input.id=label.htmlFor;
  input.accept='.pdf,.jpg,.jpeg,.png,.webp';
  input.setAttribute('aria-describedby','resumeUploadHelp resumeUploadStatus');
  const progress=node('p',undefined,'status');
  progress.id='resumeUploadStatus';
  progress.setAttribute('role','status');
  const report=(message,error=false)=>{
    progress.textContent=message;
    progress.classList.toggle('error',error);
  };
  const importSelected=async()=>{
    const file=input.files[0];
    if(!file)return;
    report('Reading '+file.name+'…');
    try{
      await reviewResume(file,{report});
      input.value='';
    }catch(error){report(error.message||'Forward could not read the résumé. Try again.',true);}
    finally{retry.hidden=!input.files.length;}
  };
  const retry=button('Fill profile from selected file',importSelected,'primary');
  retry.hidden=true;
  input.addEventListener('change',()=>{
    if(!input.files.length){retry.hidden=true;report('');return;}
    retry.hidden=false;
    if(busy){report('File selected. Choose “Fill profile from selected file” when the current action finishes.');return;}
    run(input,importSelected);
  });
  const help=node('p',account.role==='hiring'?'A PDF with selectable text fills in your manager bio and professional background. The original file stays private. For a scan or image, attach the file and paste the text.':'A PDF with selectable text fills in details such as jobs, education, and skills and saves them to your private draft. For a scan or image, you can attach the file and paste the text.','help');
  help.id='resumeUploadHelp';
  upload.append(title,help,label,input,progress,retry);
  const attached=currentFile();
  if(attached){
    upload.append(node('p','Saved résumé: '+attached.name,'help'));
    if(step===0)upload.append(button('See your saved résumé details',showResumeDetails,'primary'));
    if(attached.mime==='application/pdf')upload.append(button('Fill again from saved PDF',async()=>{
      report('Opening your saved PDF…');
      try{
        const blob=await api.fileRequest({id:attached.id});
        if(!(blob instanceof Blob))throw new Error('The saved PDF could not be opened. Choose the file again to retry.');
        const file=new File([blob],attached.name,{type:'application/pdf'});
        await reviewResume(file,{existing:attached,report});
      }catch(error){report(error.message||'Forward could not open your saved PDF.',true);}
    }));
  }
  if(step===1){
    const options=node('details');
    options.append(node('summary',account.role==='applicant'?'Paste text or import a demo profile':'Paste résumé text'));
    const pasteLabel=node('label','Résumé text');
    pasteLabel.htmlFor='cloudPaste';
    const paste=node('textarea');
    paste.id=pasteLabel.htmlFor;
    options.append(pasteLabel,paste,button('Review pasted résumé',()=>{
      if(paste.value.trim().length<25)throw new Error('Paste your résumé text first.');
      reviewImport(readResumeForRole(ForwardResume.parseResumeText(paste.value)),null);
    }));
    if(account.role==='applicant')options.append(button('Import this browser’s demo profile',importBrowserDraft));
    upload.append(options);
  }
  panel.append(upload);
}

function readResumeForRole(result){
  const hiring=account.role==='hiring';
  const titleKey=hiring?'managerTitle':'role';
  const fields=hiring?hiringResumeFields(result.fields):{...result.fields};
  const warnings=[...result.warnings];
  if(result.suggestedRole){
    if(draft.fields[titleKey]?.trim())fields[titleKey]='';
    else warnings.push('Forward found a possible title in your work history. Check that it fits your profile.');
  }
  if(!result.fields.summary&&!draft.fields[hiring?'managerBio':'summary']?.trim()){
    warnings.push('Add a short introduction if your résumé has no summary.');
  }
  return {...result,fields,warnings};
}

function showResumeDetails(){
  step=1;
  renderEditor();
  const firstField=$(account.role==='hiring'?'manager-managerName':'applicant-name');
  firstField.focus({preventScroll:true});
  firstField.scrollIntoView({block:'center'});
}

function reportResumeSaved(filled,hasFile){
  const count=Object.values(filled).filter(value=>value?.trim()).length;
  const message=count
    ? 'Saved '+count+' résumé '+(count===1?'field':'fields')+'. Review the filled details below and complete any blanks.'
    : hasFile?'Résumé saved. Add details manually or paste the résumé text to autofill.':'There were no résumé details to fill.';
  const notice=$('resumeUploadStatus');
  if(notice)notice.textContent=message;
  status(message);
}

async function reviewResume(file,{existing=null,report=status}={}){
  if(!file)return;
  if(file.size>10485760||!['application/pdf','image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Choose a PDF, JPG, PNG, or WebP no larger than 10 MB.');
  if(file.type!=='application/pdf'){
    reviewImport({fields:{},warnings:['You can attach this image and paste its text in the second profile step to autofill details.']},file);
    return;
  }
  report('Reading your PDF on this device…');
  let result;
  try{result=readResumeForRole(await ForwardResume.extractPdf(file,report));}
  catch(error){
    if(!error.message.startsWith('This PDF has little or no selectable text.'))throw error;
    reviewImport({fields:{},warnings:['This PDF appears to be a scan. You can attach it and paste its text in the second profile step.']},file,null,createResumeSaver(file,existing,report));
    return;
  }
  const imported=Object.entries(result.fields).filter(([,value])=>value.trim());
  const hasConflict=imported.some(([key,value])=>draft.fields[key]?.trim()&&draft.fields[key].trim()!==value.trim());
  const save=createResumeSaver(file,existing,report);
  if(hasConflict||!imported.length){reviewImport(result,file,null,save);return;}
  try{await save(result.fields);}
  catch(error){
    reviewImport(result,file,null,save);
    status(error.message,true);
    return;
  }
  showResumeDetails();
  reportResumeSaved(result.fields,true);
}

function createResumeSaver(file,existing=null,report=status){
  let uploadedFile=existing;
  return async (reviewed,wholeProfile=null)=>{
    const editor=$('workspaceContent');
    editor.inert=true;
    try{
      if(file&&!uploadedFile){
        report('Uploading your résumé to your private account…');
        uploadedFile=await api.fileRequest({method:'POST',file});
        files.push(uploadedFile);
      }
      let next;
      if(account.role==='hiring'){
        const filled=Object.fromEntries(Object.entries(reviewed).filter(([,value])=>value?.trim()).map(([key,value])=>[key,value.trim()]));
        next={...draft,fields:{...draft.fields,...filled}};
      }else{
        next=importReviewedFields(wholeProfile?{...wholeProfile,images:draft.images}:draft,reviewed);
      }
      if(uploadedFile)next.resumeId=uploadedFile.id;
      report('Saving the filled profile…');
      const saved=await api.save(next,version);
      draft=next;
      version=saved.version;
      revision++;
      dirty=false;
    }finally{editor.inert=false;}
  };
}

function reviewImport(result,file,wholeProfile=null,save=createResumeSaver(file)){
  const definitions=account.role==='hiring'
    ? {...Object.fromEntries(['managerName','managerTitle','location','managerBio'].map(key=>[key,ForwardTeams.fields[key]])),...hiringBackgroundFields}
    : Object.fromEntries(Object.entries(applicantFields).slice(0,10));
  const reviewed=Object.fromEntries(Object.keys(definitions).map(key=>[key,result.fields[key]||'']));
  dialog('Review your résumé details',body=>{
    body.append(node('p',wholeProfile?'Review the information before copying it to your account. This replaces the current draft fields and preferences.':'Review the information before saving it to your private draft. Filled fields replace the corresponding values in your draft.'));
    for(const warning of result.warnings||[])body.append(node('p',warning,'notice'));
    body.append(fieldsGrid(definitions,reviewed,()=>{},'import-'));
    if(file)body.append(node('p','File to save privately: '+file.name,'help'));
    const actions=node('div',undefined,'resume-import-actions');
    actions.append(button('Save and open my profile',async()=>{
      await save(reviewed,wholeProfile);
      closeDialog();
      showResumeDetails();
      reportResumeSaved(reviewed,Boolean(file));
    },'primary'));
    body.append(actions);
  });
}
async function importBrowserDraft(){
  const record=ForwardResume.validateProfile(await ForwardResume.loadProfile());if(!record)throw new Error('No saved applicant profile was found in this browser. You can upload your résumé instead.');
  reviewImport({fields:record.fields,warnings:[],rawText:record.resumeText||''},record.resumeFile instanceof Blob?record.resumeFile:null,normalizeApplicant(record));
}
function renderFiles(host){
  const documents=files.filter(file=>!file.kind||file.kind==='resume');
  if(!documents.length){host.append(node('p','No documents uploaded.','help'));return;}
  documents.forEach(file=>{const row=node('div',undefined,'file-row');const copy=node('div');copy.append(node('strong',file.name),node('small',`${(file.size/1024).toFixed(0)} KB${file.id===draft.resumeId?' · Selected for your draft':''}`));const actions=node('div',undefined,'file-actions');
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
  const identity=node('div',undefined,'profile-identity');
  identity.append(node('h2',profile.managerName||'Your name'),node('p',[profile.managerTitle,profile.company].filter(Boolean).join(' · '),'card-meta'));
  prependPortrait(identity,profile);
  host.append(identity,node('p',profile.managerBio,'profile-text'));
  for(const [key,field] of Object.entries(hiringBackgroundFields)){
    if(!profile[key])continue;
    const section=node('details');
    section.append(node('summary',field.label),node('p',profile[key],'profile-text'));
    host.append(section);
  }
  host.append(node('h3',profile.roleTitle||'Your opportunity'),node('p',[profile.location,profile.employmentType].filter(Boolean).join(' · '),'help'),node('p',profile.roleSummary,'profile-text'),node('h3','Culture, support & connection'),node('p',profile.teamStory||'Ask how this team supports people.','profile-text'));
  appendShowcase(host,profile,'Team image');
  const answers=node('div',undefined,'team-answers');for(const key of Object.keys(questions)){const section=node('section',undefined,'team-answer');section.append(node('h3',questionLabels[key]),node('p',questions[key][profile.answers?.[key]]||'Not answered yet'));answers.append(section);}host.append(answers);
}
async function renderDiscovery(){
  heading('DISCOVER TEAMS','Choose your next team, too.','Meet the hiring manager and explore how the team works. Managers can see when someone opens their full profile.');
  const host=$('workspaceContent');host.replaceChildren(node('p','Loading teams…'));teams=await api.teams();shares=await api.shares();host.replaceChildren();
  host.append(button('See hiring manager examples',()=>showExampleProfiles('hiring')));
  host.append(node('p','Employers in Discover teams have been reviewed by Forward and must confirm their openings every 30 days. You decide who can access your résumé.','notice'));
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
        confirmation.append(button('Share with this manager',async()=>{
          await api.share(team.owner_id,publication.version);
          closeDialog();
          await navigate('sharing');
          status('Profile shared with '+team.profile.managerName+'. Choose “I’m open to chat” when you’re ready to connect.');
        },'primary'));
      });
    },'primary'));
  });
  api.recordProfileView(team.owner_id).catch(()=>{});
}
async function renderSharing(){
  if(account.role==='hiring')return renderApplicantDeck();
  heading('YOU CONTROL ACCESS','Your story. Your choice.','Choose which managers can see your profile and résumé and when you’re open to chatting.');
  const host=$('workspaceContent');
  host.replaceChildren(node('p','Loading…'));
  const [grants,connections]=await Promise.all([api.shares(),api.connections()]);
  shares=grants;
  const sharedTeams=await Promise.all(grants.map(grant=>api.publication('hiring',grant.manager_id)));
  host.replaceChildren(button('Refresh sharing',renderSharing));
  if(!grants.length)host.append(node('p','No managers have access yet. Explore Discover teams when you’re ready.','empty'));
  grants.forEach((grant,index)=>{
    const team=sharedTeams[index];
    const connection=connections.find(item=>item.manager_id===grant.manager_id);
    const row=node('section',undefined,'panel sharing-row');
    const copy=node('div');
    copy.append(node('strong',team?.profile.managerName||'Manager with an unpublished profile'),node('p',team?.profile.company||''));
    if(connection?.matched)copy.append(node('p','Matched','card-meta'));
    else if(connection?.manager_choice==='pass')copy.append(node('p','Declined · Feedback available','card-meta'));
    else if(connection?.applicant_ready&&team)copy.append(node('p','Open to chat','card-meta'));
    const controls=node('div',undefined,'actions');
    if(connection?.matched)controls.append(button('Open chat',()=>navigate('messages',connection.id),'primary'));
    else if(connection?.manager_choice==='pass')controls.append(button('Read feedback',()=>navigate('feedback')));
    else if(team&&!connection?.applicant_ready)controls.append(button('I’m open to chat',async()=>{
      const matched=await api.chooseConnection(grant.manager_id,'open-chat');
      await renderSharing();
      status(matched?'You matched. Open chat to say hello.':'You’re open to chatting. A chat opens when the manager is interested too.');
    },'primary'));
    controls.append(button('Withdraw access',()=>dialog('Withdraw this manager’s access?',body=>{
      body.append(node('p','This removes their access to your profile and résumé and deletes your chat for both people. Copies already downloaded cannot be retrieved.'));
      body.append(button('Withdraw access',async()=>{
        await api.withdraw(grant.manager_id);
        closeDialog();
        await renderSharing();
        status('Access withdrawn.');
      },'danger'));
    }),'danger'));
    row.append(copy,controls);
    host.append(row);
  });
}

function declineApplicant(person,onSent){
  dialog('Decline '+person.profile.name+'?',body=>{
    body.append(node('p','This goes directly to the applicant. Name a job requirement or evidence from their profile that informed your decision, then suggest one step they can take. Use work preferences to start conversations.'));
    const form=node('form');
    const makeField=(id,labelText,example)=>{
      const label=node('label',labelText);
      label.htmlFor=id;
      const field=node('textarea');
      field.id=id;
      field.required=true;
      field.minLength=20;
      field.maxLength=1200;
      field.rows=3;
      field.placeholder=example;
      form.append(label,field);
      return field;
    };
    const reason=makeField('declineReason','What led to your decision?',
      'This role requires leading live training, and your examples focused on designing the materials.');
    const nextStep=makeField('declineNextStep','What could they try next?',
      'Co-lead a training session and add an example of how you adapted it based on learner feedback.');
    const actions=node('div',undefined,'actions');
    const send=node('button','Decline & send feedback','button danger');
    send.type='submit';
    actions.append(button('Cancel',closeDialog),send);
    form.append(actions);
    form.addEventListener('submit',event=>{
      event.preventDefault();
      run(send,async()=>{
        for(const field of [reason,nextStep]){
          if(Array.from(field.value.trim()).length<20){
            field.focus();
            throw new Error('Use at least 20 characters for each response.');
          }
        }
        await api.declineWithFeedback(person.owner_id,reason.value.trim(),nextStep.value.trim());
        closeDialog();
        onSent();
        status('Declined. The applicant can now read your feedback in Forward.');
      });
    });
    body.append(form);
  });
}

async function renderApplicantDeck(){
  heading('APPLICANTS SHARED WITH YOU','Meet the people behind the résumé.','Swipe right for Interested or left to open the decline form. Applicants can see when you open their full profile.');
  const host=$('workspaceContent');
  host.replaceChildren(node('p','Loading applicants…'));
  const [applicants,existing]=await Promise.all([api.applicants(),api.connections()]);
  const examples=exampleApplicants.map(profile=>({profile,example:true}));
  const decisions=new Map(existing.map(item=>[item.applicant_id,item]));
  const filter=node('select');
  filter.id='applicantFilter';
  for(const [value,label] of [['new','To review'],['interested','Interested'],['pass','Declined'],['matched','Matched']]){
    filter.append(new Option(label,value));
  }
  const label=node('label','Show applicants');
  label.htmlFor=filter.id;
  const toolbar=node('div',undefined,'deck-toolbar');
  toolbar.append(label,filter,button('Refresh applicants',renderApplicantDeck));
  const content=node('div',undefined,'applicant-deck');
  host.replaceChildren(toolbar,content);
  let index=0;

  function draw(focus=false){
    const list=applicants.filter(person=>{
      const decision=decisions.get(person.owner_id);
      return (decision?.matched?'matched':decision?.manager_choice||'new')===filter.value;
    });
    if(filter.value==='new')list.splice(0,0,examples[0]);
    if(filter.value==='new')list.push(...examples.slice(1));
    index=Math.min(index,Math.max(0,list.length-1));
    const person=list[index];
    if(!person){
      const empty=node('p',applicants.length?'No applicants in this view.':'No applicants have shared with you yet. Publish your hiring profile so applicants can meet you and choose to share.','empty');
      empty.tabIndex=-1;
      content.replaceChildren(empty);
      if(focus)empty.focus();
      return;
    }
    const decision=decisions.get(person.owner_id);
    const card=node('article',undefined,'panel applicant-card');
    const story=node('div',undefined,'swipe-area');
    if(person.example)story.append(node('strong','FAKE','fake-label'));
    const title=node('h2',person.profile.name);
    title.tabIndex=-1;
    const initials=person.profile.name.trim().split(/\s+/).slice(0,2).map(word=>Array.from(word)[0]).join('').toUpperCase();
    const avatar=node('span',initials,'applicant-initials');
    avatar.setAttribute('aria-hidden','true');
    story.append(avatar,title,node('p',[person.profile.role,person.profile.location].filter(Boolean).join(' · '),'card-meta'),node('p',person.profile.summary,'profile-lead profile-text'));
    const highlights=(person.profile.featuredRoles||[]).filter(role=>role.title).map(role=>role.title);
    if(highlights.length)story.append(node('p',highlights.join(' · '),'help'));
    card.append(story);
    const actions=node('div',undefined,'actions');
    if(!person.example)actions.append(button('Preview full profile',()=>showSharedApplicant(person.owner_id)));
    const markChoice=choice=>{
      decisions.set(person.owner_id,{manager_choice:choice});
      draw(true);
    };
    const showInterest=async()=>{
      const matched=await api.chooseConnection(person.owner_id,'interested');
      if(matched){
        await navigate('messages',person.owner_id);
        status('You matched with '+person.profile.name+'. Your private chat is ready.');
        return;
      }
      markChoice('interested');
      status('Interest saved. A chat opens when the applicant is open to chatting too.');
    };
    if(person.example){
      const preview=node('details',undefined,'inline-example');
      preview.append(node('summary','Read the example profile'),node('p','Use this fictional profile as a reference.','help'));
      renderApplicantStory(preview,person.profile);
      card.append(preview);
    }else if(decision?.matched){
      actions.append(button('Open chat',()=>navigate('messages',decision.id),'primary'));
    }else{
      const pass=decision?.manager_choice==='pass'?null:button('← Decline with feedback',()=>declineApplicant(person,()=>markChoice('pass')));
      const interested=decision?.manager_choice==='interested'?null:button('Interested →',showInterest,'primary');
      if(pass)actions.append(pass);
      if(interested)actions.append(interested);
      let start;
      story.addEventListener('pointerdown',event=>{
        if(!event.isPrimary||event.button!==0)return;
        start={id:event.pointerId,x:event.clientX,y:event.clientY};
        story.setPointerCapture(event.pointerId);
      });
      story.addEventListener('pointercancel',()=>{start=null;});
      story.addEventListener('pointerup',event=>{
        if(!start||start.id!==event.pointerId)return;
        const dx=event.clientX-start.x,dy=event.clientY-start.y;
        start=null;
        if(Math.abs(dx)<65||Math.abs(dx)<Math.abs(dy)*1.5)return;
        (dx>0?interested:pass)?.click();
      });
    }
    if(!person.example)card.append(actions);
    const paging=node('div',undefined,'deck-paging');
    if(index>0)paging.append(button('← Previous',()=>{index--;draw(true);}));
    paging.append(node('p',`${index+1} of ${list.length}`,'help'));
    if(index<list.length-1)paging.append(button('Next →',()=>{index++;draw(true);}));
    content.replaceChildren(card,paging);
    if(focus)title.focus();
  }

  filter.addEventListener('change',()=>{index=0;draw();});
  draw();
}
async function showSharedApplicant(id){
  const person=await api.publication('applicant',id);
  if(!person)throw new Error('This applicant is no longer sharing their profile with you.');
  const [documents,prompts]=await Promise.all([api.files(id),api.prompts(id)]);
  dialog(person.profile.name,body=>{
    renderApplicantStory(body,person.profile);body.append(node('p','Featured roles are highlights. Read the full résumé for the complete experience and context.','notice'));
    const file=documents.find(f=>f.id===person.resume_id);if(file)body.append(button('Download résumé · '+file.name,()=>downloadFile(file),'primary'));else body.append(node('p','No résumé attached.'));
    body.append(node('h3','Start a conversation'),node('p','These are possible working agreements to explore, never reasons to disqualify someone. The applicant’s selected answers remain private.'));
    if(prompts?.length){const list=node('ul');for(const prompt of prompts)list.append(node('li',prompt.question));body.append(list);}else body.append(node('p','What helps each of us do our best work, and what should we agree on before starting?'));
  });
  api.recordProfileView(id).catch(()=>{});
}

async function renderFeedback(){
  const epoch=sessionEpoch;
  heading('HIRING UPDATES','Feedback','Read private feedback and role updates from hiring teams.');
  const host=$('workspaceContent');
  const list=node('div',undefined,'feedback-inbox');
  const info=node('p','Loading updates…','help');
  info.setAttribute('role','status');
  const older=button('Load older updates',()=>loadPage(lastId));
  older.hidden=true;
  let lastId;
  host.replaceChildren(button('Refresh updates',renderFeedback),info,list,older);

  async function loadPage(before){
    try{
      const rows=await api.feedback(before);
      if(epoch!==sessionEpoch||route!=='feedback'||!list.isConnected)return;
      info.textContent=rows.length||before!==undefined?'':'No updates yet. Hiring feedback and role closures will appear here.';
      for(const row of rows){
        const card=node('article',undefined,'panel');
        const role=[row.role_title,row.company].filter(Boolean).join(' · ');
        const time=node('time',new Date(row.created_at).toLocaleString());
        time.dateTime=row.created_at;
        card.append(node('h2',row.kind==='role_closed'?'Role closed':'Application update'),
          node('p',role,'card-meta'),time);
        if(row.kind==='role_closed'){
          card.append(node('p','The hiring team closed this opening. You can manage résumé access in Sharing.'));
        }else{
          card.append(node('h3','What informed the decision'),node('p',row.reason,'profile-text'),
            node('h3','A suggested next step'),node('p',row.next_step,'profile-text'));
        }
        list.append(card);
      }
      lastId=rows.at(-1)?.id;
      older.hidden=rows.length<30;
    }catch{
      if(list.isConnected)info.textContent='Forward couldn’t load updates. Choose Refresh updates to try again.';
    }
  }
  await loadPage();
}

function watchFeedback(){
  if(account.role!=='applicant')return;
  const epoch=sessionEpoch;
  let latest;
  const showUpdate=()=>{
    if(epoch!==sessionEpoch)return;
    if(route==='feedback')void renderFeedback();
    else $('feedbackNotice').hidden=false;
  };
  const checkLatest=async()=>{
    if(epoch!==sessionEpoch||document.hidden)return;
    try{
      const [row]=await api.feedback(undefined,1);
      if(epoch!==sessionEpoch)return;
      const id=row?.id||0;
      if(latest!==undefined&&id>latest)showUpdate();
      latest=Math.max(latest||0,id);
    }catch{/* The inbox exposes retry when opened. */}
  };
  const channel=client.channel('forward-hiring-updates').on('postgres_changes',{
    event:'INSERT',schema:'public',table:'forward_decline_feedback',filter:'applicant_id=eq.'+user.id
  },({new:row})=>{
    latest=Math.max(latest||0,row.id);
    showUpdate();
  }).subscribe(state=>{if(state==='SUBSCRIBED')void checkLatest();});
  document.addEventListener('visibilitychange',checkLatest);
  const fallback=setInterval(checkLatest,20000);
  void checkLatest();
  stopFeedback=()=>{
    clearInterval(fallback);
    document.removeEventListener('visibilitychange',checkLatest);
    void client.removeChannel(channel);
    $('feedbackNotice').hidden=true;
  };
}

async function renderMessages(selection){
  heading('MESSAGES','Your conversations.','Chat privately with applicants or hiring managers after you both choose to connect.');
  const host=$('workspaceContent');
  host.replaceChildren(node('p','Loading conversations…'));
  const matches=(await api.connections()).filter(connection=>connection.matched);
  const peerRole=account.role==='applicant'?'hiring':'applicant';
  const peerId=connection=>peerRole==='hiring'?connection.manager_id:connection.applicant_id;
  const profiles=await Promise.all(matches.map(connection=>api.publication(peerRole,peerId(connection))));
  const chats=matches.map((connection,index)=>({
    ...connection,
    name:peerRole==='hiring'?(profiles[index]?.profile.managerName||'Hiring manager'):(profiles[index]?.profile.name||'Applicant')
  })).sort((a,b)=>a.name.localeCompare(b.name));
  host.replaceChildren(button('Refresh conversations',()=>navigate('messages',selection)));
  if(!chats.length){
    host.append(node('p','No matches yet. When both people choose to connect, your conversation appears here.','empty'));
    return;
  }
  const active=chats.find(chat=>chat.id===selection||peerId(chat)===selection);
  const layout=node('div',undefined,'messages-layout');
  const inbox=node('nav',undefined,'panel chat-list');
  inbox.setAttribute('aria-label','Matched conversations');
  for(const chat of chats){
    const link=button(chat.name,()=>navigate('messages',chat.id));
    if(chat===active)link.setAttribute('aria-current','page');
    inbox.append(link);
  }
  layout.append(inbox);
  host.append(layout);
  if(active)await openConversation(layout,active);
  else layout.append(node('p','Choose a conversation to read or send a message.','empty'));
}

async function openConversation(host,chat){
  const panel=node('section',undefined,'panel chat-panel');
  const list=node('ol',undefined,'chat-history');
  list.setAttribute('aria-label','Messages with '+chat.name);
  list.tabIndex=0;
  const empty=node('p','Say hello to start the conversation.','help');
  const info=node('p',undefined,'help');
  info.setAttribute('role','status');
  const form=node('form');
  const label=node('label','Message');
  label.htmlFor='chatMessage';
  const input=node('textarea');
  input.id=label.htmlFor;
  input.required=true;
  input.maxLength=2000;
  input.rows=3;
  const send=node('button','Send message','button primary');
  send.type='submit';
  form.append(label,input,send);
  const rendered=new Map();
  let active=true;
  let refreshing=false;
  let firstPage=true;
  let timer;
  const older=button('Load earlier messages',async()=>{
    const previousTop=list.scrollTop;
    const previousHeight=list.scrollHeight;
    const rows=await api.messages(chat.id,Math.min(...rendered.keys()));
    if(!active)return;
    older.hidden=rows.length<50;
    draw(rows);
    list.scrollTop=previousTop+list.scrollHeight-previousHeight;
  });
  older.hidden=true;
  const starter=node('aside',undefined,'notice chat-starter');
  starter.hidden=true;
  panel.append(node('h2',chat.name),starter,older,empty,list,info,form);
  host.append(panel);
  api.chatStarter(chat.id).then(question=>{
    if(!active||!question)return;
    starter.append(node('h3','A question to start with'),node('p',question));
    starter.hidden=false;
  }).catch(()=>{});

  function draw(rows,scrollToLatest=false){
    if(!rows.some(message=>!rendered.has(message.id)))return;
    for(const message of rows)rendered.set(message.id,message);
    const items=[...rendered.values()].sort((a,b)=>a.id-b.id).map(message=>{
      const mine=message.sender_id===user.id;
      const item=node('li',undefined,mine?'chat-message mine':'chat-message');
      const meta=node('p',mine?'You':chat.name,'help');
      const time=node('time',new Date(message.created_at).toLocaleString());
      time.dateTime=message.created_at;
      meta.append(' · ',time);
      item.append(meta,node('p',message.body,'profile-text'));
      return item;
    });
    list.replaceChildren(...items);
    empty.hidden=Boolean(items.length);
    if(scrollToLatest)list.scrollTop=list.scrollHeight;
  }

  async function refresh(){
    if(!active||refreshing||document.hidden)return;
    refreshing=true;
    try{
      const [connections,rows]=await Promise.all([api.connections(),api.messages(chat.id)]);
      if(!active)return;
      if(!connections.some(connection=>connection.id===chat.id&&connection.matched)){
        stopChat();
        panel.replaceChildren(node('p','This conversation is closed.','empty'));
        return;
      }
      const nearEnd=list.scrollHeight-list.clientHeight-list.scrollTop<50;
      if(firstPage){older.hidden=rows.length<50;firstPage=false;}
      draw(rows,nearEnd);
      info.textContent='';
    }catch{
      if(active)info.textContent='Could not refresh messages. Forward will try again.';
    }finally{refreshing=false;}
  }

  form.addEventListener('submit',event=>{
    event.preventDefault();
    run(send,async()=>{
      const body=input.value.trim();
      if(!body){input.focus();throw new Error('Write a message before sending.');}
      const sent=await api.sendMessage(chat.id,body);
      if(!active)return;
      if(input.value.trim()===body)input.value='';
      draw([sent],true);
      input.focus();
      status('');
    });
  });
  stopChat=()=>{
    active=false;
    clearInterval(timer);
    document.removeEventListener('visibilitychange',refresh);
  };
  timer=setInterval(refresh,5000);
  document.addEventListener('visibilitychange',refresh);
  await refresh();
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
  stopChat();
  stopFeedback();
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
  if(!await loadOwned())return;step=draft.resumeId?1:0;route='profile';renderNav();renderEditor();watchFeedback();
}
async function initialize(){
  if(!configReady(accountConfig)){showPage('setupNotice');return;}
  $('accountPreview').hidden=accountConfig.showAccountEntry!==false;
  const {createClient}=await import('./vendor/supabase.js');
  // Supabase uses storageKey for both browser storage and its cross-tab auth channel.
  // Give each page a separate channel while keeping the existing per-tab session on reload.
  const sessionKey='forward-account-session';
  const storageKey=sessionKey+'-'+crypto.randomUUID();
  const sessionStorageKey=key=>key.startsWith(storageKey)?sessionKey+key.slice(storageKey.length):key;
  const storage={
    getItem:key=>sessionStorage.getItem(sessionStorageKey(key)),
    setItem:(key,value)=>sessionStorage.setItem(sessionStorageKey(key),value),
    removeItem:key=>sessionStorage.removeItem(sessionStorageKey(key))
  };
  client=createClient(accountConfig.supabaseUrl,accountConfig.publishableKey,{
    auth:{storage,storageKey,persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'implicit'}
  });
  api=createAccountAPI(client);
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
  $('openFeedback').addEventListener('click',()=>run($('openFeedback'),()=>navigate('feedback')));
  document.querySelectorAll('[data-account-role]').forEach(b=>b.addEventListener('click',()=>run(b,async()=>{account=await api.register(b.dataset.accountRole);await loadOwned();step=0;route='profile';renderNav();renderEditor();watchFeedback();status('Your account is ready. Start with your work preferences.');})));
  client.auth.onAuthStateChange((event,session)=>{
    if(event==='TOKEN_REFRESHED')return;
    if(event==='PASSWORD_RECOVERY')recovery=true;
    if(event==='SIGNED_OUT'||(user&&session?.user?.id!==user.id)){location.replace('accounts.html');return;}
    if(event==='PASSWORD_RECOVERY'||event==='INITIAL_SESSION')setTimeout(()=>handleSession(session,event).catch(e=>status(e.message,true)),0);
  });
  window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
}
installHelpChat(()=>({client,role:user?account?.role:null}));
initialize().catch(error=>{showPage('setupNotice');status('Account access could not load. Please try again. '+error.message,true);});
