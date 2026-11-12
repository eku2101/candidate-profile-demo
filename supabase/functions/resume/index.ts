import {createClient} from 'npm:@supabase/supabase-js@2.119.0';
import {createResumeHandler} from './handler.mjs';
const url=Deno.env.get('SUPABASE_URL')!;
const anonKey=Deno.env.get('SUPABASE_ANON_KEY')!;
const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const options={auth:{persistSession:false,autoRefreshToken:false}};
Deno.serve(createResumeHandler({
  allowedOrigin:Deno.env.get('FORWARD_ORIGIN') || 'https://eku2101.github.io',
  admin:createClient(url,serviceKey,options),
  createUserClient:(authorization:string)=>createClient(url,anonKey,{...options,global:{headers:{Authorization:authorization}}})
}));
