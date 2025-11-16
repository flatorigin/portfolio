// import { useState } from "react";
// import { Outlet, Link, useNavigate } from "react-router-dom";
// import { logout } from "./auth";
// import { Input, Textarea, Button, Card } from "./ui";

// export default function App() {
//   const navigate = useNavigate();
//   const authed = !!localStorage.getItem("access");

//   const onLogout = () => {
//     logout();
//     navigate("/login");
//   };

//   return (
//     <div className="max-w-5xl mx-auto px-4 py-6">
//       <nav className="flex items-center gap-4 mb-6">
//         <Link to="/" className="text-slate-600 hover:text-slate-900">Explore</Link>
//         <Link to="/profile/edit" className="text-slate-600 hover:text-slate-900">Edit Profile</Link>
//         <Link to="/dashboard" className="text-slate-600 hover:text-slate-900">Dashboard</Link>

//         <div className="ml-auto flex items-center gap-3">
//           {!authed && (
//             <>
//               <Link to="/login" className="text-slate-600 hover:text-blue-500">Login</Link>
//               <Link to="/register" className="text-slate-600 hover:text-slate-900">Register</Link>
//             </>
//           )}
//           {authed && (
//             <button
//               onClick={onLogout}
//               className="inline-flex items-center px-4 py-2 rounded-xl bg-gray-400 text-white hover:bg-blue-700"
//             >
//               Logout
//             </button>
//           )}
//         </div>
//       </nav>

//       <Outlet />
//     </div>
//   );
// }

// OPTIONAL: If you want the App shell to also read and show a small logo badge on profile pages,
// add this snippet to your App layout. It only affects /profile/* routes.
// file: src/App.jsx  (add the imports and the snippet where appropriate)
import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { logout } from "./auth";

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const authed = !!localStorage.getItem("access");
  const onLogout = () => { logout(); navigate("/login"); };

  const showSmallLogo = location.pathname.startsWith("/profile");
  const smallLogo = (typeof window !== "undefined" && localStorage.getItem("profile_logo")) || "";

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <nav className="mb-4 flex items-center gap-4">
        <Link to="/" className="text-slate-600 hover:text-slate-900">Explore</Link>
        <Link to="/profile/edit" className="text-slate-600 hover:text-slate-900">Edit Profile</Link>
        <Link to="/dashboard" className="text-slate-600 hover:text-slate-900">Dashboard</Link>
        <div className="ml-auto flex items-center gap-3">
          {!authed ? (
            <>
              <Link to="/login" className="text-slate-600 hover:text-blue-500">Login</Link>
              <Link to="/register" className="text-slate-600 hover:text-slate-900">Register</Link>
            </>
          ) : (
            <button
              onClick={onLogout}
              className="inline-flex items-center rounded-xl bg-gray-400 px-4 py-2 text-white hover:bg-blue-700"
            >
              Logout
            </button>
          )}
        </div>
      </nav>

      {/* Small logo chip only on profile pages (under the top nav, above page content) */}
      {showSmallLogo && smallLogo && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
          <img src={smallLogo} alt="Your logo" className="h-10 w-10 rounded-lg object-cover" />
          <div className="text-sm text-slate-600">Your profile logo</div>
        </div>
      )}

      <Outlet />
    </div>
  );
}
<Outlet />