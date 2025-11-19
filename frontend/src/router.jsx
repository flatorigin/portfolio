import { createBrowserRouter } from "react-router-dom";
import App from "./App";
import Explore from "./pages/Explore";
import ProfileEdit from "./pages/ProfileEdit";
import Dashboard from "./pages/Dashboard";
import ProjectDetail from "./pages/ProjectDetail";

function NotFound(){ return <div style={{padding:24}}>Not found</div>; }

export const router = createBrowserRouter([{
  path:"/",
  element:<App/>,
  children:[
    { index:true, element:<Explore/> },
    { path:"profile/edit", element:<ProfileEdit/> },
    { path:"dashboard", element:<Dashboard/> },            // added
    { path:"projects/:id", element:<ProjectDetail/> },     // added
    { path:"*", element:<NotFound/> },
  ],
}]);