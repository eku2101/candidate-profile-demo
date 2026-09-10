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

Automated Edge checks passed for mouse clicks and emulated touch taps: both arrows, cancelling and saving feedback, review completion, image preview, PDF selection and preview-frame creation, removal, invalid file types, and disabled applicant review buttons. No browser JavaScript errors occurred. These checks do not verify physical touchscreen hardware or PDF rendering across all browsers. After receiving instructions to retest the revised arrows and resume controls, the student reported, "everything is perfect!!!" No further problems were reported in that retest.

Optional developer check: with Node.js, Playwright, and Microsoft Edge available, run `node test-demo.cjs`.

## Reflection

The first version matched how I imagined my website would look and feel. However, I was surprised that the candidate arrow buttons worked with my computer's touchscreen but not with my mouse, so I asked Codex to fix that problem. I also requested an option to upload resumes as PDFs or images such as JPGs to make it easier for applicants to share their information with recruiters and hiring managers. I tested all the buttons and checked that the number of applicants left to review decreased in order as I moved through the profiles. After the revisions, the website worked the way I wanted during my testing.

AI helped me follow the steps to build and improve the website, but I had to decide what I wanted people to experience and explain those details clearly. This process taught me how much time and effort it takes to communicate an idea, test the result, and ask for changes. I see potential for this website to help people who feel discouraged when job applications lead to little or no feedback. My goal is to make asking for feedback feel less confrontational and make the response useful to the applicant. What remains uncertain is whether recruiters and managers would actually follow through and give thoughtful feedback without being too harsh. A future improvement could include sentence starters and safeguards against hurtful language to encourage constructive criticism. Those features are not implemented yet, and the current prototype only previews resumes and feedback locally rather than delivering them to other people.

## Run locally

Open `index.html` directly in a browser. No installation, build step, or server is required.

To use a local server instead, run this from the project folder with Node.js installed:

```powershell
node -e "require('http').createServer((req,res)=>require('fs').readFile('index.html',(err,data)=>{res.writeHead(err?404:200,{'Content-Type':'text/html'});res.end(err?'Not found':data)})).listen(8000)"
```

Then visit `http://localhost:8000`.
