import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { EmptyState } from '../components/ui.jsx';
import { useDocumentTitle } from '../hooks/index.js';

export default function NotFound() {
  useDocumentTitle('Page not found');
  return (
    <div className="card">
      <EmptyState
        icon={Compass}
        title="Page not found"
        action={
          <Link to="/feed" className="btn btn-primary">
            Back to the feed
          </Link>
        }
      >
        The page you are looking for does not exist or was moved.
      </EmptyState>
    </div>
  );
}
