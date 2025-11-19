// frontend/src/pages/Register.jsx  (shows server errors + loading)
import { useState } from "react";
import { register } from "../auth";
import { useNavigate } from "react-router-dom";

export default function Register(){
  const [form,setForm] = useState({username:"", email:"", password:""});
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  async function submit(e){
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await register(form);     // posts to /auth/users/, then logs in
      nav("/profile/edit");
    } catch (err) {
      const data = err?.response?.data;
      if (data && typeof data === "object") {
        const msgs = Object.entries(data).map(([k,v]) => `${k}: ${Array.isArray(v)? v.join(", "): String(v)}`);
        setError(msgs.join(" | "));
      } else {
        setError(err.message || "Registration failed");
      }
    } finally { setLoading(false); }
  }

  return (
    <form onSubmit={submit} style={{maxWidth:360}}>
      <h2>Create account</h2>
      {error && <div style={{background:"#fee", border:"1px solid #f99", padding:8, borderRadius:6, marginBottom:8}}>{error}</div>}
      <input placeholder="Username" value={form.username} onChange={e=>setForm({...form,username:e.target.value})} />
      <input placeholder="Email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} />
      <input placeholder="Password" type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} />
      <button disabled={loading}>{loading ? "Creating..." : "Create"}</button>
      <style>{`input,textarea,button{width:100%;padding:10px;margin:8px 0} button[disabled]{opacity:.6}`}</style>
    </form>
  );
}
