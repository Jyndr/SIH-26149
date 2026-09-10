import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Download, Eraser, HardDrive, RefreshCw, ShieldCheck } from 'lucide-react';
import { casesApi, evidenceApi, nativeAgentApi, sanitizationApi } from '../services/api';
import { StatusBadge } from '../components/common/StatusBadge';

const formatBytes = (bytes = 0) => {
  if (!bytes) return 'Unknown';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / (1024 ** index)).toFixed(index > 2 ? 1 : 0)} ${units[index]}`;
};

export const SanitizationPage = () => {
  const { caseId: routeCaseId } = useParams();
  const [cases, setCases] = useState([]);
  const [caseId, setCaseId] = useState(routeCaseId || '');
  const [devices, setDevices] = useState([]);
  const [deviceId, setDeviceId] = useState('');
  const [method, setMethod] = useState('CLEAR');
  const [targetScope, setTargetScope] = useState('DEVICE');
  const [artifactId, setArtifactId] = useState('');
  const [evidence, setEvidence] = useState([]);
  const [executeLive, setExecuteLive] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [plan, setPlan] = useState(null);
  const [result, setResult] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const device = useMemo(() => devices.find((item) => item.id === deviceId), [devices, deviceId]);

  const loadDevices = async () => {
    setError('');
    try {
      const response = await nativeAgentApi.listDevices();
      const available = response.data || [];
      setDevices(available);
      setDeviceId((current) => current || available.find((item) => item.removable || item.bus === 'USB')?.id || '');
    } catch (err) {
      setDevices([]);
      setError(`Native Agent unavailable: ${err.response?.data?.error?.message || err.message}`);
    }
  };

  useEffect(() => {
    casesApi.list().then((response) => {
      const items = response.data || [];
      setCases(items);
      setCaseId((current) => current || items[0]?.caseId || '');
    });
    loadDevices();
  }, []);

  useEffect(() => {
    setPlan(null);
    setResult(null);
    setArtifactId('');
    setEvidence([]);
    if (caseId) {
      sanitizationApi.listByCase(caseId).then((response) => setJobs(response.data || []));
      evidenceApi.listByCase(caseId).then((response) => setEvidence(response.data || []));
    }
  }, [caseId]);

  useEffect(() => {
    if (!caseId || !deviceId) return;
    if (targetScope === 'FILE' && !artifactId.trim()) {
      setPlan(null);
      return;
    }
    nativeAgentApi.prepareSanitization(caseId, {
      deviceId, method, targetScope, artifactId: targetScope === 'FILE' ? artifactId.trim() : undefined,
    })
      .then((response) => setPlan(response.data))
      .catch((err) => setError(err.response?.data?.error?.message || err.message));
  }, [caseId, deviceId, method, targetScope, artifactId]);

  const runSanitization = async () => {
    setBusy(true);
    setError('');
    try {
      const response = await nativeAgentApi.startSanitization(caseId, {
        deviceId,
        method,
        targetScope,
        artifactId: targetScope === 'FILE' ? artifactId.trim() : undefined,
        execute: executeLive,
        confirmation: executeLive ? confirmation.trim() : undefined,
      });
      setResult(response.data);
      const history = await sanitizationApi.listByCase(caseId);
      setJobs(history.data || []);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    } finally {
      setBusy(false);
    }
  };

  const downloadAudit = () => {
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const anchor = document.createElement('a');
    anchor.href = URL.createObjectURL(blob);
    anchor.download = `${result.jobId || 'sanitization'}-audit.json`;
    anchor.click();
    URL.revokeObjectURL(anchor.href);
  };

  return <div className="space-y-6 max-w-6xl mx-auto">
    <div className="border-b border-slate-200 pb-4">
      <Link to={caseId ? `/cases/${caseId}` : '/cases'} className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1"><ArrowLeft className="w-3.5 h-3.5" /> {caseId ? `Case ${caseId}` : 'Cases'}</Link>
      <div className="flex items-center justify-between mt-2 gap-4"><div><h1 className="text-2xl font-bold text-slate-900">Secure Erasure</h1><p className="text-sm text-slate-600 mt-1">Device inspection, guarded live erasure, and audit-ready sanitization records.</p></div><StatusBadge status={executeLive ? 'LIVE' : 'DRY_RUN'} size="md" /></div>
    </div>

    <div className="p-4 border border-amber-300 bg-amber-50 rounded-lg flex gap-3 text-sm text-amber-950"><AlertTriangle className="w-5 h-5 shrink-0" /><div><strong>Live erasure is destructive.</strong> It is only available for whole, removable, unmounted drives when the native agent is started with destructive erasure enabled.</div></div>

    <div className="grid lg:grid-cols-2 gap-6">
      <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
        <h2 className="text-sm font-semibold flex items-center gap-2"><HardDrive className="w-4 h-4 text-blue-600" /> Connected Storage</h2>
        <label className="block text-xs font-medium text-slate-700">Case</label>
        <select value={caseId} onChange={(event) => setCaseId(event.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm">
          <option value="">{cases.length ? 'Select case' : 'No cases found'}</option>
          {cases.map((item) => <option key={item.caseId} value={item.caseId}>{item.caseId} - {item.title}</option>)}
        </select>
        {!cases.length && <p className="text-xs text-slate-500">Create or seed a case before starting a sanitization workflow.</p>}
        <div className="flex items-center justify-between"><label className="text-xs font-medium text-slate-700">Physical target</label><button type="button" onClick={loadDevices} title="Refresh devices" className="p-2 border border-slate-200 rounded-md hover:bg-slate-50"><RefreshCw className="w-4 h-4" /></button></div>
        <select value={deviceId} onChange={(event) => setDeviceId(event.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"><option value="">Select connected removable storage</option>{devices.map((item) => <option key={item.id} value={item.id}>{item.name} - {formatBytes(item.size)} {item.removable ? '(Removable)' : ''}</option>)}</select>
        {device && <dl className="grid grid-cols-2 gap-3 text-xs bg-slate-50 border border-slate-200 rounded-md p-4">
          <div><dt className="text-slate-500">Vendor / model</dt><dd className="font-medium">{[device.vendor, device.model].filter(Boolean).join(' ') || device.name}</dd></div><div><dt className="text-slate-500">Capacity</dt><dd className="font-medium">{formatBytes(device.size)}</dd></div>
          <div><dt className="text-slate-500">Filesystem</dt><dd className="font-medium">{device.filesystem || 'Unknown'}</dd></div><div><dt className="text-slate-500">Status</dt><dd className="font-medium">{device.mounted ? 'Mounted' : 'Connected / unmounted'}</dd></div>
          <div><dt className="text-slate-500">Bus</dt><dd className="font-medium">{device.bus || 'Unknown'}</dd></div><div><dt className="text-slate-500">Removable</dt><dd className="font-medium">{device.removable ? 'Yes' : 'No'}</dd></div>
        </dl>}
      </section>

      <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
        <h2 className="text-sm font-semibold flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-blue-600" /> Sanitization Plan</h2>
        <label className="block text-xs font-medium text-slate-700">Target scope</label>
        <div className="grid grid-cols-2 border border-slate-300 rounded-md overflow-hidden">
          <button type="button" onClick={() => setTargetScope('FILE')} className={`px-3 py-2 text-sm ${targetScope === 'FILE' ? 'bg-blue-600 text-white' : 'bg-white text-slate-700'}`}>One file</button>
          <button type="button" onClick={() => { setTargetScope('DEVICE'); setArtifactId(''); }} className={`px-3 py-2 text-sm ${targetScope === 'DEVICE' ? 'bg-blue-600 text-white' : 'bg-white text-slate-700'}`}>Entire device</button>
        </div>
        {targetScope === 'FILE' && <div className="space-y-2"><label className="block text-xs font-medium text-slate-700">Evidence artifact</label><select value={artifactId} onChange={(event) => setArtifactId(event.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"><option value="">{evidence.length ? 'Select evidence artifact' : 'No evidence in this case'}</option>{evidence.map((item) => <option key={item.evidenceId} value={item.evidenceId}>{item.evidenceId} - {item.originalFilename || item.storedFilename || 'Evidence file'}</option>)}</select><input value={artifactId} onChange={(event) => setArtifactId(event.target.value)} placeholder="Or paste a filesystem record ID" className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" /><p className="text-xs text-slate-500">Cyphora stores the ID with uploaded or recovered evidence; manual entry is only for low-level filesystem records.</p></div>}
        <label className="block text-xs font-medium text-slate-700">Requested method</label>
        <select value={method} onChange={(event) => setMethod(event.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"><option value="CLEAR">CLEAR</option><option value="PURGE">PURGE</option><option value="CRYPTOGRAPHIC_ERASE">CRYPTOGRAPHIC ERASE</option><option value="DESTROY">DESTROY</option></select>
        <div className="border border-slate-200 rounded-md p-4 text-sm space-y-2"><div className="flex justify-between"><span className="text-slate-500">Recommended</span><strong>{plan?.recommendedMethod || 'Pending inspection'}</strong></div><div className="flex justify-between"><span className="text-slate-500">Live capable</span><strong>{plan?.supported ? 'Yes' : 'No'}</strong></div><div className="flex justify-between"><span className="text-slate-500">Mode</span><strong>{executeLive ? 'LIVE' : 'DRY_RUN'}</strong></div>{plan?.requirements?.length > 0 && <div className="pt-2 border-t border-slate-100"><span className="text-slate-500 text-xs">Required countermeasures</span><ul className="mt-1 space-y-1 text-xs text-slate-700">{plan.requirements.map((item) => <li key={item}>- {item}</li>)}</ul></div>}<p className="text-xs text-slate-600 pt-2 border-t border-slate-100">{plan?.reason || 'Select a connected device and scope to inspect capabilities.'}</p></div>
        <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={executeLive} onChange={(event) => setExecuteLive(event.target.checked)} disabled={!plan?.supported} /> Execute live erasure</label>
        {executeLive && <div><label className="block text-xs font-medium text-slate-700 mb-1">Type confirmation</label><input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder={device ? `ERASE ${device.name}` : 'ERASE device name'} className="w-full border border-rose-300 rounded-md px-3 py-2 text-sm" /></div>}
        <button type="button" onClick={runSanitization} disabled={busy || !caseId || !deviceId || (targetScope === 'FILE' && !artifactId.trim()) || (executeLive && confirmation.trim() !== `ERASE ${device?.name}`)} className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md disabled:opacity-40 flex justify-center items-center gap-2"><Eraser className="w-4 h-4" /> {busy ? 'Working...' : executeLive ? 'Erase Device' : 'Run Dry-Run Plan'}</button>
      </section>
    </div>

    {error && <div className="p-3 border border-rose-200 bg-rose-50 text-rose-700 rounded-md text-sm">{error}</div>}
    {result && <section className="bg-white border border-slate-200 rounded-lg p-5"><div className="flex items-center justify-between gap-4"><div><h2 className="font-semibold text-slate-900">{result.executed ? 'Erasure completed' : 'Dry-run audit created'}</h2><p className="text-sm text-slate-600">{result.reason || `Verification status: ${result.verificationStatus || 'NOT_EXECUTED'}.`}</p></div><button type="button" onClick={downloadAudit} className="px-3 py-2 border border-slate-300 rounded-md text-sm flex items-center gap-2"><Download className="w-4 h-4" /> Audit JSON</button></div></section>}
    <section className="bg-white border border-slate-200 rounded-lg overflow-hidden"><div className="px-5 py-4 border-b border-slate-200"><h2 className="text-sm font-semibold">Case Sanitization Audit</h2></div><div className="divide-y divide-slate-100">{jobs.length ? jobs.map((job) => <div key={job.sanitizationId} className="px-5 py-3 grid grid-cols-4 gap-3 text-xs"><span className="font-mono">{job.sanitizationId}</span><span>{job.method}</span><span>{job.mode || 'DRY_RUN'}</span><span>{job.verificationStatus || 'NOT_EXECUTED'}</span></div>) : <p className="p-5 text-sm text-slate-500">No dry-run records for this case.</p>}</div></section>
  </div>;
};
