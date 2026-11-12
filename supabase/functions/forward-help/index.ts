import {createClient} from 'npm:@supabase/supabase-js@2.119.0';
import {createHelpHandler} from './handler.mjs';

const url=Deno.env.get('SUPABASE_URL')!;
const options={auth:{persistSession:false,autoRefreshToken:false}};
const service=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,options);

Deno.serve(createHelpHandler({
  origin:Deno.env.get('FORWARD_ORIGIN')||'https://eku2101.github.io',
  key:Deno.env.get('FORWARD_OPENAI_API_KEY'),
  model:Deno.env.get('FORWARD_OPENAI_MODEL')||'gpt-5.6-terra',
  async identify(authorization:string){
    const client=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,{...options,global:{headers:{Authorization:authorization}}});
    const {data,error}=await client.auth.getUser(authorization.slice(7));
    if(error||!data.user?.email_confirmed_at)return null;
    const account=await client.from('forward_accounts').select('role').eq('user_id',data.user.id).maybeSingle();
    const role=account.data?.role;
    return ['applicant','hiring'].includes(role)?{id:data.user.id,role}:null;
  },
  async takeRequest(id:string){
    const {error}=await service.rpc('forward_take_help_request',{p_user_id:id});
    return !error;
  }
}));
