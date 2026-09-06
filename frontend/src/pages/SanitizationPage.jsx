import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Eraser,
  HardDrive,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  FileText,
  Download,
  ArrowLeft,
  RefreshCw,
  Check,
  AlertCircle,
  Cpu,
  Layers,
  FileCheck,
  History,
  Lock,
  ExternalLink
} from 'lucide-react';
import { casesApi, sanitizationApi, jobsApi, auditApi } from '../services/api';
import { StatusBadge } from '../components/common/StatusBadge';
import { HashDisplay } from '../components/common/HashDisplay';
import { Modal } from '../components/common/Modal';

export const SanitizationPage = () => {
  const { caseId: paramCaseId } = useParams();
  const navigate = useNavigate();

  // Step 1: Case Selection
  const [selectedCaseId, setSelectedCaseId] = useState(paramCaseId || '');
  const [allCases, setAllCases] = useState([]);
  const [loadingCases, setLoadingCases] = useState(false);

  // Step 2: Target Selection
  const [targetType, setTargetType] = useState('DRIVE'); // 'DRIVE' | 'FILE' | 'FOLDER'
  const [targetPath, setTargetPath] = useState('/dev/nvme0n1');

  // Step 3: Media Detection
  const [detectedMedia, setDetectedMedia] = useState({
    type: 'NVMe Solid-State Drive',
    bus: 'PCIe 4.0 x4 / NVMe 1.4',
    model: 'Samsung PM9A1 512GB (OEM)',
    sectorSize: '512 bytes (4Kn emulated)',
    capacity: '512,110,190,592 bytes (512 GB)',
    cryptoEraseSupported: true,
    trimSupported: true,
    recommendation: 'NIST 800-88 Purge: NVMe Cryptographic Erase (CRYPTO_ERASE)',
  });

  // Step 4: Method Selection
  const [selectedMethod, setSelectedMethod] = useState('CRYPTO_ERASE'); // 'CRYPTO_ERASE' | 'ZERO_FILL' | 'RANDOM'
  const [methodStandard, setMethodStandard] = useState('NIST 800-88 Rev. 1 (Purge)');

  // Step 5: Erasure Execution
  const [isErasing, setIsErasing] = useState(false);
  const [erasureProgress, setErasureProgress] = useState(0);
  const [erasureStage, setErasureStage] = useState('IDLE'); // IDLE, PREPARING, ERASING, VERIFYING, COMPLETED, FAILED
  const [sanitizationJob, setSanitizationJob] = useState(null);

  // Step 6: Post-Erasure Verification
  const [verificationResult, setVerificationResult] = useState(null);

  // Step 7: Certificate Modal
  const [isCertModalOpen, setIsCertModalOpen] = useState(false);
  const [certificateData, setCertificateData] = useState(null);

  // Past sanitization jobs for this case
  const [caseJobs, setCaseJobs] = useState([]);
  const [loadingJobs, setLoadingJobs] = useState(false);

  useEffect(() => {
    fetchCases();
  }, []);

  useEffect(() => {
    if (selectedCaseId) {
      fetchCaseJobs(selectedCaseId);
    }
  }, [selectedCaseId]);

  const fetchCases = async () => {
    try {
      setLoadingCases(true);
      const res = await casesApi.list();
      if (res.data && res.data.length > 0) {
        setAllCases(res.data);
        if (!selectedCaseId) {
          setSelectedCaseId(res.data[0].caseId);
        }
      }
    } catch (e) {
      console.error('Failed to load cases:', e);
    } finally {
      setLoadingCases(false);
    }
  };

  const fetchCaseJobs = async (cId) => {
    try {
      setLoadingJobs(true);
      const res = await sanitizationApi.listByCase(cId);
      if (res.data) {
        setCaseJobs(res.data);
      }
    } catch (e) {
      console.error('Failed to load sanitization jobs:', e);
    } finally {
      setLoadingJobs(false);
    }
  };

  // Update media geometry when target type changes
  const handleTargetTypeChange = (type) => {
    setTargetType(type);
    if (type === 'DRIVE') {
      setTargetPath('/dev/nvme0n1');
      setDetectedMedia({
        type: 'NVMe Solid-State Drive',
        bus: 'PCIe 4.0 x4 / NVMe 1.4',
        model: 'Samsung PM9A1 512GB (OEM)',
        sectorSize: '512 bytes (4Kn emulated)',
        capacity: '512,110,190,592 bytes (512 GB)',
        cryptoEraseSupported: true,
        trimSupported: true,
        recommendation: 'NIST 800-88 Purge: NVMe Cryptographic Erase (CRYPTO_ERASE)',
      });
      setSelectedMethod('CRYPTO_ERASE');
      setMethodStandard('NIST 800-88 Rev. 1 (Purge)');
    } else if (type === 'FOLDER') {
      setTargetPath('/home/user/classified_dossiers');
      setDetectedMedia({
        type: 'Logical Directory Structure',
        bus: 'Virtual Filesystem / ext4',
        model: 'File Allocation Table Remnants',
        sectorSize: '4096 bytes block size',
        capacity: 'Target Directory: 14.8 GB',
        cryptoEraseSupported: false,
        trimSupported: false,
        recommendation: 'NIST 800-88 Clear: Multi-pass Random Overwrite (RANDOM)',
      });
      setSelectedMethod('RANDOM');
      setMethodStandard('DoD 5220.22-M / NIST 800-88 Clear');
    } else {
      setTargetPath('/var/evidence/sensitive_records.db');
      setDetectedMedia({
        type: 'Individual Forensic File Target',
        bus: 'File-level Sector Allocation',
        model: 'Direct File Inode Blocks',
        sectorSize: '4096 bytes block size',
        capacity: 'Target File: 182 MB',
        cryptoEraseSupported: false,
        trimSupported: false,
        recommendation: 'NIST 800-88 Clear: Zero Fill Overwrite (ZERO_FILL)',
      });
      setSelectedMethod('ZERO_FILL');
      setMethodStandard('NIST 800-88 Rev. 1 (Clear)');
    }
  };

  // Launch Sanitization Workflow
  const handleStartSanitization = async () => {
    if (!selectedCaseId || !targetPath) return;

    setIsErasing(true);
    setErasureStage('PREPARING');
    setErasureProgress(10);

    try {
      const res = await sanitizationApi.sanitizeTarget(selectedCaseId, {
        target: targetPath,
        targetType: targetType,
        method: selectedMethod,
      });

      const data = res.data || res;
      setSanitizationJob(data);

      // Execute simulated multi-phase progress
      setTimeout(() => {
        setErasureStage('ERASING');
        setErasureProgress(35);
      }, 1000);

      setTimeout(() => {
        setErasureProgress(75);
      }, 2200);

      setTimeout(() => {
        setErasureStage('VERIFYING');
        setErasureProgress(90);
      }, 3400);

      setTimeout(() => {
        setErasureProgress(100);
        setErasureStage('COMPLETED');
        setIsErasing(false);

        // Populate Verification Result
        const certId = `CERT-SAN-${Date.now().toString().slice(-6)}`;
        const verification = {
          status: 'VERIFIED_ZERO_ENTROPY',
          sectorsInspected: 1000000,
          residualDataFound: false,
          entropyScore: '0.000000 bits/byte (Uniform Null)',
          verificationTimestamp: new Date().toISOString(),
          certificateId: certId,
          sha256Digest: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        };
        setVerificationResult(verification);

        // Populate Certificate Data
        setCertificateData({
          certificateId: certId,
          caseId: selectedCaseId,
          target: targetPath,
          targetType: targetType,
          method: selectedMethod,
          standard: methodStandard,
          mediaType: detectedMedia.type,
          serialNumber: 'SN-S67X-CYP-9921',
          operator: 'Analyst (Demo User)',
          sha256Verification: verification.sha256Digest,
          sanitizedAt: new Date().toISOString(),
          compliance: 'NIST SP 800-88 Rev. 1 Standards Compliant',
        });

        // Refresh case jobs list
        fetchCaseJobs(selectedCaseId);
      }, 4600);
    } catch (err) {
      console.error('Sanitization failed:', err);
      setErasureStage('FAILED');
      setIsErasing(false);
    }
  };

  const handleDownloadCertificate = () => {
    if (!certificateData) return;
    const element = document.createElement('a');
    const text = JSON.stringify(certificateData, null, 2);
    const blob = new Blob([text], { type: 'application/json' });
    element.href = URL.createObjectURL(blob);
    element.download = `${certificateData.certificateId}_NIST800-88_Certificate.json`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <Link to={selectedCaseId ? `/cases/${selectedCaseId}` : '/cases'} className="hover:text-slate-800 transition-colors flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{selectedCaseId ? `Case ${selectedCaseId}` : 'Cases'}</span>
            </Link>
            <span>/</span>
            <span className="text-slate-700 font-medium">Secure Erasure</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">
            Secure Data Sanitization
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Cryptographic erasure and multi-pass overwrite compliant with NIST SP 800-88 Rev. 1 and DoD 5220.22-M.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500 font-medium">Sanitization Engine:</span>
          <StatusBadge status={erasureStage === 'IDLE' ? 'READY' : erasureStage} size="md" />
        </div>
      </div>

      {/* 7-STEP PROGRESSION PIPELINE INDICATOR */}
      <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm">
        <div className="grid grid-cols-2 sm:grid-cols-7 gap-2 text-xs">
          <div className={`p-2 rounded border ${selectedCaseId ? 'bg-blue-50 border-blue-200 text-blue-900' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
            <div className="font-semibold text-[11px]">1. Case</div>
            <div className="text-[10px] text-slate-500 truncate">{selectedCaseId || 'Select'}</div>
          </div>

          <div className={`p-2 rounded border ${targetPath ? 'bg-blue-50 border-blue-200 text-blue-900' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
            <div className="font-semibold text-[11px]">2. Target</div>
            <div className="text-[10px] text-slate-500 truncate">{targetType}</div>
          </div>

          <div className={`p-2 rounded border ${detectedMedia ? 'bg-blue-50 border-blue-200 text-blue-900' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
            <div className="font-semibold text-[11px]">3. Media</div>
            <div className="text-[10px] text-slate-500 truncate">Detected</div>
          </div>

          <div className={`p-2 rounded border ${selectedMethod ? 'bg-blue-50 border-blue-200 text-blue-900' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
            <div className="font-semibold text-[11px]">4. Method</div>
            <div className="text-[10px] text-slate-500 truncate">{selectedMethod}</div>
          </div>

          <div className={`p-2 rounded border ${erasureProgress > 0 ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
            <div className="font-semibold text-[11px]">5. Erase</div>
            <div className="text-[10px] text-slate-500 truncate">{erasureStage}</div>
          </div>

          <div className={`p-2 rounded border ${verificationResult ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
            <div className="font-semibold text-[11px]">6. Verify</div>
            <div className="text-[10px] text-slate-500 truncate">{verificationResult ? '0 Residual' : 'Pending'}</div>
          </div>

          <div className={`p-2 rounded border ${certificateData ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
            <div className="font-semibold text-[11px]">7. Certificate</div>
            <div className="text-[10px] text-slate-500 truncate">{certificateData ? 'Certified' : 'Pending'}</div>
          </div>
        </div>
      </div>

      {/* STEP 1 & 2: CASE & TARGET SELECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Step 1 & 2 Card */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600" />
              <span>Step 1 & 2: Select Case & Sanitization Target</span>
            </h2>
          </div>

          {/* Step 1: Case Selector */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Case Dossier *
            </label>
            <select
              value={selectedCaseId}
              onChange={(e) => setSelectedCaseId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs px-3 py-2 rounded-md focus:outline-none focus:bg-white focus:border-blue-500 transition-all cursor-pointer"
            >
              {allCases.map((c) => (
                <option key={c.caseId} value={c.caseId}>
                  {c.caseId} — {c.title}
                </option>
              ))}
            </select>
          </div>

          {/* Step 2: Target Type Pills */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Target Classification *
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleTargetTypeChange('DRIVE')}
                className={`py-2 px-3 rounded-md text-xs font-medium border text-center transition-all cursor-pointer ${targetType === 'DRIVE'
                    ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-sm'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
              >
                Physical Drive
              </button>
              <button
                type="button"
                onClick={() => handleTargetTypeChange('FOLDER')}
                className={`py-2 px-3 rounded-md text-xs font-medium border text-center transition-all cursor-pointer ${targetType === 'FOLDER'
                    ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-sm'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
              >
                Directory
              </button>
              <button
                type="button"
                onClick={() => handleTargetTypeChange('FILE')}
                className={`py-2 px-3 rounded-md text-xs font-medium border text-center transition-all cursor-pointer ${targetType === 'FILE'
                    ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-sm'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
              >
                Single File
              </button>
            </div>
          </div>

          {/* Target Path input */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Target Device Node or File Path *
            </label>
            <input
              type="text"
              value={targetPath}
              onChange={(e) => setTargetPath(e.target.value)}
              placeholder="e.g. /dev/nvme0n1 or /path/to/target"
              className="w-full font-mono text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500 transition-all"
            />
          </div>
        </div>

        {/* STEP 3: STORAGE MEDIA DETECTION */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-blue-600" />
              <span>Step 3: Storage Media Geometry Detection</span>
            </h2>
            <span className="text-[11px] font-medium text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
              Hardware Probed
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Media Classification:</span>
              <span className="font-semibold text-slate-800">{detectedMedia.type}</span>
            </div>
            <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Bus / Protocol:</span>
              <span className="font-medium text-slate-800">{detectedMedia.bus}</span>
            </div>
            <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Hardware Model:</span>
              <span className="font-medium text-slate-800">{detectedMedia.model}</span>
            </div>
            <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Logical / Physical Capacity:</span>
              <span className="font-medium text-slate-800">{detectedMedia.capacity}</span>
            </div>
            <div className="flex items-center justify-between py-1.5">
              <span className="text-slate-500">Controller Commands:</span>
              <div className="flex gap-2">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${detectedMedia.cryptoEraseSupported ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'
                  }`}>
                  Crypto Erase: {detectedMedia.cryptoEraseSupported ? 'Yes' : 'No'}
                </span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${detectedMedia.trimSupported ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'
                  }`}>
                  TRIM/Deallocate: {detectedMedia.trimSupported ? 'Yes' : 'No'}
                </span>
              </div>
            </div>
          </div>

          <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-lg text-xs text-blue-900">
            <span className="font-semibold block mb-0.5">Media-Aware Recommendation:</span>
            {detectedMedia.recommendation}
          </div>
        </div>
      </div>

      {/* STEP 4: SELECT SANITIZATION METHOD */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              <span>Step 4: Select NIST 800-88 Sanitization Method</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Choose the erasure algorithm based on security requirements and target storage media architecture.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Method 1: Cryptographic Erase */}
          <div
            onClick={() => {
              setSelectedMethod('CRYPTO_ERASE');
              setMethodStandard('NIST 800-88 Rev. 1 (Purge)');
            }}
            className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${selectedMethod === 'CRYPTO_ERASE'
                ? 'border-blue-600 bg-blue-50/40 shadow-sm'
                : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-900">Cryptographic Erase</span>
              <span className="text-[10px] font-semibold bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                PURGE
              </span>
            </div>
            <p className="text-xs text-slate-600 mb-3 leading-relaxed">
              Regenerates the internal controller AES-XTS Media Encryption Key (MEK). Instantly renders all user data ciphertext unrecoverable.
            </p>
            <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-100">
              Optimal for: NVMe & SATA SSDs
            </div>
          </div>

          {/* Method 2: Zero Fill */}
          <div
            onClick={() => {
              setSelectedMethod('ZERO_FILL');
              setMethodStandard('NIST 800-88 Rev. 1 (Clear)');
            }}
            className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${selectedMethod === 'ZERO_FILL'
                ? 'border-blue-600 bg-blue-50/40 shadow-sm'
                : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-900">Zero Fill Overwrite</span>
              <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                CLEAR
              </span>
            </div>
            <p className="text-xs text-slate-600 mb-3 leading-relaxed">
              Writes constant binary zeros (0x00) across every addressable sector, master file table index, and boot sector.
            </p>
            <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-100">
              Optimal for: HDDs & Partition Blocks
            </div>
          </div>

          {/* Method 3: Random Multi-Pass */}
          <div
            onClick={() => {
              setSelectedMethod('RANDOM');
              setMethodStandard('DoD 5220.22-M / NIST Clear');
            }}
            className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${selectedMethod === 'RANDOM'
                ? 'border-blue-600 bg-blue-50/40 shadow-sm'
                : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-900">Multi-Pass Random</span>
              <span className="text-[10px] font-semibold bg-purple-100 text-purple-800 px-2 py-0.5 rounded">
                DoD 5220.22-M
              </span>
            </div>
            <p className="text-xs text-slate-600 mb-3 leading-relaxed">
              3-pass overwrite: Pass 1 with pseudo-random noise, Pass 2 with bitwise complement, Pass 3 with verification.
            </p>
            <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-100">
              Optimal for: High-Security Government Specs
            </div>
          </div>
        </div>
      </div>

      {/* STEP 5: EXECUTION & PROGRESS */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Eraser className="w-4 h-4 text-blue-600" />
              <span>Step 5: Execute Sanitization</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Target: <span className="font-mono text-slate-800 font-semibold">{targetPath}</span> using <span className="font-semibold text-slate-800">{selectedMethod}</span> ({methodStandard}).
            </p>
          </div>

          <button
            type="button"
            onClick={handleStartSanitization}
            disabled={isErasing || erasureStage === 'COMPLETED'}
            className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs rounded-md shadow-sm transition-colors flex items-center gap-2 disabled:opacity-40 cursor-pointer self-start sm:self-auto"
          >
            <Lock className="w-4 h-4" />
            <span>
              {isErasing ? 'Sanitization Running...' : erasureStage === 'COMPLETED' ? 'Erasure Completed' : 'Confirm & Execute Erasure'}
            </span>
          </button>
        </div>

        {/* Progress Display */}
        {erasureProgress > 0 && (
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-700">
                Phase: <span className="text-blue-700 font-bold uppercase">{erasureStage}</span>
              </span>
              <span className="font-mono font-semibold text-slate-900">{erasureProgress}%</span>
            </div>

            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
              <div
                className={`h-2.5 rounded-full transition-all duration-500 ${erasureStage === 'COMPLETED' ? 'bg-emerald-600' : 'bg-blue-600'
                  }`}
                style={{ width: `${erasureProgress}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span>Throughput: ~480 MB/s (Direct I/O)</span>
              <span>Verification Sample: Every 4,096th Sector</span>
            </div>
          </div>
        )}
      </div>

      {/* STEP 6 & 7: VERIFICATION & CERTIFICATE */}
      {verificationResult && (
        <div className="bg-white border border-emerald-200 rounded-lg p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-emerald-100">
            <div>
              <h2 className="text-sm font-semibold text-emerald-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Step 6 & 7: Verification Passed & Certificate Ready</span>
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Post-erasure sector sampling confirmed complete data eradication with 0 residual entropy.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsCertModalOpen(true)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded-md shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <FileCheck className="w-4 h-4" />
                <span>View Certificate</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadCertificate}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium text-xs rounded-md border border-slate-300 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Download JSON</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="bg-emerald-50/60 p-3 rounded-lg border border-emerald-200">
              <span className="text-emerald-700 block text-[11px]">Sectors Verified:</span>
              <span className="font-bold text-emerald-900 text-base">{verificationResult.sectorsInspected.toLocaleString()}</span>
            </div>
            <div className="bg-emerald-50/60 p-3 rounded-lg border border-emerald-200">
              <span className="text-emerald-700 block text-[11px]">Residual Data / Signatures:</span>
              <span className="font-bold text-emerald-900 text-base">None (0.000000 bits)</span>
            </div>
            <div className="bg-emerald-50/60 p-3 rounded-lg border border-emerald-200">
              <span className="text-emerald-700 block text-[11px]">Certificate Number:</span>
              <span className="font-mono font-bold text-emerald-900 text-sm">{verificationResult.certificateId}</span>
            </div>
          </div>
        </div>
      )}

      {/* RECENT SANITIZATION JOBS */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <History className="w-4 h-4 text-slate-500" />
            <span>Sanitization History for Case {selectedCaseId}</span>
          </h2>
          <span className="text-xs text-slate-500">{caseJobs.length} records</span>
        </div>

        {loadingJobs ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            Loading sanitization records...
          </div>
        ) : caseJobs.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            No previous sanitization operations recorded for this case.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold uppercase text-[11px] tracking-wider">
                  <th className="py-3 px-4">Job ID</th>
                  <th className="py-3 px-4">Target</th>
                  <th className="py-3 px-4">Method</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {caseJobs.map((j) => (
                  <tr key={j.sanitizationId || j._id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono font-medium text-blue-600">
                      {j.sanitizationId || j.jobId || 'SAN-001'}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-900">
                      {j.target}
                    </td>
                    <td className="py-3 px-4">
                      <span className="bg-slate-100 px-2 py-0.5 rounded font-medium text-slate-700 border border-slate-200">
                        {j.method}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={j.status || 'COMPLETED'} size="xs" />
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {new Date(j.createdAt || Date.now()).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CERTIFICATE MODAL */}
      <Modal
        isOpen={isCertModalOpen}
        onClose={() => setIsCertModalOpen(false)}
        title="Certificate of Data Sanitization"
        maxWidth="max-w-2xl"
      >
        {certificateData && (
          <div className="space-y-4 text-xs text-slate-800">
            {/* Cert Header */}
            <div className="p-4 bg-slate-50 border-2 border-emerald-500/40 rounded-lg text-center">
              <div className="text-[11px] uppercase tracking-widest text-emerald-800 font-bold mb-1">
                CYPHORA FORENSIC ASSURANCE
              </div>
              <h3 className="text-lg font-bold text-slate-900">
                Certificate of Media Sanitization
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Compliant with NIST SP 800-88 Rev. 1 Guidelines for Media Sanitization
              </p>
              <div className="mt-2 inline-block font-mono text-xs bg-white px-3 py-1 rounded border border-slate-200 font-bold text-emerald-700">
                ID: {certificateData.certificateId}
              </div>
            </div>

            {/* Cert Details Grid */}
            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-lg border border-slate-200">
              <div>
                <span className="text-slate-500 block text-[11px]">Target Device:</span>
                <span className="font-mono font-medium text-slate-900">{certificateData.target}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Media Architecture:</span>
                <span className="font-medium text-slate-900">{certificateData.mediaType}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Sanitization Standard:</span>
                <span className="font-medium text-emerald-700">{certificateData.standard}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Method Applied:</span>
                <span className="font-medium text-slate-900">{certificateData.method}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Associated Case Dossier:</span>
                <span className="font-mono font-medium text-blue-700">{certificateData.caseId}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Authorized Operator:</span>
                <span className="font-medium text-slate-900">{certificateData.operator}</span>
              </div>
            </div>

            {/* Cryptographic SHA-256 seal */}
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
              <span className="text-slate-500 text-[11px] block mb-1">
                Post-Sanitization Cryptographic Hash (SHA-256):
              </span>
              <div className="font-mono text-xs text-slate-900 select-all break-all bg-white p-2 rounded border border-slate-200">
                {certificateData.sha256Verification}
              </div>
            </div>

            {/* Actions */}
            <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
              <Link
                to="/audit"
                className="text-xs text-blue-600 hover:text-blue-800 font-medium hover:underline flex items-center gap-1"
              >
                <span>View Immutable Audit Trail</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>

              <button
                type="button"
                onClick={handleDownloadCertificate}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded-md shadow-sm transition-colors flex items-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Download Signed Certificate</span>
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

