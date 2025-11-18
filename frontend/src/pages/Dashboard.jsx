// frontend/src/pages/Dashboard.jsx
import { useEffect, useMemo, useState, useCallback } from "react";
import api from "../api";
import ImageUploader from "../components/ImageUploader";
import { SectionTitle, Card, Input, Textarea, Button, GhostButton, Badge } from "../ui";

export default function Dashboard(){
  const [projects,setProjects]=useState([]);
  const [busy, setBusy] = useState(false);

  // create (top)
  const [form,setForm]=useState({title:"",summary:"",category:"",is_public:true});
  const [cover,setCover]=useState(null);

  // editor (bottom)
  const [editingId, setEditingId] = useState("");
  const [editForm,setEditForm]=useState({title:"",summary:"",category:"",is_public:true});
  const [editCover,setEditCover]=useState(null);
  const [editImgs, setEditImgs] = useState([]); // [{id,url,caption,_localCaption,_saving}]

  // current user
  const [meUser, setMeUser] = useState({ username: localStorage.getItem("username") || "" });

  // --- me ---
  useEffect(()=>{
    (async ()=>{
      try {
        const { data } = await api.get("/auth/users/me/");
        if (data?.username) setMeUser({ username: data.username });
      } catch {
        try {
          const { data } = await api.get("/users/me/");
          if (data?.username) setMeUser({ username: data.username });
        } catch {
          /* keep localStorage fallback */
        }
      }
    })();
  },[]);

  // --- projects ---
  const refreshProjects = useCallback(async ()=>{
    const {data} = await api.get("/projects/");
    setProjects(Array.isArray(data) ? data : []);
  },[]);
  useEffect(()=>{ refreshProjects(); },[refreshProjects]);

  // --- owned filter (robust) ---
  const owned = useMemo(()=>{
    const ls = (localStorage.getItem("username") || "").toLowerCase();
    const me = (meUser.username || "").toLowerCase();
    return (projects||[]).filter(p => {
      if (typeof p.is_owner === "boolean" && p.is_owner) return true;
      const owner = (p.owner_username || "").toLowerCase();
      return owner && (owner === me || owner === ls);
    });
  }, [projects, meUser.username]);

  // show owned; fallback to all so nothing “disappears”
  const list = owned.length ? owned : projects;

  // --- images helper ---
  const refreshImages = useCallback(async (pid)=>{
    const {data} = await api.get(`/projects/${pid}/images/`);
    const arr = (data||[])
      .map(x=>({
        id: x.id,
        url: x.url || x.image || x.src || x.file,
        caption: x.caption || "",
        _localCaption: x.caption || "",
        _saving: false,
      }))
      .filter(x=>!!x.url);
    setEditImgs(arr);
  },[]);

  // --- load editor ---
  const loadEditor = useCallback(async (id)=>{
    const pid = String(id);
    setEditingId(pid);
    const {data: meta} = await api.get(`/projects/${pid}/`);
    setEditForm({
      title: meta?.title || "",
      summary: meta?.summary || "",
      category: meta?.category || "",
      is_public: !!meta?.is_public,
    });
    setEditCover(null);
    await refreshImages(pid);
  },[refreshImages]);

  // --- create project (top) ---
  async function createProject(e){
    e.preventDefault();
    setBusy(true);
    try{
      const fd = new FormData();
      Object.entries(form).forEach(([k,v])=>fd.append(k,v));
      if (cover) fd.append("cover_image", cover);
      const {data} = await api.post("/projects/", fd, {headers:{'Content-Type':'multipart/form-data'}});
      setProjects(prev => [data, ...prev]);              // optimistic
      refreshProjects();                                  // normalize/is_owner flags
      setForm({title:"",summary:"",category:"",is_public:true});
      setCover(null);
      if (data?.id) await loadEditor(data.id);           // jump to editor
    } finally {
      setBusy(false);
    }
  }

  // --- save project info ---
  async function saveProjectInfo(e){
    e?.preventDefault?.();
    if (!editingId) return;
    setBusy(true);
    try{
      if (editCover) {
        const fd = new FormData();
        Object.entries(editForm).forEach(([k,v])=>fd.append(k, v));
        fd.append("cover_image", editCover);
        await api.patch(`/projects/${editingId}/`, fd, { headers:{ "Content-Type":"multipart/form-data" }});
      } else {
        await api.patch(`/projects/${editingId}/`, editForm);
      }
      await refreshProjects();
    } finally { setBusy(false); }
  }

  // --- inline caption save ---
  async function saveImageCaption(img){
    if (!editingId || !img?.id) return;
    if (img._localCaption === img.caption) return;
    setEditImgs(prev => prev.map(x => x.id===img.id ? {...x, _saving:true} : x));
    try{
      await api.patch(`/projects/${editingId}/images/${img.id}/`, { caption: img._localCaption });
      await refreshImages(editingId);
    } catch (e){
      alert(e?.response?.data ? JSON.stringify(e.response.data) : String(e));
      setEditImgs(prev => prev.map(x => x.id===img.id ? {...x, _saving:false} : x));
    }
  }

  // --- delete image ---
  async function deleteImage(img){
    if (!editingId || !img?.id) return;
    if (!window.confirm("Delete this image? This cannot be undone.")) return;
    setBusy(true);
    try{
      await api.delete(`/projects/${editingId}/images/${img.id}/`);
      await refreshImages(editingId);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <SectionTitle>Dashboard</SectionTitle>
        <p className="text-sm text-slate-600">Create a new project, then edit any of your projects below.</p>
        <div className="mt-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-2 text-xs text-slate-600">
          user: <b>{meUser.username || "(unknown)"}</b> • total: <b>{projects.length}</b> • owned: <b>{owned.length}</b> • shown: <b>{list.length}</b>
        </div>
      </header>

      {/* 1) CREATE PROJECT */}
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

      {/* 2) YOUR PROJECTS */}
      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-800">Your Projects</div>
          <Badge>{list.length} shown</Badge>
        </div>

        {list.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            You don’t have any projects yet.
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
            {list.map(p=>(
              <Card key={p.id} className="overflow-hidden">
                {p.cover_image ? (
                  <img src={p.cover_image} alt="" className="block h-36 w-full object-cover"/>
                ) : (
                  <div className="flex h-36 items-center justify-center bg-slate-100 text-sm text-slate-500">No cover</div>
                )}
                <div className="p-4">
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <div className="truncate font-semibold">{p.title}</div>
                    {p.category ? <Badge>{p.category}</Badge> : null}
                  </div>
                  <div className="line-clamp-2 text-sm text-slate-700">{p.summary || <span className="opacity-60">No summary</span>}</div>
                  <div className="mt-3 flex items-center gap-2">
                    <GhostButton onClick={()=>window.open(`/projects/${p.id}`, "_self")}>Open</GhostButton>
                    <Button onClick={()=>loadEditor(p.id)}>Edit</Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Card>

      {/* 3) EDITOR */}
      {editingId && (
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-semibold text-slate-800">Editing Project #{editingId}</div>
            <div className="flex items-center gap-2">
              <GhostButton onClick={()=>window.open(`/projects/${editingId}`, "_self")}>View</GhostButton>
              <GhostButton onClick={()=>setEditingId("")}>Close</GhostButton>
            </div>
          </div>

          <form onSubmit={saveProjectInfo} className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="md:col-span-1">
              <label className="mb-1 block text-sm text-slate-600">Title</label>
              <Input value={editForm.title} onChange={e=>setEditForm({...editForm, title:e.target.value})} placeholder="Title"/>
            </div>
            <div className="md:col-span-1">
              <label className="mb-1 block text-sm text-slate-600">Category</label>
              <Input value={editForm.category} onChange={e=>setEditForm({...editForm, category:e.target.value})} placeholder="Category"/>
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm text-slate-600">Summary</label>
              <Textarea value={editForm.summary} onChange={e=>setEditForm({...editForm, summary:e.target.value})} placeholder="Short description..."/>
            </div>
            <div className="md:col-span-1">
              <label className="mb-1 block text-sm text-slate-600">Cover (replace)</label>
              <input type="file" onChange={e=>setEditCover(e.target.files?.[0]||null)} />
              {editCover && <div className="mt-1 truncate text-xs text-slate-500">{editCover.name}</div>}
            </div>
            <div className="flex items-center gap-2 md:col-span-1">
              <label className="text-sm text-slate-600">
                <input
                  type="checkbox"
                  className="mr-2 align-middle"
                  checked={!!editForm.is_public}
                  onChange={e=>setEditForm({...editForm, is_public:e.target.checked})}
                />
                Public
              </label>
            </div>
            <div className="md:col-span-2">
              <Button disabled={busy}>Save Changes</Button>
            </div>
          </form>

          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm text-slate-600">Images</div>
              <Badge>{editImgs.length} total</Badge>
            </div>
            {editImgs.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">No images yet.</div>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
                {editImgs.map((it)=>(
                  <figure key={it.id ?? it.url} className="rounded-xl border border-slate-200 bg-white p-3">
                    <img src={it.url} alt="" className="mb-2 h-36 w-full rounded-md object-cover"/>
                    <input
                      className="w-full rounded-lg border border-slate-300 px-2 py-1 text-sm"
                      placeholder="Caption…"
                      value={it._localCaption}
                      onChange={(e)=> setEditImgs(prev => prev.map(x => x.id===it.id ? {...x, _localCaption: e.target.value} : x))}
                    />
                    <div className="mt-2 flex items-center justify-between">
                      <GhostButton
                        onClick={()=>{ if (it.id) deleteImage(it); }}
                        disabled={!it.id || busy}
                        title={it.id ? "Delete this image" : "This API response has no image id — delete is disabled"}
                      >
                        Delete
                      </GhostButton>
                      <Button
                        onClick={()=>saveImageCaption(it)}
                        disabled={it._saving || it._localCaption === it.caption}
                      >
                        {it._saving ? "Saving…" : "Save caption"}
                      </Button>
                    </div>
                  </figure>
                ))}
              </div>
            )}
          </div>

          <div className="mt-6">
            <div className="mb-2 text-sm font-semibold text-slate-800">Add Images</div>
            <div className="text-xs text-slate-600 mb-2">Drag & drop or click; add captions; upload.</div>
            <ImageUploader
              projectId={editingId}
              onUploaded={async ()=>{
                await refreshImages(editingId);
                await refreshProjects();
              }}
            />
          </div>
        </Card>
      )}
    </div>
  );
}
