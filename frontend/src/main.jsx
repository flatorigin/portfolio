import './index.css';
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
import MessagesThread from "./pages/MessagesThread";

function RequireAuth({ children }) {
  return localStorage.getItem("access") ? children : <Navigate to="/login" />;
}

createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <Routes>
      <Route element={<App />}>
        {/* index = "/" → Explore */}
        <Route index element={<Explore />} />

        {/* auth & public routes */}
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route path="forgot-password" element={<ForgotPassword />} />   
        <Route path="reset-password" element={<ResetPassword />} />     

        {/* public profile + project detail */}
        <Route path="u/:username" element={<PublicProfile />} />
        <Route path="projects/:id" element={<ProjectDetail />} />

        {/* protected routes */}
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

        {/* fallback */}
        <Route path="*" element={<Navigate to="/" />} />
        <Route path="/messages/:threadId" element={<MessagesThread />} />
      </Route>
    </Routes>
  </BrowserRouter>
);
