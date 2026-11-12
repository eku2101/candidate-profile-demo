// Opt-in integration check. Use only disposable, fictional test accounts.
// Never seed or confirm real users through SQL; real visitors must verify email.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createClient} from '@supabase/supabase-js';
import {createAccountAPI} from '../api.mjs';
import {normalizeApplicant} from '../model.mjs';
import {accountConfig} from '../config.js';

if(process.env.FORWARD_RUN_HOSTED_TESTS!=='dssxuobdjxqhvslbskkv')throw new Error('Explicit test-project confirmation is required.');
const fixture=JSON.parse(await readFile(process.env.FORWARD_TEST_ACCOUNTS,'utf8'));
const origin='https://eku2101.github.io';
const clients=[];
const create=()=>{const client=createClient(accountConfig.supabaseUrl,accountConfig.publishableKey,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Origin:origin}}});clients.push(client);return client;};
const login=async key=>{const client=create();const result=await client.auth.signInWithPassword(fixture.users[key]);assert.ifError(result.error);assert.equal(result.data.user.id,fixture.users[key].id);return createAccountAPI(client);};
const checked=async request=>{const result=await request;assert.ifError(result.error);return result.data;};
const passed=[];
const pass=name=>{passed.push(name);console.log('PASS '+name);};
const preferences={focus:'protected',brainstorming:'occasional',communication:'written',checkIns:'milestones',rhythm:'steady',environment:'remote'};
const applicant=normalizeApplicant({fields:{name:'Forward Test Applicant',role:'Community coordinator',summary:'Fictional test profile; no real person.',email:'private@example.invalid',phone:'555-0100',experience:'Role one\nRole two\nRole three\nRole four'},preferences});
applicant.featuredRoles=[1,2,3].map(i=>({title:'Featured role '+i,dates:'2020–2021',summary:'Supported a fictional community program.'}));
const hiring={fields:{managerName:'Forward Test Manager',managerTitle:'Team lead',company:'Fictional test company',location:'Remote',managerBio:'Fictional test profile.',teamStory:'We support different work preferences.',roleTitle:'Coordinator',employmentType:'Full time',roleSummary:'Help a fictional community.'},answers:{...preferences,communication:'live',experience:'mid'}};
function pdfBytes(){
  const content='BT /F1 12 Tf 50 750 Td (Forward fictional resume test) Tj ET';
  const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${content.length} >>\nstream\n${content}\nendstream`];
  let pdf='%PDF-1.4\n';const offsets=[0];for(let i=0;i<objects.length;i++){offsets.push(pdf.length);pdf+=`${i+1} 0 obj\n${objects[i]}\nendobj\n`;}
  const xref=pdf.length;pdf+=`xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;return new TextEncoder().encode(pdf);
}

let a,b,m,n,second;
const uploaded=[];
try{
  a=await login('applicant');b=await login('otherApplicant');m=await login('manager');n=await login('otherManager');second=await login('applicant');
  const unconfirmed=create();const denied=await unconfirmed.auth.signInWithPassword(fixture.users.unconfirmed);assert.ok(denied.error);assert.equal(denied.data.session,null);pass('Real hosted sign-in accepts confirmed fixtures and denies an unconfirmed fixture');
  assert.equal(await a.account(fixture.users.applicant.id),null);
  await a.register('applicant');await b.register('applicant');await m.register('hiring');await n.register('hiring');
  assert.equal(await a.draft('applicant',fixture.users.applicant.id),null);await assert.rejects(()=>a.register('hiring'));pass('New accounts have no profile; account roles cannot be changed');
  await a.save(applicant,0);await m.save(hiring,0);await m.publish('hiring',1);await n.save({...hiring,fields:{...hiring.fields,managerName:'Unrelated test manager'}},0);await n.publish('hiring',1);
  const teams=await a.teams();assert.ok(teams.some(t=>t.owner_id===fixture.users.manager.id&&t.profile.answers.communication==='live'));pass('Applicants can read published manager profiles and their questionnaire answers');
  const bytes=pdfBytes();const file=await a.fileRequest({method:'POST',file:new File([bytes],'fictional-resume.pdf',{type:'application/pdf'})});uploaded.push(file.id);
  applicant.resumeId=file.id;await a.save(applicant,1);
  const restored=await second.draft('applicant',fixture.users.applicant.id);assert.equal(restored.document.resumeId,file.id);assert.match(restored.document.fields.experience,/Role four/);assert.equal(restored.document.featuredRoles.length,3);
  await second.save({...restored.document,fields:{...restored.document.fields,summary:'Saved from another independent sign-in.'}},2);
  const staleStart=Date.now();await assert.rejects(()=>a.save(applicant,2),error=>/another device/.test(error.message));assert.ok(Date.now()-staleStart<15000,'stale save should return promptly');pass('Profiles, all work history, three highlights and PDF references persist across independent sign-ins; stale saves fail promptly');
  for(const api of [b,m,n])assert.equal(await api.draft('applicant',fixture.users.applicant.id),null);
  const anon=create();assert.ok((await anon.from('forward_applicant_drafts').select('*')).error);assert.ok((await anon.rpc('forward_register',{p_role:'applicant'})).error);
  assert.ok((await a.client.from('forward_accounts').update({role:'hiring'}).eq('user_id',fixture.users.applicant.id)).error);pass('Anonymous access, cross-account draft access and direct role changes are denied');
  await a.publish('applicant',3);assert.equal((await m.applicants()).length,0);await a.share(fixture.users.manager.id,3);
  const shared=(await m.applicants()).find(p=>p.owner_id===fixture.users.applicant.id);assert.ok(shared);assert.equal(shared.resume_id,file.id);for(const key of ['email','phone','preferences'])assert.equal(key in shared.profile,false);
  assert.equal((await n.applicants()).length,0);assert.equal((await b.applicants()).length,0);assert.equal((await m.prompts(fixture.users.applicant.id))[0].topic,'communication');pass('Only the chosen manager receives the shared profile and discussion prompts; private contact fields and answers are excluded');
  const blob=await m.fileRequest({id:file.id});assert.ok(blob instanceof Blob);assert.deepEqual(new Uint8Array(await blob.arrayBuffer()),bytes);
  await assert.rejects(()=>n.fileRequest({id:file.id}));assert.ok((await m.client.storage.from('forward-resumes').createSignedUrl(file.path,60)).error);pass('Authorized résumé download returns exact original PDF bytes; unrelated managers and direct storage links are denied');
  const png=new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/a9sAAAAASUVORK5CYII=','base64'));
  const img=await a.fileRequest({method:'POST',file:new File([png],'fictional-image.png',{type:'image/png'})});uploaded.push(img.id);assert.deepEqual(new Uint8Array(await (await a.fileRequest({id:img.id})).arrayBuffer()),png);
  await assert.rejects(()=>a.fileRequest({method:'POST',file:new File(['<html>not a PDF</html>'],'bad.pdf',{type:'application/pdf'})}));pass('Real image upload/download succeeds and disguised PDF content is rejected');
  await a.withdraw(fixture.users.manager.id);assert.equal((await m.applicants()).length,0);await assert.rejects(()=>m.fileRequest({id:file.id}));await assert.rejects(()=>m.prompts(fixture.users.applicant.id));
  await a.publish('applicant',3);assert.equal((await m.applicants()).length,0);pass('Withdrawal blocks new profile reads, prompts and file downloads; republishing does not silently restore access');
  const endpoint=accountConfig.supabaseUrl+'/functions/v1/resume';assert.equal((await fetch(endpoint,{headers:{Origin:origin}})).status,401);assert.equal((await fetch(endpoint,{headers:{Origin:'https://example.invalid'}})).status,403);pass('Deployed file endpoint rejects missing authentication and unsupported origins');
  console.log(JSON.stringify({hostedChecks:passed.length,result:'passed',emailDeliveryTested:false}));
}finally{
  if(a){await a.unpublish();const saved=await a.draft('applicant',fixture.users.applicant.id);if(saved?.document?.resumeId)await a.save({...saved.document,resumeId:null},saved.version);for(const id of uploaded)await a.fileRequest({method:'DELETE',id});}
  for(const api of [m,n])if(api)await api.unpublish();
  for(const client of clients)await client.auth.signOut();
}
