# Forward — Talent Connections Demo

Forward is a browser-only prototype for two audiences: applicants building a public portfolio profile and hiring teams reviewing a ranked applicant pipeline. The startup role picker keeps the experiences separate, then starts each role with its own private intake questionnaire.

## Included interactions

- **Cinematic opener:** a full-screen Forward introduction reveals the product story before the role picker. It plays automatically for new visitors and can be replayed at any time with **Play intro** in the header or from the role chooser. The visitor chooses **Explore the experience** (or presses Escape) to transition into the app; it respects reduced-motion preferences and stores no profile or matching information.
- **Applicant private intake:** before accessing the profile builder, applicants set their work style, workload rhythm, and ideal company environment. Those values are kept out of the public profile and used only by the local matching model.
- **Applicant workspace:** choose **Upload document** to preview a local PDF/image or **Build profile** to update a live public card with a name, role, location, skills, and introduction. Applicants can add their own JPG, PNG, or WebP profile image; PDFs become supporting documents instead. There is still no stock-photo bank or fake identity option.
- **Launch and applicant presence:** a draft stays out of the hiring pipeline until the applicant selects **Launch profile**. Launch opens an applicant-only activity hub with local manager activity, a feedback channel, and a separate Community & Projects page for project stories, images, PDF attachments, and awards.
- **Mission and culture profile:** candidates can publicly share why they do their work, their professional values, how they support team well-being and colleagues, and a community contribution they are proud of. These people-centered story sections appear in the live preview, swipe card, and full public profile.
- **Strong example profile:** the Alex Santos reference is always visible beside the workspace on wide screens and is the only profile that displays an illustrative image. It is a structural guide, not a competitive ranking.
- **Hiring private intake:** before accessing the pipeline, managers and recruiters set the preferred experience level, team dynamics, workload rhythm, and environment for their role.
- **Compatibility signal:** the dashboard calculates and ranks each sample applicant with a percentage from the private applicant signals and private role brief. It displays only an aggregate signal—not raw answers—and labels it as a recommendation aid rather than an automated decision.
- **Hiring workspace:** review ranked sample applicants with the left/right arrows or a horizontal swipe. The card prioritizes public mission, values, team care, colleague support, and community impact alongside expertise. Right creates a local “Yes — interested” connection; left saves structured feedback.
- **In-app chat simulation:** an interested applicant receives a Chat button. The drawer stores messages in browser memory and includes a sender selector so either side of the conversation can be demonstrated.

## Collaboration and iterative design

Forward was shaped through an ongoing design-and-build conversation rather than a one-time handoff. The starting vision was a career platform that could support applicants, recruiters, and hiring managers while making people feel more visible than a traditional résumé allows. From there, the work followed a practical loop: identify what felt confusing or incomplete in the live prototype, refine the workflow, test the result in the browser, and keep the strongest ideas.

The collaboration kept the concept focused on a simple promise: a person should be able to tell a fuller story about their work, while a hiring team should have a clearer and more respectful way to decide whom to meet. The result is intentionally more human than a typical job board. It puts mission, values, team care, colleague support, community contribution, and project work beside skills and experience instead of treating them as afterthoughts.

The project was also built around rapid, visible feedback. Each major request became a concrete interaction in the prototype: separate role experiences, better profile-building options, a clearer connection flow, an applicant launch moment, community posts, and a cinematic introduction. The site stays lightweight by using one HTML file with inline CSS and JavaScript, so every part of the experience can be opened, demonstrated, and revised quickly.

The early iterations also improved the small details that make a demo feel usable. For example, the candidate-review controls were refined so the left/right decision model works through both visible arrow buttons and swipe gestures. Resume previews, file-type checks, image/PDF handling, and removable profile media were added as the profile workflow became more realistic. These changes came from treating the prototype as something to test and improve, not just something to describe.

### How we worked

- **Started with the audience:** The applicant, recruiter, and hiring-manager journeys were defined first so the product did not feel like one crowded dashboard trying to serve everyone at once.
- **Used live review to guide changes:** Design feedback was applied directly to the working browser preview. This made it easy to see whether a new feature improved the story, navigation, and sense of trust before it was kept.
- **Built in small, testable layers:** The workflow grew from profile upload and review into role-specific intake, live profile building, matching, feedback, messaging, profile launch, and community sharing without adding a framework or external dependency.
- **Protected the human side of the concept:** Private work-style preferences remain separate from the public profile. The UI explains that compatibility is a recommendation aid, not an automated hiring decision, and the demo does not send real email, collect real visitor data, or contact real people.
- **Saved the work as it progressed:** Changes were versioned in Git and published through GitHub Pages so the evolving product could be reviewed as a live site as well as a local demo.

## What went well

### The product became clearer for each audience

One of the most important improvements was separating the applicant workspace from the hiring pipeline. On entry, people choose whether they are joining as an applicant or a hiring team. Applicants see a focused profile builder and live preview; recruiters and managers see ranked profile cards and review tools. This reduced the visual confusion of mixing creation and evaluation on the same screen and made each journey feel intentional.

### The profile moved beyond a résumé

The applicant experience now supports both a document-first path and a structured profile-building path. People can add a résumé, portfolio PDF, or their own image, then build a profile with a headline, location, skills, introduction, values, mission, culture footprint, colleague support, and community impact. The Alex Santos example remains visible as a supportive structural guide, showing the shape of a strong profile without asking applicants to copy someone else's identity.

### Matching is more transparent and respectful

Both applicants and hiring teams complete private intake questions before they use their main workspace. Those inputs create a background compatibility signal, but raw responses are not shown to the other side. The hiring view displays only an aggregate percentage and frames it as a conversation starter, leaving the public profile and human judgment at the center of the decision.

### Interaction feels more active and personal

The recruiter or manager can use left and right arrows, or swipe, to review applicants. A right action creates an interested connection, while a left action captures structured feedback about fit. Once a connection is made, the demo enables a lightweight chat drawer. Applicants also have a launch action that changes their profile from a draft into a visible part of the local matching experience, then opens their activity and feedback hub.

### The visual direction supports the idea

The warm editorial palette, cream background, generous white cards, charcoal type, taupe details, and purple interaction color give the site a more thoughtful, less corporate feel. The cinematic **Forward** opener adds an emotional first moment to the product: it introduces the mission before the dashboard appears, and it can be replayed from either the header or the role chooser. This makes the site feel more like a product experience than a static class project.

## Major modifications and why they improved the site

| Earlier experience | Modification | Why it improved Forward |
| --- | --- | --- |
| Applicants and hiring teams saw overlapping content. | Added a startup role picker and role-specific workspaces. | Each audience gets a focused path and a clearer purpose. |
| A candidate could mainly drop in a document. | Added **Upload document** and **Build profile** paths with a live preview. | Applicants can choose between a familiar résumé/portfolio workflow and a more expressive web profile. |
| Profiles emphasized title, skills, and background only. | Added mission, values, team care, colleague support, and community impact sections. | Hiring conversations can begin with values, contributions, and collaboration—not only credentials. |
| No clear way to show personal presentation. | Added support for applicant-owned image, JPG, PNG, WebP, and PDF uploads; images become the live profile picture and PDFs become supporting documents. | The profile feels more personal while avoiding a bank of fake stock identities. |
| Matching felt like a static card. | Added private applicant and hiring-team intake flows plus a compatibility percentage. | The ranking has an understandable, private logic while keeping sensitive preference details out of the public profile. |
| Review had no decision feedback loop. | Added swipe/arrow review, an interest queue, structured pass reasons, and a simulated chat drawer. | The prototype demonstrates the full path from discovery to feedback and conversation. |
| Applicants did not have a meaningful post-profile destination. | Added **Launch profile**, an applicant activity hub, feedback, manager-activity simulation, and a Community & Projects page. | Applicants can see a future-facing view of what happens after they publish and share work beyond the résumé. |
| The landing experience opened directly into the app. | Added a cinematic, Apple-style **Forward** opener with an explicit enter action and replay controls. | The product starts with its mission and creates a smoother transition into the platform. |
| Styling needed a more intentional product identity. | Refined the global CSS into a warm editorial visual system with generous spacing and accessible interactive states. | The interface is calmer, more polished, and easier to scan. |

## Product principles carried through the work

- **People first:** A profile should communicate a person's purpose, care for others, and community contribution as well as their technical ability.
- **Choice and agency:** Applicants choose what to publish, whether to use a document or profile form, and when to launch their work into the experience.
- **Private by default:** Work-style and hiring-preference inputs are kept out of public cards and are not displayed as a checklist for the other side to inspect.
- **Human judgment over automation:** Compatibility is shown as a simple aid, not a score that makes a hiring decision. The profile story, review notes, and conversation are still essential.
- **A real product needs stronger infrastructure:** This prototype demonstrates the workflow. A production version would add authentication, consent, secure storage, permissions, real messaging and email services, file scanning, accessibility testing, and an audited matching system.

This prototype does not upload documents, send email, create accounts, track real managers, publish social posts, or contact real people. Chosen files, intake answers, compatibility calculations, manager activity, feedback, project posts, and chat content stay in the current browser session and are cleared on refresh. The private matching model is a UI/workflow demonstration; a real secure product needs authentication, role-based access control, server-side storage, secure file handling, consent controls, and matching services.

## Run locally

Open `index.html` directly in a browser. No installation or build step is required.

To run a local static preview server with Node.js (this also serves the local portrait image in `assets/`):

```powershell
node -e "const http=require('http'),fs=require('fs'),path=require('path'),root=process.cwd(),types={'.html':'text/html; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp'};http.createServer((req,res)=>{const p=decodeURIComponent(new URL(req.url,'http://localhost').pathname),f=path.resolve(root,p==='/'?'index.html':'.'+p);if(f!==root&&!f.startsWith(root+path.sep)){res.writeHead(403);return res.end('Forbidden')}fs.readFile(f,(e,d)=>{res.writeHead(e?404:200,{'Content-Type':e?'text/plain':(types[path.extname(f)]||'application/octet-stream')});res.end(e?'Not found':d)})}).listen(8012)"
```

Then visit `http://localhost:8012`.
