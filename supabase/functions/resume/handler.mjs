const MAX_BYTES=10*1024*1024;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function fileMime(bytes) {
  if(new TextDecoder().decode(bytes.slice(0,5))==='%PDF-')return 'application/pdf';
  if(bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff)return 'image/jpeg';
  if([137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v))return 'image/png';
  if(new TextDecoder().decode(bytes.slice(0,4))==='RIFF'&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP')return 'image/webp';
  return null;
}
export function safeFilename(value) {
  return String(value||'resume').replace(/[\x00-\x1f\x7f/\\]/g,'').slice(0,180)||'resume';
}
async function boundedForm(request,maxBytes){
  const reader=request.body?.getReader();if(!reader)throw new Error('Missing upload');
  const chunks=[];let size=0;
  try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>maxBytes+65536){await reader.cancel();return null;}chunks.push(part.value);}}
  finally{reader.releaseLock();}
  return new Response(new Blob(chunks),{headers:{'Content-Type':request.headers.get('content-type')||''}}).formData();
}
export function createResumeHandler({createUserClient,admin,allowedOrigin,randomUUID=()=>crypto.randomUUID()}) {
  return async request=>{
    const params=new URL(request.url).searchParams;
    const origin=request.headers.get('origin');
    const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Origin'};
    const json=(status,message)=>new Response(JSON.stringify(typeof message==='string'?{error:message}:message),{status,headers:{...headers,'Content-Type':'application/json'}});
    if(!allowedOrigin||origin!==allowedOrigin)return json(403,'This origin is not allowed.');
    headers['Access-Control-Allow-Origin']=allowedOrigin;
    headers['Access-Control-Allow-Headers']='authorization, x-client-info, apikey, content-type';
    headers['Access-Control-Allow-Methods']='POST, GET, DELETE, OPTIONS';
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
    if(!['GET','POST','DELETE'].includes(request.method))return json(405,'Method not allowed.');
    const bearer=request.headers.get('authorization')||'';
    if(!/^Bearer \S+$/.test(bearer))return json(401,'Sign in to access résumés.');
    const client=createUserClient(bearer);
    const {data:auth,error:authError}=await client.auth.getUser(bearer.slice(7));
    if(authError||!auth?.user?.id||!auth.user.email_confirmed_at)return json(401,'Sign in with a confirmed email.');
    const userId=auth.user.id;
    try {
      if(request.method==='POST') {
        const kind=params.get('kind')||'resume';
        if(!['resume','portrait','showcase'].includes(kind))return json(400,'Choose a supported upload type.');
        const photo=kind!=='resume';
        const maxBytes=photo?2*1024*1024:MAX_BYTES;
        const account=await client.from('forward_accounts').select('role').eq('user_id',userId).single();
        if(account.error||!['applicant','hiring'].includes(account.data?.role))return json(403,'Choose an account role before uploading.');
        const length=Number(request.headers.get('content-length'));
        if(length>maxBytes+65536)return json(413,photo?'Choose a smaller profile image.':'Choose a file no larger than 10 MB.');
        const form=await boundedForm(request,maxBytes);if(!form)return json(413,photo?'Choose a smaller profile image.':'Choose a file no larger than 10 MB.');
        const file=form.get('file');
        if(!file||typeof file.arrayBuffer!=='function'||!file.size||file.size>maxBytes)return json(400,photo?'Choose a profile image up to 2 MB.':'Choose a PDF, JPG, PNG, or WebP up to 10 MB.');
        const bytes=new Uint8Array(await file.arrayBuffer());
        const mime=fileMime(bytes);
        if(!mime||mime!==file.type)return json(400,'The file contents do not match a supported document type.');
        if(photo&&mime!=='image/jpeg')return json(400,'The profile image must be a JPEG.');
        const count=await client.from('forward_files').select('id',{count:'exact',head:true}).eq('owner_id',userId).eq('kind',kind);
        if(count.error)throw count.error;
        if(count.count>=10)return json(409,photo?'Remove an unused image before uploading another.':'Remove an unused document before uploading another.');
        const id=randomUUID(),path=userId+'/'+id;
        const result=await admin.storage.from('forward-resumes').upload(path,bytes,{contentType:mime,upsert:false,cacheControl:'0'});
        if(result.error)throw result.error;
        const metadata={id,owner_id:userId,path,name:safeFilename(file.name),mime,size:file.size,kind};
        const saved=await admin.from('forward_files').insert(metadata);
        if(saved.error){await admin.storage.from('forward-resumes').remove([path]);throw saved.error;}
        return json(201,metadata);
      }
      const id=params.get('id');
      if(!UUID.test(id||''))return json(400,'Choose a valid document.');
      // RLS returns only an owned file or the current résumé explicitly shared with this manager.
      const selected=await client.from('forward_files').select('*').eq('id',id).maybeSingle();
      if(selected.error||!selected.data)return json(404,'This document is unavailable or is no longer shared with you.');
      const file=selected.data;
      if(request.method==='DELETE') {
        if(file.owner_id!==userId)return json(403,'Only the owner can remove a document.');
        const published=await client.from('forward_applicant_publications').select('resume_id').eq('owner_id',userId).maybeSingle();
        const [applicantDraft,hiringDraft]=await Promise.all(['forward_applicant_drafts','forward_hiring_drafts'].map(table=>client.from(table).select('document').eq('owner_id',userId).maybeSingle()));
        if(published.error||applicantDraft.error||hiringDraft.error)throw new Error('Document check failed');
        if(published.data?.resume_id===id||[applicantDraft,hiringDraft].some(draft=>draft.data?.document?.resumeId===id))return json(409,'Remove this document from your saved draft and shared profile first.');
        // The publication foreign key must be checked before removing bytes: a concurrent
        // publication must never lose its document between our checks and deletion.
        const deleted=await admin.from('forward_files').delete().eq('id',id).eq('owner_id',userId);
        if(deleted.error?.code==='PT409')return json(409,deleted.error.message);
        if(deleted.error)throw deleted.error;
        const removed=await admin.storage.from('forward-resumes').remove([file.path]);
        if(removed.error)throw removed.error;
        return json(200,{removed:true});
      }
      const downloaded=await admin.storage.from('forward-resumes').download(file.path);
      if(downloaded.error||!downloaded.data)return json(404,'The document could not be downloaded.');
      return new Response(downloaded.data,{headers:{...headers,'Content-Type':'application/octet-stream','Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent(file.name)}});
    }catch{return json(503,'The document service could not finish that request. Please try again.');}
  };
}
