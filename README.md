# Forward — Talent Connections Demo

[Visit the live Forward website](https://eku2101.github.io/candidate-profile-demo/)

Forward is a browser-only prototype for two audiences: applicants building a fuller professional story and hiring teams exploring people to meet. The opening experience introduces that purpose, then a shared navigation bar organizes Home, Discover, Connections, Messages, and Profile. Each audience has its own workspace and work-preference questions.

## Included interactions

- **Opening experience on every visit:** a ten-second Forward introduction plays each time the page opens or refreshes. Visitors can pause, resume, skip, or replay it; reduced-motion preferences are respected. An interactive welcome follows, with examples of skills, growth, working habits, and contributions. Its close button appears after five seconds, without a visible countdown.
- **Clear navigation:** Home introduces the next step; Discover shows applicant cards to employers and clearly labeled sample teams to applicants. Connections and Messages have dedicated pages. The navigation moves to the bottom on small screens.
- **Guided profile builder:** five steps organize About you, Your top three, Values & teamwork, Work preferences, and Review & launch. Applicants can write before completing preferences; preferences are required when launching. Quiet focus, brainstorming, communication, check-ins, workload, and environment are independent choices with flexible options. Selected answers stay out of public profiles.
- **Résumé import:** choose **Upload document** and select a text-based PDF. The browser reads its pages and opens an editable review of name, role, location, email, phone, skills, introduction, previous jobs, education, and certifications/achievements. Select **Save résumé to my profile** to apply the nonempty reviewed fields and save the original document. Empty fields leave existing details unchanged; mission and culture stories are never invented from the résumé.
- **Saved applicant profile:** form edits save automatically in IndexedDB, with an explicit **Save profile in this browser** action and a visible saved/error status. Profile fields, three selected highlights, the original résumé, profile photo, work preferences, and launch state survive refresh and reopening in the same browser. Older saved profiles remain readable; they start with no selected highlights. One applicant profile is stored per browser; **Clear saved profile** removes it after confirmation. Clearing site data also removes it. There are no accounts or cross-device synchronization.
- **Three featured experiences, complete work history:** applicants choose up to three meaningful roles, including work that helped a team, customers, sales, or a community. Editable suggestions come from their imported work history; the app never chooses the “best” roles automatically. One or two highlights are welcome. All previous jobs remain saved and can be expanded in the profile.
- **Read the full résumé:** employers see an invitation to review the complete document, plus View and Download links for the applicant's original uploaded PDF. Links are available in the same-browser hiring demo, including the full-story and feedback views. Sample applicants without an attached file never inherit another person's résumé. **Review my uploaded profile** makes testing both sides easier.
- **Writing guidance:** introduction and each role highlight allow 100 words; mission and values allow 50 each; team care, colleague support, and culture/community allow 75 each. Headlines allow 80 characters and the skill list allows ten comma-separated skills. Counters show remaining limits. Over-limit drafts still save, but must be shortened before launch. Full work history and the original PDF are not shortened by these limits.
- **Applicant workspace:** **Build profile** edits the imported details and public story. Previous jobs, education, and credentials appear in the live preview, launched hub, hiring card, and full story. Email and phone stay in the private editor. Own JPG/PNG/WebP photos are supported; uploaded images are attachments and do not autofill text. The builder starts blank instead of preloading a fictional applicant.
- **Launch and applicant presence:** a draft stays out of the hiring pipeline until the applicant selects **Launch profile**. Launch opens an applicant-only activity hub with local manager activity, a feedback channel, and a separate Community & Projects page for project stories, images, PDF attachments, and awards.
- **Mission and culture profile:** candidates can publicly share why they do their work, their professional values, how they support team well-being and colleagues, and a community contribution they are proud of. These people-centered story sections appear in the live preview, swipe card, and full public profile.
- **Strong example profile:** the Alex Santos reference can be expanded in Review & launch. It is a structural guide, not a competitive ranking, and does not crowd the editing steps.
- **Hiring private intake:** before accessing the pipeline, managers and recruiters describe their team's actual focus time, brainstorming, communication, and check-in habits, plus the role's experience level, workload rhythm, and environment. These are working conditions rather than personality labels.
- **Conversation prompts:** differences in focus time, brainstorming, communication, check-ins, workload, or environment produce optional questions for applicants and employers, each with a practical next step. Questions are tailored to each side and do not quote the other person's selected answers. Suggested topics can indicate where preferences differ, as explained in both intake forms.
- **Review order:** experience level alone determines the sample pipeline order. Work preferences never lower a candidate's position or exclude anyone. Compatibility percentages have been replaced by clearly labeled experience context. Applicant-built profiles retain the existing mid-level demo baseline, labeled in the hiring view.
- **Applicant preparation:** applicants can expand **Prepare for a conversation about how you work** in the builder, or see prompts in their launched profile hub. Before a hiring brief is entered, the prompts explicitly use a sample team for practice. After a brief is entered in this browser session, they use that local team's preferences.
- **Hiring workspace:** review sample applicants with **Not now**, **Connect**, or a horizontal swipe. The card brings selected experience, résumé access, mission, values, team care, colleague support, and culture/community together. Connect creates a local interested connection; Not now opens structured feedback.
- **In-app chat simulation:** an interested applicant receives a Chat button. The drawer stores messages in browser memory and includes a sender selector so either side of the conversation can be demonstrated.

## Collaboration and iterative design

### Fixing résumé import and saving

Testing revealed that the earlier upload only displayed a PDF and that the profile disappeared on refresh. It did not extract jobs, qualifications, or other résumé information. The revised flow reads PDF text locally using self-hosted [PDF.js](https://mozilla.github.io/pdf.js/), presents an editable review, and saves the confirmed profile and file in this browser. The profile now has dedicated work-history, education, and credentials fields, so those details are available throughout the applicant and hiring views.

PDF layouts vary, so users should check names, jobs, dates, and section boundaries before saving. The importer preserves all extracted text for reference and supports ordinary multi-page and common two-column layouts. Scanned/image-only PDFs need a text-based export or the **Paste résumé text** fallback; there is no OCR. Password-protected PDFs need an unlocked copy. Files are limited to 10 MB and 40 pages. Failed or cancelled imports leave the saved profile unchanged. A different detected name prompts a reminder to clear the old profile if the résumé belongs to someone else.

### Applying instructor feedback: working habits, not personality labels

My professor pointed out that being introverted does not mean someone dislikes collaboration, and being extroverted does not mean someone dislikes independent focus. In response, I replaced the single introvert/extrovert work-style question with four independent questions about quiet focus time, group brainstorming, written or live communication, and check-in frequency. Someone can now ask for uninterrupted focus blocks and frequent brainstorming without choosing between those needs. The hiring brief asks parallel questions about how the team actually works, and both sides can choose flexible preferences.

The next design decision was that different preferences should start a conversation rather than reduce someone's chances. All six work-preference categories now generate discussion topics independently of ranking. For example, a difference in communication preferences suggests discussing which updates work best in writing and when a live conversation is useful. Each topic includes a possible working agreement, such as written decision summaries or a check-in rhythm that both sides revisit after two weeks. Equal or flexible answers are not labeled as differences; when no specific topics surface, the app offers a general question about a good first week.

Regression checks cover tailored prompts for both audiences, equal and flexible answers, changes to saved preferences, and the invariant that preferences cannot change review order or remove an applicant. The profile, upload, interest, and feedback flows remain part of the prototype. Discussion prompts are optional preparation; the app never sends them automatically.

Forward was shaped through an ongoing design-and-build conversation rather than a one-time handoff. The starting vision was a career platform that could support applicants, recruiters, and hiring managers while making people feel more visible than a traditional résumé allows. From there, the work followed a practical loop: identify what felt confusing or incomplete in the live prototype, refine the workflow, test the result in the browser, and keep the strongest ideas.

The collaboration kept the concept focused on a simple promise: a person should be able to tell a fuller story about their work, while a hiring team should have a clearer and more respectful way to decide whom to meet. The result is intentionally more human than a typical job board. It puts mission, values, team care, colleague support, community contribution, and project work beside skills and experience instead of treating them as afterthoughts.

The project was also built around rapid, visible feedback. Each major request became a concrete interaction in the prototype: separate role experiences, better profile-building options, a clearer connection flow, an applicant launch moment, community posts, and a cinematic introduction. The site uses static HTML, CSS, and JavaScript, with separate résumé-import and storage helpers and a self-hosted PDF library. It can be demonstrated and revised without a server application or build step.

The early iterations also improved the small details that make a demo feel usable. For example, the candidate-review controls were refined so the left/right decision model works through both visible arrow buttons and swipe gestures. Resume previews, file-type checks, image/PDF handling, and removable profile media were added as the profile workflow became more realistic. These changes came from treating the prototype as something to test and improve, not just something to describe.

### How we worked

- **Started with the audience:** The applicant, recruiter, and hiring-manager journeys were defined first so the product did not feel like one crowded dashboard trying to serve everyone at once.
- **Used live review to guide changes:** Design feedback was applied directly to the working browser preview. This made it easy to see whether a new feature improved the story, navigation, and sense of trust before it was kept.
- **Built in small, testable layers:** The workflow grew from profile upload and review into role-specific intake, live profile building, matching, feedback, messaging, profile launch, and community sharing without adding a framework or external dependency.
- **Protected the human side of the concept:** Selected work-style answers remain separate from the public profile. Differences generate respectful conversation prompts, with no ranking penalty or automatic exclusion. The demo does not send real email, collect real visitor data, or contact real people.
- **Saved the work as it progressed:** Changes were versioned in Git and published through GitHub Pages so the evolving product could be reviewed as a live site as well as a local demo.

## What went well

### The product became clearer for each audience

One of the most important improvements was separating the applicant workspace from the hiring pipeline. On entry, people choose whether they are joining as an applicant or a hiring team. Applicants see a focused profile builder and live preview; recruiters and managers see ranked profile cards and review tools. This reduced the visual confusion of mixing creation and evaluation on the same screen and made each journey feel intentional.

### The profile moved beyond a résumé

The applicant experience supports both résumé import and writing from scratch inside a guided builder. People can add a résumé, portfolio PDF, or their own image, then build a profile with a headline, location, skills, introduction, selected experience, values, mission, culture footprint, colleague support, and community impact. The optional Alex Santos example shows the shape of a strong profile without asking applicants to copy someone else's identity.

### Matching is more transparent and respectful

Applicants complete work-preference questions before launching their profile; hiring teams complete their role brief before reviewing applicants. Those inputs suggest concrete conversations about working together, while selected answers stay off public profiles. The hiring view uses experience alone for review order and shows questions for the employer; the applicant's builder and hub offer questions from the applicant's perspective. Preferences do not produce a suitability score or automatic rejection.

### Interaction feels more active and personal

The recruiter or manager can use left and right arrows, or swipe, to review applicants. A right action creates an interested connection, while a left action captures structured feedback about fit. Once a connection is made, the demo enables a lightweight chat drawer. Applicants also have a launch action that changes their profile from a draft into a visible part of the local matching experience, then opens their activity and feedback hub.

### The visual direction supports the idea

The soft lavender background, white cards, charcoal type, purple actions, and consistent spacing give Forward a clearer visual identity. Persistent navigation and a five-step editor reduce competing controls. The cinematic **Forward** opener and interactive welcome introduce the mission before the workspace appears.

## Major modifications and why they improved the site

| Earlier experience | Modification | Why it improved Forward |
| --- | --- | --- |
| Applicants and hiring teams saw overlapping content. | Added a startup role picker and role-specific workspaces. | Each audience gets a focused path and a clearer purpose. |
| A candidate could mainly drop in a document. | Added **Upload document** and **Build profile** paths with a live preview. | Applicants can choose between a familiar résumé/portfolio workflow and a more expressive web profile. |
| Uploading a résumé only showed the file, and profile details disappeared on refresh. | Added local PDF text extraction, editable import review, work-history and education fields, and persistent browser storage. | Applicants can turn their résumé into a profile and return to their saved information later. |
| Profiles emphasized title, skills, and background only. | Added mission, values, team care, colleague support, and community impact sections. | Hiring conversations can begin with values, contributions, and collaboration—not only credentials. |
| No clear way to show personal presentation. | Added support for applicant-owned image, JPG, PNG, WebP, and PDF uploads; images become the live profile picture and PDFs become supporting documents. | The profile feels more personal while avoiding a bank of fake stock identities. |
| Matching felt like a static card. | Added applicant and hiring-team intake flows; later replaced preference-based percentages with discussion prompts. | Differences can lead to practical working agreements without lowering anyone's review position. |
| One work-style question linked introversion with independence and extroversion with collaboration. | Replaced it with independent focus, brainstorming, communication, and check-in preferences on both sides. | Reflects the professor's feedback: people can enjoy collaboration and quiet work, and matching should consider concrete working habits. |
| Review had no decision feedback loop. | Added swipe/arrow review, an interest queue, structured pass reasons, and a simulated chat drawer. | The prototype demonstrates the full path from discovery to feedback and conversation. |
| Applicants did not have a meaningful post-profile destination. | Added **Launch profile**, an applicant activity hub, feedback, manager-activity simulation, and a Community & Projects page. | Applicants can see a future-facing view of what happens after they publish and share work beyond the résumé. |
| The landing experience opened directly into the app. | Added a cinematic, Apple-style **Forward** opener with an explicit enter action and replay controls. | The product starts with its mission and creates a smoother transition into the platform. |
| Styling needed a more intentional product identity. | Refined the global CSS into a warm editorial visual system with generous spacing and accessible interactive states. | The interface is calmer, more polished, and easier to scan. |
| Editing and review controls competed on one crowded screen. | Added persistent navigation, a home page, a guided editor, and a welcome experience on every visit. | Applicants and employers have clearer destinations and fewer competing tasks. |
| A long work history could overwhelm the first impression. | Added three applicant-selected highlights while retaining full history and original résumé downloads. | Applicants choose their strongest stories; employers can still review the complete context. |

## Product principles carried through the work

- **People first:** A profile should communicate a person's purpose, care for others, and community contribution as well as their technical ability.
- **Choice and agency:** Applicants choose what to publish, whether to use a document or profile form, and when to launch their work into the experience.
- **Private by default:** Work-style and hiring-preference inputs are kept out of public cards and are not displayed as a checklist for the other side to inspect.
- **Human judgment over automation:** Preferences start a conversation and never exclude an applicant. The profile story, review notes, and discussion remain central to the decision.
- **A real product needs stronger infrastructure:** This prototype demonstrates the workflow. A production version would add authentication, consent, secure storage, permissions, real messaging and email services, file scanning, accessibility testing, and an audited matching system.

This prototype does not upload documents to a server, send email, create accounts, track real managers, publish social posts, or contact real people. The applicant profile, résumé, photo, work preferences, and launch state persist in this browser. Hiring briefs, manager activity, feedback, community posts, and chat remain temporary demonstrations and clear on refresh. A service with shared accounts would need authentication, role-based access control, server-side storage, secure file handling, and consent controls. Work-preference prompts are suggestions, not assessments of job performance.

## Run locally

Use the published website or a local HTTP server. Direct `file://` opening can block the PDF worker and browser storage. No installation or build step is required; PDF.js 6.5.438 and its license are included in `vendor/pdfjs/`.

Run the work-preference regression checks with Node.js (no dependencies):

```powershell
node --test test-work-preferences.cjs test-resume-profile.cjs test-forward-redesign.cjs
```

To run a local static preview server with Node.js (this also serves the local portrait image in `assets/`):

```powershell
node -e "const http=require('http'),fs=require('fs'),path=require('path'),root=process.cwd(),types={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.mjs':'text/javascript','.pdf':'application/pdf','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp'};http.createServer((req,res)=>{const p=decodeURIComponent(new URL(req.url,'http://localhost').pathname),f=path.resolve(root,p==='/'?'index.html':'.'+p);if(f!==root&&!f.startsWith(root+path.sep)){res.writeHead(403);return res.end('Forbidden')}fs.readFile(f,(e,d)=>{res.writeHead(e?404:200,{'Content-Type':e?'text/plain':(types[path.extname(f)]||'application/octet-stream')});res.end(e?'Not found':d)})}).listen(8012)"
```

Then visit `http://localhost:8012`.

## Next stage: access for real employers

This is a plan, not a feature already enabled. Today, an employer on another computer cannot see an applicant's saved profile or résumé. The website is public; the locally saved files are not uploaded with it.

1. **Give people their own accounts.** Add applicant sign-in, employer sign-in, and verified company membership. Keep the two roles separate from the current demonstration switcher.
2. **Save shared profiles and files privately online.** Add a database for profiles and private storage for original résumés. Applicants explicitly choose which employer can receive a profile and file. Existing browser drafts should upload only after a clear review and sharing action.
3. **Check permission on every request.** A server must verify both the signed-in person and their access to that specific profile or file. Use short-lived download links, file-size and content validation, and scanning. Publicly guessing a file URL must not grant access. GitHub Pages can continue serving the interface while a separate service handles these protected operations.
4. **Let applicants manage access.** Show who has access and provide withdrawal and deletion controls. Explain that withdrawing future access cannot retrieve copies an employer already downloaded. Add retention rules and clear delivery status before enabling real messaging.
5. **Pilot with two accounts on two devices.** Verify that the intended employer receives the right profile and original PDF, another employer is denied, expired links fail, and withdrawing access blocks future requests. Test recovery, deletion, accessibility, and mobile use before inviting a wider audience.

Implementation guidance: [OWASP authorization guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) and [OWASP file-upload guidance](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html). No hosting provider, paid service, account system, or automatic file upload has been introduced by this redesign.
