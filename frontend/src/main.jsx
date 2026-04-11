import "./index.css";
import React, { Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import App from "./App.jsx";

const Explore = lazy(() => import("./pages/Explore.jsx"));
const LandingPage = lazy(() => import("./pages/LandingPage.jsx"));
const ProjectGuides = lazy(() => import("./pages/ProjectGuides.jsx"));
const TermsAndSafety = lazy(() => import("./pages/TermsAndSafety.jsx"));
const Login = lazy(() => import("./pages/Login.jsx"));
const Register = lazy(() => import("./pages/Register.jsx"));
const ActivateAccount = lazy(() => import("./pages/ActivateAccount.jsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.jsx"));
const EditProfile = lazy(() => import("./pages/EditProfile.jsx"));
const ProjectDetail = lazy(() => import("./pages/ProjectDetail.jsx"));
const PublicProfile = lazy(() => import("./pages/PublicProfile.jsx"));
const ProjectPrintView = lazy(() => import("./pages/ProjectPrintView.jsx"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword.jsx"));
const ResetPassword = lazy(() => import("./pages/ResetPassword.jsx"));
const MessagesThread = lazy(() => import("./pages/MessagesThread.jsx"));
const NotFound = lazy(() => import("./pages/NotFound.jsx"));
const FindLocalWork = lazy(() => import("./pages/FindLocalWork.jsx"));
const DashboardProjectsPage = lazy(() => import("./pages/DashboardProjectsPage.jsx"));
const ProjectEditPage = lazy(() => import("./pages/ProjectEditPage.jsx"));

function RouteFallback() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 text-sm text-slate-500">
      Loading…
    </div>
  );
}

function RequireAuth({ children }) {
  return localStorage.getItem("access") ? (
    children
  ) : (
    <Navigate to="/login" replace />
  );
}

createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="projects/:id/print" element={<ProjectPrintView />} />
        {/* Layout route with header/nav in <App /> */}
        <Route path="/" element={<App />}>
          {/* "/" → landing page */}
          <Route index element={<LandingPage />} />
          <Route path="explore" element={<Explore />} />
          <Route path="guides" element={<ProjectGuides />} />
          <Route path="terms" element={<TermsAndSafety />} />
          {/* Auth + public routes */}
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />
          <Route path="activate/:uid/:token" element={<ActivateAccount />} />
          <Route path="forgot-password" element={<ForgotPassword />} />
          <Route path="reset-password" element={<ResetPassword />} />
          <Route path="/work" element={<FindLocalWork />} />
          <Route path="profiles/:username" element={<PublicProfile />} />
          <Route path="projects/:id" element={<ProjectDetail />} />
          <Route path="/dashboard/projects" element={<DashboardProjectsPage />} />
          <Route path="/dashboard/projects/:projectId/edit" element={<ProjectEditPage />} />

          {/* Protected routes */}
          <Route
            path="dashboard"
            element={
              <RequireAuth>
                <Dashboard />
              </RequireAuth>
            }
          />
          <Route
            path="profile/edit"
            element={
              <RequireAuth>
                <EditProfile />
              </RequireAuth>
            }
          />

          {/* Messages (inbox) – protected */}
          <Route
            path="messages/:threadId?"
            element={
              <RequireAuth>
                <MessagesThread />
              </RequireAuth>
            }
          />

          {/* Catch-all inside layout */}
          <Route path="*" element={<NotFound />} />
        </Route>

        {/* Extra catch-all just in case */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  </BrowserRouter>
);
