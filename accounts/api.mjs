export function createAccountAPI(client) {
  const checked=async request=>{const {data,error}=await request;if(error)throw error;return data;};
  const list=(table)=>checked(client.from(table).select('*'));
  const one=(table,id)=>checked(client.from(table).select('*').eq('owner_id',id).maybeSingle());
  return {
    client,
    account:id=>checked(client.from('forward_accounts').select('*').eq('user_id',id).maybeSingle()),
    register:role=>checked(client.rpc('forward_register',{p_role:role})),
    draft:(role,id)=>one(role==='applicant'?'forward_applicant_drafts':'forward_hiring_drafts',id),
    publication:(role,id)=>one(role==='applicant'?'forward_applicant_publications':'forward_hiring_publications',id),
    save:(document,version)=>checked(client.rpc('forward_save_draft',{p_document:document,p_version:version})),
    publish:(role,version)=>checked(client.rpc(role==='applicant'?'forward_publish_applicant':'forward_publish_hiring',{p_version:version})),
    unpublish:()=>checked(client.rpc('forward_unpublish')),
    teams:()=>checked(client.from('forward_hiring_publications').select('*').order('updated_at',{ascending:false}).limit(100)),
    applicants:()=>checked(client.from('forward_applicant_publications').select('*').order('updated_at',{ascending:false})),
    prompts:applicantId=>checked(client.rpc('forward_conversation_prompts',{p_applicant_id:applicantId})),
    shares:()=>list('forward_shares'),
    share:(managerId,version)=>checked(client.rpc('forward_share',{p_manager_id:managerId,p_version:version})),
    withdraw:managerId=>checked(client.rpc('forward_withdraw',{p_manager_id:managerId})),
    connections:()=>checked(client.rpc('forward_connections')),
    recordProfileView:id=>checked(client.rpc('forward_record_profile_view',{p_profile_id:id})),
    profileViewers:()=>checked(client.rpc('forward_profile_viewers')),
    chooseConnection:(id,choice)=>checked(client.rpc('forward_choose_connection',{p_other_id:id,p_choice:choice})),
    messages:(id,before)=>{
      const query=client.from('forward_messages').select('*').eq('connection_id',id).order('id',{ascending:false}).limit(50);
      return checked(before===undefined?query:query.lt('id',before));
    },
    sendMessage:(id,body)=>checked(client.from('forward_messages').insert({connection_id:id,body}).select().single()),
    files:owner=>checked(client.from('forward_files').select('*').eq('owner_id',owner)),
    async fileRequest({method='GET',id,file,kind}={}) {
      const body=file?new FormData():undefined;if(file)body.append('file',file);
      const params=new URLSearchParams();
      if(id)params.set('id',id);
      if(kind)params.set('kind',kind);
      const result=await client.functions.invoke('resume'+(params.size?'?'+params.toString():''),{method,body});
      if(result.error){let message='The document request failed. Check your connection and access, then try again.';try{message=(await result.error.context.json()).error||message;}catch{}throw new Error(message);}
      return result.data;
    }
  };
}
