import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHelpHandler} from '../../supabase/functions/forward-help/handler.mjs';
import {guidedReply} from '../help-guide.mjs';

const origin='https://forward.example';
const request=(question,headers={})=>new Request(origin+'/help',{
  method:'POST',body:JSON.stringify({question}),
  headers:{origin,authorization:'Bearer test-session',...headers}
});

test('help returns guidance without an AI key or a signed-in browser',async()=>{
  const handler=createHelpHandler({origin,identify(){throw new Error('Unexpected call');}});
  assert.deepEqual(await (await handler(request('My PDF will not upload'))).json(),{answer:null});
  assert.match(guidedReply('My PDF will not upload'),/Fill again from saved PDF/);
  assert.match(guidedReply('What should I say in my profile?','hiring'),/first month/);
});

test('only authenticated callers within quota can send a bounded prompt to AI',async()=>{
  let calls=0;
  let allowed=false;
  const handler=createHelpHandler({
    origin,key:'test-key',model:'test-model',
    identify:async token=>token==='Bearer test-session'?{id:'account-id',role:'applicant'}:null,
    takeRequest:async()=>allowed,
    requestModel:async(_url,options)=>{
      calls++;
      const payload=JSON.parse(options.body);
      assert.equal(payload.store,false);
      assert.deepEqual(payload.input,[{role:'user',content:'How do I write a bio?'}]);
      assert.equal(JSON.stringify(payload).includes('account-id'),false);
      return Response.json({output:[{type:'message',content:[{type:'output_text',text:'Start with the work you do.'}]}]});
    }
  });
  assert.equal((await handler(request('Hi',{origin:'https://another.example'}))).status,403);
  assert.equal((await handler(request('Hi',{authorization:'Bearer wrong'}))).status,401);
  assert.equal((await handler(request('x'.repeat(1001)))).status,400);
  assert.equal((await handler(request('Hi'))).status,429);
  assert.equal(calls,0);
  allowed=true;
  assert.deepEqual(await (await handler(request('How do I write a bio?'))).json(),{answer:'Start with the work you do.'});
  assert.equal(calls,1);
});
