import "./index.css";
import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import App from "./App.jsx";
import Explore from "./pages/Explore.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import EditProfile from "./pages/EditProfile.jsx";
import ProjectDetail from "./pages/ProjectDetail.jsx";
import PublicProfile from "./pages/PublicProfile.jsx";
import ForgotPassword from "./pages/ForgotPassword.jsx";
import ResetPassword from "./pages/ResetPassword.jsx";
import MessagesThread from "./pages/MessagesThread.jsx";
import NotFound from "./pages/NotFound";
import FindLocalWork from "./pages/FindLocalWork";

function RequireAuth({ children }) {
  return localStorage.getItem("access") ? (
    children
  ) : (
    <Navigate to="/login" replace />
  );
}

createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <Routes>
      {/* Layout route with header/nav in <App /> */}
      <Route path="/" element={<App />}>
        {/* "/" → Explore */}
        <Route index element={<Explore />} />
        {/* Auth + public routes */}
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route path="forgot-password" element={<ForgotPassword />} />
        <Route path="reset-password" element={<ResetPassword />} />
        <Route path="/work" element={<FindLocalWork />} />

        {/* Public profile + project detail */}
        {/* ✅ This matches /profiles/Artin etc */}
        <Route path="profiles/:username" element={<PublicProfile />} />
        <Route path="projects/:id" element={<ProjectDetail />} />

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
  </BrowserRouter>
);
