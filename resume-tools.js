(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ForwardResume = api;
})(globalThis, function () {
  "use strict";
  const fields = ["name", "role", "location", "email", "phone", "skills", "summary", "experience", "education", "credentials", "mission", "values", "wellbeing", "support", "community"];
  function sectionName(line) {
    const heading = line.trim().replace(/[:\s]+$/, "").toLowerCase();
    if (/^(?:(?:professional|relevant|work|employment|career|teaching|clinical|leadership|research)\s+)*(?:experience|history|employment)$/.test(heading)) return "experience";
    if (/^(?:education(?:\s*(?:&|and)\s*qualifications)?|academic (?:background|qualifications)|qualifications)$/.test(heading)) return "education";
    if (/^(?:(?:technical|core|key|professional|additional)\s+)?(?:skills|competencies|expertise)(?:\s*(?:&|and)\s*(?:abilities|tools|technologies))?$/.test(heading)) return "skills";
    if (/^(?:(?:(?:professional|career|personal)\s+)?(?:summary|profile|objective)|about(?: me)?)$/.test(heading)) return "summary";
    if (/^(?:(?:professional|additional)\s+)?(?:certifications?|certificates?|licen[cs]es?|awards?|honors?|achievements?|training)(?:\s*(?:&|and)\s*\w+)?$/.test(heading)) return "credentials";
    if (/^(?:volunteer(?:ing| experience)?|community (?:service|involvement)|projects?|publications?|extracurricular activities)$/.test(heading)) return "experience";
    if (/^(?:references?|interests?|languages?|contact(?: information)?|additional information)$/.test(heading)) return "other";
    return null;
  }

  function parseResumeText(text) {
    const rawText = String(text || "").replace(/\r/g, "").replace(/\u0000/g, "").trim();
    const lines = rawText.split("\n").map(line => line.trim().replace(/\t| {3,}/g, " | ").replace(/ {2}/g, " ")).filter(Boolean);
    const result = Object.fromEntries(fields.map(key => [key, ""]));
    const sections = { experience: [], education: [], skills: [], summary: [], credentials: [] };
    const header = [];
    let current = null;
    for (const line of lines) {
      if (/^(?:page\s*)?\d+\s*(?:of|\/)\s*\d+$/i.test(line)) continue;
      const section = sectionName(line);
      if (section) {
        current = section;
        if (sections[section]?.length) sections[section].push("", line);
      } else if (!current) header.push(line);
      else if (sections[current]) sections[current].push(line);
    }
    for (const key of Object.keys(sections)) result[key] = sections[key].join("\n").trim();
    result.skills = result.skills.replace(/^[•●▪\-]\s*/gm, "").replace(/\s*[•●▪|]\s*|\n/g, ", ");
    const contact = header.join("\n") || lines.slice(0, 12).join("\n");
    result.email = contact.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/)?.[0] || "";
    result.phone = contact.match(/(?:\+\d{1,3}[ .-]?)?(?:\(\d{3}\)|\d{3})[ .-]\d{3}[ .-]\d{4}(?:\s*(?:ext\.?|x)\s*\d+)?/i)?.[0] || "";
    const parts = header.flatMap(line => line.split(/\s*[|•●]\s*|\s{3,}/)).map(line => line.trim());
    result.location = parts.find(line => !/@|https?:|www\.|linkedin\./i.test(line) && /(?:^[\p{L} .'-]+,\s*[A-Z]{2}(?:\s+\d{5})?$|^remote(?:\b|$))/u.test(line)) || "";
    const nameIndex = header.findIndex(line => {
      const name = line.replace(/\s*[|•].*$/, "");
      return name.length <= 75 && name.split(/\s+/).length >= 2 && name.split(/\s+/).length <= 6 &&
        /^[\p{L} .,'’\-]+$/u.test(name) && !sectionName(name) &&
        !/resume|résumé|curriculum vitae|references|portfolio|@|https?|remote|,\s*[A-Z]{2}$/i.test(name);
    });
    if (nameIndex !== -1) {
      result.name = header[nameIndex].replace(/\s*[|•].*$/, "").trim();
      const possibleRole = header[nameIndex + 1] || "";
      if (possibleRole.length <= 90 && possibleRole !== result.location && !/@|https?:|www\.|linkedin|\d{3}|,\s*[A-Z]{2}/i.test(possibleRole)) result.role = possibleRole;
    }
    return { fields: result, rawText, warnings: [
      ...(!result.experience ? ["No work-history section was recognized. Check the extracted text and add your previous jobs."] : []),
      ...(!result.name ? ["Check the name field; a name could not be identified confidently."] : [])
    ] };
  }

  // Reconstruct lines using PDF coordinates. Recognize separate columns only
  // when both have section headings, so right-aligned job dates stay attached.
  function textItemsToLines(items) {
    const rows = [];
    for (const item of items.filter(item => item.str?.trim())) {
      const y = item.transform[5];
      let row = rows.find(row => Math.abs(row.y - y) < 3);
      if (!row) { row = { y, items: [] }; rows.push(row); }
      row.items.push(item);
    }
    rows.sort((a, b) => b.y - a.y);
    const segments = rows.flatMap(row => {
      const parts = [];
      let current = null;
      for (const item of row.items.sort((a, b) => a.transform[4] - b.transform[4])) {
        const x = item.transform[4];
        if (!current || x - current.end > Math.max(24, (item.height || 10) * 2.4)) {
          current = { x, y: row.y, end: x, text: "" }; parts.push(current);
        }
        const gap = x - current.end;
        current.text += (current.text && gap > 1 ? " " : "") + item.str;
        current.end = x + item.width;
      }
      return parts;
    });
    const headings = segments.filter(segment => sectionName(segment.text));
    const starts = headings.map(segment => segment.x).sort((a, b) => a - b);
    const split = starts.find((x, index) => index && x - starts[index - 1] > 110);
    if (split !== undefined) {
      const firstHeadingY = Math.max(...headings.map(segment => segment.y));
      const common = segments.filter(segment => segment.y > firstHeadingY + 3);
      const body = segments.filter(segment => segment.y <= firstHeadingY + 3);
      return [...common, ...body.filter(segment => segment.x < split - 12), ...body.filter(segment => segment.x >= split - 12)].map(segment => segment.text.trim());
    }
    return rows.map(row => segments.filter(segment => segment.y === row.y).map(segment => segment.text.trim()).join("   "));
  }

  async function extractPdf(file, onProgress = () => {}) {
    if (file.size > 10 * 1024 * 1024) throw new Error("Choose a PDF no larger than 10 MB.");
    const data = new Uint8Array(await file.arrayBuffer());
    if (new TextDecoder().decode(data.slice(0, 1024)).indexOf("%PDF-") < 0) throw new Error("This file does not appear to be a valid PDF. Try exporting the résumé as a PDF again.");
    const pdfjs = await import("./vendor/pdfjs/pdf.min.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("./vendor/pdfjs/pdf.worker.min.mjs", document.baseURI).href;
    const task = pdfjs.getDocument({ data, isEvalSupported: false, useSystemFonts: true,
      cMapUrl: new URL("./vendor/pdfjs/cmaps/", document.baseURI).href, cMapPacked: true,
      standardFontDataUrl: new URL("./vendor/pdfjs/standard_fonts/", document.baseURI).href });
    let timeout;
    try {
      const result = await Promise.race([
        (async () => {
          const pdf = await task.promise;
          if (pdf.numPages > 40) throw new Error("Please choose a résumé with 40 pages or fewer.");
          const pages = [];
          for (let index = 1; index <= pdf.numPages; index++) {
            onProgress("Reading page " + index + " of " + pdf.numPages + "…");
            const page = await pdf.getPage(index);
            const text = await page.getTextContent();
            pages.push(textItemsToLines(text.items).join("\n"));
            page.cleanup();
          }
          const text = pages.join("\n\n");
          if (text.replace(/\s/g, "").length < 25) throw new Error("This PDF has little or no selectable text. It may be a scan. Upload a text-based PDF or paste the résumé text below.");
          if (text.length > 150000) throw new Error("This document is too long to import as a résumé. Please use a shorter PDF.");
          return parseResumeText(text);
        })(),
        new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error("Reading this PDF took too long. Try a simpler PDF or paste its text below.")), 60000); })
      ]);
      return result;
    } catch (error) {
      if (error.name === "PasswordException") throw new Error("This PDF is password protected. Upload an unlocked copy or paste the résumé text below.");
      throw error;
    } finally {
      clearTimeout(timeout);
      await task.destroy();
    }
  }

  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("forward-profile-v1", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("profiles");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error("Close other Forward tabs and try saving again."));
    });
  }
  async function profileTransaction(mode, operation) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("profiles", mode);
      const request = operation(transaction.objectStore("profiles"));
      transaction.oncomplete = () => { db.close(); resolve(request.result); };
      transaction.onerror = transaction.onabort = () => { db.close(); reject(transaction.error || new Error("Browser storage is unavailable.")); };
    });
  }
  function validateProfile(record) {
    if (!record || record.schemaVersion !== 1 || !record.fields || typeof record.fields !== "object" || Array.isArray(record.fields)) return null;
    return { ...record, fields: Object.fromEntries(fields.map(key => [key, typeof record.fields[key] === "string" ? record.fields[key].slice(0, 150000) : ""])) };
  }
  return { fields, parseResumeText, textItemsToLines, extractPdf, validateProfile,
    loadProfile: () => profileTransaction("readonly", store => store.get("current")),
    saveProfile: record => profileTransaction("readwrite", store => store.put(record, "current")),
    deleteProfile: () => profileTransaction("readwrite", store => store.delete("current")) };
});
