export const topics=[
  ['Fix résumé autofill', /r[eé]sum[eé]|upload|pdf|scan|autofill/i,
    'In My profile, choose your file under Upload and autofill from your résumé. A PDF with selectable text fills the fields Forward can read. Watch for progress beside the file picker. If a review opens, choose Save and open my profile. If the PDF is already saved, try Fill again from saved PDF. For a scan, paste the résumé text in the second profile step.'],
  ['Write my introduction', /intro|bio|headline|about me|summary|profile wording/i,
    'Try two sentences: “I help [people or team] do [type of work]. In my last [role or project], I [action] so [what changed].” Use one example you can explain in a conversation. Add a number only if you can verify it.'],
  ['Describe my impact', /job history|past job|impact|accomplish|achievement|experience|bullet|featured/i,
    'Start with what you did, then describe the result. For example: “I reorganized the volunteer sign-up process so new volunteers could choose a shift without emailing the coordinator.” If you have a reliable measure, include it.'],
  ['Write a hiring profile', /hiring profile|team profile|job listing|job description|team culture/i,
    'Explain what the person will do, who they’ll work with, and what support they’ll receive. Try: “In your first month, you’ll [task] with [team]. We’ll support you through [specific practice].” Use My hiring profile → Review & publish to preview the listing.'],
  ['Fix sign-in or email', /sign.?in|log.?in|password|confirmation|verify|email/i,
    'If you’ve already confirmed your email, choose Sign in. If you forgot your password, enter your account email and choose Forgot your password? Open the latest Forward password reset link email. If the button is hidden, copy the full address beneath it. For a new account, use Resend confirmation email.'],
  ['Share my profile', /share|download|publish|private|visibility/i,
    'Applicants save a sharing version under Review & share, then open a manager in Discover teams and choose Share my profile & résumé. The selected manager can preview the profile and download the attached résumé. Hiring managers publish their own profile under Review & publish.'],
  ['Understand matches and messages', /match|chat|message|pass|swipe/i,
    'A private conversation appears under Messages after the hiring manager chooses Interested and the applicant chooses I’m open to chat. A manager can revisit passed profiles. Work preferences help you start a conversation.'],
  ['Use work preferences', /preference|collaborat|introvert|focus|check.in/i,
    'Answer based on what helps you do your best work. If your preferences differ, try asking: “Which updates should we write down, and when would a quick conversation work better?”'],
  ['Add profile photos', /photo|picture|project image|team image/i,
    'Applicants can add a profile picture and project image under About you. Hiring managers can add a profile picture and team image under Manager & role. Save the private draft, then review your sharing or publication step.']
];

export function guidedReply(question,role){
  const exact=topics.find(([title])=>title.toLowerCase()===question.toLowerCase());
  const match=exact||topics.find(([,pattern])=>pattern.test(question));
  if(match)return match[2];
  if(/profile|what.*say|help.*writ/i.test(question))return topics[role==='hiring'?3:1][2];
  return 'I have guides for résumé uploads, sign-in, writing a profile, sharing, work preferences, and messages. Choose a topic below, or ask about one of those areas.';
}
