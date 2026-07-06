// frontend/src/router.jsx
import { Navigate, createBrowserRouter } from "react-router-dom";
import App from "./App";
import LandingPage from "./pages/LandingPage";
import HomeownerLandingPage from "./pages/HomeownerLandingPage";
import ContractorLandingPage from "./pages/ContractorLandingPage";
import Explore from "./pages/Explore";
import ProjectGuides from "./pages/ProjectGuides";
import Dashboard from "./pages/Dashboard";
import ProfileEdit from "./pages/EditProfile";
import SavedLikesPage from "./pages/SavedLikesPage";
import ProjectDetail from "./pages/ProjectDetail";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ActivateAccount from "./pages/ActivateAccount";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";
import PublicProfile from "./pages/PublicProfile";
import MessagesThread from "./pages/MessagesThread";
import FindLocalWork from "./pages/FindLocalWork";
import ProjectPlanDetail from "./pages/ProjectPlanDetail";
import HomeownerOnboarding from "./pages/HomeownerOnboarding";
import ContractorOnboarding from "./pages/ContractorOnboarding";
import ProjectCheckGateway from "./pages/ProjectCheckGateway";
import HomeownerProjectCheck from "./pages/HomeownerProjectCheck";
import ContractorLeadCheck from "./pages/ContractorLeadCheck";
import ProjectHelpers from "./pages/ProjectHelpers";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <LandingPage /> },
      { path: "homeowner", element: <HomeownerLandingPage /> },
      { path: "contractor", element: <ContractorLandingPage /> },
      { path: "homeowners", element: <Navigate to="/homeowner" replace /> },
      { path: "contractors", element: <Navigate to="/contractor" replace /> },
      { path: "explore", element: <Explore /> },
      { path: "guides", element: <ProjectGuides /> },
      { path: "guides/:audience", element: <ProjectGuides /> },
      { path: "project-check", element: <ProjectCheckGateway /> },
      { path: "project-check/homeowner", element: <HomeownerProjectCheck /> },
      { path: "project-check/contractor", element: <ContractorLeadCheck /> },
      { path: "contractor-check", element: <ContractorLeadCheck /> },
      { path: "work", element: <FindLocalWork /> },
      { path: "project-helpers", element: <ProjectHelpers /> },
      { path: "project-helpers/verify/:token", element: <ProjectHelpers /> },
      { path: "profile/edit", element: <ProfileEdit /> },
      { path: "profile/saved-likes", element: <SavedLikesPage /> },
      { path: "dashboard", element: <Dashboard /> },
      { path: "dashboard/planner/:planId", element: <ProjectPlanDetail /> },
      { path: "onboarding/homeowner", element: <HomeownerOnboarding /> },
      { path: "onboarding/contractor", element: <ContractorOnboarding /> },
      { path: "projects/:id", element: <ProjectDetail /> },
      { path: "messages/:threadId?", element: <MessagesThread /> },
      { path: "profiles/:username", element: <PublicProfile /> },
      { path: "login", element: <Login /> },
      { path: "register", element: <Register /> },
      { path: "activate/:uid/:token", element: <ActivateAccount /> },
      { path: "forgot-password", element: <ForgotPassword /> },
      { path: "reset-password", element: <ResetPassword /> },
      { path: "*", element: <NotFound /> },
    ],
  },
]);
