// Navigation, guided editing, and the opening experience. No data leaves this device.
let forwardPage = 'home';
let builderStep = 0;
let introPlaybackTimer = null;
let introPlaybackStarted = 0;
let introPlaybackRemaining = 10000;
let introPlaybackPaused = false;
let welcomeTimer = null;
let welcomeReady = false;
const builderSteps = ['About you', 'Your top three', 'Values & teamwork', 'Work preferences', 'Review & launch'];
function makeElement(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function navigationIcon(name) {
  const paths = { home: 'M3 10 12 3l9 7v11h-6v-7H9v7H3Z', discover: 'm16 8-3 5-5 3 3-5Z M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20', connections: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75', messages: 'M21 15a3 3 0 0 1-3 3H7l-5 4V5a3 3 0 0 1 3-3h13a3 3 0 0 1 3 3Z M7 7h9 M7 12h6', profile: 'M20 21v-2a7 7 0 0 0-14 0v2 M13 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8' };
  return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="${paths[name]}"></path></svg>`;
}
function setNavigation(page) {
  forwardPage = page;
  document.querySelectorAll('.main-navigation [data-route]').forEach(button => {
    const selected = button.dataset.route === page;
    button.classList.toggle('selected', selected);
    if (selected) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
}
function hideForwardPages() {
  ['applicantWorkspace', 'applicantLivePage', 'applicantCommunityPage', 'hiringWorkspace', 'forwardHome', 'teamDiscovery', 'teamDetailPage', 'hiringProfilePage', 'forwardConnections', 'forwardMessages'].forEach(id => {
    if ($(id)) $(id).hidden = true;
  });
}
function navigateForward(page) {
  if (page !== 'home' && !activeRole) { showRoleChooser(); return; }
  if (page !== 'home' && activeRole && !onboardingComplete(activeRole)) {
    openWorkOnboarding(activeRole, true);
    return;
  }
  hideForwardPages();
  setNavigation(page);
  if (page === 'home') {
    $('forwardHome').hidden = false;
    renderForwardHome();
  } else if (page === 'profile') {
    if (activeRole === 'hiring') { $('hiringProfilePage').hidden = false; renderHiringProfileStatus(); }
    else showApplicantPage(getInteractiveApplicant() ? 'hub' : 'builder');
  } else if (page === 'discover') {
    if (activeRole === 'hiring') {
      if (!hiringQuizComplete) { openHiringQuiz(); $('forwardHome').hidden = false; renderForwardHome(); }
      else { $('hiringWorkspace').hidden = false; rankRemainingApplicants(); renderApplicantCard(); renderRoleBrief(); }
    } else { $('teamDiscovery').hidden = false; renderJobDiscovery(); }
  } else if (page === 'connections') {
    $('forwardConnections').hidden = false;
    $('yesList').previousElementSibling.textContent = activeRole === 'applicant' ? 'Teams interested in your story' : 'People you want to meet';
    $('feedbackList').previousElementSibling.textContent = activeRole === 'applicant' ? 'Notes shared with you' : 'Saved review notes';
    renderYesList(); renderFeedback();
    renderTeamConnections();
  } else if (page === 'messages') {
    $('forwardMessages').hidden = false;
    renderMessageInbox();
  }
  window.scrollTo({ top: 0, behavior: 'instant' });
}
function renderForwardHome() {
  const name = $('profileNameInput').value.trim().split(/\s+/)[0];
  $('homeGreeting').textContent = activeRole === 'applicant' && name ? `Your next chapter, ${name}.` : activeRole === 'hiring' ? 'Make room for potential.' : 'A new way to move Forward.';
  $('homeRoleChoices').hidden = Boolean(activeRole);
  $('homeWorkspaceActions').hidden = !activeRole;
  $('homePrimary').textContent = activeRole === 'hiring' ? 'Explore applicants →' : applicantLaunched ? 'View my profile →' : 'Build my profile →';
  $('homePrimary').dataset.route = activeRole === 'hiring' ? 'discover' : 'profile';
  $('homeRoleLabel').textContent = activeRole === 'hiring' ? 'YOUR HIRING WORKSPACE' : activeRole === 'applicant' ? 'YOUR NEXT CHAPTER' : 'PEOPLE. POTENTIAL. POSSIBILITY.';
  const complete = [Boolean($('profileNameInput').value.trim() && $('profileSummaryInput').value.trim()), featuredRoles.some(role => role.title.trim()), Boolean($('profileMissionInput').value.trim()), applicantQuizComplete];
  $('homeProgressCopy').textContent = activeRole === 'hiring' ? 'Read the full story. Explore working together. Start a conversation.' : `${complete.filter(Boolean).length} of 4 foundations added. Build a profile that sounds like you.`;
  $('homeProgress').value = complete.filter(Boolean).length;
  $('homeProgress').hidden = activeRole === 'hiring';
  renderHomeQuestionnaire();
  if ($('homeExploreJobs')) $('homeExploreJobs').hidden = activeRole !== 'applicant';
}
function renderMessageInbox() {
  const host = $('forwardInbox');
  host.replaceChildren();
  const visible = Object.values(connections).filter(connection => activeRole !== 'applicant' || connection.person.id === 'avery');
  if (!visible.length) {
    host.append(makeElement('h3', '', 'Good conversations start with a connection.'), makeElement('p', 'muted-copy', 'When you connect in this demo, your conversation appears here.'));
    return;
  }
  visible.forEach(connection => {
    const button = makeElement('button', 'inbox-row');
    button.type = 'button';
    button.append(makeElement('strong', '', activeRole === 'applicant' ? (hasPublishedTeam() ? hiringProfileState.published.managerName + ' · ' + hiringProfileState.published.company : 'Hiring team conversation') : connection.person.name), makeElement('span', '', connection.messages.at(-1)?.text || 'Start a conversation'));
    button.addEventListener('click', () => openChat(connection.person.id));
    host.append(button);
  });
}
function beginIntroPlayback() {
  stopIntroPlayback();
  introPlaybackRemaining = 10000;
  introPlaybackPaused = false;
  $('introOverlay').classList.remove('intro-paused');
  $('pauseIntro').textContent = 'Pause animation';
  $('introCopy').textContent = 'Your story is bigger than a job title. Let the world see what you bring.';
  introPlaybackStarted = performance.now();
  introPlaybackTimer = window.setTimeout(() => finishIntro(), introPlaybackRemaining);
}
function stopIntroPlayback() {
  window.clearTimeout(introPlaybackTimer);
  introPlaybackTimer = null;
}
function toggleIntroPlayback() {
  if (introPlaybackPaused) {
    introPlaybackStarted = performance.now();
    introPlaybackTimer = window.setTimeout(() => finishIntro(), introPlaybackRemaining);
  } else {
    introPlaybackRemaining = Math.max(0, introPlaybackRemaining - (performance.now() - introPlaybackStarted));
    stopIntroPlayback();
  }
  introPlaybackPaused = !introPlaybackPaused;
  $('introOverlay').classList.toggle('intro-paused', introPlaybackPaused);
  $('pauseIntro').textContent = introPlaybackPaused ? 'Resume animation' : 'Pause animation';
}
function showWelcome() {
  window.clearTimeout(welcomeTimer);
  welcomeReady = false;
  $('welcomeOverlay').hidden = false;
  $('welcomeClose').hidden = true;
  $('welcomeContinue').disabled = true;
  $('siteShell').inert = true;
  $('siteShell').setAttribute('aria-hidden', 'true');
  document.body.classList.add('welcome-active');
  $('welcomeTitle').focus();
  welcomeTimer = window.setTimeout(() => {
    welcomeReady = true;
    $('welcomeClose').hidden = false;
    $('welcomeContinue').disabled = false;
  }, 5000);
}
function closeWelcome() {
  if (!welcomeReady) return;
  $('welcomeOverlay').hidden = true;
  $('siteShell').inert = false;
  $('siteShell').removeAttribute('aria-hidden');
  document.body.classList.remove('welcome-active');
  if (introReturnsToRoleChooser || !activeRole) navigateForward('home');
  (introReturnFocus instanceof HTMLElement && document.contains(introReturnFocus) ? introReturnFocus : $('homeGreeting')).focus();
}
function showBuilderStep(step, focus = false) {
  builderStep = Math.max(0, Math.min(builderSteps.length - 1, step));
  document.querySelectorAll('[data-builder-panel]').forEach(panel => { panel.hidden = Number(panel.dataset.builderPanel) !== builderStep; });
  document.querySelectorAll('[data-builder-step]').forEach(button => {
    const selected = Number(button.dataset.builderStep) === builderStep;
    button.classList.toggle('selected', selected);
    if (selected) button.setAttribute('aria-current', 'step');
    else button.removeAttribute('aria-current');
  });
  if (!$('builderStepTitle')) return;
  $('builderStepTitle').textContent = builderSteps[builderStep];
  $('builderProgress').textContent = `Step ${builderStep + 1} of ${builderSteps.length}`;
  $('builderBack').disabled = builderStep === 0;
  $('builderNext').hidden = builderStep === builderSteps.length - 1;
  $('builderPreviewNote').hidden = builderStep !== 4;
  if (builderStep === 4) updateCandidatePreview();
  updateWritingGuidance();
  if (focus) { $('builderStepTitle').focus(); $('builderStepTitle').scrollIntoView({ block: 'start', behavior: 'instant' }); }
}
function profileWithinLimits() {
  return ForwardProfile.violations(readProfileFields(), featuredRoles).length === 0;
}
function updateWritingGuidance() {
  if (!$('builderStepTitle')) return;
  Object.entries(ForwardProfile.limits).forEach(([key, rule]) => {
    const field = $(profileFieldId(key));
    const counter = $('count-' + key);
    if (!counter) return;
    const total = ForwardProfile.count(field.value, rule.unit);
    counter.textContent = `${total} / ${rule.max} ${rule.unit}` + (total > rule.max ? ' · Shorten this before launching; your draft is saved.' : '');
    counter.classList.toggle('over-limit', total > rule.max);
    field.setAttribute('aria-invalid', String(total > rule.max));
  });
  featuredRoles.forEach((role, index) => {
    if ($(`featured-${index}-heading`)) $(`featured-${index}-heading`).textContent = `Featured role ${index + 1}` + (role.title.trim() ? ` · ${role.title}` : ' · Choose an experience');
    const counter = $(`featured-${index}-count`);
    if (!counter) return;
    const total = ForwardProfile.count(role.summary);
    counter.textContent = `${total} / 100 words` + (total > 100 ? ' · Shorten this highlight before launching.' : '');
    counter.classList.toggle('over-limit', total > 100);
    $(`featured-${index}-summary`).setAttribute('aria-invalid', String(total > 100));
  });
  const issues = ForwardProfile.violations(readProfileFields(), featuredRoles);
  $('builderValidation').textContent = issues.length ? `${issues.length} field${issues.length === 1 ? ' needs' : 's need'} attention before launch. Your draft and original résumé stay saved.` : '';
  $('builderValidation').hidden = !issues.length;
}
function validateProfileForLaunch() {
  const issues = ForwardProfile.violations(readProfileFields(), featuredRoles);
  if (!issues.length) return true;
  showApplicantPage('builder');
  const key = issues[0].key;
  const field = key.startsWith('featured-') ? $(key) : $(profileFieldId(key));
  showBuilderStep(Number(field.closest('[data-builder-panel]').dataset.builderPanel), true);
  for (let parent = field.parentElement; parent; parent = parent.parentElement) {
    if (parent.tagName === 'DETAILS') parent.open = true;
  }
  updateWritingGuidance();
  field.focus();
  showToast(issues[0].message);
  return false;
}
function updateRoleSuggestions() {
  const suggestions = ForwardProfile.suggestRoles($('profileExperienceInput').value);
  for (let index = 0; index < 3; index++) {
    const select = $(`featured-${index}-suggestion`);
    if (!select) return;
    select.replaceChildren(new Option(suggestions.length ? 'Choose a role from your résumé…' : 'No role suggestions yet — add the details below', ''));
    suggestions.forEach((role, roleIndex) => select.add(new Option(`${role.title} · ${role.dates}`, String(roleIndex))));
    select.disabled = !suggestions.length;
  }
}
function fillFeaturedRole(index, role) {
  featuredRoles[index] = { ...role };
  ['title', 'dates', 'summary'].forEach(key => { $(`featured-${index}-${key}`).value = role[key]; });
  updateWritingGuidance();
  updateCandidatePreview();
  saveApplicantProfile();
}
function setupBuilder() {
  const builder = document.querySelector('#applicantWorkspace .build-card');
  const oldGrid = $('formPane').querySelector('.form-grid');
  const groups = Object.fromEntries(Object.keys(profileFieldNames).map(key => [key, $(profileFieldId(key)).parentElement]));
  const story = oldGrid.querySelector('.story-fields');
  const photo = oldGrid.querySelector('.profile-media');
  const preview = document.querySelector('.preview-card');
  const reference = document.querySelector('.reference-guide');
  const launch = document.querySelector('.launch-card');
  const privacy = document.querySelector('#applicantWorkspace .private-summary');
  const prompts = $('applicantDiscussion').parentElement;
  document.querySelector('.method-tabs').hidden = true;
  builder.querySelector('h3').textContent = 'Make this profile yours.';
  builder.querySelector('h3').nextElementSibling.textContent = 'Start with your résumé, then choose the experiences and stories you want people to see.';
  const steps = makeElement('nav', 'builder-steps');
  steps.setAttribute('aria-label', 'Profile building steps');
  builderSteps.forEach((label, index) => {
    const button = makeElement('button', '', `${index + 1}. ${label}`);
    button.type = 'button'; button.dataset.builderStep = index;
    button.addEventListener('click', () => showBuilderStep(index, true));
    steps.append(button);
  });
  const header = makeElement('div', 'builder-step-heading');
  header.innerHTML = '<p class="eyebrow" id="builderProgress"></p><h3 id="builderStepTitle" tabindex="-1"></h3><p class="help" id="builderPreviewNote" hidden>Check your public story. Email and phone stay in the private editor. Your attached résumé may include contact details and will be available to download in the hiring demo.</p><p id="builderValidation" class="form-validation" role="status" hidden></p>';
  const panels = builderSteps.map((label, index) => { const panel = makeElement('section', 'builder-panel'); panel.dataset.builderPanel = index; return panel; });
  const importBox = makeElement('details', 'import-sheet');
  importBox.open = !savedResumeFile;
  importBox.append(makeElement('summary', '', savedResumeFile ? 'Your résumé & import options' : 'Start with your résumé'));
  $('uploadPane').hidden = false;
  importBox.append($('uploadPane'));
  const basics = makeElement('div', 'form-grid');
  ['name', 'role', 'location', 'skills', 'summary'].forEach(key => basics.append(groups[key]));
  const contact = makeElement('details', 'editor-details');
  contact.append(makeElement('summary', '', 'Contact details & profile photo'));
  const contactGrid = makeElement('div', 'form-grid');
  contactGrid.append(groups.email, groups.phone, photo); contact.append(contactGrid);
  panels[0].append(importBox, basics, contact);
  panels[1].append(makeElement('p', 'section-lead', 'Choose up to three experiences that show your strengths, growth, and contribution. Think improved sales or service, stronger teams, a better process, or meaningful community work. One or two strong examples are welcome too.'));
  const featured = makeElement('div', 'featured-editors');
  for (let index = 0; index < 3; index++) {
    const card = makeElement('fieldset', 'featured-editor');
    card.innerHTML = `<legend>Featured role ${index + 1}</legend><label for="featured-${index}-suggestion">Choose an imported role (optional)</label><select id="featured-${index}-suggestion"></select><label for="featured-${index}-title">Role & organization</label><input id="featured-${index}-title" placeholder="e.g., Team lead · Neighborhood café"><label for="featured-${index}-dates">Dates</label><input id="featured-${index}-dates" placeholder="e.g., 2022–2025"><label for="featured-${index}-summary">What did you do, who benefited, and what changed?</label><textarea id="featured-${index}-summary" rows="4" aria-describedby="featured-${index}-count" placeholder="Share a specific contribution. Numbers are helpful when you have them, but are not required."></textarea><p class="word-count" id="featured-${index}-count"></p><button type="button" class="link-button clear-featured">Clear this highlight</button>`;
    ['title', 'dates', 'summary'].forEach(key => {
      const input = card.querySelector(`#featured-${index}-${key}`);
      input.value = featuredRoles[index][key];
      input.addEventListener('input', () => {
        featuredRoles[index][key] = input.value;
        updateWritingGuidance(); updateCandidatePreview(); saveApplicantProfile();
      });
    });
    card.querySelector('select').addEventListener('change', event => {
      if (event.target.value === '') return;
      const role = ForwardProfile.suggestRoles($('profileExperienceInput').value)[Number(event.target.value)];
      if (role) fillFeaturedRole(index, role);
    });
    card.querySelector('.clear-featured').addEventListener('click', () => {
      fillFeaturedRole(index, { title: '', dates: '', summary: '' });
      $(`featured-${index}-suggestion`).value = '';
    });
    const wrapper = makeElement('details', 'featured-wrapper');
    wrapper.open = index === 0;
    const summary = makeElement('summary');
    summary.id = `featured-${index}-heading`;
    wrapper.append(summary, card);
    featured.append(wrapper);
  }
  const full = makeElement('details', 'editor-details');
  full.append(makeElement('summary', '', 'Full work history, education & credentials'), makeElement('p', 'help', 'Your full history stays saved. Selecting three highlights does not remove other jobs or change your original résumé.'));
  full.append(groups.experience, groups.education, groups.credentials);
  panels[1].append(featured, full);
  story.querySelector('legend').textContent = 'The person behind the work';
  $('profileCommunityInput').previousElementSibling.textContent = 'Team culture, connection & community';
  $('profileCommunityInput').placeholder = 'A retreat, conference, team celebration, shared project, or community contribution. Share what felt meaningful to you.';
  panels[2].append(story);
  panels[3].append(privacy, prompts, makeElement('p', 'help', 'These answers start conversations. They never lower your position or disqualify you.'));
  const guide = makeElement('details', 'editor-details');
  guide.append(makeElement('summary', '', 'Need inspiration? View an example'), reference);
  panels[4].append(preview, guide, launch);
  $('formPane').replaceChildren(...panels);
  $('formPane').hidden = false;
  builder.insertBefore(steps, $('formPane'));
  builder.insertBefore(header, $('formPane'));
  const controls = makeElement('div', 'builder-controls');
  controls.innerHTML = '<button type="button" class="button secondary" id="builderBack">← Back</button><span class="help">Changes save automatically</span><button type="button" class="button primary" id="builderNext">Continue →</button>';
  builder.append(controls);
  $('builderBack').addEventListener('click', () => showBuilderStep(builderStep - 1, true));
  $('builderNext').addEventListener('click', () => showBuilderStep(builderStep + 1, true));
  const oldAside = document.querySelector('#applicantWorkspace .candidate-layout > aside');
  if (oldAside) oldAside.hidden = true;
  const workspaceHeading = document.querySelector('#applicantWorkspace .workspace-head h2');
  workspaceHeading.textContent = 'Your story. Your way.';
  Object.entries(ForwardProfile.limits).forEach(([key]) => {
    const input = $(profileFieldId(key));
    const counter = makeElement('p', 'word-count');
    counter.id = 'count-' + key;
    input.setAttribute('aria-describedby', counter.id);
    input.insertAdjacentElement('afterend', counter);
  });
  updateRoleSuggestions();
  showBuilderStep(builderStep);
}
function setupWelcome() {
  const stages = makeElement('div', 'intro-stages');
  stages.setAttribute('aria-hidden', 'true');
  stages.innerHTML = '<span>Your experience.</span><span>Your impact.</span><span>Your way Forward.</span>';
  $('enterExperience').insertAdjacentElement('beforebegin', stages);
  const welcome = makeElement('section', 'welcome-overlay');
  welcome.id = 'welcomeOverlay'; welcome.hidden = true;
  welcome.setAttribute('role', 'dialog'); welcome.setAttribute('aria-modal', 'true'); welcome.setAttribute('aria-labelledby', 'welcomeTitle');
  welcome.innerHTML = `<div class="welcome-card"><button id="welcomeClose" class="welcome-close" aria-label="Close welcome" type="button" hidden>×</button><p class="eyebrow">WELCOME TO A NEW WAY FORWARD</p><h1 id="welcomeTitle" tabindex="-1">Your experience matters.<br><em>So does the person behind it.</em></h1><p class="welcome-lead">Bring your work, values, and contributions into the same conversation. Discover people and teams with room for different ways of working.</p><p class="welcome-prompt">What would you like people to see? Try a card.</p><div class="welcome-choices"><button type="button" data-welcome="impact" aria-pressed="true">My impact <span>What changed because of me</span></button><button type="button" data-welcome="values" aria-pressed="false">My values <span>What gives my work meaning</span></button><button type="button" data-welcome="growth" aria-pressed="false">My growth <span>How I keep moving forward</span></button><button type="button" data-welcome="team" aria-pressed="false">My team connections <span>How I support people</span></button></div><div class="welcome-example" aria-live="polite"><span class="eyebrow">A STORY YOU COULD SHARE</span><p id="welcomeExample">“I improved our handover process so customers received help sooner and colleagues had clearer next steps.”</p></div><div class="welcome-footer"><span>New standards. A way Forward.</span><button type="button" class="button primary" id="welcomeContinue" disabled>Explore Forward →</button></div></div>`;
  $('siteShell').insertAdjacentElement('beforebegin', welcome);
  const examples = { impact: '“I improved our handover process so customers received help sooner and colleagues had clearer next steps.”', values: '“I care about making complicated information easier to understand, especially for people asking for help.”', growth: '“I learned a new system, helped my team adopt it, and grew more confident leading a project.”', team: '“I helped organize a team retreat where colleagues could exchange ideas and get to know one another.”' };
  welcome.querySelectorAll('[data-welcome]').forEach(button => button.addEventListener('click', () => {
    welcome.querySelectorAll('[data-welcome]').forEach(choice => choice.setAttribute('aria-pressed', String(choice === button)));
    $('welcomeExample').textContent = examples[button.dataset.welcome];
  }));
  $('welcomeClose').addEventListener('click', closeWelcome);
  $('welcomeContinue').addEventListener('click', closeWelcome);
  $('pauseIntro').addEventListener('click', toggleIntroPlayback);
  document.addEventListener('keydown', event => {
    if (welcome.hidden) return;
    if (event.key === 'Escape') { event.preventDefault(); closeWelcome(); }
    if (event.key === 'Tab') {
      const focusable = [...welcome.querySelectorAll('button:not([disabled]), a[href], [tabindex="0"]')].filter(node => !node.hidden);
      const first = focusable[0], last = focusable.at(-1);
      if (event.shiftKey && (document.activeElement === first || document.activeElement === $('welcomeTitle'))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
}
function setupNavigationAndPages() {
  const nav = document.querySelector('nav.nav');
  nav.setAttribute('aria-label', 'Forward navigation');
  const brand = nav.querySelector('.brand');
  const home = makeElement('button', 'brand', 'Forward');
  home.type = 'button'; home.dataset.route = 'home'; home.setAttribute('aria-label', 'Forward home');
  brand.replaceWith(home);
  const navigation = makeElement('div', 'main-navigation');
  ['home', 'discover', 'connections', 'messages', 'profile'].forEach(page => {
    const button = makeElement('button');
    button.type = 'button'; button.dataset.route = page;
    button.innerHTML = navigationIcon(page) + `<span>${page[0].toUpperCase() + page.slice(1)}</span>`;
    navigation.append(button);
  });
  nav.insertBefore(navigation, nav.querySelector('.role-status'));
  $('changeRole').textContent = 'Switch role';
  const homePage = makeElement('main', 'workspace forward-home');
  homePage.id = 'forwardHome'; homePage.hidden = true;
  homePage.innerHTML = `<section class="home-feature"><div class="home-feature-copy"><p class="eyebrow" id="homeRoleLabel"></p><h1 id="homeGreeting" tabindex="-1">A new way to move Forward.</h1><p>Experience opens the door.<br>Your story starts the conversation.</p><div id="homeRoleChoices" class="home-role-choices"><button class="button primary" type="button" data-choose-role="applicant">I'm an applicant →</button><button class="button secondary" type="button" data-choose-role="hiring">I'm hiring →</button></div><div id="homeWorkspaceActions" hidden><button id="homePrimary" class="button primary" type="button" data-route="profile">Build my profile →</button><button class="button text-button" type="button" data-route="connections">My connections</button></div></div><div class="home-visual" aria-hidden="true"><div class="visual-orbit orbit-one"></div><div class="visual-orbit orbit-two"></div><div class="story-token token-work">The work I do <span>EXPERIENCE</span></div><div class="story-token token-care">The people I support <span>CONNECTION</span></div><div class="story-token token-why">The reason I care <span>PURPOSE</span></div><div class="forward-mark">f<span>↗</span></div></div></section><section class="home-bottom"><article class="card home-progress-card"><p class="eyebrow">MAKE YOUR NEXT MOVE</p><h2>A little more you.</h2><p id="homeProgressCopy"></p><progress id="homeProgress" max="4" value="0" aria-label="Profile foundations added"></progress><button type="button" class="link-button" data-route="profile">Open my workspace →</button></article><article class="card principle-card"><span class="principle-number">01</span><h3>Show what you've contributed.</h3><p>Choose the experiences that reflect your growth and impact, whatever the job title.</p></article><article class="card principle-card"><span class="principle-number">02</span><h3>Get curious about differences.</h3><p>Working preferences lead to useful questions and possible agreements. They never rule someone out.</p></article></section>`;
  const connectionsPage = makeElement('main', 'workspace');
  connectionsPage.id = 'forwardConnections'; connectionsPage.hidden = true;
  connectionsPage.innerHTML = '<div class="page-heading"><p class="eyebrow">CONNECTIONS</p><h1>People worth a conversation.</h1><p>Keep track of interest and thoughtful feedback in this demo.</p></div>';
  connectionsPage.append(document.querySelector('#hiringWorkspace .lists'));
  const messagesPage = makeElement('main', 'workspace');
  messagesPage.id = 'forwardMessages'; messagesPage.hidden = true;
  messagesPage.innerHTML = '<div class="page-heading"><p class="eyebrow">MESSAGES</p><h1>Keep the conversation going.</h1><p>Demo conversations stay on this device and do not send messages to real people.</p></div><section id="forwardInbox" class="card inbox-card"></section>';
  const discovery = makeElement('main', 'workspace');
  discovery.id = 'teamDiscovery'; discovery.hidden = true;
  $('siteShell').insertBefore(homePage, $('applicantWorkspace'));
  $('siteShell').insertBefore(connectionsPage, $('roleModal'));
  $('siteShell').insertBefore(messagesPage, $('roleModal'));
  $('siteShell').insertBefore(discovery, $('roleModal'));
  document.addEventListener('click', event => {
    const route = event.target.closest('[data-route]');
    if (route) navigateForward(route.dataset.route);
    const role = event.target.closest('[data-choose-role]');
    if (role) setRole(role.dataset.chooseRole);
  });
  const footer = makeElement('footer', 'demo-footer');
  footer.textContent = 'Forward · Class demonstration · Profiles and résumé downloads stay in this browser. Other devices cannot access them yet.';
  $('siteShell').append(footer);
  setNavigation('home');
}
function initializeForwardUI() {
  setupNavigationAndPages();
  setupWelcome();
  setupBuilder();
  setupWorkOnboarding();
  setupTeamDiscovery();
  import('./accounts/entry.mjs?v=public-signup-1').then(module => module.addAccountEntry()).catch(() => {});
  const conversation = makeElement('details', 'card profile-conversation');
  conversation.append(makeElement('summary', '', 'Prepare for a conversation about how you work'), $('applicantLiveDiscussion'));
  document.querySelector('#applicantLivePage .applicant-hub-grid').insertAdjacentElement('afterend', conversation);
  [['appCareer', 'appResume'], ['detailCareer', 'detailResume'], ['feedbackName', 'feedbackResume']].forEach(([anchor, id]) => {
    const box = makeElement('section', 'resume-review-callout'); box.id = id;
    (id === 'feedbackResume' ? $(anchor).parentElement : $(anchor)).insertAdjacentElement('afterend', box);
  });
  const complete = makeElement('div', 'review-complete');
  complete.innerHTML = '<h3>You are all caught up.</h3><p>Every applicant in this demo has been reviewed. Your connections and notes are in Connections.</p>';
  $('reviewCard').append(complete);
  const shortcut = makeElement('button', 'button secondary', 'Review my uploaded profile'); shortcut.type = 'button'; shortcut.id = 'reviewOwnProfile';
  shortcut.addEventListener('click', reviewLocalApplicant);
  document.querySelector('#hiringWorkspace .workspace-head').append(shortcut);
  document.querySelector('#hiringWorkspace .workspace-head h2').textContent = 'Meet the person behind the profile.';
  $('passButton').textContent = 'Not now';
  $('yesButton').textContent = 'Connect →';
  document.querySelector('#reviewCard .hint').textContent = 'Read their story. Start a conversation.';
  $('feedbackReason').options[0].textContent = 'A required qualification needs discussion';
  document.querySelectorAll('.impact-tile b').forEach(label => { if (label.textContent === 'Community impact') label.textContent = 'Culture & community'; });
}
function reviewLocalApplicant() {
  if (isAdvancing) return;
  const person = getInteractiveApplicant();
  if (!person) { showToast('Switch to Applicant and launch a complete profile first.'); return; }
  syncInteractiveApplicant();
  const index = rankedApplicants.findIndex(item => item.id === person.id);
  if (index < currentIndex) { rankedApplicants.splice(index, 1); currentIndex--; }
  else rankedApplicants.splice(index, 1);
  rankedApplicants.splice(currentIndex, 0, person);
  renderApplicantCard();
}
