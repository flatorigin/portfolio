// frontend/src/pages/Dashboard.jsx
import { useEffect, useMemo, useState } from "react";
import api from "../api";
import ImageUploader from "../components/ImageUploader";
import { SectionTitle, Card, Input, Textarea, Button, GhostButton, Badge } from "../ui";

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
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <SectionTitle>Dashboard</SectionTitle>
        <p className="text-sm text-slate-600">Create new projects and manage their images. Your public projects appear on Explore.</p>
      </header>

      {/* Create Project */}
      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-800">Create Project</div>
          <Badge>{owned.length} owned</Badge>
        </div>
        <form onSubmit={createProject} className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="md:col-span-1">
            <label className="mb-1 block text-sm text-slate-600">Title</label>
            <Input placeholder="Title" value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/>
          </div>
          <div className="md:col-span-1">
            <label className="mb-1 block text-sm text-slate-600">Category</label>
            <Input placeholder="Category" value={form.category} onChange={e=>setForm({...form,category:e.target.value})}/>
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm text-slate-600">Summary</label>
            <Textarea placeholder="One or two sentences…" value={form.summary} onChange={e=>setForm({...form,summary:e.target.value})}/>
          </div>
          <div className="md:col-span-1">
            <label className="mb-1 block text-sm text-slate-600">Cover (optional)</label>
            <input type="file" onChange={e=>setCover(e.target.files?.[0]||null)} />
            {cover && <div className="mt-1 text-xs text-slate-500 truncate">{cover.name}</div>}
          </div>
          <div className="flex items-center gap-2 md:col-span-1">
            <label className="text-sm text-slate-600">
              <input type="checkbox" className="mr-2 align-middle" checked={form.is_public} onChange={e=>setForm({...form,is_public:e.target.checked})}/>
              Public
            </label>
          </div>
          <div className="md:col-span-2">
            <Button disabled={busy}>Create Project</Button>
          </div>
        </form>
      </Card>

      {/* Manage Images */}
      <Card className="p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-800">Manage Images</div>
            <div className="text-xs text-slate-600">Select one of your projects to upload and caption images.</div>
          </div>
          <div className="flex items-center gap-2">
            <select
              className="rounded-xl border border-slate-300 px-3 py-2"
              value={selectedId}
              onChange={(e)=> setSelectedId(e.target.value)}
            >
              <option value="">Select a project…</option>
              {owned.map(p => <option key={p.id} value={String(p.id)}>{p.title}</option>)}
            </select>
            {selectedId && (
              <GhostButton onClick={()=>window.open(`/projects/${selectedId}`, "_self")}>
                View Project →
              </GhostButton>
            )}
          </div>
        </div>

        {!selectedId ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            Choose a project to see its media and add new images.
          </div>
        ) : (
          <>
            <div className="mb-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-sm text-slate-600">Existing Images</div>
                <Badge>{imgs.length} total</Badge>
              </div>
              {imgs.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  No images yet. Use the uploader below to add your first images.
                </div>
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

            <div className="space-y-2">
              <div className="text-sm font-semibold text-slate-800">Add Images</div>
              <div className="text-xs text-slate-600">Drag & drop or click to select. Add a caption per image before uploading.</div>
              <ImageUploader
                projectId={selectedId}
                onUploaded={async ()=>{
                  const {data} = await api.get(`/projects/${selectedId}/images/`);
                  const arr = (data||[]).map(x => ({ url: x.url || x.image || x.src || x.file, caption: x.caption || ""})).filter(x=>!!x.url);
                  setImgs(arr);
                }}
              />
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
