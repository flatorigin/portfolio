// frontend/src/router.jsx  (ensure the route exists)
import { createBrowserRouter } from "react-router-dom";
import App from "./App";
import Explore from "./pages/Explore";
import ProfileEdit from "./pages/ProfileEdit";
function NotFound(){ return <div style={{padding:24}}>Not found</div>; }
export const router = createBrowserRouter([{
  path:"/",
  element:<App/>,
  children:[
    { index:true, element:<Explore/> },
    { path:"profile/edit", element:<ProfileEdit/> },
    { path:"*", element:<NotFound/> },
  ],
}]);
