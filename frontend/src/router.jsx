// frontend/src/router.jsx
import { createBrowserRouter } from "react-router-dom";
import App from "./App";
import LandingPage from "./pages/LandingPage";
import HomeownerLandingPage from "./pages/HomeownerLandingPage";
import ContractorLandingPage from "./pages/ContractorLandingPage";
import Explore from "./pages/Explore";
import ProjectGuides from "./pages/ProjectGuides";
import Dashboard from "./pages/Dashboard";
import ProfileEdit from "./pages/EditProfile";
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

export const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <LandingPage /> },
      { path: "homeowners", element: <HomeownerLandingPage /> },
      { path: "contractors", element: <ContractorLandingPage /> },
      { path: "explore", element: <Explore /> },
      { path: "guides", element: <ProjectGuides /> },
      { path: "guides/:audience", element: <ProjectGuides /> },
      { path: "work", element: <FindLocalWork /> },
      { path: "profile/edit", element: <ProfileEdit /> },
      { path: "dashboard", element: <Dashboard /> },
      { path: "dashboard/planner/:planId", element: <ProjectPlanDetail /> },
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
