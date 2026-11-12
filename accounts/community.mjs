const extensions={
  'image/jpeg':'jpg',
  'image/png':'png',
  'image/webp':'webp',
  'video/mp4':'mp4',
  'video/webm':'webm'
};
const maxFileSize=6*1024*1024;
const slideDuration=4000;
const videoExtensions=new Set(['mp4','webm']);

function element(tag,text,className){
  const item=document.createElement(tag);
  if(text!==undefined)item.textContent=text;
  if(className)item.className=className;
  return item;
}

function button(text,action,kind='secondary'){
  const item=element('button',text,'button '+kind);
  item.type='button';
  item.addEventListener('click',action);
  return item;
}

function field(parent,labelText,id,tag='input'){
  const label=element('label',labelText);
  const input=element(tag);
  input.id=label.htmlFor=id;
  parent.append(label,input);
  return input;
}

function examplePosts(){
  const [jordan,amina,mateo]=globalThis.ForwardDemoApplicants;
  const photo=profile=>({
    src:'assets/'+profile.demoImages.showcase,description:profile.demoImages.alt,type:'photo'
  });
  return [
    {
      author_name:jordan.name,byline:jordan.role,example:true,
      caption:'Our workshop planning team tried something small: everyone wrote down one idea before we discussed them. New facilitators had more room to contribute, and we left with a clearer plan for our volunteer instructors.',
      media:[photo(jordan),{src:'assets/demo-applicant-project.jpg',description:'Workshop planning materials and facilitator cards on a table.',type:'photo'},
        {src:'assets/demo-workshop-recap.mp4',description:'Short photo montage from the fictional workshop planning meeting.',type:'video'}]
    },
    {
      author_name:amina.name,byline:amina.role,example:true,
      caption:'At the community infrastructure conference, my colleagues and I compared ways to make public meetings easier to attend. My favorite idea was a phone option for people who couldn’t use the online map.',
      media:[photo(amina)]
    },
    {
      author_name:mateo.name,byline:mateo.role,example:true,
      caption:'Our year-end gathering brought the day and evening shifts together. We shared food and thanked the people whose quiet work keeps our repair program running.',
      media:[photo(mateo)]
    }
  ];
}

function postMedia(post){
  if(post.example)return post.media;
  return post.extensions.map((extension,index)=>({
    path:`${post.author_id}/${post.id}/${index+1}.${extension}`,
    type:videoExtensions.has(extension)?'video':'photo',
    description:post.descriptions[index]||''
  }));
}

function openGallery({post,api,dialog,dialogElement}){
  const media=postMedia(post);
  dialog('Post by '+post.author_name,body=>{
    const stage=element('div',undefined,'community-gallery-stage');
    const counter=element('p',undefined,'help');
    counter.setAttribute('role','status');
    const description=element('p',undefined,'help');
    const controls=element('div',undefined,'community-gallery-controls');
    const caption=element('p',post.caption,'profile-text community-caption');
    const cachedURLs=new Map();
    let index=0;
    let sequence=0;
    let timer;
    let video;
    let active=true;
    let playing=!matchMedia('(prefers-reduced-motion: reduce)').matches;

    const previous=button('← Previous',()=>show(index-1));
    const next=button('Next →',()=>show(index+1));
    const toggle=button('',()=>{
      playing=!playing;
      setToggleLabel();
      if(!playing){
        clearTimeout(timer);
        video?.pause();
      }else if(video&&!video.error){
        if(video.ended&&media.length>1)show(index+1);
        else void video.play().catch(()=>{});
      }else schedule();
    });
    function setToggleLabel(){
      toggle.textContent=playing?'Pause slideshow':'Play slideshow';
    }
    setToggleLabel();
    controls.append(previous,counter,next,toggle);
    if(post.example)body.append(element('strong','FICTIONAL EXAMPLE','fake-label'));
    body.append(stage,controls,description,caption);
    controls.hidden=media.length<2;

    function schedule(){
      clearTimeout(timer);
      if(active&&playing&&!document.hidden&&media.length>1){
        timer=setTimeout(()=>show(index+1),slideDuration);
      }
    }
    function onVisibility(){
      if(document.hidden){
        clearTimeout(timer);
        video?.pause();
      }else if(playing&&video&&!video.error){
        if(video.ended&&media.length>1)show(index+1);
        else void video.play().catch(()=>{});
      }else schedule();
    }

    async function show(position){
      const request=++sequence;
      clearTimeout(timer);
      video?.pause();
      video=undefined;
      index=(position+media.length)%media.length;
      const item=media[index];
      counter.textContent=`${index+1} / ${media.length}`;
      description.textContent=item.description;
      stage.replaceChildren(element('p',item.type==='video'?'Loading video…':'Loading photo…','help'));
      try{
        let url=item.src||cachedURLs.get(item.path);
        if(!url){
          const blob=await api.communityAsset(item.path);
          if(!active||request!==sequence)return;
          url=URL.createObjectURL(blob);
          cachedURLs.set(item.path,url);
        }
        if(!active||request!==sequence)return;
        if(item.type==='video'){
          video=element('video');
          video.controls=true;
          video.playsInline=true;
          video.muted=true;
          video.setAttribute('aria-label',item.description||'Video from this post');
          video.addEventListener('ended',()=>{if(active&&request===sequence&&playing&&media.length>1)show(index+1);});
          video.addEventListener('error',()=>unavailable(request));
          video.src=url;
          stage.replaceChildren(video);
          if(playing&&!document.hidden)void video.play().catch(()=>{});
        }else{
          const image=element('img');
          image.alt=item.description||'Photo from this post';
          image.addEventListener('load',()=>{if(active&&request===sequence)schedule();},{once:true});
          image.addEventListener('error',()=>unavailable(request));
          image.src=url;
          stage.replaceChildren(image);
        }
      }catch{
        unavailable(request);
      }
    }
    function unavailable(request){
      if(!active||request!==sequence)return;
      stage.replaceChildren(element('p','This item could not load.','help'));
      schedule();
    }

    function arrows(event){
      if(event.target.tagName==='VIDEO'||media.length<2)return;
      if(event.key==='ArrowLeft'||event.key==='ArrowRight'){
        event.preventDefault();
        show(index+(event.key==='ArrowLeft'?-1:1));
      }
    }
    dialogElement.addEventListener('keydown',arrows);
    document.addEventListener('visibilitychange',onVisibility);
    dialogElement.addEventListener('close',()=>{
      active=false;
      clearTimeout(timer);
      video?.pause();
      dialogElement.removeEventListener('keydown',arrows);
      document.removeEventListener('visibilitychange',onVisibility);
      for(const url of cachedURLs.values())URL.revokeObjectURL(url);
    },{once:true});
    void show(0);
  });
}

function openComposer({api,authorId,authorName,dialog,closeDialog,run,reload,status}){
  dialog('Create a community post',body=>{
    const form=element('form');
    const name=field(form,'Name shown on this post','communityAuthor');
    name.required=true;
    name.maxLength=80;
    name.value=authorName||'';
    const files=field(form,'Photos and videos','communityFiles');
    files.type='file';
    files.accept=Object.keys(extensions).join(',');
    files.multiple=true;
    files.required=true;
    const hint=element('p','Choose up to five JPG, PNG, WebP, MP4, or WebM files. Each can be up to 6 MB. They’ll appear in the order selected.','help');
    hint.id='communityMediaHint';
    files.setAttribute('aria-describedby',hint.id);
    const descriptions=element('div',undefined,'community-descriptions');
    form.append(hint,descriptions);
    const caption=field(form,'Tell the story behind this post','communityCaption','textarea');
    caption.required=true;
    caption.maxLength=1200;
    caption.placeholder='What happened, who helped, and what did you take away from it?';
    form.append(element('p','Everyone signed in to Forward can see this post. Share only media you have permission to post.','notice'));
    const submit=element('button','Publish post','button primary');
    submit.type='submit';
    const progress=element('p',undefined,'help');
    progress.setAttribute('role','status');
    form.append(submit,progress);
    body.append(form);
    files.addEventListener('change',()=>{
      descriptions.replaceChildren();
      for(const [index,file] of Array.from(files.files).slice(0,5).entries()){
        const input=field(descriptions,`Describe ${file.name} (optional)`,'community-description-'+index);
        input.maxLength=200;
      }
    });

    form.addEventListener('submit',event=>{
      event.preventDefault();
      run(submit,async()=>{
        const selected=Array.from(files.files);
        if(!name.value.trim()||!caption.value.trim())throw new Error('Enter a display name and a caption.');
        if(!selected.length||selected.length>5)throw new Error('Choose between one and five photos or videos.');
        if(selected.some(file=>!extensions[file.type]||!file.size||file.size>maxFileSize)){
          throw new Error('Use JPG, PNG, WebP, MP4, or WebM files up to 6 MB each.');
        }
        const post={
          id:crypto.randomUUID(),author_name:name.value.trim(),caption:caption.value.trim(),
          extensions:selected.map(file=>extensions[file.type]),
          descriptions:Array.from(descriptions.querySelectorAll('input'),input=>input.value.trim())
        };
        const media=postMedia({...post,author_id:authorId});
        try{
          await api.addCommunityDraft(post);
          for(const [index,file] of selected.entries()){
            progress.textContent=`Uploading ${index+1} of ${selected.length}…`;
            await api.uploadCommunityAsset(media[index].path,file);
          }
          progress.textContent='Publishing your post…';
          await api.publishCommunityDraft(post.id);
        }catch(error){
          const saved=await api.communityPost(post.id).catch(()=>null);
          if(!saved?.published_at){
            const removed=await api.discardCommunityPost(post.id,true).catch(()=>null);
            if(removed)await api.removeCommunityAssets(media.map(item=>item.path)).catch(()=>{});
            throw error;
          }
        }finally{
          progress.textContent='';
        }
        closeDialog();
        await reload();
        status('Your community post is published.');
      });
    });
  });
}

export function mountCommunity({host,api,authorId,authorName,dialog,dialogElement,closeDialog,run,status}){
  const actions=element('div',undefined,'actions community-actions');
  const feedStatus=element('p',undefined,'help');
  feedStatus.setAttribute('role','status');
  const feed=element('div',undefined,'community-feed');
  const drafts=element('div');
  const thumbnailURLs=new Set();
  let active=true;
  let renderVersion=0;
  let mineOnly=false;
  const observer=new IntersectionObserver(entries=>{
    for(const entry of entries){
      if(!entry.isIntersecting)continue;
      observer.unobserve(entry.target);
      void thumbnails.get(entry.target)?.();
    }
  },{rootMargin:'180px'});
  const thumbnails=new WeakMap();
  const context={api,authorId,authorName,dialog,dialogElement,closeDialog,run,reload,status};
  const mine=button('My posts',()=>{
    mineOnly=!mineOnly;
    mine.setAttribute('aria-pressed',String(mineOnly));
    void reload();
  });
  mine.setAttribute('aria-pressed','false');
  actions.append(button('Create a post',()=>openComposer(context),'primary'),mine,button('Refresh feed',()=>void reload()));
  host.replaceChildren(actions,feedStatus,drafts,feed);

  function deletePost(post){
    dialog(post.published_at?'Remove this community post?':'Discard this incomplete upload?',body=>{
      body.append(element('p',post.published_at?'The post will be removed from the community feed.':'This upload is visible only to you.'));
      const confirm=button('Remove post',()=>run(confirm,async()=>{
        const removed=await api.discardCommunityPost(post.id);
        if(!removed)throw new Error('This post is no longer available.');
        const paths=postMedia(post).map(item=>item.path);
        const mediaRemoved=await api.removeCommunityAssets(paths).then(()=>true,()=>false);
        closeDialog();
        await reload();
        status(mediaRemoved?'Post removed.':'Post removed from the feed. The files are still private.');
      }),'danger');
      body.append(confirm);
    });
  }

  function renderPost(post,version){
    const card=element('article',undefined,'panel community-post');
    const byline=element('header',undefined,'community-byline');
    byline.append(element('h2',post.author_name));
    if(post.example){
      byline.append(element('p',post.byline,'card-meta'),element('strong','FICTIONAL EXAMPLE','fake-label'));
    }else{
      const time=element('time',new Date(post.published_at).toLocaleDateString(),'help');
      time.dateTime=post.published_at;
      byline.append(time);
    }
    const media=postMedia(post);
    const first=media[0];
    const cover=button('',()=>openGallery({...context,post}),'community-cover');
    cover.setAttribute('aria-label','Open post by '+post.author_name);
    const visual=element('span',first.type==='video'?'Video':'Photo','community-cover-placeholder');
    cover.append(visual,element('span',media.length===1?'Open post':`View ${media.length} items`,'community-cover-label'));
    if(first.type==='photo'){
      const showThumbnail=async()=>{
        try{
          let url=first.src;
          if(!url){
            const blob=await api.communityAsset(first.path);
            if(!active||version!==renderVersion)return;
            url=URL.createObjectURL(blob);
            thumbnailURLs.add(url);
          }
          if(!active||version!==renderVersion)return;
          const image=element('img');
          image.alt=first.description;
          image.src=url;
          visual.replaceChildren(image);
        }catch{/* The cover still opens the gallery. */}
      };
      thumbnails.set(cover,showThumbnail);
      observer.observe(cover);
    }
    card.append(byline,cover,element('p',post.caption,'profile-text community-caption'));
    if(post.author_id===authorId)card.append(button('Remove post',()=>deletePost(post)));
    return card;
  }

  async function reload(){
    const version=++renderVersion;
    feedStatus.textContent='Loading community posts…';
    let posts=[];
    let incomplete=[];
    try{
      [posts,incomplete]=await Promise.all([api.listCommunityPosts(mineOnly?authorId:undefined),api.communityDrafts()]);
      if(!active||version!==renderVersion)return;
      feedStatus.textContent='';
    }catch{
      if(!active||version!==renderVersion)return;
      feedStatus.textContent='Community posts couldn’t load. Try Refresh feed.';
    }
    observer.disconnect();
    for(const url of thumbnailURLs)URL.revokeObjectURL(url);
    thumbnailURLs.clear();
    drafts.replaceChildren();
    if(incomplete.length){
      const section=element('details',undefined,'panel');
      section.append(element('summary','Incomplete uploads'));
      for(const post of incomplete){
        section.append(element('p',post.caption,'profile-text'),button('Discard upload',()=>deletePost(post)));
      }
      drafts.append(section);
    }
    const visiblePosts=mineOnly?posts:posts.concat(examplePosts());
    feed.replaceChildren(...visiblePosts.map(post=>renderPost(post,version)));
    if(!visiblePosts.length&&!feedStatus.textContent)feedStatus.textContent='You haven’t published a community post yet.';
  }
  void reload();
  return ()=>{
    active=false;
    observer.disconnect();
    for(const url of thumbnailURLs)URL.revokeObjectURL(url);
  };
}
