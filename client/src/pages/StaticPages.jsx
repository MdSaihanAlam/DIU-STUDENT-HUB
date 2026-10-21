import { Link } from 'react-router-dom';
import { useDocumentTitle } from '../hooks/index.js';

const PAGES = {
  about: {
    title: 'About DIU Student Hub',
    body: (
      <>
        <p>
          DIU Student Hub is an <strong>independent, community-run platform</strong> for students, faculty members, researchers and alumni of Dhaka International University (DIU), Bangladesh. It is{' '}
          <strong>not operated, approved or endorsed by Dhaka International University</strong>.
        </p>
        <h2>What you can do here</h2>
        <ul>
          <li>Share and find notes, slides and study materials you have the right to share.</li>
          <li>Ask academic questions and join department, batch and study communities.</li>
          <li>Find mess seats, sublets, hostels and roommates near campus.</li>
          <li>Explore departments, faculty research interests and student research projects.</li>
          <li>Connect with alumni, request mentorship and discover career opportunities.</li>
        </ul>
        <h2>How we label trust</h2>
        <ul>
          <li>
            <strong>Verified</strong> — a moderator confirmed the member’s student, faculty or alumni status.
          </li>
          <li>
            <strong>Official</strong> — posted by verified faculty or platform staff. Everything else is community-submitted.
          </li>
          <li>
            <strong>Sample data</strong> — fictional demonstration content shown in development environments.
          </li>
        </ul>
      </>
    ),
  },
  guidelines: {
    title: 'Community guidelines',
    body: (
      <>
        <p>We want DIU Student Hub to be useful, respectful and safe. By using the platform you agree to these rules.</p>
        <h2>Be respectful</h2>
        <ul>
          <li>No harassment, bullying, hate speech, threats or doxxing.</li>
          <li>Do not share other people’s phone numbers, addresses or private information.</li>
        </ul>
        <h2>Keep it honest</h2>
        <ul>
          <li>Do not impersonate faculty, staff, the university or other members.</li>
          <li>Do not post fake listings, fake opportunities or misleading research claims.</li>
          <li>Housing and marketplace scams result in a permanent ban.</li>
        </ul>
        <h2 id="copyright">Respect copyright</h2>
        <ul>
          <li>Upload only material you created or have permission to share. Do not upload pirated books.</li>
          <li>Credit the original author in the attribution field.</li>
          <li>
            Rights holders can request removal with the <strong>Report → Copyright infringement</strong> option on any resource, or via the <Link to="/contact">contact page</Link>.
          </li>
        </ul>
        <h2>Academic integrity</h2>
        <ul>
          <li>Do not share live exam questions or help others cheat.</li>
        </ul>
        <h2>Enforcement</h2>
        <p>Moderators may remove content, restrict features or suspend accounts. Every moderation action is recorded in an audit log.</p>
      </>
    ),
  },
  privacy: {
    title: 'Privacy policy',
    body: (
      <>
        <p>We collect only what the platform needs to work and we never sell personal data.</p>
        <h2>What we store</h2>
        <ul>
          <li>Account data: name, email, hashed password, department, program, batch and your claimed affiliation.</li>
          <li>Content you create: posts, comments, uploads, listings, messages.</li>
          <li>Verification requests you submit (text evidence only — we never ask for national ID or passport scans).</li>
        </ul>
        <h2>Who can see what</h2>
        <ul>
          <li>Your email and phone are private by default. You choose whether to show your email in Settings.</li>
          <li>Housing contact details are hidden unless the owner chooses to share them, and only with signed-in members.</li>
          <li>Private messages are visible only to the participants. Moderators may review a message only when it is reported.</li>
          <li>You control profile visibility (members, connections only, or private) and who can message you.</li>
        </ul>
        <h2>Your rights</h2>
        <ul>
          <li>Edit your profile at any time, download what you uploaded, and block or report other members.</li>
          <li>Request account deletion in Settings. Your account is deactivated immediately and permanently anonymised after a 14-day grace period.</li>
        </ul>
        <h2>Cookies</h2>
        <p>We use a secure, HttpOnly session cookie and a CSRF protection cookie. No advertising or tracking cookies.</p>
      </>
    ),
  },
  terms: {
    title: 'Terms of use',
    body: (
      <>
        <p>DIU Student Hub is provided as-is by an independent student community. It is not an official service of Dhaka International University.</p>
        <ul>
          <li>You are responsible for the content you post and must follow the community guidelines.</li>
          <li>The platform does not guarantee housing listings, transactions, job offers or opportunities. Always verify independently and never pay advance money to strangers.</li>
          <li>Research and academic content is community-submitted unless labeled verified, and may contain errors.</li>
          <li>We may suspend accounts that break the rules or put others at risk.</li>
          <li>We may update these terms; continued use means you accept the updated terms.</li>
        </ul>
      </>
    ),
  },
  contact: {
    title: 'Contact',
    body: (
      <>
        <p>Questions, feedback, safety concerns or copyright requests are welcome.</p>
        <ul>
          <li>
            Use the <strong>Report</strong> button on any post, file, listing or profile for the fastest moderator response.
          </li>
          <li>For account or verification help, sign in and message a moderator, or check Settings → Verification.</li>
          <li>
            For copyright takedowns, report the resource with reason <strong>Copyright infringement</strong> and include the original work and your contact name.
          </li>
        </ul>
        <p className="muted small">Deployers: replace this page with your community’s real contact email before going live.</p>
      </>
    ),
  },
};

export default function StaticPage({ page }) {
  const p = PAGES[page];
  useDocumentTitle(p.title);
  return (
    <article className="prose">
      <h1>{p.title}</h1>
      {p.body}
    </article>
  );
}
