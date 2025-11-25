// frontend/src/router.jsx
import { createBrowserRouter } from "react-router-dom";
import App from "./App";
import Explore from "./pages/Explore";
import Dashboard from "./pages/Dashboard";
import ProfileEdit from "./pages/EditProfile";
import ProjectDetail from "./pages/ProjectDetail";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <Explore /> },
      { path: "profile/edit", element: <ProfileEdit /> },
      { path: "dashboard", element: <Dashboard /> },
      { path: "projects/:id", element: <ProjectDetail /> },
      { path: "login", element: <Login /> },
      { path: "register", element: <Register /> },
      { path: "forgot-password", element: <ForgotPassword /> },
      { path: "reset-password", element: <ResetPassword /> },

      { path: "*", element: <NotFound /> },
    ],
  },
]);
