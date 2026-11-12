// Profile persistence and resume import. Loaded after the main application.
let savedResumeFile = null;
let savedPhotoFile = null;
let savedResumeText = "";
let featuredRoles = ForwardProfile.normalizeFeaturedRoles([]);
const resumeDownloadUrls = new Map();
let pendingResumeImport = null;
let profileStorageReady = false;
let profileSaveQueue = Promise.resolve();
let profileSaveVersion = 0;
const profileFieldNames = {
  name: "Name", role: "Role title", location: "Location", email: "Email (saved privately)", phone: "Phone (saved privately)",
  skills: "Core skills", summary: "Short introduction", experience: "Previous jobs & experience", education: "Education", credentials: "Certifications & achievements",
  mission: "Why I do this work", values: "Professional values", wellbeing: "Team well-being", support: "Colleague support", community: "Community impact"
};

function profileFieldId(key) {
  return "profile" + key[0].toUpperCase() + key.slice(1) + "Input";
}
function readProfileFields() {
  return Object.fromEntries(Object.keys(profileFieldNames).map(key => [key, $(profileFieldId(key)).value]));
}
function renderCareer(id, person) {
  const host = $(id);
  host.replaceChildren();
  const highlights = ForwardProfile.normalizeFeaturedRoles(person.featuredRoles).filter(role => role.title.trim());
  if (highlights.length) {
    const heading = document.createElement('h4');
    heading.textContent = 'Featured experience';
    host.append(heading);
    highlights.forEach(role => {
      const card = document.createElement('article');
      card.className = 'featured-role-card';
      const title = document.createElement('h4');
      title.textContent = role.title;
      const dates = document.createElement('p');
      dates.className = 'role-dates';
      dates.textContent = role.dates;
      const story = document.createElement('p');
      story.textContent = role.summary;
      card.append(title, dates, story);
      host.append(card);
    });
  }
  ["experience", "education", "credentials"].forEach(key => {
    if (!person[key]?.trim()) return;
    const section = document.createElement("details");
    section.className = "career-section";
    section.open = false;
    const title = document.createElement("summary");
    title.textContent = key === 'experience' ? 'Full work history' : profileFieldNames[key];
    const body = document.createElement("p");
    body.textContent = person[key];
    section.append(title, body);
    host.append(section);
  });
}
function renderResumeDownload(id, person) {
  const host = $(id);
  if (!host) return;
  if (resumeDownloadUrls.has(id)) URL.revokeObjectURL(resumeDownloadUrls.get(id));
  resumeDownloadUrls.delete(id);
  host.replaceChildren();
  const title = document.createElement('h4');
  title.textContent = 'Take a look at the full story';
  const note = document.createElement('p');
  note.textContent = 'Featured roles are highlights. Review the full résumé for additional experience and context before making a decision.';
  host.append(title, note);
  // Only this person's own attachment may be offered; sample applicants have none.
  if (!(person?.resumeFile instanceof Blob)) {
    const empty = document.createElement('p');
    empty.className = 'help';
    empty.textContent = 'No résumé is attached to this profile.';
    host.append(empty);
    return;
  }
  const file = person.resumeFile;
  const url = URL.createObjectURL(file);
  resumeDownloadUrls.set(id, url);
  const actions = document.createElement('div');
  actions.className = 'resume-actions';
  const view = document.createElement('a');
  view.className = 'button secondary';
  view.href = url;
  view.target = '_blank';
  view.rel = 'noopener';
  view.textContent = 'View résumé ↗';
  const download = document.createElement('a');
  download.className = 'button primary';
  download.href = url;
  download.download = file.name || person.attachmentName || 'resume.pdf';
  download.textContent = 'Download résumé';
  actions.append(view, download);
  const filename = document.createElement('p');
  filename.className = 'help';
  filename.textContent = download.download + ' · Original uploaded file';
  host.append(actions, filename);
}
function setSaveStatus(message) {
  document.querySelectorAll("[data-profile-save-status]").forEach(element => { element.textContent = message; });
}
function saveApplicantProfile() {
  if (!profileStorageReady) return Promise.resolve(false);
  const version = ++profileSaveVersion;
  const record = { schemaVersion: 1, fields: readProfileFields(), preferences: { ...applicantPreferences },
    featuredRoles: featuredRoles.map(role => ({ ...role })),
    applicantQuizComplete, applicantLaunched, resumeFile: savedResumeFile, photoFile: savedPhotoFile,
    resumeText: savedResumeText, updatedAt: new Date().toISOString() };
  setSaveStatus("Saving your profile in this browser…");
  profileSaveQueue = profileSaveQueue.then(async () => {
    try {
      await ForwardResume.saveProfile(record);
      if (version === profileSaveVersion) setSaveStatus("Saved in this browser at " + new Date(record.updatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) + ". You can close or refresh this page.");
      return true;
    } catch (error) {
      if (version === profileSaveVersion) setSaveStatus("Not saved: browser storage is unavailable or full. Your changes are still in this tab. Use Save profile to try again.");
      return false;
    }
  });
  return profileSaveQueue;
}
function showProfileForm(step = 0) {
  $("uploadPane").hidden = false;
  $("formPane").hidden = false;
  showBuilderStep(step);
}
function showResumePreview(file) {
  if (resumeUrl) URL.revokeObjectURL(resumeUrl);
  $("docPreview").replaceChildren();
  if (!file) return;
  resumeUrl = URL.createObjectURL(file);
  const preview = document.createElement(file.type.startsWith("image/") ? "img" : "iframe");
  preview.src = resumeUrl;
  if (preview.tagName === "IFRAME") preview.title = "Saved résumé preview";
  else preview.alt = "Saved document preview";
  $("docPreview").append(preview);
}
function showResumeImport(result, file = null) {
  pendingResumeImport = { ...result, file };
  const host = $("resumeImportFields");
  host.replaceChildren();
  Object.keys(profileFieldNames).slice(0, 10).forEach(key => {
    const group = document.createElement("div");
    const long = ["skills", "summary", "experience", "education", "credentials"].includes(key);
    if (long) group.className = "full";
    const label = document.createElement("label");
    label.htmlFor = "import-" + key;
    label.textContent = profileFieldNames[key];
    const input = document.createElement(long ? "textarea" : "input");
    input.id = label.htmlFor;
    input.value = result.fields[key] || "";
    if (["experience", "education", "credentials"].includes(key)) input.className = "long-field";
    group.append(label, input);
    host.append(group);
  });
  $("resumeRawText").value = result.rawText;
  const existingName = $("profileNameInput").value.trim();
  const differentName = existingName && result.fields.name && existingName.toLowerCase() !== result.fields.name.toLowerCase();
  $("resumeImportWarnings").textContent = result.warnings.join(" ") + (differentName ? " A profile for " + existingName + " is already saved. If this résumé belongs to a different person, cancel and clear the saved profile first to avoid mixing information." : "");
  $("resumeImportModal").hidden = false;
  $("import-name").focus();
}
async function importResumeFile(file) {
  if (!file) return;
  const pdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  if (file.size > 10 * 1024 * 1024 || (!pdf && !["image/jpeg", "image/png", "image/webp"].includes(file.type))) {
    $("fileStatus").textContent = "Choose a PDF, JPG, PNG, or WebP file no larger than 10 MB.";
    showToast("That file could not be imported. Your existing profile is unchanged.");
    return;
  }
  if (!pdf) {
    savedResumeFile = file;
    profileAttachmentName = file.name;
    showResumePreview(file);
    updateCandidatePreview();
    const saved = await saveApplicantProfile();
    $("fileStatus").textContent = file.name + (saved ? " saved in this browser. Images do not autofill text; use a text-based PDF or paste the résumé below." : " is visible in this tab but could not be saved.");
    return;
  }
  $("resumeFile").disabled = $("profileMediaFile").disabled = $("parsePastedResume").disabled = true;
  $("fileStatus").textContent = "Reading your PDF on this device…";
  try {
    const result = await ForwardResume.extractPdf(file, message => { $("fileStatus").textContent = message; });
    showResumeImport(result, file);
    $("fileStatus").textContent = "Résumé read. Review the details, then choose Save résumé to my profile.";
  } catch (error) {
    const message = error.message || "This PDF could not be read. Try another file or paste the résumé text below.";
    $("fileStatus").textContent = message;
    $("profileMediaStatus").textContent = message;
    showToast("The résumé could not be imported. Your existing profile is unchanged.");
  } finally {
    $("resumeFile").disabled = $("profileMediaFile").disabled = $("parsePastedResume").disabled = false;
  }
}
async function restoreApplicantProfile() {
  try {
    const stored = await ForwardResume.loadProfile();
    const record = ForwardResume.validateProfile(stored);
    if (stored && !record) throw new Error("Saved profile format is not supported.");
    if (record) {
      Object.keys(profileFieldNames).forEach(key => { $(profileFieldId(key)).value = record.fields[key]; });
      featuredRoles = ForwardProfile.normalizeFeaturedRoles(record.featuredRoles);
      const preferences = record.preferences || {};
      let validPreferences = true;
      [...workPreferenceKeys, "rhythm", "environment"].forEach(key => {
        const element = $("applicant" + key[0].toUpperCase() + key.slice(1));
        const valid = [...element.options].some(option => option.value && option.value === preferences[key]);
        if (valid) element.value = preferences[key];
        else validPreferences = false;
      });
      if (validPreferences) applicantPreferences = { ...preferences };
      applicantQuizComplete = Boolean(record.applicantQuizComplete && validPreferences);
      applicantLaunched = Boolean(record.applicantLaunched && applicantQuizComplete && isLaunchReady());
      savedResumeText = typeof record.resumeText === "string" ? record.resumeText : "";
      if (record.resumeFile instanceof Blob) {
        savedResumeFile = record.resumeFile;
        profileAttachmentName = record.resumeFile.name || "Saved résumé.pdf";
        showResumePreview(savedResumeFile);
        $("fileStatus").textContent = profileAttachmentName + " restored from this browser.";
        $("profileMediaStatus").textContent = "Saved résumé: " + profileAttachmentName;
      }
      if (record.photoFile instanceof Blob) {
        savedPhotoFile = record.photoFile;
        profileImageUrl = URL.createObjectURL(savedPhotoFile);
        $("removeProfileImage").hidden = false;
        $("profileMediaStatus").textContent = "Your saved profile image has been restored.";
      }
      setSaveStatus("Your saved profile was restored from this browser.");
      showProfileForm();
    }
  } catch (error) {
    setSaveStatus("Saved profile could not be loaded. Your browser may be blocking storage. Saving can be retried with Save profile.");
  } finally {
    profileStorageReady = true;
  }
}

async function initializeProfileApp() {
  await restoreApplicantProfile();
  initializeForwardUI();
  Object.keys(profileFieldNames).forEach(key => {
    $(profileFieldId(key)).addEventListener("input", () => {
      updateCandidatePreview();
      updateWritingGuidance();
      if (key === 'experience') updateRoleSuggestions();
      saveApplicantProfile();
    });
  });
  $("saveProfileButton").addEventListener("click", async () => {
    if (await saveApplicantProfile()) showToast("Your profile is saved in this browser.");
  });
  $("clearProfileButton").addEventListener("click", async () => {
    if (!window.confirm("Clear this browser's saved profile, résumé, photo, and work preferences? This cannot be undone.")) return;
    profileStorageReady = false;
    await profileSaveQueue;
    try {
      await ForwardResume.deleteProfile();
      window.location.reload();
    } catch (error) {
      profileStorageReady = true;
      setSaveStatus("Your saved profile could not be cleared. Try again.");
    }
  });
  $("parsePastedResume").addEventListener("click", () => {
    const text = $("pasteResumeText").value.trim();
    if (text.length < 25) { $("fileStatus").textContent = "Paste your résumé text first, including your experience and education."; return; }
    showResumeImport(ForwardResume.parseResumeText(text));
  });
  $("cancelResumeImport").addEventListener("click", () => {
    pendingResumeImport = null;
    $("resumeImportModal").hidden = true;
    $("fileStatus").textContent = "Import cancelled. Your saved profile is unchanged.";
    $("resumeFile").value = "";
    $("profileMediaFile").value = "";
  });
  $("resumeImportForm").addEventListener("submit", async event => {
    event.preventDefault();
    if (!pendingResumeImport) return;
    $("saveResumeImport").disabled = $("cancelResumeImport").disabled = true;
    Object.keys(profileFieldNames).slice(0, 10).forEach(key => {
      const value = $("import-" + key).value.trim();
      if (value) $(profileFieldId(key)).value = value;
    });
    savedResumeText = pendingResumeImport.rawText;
    if (pendingResumeImport.file) {
      savedResumeFile = pendingResumeImport.file;
      profileAttachmentName = pendingResumeImport.file.name;
      showResumePreview(savedResumeFile);
    }
    updateCandidatePreview();
    updateRoleSuggestions();
    updateWritingGuidance();
    const saved = await saveApplicantProfile();
    $("saveResumeImport").disabled = $("cancelResumeImport").disabled = false;
    if (!saved) {
      $("resumeImportWarnings").textContent = "The details are in this tab but could not be saved. Browser storage may be blocked or full. Try Save résumé to my profile again.";
      return;
    }
    pendingResumeImport = null;
    $("resumeImportModal").hidden = true;
    showProfileForm(1);
    $("fileStatus").textContent = "Résumé information and document saved in this browser.";
    $("profileMediaStatus").textContent = profileAttachmentName ? "Saved résumé: " + profileAttachmentName : "Résumé information saved.";
    $("featured-0-title").focus();
    showToast("Résumé saved to your profile. You can review and edit every field.");
  });
  updateCandidatePreview();
  renderApplicantCard();
  renderYesList();
  renderFeedback();
  renderManagerActivity();
  renderApplicantFeedback();
  renderProjectFeed();
  initializeIntro();
}

initializeProfileApp();
