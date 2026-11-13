import {createClient} from 'npm:@supabase/supabase-js@2.119.0';
import {createJobsHandler} from './handler.mjs';

const url=Deno.env.get('SUPABASE_URL')!;
const options={auth:{persistSession:false,autoRefreshToken:false}};
const publicClient=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,options);
const service=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,options);

Deno.serve(createJobsHandler({
  origin:Deno.env.get('FORWARD_ORIGIN')||'https://eku2101.github.io',
  appId:Deno.env.get('ADZUNA_APP_ID'),
  appKey:Deno.env.get('ADZUNA_APP_KEY'),
  async identify(token:string){
    const {data,error}=await publicClient.auth.getUser(token);
    return error||!data.user?.email_confirmed_at?null:data.user.id;
  },
  async takeRequest(id:string){
    const {error}=await service.rpc('forward_take_job_request',{p_user_id:id});
    if(error&&error.code!=='PT429')throw new Error('Job quota unavailable');
    return !error;
  }
}));
