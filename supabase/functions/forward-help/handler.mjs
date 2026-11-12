const instructions=`You are Vera, Forward's help assistant. Give brief, practical answers about using Forward and writing truthful applicant and hiring manager profiles. Reply in plain text with no Markdown tables. Ask one follow-up when useful. Use placeholders for facts, credentials, numbers, and outcomes the person has not provided. Do not assess or rank candidates or advise on decisions about an individual. Work preferences are conversation starters. You cannot inspect accounts or files, change settings, send messages, or publish profiles. Never request passwords, confirmation codes, private links, or full résumés. For questions outside Forward, redirect to site help or profile writing.

Forward has separate applicant and hiring manager accounts. Sign in after email confirmation; for password reset, use Forgot your password? and the most recent reset email. It has a button and a copyable address. On the profile editor, Upload and autofill from your résumé reads selectable PDF text. Upload status appears by the picker. Review and save if prompted; use Fill again from saved PDF for a saved file. For scans and images, paste the résumé text in the second profile step. The manager's original file stays private. Managers write their own job listing and can preview and publish it under Review & publish. Applicants save a sharing version under Review & share, then share it with an individual manager in Discover teams. Only chosen managers can see a shared applicant profile and attached résumé. Both roles can open examples labeled FAKE. A private Messages thread requires the manager to choose Interested and the applicant to choose I’m open to chat. Profile views shows openings of the full profile, with names when visible. Profile pictures and project or team images are optional.`;

async function readRequest(request){
  const reader=request.body?.getReader();
  if(!reader)return null;
  const decoder=new TextDecoder();
  let text='',length=0;
  try{
    for(;;){
      const {done,value}=await reader.read();
      if(done)break;
      length+=value.byteLength;
      if(length>24000){await reader.cancel();return null;}
      text+=decoder.decode(value,{stream:true});
    }
    return JSON.parse(text+decoder.decode());
  }finally{reader.releaseLock();}
}

export function createHelpHandler({origin,key,model,identify,takeRequest,requestModel=fetch}){
  return async request=>{
    const headers={'Cache-Control':'no-store','Vary':'Origin','Content-Type':'application/json'};
    const json=(status,body)=>new Response(JSON.stringify(body),{status,headers});
    if(request.headers.get('origin')!==origin)return json(403,{answer:null});
    Object.assign(headers,{
      'Access-Control-Allow-Origin':origin,
      'Access-Control-Allow-Methods':'POST, OPTIONS',
      'Access-Control-Allow-Headers':'authorization, apikey, x-client-info, content-type'
    });
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
    if(request.method!=='POST')return json(405,{answer:null});
    if(!key)return json(200,{answer:null});
    const authorization=request.headers.get('authorization')||'';
    if(!/^Bearer \S+$/.test(authorization))return json(401,{answer:null});
    try{
      const caller=await identify(authorization);
      if(!caller)return json(401,{answer:null});
      const payload=await readRequest(request);
      const question=typeof payload?.question==='string'?payload.question.trim():'';
      if(!question||question.length>1000)return json(400,{answer:null});
      const history=Array.isArray(payload.history)?payload.history.slice(-4).filter(item=>
        ['user','assistant'].includes(item?.role)&&typeof item.content==='string'&&item.content.length<=1500
      ).map(({role,content})=>({role,content})):[];
      if(!await takeRequest(caller.id))return json(429,{answer:null});
      const response=await requestModel('https://api.openai.com/v1/responses',{
        method:'POST',
        headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},
        body:JSON.stringify({
          model,instructions:instructions+' The signed-in workspace role is '+caller.role+'.',
          input:[...history,{role:'user',content:question}],store:false,
          reasoning:{effort:'none'},max_output_tokens:350
        }),
        signal:AbortSignal.timeout(12000)
      });
      if(!response.ok){
        const detail=await response.json().catch(()=>null);
        const code=detail?.error?.code;
        console.warn('Vera provider rejected request', response.status,
          typeof code==='string'&&/^[a-z_0-9]{1,64}$/i.test(code)?code:'unknown');
        return json(503,{answer:null});
      }
      const data=await response.json();
      const answer=data.output?.filter(item=>item.type==='message').flatMap(item=>item.content||[])
        .filter(item=>item.type==='output_text'&&typeof item.text==='string').map(item=>item.text).join('\n').trim();
      return answer?json(200,{answer}):json(503,{answer:null});
    }catch(error){
      console.warn('Vera request failed', error?.name==='TimeoutError'?'timeout':'unexpected');
      return json(503,{answer:null});
    }
  };
}
