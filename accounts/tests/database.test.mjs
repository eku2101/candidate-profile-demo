import {test,before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {normalizeApplicant} from '../model.mjs';
const db=new PGlite();
const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222',m='33333333-3333-4333-8333-333333333333',n='44444444-4444-4444-8444-444444444444';
const answers={focus:'protected',brainstorming:'occasional',communication:'written',checkIns:'milestones',rhythm:'flexible',environment:'remote'};
const applicant=()=>({...normalizeApplicant({fields:{name:'Riley Park',role:'Coordinator',summary:'I help communities.',email:'private@example.test',phone:'555-0100'},preferences:answers}),secret:'never share'});
const hiring=()=>({fields:{managerName:'Morgan',managerTitle:'Manager',company:'Example team',location:'Remote',managerBio:'I support colleagues.',teamStory:'We learn together.',roleTitle:'Coordinator',employmentType:'Full time',roleSummary:'Help neighbors connect.'},answers:{...answers,experience:'mid'}});
async function as(id,sql,args=[]) {await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id||'']);await db.exec('set role '+(id?'authenticated':'anon'));return db.query(sql,args);}
async function rpc(id,name,args=[],casts=[]) {return as(id,`select public.${name}(${args.map((_,i)=>'$'+(i+1)+(casts[i]?'::'+casts[i]:'')).join(',')}) as result`,args);}
async function setupApplicant(id=a) {await rpc(id,'forward_register',['applicant']);await rpc(id,'forward_save_draft',[JSON.stringify(applicant()),0],['jsonb','integer']);await rpc(id,'forward_publish_applicant',[1]);}
async function requestEmployer(id=m) {
  await rpc(id,'forward_register',['hiring']);
  await rpc(id,'forward_save_draft',[JSON.stringify(hiring()),0],['jsonb','integer']);
  await rpc(id,'forward_request_employer_verification',['https://example.org']);
}
async function approveEmployer(id=m) {
  await db.exec('reset role');
  await db.query("update forward_private.forward_employer_verification set status='approved' where manager_id=$1",[id]);
}
async function setupManager(id=m) {
  await requestEmployer(id);
  await approveEmployer(id);
  await rpc(id,'forward_publish_hiring',[1]);
}
before(async()=>{
  await db.exec(`create schema auth;create schema storage;create schema realtime;
    create role anon;create role authenticated;create role service_role bypassrls;
    grant usage on schema public,auth to anon,authenticated,service_role;
    create table auth.users(id uuid primary key,email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(bucket_id text not null,name text not null,primary key(bucket_id,name));
    alter table storage.objects enable row level security;
    grant usage on schema storage to authenticated;
    grant select,insert,delete on storage.objects to authenticated;
    create table realtime.messages(payload jsonb,event text,topic text,private boolean,extension text);
    alter table realtime.messages enable row level security;
    grant usage on schema realtime to authenticated;
    grant select on realtime.messages to authenticated;
    create function realtime.topic() returns text language sql stable as $$select current_setting('realtime.topic',true)$$;
    create function realtime.send(jsonb,text,text,boolean) returns void language sql as $$
      insert into realtime.messages values($1,$2,$3,$4,'broadcast')
    $$;`);
  const migrations=new URL('../../supabase/migrations/',import.meta.url);
  for(const file of (await readdir(migrations)).filter(name=>name.endsWith('.sql')).sort())await db.exec(await readFile(new URL(file,migrations),'utf8'));
});
beforeEach(async()=>{await db.exec('reset role;truncate auth.users cascade;truncate realtime.messages,storage.objects');for(const id of [a,b,m,n])await db.query('insert into auth.users values($1,now())',[id]);});
after(()=>db.close());
test('anonymous callers cannot read profiles, files, or register accounts',async()=>{
  await setupApplicant();
  for(const table of ['forward_accounts','forward_files','forward_applicant_drafts','forward_applicant_publications','forward_hiring_publications','forward_shares'])await assert.rejects(()=>as(null,'select * from public.'+table),/permission denied/);
  await assert.rejects(()=>rpc(null,'forward_register',['hiring']),/permission denied/);
});
test('roles cannot change and unpublished drafts never leak between accounts',async()=>{
  await setupApplicant();await setupManager();
  await assert.rejects(()=>rpc(a,'forward_register',['hiring']),/different role/);
  assert.equal((await as(m,'select * from public.forward_applicant_drafts')).rows.length,0);
  assert.equal((await as(a,'select * from public.forward_hiring_drafts')).rows.length,0);
  await assert.rejects(()=>as(m,'update public.forward_accounts set role=\'applicant\''),/permission denied/);
});
test('community media is private until every attachment is uploaded and only its author can remove the post',async()=>{
  await setupApplicant();await setupManager();
  const post='55555555-5555-4555-8555-555555555555';
  const first=a+'/'+post+'/1.jpg';
  const second=a+'/'+post+'/2.mp4';
  const posts='select * from public.forward_community_posts';
  const media="select name from storage.objects where bucket_id='forward-community'";
  const upload="insert into storage.objects(bucket_id,name) values('forward-community',$1)";
  await as(a,`insert into public.forward_community_posts(id,author_name,caption,extensions,descriptions)
    values($1,'Riley','A workshop recap',array['jpg','mp4'],array['Workshop photo','Workshop clip'])`,[post]);
  await assert.rejects(()=>as(m,upload,[first]),/row-level security/);
  await assert.rejects(()=>as(a,upload,[a+'/'+post+'/3.jpg']),/row-level security/);
  await as(a,upload,[first]);
  assert.equal((await as(m,posts)).rows.length,0);
  assert.equal((await as(m,media)).rows.length,0);
  const like='insert into public.forward_community_likes(post_id) values($1) on conflict do nothing';
  const comment="insert into public.forward_community_comments(post_id,author_name,body) values($1,'Morgan','Good workshop recap.')";
  await assert.rejects(()=>as(a,like,[post]),/row-level security/);
  await assert.rejects(()=>as(a,comment,[post]),/row-level security/);
  await assert.rejects(()=>rpc(a,'forward_publish_community_post',[post]),/every photo and video/);
  await assert.rejects(()=>rpc(m,'forward_publish_community_post',[post]),/no longer available/);
  await as(a,upload,[second]);
  await rpc(a,'forward_publish_community_post',[post]);
  await rpc(a,'forward_publish_community_post',[post]);
  assert.equal((await as(m,posts)).rows.length,1);
  assert.equal((await as(m,media)).rows.length,2);
  await as(a,like,[post]);
  await as(a,like,[post]);
  await as(m,comment,[post]);
  const summary=actor=>as(actor,'select * from public.forward_community_engagement(array[$1::uuid])',[post]);
  assert.deepEqual((await summary(m)).rows,[{post_id:post,like_count:1,comment_count:1,liked:false}]);
  assert.equal((await summary(a)).rows[0].liked,true);
  assert.equal((await summary(b)).rows.length,0);
  assert.equal((await as(m,'select * from public.forward_community_likes')).rows.length,0);
  assert.equal((await as(a,'select body from public.forward_community_comments')).rows[0].body,'Good workshop recap.');
  assert.equal((await as(a,'delete from public.forward_community_comments returning id')).rows.length,0);
  assert.equal((await as(b,'select * from public.forward_community_comments')).rows.length,0);
  await as(a,'delete from public.forward_community_likes where post_id=$1',[post]);
  assert.equal((await summary(m)).rows[0].like_count,0);
  assert.equal((await as(m,'delete from public.forward_community_posts returning id')).rows.length,0);
  assert.equal((await as(a,'delete from storage.objects returning name')).rows.length,0);
  await assert.rejects(()=>as(null,posts),/permission denied/);
  await as(a,'delete from public.forward_community_posts where id=$1',[post]);
  assert.equal((await summary(m)).rows.length,0);
  assert.equal((await as(m,'select * from public.forward_community_comments')).rows.length,0);
  assert.equal((await as(m,media)).rows.length,0);
  assert.equal((await as(a,'delete from storage.objects returning name')).rows.length,2);
});
test('a share stays private, pass is hidden, and only a mutual match can chat',async()=>{
  await setupApplicant();
  await setupApplicant(b);
  await setupManager();
  await setupManager(n);
  await assert.rejects(()=>rpc(n,'forward_choose_connection',[a,'interested']),/no longer shared/);
  await rpc(a,'forward_share',[m,1]);
  await assert.rejects(()=>rpc(a,'forward_choose_connection',[m,'interested']),/unavailable/);
  assert.equal((await rpc(m,'forward_choose_connection',[a,'pass'])).rows[0].result,false);
  assert.equal((await as(a,'select * from public.forward_connections()')).rows.length,0);
  assert.equal((await rpc(a,'forward_choose_connection',[m,'open-chat'])).rows[0].result,false);
  const pending=(await as(a,'select * from public.forward_connections()')).rows[0];
  assert.equal(pending.manager_choice,null);
  assert.equal(pending.matched,false);
  const send='insert into public.forward_messages(connection_id,body) values($1,$2) returning sender_id';
  await assert.rejects(()=>as(a,send,[pending.id,'Before the match']),/row-level security/);
  assert.equal((await rpc(m,'forward_choose_connection',[a,'interested'])).rows[0].result,true);
  assert.equal((await rpc(a,'forward_choose_connection',[m,'open-chat'])).rows[0].result,true);
  await assert.rejects(()=>rpc(m,'forward_choose_connection',[a,'pass']),/already matched/);
  assert.equal((await as(m,send,[pending.id,'Hello from the manager'])).rows[0].sender_id,m);
  assert.equal((await as(a,send,[pending.id,'Hello from the applicant'])).rows[0].sender_id,a);
  assert.equal((await as(a,'select * from public.forward_messages')).rows.length,2);
  assert.equal((await as(m,'select * from public.forward_messages')).rows.length,2);
  assert.equal((await as(b,'select * from public.forward_messages')).rows.length,0);
  await as(a,"select set_config('realtime.topic',$1,false)",['forward-chat:'+pending.id]);
  const signals=actor=>as(actor,'select payload,event,private from realtime.messages');
  assert.deepEqual((await signals(a)).rows,Array(2).fill({payload:{},event:'message-added',private:true}));
  assert.equal((await signals(m)).rows.length,2);
  assert.equal((await signals(b)).rows.length,0);
  const updates=actor=>as(actor,'select * from public.forward_message_updates()');
  const messages=(await as(a,'select id,sender_id from public.forward_messages')).rows;
  for(const [recipient,sender] of [[a,m],[m,a]]){
    assert.deepEqual((await updates(recipient)).rows,[{
      connection_id:pending.id,message_id:messages.find(row=>row.sender_id===sender).id
    }]);
    await as(recipient,"select set_config('realtime.topic',$1,false)",['forward-inbox:'+recipient]);
    assert.deepEqual((await signals(recipient)).rows,[{payload:{},event:'message-received',private:true}]);
    assert.equal((await signals(sender)).rows.length,0);
  }
  assert.equal((await updates(b)).rows.length,0);
  await as(a,"select set_config('realtime.topic',$1,false)",['forward-chat:'+pending.id]);
  assert.equal((await as(n,'select * from public.forward_connections()')).rows.length,0);
  await assert.rejects(()=>as(n,send,[pending.id,'Unrelated manager']),/row-level security/);
  await assert.rejects(()=>as(m,'insert into public.forward_messages(connection_id,sender_id,body) values($1,$2,$3)',[pending.id,a,'Spoofed sender']),/permission denied/);
  await assert.rejects(()=>as(null,'select * from public.forward_messages'),/permission denied/);
  await rpc(a,'forward_withdraw',[m]);
  assert.equal((await as(m,'select * from public.forward_messages')).rows.length,0);
  assert.equal((await signals(m)).rows.length,0);
  assert.equal((await updates(m)).rows.length,0);
  assert.equal((await as(a,'select * from public.forward_connections()')).rows.length,0);
  await rpc(a,'forward_share',[m,1]);
  assert.equal((await as(m,'select * from public.forward_connections()')).rows.length,0);
  assert.equal((await rpc(m,'forward_choose_connection',[a,'interested'])).rows[0].result,false);
  assert.equal((await rpc(a,'forward_choose_connection',[m,'open-chat'])).rows[0].result,true);
});
test('only a specifically chosen manager gets a shared snapshot, and withdrawal removes access',async()=>{
  await setupApplicant();await setupManager();await setupManager(n);await setupApplicant(b);
  assert.equal((await as(m,'select * from public.forward_applicant_publications')).rows.length,0);
  await rpc(a,'forward_share',[m,1]);
  const shared=(await as(m,'select profile from public.forward_applicant_publications')).rows[0].profile;
  assert.equal(shared.name,'Riley Park');
  for(const key of ['email','phone','preferences','secret'])assert.equal(key in shared,false,key);
  assert.equal((await as(n,'select * from public.forward_applicant_publications')).rows.length,0);
  assert.equal((await as(b,'select * from public.forward_applicant_publications')).rows.length,1,'only their own publication');
  await assert.rejects(()=>as(n,'insert into public.forward_shares values($1,$2,now())',[a,n]),/permission denied/);
  await rpc(a,'forward_withdraw',[m]);
  assert.equal((await as(m,'select * from public.forward_applicant_publications')).rows.length,0);
});
test('decline and feedback are atomic, private, and safe to retry',async()=>{
  await setupApplicant();await setupApplicant(b);await setupManager();await setupManager(n);
  await rpc(a,'forward_share',[m,1]);
  const reason='This role needs examples of leading live training.';
  const next='Try co-leading a workshop and document what you changed.';
  const decline=(actor,target,why=reason)=>rpc(actor,'forward_decline_with_feedback',[target,why,next]);
  await assert.rejects(()=>decline(m,a,'Too short'),/20 to 1,200/);
  await assert.rejects(()=>decline(n,a),/no longer shared/);
  await assert.rejects(()=>decline(a,b),/Only a hiring manager/);
  assert.equal((await as(m,'select * from public.forward_connections()')).rows.length,0);
  await decline(m,a);
  await decline(m,a);
  const rows=actor=>as(actor,'select * from public.forward_decline_feedback');
  const feedback=(await rows(a)).rows;
  assert.equal(feedback.length,1);
  assert.equal(feedback[0].reason,reason);
  assert.equal(feedback[0].next_step,next);
  assert.equal(feedback[0].company,'Example team');
  assert.equal((await as(a,'select manager_choice from public.forward_connections()')).rows[0].manager_choice,'pass');
  assert.equal((await rows(b)).rows.length,0);
  assert.equal((await rows(m)).rows.length,0);
  await assert.rejects(()=>rows(null),/permission denied/);
  await rpc(a,'forward_withdraw',[m]);
  assert.equal((await rows(a)).rows.length,1);
  await assert.rejects(()=>decline(m,a),/no longer shared/);
});
test('posting requires employer approval, stale openings can be renewed, and closing sends a private update once',async()=>{
  await setupApplicant();await setupApplicant(b);await requestEmployer();
  await assert.rejects(()=>rpc(m,'forward_publish_hiring',[1]),/must verify/);
  await assert.rejects(()=>as(m,"update forward_private.forward_employer_verification set status='approved'"),/permission denied/);
  await approveEmployer();
  await rpc(m,'forward_publish_hiring',[1]);
  await rpc(a,'forward_share',[m,1]);
  await db.exec('reset role');
  await db.query("update public.forward_hiring_publications set updated_at=now()-interval '31 days' where owner_id=$1",[m]);
  assert.equal((await as(a,'select * from public.forward_open_roles()')).rows.length,0);
  await assert.rejects(()=>rpc(b,'forward_share',[m,1]),/awaiting confirmation/);
  await rpc(m,'forward_publish_hiring',[1]);
  assert.equal((await as(a,'select * from public.forward_open_roles()')).rows.length,1);
  await rpc(m,'forward_unpublish');
  await rpc(m,'forward_unpublish');
  const feedback=(await as(a,'select kind, role_title from public.forward_decline_feedback')).rows;
  assert.deepEqual(feedback,[{kind:'role_closed',role_title:'Coordinator'}]);
  assert.equal((await as(b,'select * from public.forward_decline_feedback')).rows.length,0);
  await assert.rejects(()=>rpc(b,'forward_share',[m,1]),/role is closed/);
  assert.equal((await as(a,'select * from public.forward_shares')).rows.length,1,'applicant still controls résumé access');
});
test('a conversation starter uses preferences only after a mutual match',async()=>{
  await setupApplicant();await setupApplicant(b);await setupManager();
  const team=hiring();
  team.answers.communication='live';
  await rpc(m,'forward_save_draft',[JSON.stringify(team),1],['jsonb','integer']);
  await rpc(m,'forward_publish_hiring',[2]);
  await rpc(a,'forward_share',[m,1]);
  await rpc(m,'forward_choose_connection',[a,'interested']);
  const {id}=(await as(m,'select * from public.forward_connections()')).rows[0];
  const question=async actor=>(await rpc(actor,'forward_chat_starter',[id])).rows[0].result;
  assert.equal(await question(m),null);
  await rpc(a,'forward_choose_connection',[m,'open-chat']);
  assert.match(await question(a),/writing.*quick conversation/);
  assert.equal(await question(m),await question(a));
  assert.equal(await question(b),null);
  await assert.rejects(()=>rpc(m,'forward_decline_with_feedback',[a,
    'This role needs examples of live training.','Try leading a workshop and document the outcome.']),/already matched/);
});
test('profile views are private, deduplicated, and respect who may open a profile',async()=>{
  await setupApplicant();
  await setupManager();
  await setupManager(n);
  const view=(viewer,profile)=>rpc(viewer,'forward_record_profile_view',[profile]);
  const viewers=id=>as(id,'select * from public.forward_profile_viewers()');
  await view(m,a);
  await view(a,a);
  assert.equal((await viewers(a)).rows.length,0);
  await view(a,m);
  assert.equal((await viewers(m)).rows[0].viewer_name,null);
  await rpc(a,'forward_share',[m,1]);
  assert.equal((await viewers(m)).rows[0].viewer_name,'Riley Park');
  await view(m,a);
  await view(m,a);
  await view(n,a);
  const result=(await viewers(a)).rows;
  assert.equal(result.length,1);
  assert.equal(result[0].viewer_name,'Morgan');
  assert.equal(result[0].viewer_role,'hiring');
  assert.equal((await viewers(n)).rows.length,0);
  await assert.rejects(()=>viewers(null),/permission denied/);
  await rpc(a,'forward_withdraw',[m]);
  assert.equal((await viewers(m)).rows[0].viewer_name,null);
});
test('draft edits do not change shared content until explicitly published',async()=>{
  await setupApplicant();await setupManager();await rpc(a,'forward_share',[m,1]);
  const next=applicant();next.fields.summary='A revised introduction.';
  await rpc(a,'forward_save_draft',[JSON.stringify(next),1],['jsonb','integer']);
  assert.equal((await as(m,'select profile from public.forward_applicant_publications')).rows[0].profile.summary,'I help communities.');
  await rpc(a,'forward_publish_applicant',[2]);
  assert.equal((await as(m,'select profile from public.forward_applicant_publications')).rows[0].profile.summary,next.fields.summary);
});
test('a stale device cannot overwrite a newer saved profile',async()=>{
  await setupApplicant();const changed=applicant();changed.fields.name='Updated Name';
  await rpc(a,'forward_save_draft',[JSON.stringify(changed),1],['jsonb','integer']);
  await assert.rejects(()=>rpc(a,'forward_save_draft',[JSON.stringify(applicant()),1],['jsonb','integer']),error=>error.code==='PT409'&&/another device/.test(error.message));
  assert.equal((await as(a,'select document from public.forward_applicant_drafts')).rows[0].document.fields.name,'Updated Name');
});
test('the server rejects incomplete profiles, missing answers, and over-limit public text',async()=>{
  await setupApplicant();let version=1;
  for(const change of [d=>d.fields.name='',d=>d.preferences.focus='',d=>d.fields.summary=Array(101).fill('word').join(' '),d=>d.featuredRoles[0].summary='Title missing']){
    const next=applicant();change(next);await rpc(a,'forward_save_draft',[JSON.stringify(next),version++],['jsonb','integer']);
    await assert.rejects(()=>rpc(a,'forward_publish_applicant',[version]));
  }
});
test('file metadata follows explicit sharing, and a different applicant cannot attach the file',async()=>{
  await setupApplicant();await setupManager();await setupApplicant(b);
  const file='55555555-5555-4555-8555-555555555555';
  await db.exec('reset role');await db.query('insert into public.forward_files(id,owner_id,path,name,mime,size) values($1,$2,$3,\'resume.pdf\',\'application/pdf\',100)',[file,a,a+'/'+file]);
  const doc=applicant();doc.resumeId=file;
  await assert.rejects(()=>rpc(b,'forward_save_draft',[JSON.stringify(doc),1],['jsonb','integer']),/does not belong/);
  await rpc(a,'forward_save_draft',[JSON.stringify(doc),1],['jsonb','integer']);await rpc(a,'forward_publish_applicant',[2]);
  assert.equal((await as(m,'select * from public.forward_files')).rows.length,0);
  await rpc(a,'forward_share',[m,2]);assert.equal((await as(m,'select * from public.forward_files')).rows.length,1);
  await rpc(a,'forward_withdraw',[m]);assert.equal((await as(m,'select * from public.forward_files')).rows.length,0);
});
test('profile photos follow publication and sharing without exposing draft images',async()=>{
  await setupApplicant();
  await setupApplicant(b);
  await setupManager();
  const portrait='55555555-5555-4555-8555-555555555555';
  const project='66666666-6666-4666-8666-666666666666';
  const team='77777777-7777-4777-8777-777777777777';
  await db.exec('reset role');
  for(const [id,owner,kind] of [[portrait,a,'portrait'],[project,a,'showcase'],[team,m,'showcase']]){
    await db.query("insert into public.forward_files(id,owner_id,path,name,mime,size,kind) values($1,$2,$3,'photo.jpg','image/jpeg',100,$4)",[id,owner,owner+'/'+id,kind]);
  }
  const doc=applicant();
  doc.images={portrait,showcase:project};
  await assert.rejects(()=>rpc(b,'forward_save_draft',[JSON.stringify(doc),1],['jsonb','integer']),/does not belong/);
  await assert.rejects(()=>rpc(a,'forward_save_draft',[JSON.stringify({...doc,resumeId:project}),1],['jsonb','integer']),/résumé document/);
  await rpc(a,'forward_save_draft',[JSON.stringify(doc),1],['jsonb','integer']);
  await rpc(a,'forward_share',[m,1]);
  const filesFor=(actor,owner)=>as(actor,'select id from public.forward_files where owner_id=$1 order by id',[owner]);
  assert.equal((await filesFor(m,a)).rows.length,0);
  await rpc(a,'forward_publish_applicant',[2]);
  assert.deepEqual((await filesFor(m,a)).rows.map(row=>row.id),[portrait,project]);
  assert.equal((await filesFor(b,a)).rows.length,0);
  await rpc(a,'forward_save_draft',[JSON.stringify({...doc,images:{portrait:null,showcase:null}}),2],['jsonb','integer']);
  await db.exec('reset role');
  await assert.rejects(()=>db.query('delete from public.forward_files where id=$1',[portrait]),/shared profile first/);
  await rpc(a,'forward_publish_applicant',[3]);
  assert.equal((await filesFor(m,a)).rows.length,0);
  const managerDoc={...hiring(),images:{portrait:null,showcase:team}};
  await rpc(m,'forward_save_draft',[JSON.stringify(managerDoc),1],['jsonb','integer']);
  assert.equal((await filesFor(b,m)).rows.length,0);
  await rpc(m,'forward_publish_hiring',[2]);
  assert.equal((await filesFor(b,m)).rows[0].id,team);
  await rpc(m,'forward_unpublish');
  assert.equal((await filesFor(b,m)).rows.length,0);
});
test('a hiring résumé is private while selected background fields publish',async()=>{
  await setupApplicant();
  await setupManager();
  await setupManager(n);
  const id='55555555-5555-4555-8555-555555555555';
  await db.exec('reset role');
  await db.query("insert into public.forward_files(id,owner_id,path,name,mime,size) values($1,$2,$3,'manager.pdf','application/pdf',100)",[id,m,m+'/'+id]);
  const document={...hiring(),resumeId:id};
  document.fields.managerExperience='Led a community program.';
  document.fields.managerEducation='Example University';
  document.fields.email='private@example.test';
  await assert.rejects(()=>rpc(n,'forward_save_draft',[JSON.stringify(document),1],['jsonb','integer']),/does not belong/);
  await rpc(m,'forward_save_draft',[JSON.stringify(document),1],['jsonb','integer']);
  await db.exec('reset role');
  await assert.rejects(()=>db.query('delete from public.forward_files where id=$1',[id]),/saved draft first/);
  await rpc(m,'forward_publish_hiring',[2]);
  const published=(await as(a,'select profile from public.forward_hiring_publications where owner_id=$1',[m])).rows[0].profile;
  assert.equal(published.managerExperience,'Led a community program.');
  assert.equal(published.managerEducation,'Example University');
  assert.equal('email' in published,false);
  assert.equal('resumeId' in published,false);
  assert.equal((await as(a,'select id from public.forward_files where id=$1',[id])).rows.length,0);
  assert.equal((await as(m,'select id from public.forward_files where id=$1',[id])).rows.length,1);
});
test('unpublishing an applicant also removes all grants instead of silently restoring access later',async()=>{
  await setupApplicant();await setupManager();await rpc(a,'forward_share',[m,1]);await rpc(a,'forward_unpublish');
  assert.equal((await as(m,'select * from public.forward_shares')).rows.length,0);
  await rpc(a,'forward_publish_applicant',[1]);assert.equal((await as(m,'select * from public.forward_applicant_publications')).rows.length,0);
});
test('unconfirmed email cannot register and attached résumé metadata cannot be deleted',async()=>{
  await db.exec('reset role');await db.query('update auth.users set email_confirmed_at=null where id=$1',[b]);
  await assert.rejects(()=>rpc(b,'forward_register',['applicant']),/Confirm your email/);
  await setupApplicant();const file='55555555-5555-4555-8555-555555555555';
  await db.exec('reset role');await db.query('insert into public.forward_files(id,owner_id,path,name,mime,size) values($1,$2,$3,\'resume.pdf\',\'application/pdf\',100)',[file,a,a+'/'+file]);
  const doc=applicant();doc.resumeId=file;await rpc(a,'forward_save_draft',[JSON.stringify(doc),1],['jsonb','integer']);
  await db.exec('reset role');await assert.rejects(()=>db.query('delete from public.forward_files where id=$1',[file]),/saved draft/);
  doc.resumeId=null;await rpc(a,'forward_save_draft',[JSON.stringify(doc),2],['jsonb','integer']);await db.exec('reset role');await db.query('delete from public.forward_files where id=$1',[file]);
});
test('only a chosen manager gets discussion prompts, never private answers or later draft changes',async()=>{
  await setupApplicant();await setupManager();await setupManager(n);const team=hiring();team.answers.communication='live';
  await rpc(m,'forward_save_draft',[JSON.stringify(team),1],['jsonb','integer']);await rpc(m,'forward_publish_hiring',[2]);
  await rpc(a,'forward_share',[m,1]);
  const prompts=(await rpc(m,'forward_conversation_prompts',[a])).rows[0].result;assert.equal(prompts.length,1);assert.equal(prompts[0].topic,'communication');assert.equal('answer' in prompts[0],false);
  await assert.rejects(()=>as(m,'select * from forward_private.forward_applicant_preferences'),/permission denied/);
  await assert.rejects(()=>rpc(n,'forward_conversation_prompts',[a]),/not shared/);
  const next=applicant();next.preferences.communication='live';await rpc(a,'forward_save_draft',[JSON.stringify(next),1],['jsonb','integer']);
  assert.equal((await rpc(m,'forward_conversation_prompts',[a])).rows[0].result.length,1,'unpublished preference edits stay private');
  await rpc(a,'forward_publish_applicant',[2]);assert.equal((await rpc(m,'forward_conversation_prompts',[a])).rows[0].result.length,0);
  await rpc(a,'forward_withdraw',[m]);await assert.rejects(()=>rpc(m,'forward_conversation_prompts',[a]),/not shared/);
});

test('privileged routines and private answers stay outside the exposed schema',async()=>{
  await db.exec('reset role');
  const exposed=await db.query("select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef");
  assert.equal(exposed.rows.length,0);
  assert.equal((await db.query("select has_schema_privilege('anon','forward_private','usage') as allowed")).rows[0].allowed,false);
  assert.equal((await db.query("select has_function_privilege('authenticated','forward_private.forward_words(text)','execute') as allowed")).rows[0].allowed,false);
  await setupApplicant();
  await assert.rejects(()=>as(a,'select * from forward_private.forward_applicant_preferences'),/permission denied/);
  await assert.rejects(()=>as(null,"select forward_private.forward_register('applicant')"),/permission denied/);
});
