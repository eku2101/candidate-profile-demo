import {guidedReply,topics} from './help-guide.mjs?v=help-chat-1';

export function installHelpChat(getContext){
  const dialog=document.getElementById('forwardHelp');
  const form=document.getElementById('forwardHelpForm');
  const input=document.getElementById('forwardHelpQuestion');
  const log=document.getElementById('forwardHelpLog');
  const status=document.getElementById('forwardHelpStatus');
  const send=form.querySelector('button');
  const suggestions=document.getElementById('forwardHelpTopics');
  let history=[];
  let pending=false;

  function addMessage(speaker,body){
    const item=document.createElement('div');
    item.className='help-message '+(speaker==='You'?'help-message-user':'');
    const name=document.createElement('strong');
    name.textContent=speaker;
    const text=document.createElement('p');
    text.textContent=body;
    item.append(name,text);
    log.append(item);
    log.scrollTop=log.scrollHeight;
  }

  async function ask(value){
    const question=value.trim();
    if(!question||pending||question.length>1000)return;
    const {client,role}=getContext();
    input.value='';
    pending=true;
    send.disabled=true;
    addMessage('You',question);
    status.textContent='Finding help…';
    try{
      let answer;
      if(role&&client){
        const response=await client.functions.invoke('forward-help',{body:{question,history:history.slice(-4)}});
        answer=response.error?null:response.data?.answer;
      }
      if(typeof answer==='string'&&answer.trim()){
        addMessage('Forward AI',answer);
        history=[...history,{role:'user',content:question},{role:'assistant',content:answer.slice(0,1500)}].slice(-4);
      }else{
        addMessage('Forward help guide',guidedReply(question,role));
      }
    }catch{
      addMessage('Forward help guide',guidedReply(question,role));
    }finally{
      status.textContent='';
      pending=false;
      send.disabled=false;
      if(dialog.open)input.focus();
    }
  }

  for(const [title] of topics){
    const suggestion=document.createElement('button');
    suggestion.type='button';
    suggestion.className='button secondary';
    suggestion.textContent=title;
    suggestion.addEventListener('click',()=>ask(title));
    suggestions.append(suggestion);
  }
  form.addEventListener('submit',event=>{event.preventDefault();ask(input.value);});
  document.getElementById('openForwardHelp').addEventListener('click',()=>{
    if(!log.children.length)addMessage('Forward help','Ask how to use Forward, or get a starting point for your profile.');
    dialog.showModal();
  });
}
