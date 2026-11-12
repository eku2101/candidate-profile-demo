// The original work-preference questions, organized into a guided onboarding flow.
const onboardingFlows = {};
let activeOnboarding = null;
const preferenceSuffixes = ['Focus', 'Brainstorming', 'Communication', 'CheckIns', 'Rhythm', 'Environment'];

function onboardingComplete(role) {
  return role === 'applicant' ? applicantQuizComplete : hiringQuizComplete;
}
function showOnboardingStep(role, step, focus = true) {
  const flow = onboardingFlows[role];
  flow.step = Math.max(0, Math.min(step, flow.panels.length - 1));
  flow.panels.forEach((panel, index) => { panel.hidden = index !== flow.step; });
  flow.markers.forEach((marker, index) => {
    marker.classList.toggle('selected', index === flow.step);
    marker.classList.toggle('completed', index < flow.step);
    if (index === flow.step) marker.setAttribute('aria-current', 'step');
    else marker.removeAttribute('aria-current');
  });
  flow.progress.textContent = `Step ${flow.step + 1} of ${flow.panels.length}`;
  flow.back.disabled = flow.step === 0;
  flow.next.hidden = flow.step === flow.panels.length - 1;
  flow.submit.hidden = !flow.next.hidden;
  flow.error.hidden = true;
  if (focus) {
    flow.panels[flow.step].querySelector('h3').focus();
    flow.dialog.scrollTop = 0;
  }
}
function validateOnboarding(role, all = false) {
  const flow = onboardingFlows[role];
  const panels = all ? flow.panels : [flow.panels[flow.step]];
  for (const panel of panels) {
    const invalid = [...panel.querySelectorAll('select, input')].find(field => !field.checkValidity());
    if (!invalid) continue;
    showOnboardingStep(role, flow.panels.indexOf(panel), false);
    flow.error.textContent = 'Choose an answer to each question before continuing. There is no ideal answer.';
    flow.error.hidden = false;
    invalid.focus();
    invalid.reportValidity();
    return false;
  }
  return true;
}
function submitOnboarding(role) {
  const flow = onboardingFlows[role];
  if (flow.step < flow.panels.length - 1) {
    if (validateOnboarding(role)) showOnboardingStep(role, flow.step + 1);
    return false;
  }
  return validateOnboarding(role, true);
}
function openWorkOnboarding(role, fromRoleChoice = false) {
  const flow = onboardingFlows[role];
  activeOnboarding = { role, fromRoleChoice, returnFocus: document.activeElement };
  const complete = onboardingComplete(role);
  if (complete) {
    const answers = role === 'applicant' ? applicantPreferences : hiringCriteria;
    [...preferenceSuffixes, ...(role === 'hiring' ? ['Experience'] : [])].forEach(suffix => {
      const key = suffix[0].toLowerCase() + suffix.slice(1);
      $(role + suffix).value = answers[key] || '';
    });
  }
  flow.exit.textContent = complete ? 'Close questionnaire' : '← Change role';
  flow.submit.textContent = fromRoleChoice
    ? (role === 'applicant' ? 'Save & open my profile →' : 'Save & discover applicants →')
    : 'Save preferences →';
  flow.savedNote.hidden = !complete;
  $(role + 'QuizModal').hidden = false;
  $('siteShell').inert = true;
  $('siteShell').setAttribute('aria-hidden', 'true');
  document.body.classList.add('onboarding-active');
  showOnboardingStep(role, 0);
}
function closeWorkOnboarding() {
  if (!activeOnboarding) return;
  const { role, returnFocus } = activeOnboarding;
  $(role + 'QuizModal').hidden = true;
  $('siteShell').inert = false;
  $('siteShell').removeAttribute('aria-hidden');
  document.body.classList.remove('onboarding-active');
  activeOnboarding = null;
  if (returnFocus?.isConnected && !returnFocus.closest('[hidden]')) returnFocus.focus();
}
function leaveWorkOnboarding() {
  if (!activeOnboarding) return;
  const complete = onboardingComplete(activeOnboarding.role);
  closeWorkOnboarding();
  if (!complete) showRoleChooser();
}
function finishWorkOnboarding(role) {
  const entering = activeOnboarding?.fromRoleChoice;
  closeWorkOnboarding();
  renderForwardHome();
  renderApplicantPrivacyStatus();
  renderRoleBrief();
  if (entering) {
    if (role === 'hiring') navigateForward(hasPublishedTeam() ? 'discover' : 'profile');
    else {
      showApplicantPage(applicantLaunched ? 'hub' : 'builder');
      if (!applicantLaunched) showBuilderStep(0, true);
    }
  } else if (role === 'hiring' && forwardPage === 'discover') renderApplicantCard();
}
function renderHomeQuestionnaire() {
  const host = $('homeQuestionnaire');
  if (!host) return;
  host.hidden = !activeRole;
  if (!activeRole) return;
  const complete = onboardingComplete(activeRole);
  $('homeQuestionnaireTitle').textContent = activeRole === 'hiring' ? 'Your team’s way of working.' : 'Your way of working matters.';
  $('homeQuestionnaireStatus').textContent = complete ? 'Questionnaire complete' : 'Start your questionnaire';
  $('homeQuestionnaireCopy').textContent = activeRole === 'hiring'
    ? 'Your role brief connects applicant experience with what the team needs. Publish your hiring profile to let applicants see your team’s answers, too.'
    : 'Your answers help you and hiring managers explore working together. Keep them up to date as your needs change.';
  $('homeQuestionnaireButton').textContent = complete ? 'Review my answers →' : 'Complete questionnaire →';
}
function setupWorkOnboarding() {
  const commonSteps = [
    { title: 'Focus & collaboration', copy: 'Quiet work and shared ideas can both belong in a great working day.', fields: ['Focus', 'Brainstorming'] },
    { title: 'Communication & connection', copy: 'Think about how you share updates and stay connected with your team.', fields: ['Communication', 'CheckIns'] },
    { title: 'Pace & environment', copy: 'Consider the rhythm and setting that support your work.', fields: ['Rhythm', 'Environment'] }
  ];
  for (const role of ['applicant', 'hiring']) {
    const modal = $(role + 'QuizModal');
    modal.classList.add('onboarding-overlay');
    // Keep this modal outside the inert app shell so its controls remain accessible.
    $('siteShell').insertAdjacentElement('beforebegin', modal);
    const dialog = modal.querySelector('.dialog');
    dialog.classList.add('onboarding-dialog');
    const form = $(role + 'QuizForm');
    form.noValidate = true; // Validate the visible step; reveal any invalid earlier step before focusing it.
    const steps = role === 'hiring' ? [{ title: 'Your hiring context', copy: 'Start with the role you are filling and the team behind it.', fields: ['Experience', 'TeamName'] }, ...commonSteps] : commonSteps;
    const fields = Object.fromEntries(steps.flatMap(step => step.fields).map(suffix => [suffix, $(role + suffix).parentElement]));
    const privacy = dialog.querySelector('.privacy-notice');
    const privacyDetails = makeElement('details', 'onboarding-privacy');
    privacyDetails.append(makeElement('summary', '', 'How your answers are used'), privacy);
    const exit = makeElement('button', 'link-button onboarding-exit', '← Change role');
    exit.type = 'button'; exit.id = role + 'OnboardingExit';
    exit.addEventListener('click', leaveWorkOnboarding);
    dialog.prepend(exit);
    dialog.querySelector('.eyebrow').textContent = role === 'applicant' ? 'GET STARTED · YOUR WORK PREFERENCES' : 'GET STARTED · YOUR HIRING BRIEF';
    const savedNote = makeElement('p', 'onboarding-saved', 'Your previous answers are filled in. Review or update them, then save to continue.');
    savedNote.hidden = true;
    form.insertAdjacentElement('beforebegin', savedNote);
    const layout = makeElement('div', 'onboarding-layout');
    const side = makeElement('aside', 'onboarding-side');
    const progress = makeElement('p', 'eyebrow');
    progress.setAttribute('aria-live', 'polite');
    const list = makeElement('ol', 'onboarding-steps');
    const markers = steps.map(step => { const item = makeElement('li', '', step.title); list.append(item); return item; });
    side.append(progress, list, makeElement('p', 'onboarding-note', 'A starting point for conversation. Different preferences never disqualify someone.'));
    const main = makeElement('div', 'onboarding-main');
    const panels = steps.map((step, index) => {
      const panel = makeElement('section', 'onboarding-panel');
      panel.hidden = index > 0;
      const title = makeElement('h3', '', step.title);
      title.id = role + 'OnboardingStep' + index; title.tabIndex = -1;
      panel.setAttribute('aria-labelledby', title.id);
      const grid = makeElement('div', 'question-grid');
      for (const suffix of step.fields) {
        fields[suffix].classList.add('onboarding-question');
        fields[suffix].classList.remove('full');
        grid.append(fields[suffix]);
      }
      panel.append(title, makeElement('p', 'help', step.copy), grid);
      main.append(panel); return panel;
    });
    const error = makeElement('p', 'form-validation'); error.hidden = true; error.setAttribute('role', 'alert');
    const actions = makeElement('div', 'onboarding-actions');
    const back = makeElement('button', 'button secondary', '← Back'); back.type = 'button'; back.id = role + 'OnboardingBack';
    const next = makeElement('button', 'button primary', 'Continue →'); next.type = 'button'; next.id = role + 'OnboardingNext';
    const submit = form.querySelector('[type=submit]'); submit.className = 'button primary'; submit.id = role + 'OnboardingSave';
    actions.append(back, next, submit);
    main.append(error, actions, privacyDetails);
    layout.append(side, main);
    form.replaceChildren(layout);
    onboardingFlows[role] = { step: 0, panels, markers, progress, back, next, submit, error, dialog, exit, savedNote };
    back.addEventListener('click', () => showOnboardingStep(role, onboardingFlows[role].step - 1));
    next.addEventListener('click', () => { if (validateOnboarding(role)) showOnboardingStep(role, onboardingFlows[role].step + 1); });
    showOnboardingStep(role, 0, false);
  }
  const card = makeElement('section', 'card home-questionnaire'); card.id = 'homeQuestionnaire'; card.hidden = true;
  card.innerHTML = '<div><p class="eyebrow" id="homeQuestionnaireStatus"></p><h2 id="homeQuestionnaireTitle"></h2><p id="homeQuestionnaireCopy"></p><p class="questionnaire-topics">Focus · Brainstorming · Communication · Check-ins · Rhythm · Environment</p></div><button type="button" class="button secondary" id="homeQuestionnaireButton">Review my answers →</button>';
  $('forwardHome').querySelector('.home-feature').insertAdjacentElement('afterend', card);
  $('homeQuestionnaireButton').addEventListener('click', () => openWorkOnboarding(activeRole));
  document.addEventListener('keydown', event => {
    if (!activeOnboarding) return;
    if (event.key === 'Escape') { event.preventDefault(); leaveWorkOnboarding(); }
    if (event.key !== 'Tab' || !activeOnboarding) return;
    const flow = onboardingFlows[activeOnboarding.role];
    const items = [...flow.dialog.querySelectorAll('button:not([disabled]), select, input, summary')].filter(node => !node.closest('[hidden]'));
    const first = items[0], last = items.at(-1);
    if (event.shiftKey && (document.activeElement === first || document.activeElement.tagName === 'H3')) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
}
