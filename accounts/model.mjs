export const applicantFields = {
  name:{label:'Name',max:100,required:true},role:{label:'Role title',max:80,required:true},
  location:{label:'Location',max:120},email:{label:'Contact email (private)',max:254},phone:{label:'Phone (private)',max:40},
  skills:{label:'Core skills, separated by commas',max:600},summary:{label:'Short introduction',words:100,required:true},
  experience:{label:'Full work history',max:30000},education:{label:'Education',max:10000},credentials:{label:'Certifications & achievements',max:10000},
  mission:{label:'Why I do this work',words:50},values:{label:'Professional values',words:50},
  wellbeing:{label:'How I support team well-being',words:75},support:{label:'How I support colleagues',words:75},community:{label:'Community impact',words:75}
};
export const hiringBackgroundFields = {
  managerExperience:{label:'Professional experience',max:16000},
  managerEducation:{label:'Education',max:6000},
  managerSkills:{label:'Core skills',max:600},
  managerCredentials:{label:'Certifications & achievements',max:6000}
};

export function hiringResumeFields(fields) {
  return {
    managerName:fields.name,managerTitle:fields.role,location:fields.location,managerBio:fields.summary,
    managerExperience:fields.experience,managerEducation:fields.education,
    managerSkills:fields.skills,managerCredentials:fields.credentials
  };
}
export const questionLabels={focus:'Quiet focus time',brainstorming:'Group brainstorming',communication:'Everyday communication',checkIns:'Team check-ins',rhythm:'Workload rhythm',environment:'Team environment',experience:'Preferred experience level'};
export const questions={
  focus:{protected:'Regular uninterrupted blocks',open:'Short blocks between interactions',flexible:'Flexible — depends on the task'},
  brainstorming:{frequent:'Frequent group idea sessions',occasional:'Occasional, when useful',flexible:'Flexible — depends on the task'},
  communication:{written:'Written updates first',live:'Live conversations first',flexible:'A flexible mix of both'},
  checkIns:{frequent:'Frequent, brief check-ins',milestones:'At milestones or when needed',flexible:'Flexible — depends on the task'},
  rhythm:{steady:'Steady and predictable',fast:'Fast-paced and varied',flexible:'Flexible by project'},
  environment:{enterprise:'Large enterprise',mid:'Mid-size company',small:'Small contractor or close-knit team',startup:'Startup or early-stage team',remote:'Remote-first distributed team'},
  experience:{entry:'Entry level',mid:'Mid level',senior:'Senior level',lead:'Lead or principal'}
};
export function normalizeApplicant(value={}) {
  return {fields:Object.fromEntries(Object.keys(applicantFields).map(key=>[key,typeof value.fields?.[key]==='string'?value.fields[key]:''])),
    preferences:Object.fromEntries(Object.keys(questions).filter(k=>k!=='experience').map(k=>[k,Object.hasOwn(questions[k],value.preferences?.[k])?value.preferences[k]:''])),
    featuredRoles:Array.from({length:3},(_,i)=>Object.fromEntries(['title','dates','summary'].map(k=>[k,typeof value.featuredRoles?.[i]?.[k]==='string'?value.featuredRoles[i][k]:'']))),
    resumeId:typeof value.resumeId==='string'?value.resumeId:null,
    images:normalizeImages(value.images)};
}
export function normalizeImages(value) {
  return {portrait:typeof value?.portrait==='string'?value.portrait:null,showcase:typeof value?.showcase==='string'?value.showcase:null};
}
export const wordCount=value=>String(value||'').trim().split(/\s+/u).filter(Boolean).length;
export function applicantIssues(value,forSharing=false) {
  const doc=normalizeApplicant(value),issues=[];
  for(const [key,rule] of Object.entries(applicantFields)) {
    const text=doc.fields[key].trim();
    if(forSharing&&rule.required&&!text) issues.push({key,message:'Add '+rule.label.toLowerCase()+'.'});
    if(rule.words?wordCount(text)>rule.words:Array.from(text).length>rule.max) issues.push({key,message:`Keep ${rule.label.toLowerCase()} to ${rule.words||rule.max} ${rule.words?'words':'characters'}.`});
  }
  if(doc.fields.skills.split(',').filter(s=>s.trim()).length>10) issues.push({key:'skills',message:'Choose up to 10 core skills.'});
  doc.featuredRoles.forEach((r,i)=>{
    if((r.dates.trim()||r.summary.trim())&&!r.title.trim())issues.push({key:`featured-${i}-title`,message:'Add a title for this featured role.'});
    if(r.title.length>160||r.dates.length>80||wordCount(r.summary)>100)issues.push({key:`featured-${i}-summary`,message:'Keep the role title to 160 characters, dates to 80, and contribution to 100 words.'});
  });
  if(forSharing&&Object.values(doc.preferences).some(v=>!v)) issues.push({key:'preferences',message:'Answer all six work-preference questions.'});
  return issues;
}
export function importReviewedFields(current,imported) {
  const next=normalizeApplicant(current);
  for(const key of Object.keys(applicantFields).slice(0,10)) if(typeof imported[key]==='string'&&imported[key].trim()) next.fields[key]=imported[key].trim();
  return next;
}
export function discussionPrompts(applicant,team) {
  const prompts={focus:'How could we protect focused work while staying available when the team needs help?',brainstorming:'When would a group brainstorm help, and when could people contribute ideas in writing?',communication:'Which updates should be written, and when would a conversation be more useful?',checkIns:'What check-in schedule would give us support without interrupting progress?',rhythm:'How could we agree on priorities when the pace of work changes?',environment:'What support would help us work well in this team’s setting?'};
  return Object.entries(prompts).filter(([k])=>applicant?.[k]&&team?.[k]&&applicant[k]!==team[k]&&applicant[k]!=='flexible'&&team[k]!=='flexible').map(([key,question])=>({key,question}));
}
export function configReady(config) {
  return Boolean(config.enabled&&/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(config.supabaseUrl)&&/^sb_publishable_[A-Za-z0-9_-]+$/.test(config.publishableKey));
}
