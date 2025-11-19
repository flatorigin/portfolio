import { useState } from "react";
import { login } from "../auth";
import { useNavigate } from "react-router-dom";

export default function Login(){
  const [form,setForm] = useState({username:"", password:""});
  const nav = useNavigate();

  async function submit(e){
    e.preventDefault();
    await login(form);
    nav("/dashboard");
  }

  return (
    <form onSubmit={submit} style={{maxWidth:360}}>
      <h2 >Login</h2>
      <input placeholder="Username" value={form.username} onChange={e=>setForm({...form,username:e.target.value})} />
      <input placeholder="Password" type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} />
      <button>Login</button>
      <style>{`
        input, textarea, button { width: 100%; padding: 10px; margin: 8px 0; }
        button { cursor: pointer; }
      `}</style>
    </form>
  );
}
