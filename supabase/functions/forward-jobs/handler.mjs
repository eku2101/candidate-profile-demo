const countries=new Set(['us','gb','ca','au']);

function normalizeJob(job){
  if(typeof job?.title!=='string'||typeof job.redirect_url!=='string')return null;
  let url;
  try{url=new URL(job.redirect_url);}catch{return null;}
  if(!['http:','https:'].includes(url.protocol)||!/(^|\.)adzuna\.(com|co\.uk|ca|com\.au)$/.test(url.hostname))return null;
  url.protocol='https:';
  const latitude=job.latitude, longitude=job.longitude;
  const hasLocation=Number.isFinite(latitude)&&Math.abs(latitude)<85&&Number.isFinite(longitude)&&Math.abs(longitude)<=180&&(latitude!==0||longitude!==0);
  return {
    title:job.title,company:job.company?.display_name||'',location:job.location?.display_name||'',
    description:typeof job.description==='string'?job.description:'',url:url.href,
    latitude:hasLocation?latitude:null,longitude:hasLocation?longitude:null
  };
}

export function createJobsHandler({origin,appId,appKey,identify,takeRequest,fetchJobs=fetch}){
  return async request=>{
    const headers={
      'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization, apikey, content-type',
      'Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json','Cache-Control':'no-store'
    };
    const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
    const fail=(error,status)=>reply({error},status);
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
    if(request.method!=='POST')return fail('Use POST to search.',405);
    const auth=request.headers.get('authorization');
    if(!auth?.startsWith('Bearer '))return fail('Sign in to search for jobs.',401);
    try{
      const userId=await identify(auth.slice(7));
      if(!userId)return fail('Sign in again to search for jobs.',401);
      let input;
      try{input=await request.json();}catch{return fail('Enter a role, skill, or location.',400);}
      const keywords=typeof input?.keywords==='string'?input.keywords.trim():'';
      const location=typeof input?.location==='string'?input.location.trim():'';
      const country=input?.country;
      if(!countries.has(country)||keywords.length>100||location.length>100||!(keywords||location)){
        return fail('Choose a country and enter a role, skill, or location up to 100 characters.',400);
      }
      if(!appId||!appKey)return fail('Live listings are awaiting an Adzuna connection. You can browse Adzuna directly below the search fields.',503);
      if(!await takeRequest(userId))return fail('The daily search limit has been reached. Try again tomorrow or browse Adzuna directly.',429);
      const url=new URL('https://api.adzuna.com/v1/api/jobs/'+country+'/search/1');
      url.search=new URLSearchParams({app_id:appId,app_key:appKey,results_per_page:'20','content-type':'application/json'});
      if(keywords)url.searchParams.set('what',keywords);
      if(location)url.searchParams.set('where',location);
      const response=await fetchJobs(url,{signal:AbortSignal.timeout(10000),redirect:'error'});
      if(!response.ok)return fail('Adzuna listings are temporarily unavailable. Try again later or browse Adzuna directly.',503);
      const data=await response.json();
      if(!Array.isArray(data.results))throw new Error('Invalid job results');
      return reply({jobs:data.results.slice(0,20).map(normalizeJob).filter(Boolean)});
    }catch{
      return fail('Job search is temporarily unavailable. Try again later or browse Adzuna directly.',503);
    }
  };
}
