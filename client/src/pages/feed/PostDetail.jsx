import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useApi, useDocumentTitle } from '../../hooks/index.js';
import { Button, CardSkeleton, ErrorState } from '../../components/ui.jsx';
import PostCard from '../../features/posts/PostCard.jsx';

export default function PostDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, setData, error, loading, reload } = useApi(`/posts/${id}`);
  useDocumentTitle(data?.post ? `${data.post.author?.name}'s post` : 'Post');

  return (
    <div className="main-narrow stack">
      <div>
        <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/feed'))}>
          Back
        </Button>
      </div>
      {loading ? (
        <CardSkeleton count={1} lines={4} />
      ) : error ? (
        <>
          <ErrorState error={error} onRetry={reload} />
          <Link to="/feed">Go to the feed</Link>
        </>
      ) : (
        <PostCard post={data.post} showComments onChange={(_, patch) => setData((d) => ({ post: { ...d.post, ...patch } }))} onRemove={() => navigate('/feed')} />
      )}
    </div>
  );
}
