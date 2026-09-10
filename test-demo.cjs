const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try {
  for(const touch of [false,true]){
   const context=await browser.newContext({hasTouch:touch,viewport:{width:1100,height:900}});
   const page=await context.newPage(); const errors=[]; page.on('pageerror',e=>errors.push(e.message));
   await page.goto(pathToFileURL(require('node:path').resolve('index.html')).href);
   const activate=async selector=>touch?page.locator(selector).tap():page.locator(selector).click();
   await activate('[data-role="recruiter"]');
   await activate('#leftBtn');
   assert(await page.locator('#feedbackModal').isVisible());
   await activate('#cancelFeedback');
   assert.equal(await page.locator('#name').textContent(),'Alex Santos');
   await activate('#rightBtn');
   await page.waitForFunction(()=>document.querySelector('#name')?.textContent==='Jordan Lee');
   assert.equal(await page.locator('#selectedList .feedback-item').count(),1);
   await activate('#leftBtn');
   await page.selectOption('#reason',{index:2});
   await page.fill('#note','<b>Example feedback</b>');
   await activate('#sendFeedback');
   await page.waitForFunction(()=>document.querySelector('#name')?.textContent==='Maya Patel');
   assert.equal(await page.locator('#feedbackList b').count(),0);
   assert((await page.locator('#feedbackList').textContent()).includes('<b>Example feedback</b>'));
   await activate('#rightBtn');
   await page.waitForFunction(()=>document.querySelector('#count').textContent==='Review complete');
   await page.locator('#resumeFile').setInputFiles({name:'sample.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXioAAAAASUVORK5CYII=','base64')});
   await page.waitForFunction(()=>document.querySelector('#uploadPreview img')?.naturalWidth>0);
   await activate('#removeResume');
   assert.equal(await page.locator('#uploadPreview img').count(),0);
   await page.locator('#resumeFile').setInputFiles({name:'resume.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF')});
   assert(await page.locator('#uploadPreview iframe').isVisible());
   assert(await page.locator('#openResume').isVisible());
   await page.locator('#resumeFile').setInputFiles({name:'bad.txt',mimeType:'text/plain',buffer:Buffer.from('not a resume')});
   assert((await page.locator('#uploadStatus').textContent()).includes('Please choose'));
   assert.equal(await page.locator('#uploadPreview iframe').count(),0);
   await page.reload(); await activate('[data-role="applicant"]');
   assert(await page.locator('#leftBtn').isDisabled());
   assert(await page.locator('#resumeFile').isVisible());
   if(!touch)await page.screenshot({path:'demo-check.png',fullPage:true});
   assert.deepEqual(errors,[]);
   console.log((touch?'Touch emulation':'Mouse')+': arrows, feedback, cancel, completion, image/PDF selection, removal, invalid type, applicant view passed');
   await context.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
