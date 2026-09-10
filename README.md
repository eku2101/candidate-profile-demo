# Forward — Portfolio & Talent Hub

Single-file demo for portfolio owners, recruiters, and hiring managers. It includes a resume preview, role matching, visual customization, and a local document-upload interaction.

## Run locally

Open `index.html` directly in a browser. No installation, build step, or server is required.

To use a local server instead, run this from the project folder with Node.js installed:

```powershell
node -e "require('http').createServer((req,res)=>require('fs').readFile('index.html',(err,data)=>{res.writeHead(err?404:200,{'Content-Type':'text/html'});res.end(err?'Not found':data)})).listen(8000)"
```

Then visit `http://localhost:8000`.
