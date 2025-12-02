import { useParams, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import api from "../api";

export default function PublicProfile(){
  const { username } = useParams();
  const [profile,setProfile]=useState(null);
  const [projects,setProjects]=useState([]);
  const [msg,setMsg]=useState({name:"",email:"",subject:"",message:""});

  useEffect(()=>{
    api.get(`/profiles/${username}/`).then(({data})=>setProfile(data));
    api.get(`/projects/?owner=${username}`).then(({data})=>{
      setProjects(data.filter(p=>p.owner_username===username && p.is_public));
    });
  },[username]);

  async function send(e){
    e.preventDefault();
    await api.post(`/contact/${username}/send/`, msg);
    setMsg({name:"",email:"",subject:"",message:""});
    alert("Message sent!");
  }

  if(!profile) return null;
  return (
    <div>
      <header style={{display:"flex", gap:16, alignItems:"center"}}>
        {profile.avatar && <img src={profile.avatar} width={96} style={{borderRadius:"50%"}}/>}
        <div>
          <h1 style={{margin:"4px 0"}}>{profile.display_name || profile.username}</h1>
          <div style={{opacity:.8}}>{profile.company}</div>
          <p style={{maxWidth:640}}>{profile.bio}</p>
        </div>
      </header>

      <section style={{marginTop:16}}>
        <h3>Contact</h3>
        <div style={{border:"1px solid #eee", borderRadius:12, padding:12, maxWidth:420}}>
          <div><strong>Email:</strong> {profile.contact_email || "—"}</div>
          <div><strong>Phone:</strong> {profile.contact_phone || "—"}</div>
          {profile.website && <div><a href={profile.website} target="_blank" rel="noreferrer">Website</a></div>}
        </div>

        {profile.show_contact_form && (
          <form onSubmit={send} style={{maxWidth:520, marginTop:12}}>
            <input placeholder="Your name" value={msg.name} onChange={e=>setMsg({...msg,name:e.target.value})}/>
            <input placeholder="Your email" value={msg.email} onChange={e=>setMsg({...msg,email:e.target.value})}/>
            <input placeholder="Subject" value={msg.subject} onChange={e=>setMsg({...msg,subject:e.target.value})}/>
            <textarea placeholder="Message" value={msg.message} onChange={e=>setMsg({...msg,message:e.target.value})}/>
            <button>Send</button>
            <style>{`
              input, textarea, button { width: 100%; padding: 10px; margin: 8px 0; }
              button { cursor: pointer; }
              textarea { min-height: 120px; }
            `}</style>
          </form>
        )}
        <div style={{ marginTop: 12 }}>
                  <button
                    onClick={async () => {
                      try {
                        const { data } = await api.post(`/inbox/threads/start/`, {
                          username,
                        });
                        if (data?.id) {
                          window.location.href = `/messages/${data.id}`;
                        }
                      } catch (err) {
                        alert("Unable to start private chat.");
                      }
                    }}
                  >
                    Message this profile
                  </button>
                </div>
      </section>

      <section style={{marginTop:16}}>
        <h3>Projects</h3>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:16}}>
          {projects.map(p=>(
            <Link key={p.id} to={`/projects/${p.id}`} style={{textDecoration:"none", color:"inherit"}}>
              <div style={{border:"1px solid #eee", borderRadius:12, overflow:"hidden"}}>
                {p.cover_image && <img src={p.cover_image} style={{width:"100%",height:160,objectFit:"cover"}}/>}
                <div style={{padding:12}}>
                  <h4 style={{margin:"4px 0"}}>{p.title}</h4>
                  <p style={{opacity:.8}}>{p.summary}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
