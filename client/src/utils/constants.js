export const RESOURCE_TYPES = [
  ['notes', 'Notes'],
  ['slides', 'Lecture slides'],
  ['book', 'Book / reference'],
  ['question_paper', 'Previous questions'],
  ['lab_manual', 'Lab manual'],
  ['assignment', 'Assignment / practice'],
  ['other', 'Other'],
];

export const HOUSING_TYPES = [
  ['mess_seat', 'Mess seat'],
  ['sublet', 'Sublet'],
  ['shared_room', 'Shared room'],
  ['hostel', 'Hostel'],
  ['apartment', 'Apartment'],
  ['roommate_wanted', 'Roommate wanted'],
];

export const RESEARCH_STATUS = [
  ['proposed', 'Proposed'],
  ['ongoing', 'Ongoing'],
  ['completed', 'Completed'],
  ['published', 'Published'],
];

export const OPPORTUNITY_TYPES = [
  ['job', 'Job'],
  ['internship', 'Internship'],
  ['scholarship', 'Scholarship'],
  ['admission', 'Graduate admission'],
  ['research_assistant', 'Research assistant'],
  ['competition', 'Competition'],
  ['hackathon', 'Hackathon'],
];

export const EVENT_CATEGORIES = [
  ['seminar', 'Seminar'],
  ['workshop', 'Workshop'],
  ['conference', 'Conference'],
  ['career_fair', 'Career fair'],
  ['club', 'Club activity'],
  ['competition', 'Competition'],
  ['academic_deadline', 'Academic deadline'],
  ['research_presentation', 'Research presentation'],
  ['announcement', 'Announcement'],
  ['other', 'Other'],
];

export const COMMUNITY_TYPES = [
  ['department', 'Department'],
  ['batch', 'Batch'],
  ['course', 'Course'],
  ['research', 'Research group'],
  ['technology', 'Technology'],
  ['study_group', 'Study group'],
  ['project', 'Project'],
  ['club', 'Club'],
];

export const REPORT_REASONS = [
  ['spam', 'Spam or advertising'],
  ['harassment', 'Harassment or bullying'],
  ['hate', 'Hate speech'],
  ['misinformation', 'False information'],
  ['scam', 'Scam or fraud'],
  ['copyright', 'Copyright infringement'],
  ['malicious_file', 'Malicious or broken file'],
  ['inappropriate', 'Inappropriate content'],
  ['incorrect', 'Incorrect academic content'],
  ['other', 'Something else'],
];

export const REACTIONS = [
  ['like', '👍', 'Like'],
  ['love', '❤️', 'Love'],
  ['insightful', '💡', 'Insightful'],
  ['support', '🙌', 'Support'],
  ['curious', '🤔', 'Curious'],
];

export const POST_TYPES = [
  ['post', 'Post'],
  ['question', 'Question'],
  ['announcement', 'Announcement'],
  ['research_update', 'Research update'],
  ['poll', 'Poll'],
];

export const label = (pairs, value) => pairs.find(([v]) => v === value)?.[1] || value;
