/**
 * Development seed data. Every person, publication, listing and opportunity below is
 * FICTIONAL sample data (isDemo: true) and must never be presented as fact about DIU.
 * Refuses to run when NODE_ENV=production.
 */
import { pathToFileURL } from 'node:url';
import { env } from '../src/config/env.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import * as M from '../src/models/index.js';
import { storage } from '../src/services/storage.js';

export const DEMO_PASSWORD = 'DemoPass123';

const day = 864e5;
const fromNow = (d, h = 0) => new Date(Date.now() + d * day + h * 3600e3);

/** Build a tiny valid single-page PDF so resource downloads/previews work out of the box. */
function makePdf(title, lines) {
  const esc = (s) => s.replace(/[\\()]/g, '\\$&');
  const text = [`BT /F1 20 Tf 60 760 Td (${esc(title)}) Tj ET`, ...lines.map((l, i) => `BT /F1 12 Tf 60 ${720 - i * 20} Td (${esc(l)}) Tj ET`)].join('\n');
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${Buffer.byteLength(text)} >>\nstream\n${text}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let out = '%PDF-1.4\n';
  const offsets = [];
  objs.forEach((o, i) => {
    offsets.push(Buffer.byteLength(out));
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out);
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

const DEPARTMENTS = [
  { code: 'CSE', name: 'Computer Science & Engineering', faculty: 'Faculty of Science & Engineering', areas: ['Machine Learning', 'Computer Networks', 'Software Engineering', 'Natural Language Processing'] },
  { code: 'EEE', name: 'Electrical & Electronic Engineering', faculty: 'Faculty of Science & Engineering', areas: ['Renewable Energy', 'Power Systems', 'Embedded Systems'] },
  { code: 'CE', name: 'Civil Engineering', faculty: 'Faculty of Science & Engineering', areas: ['Structural Engineering', 'Transportation', 'Environmental Engineering'] },
  { code: 'BBA', name: 'Business Administration', faculty: 'Faculty of Business Studies', areas: ['Marketing', 'Finance', 'Entrepreneurship'] },
  { code: 'ENG', name: 'English', faculty: 'Faculty of Arts & Humanities', areas: ['Applied Linguistics', 'Literature', 'ELT'] },
  { code: 'LAW', name: 'Law', faculty: 'Faculty of Law', areas: ['Human Rights Law', 'Corporate Law'] },
  { code: 'PHR', name: 'Pharmacy', faculty: 'Faculty of Science & Engineering', areas: ['Pharmacology', 'Pharmaceutical Chemistry'] },
  { code: 'ECO', name: 'Economics', faculty: 'Faculty of Social Science', areas: ['Development Economics', 'Econometrics'] },
];

export async function seed({ uri = env.mongoUri, connected = false, quiet = false } = {}) {
  if (env.isProd) throw new Error('Refusing to seed demo data in production.');
  if (!connected) await connectDB(uri);
  const log = (...a) => !quiet && console.log('[seed]', ...a);

  await Promise.all(Object.values(M).filter((m) => m?.deleteMany && m.modelName).map((m) => m.deleteMany({})));

  // ---- Departments ----
  const depts = await M.Department.insertMany(
    DEPARTMENTS.map((d) => ({
      name: d.name,
      code: d.code,
      slug: d.code.toLowerCase(),
      faculty: d.faculty,
      overview: `Sample description for local development. Replace with information from official DIU sources before publishing. The ${d.name} department community on DIU Student Hub brings together students, faculty and alumni to share notes, research and opportunities.`,
      programs: [
        { name: `Bachelor in ${d.name}`, level: 'undergraduate' },
        { name: `Master in ${d.name}`, level: 'graduate' },
      ],
      researchAreas: d.areas,
      isDemo: true,
    }))
  );
  const D = Object.fromEntries(depts.map((d) => [d.code, d]));

  // ---- Users (dev accounts) ----
  const mk = async (u) => {
    const user = new M.User({ emailVerified: true, onboarded: true, isDemo: true, ...u });
    await user.setPassword(DEMO_PASSWORD);
    return user.save();
  };
  const admin = await mk({ name: 'Hub Admin (Sample)', email: 'admin@demo.diuhub.test', role: 'admin', affiliation: 'faculty', affiliationVerified: true, department: D.CSE._id, headline: 'Platform administrator' });
  const moderator = await mk({ name: 'Nusrat Moderator (Sample)', email: 'moderator@demo.diuhub.test', role: 'moderator', affiliation: 'student', affiliationVerified: true, department: D.BBA._id, batch: '2021', headline: 'Community moderator' });
  const students = await Promise.all(
    [
      { name: 'Ayesha Rahman', email: 'student@demo.diuhub.test', department: D.CSE._id, batch: '2022', program: 'B.Sc. in CSE', headline: 'CSE student • ML & web dev', skills: ['React', 'Python', 'Machine Learning'], affiliationVerified: true },
      { name: 'Tanvir Hasan', email: 'tanvir@demo.diuhub.test', department: D.CSE._id, batch: '2023', program: 'B.Sc. in CSE', headline: 'Competitive programmer', skills: ['C++', 'Algorithms'], affiliationVerified: true },
      { name: 'Farhana Akter', email: 'farhana@demo.diuhub.test', department: D.EEE._id, batch: '2022', program: 'B.Sc. in EEE', headline: 'Renewable energy enthusiast', skills: ['MATLAB', 'IoT'], affiliationVerified: true },
      { name: 'Rafiul Islam', email: 'rafiul@demo.diuhub.test', department: D.BBA._id, batch: '2021', program: 'BBA', headline: 'Marketing & startups', skills: ['Marketing', 'Excel'] },
      { name: 'Sadia Chowdhury', email: 'sadia@demo.diuhub.test', department: D.ENG._id, batch: '2023', program: 'BA in English', headline: 'Writer and debater', skills: ['Writing', 'Public Speaking'] },
      { name: 'Mahmud Karim', email: 'mahmud@demo.diuhub.test', department: D.CE._id, batch: '2020', program: 'B.Sc. in Civil Engineering', headline: 'Structures & sustainability', skills: ['AutoCAD', 'ETABS'], affiliationVerified: true },
    ].map((s) => mk({ affiliation: 'student', ...s }))
  );
  const [ayesha, tanvir, farhana, rafiul, sadia, mahmud] = students;
  const facultyUser = await mk({ name: 'Dr. Kamrul Ahsan (Sample)', email: 'faculty@demo.diuhub.test', affiliation: 'faculty', affiliationVerified: true, department: D.CSE._id, headline: 'Associate Professor (sample profile)' });
  const unverifiedFaculty = await mk({ name: 'Shirin Sultana', email: 'pending.faculty@demo.diuhub.test', affiliation: 'faculty', affiliationVerified: false, department: D.EEE._id, headline: 'Lecturer (awaiting verification)' });
  const alumniUsers = await Promise.all(
    [
      { name: 'Imran Hossain', email: 'alumni@demo.diuhub.test', department: D.CSE._id, batch: '2016', headline: 'Senior Software Engineer' },
      { name: 'Nabila Haque', email: 'nabila@demo.diuhub.test', department: D.BBA._id, batch: '2015', headline: 'Brand Manager' },
      { name: 'Arif Mahmud', email: 'arif@demo.diuhub.test', department: D.EEE._id, batch: '2017', headline: 'Power Systems Engineer' },
    ].map((a) => mk({ affiliation: 'alumni', affiliationVerified: true, ...a }))
  );
  const [imran, nabila, arif] = alumniUsers;
  log(`users: ${students.length + alumniUsers.length + 4}`);

  // ---- Faculty directory (fictional) ----
  const facultyProfiles = await M.FacultyProfile.insertMany([
    { user: facultyUser._id, name: facultyUser.name, designation: 'Associate Professor', designationVerified: true, department: D.CSE._id, qualifications: ['PhD in Computer Science (sample)', 'M.Sc. in CSE (sample)'], researchInterests: ['Machine Learning', 'Bangla NLP', 'Computer Vision'], publications: [{ title: 'A sample paper title on Bangla text classification', venue: 'Sample Conference', year: 2024 }], projects: ['Bangla speech dataset (sample)'], publicContact: 'Office hours listed on the department notice board (sample)', verified: true, isDemo: true },
    { name: 'Dr. Sample Faculty — Networks', designation: 'Professor', designationVerified: true, department: D.CSE._id, qualifications: ['PhD (sample)'], researchInterests: ['Computer Networks', 'Network Security'], verified: true, isDemo: true },
    { name: 'Sample Lecturer — Software Engineering', designation: 'Lecturer', department: D.CSE._id, qualifications: ['M.Sc. (sample)'], researchInterests: ['Software Testing', 'DevOps'], isDemo: true },
    { name: 'Dr. Sample Faculty — Power Systems', designation: 'Associate Professor', designationVerified: true, department: D.EEE._id, researchInterests: ['Smart Grid', 'Renewable Energy'], verified: true, isDemo: true },
    { name: 'Sample Faculty — Structural Engineering', designation: 'Assistant Professor', department: D.CE._id, researchInterests: ['Earthquake Engineering'], isDemo: true },
    { name: 'Sample Faculty — Marketing', designation: 'Assistant Professor', department: D.BBA._id, researchInterests: ['Digital Marketing', 'Consumer Behaviour'], isDemo: true },
    { name: 'Sample Faculty — Linguistics', designation: 'Lecturer', department: D.ENG._id, researchInterests: ['Applied Linguistics'], isDemo: true },
  ]);

  // ---- Communities ----
  const communityDefs = [
    { name: 'CSE Department', slug: 'cse-department', type: 'department', department: D.CSE._id, description: 'Announcements, questions and resources for CSE students.', createdBy: admin._id },
    { name: 'DIU Programmers', slug: 'diu-programmers', type: 'technology', description: 'Competitive programming, hackathons and dev talk.', createdBy: tanvir._id },
    { name: 'Machine Learning Study Group', slug: 'ml-study-group', type: 'study_group', department: D.CSE._id, description: 'Weekly paper reading and Kaggle practice.', createdBy: ayesha._id },
    { name: 'Batch 2022', slug: 'batch-2022', type: 'batch', description: 'For everyone who joined DIU in 2022.', createdBy: farhana._id },
    { name: 'Renewable Energy Research', slug: 'renewable-energy-research', type: 'research', department: D.EEE._id, description: 'Solar, wind and smart grid research collaboration.', createdBy: facultyUser._id, visibility: 'private' },
    { name: 'Startup & Entrepreneurship Club', slug: 'startup-club', type: 'club', department: D.BBA._id, description: 'Pitch nights, mentorship and startup resources.', createdBy: rafiul._id },
  ];
  const communities = await M.Community.insertMany(
    communityDefs.map((c) => ({ ...c, isDemo: true, pinnedResources: [{ title: 'Community guidelines', url: '/guidelines' }] }))
  );
  const C = Object.fromEntries(communities.map((c) => [c.slug, c]));
  const memberships = [];
  const join = (c, u, role = 'member', status = 'active') => memberships.push({ community: c._id, user: u._id, role, status });
  communities.forEach((c) => join(c, { _id: c.createdBy }, 'owner'));
  [ayesha, tanvir, mahmud].forEach((u) => join(C['cse-department'], u));
  [ayesha, farhana, sadia].forEach((u) => join(C['diu-programmers'], u));
  [tanvir, facultyUser].forEach((u) => join(C['ml-study-group'], u));
  [ayesha].forEach((u) => join(C['batch-2022'], u));
  join(C['renewable-energy-research'], farhana);
  join(C['renewable-energy-research'], arif, 'member', 'pending');
  [nabila, sadia].forEach((u) => join(C['startup-club'], u));
  await M.CommunityMembership.insertMany(memberships);
  for (const c of communities) {
    await M.Community.updateOne({ _id: c._id }, { memberCount: memberships.filter((m) => String(m.community) === String(c._id) && m.status === 'active').length });
  }

  // ---- Posts ----
  const postDefs = [
    { author: facultyUser, type: 'announcement', official: true, content: 'Sample announcement: Mid-term exam schedule for CSE courses will be published on the department notice board next week. #exams #cse', department: D.CSE._id, hours: 2 },
    { author: ayesha, type: 'question', content: 'Can anyone explain the difference between BFS and DFS with a real-world example? Preparing for the Data Structures mid. #datastructures #cse', hours: 5 },
    { author: tanvir, type: 'post', content: 'Our team just qualified for the national programming contest regionals! Huge thanks to everyone in @[Ayesha Rahman](' + ayesha._id + ') and the DIU Programmers community. #competitiveprogramming', community: C['diu-programmers']._id, hours: 9 },
    { author: farhana, type: 'research_update', content: 'Update on our solar micro-grid monitoring prototype: the IoT sensor board is now logging voltage every 5 seconds. Looking for someone who knows time-series dashboards! #research #renewableenergy', hours: 20 },
    { author: rafiul, type: 'poll', content: 'Which workshop should the Startup Club host next month?', poll: ['Pitch deck design', 'Digital marketing basics', 'Financial modelling', 'Product discovery'], community: C['startup-club']._id, hours: 26 },
    { author: sadia, type: 'post', content: 'Sharing my study routine that helped me survive finals: 50-minute focus blocks, a 10-minute walk, and teaching the topic to a friend. What works for you? #studytips', hours: 30 },
    { author: imran, type: 'post', content: 'Alumni tip: when applying for your first software job, a small but complete project with tests and a README beats ten unfinished tutorials. Happy to review portfolios. #careers #mentorship', hours: 40 },
    { author: mahmud, type: 'question', content: 'Does anyone have recommendations for learning ETABS beyond the basics? Looking for good tutorials for structural analysis. #civilengineering', hours: 52 },
    { author: ayesha, type: 'post', content: 'The ML Study Group is reading "Attention Is All You Need" this week. Join us on Thursday in the library discussion room. #machinelearning', community: C['ml-study-group']._id, hours: 60 },
    { author: admin, type: 'announcement', official: true, content: 'Welcome to DIU Student Hub — an independent community platform for DIU students, faculty and alumni. Please read the community guidelines and report anything that looks wrong. #welcome', hours: 80 },
    { author: nabila, type: 'post', content: 'We are opening two marketing internship slots at my company this winter. Details are in the Careers section. #internship #marketing', hours: 90 },
    { author: tanvir, type: 'question', content: 'Is there a good resource for dynamic programming patterns? I keep getting stuck on state definition. #algorithms #cse', hours: 100 },
  ];
  const posts = [];
  for (const p of postDefs) {
    const created = new Date(Date.now() - p.hours * 3600e3);
    posts.push(
      await M.Post.create({
        author: p.author._id,
        type: p.type,
        content: p.content,
        official: !!p.official,
        community: p.community,
        department: p.department || p.author.department,
        hashtags: [...p.content.matchAll(/#([\p{L}\p{N}_]{2,40})/gu)].map((m) => m[1].toLowerCase()),
        mentions: [...p.content.matchAll(/@\[[^\]]+\]\(([a-f\d]{24})\)/g)].map((m) => m[1]),
        poll: p.poll ? { options: p.poll.map((text, i) => ({ text, voters: i === 0 ? [nabila._id, sadia._id] : i === 1 ? [ayesha._id] : [] })) } : undefined,
        isDemo: true,
        createdAt: created,
        updatedAt: created,
      })
    );
  }
  // Comments & reactions
  const commentDefs = [
    [1, tanvir, 'BFS is like ripples in water — level by level. DFS is like exploring a maze by always taking the next unexplored corridor.'],
    [1, facultyUser, 'Good analogy. Also think about which data structure each uses: queue vs stack.'],
    [3, ayesha, 'I can help with a Grafana or Recharts dashboard!'],
    [6, rafiul, 'Would love a portfolio review, thank you!'],
    [11, ayesha, 'Try the "DP patterns" list on LeetCode discuss, and the AtCoder Educational DP contest.'],
  ];
  for (const [i, author, content] of commentDefs) {
    await M.Comment.create({ post: posts[i]._id, author: author._id, content });
    await M.Post.updateOne({ _id: posts[i]._id }, { $inc: { commentCount: 1 } });
  }
  const reactors = [ayesha, tanvir, farhana, rafiul, sadia, mahmud, imran];
  for (const [i, post] of posts.entries()) {
    const who = reactors.filter((u, j) => (i + j) % 3 !== 0 && String(u._id) !== String(post.author));
    await M.Reaction.insertMany(who.map((u, j) => ({ post: post._id, user: u._id, type: ['like', 'insightful', 'love', 'support'][j % 4] })));
    await M.Post.updateOne({ _id: post._id }, { reactionCount: who.length });
  }
  log(`posts: ${posts.length}`);

  // ---- Academic resources (small generated PDFs) ----
  const resourceDefs = [
    { title: 'Data Structures — Lecture Notes (Trees & Graphs)', courseCode: 'CSE 213', courseTitle: 'Data Structures', semester: 'Fall 2025', topic: 'Graphs', resourceType: 'notes', dept: 'CSE', uploader: ayesha },
    { title: 'Algorithms — Dynamic Programming Slides', courseCode: 'CSE 221', courseTitle: 'Algorithms', semester: 'Spring 2026', topic: 'Dynamic Programming', resourceType: 'slides', dept: 'CSE', uploader: tanvir },
    { title: 'Circuit Analysis — Practice Problems', courseCode: 'EEE 111', courseTitle: 'Electrical Circuits I', semester: 'Fall 2025', topic: 'KVL & KCL', resourceType: 'assignment', dept: 'EEE', uploader: farhana },
    { title: 'Principles of Marketing — Summary Notes', courseCode: 'BBA 205', courseTitle: 'Principles of Marketing', semester: 'Spring 2026', topic: '4Ps', resourceType: 'notes', dept: 'BBA', uploader: rafiul },
    { title: 'Database Systems — Lab Manual (SQL)', courseCode: 'CSE 312', courseTitle: 'Database Systems', semester: 'Spring 2026', topic: 'SQL', resourceType: 'lab_manual', dept: 'CSE', uploader: facultyUser },
    { title: 'Structural Analysis — Formula Sheet', courseCode: 'CE 311', courseTitle: 'Structural Analysis', semester: 'Fall 2025', topic: 'Beams', resourceType: 'notes', dept: 'CE', uploader: mahmud },
  ];
  for (const [i, r] of resourceDefs.entries()) {
    const buf = makePdf(r.title, ['Sample study material generated for local development.', `Course: ${r.courseCode} ${r.courseTitle}`, `Topic: ${r.topic}`, 'Replace with your own notes.']);
    const key = await storage.save(buf, { folder: 'resources', ext: 'pdf' });
    await M.AcademicResource.create({
      title: r.title,
      description: `Sample ${r.resourceType.replace('_', ' ')} for ${r.courseTitle}. Written by the uploader for demonstration.`,
      courseCode: r.courseCode,
      courseTitle: r.courseTitle,
      department: D[r.dept]._id,
      semester: r.semester,
      topic: r.topic,
      resourceType: r.resourceType,
      attribution: `Original notes by ${r.uploader.name}`,
      file: { key, originalName: `${r.courseCode.replace(' ', '')}-${r.topic.replace(/\W+/g, '-')}.pdf`, mime: 'application/pdf', size: buf.length },
      uploader: r.uploader._id,
      downloads: 12 + i * 7,
      ratings: [{ user: sadia._id, value: 4 + (i % 2), comment: 'Very clear, thanks!' }],
      ratingAvg: 4 + (i % 2),
      ratingCount: 1,
      status: 'approved',
      isDemo: true,
    });
  }
  // One upload waiting for moderation
  {
    const buf = makePdf('Operating Systems — Scheduling Notes', ['Pending review sample.']);
    const key = await storage.save(buf, { folder: 'resources', ext: 'pdf' });
    await M.AcademicResource.create({ title: 'Operating Systems — CPU Scheduling Notes', courseCode: 'CSE 323', courseTitle: 'Operating Systems', department: D.CSE._id, semester: 'Spring 2026', resourceType: 'notes', file: { key, originalName: 'CSE323-scheduling.pdf', mime: 'application/pdf', size: buf.length }, uploader: tanvir._id, status: 'pending', isDemo: true });
  }

  // ---- Housing ----
  const housingDefs = [
    { owner: rafiul, title: 'Mess seat available near campus — shared room', type: 'mess_seat', rent: 4500, area: 'Badda', facilities: ['Wi-Fi', 'Meal system', 'Water filter'], gender: 'male', from: 3 },
    { owner: sadia, title: 'Female hostel seat — 10 min walk', type: 'hostel', rent: 6500, area: 'Satarkul', facilities: ['Wi-Fi', 'Security guard', 'Laundry'], gender: 'female', from: 0 },
    { owner: mahmud, title: 'Sublet: single room in family flat', type: 'sublet', rent: 7000, area: 'Notun Bazar', facilities: ['Attached bathroom', 'Balcony'], gender: 'any', from: 10 },
    { owner: imran, title: '2-bed apartment for 3 students', type: 'apartment', rent: 18000, area: 'Bashundhara', facilities: ['Lift', 'Generator', 'Gas'], gender: 'any', from: 20, method: 'email', value: 'listing-contact@example.com' },
    { owner: tanvir, title: 'Roommate wanted — CSE student preferred', type: 'roommate_wanted', rent: 5000, area: 'Badda', facilities: ['Wi-Fi', 'Study desk'], gender: 'male', from: 5 },
    { owner: farhana, title: 'Shared room with one other student', type: 'shared_room', rent: 5500, area: 'Rampura', facilities: ['Wi-Fi', 'Kitchen access'], gender: 'female', from: 7 },
  ];
  await M.HousingListing.insertMany(
    housingDefs.map((h) => ({
      owner: h.owner._id,
      title: h.title,
      description: 'Sample listing for local development. Always visit in person and never pay advance money before seeing the place.',
      type: h.type,
      rent: h.rent,
      area: h.area,
      locationNote: `Near ${h.area} main road (approximate)`,
      availableFrom: fromNow(h.from),
      facilities: h.facilities,
      rules: 'No smoking inside. Guests allowed until 9 PM.',
      genderPreference: h.gender,
      contact: { method: h.method || 'in_app', value: h.value },
      expiresAt: fromNow(30),
      isDemo: true,
    }))
  );

  // ---- Research ----
  const researchDefs = [
    { title: 'Bangla Handwritten Character Recognition with Lightweight CNNs', domain: 'Computer Vision', dept: 'CSE', status: 'ongoing', lead: ayesha, supervisor: facultyProfiles[0], tech: ['Python', 'PyTorch'], collab: true, featured: true, review: 'verified' },
    { title: 'IoT-based Solar Micro-grid Monitoring for Rural Schools', domain: 'Renewable Energy', dept: 'EEE', status: 'ongoing', lead: farhana, supervisor: facultyProfiles[3], tech: ['ESP32', 'MQTT', 'Grafana'], collab: true, featured: true, review: 'verified' },
    { title: 'Sentiment Analysis of Bangla Product Reviews', domain: 'Natural Language Processing', dept: 'CSE', status: 'completed', lead: facultyUser, tech: ['Transformers', 'Python'], featured: true, review: 'verified', affiliation: 'faculty' },
    { title: 'Low-cost Earthquake-resistant Housing Designs', domain: 'Structural Engineering', dept: 'CE', status: 'proposed', lead: mahmud, tech: ['ETABS', 'AutoCAD'], collab: true, review: 'verified' },
    { title: 'Campus Food Waste Tracking App', domain: 'Software Engineering', dept: 'CSE', status: 'proposed', lead: tanvir, tech: ['React Native', 'Firebase'], collab: true, review: 'pending' },
  ];
  await M.ResearchProject.insertMany(
    researchDefs.map((r) => ({
      title: r.title,
      abstract: `Sample abstract for local development: this project explores ${r.title.toLowerCase()}. No results described here are real; replace with the team's own summary.`,
      domain: r.domain,
      department: D[r.dept]._id,
      status: r.status,
      lead: r.lead._id,
      contributors: [{ user: r.lead._id, name: r.lead.name, role: 'Lead' }],
      affiliation: r.affiliation || 'student',
      supervisor: r.supervisor?._id,
      supervisorName: r.supervisor?.name,
      startDate: fromNow(-120),
      methodology: 'Literature review, data collection, prototyping and evaluation (sample).',
      technologies: r.tech,
      progress: 'Sample progress note.',
      collaborationOpen: !!r.collab,
      collaborationNote: r.collab ? 'Looking for teammates with data visualisation or hardware experience.' : undefined,
      followers: [sadia._id],
      reviewStatus: r.review,
      featured: !!r.featured,
      isDemo: true,
    }))
  );

  // ---- Alumni ----
  await M.AlumniProfile.insertMany([
    { user: imran._id, graduationYear: 2020, department: D.CSE._id, jobTitle: 'Senior Software Engineer', employer: 'Sample Tech Ltd.', industry: 'Software', location: 'Dhaka', skills: ['Node.js', 'System Design', 'AWS'], careerJourney: 'Started as an intern in a local startup, moved to backend engineering and now lead a small platform team (sample story).', achievements: ['Speaker at a local developer meetup (sample)'], advice: 'Build in public, ask for code reviews, and learn fundamentals deeply.', mentorshipAvailable: true, referralsNote: 'Can refer for junior backend roles when openings exist.', shareContact: false, successStory: { title: 'From campus coding club to platform lead', body: 'Sample success story: I joined the programming club in my first year, built small tools for classmates and learned to work in teams. Those projects got me my first internship.', featured: true }, isDemo: true },
    { user: nabila._id, graduationYear: 2019, department: D.BBA._id, jobTitle: 'Brand Manager', employer: 'Sample Consumer Goods Co.', industry: 'FMCG', location: 'Dhaka', skills: ['Brand Strategy', 'Market Research'], careerJourney: 'Management trainee program, then brand roles (sample).', mentorshipAvailable: true, contactEmail: 'nabila.mentor@example.com', shareContact: true, successStory: { title: 'Learning marketing by doing', body: 'Sample success story: club events taught me how to plan campaigns on tiny budgets.', featured: true }, isDemo: true },
    { user: arif._id, graduationYear: 2021, department: D.EEE._id, jobTitle: 'Power Systems Engineer', employer: 'Sample Energy Ltd.', industry: 'Energy', location: 'Chattogram', skills: ['Power Systems', 'SCADA'], careerJourney: 'Graduate engineer to field engineer (sample).', mentorshipAvailable: false, isDemo: true },
  ]);

  // ---- Careers ----
  const careerDefs = [
    { title: 'Junior Backend Developer (Sample)', type: 'job', organization: 'Sample Tech Ltd.', location: 'Dhaka', mode: 'hybrid', deadline: 21, verified: true, tags: ['nodejs', 'backend'] },
    { title: 'Marketing Intern — Winter (Sample)', type: 'internship', organization: 'Sample Consumer Goods Co.', location: 'Dhaka', mode: 'onsite', deadline: 10, verified: true, tags: ['marketing'] },
    { title: 'Graduate Scholarship for Engineering Masters (Sample)', type: 'scholarship', organization: 'Sample Foundation', location: 'Abroad', mode: 'onsite', deadline: 45, verified: false, tags: ['masters', 'engineering'] },
    { title: 'Research Assistant — Bangla NLP (Sample)', type: 'research_assistant', organization: 'DIU Student Hub sample lab', location: 'Campus', mode: 'onsite', deadline: 14, verified: true, tags: ['nlp', 'research'] },
    { title: 'National Hackathon 2026 (Sample)', type: 'hackathon', organization: 'Sample Organisers', location: 'Dhaka', mode: 'onsite', deadline: 2, verified: false, tags: ['hackathon'] },
    { title: 'Business Case Competition (Sample)', type: 'competition', organization: 'Sample Business Club', location: 'Online', mode: 'remote', deadline: 30, verified: false, tags: ['business'] },
  ];
  await M.CareerOpportunity.insertMany(
    careerDefs.map((c) => ({
      ...c,
      deadline: fromNow(c.deadline),
      description: 'Sample opportunity for local development. Always confirm details on the organiser\'s official website before applying.',
      eligibility: 'Current DIU students or recent graduates (sample).',
      applyUrl: 'https://example.com/apply',
      sourceUrl: 'https://example.com/source',
      postedBy: c.verified ? admin._id : imran._id,
      reviewStatus: 'approved',
      isDemo: true,
    }))
  );
  await M.CareerOpportunity.create({ title: 'Part-time Teaching Assistant (Sample, pending)', type: 'job', organization: 'Sample Coaching Centre', description: 'A community submission waiting for review in the moderation queue.', postedBy: ayesha._id, reviewStatus: 'pending', deadline: fromNow(20), isDemo: true });

  // ---- Events ----
  const eventDefs = [
    { title: 'Intro to Machine Learning Workshop (Sample)', category: 'workshop', d: 3, venue: 'Room 501, Main Campus (sample)', organizer: 'ML Study Group', official: false, by: ayesha },
    { title: 'Career Fair 2026 (Sample)', category: 'career_fair', d: 12, venue: 'University Auditorium (sample)', organizer: 'Career Services (sample)', official: true, by: admin },
    { title: 'Research Poster Presentation Day (Sample)', category: 'research_presentation', d: 18, venue: 'Seminar Hall (sample)', organizer: 'CSE Department (sample)', official: true, by: facultyUser, dept: 'CSE' },
    { title: 'Course Registration Deadline (Sample)', category: 'academic_deadline', d: 6, venue: 'Online portal', organizer: 'Registrar (sample)', official: true, by: admin },
    { title: 'Pitch Night: Student Startups (Sample)', category: 'club', d: 9, venue: 'Online', meetingUrl: 'https://example.com/meet', organizer: 'Startup & Entrepreneurship Club', official: false, by: rafiul },
    { title: 'Intra-University Programming Contest (Sample)', category: 'competition', d: 25, venue: 'Computer Lab 3 (sample)', organizer: 'DIU Programmers', official: false, by: tanvir },
  ];
  await M.Event.insertMany(
    eventDefs.map((e) => ({
      title: e.title,
      description: 'Sample event for local development. Check the organiser\'s official channels for real dates and venues.',
      category: e.category,
      startsAt: fromNow(e.d, 10),
      endsAt: fromNow(e.d, 13),
      venue: e.venue,
      meetingUrl: e.meetingUrl,
      organizer: e.organizer,
      registrationUrl: 'https://example.com/register',
      department: e.dept ? D[e.dept]._id : undefined,
      postedBy: e.by._id,
      official: e.official,
      reviewStatus: 'approved',
      isDemo: true,
    }))
  );
  await M.Event.create({ title: 'Photography Walk (Sample, pending)', description: 'Community submission awaiting review.', category: 'club', startsAt: fromNow(15, 8), venue: 'Main gate', organizer: 'Photography lovers', postedBy: sadia._id, reviewStatus: 'pending', isDemo: true });

  // ---- Social graph, moderation samples, notifications ----
  await M.Connection.insertMany([
    { requester: ayesha._id, recipient: tanvir._id, status: 'accepted' },
    { requester: farhana._id, recipient: ayesha._id, status: 'accepted' },
    { requester: sadia._id, recipient: ayesha._id, status: 'pending', message: 'Hi! I saw your ML post — would love to connect.' },
    { requester: ayesha._id, recipient: imran._id, kind: 'mentorship', status: 'accepted', message: 'Could you review my portfolio?' },
  ]);
  const convo = await M.Conversation.create({ participants: [ayesha._id, tanvir._id], startedBy: tanvir._id, status: 'active', lastMessagePreview: 'See you at the contest practice!' });
  await M.Message.insertMany([
    { conversation: convo._id, sender: tanvir._id, body: 'Are you joining the contest practice tomorrow?', readBy: [tanvir._id, ayesha._id], createdAt: new Date(Date.now() - 3600e3) },
    { conversation: convo._id, sender: tanvir._id, body: 'See you at the contest practice!', readBy: [tanvir._id] },
  ]);
  await M.VerificationRequest.insertMany([
    { user: unverifiedFaculty._id, requestedAffiliation: 'faculty', evidence: 'Lecturer, EEE department. Official email: s.sultana@example.edu (sample).' },
    { user: rafiul._id, requestedAffiliation: 'student', evidence: 'Student ID 2021-xxx (sample), BBA batch 2021.' },
  ]);
  await M.Report.create({ reporter: sadia._id, targetType: 'post', targetId: posts[11]._id, reason: 'spam', details: 'Sample report to demonstrate the moderation queue.' });
  await M.Notification.insertMany([
    { user: ayesha._id, type: 'connection_request', actor: sadia._id, message: 'Sadia Chowdhury wants to connect', link: '/network' },
    { user: ayesha._id, type: 'comment', actor: tanvir._id, message: 'Tanvir Hasan commented on your post', link: `/posts/${posts[1]._id}` },
    { user: ayesha._id, type: 'mention', actor: tanvir._id, message: 'Tanvir Hasan mentioned you in a post', link: `/posts/${posts[2]._id}`, read: true },
  ]);

  log('done. Dev accounts (password for all):', DEMO_PASSWORD);
  log('  admin@demo.diuhub.test, moderator@demo.diuhub.test, student@demo.diuhub.test, faculty@demo.diuhub.test, alumni@demo.diuhub.test');
  if (!connected) await disconnectDB();
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  seed().catch((err) => {
    console.error('[seed] failed:', err);
    process.exit(1);
  });
}
