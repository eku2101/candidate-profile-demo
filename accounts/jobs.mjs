const adzunaHome={us:'https://www.adzuna.com',gb:'https://www.adzuna.co.uk',ca:'https://www.adzuna.ca',au:'https://www.adzuna.com.au'};

function element(tag,text,className){
  const item=document.createElement(tag);
  if(text)item.textContent=text;
  if(className)item.className=className;
  return item;
}

function externalLink(text,href,className){
  const link=element('a',text,className);
  link.href=href;
  link.target='_blank';
  link.rel='noopener noreferrer';
  return link;
}

function mapFor(job){
  const lat=job.latitude,lon=job.longitude;
  const url=new URL('https://www.openstreetmap.org/export/embed.html');
  const bounds=[Math.max(-180,lon-.07),Math.max(-85,lat-.05),Math.min(180,lon+.07),Math.min(85,lat+.05)];
  url.search=new URLSearchParams({bbox:bounds.join(','),layer:'mapnik',marker:[lat,lon].join(',')});
  const frame=element('iframe',null,'jobs-map');
  frame.src=url.href;
  frame.title='Approximate listing location for '+job.title;
  frame.referrerPolicy='no-referrer';
  return frame;
}

export function mountJobs({host,skills,search}){
  const form=element('form',null,'panel jobs-search');
  const fields=element('div',null,'jobs-fields');
  const keywords=element('input'),location=element('input'),country=element('select');
  keywords.name='keywords'; keywords.maxLength=100; keywords.placeholder='e.g. Instructional designer';
  location.name='location'; location.maxLength=100; location.placeholder='e.g. New York';
  for(const [value,name] of Object.entries({us:'United States',gb:'United Kingdom',ca:'Canada',au:'Australia'})){
    const option=element('option',name); option.value=value; country.append(option);
  }
  for(const [name,input] of [['Role or skill',keywords],['City or region',location],['Country',country]]){
    const label=element('label',name);label.append(input);fields.append(label);
  }
  form.append(fields);
  const chips=element('div',null,'actions');
  for(const skill of [...new Set(String(skills||'').split(',').map(value=>value.trim()).filter(Boolean))].slice(0,8)){
    const chip=element('button',skill,'button secondary');chip.type='button';
    chip.addEventListener('click',()=>{keywords.value=skill.slice(0,100);form.requestSubmit();});
    chips.append(chip);
  }
  if(chips.childElementCount)form.append(element('p','Search with a skill from your profile','help'),chips);
  const actions=element('div',null,'actions');
  const submit=element('button','Search jobs','button');
  const browse=externalLink('Browse Adzuna',adzunaHome.us);
  country.addEventListener('change',()=>{browse.href=adzunaHome[country.value];});
  actions.append(submit,browse);
  const status=element('p','', 'status');status.setAttribute('role','status');
  const results=element('div',null,'jobs-results');
  const map=element('aside',null,'panel jobs-map-panel');
  map.append(element('h2','Listing map'),element('p','Choose a listing with a map location.'));
  form.append(actions,status);
  const layout=element('div',null,'jobs-layout');layout.append(results,map);
  host.replaceChildren(form,layout);
  let request;
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    request?.abort();
    const current=new AbortController();
    request=current;
    const filters={keywords:keywords.value.trim(),location:location.value.trim(),country:country.value};
    results.replaceChildren();
    map.replaceChildren(element('h2','Listing map'),element('p','Choose a listing with a map location.'));
    if(!filters.keywords&&!filters.location){status.textContent='Enter a role, skill, or location.';return;}
    status.textContent='Searching Adzuna…';
    try{
      const data=await search(filters,current.signal);
      if(current.signal.aborted||!form.isConnected)return;
      const jobs=data.jobs;
      status.textContent=jobs.length?`Showing ${jobs.length} listings. Check Adzuna for current availability.`:'No listings found. Try a broader skill or nearby city.';
      for(const job of jobs){
        const card=element('article',null,'panel job-card');
        card.append(element('h2',job.title),element('p',[job.company,job.location].filter(Boolean).join(' · '),'help'),element('p',job.description));
        const links=element('div',null,'actions');
        links.append(externalLink('View listing ↗',job.url,'button secondary'),externalLink('Adzuna',adzunaHome[filters.country],'job-source'));
        if(Number.isFinite(job.latitude)&&Number.isFinite(job.longitude)){
          const pin=element('button','Show on map','button secondary');pin.type='button';
          pin.addEventListener('click',()=>{
            map.replaceChildren(element('h2',job.title),element('p','Approximate listing location · '+job.location),mapFor(job));
            map.tabIndex=-1;
            map.focus();
          });
          links.append(pin);
        }
        card.append(links);results.append(card);
      }
    }catch(error){
      if(!current.signal.aborted&&form.isConnected)status.textContent=error.message||'Job search is temporarily unavailable.';
    }
  });
}
