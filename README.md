# Forward — Candidate Profile Demo

This experience is for recruiters reviewing candidates for a job. When someone clicks an arrow on a candidate's profile card, the experience should let them indicate a job match or provide structured feedback about why it wasn't a fit.

Choose **I'm a recruiter** or **I'm a manager** to review three sample candidates. The right arrow saves an interested decision and shows an email preview. The left arrow opens structured feedback; cancel keeps the candidate, and save moves to the next one. Refresh to start again.

The **Your resume** section accepts one PDF, JPG, PNG, or WebP up to 10 MB. It provides a local preview, an open-in-new-tab link, and a remove button. Applicant mode also includes this control; review arrows are disabled in applicant mode.

This is a browser-only prototype: emails and feedback are not delivered, resumes stay in the current tab, and refreshing clears the session. Sample profiles and fit percentages are illustrative, not calculated from uploaded files. Some browsers may require the open-in-new-tab link to view a PDF.

## Important AI exchanges

- Defined the main interaction: indicate a match or give structured feedback using arrows.
- After testing, requested mouse and touchscreen support because role selection worked with both but candidate arrows only worked with touch.
- Requested PDF and image resume uploads. The revision adds file selection and local preview to keep the demo small.

## Testing and revision

The student tested the original demo with a mouse and touchscreen. Recruiter selection worked with both, but the candidate arrows did not respond to mouse clicks.

The revision prevents the swipe handler from capturing presses on buttons. It also ignores vertical/cancelled swipes and prevents repeated decisions during transitions. Resume selection, preview, removal, file-type checks, and a 10 MB limit were added. Feedback notes display as text, so typed markup does not become HTML.

Automated Edge checks passed for mouse clicks and emulated touch taps: both arrows, cancelling and saving feedback, review completion, image preview, PDF selection and preview-frame creation, removal, invalid file types, and disabled applicant review buttons. No browser JavaScript errors occurred. These checks do not verify physical touchscreen hardware or PDF rendering across all browsers. The student still needs to retest the revised version, including an actual PDF and image.

Optional developer check: with Node.js, Playwright, and Microsoft Edge available, run `node test-demo.cjs`.

## Reflection draft — review after retesting

I wanted recruiters to use the arrows on a candidate's card to indicate a job match or explain why the candidate was not a fit. In my first test, choosing the recruiter role worked with both my mouse and my computer's touchscreen. However, the candidate arrows only worked with touch, which did not match my intention. I asked for a revision so both input methods would work, and I also requested PDF and image options for adding a resume.

AI helped identify the swipe handler as the likely cause of the mouse problem, revise the code, and run automated mouse and touch-emulation checks. I supplied the real-device testing observations and decided which changes mattered to the experience. The revised demo also lets someone select and preview a resume locally. I still need to try the updated arrows and resume controls on my own computer before confirming that the changes solve my problem. Actual email delivery, permanent resume storage, and matching based on uploaded documents remain outside this prototype.

## Run locally

Open `index.html` directly in a browser. No installation, build step, or server is required.

To use a local server instead, run this from the project folder with Node.js installed:

```powershell
node -e "require('http').createServer((req,res)=>require('fs').readFile('index.html',(err,data)=>{res.writeHead(err?404:200,{'Content-Type':'text/html'});res.end(err?'Not found':data)})).listen(8000)"
```

Then visit `http://localhost:8000`.
