import {accountConfig} from './config.js';
import {configReady} from './model.mjs';
export function addAccountEntry(){
  if(!configReady(accountConfig)||accountConfig.showAccountEntry===false)return;
  const host=document.querySelector('.home-feature-copy');if(!host||document.getElementById('openForwardAccount'))return;
  const link=document.createElement('a');link.id='openForwardAccount';link.href='accounts.html';link.className='button primary';link.textContent='Sign in / Create account →';
  const note=document.createElement('p');note.className='help';note.textContent='Save across devices and share with the hiring managers you choose. The buttons below open the browser-only class demo.';
  host.insertBefore(link,document.getElementById('homeRoleChoices'));host.insertBefore(note,document.getElementById('homeRoleChoices'));
}
