export function newPasswordError(password) {
  if([...password].length<12)return 'Use at least 12 characters for your new password.';
  if(new TextEncoder().encode(password).length>72)return 'Choose a shorter password. The limit is 72 bytes, and some characters use more than one byte.';
  return null;
}

export function validateAuthInput({mode,email,password}) {
  if(!email.trim())return {field:'authEmail',message:'Enter your email address.'};
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))return {field:'authEmail',message:'Enter a complete email address, such as name@example.com.'};
  if(!password)return {field:'authPassword',message:'Enter your password.'};
  const issue=mode==='signup'?newPasswordError(password):null;
  if(issue)return {field:'authPassword',message:`${issue} Your signup has not been submitted yet.`};
  if(password.length>128)return {field:'authPassword',message:'Keep your password to 128 characters or fewer.'};
  return null;
}

export function authErrorMessage(error) {
  const message=error?.message||'';
  if(error?.status===429||/rate limit|too many requests/i.test(message))return 'Please wait a little before trying again. If you already requested an email, check your inbox and spam folder.';
  if(error?.code==='email_not_confirmed'||/email not confirmed/i.test(message))return 'Confirm your email before signing in. Check your inbox and spam folder, or choose Resend confirmation email below.';
  if(/error sending|smtp|mail delivery/i.test(message))return 'Forward could not send the confirmation email. Please try again later while we check the email service.';
  if(/failed to fetch|network|load failed/i.test(message))return 'Forward could not reach the account service. Check your connection and try again.';
  return message||'That request could not finish. Please try again.';
}

export async function submitAuthentication(auth,{mode,email,password,returnURL}) {
  const issue=validateAuthInput({mode,email,password});
  if(issue)throw Object.assign(new Error(issue.message),{field:issue.field});
  let result;
  try {
    result=mode==='signup'
      ?await auth.signUp({email:email.trim(),password,options:{emailRedirectTo:returnURL}})
      :await auth.signInWithPassword({email:email.trim(),password});
  }catch(error){throw new Error(authErrorMessage(error),{cause:error});}
  if(result.error)throw new Error(authErrorMessage(result.error),{cause:result.error});
  if(result.data?.session)return {kind:'signedIn',session:result.data.session};
  if(mode==='signup')return {kind:'confirmation',email:email.trim()};
  throw new Error('Sign-in did not finish. Please try again.');
}
