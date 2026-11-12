import {accountConfig} from './config.js?v=public-signup-1';
import {configReady} from './model.mjs';

function accountLink(id,label,href,style){
  const link=document.createElement('a');
  link.id=id;
  link.href=href;
  link.className=`button ${style}`;
  link.textContent=label;
  return link;
}

export function addAccountEntry(){
  if(!configReady(accountConfig)||accountConfig.showAccountEntry===false)return;
  const signupURL='accounts.html?mode=signup';
  const demoChoices=document.getElementById('homeRoleChoices');
  if(demoChoices&&!document.getElementById('openForwardAccount')){
    const actions=document.createElement('div');
    actions.className='home-role-choices';
    actions.append(
      accountLink('openForwardAccount','Create account →',signupURL,'primary'),
      accountLink('signInForwardAccount','Sign in','accounts.html','secondary')
    );
    const note=document.createElement('p');
    note.className='help';
    note.textContent='Save your profile across devices. The role buttons below open the browser-only class demo.';
    demoChoices.before(actions,note);
  }
  const explore=document.getElementById('welcomeContinue');
  if(explore&&!document.getElementById('welcomeCreateAccount')){
    explore.before(accountLink('welcomeCreateAccount','Create account →',signupURL,'primary'));
  }
}
