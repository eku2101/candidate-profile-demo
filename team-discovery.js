const hiringStorageKey = 'forward-hiring-profile-v1';
let hiringProfileState = ForwardTeams.restore(null);
let teamChoices = {};
let selectedTeamProfile = null;
let teamProfileReturn = 'discover';

function teamButton(text, className, action) {
  const button = makeElement('button', 'button ' + className, text);
  button.type = 'button'; button.addEventListener('click', action); return button;
}
function hasPublishedTeam() { return Boolean(hiringProfileState.published); }
function writeHiringState(next) {
  try {
    localStorage.setItem(hiringStorageKey, JSON.stringify(next));
    hiringProfileState = next;
    if ($('hiringSaveStatus')) $('hiringSaveStatus').textContent = 'Saved in this browser. Other devices cannot access this profile yet.';
    return true;
  } catch {
    if ($('hiringSaveStatus')) $('hiringSaveStatus').textContent = 'Could not save in this browser. Keep this tab open and try Save draft again.';
    return false;
  }
}
function saveHiringBrief() {
  hiringProfileState.answers = ForwardTeams.normalizeAnswers(hiringCriteria);
  hiringProfileState.questionnaireComplete = hiringQuizComplete;
  hiringProfileState.teamName = $('hiringTeamName').value.trim();
  const saved = writeHiringState(hiringProfileState);
  renderHiringProfileStatus();
  return saved;
}
function readHiringDraft() {
  return Object.fromEntries(Object.keys(ForwardTeams.fields).map(key => [key, $('team-' + key).value]));
}
function saveHiringDraft() {
  hiringProfileState.draft = readHiringDraft();
  const saved = writeHiringState(hiringProfileState);
  renderHiringProfileStatus();
  return saved;
}
function renderTeamAnswers(host, answers, compare = false) {
  host.replaceChildren();
  discussionTopics.forEach(topic => {
    const card = makeElement('div', 'team-answer');
    const answer = ForwardTeams.answerOptions[topic.key][answers?.[topic.key]] || 'Not answered yet';
    card.append(makeElement('h4', '', topic.title), makeElement('p', '', answer));
    if (compare && applicantQuizComplete) {
      const mine = ForwardTeams.answerOptions[topic.key][applicantPreferences[topic.key]] || 'Not answered';
      card.append(makeElement('p', 'your-answer', 'Your preference: ' + mine));
    }
    host.append(card);
  });
}
function renderHiringProfileStatus() {
  if (!$('hiringPublishStatus')) return;
  const published = hiringProfileState.published;
  $('hiringPublishStatus').textContent = published
    ? 'Your profile is available in the applicant demo. Publish changes to update what applicants see.'
    : 'Draft · Applicants will see your profile and team answers after you publish in this demo.';
  $('publishHiringProfile').textContent = published ? 'Publish profile changes →' : 'Publish profile & role →';
  $('withdrawHiringProfile').hidden = !published;
  $('hiringQuestionnaireStatus').textContent = hiringQuizComplete ? 'Questionnaire complete · These answers will be included when you publish.' : 'Complete your questionnaire before publishing.';
  renderTeamAnswers($('hiringAnswersPreview'), hiringCriteria);
  Object.entries(ForwardTeams.fields).forEach(([key, rule]) => {
    const total = ForwardProfile.count($('team-' + key).value, rule.words ? 'words' : 'characters');
    const counter = $('team-count-' + key);
    counter.textContent = `${total} / ${rule.max} ${rule.words ? 'words' : 'characters'}`;
    counter.classList.toggle('over-limit', total > rule.max);
    $('team-' + key).setAttribute('aria-invalid', String(total > rule.max));
  });
}
function publishHiringProfile() {
  const draft = readHiringDraft();
  const issues = ForwardTeams.issues(draft, hiringCriteria);
  if (issues.length || !hiringQuizComplete) {
    const issue = issues[0] || { key: 'answers', message: 'Complete your team questionnaire before publishing.' };
    $('hiringProfileErrors').textContent = issue.message;
    $('hiringProfileErrors').hidden = false;
    if (issue.key === 'answers') openHiringQuiz();
    else $('team-' + issue.key).focus();
    return;
  }
  const next = { ...hiringProfileState, draft, answers: ForwardTeams.normalizeAnswers(hiringCriteria), questionnaireComplete: true,
    published: ForwardTeams.publish(draft, hiringCriteria) };
  if (!writeHiringState(next)) return;
  $('hiringProfileErrors').hidden = true;
  renderHiringProfileStatus();
  showToast('Hiring profile and team answers published in this browser demo. Applicants can find them in Discover.');
}
function findTeam(id) { return ForwardTeams.listings(hiringProfileState).find(team => team.id === id); }
function teamChoice(id) { return teamChoices[id] || { saved: false, interested: false }; }
function setTeamChoice(id, type) {
  const team = findTeam(id);
  if (!team || activeRole !== 'applicant') return;
  const choice = teamChoice(id);
  if (type === 'interested' && !choice.interested && !getInteractiveApplicant()) {
    navigateForward('profile');
    showToast('Launch your applicant profile before expressing interest. You can save the role while you build it.');
    return;
  }
  teamChoices[id] = { ...choice, [type]: !choice[type] };
  if (type === 'interested' && teamChoices[id].interested) teamChoices[id].saved = true;
  if (selectedTeamProfile?.id === id && !$('teamDetailPage').hidden) {
    renderTeamProfile(team);
    $('team-' + type + '-action').focus();
  } else if (!$('teamDiscovery').hidden) renderJobDiscovery();
  if (!$('forwardConnections').hidden) renderTeamConnections();
  showToast(type === 'saved' ? (teamChoices[id].saved ? 'Role saved for this visit.' : 'Role removed from your saved list.')
    : teamChoices[id].interested ? 'Interest noted in this browser demo. No application or message was sent.' : 'Interest withdrawn in this demo.');
}
function makeJobCard(team) {
  const card = makeElement('article', 'card job-card');
  card.append(makeElement('p', 'eyebrow', team.sample ? 'FICTIONAL EXAMPLE · NOT AN OPEN JOB' : 'SHARED IN THIS BROWSER DEMO'));
  card.append(makeElement('h2', '', team.roleTitle), makeElement('p', 'job-company', team.company), makeElement('p', 'job-meta', [team.location, team.employmentType].filter(Boolean).join(' · ')));
  card.append(makeElement('p', 'job-description', team.roleSummary));
  const manager = makeElement('div', 'job-manager');
  manager.append(makeElement('span', 'manager-initials', initials(team.managerName)), makeElement('div', '', team.managerName + (team.managerTitle ? ' · ' + team.managerTitle : '')));
  card.append(manager);
  const actions = makeElement('div', 'job-actions');
  actions.append(teamButton('Meet the manager & view role →', 'primary', () => openTeamProfile(team.id)));
  const save = teamButton(teamChoice(team.id).saved ? 'Saved ✓' : 'Save role', 'secondary', () => setTeamChoice(team.id, 'saved'));
  save.setAttribute('aria-pressed', String(teamChoice(team.id).saved)); actions.append(save); card.append(actions);
  return card;
}
function renderJobDiscovery() {
  if (!$('jobGrid')) return;
  const list = ForwardTeams.search(ForwardTeams.listings(hiringProfileState), $('jobSearch').value);
  $('jobCount').textContent = `${list.length} ${list.length === 1 ? 'role' : 'roles'} to explore`;
  $('jobGrid').replaceChildren(...list.map(makeJobCard));
  $('jobEmpty').hidden = list.length > 0;
}
function openTeamProfile(id, preview = false) {
  const team = preview ? { id: 'preview', ...readHiringDraft(), answers: ForwardTeams.normalizeAnswers(hiringCriteria), sample: false, preview: true } : findTeam(id);
  if (!team) { showToast('This team profile is no longer shared.'); return; }
  teamProfileReturn = preview ? 'profile' : forwardPage === 'connections' ? 'connections' : 'discover';
  hideForwardPages(); $('teamDetailPage').hidden = false;
  setNavigation(preview ? 'profile' : 'discover');
  selectedTeamProfile = team;
  renderTeamProfile(team);
  window.scrollTo({ top: 0, behavior: 'instant' });
  $('teamProfileTitle').focus();
}
function renderTeamProfile(team) {
  selectedTeamProfile = team;
  const host = $('teamProfileContent'); host.replaceChildren();
  const hero = makeElement('section', 'card manager-profile-hero');
  const text = makeElement('div');
  text.append(makeElement('p', 'eyebrow', team.preview ? 'APPLICANT VIEW · DRAFT PREVIEW' : team.sample ? 'FICTIONAL MANAGER & ROLE · DEMONSTRATION' : 'HIRING PROFILE · SHARED IN THIS BROWSER'));
  const title = makeElement('h1', '', team.managerName || 'Your name'); title.id = 'teamProfileTitle'; title.tabIndex = -1;
  text.append(title, makeElement('p', 'manager-title', [team.managerTitle, team.company].filter(Boolean).join(' · ') || 'Your role & team'));
  text.append(makeElement('p', 'manager-bio', team.managerBio || 'Introduce yourself and how you support the people you work with.'));
  hero.append(makeElement('div', 'manager-portrait', initials(team.managerName)), text); host.append(hero);
  const columns = makeElement('div', 'team-profile-columns');
  const job = makeElement('section', 'card team-story');
  job.append(makeElement('p', 'eyebrow', 'THE OPPORTUNITY'), makeElement('h2', '', team.roleTitle || 'Your job title'));
  job.append(makeElement('p', 'job-meta', [team.location, team.employmentType, ForwardTeams.answerOptions.experience[team.answers.experience]].filter(Boolean).join(' · ')));
  job.append(makeElement('p', '', team.roleSummary || 'Describe the work and the contribution someone could make.'));
  const culture = makeElement('section', 'card team-story');
  culture.append(makeElement('p', 'eyebrow', 'THE PEOPLE BEHIND THE WORK'), makeElement('h2', '', 'Culture, support & connection'), makeElement('p', '', team.teamStory || 'This team has not added a culture story yet. Ask the manager what support and connection look like in practice.'));
  columns.append(job, culture); host.append(columns);
  const answers = makeElement('section', 'card shared-answers');
  answers.append(makeElement('p', 'eyebrow', 'THE TEAM’S QUESTIONNAIRE'), makeElement('h2', '', 'How this team works'), makeElement('p', 'muted-copy', 'The manager shares these answers so you can decide what to explore together. Different preferences are conversation starters.'));
  const answerGrid = makeElement('div', 'team-answer-grid');
  renderTeamAnswers(answerGrid, team.answers, activeRole === 'applicant'); answers.append(answerGrid);
  if (activeRole === 'applicant') answers.append(makeElement('p', 'help', '“Your preference” is shown only to you here. Your individual answers remain off your public applicant profile.'));
  host.append(answers);
  if (!team.preview && activeRole === 'applicant') {
    const prompts = makeElement('section', 'card team-profile-prompts'); const panel = makeElement('div'); panel.id = 'selectedTeamDiscussion'; prompts.append(panel); host.append(prompts);
    renderDiscussionPanel(panel.id, 'applicant', applicantPreferences, team.answers, `Questions to explore with ${team.managerName} at ${team.company}. Nothing is sent automatically.`);
    const actions = makeElement('section', 'card team-choice-actions');
    const choice = teamChoice(team.id);
    const save = teamButton(choice.saved ? 'Saved ✓' : 'Save role', 'secondary', () => setTeamChoice(team.id, 'saved')); save.id = 'team-saved-action'; save.setAttribute('aria-pressed', String(choice.saved));
    const interest = teamButton(choice.interested ? 'Withdraw interest' : 'I’m interested →', 'primary', () => setTeamChoice(team.id, 'interested')); interest.id = 'team-interested-action';
    actions.append(save, interest, makeElement('p', 'help', choice.interested ? 'Interest noted for this visit. No application or message has been sent.' : 'Choose the roles and teams you want to explore. Saved roles and interest last for this visit.'));
    host.append(actions);
  }
}
function renderTeamConnections() {
  const host = $('teamConnections'); if (!host) return; host.replaceChildren();
  if (activeRole === 'applicant') {
    host.append(makeElement('h2', '', 'Roles & teams you chose'), makeElement('p', 'muted-copy', 'Your saved roles and interest for this visit. Examples do not send applications or contact real people.'));
    const chosen = ForwardTeams.listings(hiringProfileState).filter(team => teamChoice(team.id).saved || teamChoice(team.id).interested);
    if (!chosen.length) host.append(makeElement('p', 'empty', 'Explore Discover to save a role or express interest in a team.'));
    chosen.forEach(team => {
      const row = makeElement('div', 'chosen-team-row'); const copy = makeElement('div'); const choice = teamChoice(team.id);
      copy.append(makeElement('strong', '', team.roleTitle + ' · ' + team.company));
      const mutual = team.id === 'local-team' && choice.interested && connections.avery?.fromHiring;
      copy.append(makeElement('p', '', mutual ? 'Both sides expressed interest in this demo.' : choice.interested ? 'You expressed interest · demo' : 'Saved for this visit'));
      row.append(copy, teamButton('View manager & role', 'secondary', () => openTeamProfile(team.id))); host.append(row);
    });
  } else {
    host.append(makeElement('h2', '', 'Applicants interested in your role'));
    const person = getInteractiveApplicant();
    if (hasPublishedTeam() && teamChoice('local-team').interested && person) {
      const row = makeElement('div', 'chosen-team-row'); const copy = makeElement('div');
      copy.append(makeElement('strong', '', person.name), makeElement('p', '', 'Interested in ' + hiringProfileState.published.roleTitle + ' · same-browser demonstration'));
      row.append(copy, teamButton('Review applicant →', 'primary', () => { navigateForward('discover'); reviewLocalApplicant(); })); host.append(row);
    } else host.append(makeElement('p', 'empty', 'Publish your profile and role, then switch to Applicant to try expressing interest. Local interest appears here.'));
  }
}
function setupTeamDiscovery() {
  const discovery = $('teamDiscovery');
  discovery.innerHTML = '<div class="page-heading"><p class="eyebrow">DISCOVER · JOBS & PEOPLE</p><h1>Choose your next team, too.</h1><p>Explore the work, meet the manager, and see how the team operates before deciding what feels worth a conversation.</p></div><div class="discovery-note">These are fictional examples plus any hiring profile published in this browser. They are not verified job vacancies.</div><div class="job-search"><label for="jobSearch">Search roles, teams, managers, or locations</label><input type="search" id="jobSearch" placeholder="Try design, community, or remote" /><p id="jobCount" role="status"></p></div><div id="jobGrid" class="job-grid"></div><p id="jobEmpty" class="empty" hidden>No roles match that search. Try another word or clear the search.</p>';
  $('jobSearch').addEventListener('input', renderJobDiscovery);
  const detail = makeElement('main', 'workspace team-detail-page'); detail.id = 'teamDetailPage'; detail.hidden = true;
  const back = teamButton('← Back', 'text-button', () => navigateForward(teamProfileReturn)); back.id = 'backFromTeamProfile';
  const content = makeElement('div'); content.id = 'teamProfileContent'; detail.append(back, content); $('siteShell').insertBefore(detail, $('roleModal'));
  const editor = makeElement('main', 'workspace'); editor.id = 'hiringProfilePage'; editor.hidden = true;
  editor.innerHTML = '<div class="page-heading"><p class="eyebrow">YOUR HIRING PROFILE</p><h1>Let applicants meet you, too.</h1><p>Share the person, team, and opportunity behind the hiring process.</p></div><section class="card hiring-profile-editor"><p id="hiringPublishStatus" class="hiring-publish-status" role="status"></p><form id="hiringProfileForm" novalidate><div id="hiringIdentityFields" class="form-grid"></div><h2>The role you’re hiring for</h2><div id="hiringJobFields" class="form-grid"></div><p id="hiringProfileErrors" class="form-validation" role="alert" hidden></p><section class="hiring-answer-preview"><h2>The answers applicants will see</h2><p id="hiringQuestionnaireStatus"></p><button type="button" class="button secondary" id="editPublicTeamAnswers">Edit team questionnaire</button><div id="hiringAnswersPreview" class="team-answer-grid"></div></section><div class="publish-disclosure">Publishing shares your manager profile, job description, and all six team questionnaire answers with applicants in this browser demo. Draft edits remain private until you publish changes.</div><div class="hiring-publish-actions"><button type="button" class="button secondary" id="saveHiringDraft">Save draft</button><button type="button" class="button secondary" id="previewHiringProfile">Preview applicant view</button><button type="submit" class="button primary" id="publishHiringProfile">Publish profile &amp; role →</button><button type="button" class="link-button" id="withdrawHiringProfile" hidden>Unpublish profile</button></div><p id="hiringSaveStatus" class="help" role="status">Saved only in this browser.</p></form></section>';
  Object.entries(ForwardTeams.fields).forEach(([key, rule]) => {
    const group = makeElement('div', rule.words ? 'full' : '');
    const label = makeElement('label', '', rule.label + (rule.required ? ' *' : '')); label.htmlFor = 'team-' + key;
    const field = makeElement(rule.words ? 'textarea' : 'input'); field.id = 'team-' + key; field.required = Boolean(rule.required); field.setAttribute('aria-describedby', 'team-count-' + key);
    if (!rule.words) field.type = 'text';
    field.placeholder = key === 'location' ? 'City, region, and remote / hybrid / on-site' : key === 'employmentType' ? 'Full-time, part-time, contract…' : '';
    const counter = makeElement('p', 'word-count'); counter.id = 'team-count-' + key;
    group.append(label, field, counter);
    editor.querySelector(['roleTitle','employmentType','roleSummary'].includes(key) ? '#hiringJobFields' : '#hiringIdentityFields').append(group);
    field.addEventListener('input', saveHiringDraft);
  });
  $('siteShell').insertBefore(editor, $('roleModal'));
  $('hiringProfileForm').addEventListener('submit', event => { event.preventDefault(); publishHiringProfile(); });
  $('saveHiringDraft').addEventListener('click', saveHiringDraft);
  $('previewHiringProfile').addEventListener('click', () => openTeamProfile('preview', true));
  $('editPublicTeamAnswers').addEventListener('click', openHiringQuiz);
  $('withdrawHiringProfile').addEventListener('click', () => {
    if (!writeHiringState({ ...hiringProfileState, published: null })) return;
    renderHiringProfileStatus(); showToast('Profile unpublished from this browser demo. Your draft is saved.');
  });
  const chosen = makeElement('section', 'card team-connections'); chosen.id = 'teamConnections';
  $('forwardConnections').querySelector('.page-heading').insertAdjacentElement('afterend', chosen);
  const explore = teamButton('Explore jobs & teams →', 'secondary', () => navigateForward('discover')); explore.id = 'homeExploreJobs'; $('homeWorkspaceActions').append(explore);
  const employerProfile = teamButton('My hiring profile', 'secondary', () => navigateForward('profile')); document.querySelector('#hiringWorkspace .workspace-head').append(employerProfile);
  try {
    hiringProfileState = ForwardTeams.restore(JSON.parse(localStorage.getItem(hiringStorageKey) || 'null'));
    Object.keys(ForwardTeams.fields).forEach(key => { $('team-' + key).value = hiringProfileState.draft[key]; });
    if (hiringProfileState.questionnaireComplete) {
      hiringCriteria = { ...hiringProfileState.answers }; hiringQuizComplete = true;
      $('hiringTeamName').value = hiringProfileState.teamName;
    }
  } catch { $('hiringSaveStatus').textContent = 'Saved hiring profile could not be loaded. You can still build a draft in this tab.'; }
  renderHiringProfileStatus(); renderJobDiscovery();
}
