// file: src/router.jsx
import { createBrowserRouter } from "react-router-dom";
import App from "./App";
import Explore from "./pages/Explore";
import ProjectGallery from "./pages/ProjectGallery";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <Explore /> },
      { path: "projects/:id", element: <ProjectGallery /> }, // ← This renders media on click
    ],
  },
]);


// file: src/main.jsx  (ensure CSS import & RouterProvider)
import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);