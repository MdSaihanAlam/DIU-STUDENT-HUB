import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import AppLayout from './layouts/AppLayout.jsx';
import PublicLayout from './layouts/PublicLayout.jsx';
import { PageLoader } from './components/ui.jsx';
import SessionExpiredDialog from './components/SessionExpiredDialog.jsx';

// Route-level code splitting keeps the first load small.
const Landing = lazy(() => import('./pages/Landing.jsx'));
const StaticPage = lazy(() => import('./pages/StaticPages.jsx'));
const Login = lazy(() => import('./pages/auth/Login.jsx'));
const Register = lazy(() => import('./pages/auth/Register.jsx'));
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword.jsx'));
const ResetPassword = lazy(() => import('./pages/auth/ResetPassword.jsx'));
const VerifyEmail = lazy(() => import('./pages/auth/VerifyEmail.jsx'));
const Onboarding = lazy(() => import('./pages/auth/Onboarding.jsx'));
const Feed = lazy(() => import('./pages/feed/Feed.jsx'));
const PostDetail = lazy(() => import('./pages/feed/PostDetail.jsx'));
const Resources = lazy(() => import('./pages/resources/Resources.jsx'));
const ResourceDetail = lazy(() => import('./pages/resources/ResourceDetail.jsx'));
const Housing = lazy(() => import('./pages/housing/Housing.jsx'));
const HousingDetail = lazy(() => import('./pages/housing/HousingDetail.jsx'));
const HousingForm = lazy(() => import('./pages/housing/HousingForm.jsx'));
const Departments = lazy(() => import('./pages/directory/Departments.jsx'));
const DepartmentDetail = lazy(() => import('./pages/directory/DepartmentDetail.jsx'));
const FacultyDetail = lazy(() => import('./pages/directory/FacultyDetail.jsx'));
const Research = lazy(() => import('./pages/research/Research.jsx'));
const ResearchDetail = lazy(() => import('./pages/research/ResearchDetail.jsx'));
const ResearchForm = lazy(() => import('./pages/research/ResearchForm.jsx'));
const Alumni = lazy(() => import('./pages/alumni/Alumni.jsx'));
const AlumniEdit = lazy(() => import('./pages/alumni/AlumniEdit.jsx'));
const Careers = lazy(() => import('./pages/careers/Careers.jsx'));
const CareerDetail = lazy(() => import('./pages/careers/CareerDetail.jsx'));
const Events = lazy(() => import('./pages/events/Events.jsx'));
const EventDetail = lazy(() => import('./pages/events/EventDetail.jsx'));
const Communities = lazy(() => import('./pages/communities/Communities.jsx'));
const CommunityDetail = lazy(() => import('./pages/communities/CommunityDetail.jsx'));
const Messages = lazy(() => import('./pages/social/Messages.jsx'));
const Network = lazy(() => import('./pages/social/Network.jsx'));
const Notifications = lazy(() => import('./pages/social/Notifications.jsx'));
const Search = lazy(() => import('./pages/social/Search.jsx'));
const Saved = lazy(() => import('./pages/social/Saved.jsx'));
const Profile = lazy(() => import('./pages/profile/Profile.jsx'));
const Settings = lazy(() => import('./pages/profile/Settings.jsx'));
const Admin = lazy(() => import('./pages/admin/Admin.jsx'));
const NotFound = lazy(() => import('./pages/NotFound.jsx'));

function RequireAuth({ children }) {
  const { status, user } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <PageLoader />;
  if (status !== 'authenticated') return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  if (!user.onboarded && location.pathname !== '/onboarding') return <Navigate to="/onboarding" replace />;
  return children;
}

function RequireStaff({ children }) {
  const { isStaff } = useAuth();
  return isStaff ? children : <Navigate to="/feed" replace />;
}

function GuestOnly({ children }) {
  const { status } = useAuth();
  if (status === 'loading') return <PageLoader />;
  return status === 'authenticated' ? <Navigate to="/feed" replace /> : children;
}

export default function App() {
  return (
    <>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route path="/" element={<Landing />} />
            {['about', 'guidelines', 'privacy', 'terms', 'contact'].map((p) => (
              <Route key={p} path={`/${p}`} element={<StaticPage page={p} />} />
            ))}
          </Route>

          <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
          <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/onboarding" element={<RequireAuth><Onboarding /></RequireAuth>} />

          <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
            <Route path="/feed" element={<Feed />} />
            <Route path="/posts/:id" element={<PostDetail />} />
            <Route path="/resources" element={<Resources />} />
            <Route path="/resources/:id" element={<ResourceDetail />} />
            <Route path="/housing" element={<Housing />} />
            <Route path="/housing/new" element={<HousingForm />} />
            <Route path="/housing/:id" element={<HousingDetail />} />
            <Route path="/housing/:id/edit" element={<HousingForm />} />
            <Route path="/departments" element={<Departments />} />
            <Route path="/departments/:slug" element={<DepartmentDetail />} />
            <Route path="/faculty/:id" element={<FacultyDetail />} />
            <Route path="/research" element={<Research />} />
            <Route path="/research/new" element={<ResearchForm />} />
            <Route path="/research/:id" element={<ResearchDetail />} />
            <Route path="/research/:id/edit" element={<ResearchForm />} />
            <Route path="/alumni" element={<Alumni />} />
            <Route path="/alumni/edit" element={<AlumniEdit />} />
            <Route path="/careers" element={<Careers />} />
            <Route path="/careers/:id" element={<CareerDetail />} />
            <Route path="/events" element={<Events />} />
            <Route path="/events/:id" element={<EventDetail />} />
            <Route path="/communities" element={<Communities />} />
            <Route path="/communities/:slug" element={<CommunityDetail />} />
            <Route path="/messages" element={<Messages />} />
            <Route path="/messages/:id" element={<Messages />} />
            <Route path="/network" element={<Network />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/search" element={<Search />} />
            <Route path="/saved" element={<Saved />} />
            <Route path="/u/:id" element={<Profile />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/admin" element={<RequireStaff><Admin /></RequireStaff>} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </Suspense>
      <SessionExpiredDialog />
    </>
  );
}
