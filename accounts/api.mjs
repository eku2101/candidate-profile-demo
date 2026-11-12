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
    teams:()=>checked(client.rpc('forward_open_roles')),
    applicants:()=>checked(client.from('forward_applicant_publications').select('*').order('updated_at',{ascending:false})),
    prompts:applicantId=>checked(client.rpc('forward_conversation_prompts',{p_applicant_id:applicantId})),
    shares:()=>list('forward_shares'),
    share:(managerId,version)=>checked(client.rpc('forward_share',{p_manager_id:managerId,p_version:version})),
    withdraw:managerId=>checked(client.rpc('forward_withdraw',{p_manager_id:managerId})),
    connections:()=>checked(client.rpc('forward_connections')),
    recordProfileView:id=>checked(client.rpc('forward_record_profile_view',{p_profile_id:id})),
    profileViewers:()=>checked(client.rpc('forward_profile_viewers')),
    chooseConnection:(id,choice)=>checked(client.rpc('forward_choose_connection',{p_other_id:id,p_choice:choice})),
    declineWithFeedback:(id,reason,nextStep)=>checked(client.rpc('forward_decline_with_feedback',{
      p_applicant_id:id,p_reason:reason,p_next_step:nextStep
    })),
    feedback:(before,limit=30)=>{
      const query=client.from('forward_decline_feedback').select('id,kind,company,role_title,reason,next_step,created_at')
        .order('id',{ascending:false}).limit(limit);
      return checked(before===undefined?query:query.lt('id',before));
    },
    chatStarter:id=>checked(client.rpc('forward_chat_starter',{p_connection_id:id})),
    messageUpdates:()=>checked(client.rpc('forward_message_updates')),
    listCommunityPosts:authorId=>{
      const query=client.from('forward_community_posts').select('*').not('published_at','is',null).not('author_id','is',null)
        .order('published_at',{ascending:false}).order('id',{ascending:false}).limit(24);
      return checked(authorId?query.eq('author_id',authorId):query);
    },
    communityDrafts:()=>checked(client.from('forward_community_posts').select('*').is('published_at',null)),
    communityPost:id=>checked(client.from('forward_community_posts').select('*').eq('id',id).maybeSingle()),
    addCommunityDraft:post=>checked(client.from('forward_community_posts').insert(post)),
    publishCommunityDraft:id=>checked(client.rpc('forward_publish_community_post',{p_id:id})),
    discardCommunityPost:(id,onlyDraft=false)=>{
      const query=client.from('forward_community_posts').delete().eq('id',id);
      return checked((onlyDraft?query.is('published_at',null):query).select('id').maybeSingle());
    },
    communityAsset:path=>checked(client.storage.from('forward-community').download(path)),
    uploadCommunityAsset:(path,file)=>checked(client.storage.from('forward-community').upload(path,file,{
      contentType:file.type,upsert:false,cacheControl:'60'
    })),
    removeCommunityAssets:paths=>checked(client.storage.from('forward-community').remove(paths)),
    communityEngagement:postIds=>checked(client.rpc('forward_community_engagement',{p_post_ids:postIds})),
    setCommunityLike:(postId,liked)=>checked(liked
      ?client.from('forward_community_likes').upsert({post_id:postId},{onConflict:'post_id,member_id',ignoreDuplicates:true})
      :client.from('forward_community_likes').delete().eq('post_id',postId)),
    communityComments:postId=>checked(client.from('forward_community_comments').select('*')
      .eq('post_id',postId).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(50)),
    addCommunityComment:(postId,authorName,body)=>checked(client.from('forward_community_comments')
      .insert({post_id:postId,author_name:authorName,body})),
    employerStatus:async()=> (await checked(client.rpc('forward_employer_status')))[0]||null,
    requestVerification:website=>checked(client.rpc('forward_request_employer_verification',{p_website:website})),
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
