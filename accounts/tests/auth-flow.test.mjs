import test from 'node:test';
import assert from 'node:assert/strict';
import {validateAuthInput,submitAuthentication} from '../auth-flow.mjs';

const signup={mode:'signup',email:'tester@example.invalid',password:'fictional-test-password',returnURL:'https://eku2101.github.io/candidate-profile-demo/accounts.html'};

test('a short signup password explains why no request was sent',async()=>{
  let calls=0;const auth={signUp(){calls++;}};
  const input={...signup,password:'short'};
  assert.equal(validateAuthInput(input).field,'authPassword');
  await assert.rejects(submitAuthentication(auth,input),/signup has not been submitted/);
  assert.equal(calls,0);
});
test('missing or invalid email and empty passwords stop before contacting Auth',async()=>{
  for(const changes of [{email:''},{email:'not-an-email'},{password:''}]){
    let calls=0;await assert.rejects(submitAuthentication({signUp(){calls++;}},{...signup,...changes}));assert.equal(calls,0);
  }
});
test('successful signup advances to confirmation rather than an unauthenticated profile',async()=>{
  let request;const result=await submitAuthentication({async signUp(value){request=value;return {data:{user:{id:'test-user'},session:null},error:null};}},signup);
  assert.deepEqual(result,{kind:'confirmation',email:signup.email});
  assert.equal(request.options.emailRedirectTo,signup.returnURL);
});
test('SMTP failure stays an error and never reports that confirmation was sent',async()=>{
  await assert.rejects(submitAuthentication({async signUp(){return {data:{},error:{status:500,message:'Error sending confirmation email'}};}},signup),/could not send the confirmation email/);
});
test('network failures produce an actionable message',async()=>{
  await assert.rejects(submitAuthentication({async signUp(){throw new TypeError('Failed to fetch');}},signup),/Check your connection/);
});
test('unconfirmed sign-in and rate limits explain the next step',async()=>{
  for(const [error,message] of [[{code:'email_not_confirmed',message:'Email not confirmed'},/Confirm your email/],[{status:429,message:'Rate limit exceeded'},/Please wait/]]){
    await assert.rejects(submitAuthentication({async signInWithPassword(){return {error};}},{...signup,mode:'signin'}),message);
  }
});
test('sign-in accepts an existing password and requires an actual session',async()=>{
  const session={user:{id:'test-user'}};
  const result=await submitAuthentication({async signInWithPassword(){return {data:{session},error:null};}},{...signup,mode:'signin',password:'existing'});
  assert.deepEqual(result,{kind:'signedIn',session});
  await assert.rejects(submitAuthentication({async signInWithPassword(){return {data:{session:null},error:null};}},{...signup,mode:'signin'}),/Sign-in did not finish/);
});
