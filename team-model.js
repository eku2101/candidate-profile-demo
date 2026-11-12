(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ForwardTeams = api;
})(globalThis, function () {
  'use strict';
  const fields = {
    managerName: { label: 'Hiring manager name', required: true, max: 80 },
    managerTitle: { label: 'Manager’s role', max: 80 },
    company: { label: 'Company or team', required: true, max: 80 },
    location: { label: 'Location & work arrangement', max: 100 },
    managerBio: { label: 'About the hiring manager', required: true, max: 75, words: true },
    teamStory: { label: 'Team culture & support', max: 100, words: true },
    roleTitle: { label: 'Job title', required: true, max: 80 },
    employmentType: { label: 'Employment type', max: 60 },
    roleSummary: { label: 'The work & what you can contribute', required: true, max: 100, words: true }
  };
  const answerOptions = {
    focus: { protected: 'Regular uninterrupted blocks', open: 'Short blocks between interactions', flexible: 'Flexible — depends on the task' },
    brainstorming: { frequent: 'Frequent group idea sessions', occasional: 'Occasional, when useful', flexible: 'Flexible — depends on the task' },
    communication: { written: 'Written updates first', live: 'Live conversations first', flexible: 'A flexible mix of both' },
    checkIns: { frequent: 'Frequent, brief check-ins', milestones: 'At milestones or when needed', flexible: 'Flexible — depends on the task' },
    rhythm: { steady: 'Steady and predictable', fast: 'Fast-paced and varied', flexible: 'Flexible by project' },
    environment: { enterprise: 'Large enterprise', mid: 'Mid-size company', small: 'Small contractor or close-knit team', startup: 'Startup or early-stage team', remote: 'Remote-first distributed team' },
    experience: { entry: 'Entry level', mid: 'Mid level', senior: 'Senior level', lead: 'Lead or principal' }
  };
  function normalizeFields(value) {
    return Object.fromEntries(Object.keys(fields).map(key => [key, typeof value?.[key] === 'string' ? value[key].slice(0, 15000) : '']));
  }
  function normalizeAnswers(value) {
    return Object.fromEntries(Object.entries(answerOptions).map(([key, options]) => [key, Object.hasOwn(options, value?.[key]) ? value[key] : '']));
  }
  function completeAnswers(value) { return Object.values(normalizeAnswers(value)).every(Boolean); }
  function issues(value, answers) {
    const draft = normalizeFields(value);
    const result = [];
    for (const [key, rule] of Object.entries(fields)) {
      const text = draft[key].trim();
      const count = rule.words ? (text ? text.split(/\s+/u).length : 0) : Array.from(draft[key]).length;
      if (rule.required && !text) result.push({ key, message: `Add ${rule.label.toLowerCase()}.` });
      else if (count > rule.max) result.push({ key, message: `Keep ${rule.label.toLowerCase()} to ${rule.max} ${rule.words ? 'words' : 'characters'}.` });
    }
    if (!completeAnswers(answers)) result.push({ key: 'answers', message: 'Complete your team questionnaire before publishing.' });
    return result;
  }
  function publish(draft, answers) {
    const errors = issues(draft, answers);
    if (errors.length) throw new Error(errors[0].message);
    return { id: 'local-team', ...normalizeFields(draft), answers: normalizeAnswers(answers), sample: false };
  }
  function restore(value) {
    const empty = { schemaVersion: 1, draft: normalizeFields(), answers: normalizeAnswers(), questionnaireComplete: false, teamName: '', published: null };
    if (!value || value.schemaVersion !== 1) return empty;
    empty.draft = normalizeFields(value.draft);
    empty.answers = normalizeAnswers(value.answers);
    empty.questionnaireComplete = Boolean(value.questionnaireComplete && completeAnswers(empty.answers));
    empty.teamName = typeof value.teamName === 'string' ? value.teamName.slice(0, 80) : '';
    if (value.published && !issues(value.published, value.published.answers).length) empty.published = publish(value.published, value.published.answers);
    return empty;
  }
  const samples = [
    { id: 'sample-design', sample: true, managerName: 'Jordan Rivera', managerTitle: 'Design team lead', company: 'Fieldwork Studio', location: 'Hybrid · Example location', managerBio: 'I help designers build confidence through thoughtful feedback and shared learning. I value clear explanations, curiosity, and the willingness to improve an idea together.', teamStory: 'We protect focus blocks, share work in progress, and make room for different ways of contributing. Team workshops and community projects help us learn beyond our day-to-day work.', roleTitle: 'Product Designer', employmentType: 'Full-time · Example role', roleSummary: 'Help make everyday services easier to use. Collaborate with researchers and engineers, test ideas with users, and explain what you learned. Bring examples of how your work helped people; experience can come from a range of settings.', answers: { experience: 'mid', focus: 'protected', brainstorming: 'frequent', communication: 'written', checkIns: 'milestones', rhythm: 'flexible', environment: 'small' } },
    { id: 'sample-community', sample: true, managerName: 'Morgan Ellis', managerTitle: 'Community programs manager', company: 'Common Ground Collective', location: 'On-site · Example location', managerBio: 'I support people who bring neighbors, partners, and volunteers together. I try to make expectations clear and give colleagues room to ask questions and shape our programs.', teamStory: 'We plan together, check in frequently during events, and celebrate contributions that are easy to overlook. Community gatherings and shared reflection help us improve.', roleTitle: 'Community Program Coordinator', employmentType: 'Full-time · Example role', roleSummary: 'Coordinate local programs, support volunteers, and build relationships with community partners. Help us understand who our programs reach and what could work better. Organizing, service, and volunteer experience can all tell a useful story.', answers: { experience: 'entry', focus: 'open', brainstorming: 'occasional', communication: 'live', checkIns: 'frequent', rhythm: 'steady', environment: 'mid' } },
    { id: 'sample-learning', sample: true, managerName: 'Taylor Chen', managerTitle: 'Learning & operations lead', company: 'Open Path Learning', location: 'Remote · Example role', managerBio: 'I lead a distributed team that turns complicated information into useful learning. I care about thoughtful documentation, accessible experiences, and helping people grow into new responsibilities.', teamStory: 'We use written updates across time zones and agree on when a live conversation will help. Optional virtual gatherings and occasional retreats give us space to connect as people.', roleTitle: 'Learning Experience Designer', employmentType: 'Contract · Example role', roleSummary: 'Create practical learning resources and improve them using feedback. Work with subject experts, support accessible content, and help colleagues use new tools. Share how you have helped someone understand or accomplish something new.', answers: { experience: 'mid', focus: 'protected', brainstorming: 'occasional', communication: 'written', checkIns: 'milestones', rhythm: 'fast', environment: 'remote' } }
  ];
  function listings(state) { return state.published ? [state.published, ...samples] : samples.slice(); }
  function search(list, query) {
    const terms = String(query || '').toLocaleLowerCase().trim().split(/\s+/u).filter(Boolean);
    return list.filter(item => terms.every(term => [item.roleTitle, item.company, item.managerName, item.location, item.roleSummary].join(' ').toLocaleLowerCase().includes(term)));
  }
  return { fields, answerOptions, normalizeFields, normalizeAnswers, completeAnswers, issues, publish, restore, listings, search, samples };
});
