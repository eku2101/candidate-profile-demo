# Forward — Talent Connections Demo

Forward is a browser-only prototype for two audiences: applicants building a public portfolio profile and hiring teams reviewing a ranked applicant pipeline. The startup role picker keeps the experiences separate, then starts each role with its own private intake questionnaire.

## Included interactions

- **Cinematic first-visit opener:** a full-screen Forward introduction reveals the product story before the role picker. The visitor chooses **Explore the experience** (or presses Escape) to transition into the app; after that, a small local browser flag skips the opener on return visits. It respects reduced-motion preferences and stores no profile or matching information.
- **Applicant private intake:** before accessing the profile builder, applicants set their work style, workload rhythm, and ideal company environment. Those values are kept out of the public profile and used only by the local matching model.
- **Applicant workspace:** choose **Upload document** to preview a local PDF/image or **Build profile** to update a live public card with a name, role, location, skills, and introduction. It intentionally has no default-photo bank or profile-picture upload control.
- **Mission and culture profile:** candidates can publicly share why they do their work, their professional values, how they support team well-being and colleagues, and a community contribution they are proud of. These people-centered story sections appear in the live preview, swipe card, and full public profile.
- **Strong example profile:** the Alex Santos reference is always visible beside the workspace on wide screens and is the only profile that displays an illustrative image. It is a structural guide, not a competitive ranking.
- **Hiring private intake:** before accessing the pipeline, managers and recruiters set the preferred experience level, team dynamics, workload rhythm, and environment for their role.
- **Compatibility signal:** the dashboard calculates and ranks each sample applicant with a percentage from the private applicant signals and private role brief. It displays only an aggregate signal—not raw answers—and labels it as a recommendation aid rather than an automated decision.
- **Hiring workspace:** review ranked sample applicants with the left/right arrows or a horizontal swipe. The card prioritizes public mission, values, team care, colleague support, and community impact alongside expertise. Right creates a local “Yes — interested” connection; left saves structured feedback.
- **In-app chat simulation:** an interested applicant receives a Chat button. The drawer stores messages in browser memory and includes a sender selector so either side of the conversation can be demonstrated.

This prototype does not upload documents, send email, create accounts, or contact real people. Chosen files, intake answers, compatibility calculations, and chat content stay in the current browser session and are cleared on refresh. The private matching model is a UI/workflow demonstration; a real secure product needs authenticated server-side storage and matching services.

## Run locally

Open `index.html` directly in a browser. No installation or build step is required.

To run a local static preview server with Node.js (this also serves the local portrait image in `assets/`):

```powershell
node -e "const http=require('http'),fs=require('fs'),path=require('path'),root=process.cwd(),types={'.html':'text/html; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp'};http.createServer((req,res)=>{const p=decodeURIComponent(new URL(req.url,'http://localhost').pathname),f=path.resolve(root,p==='/'?'index.html':'.'+p);if(f!==root&&!f.startsWith(root+path.sep)){res.writeHead(403);return res.end('Forbidden')}fs.readFile(f,(e,d)=>{res.writeHead(e?404:200,{'Content-Type':e?'text/plain':(types[path.extname(f)]||'application/octet-stream')});res.end(e?'Not found':d)})}).listen(8012)"
```

Then visit `http://localhost:8012`.
