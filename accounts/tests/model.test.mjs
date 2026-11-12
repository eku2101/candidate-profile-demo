import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeApplicant,applicantIssues,discussionPrompts,configReady,importReviewedFields} from '../model.mjs';
import {fileMime,safeFilename,createResumeHandler} from '../../supabase/functions/resume/handler.mjs';
test('new cloud accounts start blank and do not acquire browser-demo information automatically',()=>{
  const profile=normalizeApplicant();assert.ok(Object.values(profile.fields).every(v=>v===''));assert.ok(Object.values(profile.preferences).every(v=>v===''));assert.equal(profile.resumeId,null);
  assert.ok(applicantIssues(profile,true).some(i=>i.key==='preferences'));
});
test('reviewed imports retain existing story and all history without automatically selecting highlights',()=>{
  const original=normalizeApplicant({fields:{name:'Riley Park',mission:'Help people.'}});
  const result=importReviewedFields(original,{name:'Riley Park',experience:'First job\nSecond job\nThird job\nFourth job'});
  assert.equal(result.fields.mission,'Help people.');assert.match(result.fields.experience,/Fourth job/);assert.ok(result.featuredRoles.every(r=>r.title===''));assert.equal(original.fields.experience,'');
});
test('differing preferences create questions while equal and flexible choices do not',()=>{
  assert.equal(discussionPrompts({focus:'protected'},{focus:'open'}).length,1);
  assert.equal(discussionPrompts({focus:'flexible'},{focus:'open'}).length,0);
  assert.equal(discussionPrompts({focus:'protected'},{focus:'protected'}).length,0);
  assert.ok(discussionPrompts({communication:'written'},{communication:'live'})[0].question.endsWith('?'));
});
test('account setup fails closed for missing config, insecure URLs, and server secrets',()=>{
  assert.equal(configReady({enabled:false}),false);
  assert.equal(configReady({enabled:true,supabaseUrl:'https://project.supabase.co',publishableKey:'sb_publishable_example'}),true);
  assert.equal(configReady({enabled:true,supabaseUrl:'https://project.supabase.co',publishableKey:'sb_secret_example'}),false);
  assert.equal(configReady({enabled:true,supabaseUrl:'http://project.supabase.co',publishableKey:'sb_publishable_example'}),false);
});
test('file validation checks signatures and cleans download filenames',()=>{
  assert.equal(fileMime(new TextEncoder().encode('%PDF-1.7\nexample')),'application/pdf');
  assert.equal(fileMime(new TextEncoder().encode('<script>alert(1)</script>')),null);
  assert.equal(fileMime(new Uint8Array([137,80,78,71,13,10,26,10])),'image/png');
  assert.equal(safeFilename('../resume\r\n.pdf'),'..resume.pdf');
});
test('the file service rejects missing identity and unsupported origins before accessing storage',async()=>{
  let touched=false;const handler=createResumeHandler({allowedOrigin:'https://eku2101.github.io',admin:{},createUserClient(){touched=true;return{};}});
  assert.equal((await handler(new Request('https://api.test/resume',{headers:{origin:'https://attacker.test'}}))).status,403);
  assert.equal((await handler(new Request('https://api.test/resume',{headers:{origin:'https://eku2101.github.io'}}))).status,401);assert.equal(touched,false);
});
test('a revoked or missing file is denied without making a privileged storage request',async()=>{
  let storageTouched=false;const chain={select(){return this},eq(){return this},async maybeSingle(){return{data:null,error:null}}};
  const handler=createResumeHandler({allowedOrigin:'https://eku2101.github.io',createUserClient:()=>({auth:{getUser:async()=>({data:{user:{id:'11111111-1111-4111-8111-111111111111',email_confirmed_at:'2026-11-12'}}})},from:()=>chain}),admin:{storage:{from(){storageTouched=true;throw new Error('must not run');}}}});
  const response=await handler(new Request('https://api.test/resume?id=55555555-5555-4555-8555-555555555555',{headers:{origin:'https://eku2101.github.io',authorization:'Bearer test-token'}}));assert.equal(response.status,404);assert.equal(storageTouched,false);
});
test('an authorized download returns exact binary bytes and never a reusable public URL',async()=>{
  const bytes=new Uint8Array([137,80,78,71,13,10,26,10,0,255,128]);
  const metadata={id:'55555555-5555-4555-8555-555555555555',owner_id:'11111111-1111-4111-8111-111111111111',path:'private/file',name:'resume.png',mime:'image/png'};
  const chain={select(){return this},eq(){return this},async maybeSingle(){return{data:metadata}}};
  const handler=createResumeHandler({allowedOrigin:'https://eku2101.github.io',createUserClient:()=>({auth:{getUser:async()=>({data:{user:{id:'33333333-3333-4333-8333-333333333333',email_confirmed_at:'2026-11-12'}}})},from:()=>chain}),admin:{storage:{from:()=>({download:async path=>{assert.equal(path,metadata.path);return{data:new Blob([bytes])};}})}}});
  const response=await handler(new Request('https://api.test/resume?id='+metadata.id,{headers:{origin:'https://eku2101.github.io',authorization:'Bearer test-token'}}));
  assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(response.headers.get('content-type'),'application/octet-stream');assert.match(response.headers.get('content-disposition'),/attachment/);assert.deepEqual(new Uint8Array(await response.arrayBuffer()),bytes);
});
test('upload rejects disguised contents before writing to private storage',async()=>{
  let wrote=false;
  const chain={select(){return this},eq(){return this},async single(){return{data:{role:'applicant'}}}};
  const handler=createResumeHandler({allowedOrigin:'https://eku2101.github.io',createUserClient:()=>({auth:{getUser:async()=>({data:{user:{id:'11111111-1111-4111-8111-111111111111',email_confirmed_at:'2026-11-12'}}})},from:()=>chain}),admin:{storage:{from(){wrote=true;return{};}}}});
  const form=new FormData();form.append('file',new Blob(['<html>not a PDF</html>'],{type:'application/pdf'}),'resume.pdf');
  const response=await handler(new Request('https://api.test/resume',{method:'POST',headers:{origin:'https://eku2101.github.io',authorization:'Bearer test-token'},body:form}));assert.equal(response.status,400);assert.equal(wrote,false);
});
