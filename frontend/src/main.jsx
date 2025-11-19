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

function RequireAuth({ children }) {
  return localStorage.getItem("access") ? children : <Navigate to="/login" />;
}

createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <Routes>
      <Route element={<App />}> 
        <Route index element={<Explore/>} />
        <Route path="login" element={<Login/>} />
        <Route path="register" element={<Register/>} />
        <Route path="u/:username" element={<PublicProfile/>} />
        <Route path="projects/:id" element={<ProjectDetail/>} />
        <Route path="dashboard" element={<RequireAuth><Dashboard/></RequireAuth>} />
        <Route path="profile/edit" element={<RequireAuth><EditProfile/></RequireAuth>} />
        <Route path="*" element={<Navigate to="/" />} />
      </Route>
    </Routes>
  </BrowserRouter>
);
