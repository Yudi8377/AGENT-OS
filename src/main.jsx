import React, { useEffect, useMemo, useState } from 'react';
import { supabase, supabaseConfigured } from './lib/supabase';
import { createRoot } from 'react-dom/client';
import {
  Activity, AppWindow, Bot, Boxes, CheckCircle2, ChevronDown, CircleHelp,
  Command, Compass, Database, FileCheck2, GitBranch, Layers3, LockKeyhole,
  Plus, Search, Settings2, ShieldCheck, Sparkles, Workflow, Wrench, X
} from 'lucide-react';
import './styles.css';

const modules = [
  { id: 'overview', label: 'Overview', icon: AppWindow, group: 'WORKSPACE' },
  { id: 'directory', label: 'AI Directory', icon: Compass, group: 'DISCOVER' },
  { id: 'skills', label: 'Skills Studio', icon: Layers3, group: 'DISCOVER' },
  { id: 'agents', label: 'Agent Builder', icon: Bot, group: 'BUILD' },
  { id: 'workflows', label: 'Orchestrator', icon: Workflow, group: 'BUILD' },
  { id: 'runtime', label: 'Secure Runtime', icon: ShieldCheck, group: 'OPERATE' },
  { id: 'evaluation', label: 'Evaluation & Audit', icon: FileCheck2, group: 'OPERATE' },
  { id: 'governance', label: 'Governance', icon: LockKeyhole, group: 'ADMIN' }
];

const initialCatalog = [
  { name: 'VoltAgent Agent Skills', type: 'Skill collection', category: 'Skills', source: 'VoltAgent/awesome-agent-skills', license: 'MIT · repo-level', url: 'https://github.com/VoltAgent/awesome-agent-skills', detail: 'Kumpulan referensi skill agent; lisensi setiap skill harus diverifikasi.' },
  { name: 'Awesome AI Agents', type: 'Agent directory', category: 'Agents', source: 'e2b-dev/awesome-ai-agents', license: 'CC BY-NC-SA 4.0', url: 'https://github.com/e2b-dev/awesome-ai-agents', detail: 'Referensi agent dan proyek. Materi berlisensi ini bukan default untuk distribusi komersial.' },
  { name: 'AI Collection', type: 'AI tools directory', category: 'Tools', source: 'ai-collection/ai-collection', license: 'MIT · repo-level', url: 'https://github.com/ai-collection/ai-collection', detail: 'Direktori tools AI; tinjau lisensi masing-masing produk dan aset.' },
  { name: 'Model Provider Adapter', type: 'Integration pattern', category: 'Infrastructure', source: 'Agent OS architecture', license: 'Internal design', url: 'https://github.com/Yudi8377/AGENT-OS', detail: 'Lapisan adapter provider dengan batas kredensial di server.' },
  { name: 'Sandbox Execution', type: 'Runtime capability', category: 'Infrastructure', source: 'Agent OS architecture', license: 'Needs integration', url: 'https://github.com/Yudi8377/AGENT-OS', detail: 'Eksekusi terisolasi belum aktif sampai runtime dikonfigurasi.' }
];

function Dashboard({ user, workspace, onSignOut }) {
  const [active, setActive] = useState('overview');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const [agents, setAgents] = useState([]);
  useEffect(() => {
    if (!supabase || !workspace?.id) return;
    let alive = true;
    supabase.from('agents').select('id,name,purpose,instructions,model_provider,model_name,status')
      .eq('workspace_id', workspace.id).order('updated_at', { ascending: false })
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) { setNotice('Gagal memuat agent: ' + error.message); return; }
        setAgents((data || []).map(a => ({ id: a.id, name: a.name, model: a.model_name || 'Belum tersambung', status: a.status === 'draft' ? 'Draft' : a.status, description: a.purpose, instructions: a.instructions })));
      });
    return () => { alive = false; };
  }, [workspace?.id]);
  const [showCreate, setShowCreate] = useState(false);
  const [showRun, setShowRun] = useState(false);
  const [selectedRunAgent, setSelectedRunAgent] = useState(null);
  const [runInput, setRunInput] = useState('');
  const [runOutput, setRunOutput] = useState(null);
  const [runBusy, setRunBusy] = useState(false);
  const [draft, setDraft] = useState({ name: '', purpose: '', instructions: '' });
  const [notice, setNotice] = useState('');
  const [tasks, setTasks] = useState([
    { name: 'Repository & license inventory', state: 'Complete' },
    { name: 'Provider credentials', state: 'Not connected' },
    { name: 'Sandbox runtime', state: 'Not connected' },
    { name: 'Persistent storage & RBAC', state: 'Planned' }
  ]);
  const current = modules.find(m => m.id === active) || modules[0];
  const catalog = useMemo(() => initialCatalog.filter(item => {
    const matchesQuery = [item.name, item.type, item.category, item.source].join(' ').toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (filter === 'All' || item.category === filter);
  }), [query, filter]);

  async function createAgent(e) {
    e.preventDefault();
    if (!draft.name.trim() || !draft.purpose.trim()) return;
    if (!supabase || !workspace?.id || !user?.id) {
      setNotice('Database belum dikonfigurasi atau sesi tidak tersedia. Draft tidak disimpan.');
      return;
    }
    const { data, error } = await supabase.from('agents').insert({
      workspace_id: workspace.id, name: draft.name.trim(), purpose: draft.purpose.trim(),
      instructions: draft.instructions, model_provider: 'openai', model_name: 'gpt-4.1-mini',
      created_by: user.id, status: 'draft'
    }).select('id,name,purpose,instructions,model_name,status').single();
    if (error) { setNotice('Gagal menyimpan agent: ' + error.message); return; }
    await supabase.from('audit_events').insert({
      workspace_id: workspace.id, actor_id: user.id, action: 'agent.created',
      entity_type: 'agent', entity_id: data.id, details: { name: data.name }
    });
    setAgents(prev => [{ id: data.id, name: data.name, model: data.model_name || 'Belum tersambung', status: 'Draft', description: data.purpose, instructions: data.instructions }, ...prev]);
    setDraft({ name: '', purpose: '', instructions: '' });
    setShowCreate(false);
    setActive('agents');
    setNotice('Draft agent tersimpan di database workspace. Kirim untuk review sebelum disetujui dan dijalankan.');
  }

  async function changeAgentStatus(agent, nextStatus) {
    const { data, error } = await supabase.rpc('set_agent_status', { p_agent_id: agent.id, p_status: nextStatus });
    if (error) { setNotice('Perubahan status ditolak: ' + error.message); return; }
    const row = Array.isArray(data) ? data[0] : data;
    setAgents(prev => prev.map(a => a.id === agent.id ? { ...a, status: row?.status || nextStatus } : a));
    setNotice('Status agent ' + agent.name + ' diperbarui menjadi ' + (row?.status || nextStatus) + '.');
  }

  async function runSelectedAgent(e) {
    e.preventDefault();
    if (!selectedRunAgent || !runInput.trim()) return;
    setRunBusy(true); setRunOutput(null);
    const { data, error } = await supabase.functions.invoke('agent-run', {
      body: { agent_id: selectedRunAgent.id, input: runInput.trim() }
    });
    setRunBusy(false);
    if (error) {
      const context = error.context;
      let detail = error.message || 'Eksekusi gagal.';
      if (context && typeof context.json === 'function') {
        try { const body = await context.json(); detail = body.reason || body.error || detail; } catch { /* keep fallback */ }
      }
      setRunOutput({ error: detail });
      return;
    }
    setRunOutput(data || { error: 'Server tidak mengembalikan hasil.' });
  }

  return <div className="shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Command size={21}/></div><div><strong>AGENT<span>OS</span></strong><small>UNIFIED AGENT PLATFORM</small></div></div>
      <div className="workspace-switch"><div className="workspace-icon"><Boxes size={17}/></div><div><b>{workspace?.name || 'Workspace'}</b><small>{user?.email || 'Signed in'}</small></div><ChevronDown size={15}/></div>
      {['WORKSPACE', 'DISCOVER', 'BUILD', 'OPERATE', 'ADMIN'].map(group => <div className="nav-group" key={group}>
        <div className="nav-label">{group}</div>
        {modules.filter(m => m.group === group).map(m => <button key={m.id} className={'nav-item ' + (active === m.id ? 'selected' : '')} onClick={() => { setActive(m.id); setNotice(''); }}><m.icon size={17}/><span>{m.label}</span>{m.id === 'agents' && <em>{agents.length}</em>}</button>)}
      </div>)}
      <div className="sidebar-bottom"><div className="secure-note"><ShieldCheck size={16}/><div><b>Safety first</b><small>Approval and server secrets required</small></div></div><button className="nav-item" onClick={() => setActive('governance')}><Settings2 size={17}/> Settings & access</button><div className="profile"><div className="avatar">{(user?.email || 'U').slice(0,1).toUpperCase()}</div><div className="profile-copy"><b>{user?.email || 'Workspace user'}</b><small>{workspace?.role || 'member'}</small></div><button className="icon-btn signout-btn" title="Sign out" onClick={onSignOut}><LockKeyhole size={16}/></button></div></div>
    </aside>
    <main className="main">
      <header className="topbar"><div className="crumb"><span>Agent OS</span><span className="slash">/</span><b>{current.label}</b></div><div className="top-actions"><div className="environment"><i/> Supabase workspace</div><button className="icon-btn" title="Help" onClick={() => setNotice('Agent OS masih dalam tahap fondasi. Integrasi provider, runtime, dan penyimpanan perlu disiapkan sebelum produksi.')}><CircleHelp size={18}/></button><button className="avatar small-avatar" onClick={() => setActive('governance')}>Y</button></div></header>
      <div className="content">
        {notice && <div className="notice"><CheckCircle2 size={17}/><span>{notice}</span><button onClick={() => setNotice('')}><X size={15}/></button></div>}
        {active === 'overview' && <><div className="eyebrow"><Sparkles size={14}/> AGENT OPERATIONS CENTER</div><div className="page-heading"><div><h1>Build with agents.<br/><span>Operate with confidence.</span></h1><p>Temukan komponen AI, rancang agent, dan siapkan workflow dalam satu workspace.</p></div><button className="primary" onClick={() => setShowCreate(true)}><Plus size={17}/> Create agent</button></div>
          <div className="status-banner"><div className="status-icon"><ShieldCheck size={19}/></div><div><b>Guarded text-only mode · provider belum terhubung</b><p>API hanya dirancang untuk menjalankan agent approved sebagai permintaan teks. Eksekusi kode, skill pihak ketiga, shell, filesystem, dan tool eksternal tetap terkunci. Run model masih diblokir sampai secret provider tersedia di server.</p></div><button className="text-btn" onClick={() => setActive('runtime')}>Review security <span>→</span></button></div>
          <div className="section-title"><div><h2>Workspace overview</h2><p>Ringkasan komponen yang sudah dirancang</p></div><span className="live-pill"><i/> DRAFT ENVIRONMENT</span></div>
          <div className="metric-grid"><Metric icon={Bot} label="Agents" value={agents.length} sub="Persisted in workspace" /><Metric icon={Layers3} label="Skill sources" value="3" sub="Sumber direferensikan" /><Metric icon={Workflow} label="Workflows" value="0" sub="Belum dieksekusi" /><Metric icon={Activity} label="Runtime status" value="Gated" sub="Approval + API secret" /></div>
          <div className="two-col"><div className="panel"><div className="panel-head"><div><h3>Build your workspace</h3><p>Langkah awal implementasi</p></div><span className="muted-tag">FOUNDATION</span></div>{tasks.map((t,i)=><div className="task-row" key={t.name}><div className={'task-check '+(t.state==='Complete'?'done':'')}>{t.state==='Complete'?<CheckCircle2 size={17}/>:<span>{i+1}</span>}</div><div className="task-name">{t.name}</div><span className={'task-state '+(t.state==='Complete'?'good':'')}>{t.state}</span></div>)}</div><div className="panel gradient-panel"><div className="sparkle-bubble"><Sparkles size={20}/></div><div className="eyebrow">START HERE</div><h3>Turn an idea into an agent</h3><p>Buat definisi agent terlebih dahulu. Pilih provider dan tools nanti melalui konfigurasi server yang aman.</p><button className="secondary" onClick={() => setShowCreate(true)}>Open Agent Builder <span>→</span></button><div className="decor-grid"/></div></div>
          <div className="section-title lower"><div><h2>Reference catalog</h2><p>Tiga sumber yang menjadi fondasi Agent OS</p></div><button className="text-btn" onClick={() => setActive('directory')}>Browse directory →</button></div><div className="source-grid">{initialCatalog.slice(0,3).map(item=><SourceCard key={item.name} item={item}/>)}</div>
        </>}
        {active === 'directory' && <><PageHeader eyebrow="DISCOVER / CATALOG" title="AI Directory" subtitle="Cari tools, agent, dan koleksi skill dari sumber yang dapat ditelusuri." action={<span className="muted-tag">SOURCE-LINKED</span>}/><div className="search-row"><div className="search-box"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search tools, agents, frameworks…"/></div><select value={filter} onChange={e=>setFilter(e.target.value)}><option>All</option><option>Skills</option><option>Agents</option><option>Tools</option><option>Infrastructure</option></select></div><div className="result-count">{catalog.length} resources · sumber dan lisensi ditampilkan secara eksplisit</div><div className="catalog-grid">{catalog.map(item=><SourceCard key={item.name} item={item}/>)}</div></>}
        {active === 'skills' && <><PageHeader eyebrow="DISCOVER / EXTENSIONS" title="Skills Studio" subtitle="Kelola metadata dan proses review skill sebelum pemasangan." action={<button className="primary" onClick={()=>setNotice('Import skill memerlukan parser, pemeriksaan lisensi, validasi manifest, dan sandbox. Belum diaktifkan.') }><Plus size={16}/> Import skill</button>}/><div className="status-banner compact"><ShieldCheck size={19}/><div><b>Review before install</b><p>Skill pihak ketiga tidak dijalankan otomatis. Verifikasi sumber, lisensi, akses tool, dan instruksi sebelum menyetujuinya.</p></div></div><div className="catalog-grid">{initialCatalog.filter(x=>x.category==='Skills'||x.category==='Infrastructure').map(item=><SourceCard key={item.name} item={item}/>)}</div><div className="panel"><h3>Skill approval checklist</h3><div className="checklist"><span><CheckCircle2/> Provenance & source URL</span><span><CheckCircle2/> License and redistribution terms</span><span><CheckCircle2/> Requested tools and permissions</span><span><CheckCircle2/> Static security review</span><span><LockKeyhole/> Sandboxed test before activation</span></div></div></>}
        {active === 'agents' && <><PageHeader eyebrow="BUILD / CONFIGURATION" title="Agent Builder" subtitle="Definisikan tujuan, instruksi, dan konfigurasi agent sebelum menghubungkan runtime." action={<button className="primary" onClick={()=>setShowCreate(true)}><Plus size={17}/> New agent</button>}/><div className="agent-list">{agents.map(a=><div className="agent-card" key={a.id}><div className="agent-icon"><Bot size={22}/></div><div className="agent-info"><div className="agent-title"><h3>{a.name}</h3><span className="draft-pill">{a.status}</span></div><p>{a.description}</p><div className="agent-meta"><span><Sparkles size={14}/>{a.model}</span><span><Wrench size={14}/> Tools: none</span></div></div><div className="agent-actions">{a.status === 'Draft' || a.status === 'disabled' ? <button className="secondary small-btn" onClick={()=>changeAgentStatus(a,'review')}>Send to review</button> : null}{a.status === 'review' && ['owner','admin'].includes(workspace?.role) ? <button className="primary small-btn" onClick={()=>changeAgentStatus(a,'approved')}>Approve</button> : null}{a.status === 'approved' ? <button className="primary small-btn" onClick={()=>{setSelectedRunAgent(a);setRunInput('');setRunOutput(null);setShowRun(true)}}>Run test</button> : null}{['owner','admin'].includes(workspace?.role) && a.status === 'approved' ? <button className="secondary small-btn" onClick={()=>changeAgentStatus(a,'disabled')}>Disable</button> : null}</div></div>)}</div><div className="panel"><h3>Execution contract</h3><p className="muted-copy">Agent tidak dapat berjalan hanya karena definisinya tersimpan. Implementasi berikutnya menghubungkan model provider, tool registry, secret storage, batas biaya, dan runtime terisolasi.</p></div></>}
        {active === 'workflows' && <><PageHeader eyebrow="BUILD / ORCHESTRATION" title="Orchestrator" subtitle="Rancang alur multi-step dan multi-agent dengan persetujuan di titik kritis." action={<button className="primary" onClick={()=>setNotice('Workflow editor akan dibuat dengan state persistence, node validation, retry policy, dan approval gates. Runner belum aktif.') }><Plus size={17}/> New workflow</button>}/><div className="workflow-canvas"><div className="canvas-top"><span><GitBranch size={16}/> Untitled workflow</span><span className="draft-pill">Not deployed</span></div><div className="flow-nodes"><FlowNode icon={Sparkles} title="Input" subtitle="User request" /><div className="connector"/><FlowNode icon={Bot} title="Agent step" subtitle="Model + tools" /><div className="connector"/><FlowNode icon={FileCheck2} title="Review gate" subtitle="Human approval" /><div className="connector"/><FlowNode icon={CheckCircle2} title="Output" subtitle="Validated result" /></div><p className="canvas-foot">Conceptual workflow preview · not executable</p></div><div className="metric-grid"><Metric icon={Workflow} label="Workflow drafts" value="0" sub="Belum disimpan" /><Metric icon={GitBranch} label="Approval gates" value="Design" sub="Human-in-the-loop" /><Metric icon={Activity} label="Runs" value="0" sub="Runner belum terhubung" /></div></>}
        {active === 'runtime' && <><PageHeader eyebrow="OPERATE / SECURITY" title="Secure Runtime" subtitle="Runtime terbatas untuk model teks, dengan autentikasi, approval gate, audit, dan batas permintaan." action={<span className="live-pill"><i/> GUARDED MODE</span>}/><div className="runtime-hero"><div className="runtime-lock"><ShieldCheck size={30}/></div><div><h2>Guarded text-only execution</h2><p>Mode terbatas hanya mengirim prompt ke provider model melalui server. Agent wajib berstatus approved, pengguna harus memiliki izin workspace, dan setiap run dicatat. Kode agent, skill pihak ketiga, shell, filesystem, browser, serta tool eksternal tetap diblokir karena sandbox terisolasi belum dipasang.</p></div></div><div className="security-grid">{[['Provider secrets','Kredensial dibaca dari server environment; tidak dikirim ke browser.'],['Sandbox isolation','BELUM AKTIF — eksekusi kode dan skill tetap diblokir.'],['Least privilege','Run memerlukan sesi valid, keanggotaan workspace, dan role yang diizinkan.'],['Network controls','Mode ini tidak menyediakan network tools untuk agent; sandbox egress policy belum tersedia.'],['Budget limits','Input dibatasi 12.000 karakter dan output model 1.200 token; batas biaya provider masih perlu dikonfigurasi.'],['Approval gates','Hanya agent berstatus approved yang dapat dijalankan; status dan hasil run dicatat dalam audit.']].map(([t,d],i)=><div className="security-card" key={t}><LockKeyhole size={18}/><b>{t}</b><p>{d}</p><span className="task-state">{i===2||i===5?'Enforced in API':i===0?'Server-side':'Not enabled'}</span></div>)}</div></>}
        {active === 'evaluation' && <><PageHeader eyebrow="OPERATE / QUALITY" title="Evaluation & Audit" subtitle="Rencanakan pengukuran kualitas, biaya, keandalan, dan jejak tindakan agent." action={<button className="secondary" onClick={()=>setNotice('Evaluasi belum dijalankan: belum ada runtime atau hasil run untuk dinilai.')}>Run evaluation</button>}/><div className="metric-grid"><Metric icon={CheckCircle2} label="Test cases" value="0" sub="Belum dibuat" /><Metric icon={Activity} label="Success rate" value="—" sub="Belum ada eksekusi" /><Metric icon={Database} label="Audit events" value="0" sub="Storage belum terhubung" /><Metric icon={Wrench} label="Tool errors" value="—" sub="Runtime belum aktif" /></div><div className="panel"><h3>Evaluation plan</h3>{['Correctness and groundedness','Tool-call schema and permission checks','Prompt-injection and untrusted-input tests','Latency, token usage, and budget limits','Regression tests for each agent revision'].map((x,i)=><div className="task-row" key={x}><div className="task-check"><span>{i+1}</span></div><div className="task-name">{x}</div><span className="task-state">Planned</span></div>)}</div><div className="panel"><h3>Audit event schema (planned)</h3><p className="muted-copy">actor · workspace · agent_version · action · tool · permission_decision · timestamp · result · latency · usage · correlation_id</p></div></>}
        {active === 'governance' && <><PageHeader eyebrow="ADMIN / TRUST" title="Governance & access" subtitle="Kontrol workspace, izin berbasis peran, provenance, dan pengelolaan secret." action={<span className="muted-tag">OWNER VIEW</span>}/><div className="security-grid">{[['Workspace isolation','Data dan konfigurasi tiap workspace harus dipisahkan.'],['Role-based access','Owner, Admin, Builder, Operator, Reviewer, Viewer.'],['Secret management','Kredensial provider hanya tersedia pada server runtime.'],['Audit trail','Catat perubahan konfigurasi dan keputusan akses.'],['License registry','Simpan sumber, versi, lisensi, dan pemeriksaan terakhir.'],['Data retention','Tetapkan masa simpan log, ekspor, dan penghapusan.']].map(([t,d])=><div className="security-card" key={t}><ShieldCheck size={18}/><b>{t}</b><p>{d}</p><span className="task-state">Design defined</span></div>)}</div><div className="panel"><h3>Connected identity</h3><div className="identity-row"><div className="avatar">Y</div><div><b>Yudi8377</b><p>GitHub repository owner · Agent OS workspace preview</p></div><span className="good-pill">Verified</span></div><p className="muted-copy">Identitas tampilan ini belum menjadi sistem autentikasi aplikasi. Implementasi produksi memerlukan autentikasi server, sesi aman, dan RBAC yang diverifikasi di backend.</p></div></>}
      </div>
    </main>
    {showRun && selectedRunAgent && <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget&&!runBusy)setShowRun(false)}}><form className="modal" onSubmit={runSelectedAgent}><div className="modal-head"><div><span className="eyebrow">SECURE RUNTIME</span><h2>Run {selectedRunAgent.name}</h2></div><button type="button" className="icon-btn" disabled={runBusy} onClick={()=>setShowRun(false)}><X/></button></div><p className="muted-copy">Hanya agent berstatus approved yang dapat dijalankan. Input dibatasi 12.000 karakter; eksekusi tidak memiliki akses tools eksternal.</p><label>Prompt<input required maxLength={12000} value={runInput} onChange={e=>setRunInput(e.target.value)} placeholder="Apa yang ingin dikerjakan agent ini?"/></label>{runOutput && <div className="run-result"><b>{runOutput.error ? 'Run belum berhasil' : 'Hasil agent'}</b><pre>{runOutput.error || runOutput.output || JSON.stringify(runOutput,null,2)}</pre>{runOutput.run_id && <small>Run ID: {runOutput.run_id}</small>}</div>}<div className="modal-actions"><button type="button" className="secondary" disabled={runBusy} onClick={()=>setShowRun(false)}>Close</button><button className="primary" disabled={runBusy||!runInput.trim()} type="submit">{runBusy?'Running…':'Run agent'}</button></div></form></div>}
    {showCreate && <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setShowCreate(false)}}><form className="modal" onSubmit={createAgent}><div className="modal-head"><div><span className="eyebrow">AGENT BUILDER</span><h2>Create agent draft</h2></div><button type="button" className="icon-btn" onClick={()=>setShowCreate(false)}><X/></button></div><label>Agent name<input required value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})} placeholder="e.g. Research Assistant"/></label><label>Purpose<input required value={draft.purpose} onChange={e=>setDraft({...draft,purpose:e.target.value})} placeholder="What should this agent help with?"/></label><label>Instructions<textarea value={draft.instructions} onChange={e=>setDraft({...draft,instructions:e.target.value})} placeholder="Define behavior, boundaries, and output format…" rows={4}/></label><div className="modal-warning"><LockKeyhole size={16}/> Agent disimpan di database. Agent harus melalui review dan approval; panggilan model membutuhkan secret server yang valid.</div><div className="modal-actions"><button type="button" className="secondary" onClick={()=>setShowCreate(false)}>Cancel</button><button className="primary" type="submit"><Plus size={16}/> Save draft</button></div></form></div>}
  </div>;
}

function Metric({icon:Icon,label,value,sub}) { return <div className="metric-card"><div className="metric-top"><span>{label}</span><Icon size={17}/></div><strong>{value}</strong><small>{sub}</small></div>; }
function PageHeader({eyebrow,title,subtitle,action}) { return <div className="subpage-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{subtitle}</p></div>{action}</div>; }
function SourceCard({item}) { return <article className="source-card"><div className="source-icon"><AppWindow size={19}/></div><div className="source-type">{item.type}</div><h3>{item.name}</h3><p>{item.detail}</p><div className="source-meta"><span>{item.license}</span></div><a href={item.url} target="_blank" rel="noreferrer">View source <span>↗</span></a></article>; }
function FlowNode({icon:Icon,title,subtitle}) { return <div className="flow-node"><div><Icon size={19}/></div><b>{title}</b><small>{subtitle}</small></div>; }

function App() {
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [authMode, setAuthMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [workspace, setWorkspace] = useState(null);
  const [workspaceName, setWorkspaceName] = useState('');
  const [workspaceSlug, setWorkspaceSlug] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!supabase) { setAuthReady(true); return; }
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setAuthReady(true); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!supabase || !session?.user?.id) { setWorkspace(null); return; }
    let alive = true;
    supabase.from('workspace_members').select('workspace_id,role,workspaces(id,name,slug)')
      .eq('user_id', session.user.id).limit(1).maybeSingle()
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) { setMessage('Database belum siap. Terapkan migrasi Agent OS terlebih dahulu: ' + error.message); return; }
        if (data?.workspaces) setWorkspace({ ...data.workspaces, role: data.role });
        else setWorkspace(null);
      });
    return () => { alive = false; };
  }, [session?.user?.id]);

  async function submitAuth(e) {
    e.preventDefault(); setBusy(true); setMessage('');
    try {
      if (authMode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { display_name: displayName }, emailRedirectTo: 'https://yudi8377.github.io/AGENT-OS/' } });
        if (error) throw error;
        if (!data.session) setMessage('Pendaftaran diterima. Periksa email untuk konfirmasi, lalu masuk.');
        else setMessage('Akun berhasil dibuat. Lanjutkan membuat workspace.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) { setMessage(err.message || 'Autentikasi gagal.'); }
    finally { setBusy(false); }
  }

  async function createWorkspace(e) {
    e.preventDefault(); setBusy(true); setMessage('');
    const slug = (workspaceSlug || workspaceName).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
    if (slug.length < 3 || !/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug)) {
      setMessage('Slug harus 3–60 karakter, huruf kecil, angka, atau tanda hubung.'); setBusy(false); return;
    }
    try {
      const { data: ws, error: wsError } = await supabase.rpc('create_workspace', {
        p_name: workspaceName.trim(),
        p_slug: slug
      }).single();
      if (wsError) throw wsError;
      setWorkspace({ ...ws, role: 'owner' });
    } catch (err) { setMessage('Workspace belum dibuat: ' + (err.message || 'kesalahan tidak diketahui')); }
    finally { setBusy(false); }
  }

  if (!authReady) return <div className="gate"><div className="gate-card"><div className="brand-mark"><Command size={22}/></div><h1>Agent OS</h1><p>Memeriksa sesi aman…</p></div></div>;
  if (!supabaseConfigured) return <div className="gate"><div className="gate-card"><div className="brand-mark"><Command size={22}/></div><div className="eyebrow">SETUP REQUIRED</div><h1>Connect your workspace</h1><p>Untuk mengaktifkan akun dan database, siapkan proyek Supabase khusus Agent OS lalu isi variabel lingkungan berikut.</p><pre>VITE_SUPABASE_URL{ '\n' }VITE_SUPABASE_PUBLISHABLE_KEY</pre><p className="gate-foot">Lihat .env.example dan docs/architecture.md. Jangan gunakan service-role key di browser.</p></div></div>;
  if (!session) return <div className="gate"><form className="gate-card" onSubmit={submitAuth}><div className="brand-mark"><Command size={22}/></div><div className="eyebrow">SECURE WORKSPACE ACCESS</div><h1>{authMode === 'signin' ? 'Welcome back.' : 'Create your account.'}</h1><p>{authMode === 'signin' ? 'Masuk untuk membuka workspace Agent OS.' : 'Daftar dengan email dan password. Konfirmasi email mungkin diperlukan.'}</p>{authMode === 'signup' && <label>Nama tampilan<input required value={displayName} onChange={e=>setDisplayName(e.target.value)} autoComplete="name" placeholder="Nama Anda"/></label>}<label>Email<input required type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" placeholder="you@example.com"/></label><label>Password<input required type="password" minLength={8} value={password} onChange={e=>setPassword(e.target.value)} autoComplete={authMode==='signin'?'current-password':'new-password'} placeholder="Minimal 8 karakter"/></label>{message && <div className="gate-message">{message}</div>}<button className="primary gate-submit" disabled={busy} type="submit">{busy?'Processing…':authMode==='signin'?'Sign in':'Create account'}</button><button className="gate-switch" type="button" onClick={()=>{setAuthMode(authMode==='signin'?'signup':'signin');setMessage('')}}>{authMode==='signin'?'Belum punya akun? Daftar':'Sudah punya akun? Masuk'}</button><small>Autentikasi menggunakan Supabase Auth. Eksekusi agent tetap nonaktif.</small></form></div>;
  if (!workspace) return <div className="gate"><form className="gate-card" onSubmit={createWorkspace}><div className="brand-mark"><Command size={22}/></div><div className="eyebrow">FIRST-TIME SETUP</div><h1>Create a workspace.</h1><p>Workspace memisahkan agent dan data. Anda akan menjadi owner workspace ini.</p><label>Nama workspace<input required maxLength={120} value={workspaceName} onChange={e=>{setWorkspaceName(e.target.value);if(!workspaceSlug)setWorkspaceSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,''))}} placeholder="My AI Workspace"/></label><label>Workspace slug<input required minLength={3} maxLength={60} pattern="[a-z0-9][a-z0-9-]*[a-z0-9]" value={workspaceSlug} onChange={e=>setWorkspaceSlug(e.target.value)} placeholder="my-ai-workspace"/></label>{message && <div className="gate-message">{message}</div>}<button className="primary gate-submit" disabled={busy} type="submit">{busy?'Creating…':'Create workspace'}</button><button className="gate-switch" type="button" onClick={()=>supabase.auth.signOut()}>Sign out</button></form></div>;
  return <Dashboard user={session.user} workspace={workspace} onSignOut={() => supabase.auth.signOut()} />;
}

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
