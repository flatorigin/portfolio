// frontend/src/pages/Dashboard.jsx
import { useEffect, useMemo, useState } from "react";
import api from "../api";
import ImageUploader from "../components/ImageUploader";

export default function Dashboard(){
  const [projects,setProjects]=useState([]);
  const [form,setForm]=useState({title:"",summary:"",category:"",is_public:true});
  const [cover,setCover]=useState(null);
  const [selectedId, setSelectedId] = useState("");
  const [imgs, setImgs] = useState([]);
  const [busy, setBusy] = useState(false);
  const me = localStorage.getItem("username") || "";

  async function refreshProjects(){
    const {data} = await api.get("/projects/");
    setProjects(Array.isArray(data) ? data : []);
  }
  useEffect(()=>{ refreshProjects(); },[]);

  const owned = useMemo(
    () => (projects||[]).filter(p => (typeof p.is_owner === "boolean" ? p.is_owner : p.owner_username === me)),
    [projects, me]
  );

  useEffect(()=>{
    if (!selectedId) { setImgs([]); return; }
    api.get(`/projects/${selectedId}/images/`).then(({data}) => {
      const arr = (data||[]).map(x => ({
        url: x.url || x.image || x.src || x.file,
        caption: x.caption || "",
      })).filter(x=>!!x.url);
      setImgs(arr);
    }).catch(()=> setImgs([]));
  }, [selectedId]);

  async function createProject(e){
    e.preventDefault();
    setBusy(true);
    try{
      const fd = new FormData();
      Object.entries(form).forEach(([k,v])=>fd.append(k,v));
      if (cover) fd.append("cover_image", cover);
      const {data} = await api.post("/projects/", fd, {headers:{'Content-Type':'multipart/form-data'}});
      await refreshProjects();
      setForm({title:"",summary:"",category:"",is_public:true});
      setCover(null);
      setSelectedId(String(data?.id || ""));
    } finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <h2 className="mb-4 text-2xl font-bold">Dashboard</h2>

      {/* Create Project */}
      <form onSubmit={createProject} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="text-sm font-semibold text-slate-700">Create Project</div>
        <input className="w-full rounded-xl border border-slate-300 px-3 py-2" placeholder="Title" value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/>
        <textarea className="w-full rounded-xl border border-slate-300 px-3 py-2 min-h-32" placeholder="Summary" value={form.summary} onChange={e=>setForm({...form,summary:e.target.value})}/>
        <input className="w-full rounded-xl border border-slate-300 px-3 py-2" placeholder="Category" value={form.category} onChange={e=>setForm({...form,category:e.target.value})}/>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_public} onChange={e=>setForm({...form,is_public:e.target.checked})}/> Public</label>
        <div className="text-sm">Cover</div>
        <input type="file" onChange={e=>setCover(e.target.files?.[0]||null)}/>
        <button disabled={busy} className="inline-flex items-center rounded-xl bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-60">Create</button>
      </form>

      {/* Manage Images */}
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <div className="text-sm font-semibold text-slate-700">Manage Images</div>
          <select
            className="rounded-xl border border-slate-300 px-3 py-2"
            value={selectedId}
            onChange={(e)=> setSelectedId(e.target.value)}
          >
            <option value="">Select a project…</option>
            {owned.map(p => <option key={p.id} value={String(p.id)}>{p.title}</option>)}
          </select>
        </div>

        {!selectedId ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            Choose one of your projects to upload images.
          </div>
        ) : (
          <>
            <div className="mb-4">
              <div className="mb-2 text-sm text-slate-600">Existing Images</div>
              {imgs.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">No images yet.</div>
              ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
                  {imgs.map((it, i)=>(
                    <figure key={it.url + i} className="rounded-xl border border-slate-200 bg-white p-3">
                      <img src={it.url} alt="" className="mb-2 h-36 w-full rounded-md object-cover"/>
                      {it.caption && <figcaption className="text-sm text-slate-700">{it.caption}</figcaption>}
                    </figure>
                  ))}
                </div>
              )}
            </div>

            <ImageUploader
              projectId={selectedId}
              onUploaded={async ()=>{
                const {data} = await api.get(`/projects/${selectedId}/images/`);
                const arr = (data||[]).map(x => ({ url: x.url || x.image || x.src || x.file, caption: x.caption || ""})).filter(x=>!!x.url);
                setImgs(arr);
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}
