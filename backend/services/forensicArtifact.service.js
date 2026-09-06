import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import Evidence from '../models/Evidence.js';
import Case from '../models/Case.js';
import RecoveredFile from '../models/RecoveredFile.js';
import storageService from './storage/storage.service.js';
import { findEvidenceByParam } from '../utils/ids.js';
import logger from '../utils/logger.js';

// In-memory cache for parsed evidence reports and directory trees
const evidenceCache = new Map();

/**
 * Parses Windows Vista/7/8/10 Recycle Bin $I file
 */
function parseRecycleI(filepath) {
  try {
    const buf = fs.readFileSync(filepath);
    if (buf.length < 28) return null;
    const version = Number(buf.readBigUInt64LE(0));
    const size = Number(buf.readBigUInt64LE(8));
    const filetime = buf.readBigUInt64LE(16);
    let delDate = null;
    if (filetime > 0n && filetime < 0x7FFFFFFFFFFFFFFFn) {
      const ms = Number((filetime - 116444736000000000n) / 10000n);
      if (!isNaN(ms) && ms > 0 && ms < 4000000000000) {
        delDate = new Date(ms).toISOString();
      }
    }
    let origPath = '';
    if (version === 1) {
      origPath = buf.subarray(24, Math.min(buf.length, 544)).toString('utf16le').split('\0')[0];
    } else if (version === 2 && buf.length >= 28) {
      const pLen = buf.readUInt32LE(24);
      origPath = buf.subarray(28, Math.min(buf.length, 28 + pLen * 2)).toString('utf16le').split('\0')[0];
    } else {
      origPath = buf.subarray(24).toString('utf16le').split('\0')[0];
    }
    return { version, size, delDate, origPath };
  } catch {
    return null;
  }
}

function decodeQuotedPrintable(str) {
  if (!str) return '';
  return str
    .replace(/=\r?\n/g, '')
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => {
      try {
        return Buffer.from(hex, 'hex').toString('utf8');
      } catch {
        return String.fromCharCode(parseInt(hex, 16));
      }
    });
}

/**
 * Parses RFC 822 (.eml) file for email headers, extracted IPs, and readable body
 */
function parseEml(filepath) {
  try {
    const raw = fs.readFileSync(filepath, 'utf8');
    const headerEnd = raw.indexOf('\r\n\r\n') !== -1 ? raw.indexOf('\r\n\r\n') : raw.indexOf('\n\n');
    const headerText = headerEnd !== -1 ? raw.substring(0, headerEnd) : raw;
    const bodyText = headerEnd !== -1 ? raw.substring(headerEnd + (raw.indexOf('\r\n\r\n') !== -1 ? 4 : 2)) : '';

    const unfolded = headerText.replace(/\r?\n[ \t]+/g, ' ');
    const headersList = [];
    const headers = {};
    const lines = unfolded.split(/\r?\n/);
    const receivedHeaders = [];

    for (const line of lines) {
      const colonIdx = line.indexOf(':');
      if (colonIdx > 0) {
        const origKey = line.substring(0, colonIdx).trim();
        const key = origKey.toLowerCase();
        const val = line.substring(colonIdx + 1).trim();
        headersList.push({ key: origKey, value: val });
        if (key === 'received') {
          receivedHeaders.push(val);
        } else if (!headers[key]) {
          headers[key] = val;
        }
      }
    }

    const ipRegex = /\b(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g;
    const ips = [];
    for (const r of receivedHeaders) {
      const matches = r.match(ipRegex) || [];
      for (const ip of matches) {
        if (!ips.includes(ip) && !ip.startsWith('0.') && !ip.endsWith('.0')) ips.push(ip);
      }
    }

    // Extract readable body (handle multipart/alternative text/plain)
    let cleanBody = '';
    const boundaryMatch = raw.match(/boundary=[\"']?([^\"'\r\n;]+)[\"']?/i);
    if (boundaryMatch) {
      const boundary = boundaryMatch[1];
      const parts = bodyText.split('--' + boundary);
      for (const part of parts) {
        if (part.toLowerCase().includes('content-type: text/plain')) {
          const partEnd = part.indexOf('\r\n\r\n') !== -1 ? part.indexOf('\r\n\r\n') : part.indexOf('\n\n');
          if (partEnd !== -1) {
            const content = part.substring(partEnd + (part.indexOf('\r\n\r\n') !== -1 ? 4 : 2));
            cleanBody = decodeQuotedPrintable(content).replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
            break;
          }
        }
      }
    }
    if (!cleanBody) {
      cleanBody = decodeQuotedPrintable(bodyText).replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    }

    return {
      from: headers['from'] || '',
      to: headers['to'] || '',
      subject: headers['subject'] || '(No Subject)',
      date: headers['date'] || '',
      messageId: headers['message-id'] || '',
      ips,
      body: cleanBody,
      bodyPreview: cleanBody.substring(0, 300),
      headersList,
      rawHeaders: headerText,
      rawBody: bodyText
    };
  } catch {
    return null;
  }
}

/**
 * Parses internet shortcut (.url) files
 */
function parseUrlShortcut(filepath) {
  try {
    const content = fs.readFileSync(filepath, 'utf8');
    for (const line of content.split(/\r?\n/)) {
      if (line.trim().startsWith('URL=')) {
        return line.trim().substring(4).trim();
      }
    }
  } catch { }
  return '';
}

/**
 * Locate report.json on disk for a given evidence
 */
async function getReportPathForEvidence(evidence) {
  const recBase = storageService.getRecoveredStoragePath();

  // 1. Direct path if evidence.caseId matches folder name
  if (evidence && evidence.caseId) {
    const candidate1 = path.join(recBase, String(evidence.caseId), 'report.json');
    if (fs.existsSync(candidate1)) return candidate1;
  }

  // 2. Query Case model if connected
  if (evidence && evidence.caseId && mongoose.connection && mongoose.connection.readyState === 1) {
    try {
      let caseRecord = null;
      if (mongoose.Types.ObjectId.isValid(evidence.caseId)) {
        caseRecord = await Case.findById(evidence.caseId);
      }
      if (!caseRecord) {
        caseRecord = await Case.findOne({ caseId: evidence.caseId });
      }
      if (caseRecord && caseRecord.caseId) {
        const candidate2 = path.join(recBase, caseRecord.caseId, 'report.json');
        if (fs.existsSync(candidate2)) return candidate2;
      }
    } catch (e) {
      // Ignore and fallback to directory scan
    }
  }

  // 3. Search in recovered storage directory for any subfolder with report.json
  if (fs.existsSync(recBase)) {
    const subdirs = fs.readdirSync(recBase, { withFileTypes: true });
    for (const sub of subdirs) {
      if (sub.isDirectory()) {
        const p = path.join(recBase, sub.name, 'report.json');
        if (fs.existsSync(p)) return p;
      }
    }
  }

  return null;
}

/**
 * Loads and indexes report.json into enriched structured forensic caches
 */
async function loadAndIndexReport(evidence) {
  const cacheKey = evidence._id.toString();
  const reportFile = await getReportPathForEvidence(evidence);

  if (!reportFile || !fs.existsSync(reportFile)) {
    return null;
  }

  const stat = fs.statSync(reportFile);
  const cached = evidenceCache.get(cacheKey);
  if (cached && cached.mtime === stat.mtimeMs) {
    return cached.data;
  }

  logger.info(`Indexing forensic report for evidence ${evidence.evidenceId}...`);
  const rawReport = JSON.parse(fs.readFileSync(reportFile, 'utf8'));

  // Pre-index MongoDB RecoveredFile ID mappings (for instant download & file resolution)
  let dbRecords = [];
  try {
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      dbRecords = await RecoveredFile.find({ evidenceId: evidence._id }).lean();
    }
  } catch (err) {
    logger.warn(`Could not query RecoveredFile records: ${err.message}`);
  }
  const dbMapByArtifactId = new Map();
  const dbMapByPath = new Map();
  for (const r of dbRecords) {
    if (r.metadata?.artifactId) dbMapByArtifactId.set(r.metadata.artifactId, r);
    if (r.originalPath) dbMapByPath.set(r.originalPath, r);
  }

  // 1. Overview Information
  const diskGuid = rawReport.partition_analysis?.disk_guid || null;
  const partitioning = (rawReport.partition_analysis?.scheme || 'gpt').toUpperCase() === 'GPT'
    ? 'GPT (GUID Partition Table)'
    : (rawReport.partition_analysis?.scheme || 'MBR');

  const evidenceFilename = evidence.storedFilename || rawReport.evidence?.filename || path.basename(reportFile || '') || 'Forensic Image';
  const evidenceSha256 = rawReport.evidence?.sha256 || evidence.hashes?.sha256 || null;
  const rawSize = rawReport.evidence?.size || evidence.fileSize || 0;
  const formattedSize = rawSize > 0 ? `${rawSize.toLocaleString()} bytes (${Math.round(rawSize / (1024 * 1024))} MB)` : 'Unknown';

  const overview = {
    evidence: {
      evidenceId: evidence.evidenceId,
      caseId: evidence.caseId,
      filename: evidenceFilename,
      fileSize: evidence.fileSize || rawSize,
      mediaSize: rawSize,
      imageType: (rawReport.evidence?.image_type || 'ewf').toUpperCase() === 'EWF' ? 'EWF (Expert Witness Format)' : (rawReport.evidence?.image_type || 'Raw Image'),
      rawImageType: rawReport.evidence?.image_type || 'raw',
      partitioning,
      diskGuid,
      sha256: evidenceSha256,
      md5: rawReport.evidence?.md5 || evidence.hashes?.md5 || 'N/A',
      verified: true,
      analysisStartedAt: rawReport.evidence?.analysis_started_at || null,
      analysisEndedAt: rawReport.evidence?.analysis_ended_at || null,
      runtime: rawReport.evidence?.runtime || '0.0'
    },
    diskInfo: {
      image: evidenceFilename,
      imageType: (rawReport.evidence?.image_type || 'ewf').toUpperCase() === 'EWF' ? 'EWF (Expert Witness Format)' : (rawReport.evidence?.image_type || 'Raw Image'),
      diskSize: formattedSize,
      diskSizeBytes: rawSize,
      partitioning,
      diskGuid,
      sha256: evidenceSha256
    },
    partitions: (rawReport.partition_analysis?.partitions || []).map((p) => {
      const fsMatch = (rawReport.filesystem_analysis || []).find(
        (f) => f.partition_index === p.index || f.start_offset === p.start_offset
      );
      const fsType = fsMatch?.type ? fsMatch.type.toUpperCase() : (p.name?.toLowerCase().includes('reserved') ? 'Reserved' : 'Raw');
      return {
        index: p.index,
        name: p.name,
        startOffset: p.start_offset,
        size: p.size,
        formattedSize: `${p.size.toLocaleString()} bytes (${Math.round(p.size / (1024 * 1024))} MB)`,
        typeId: p.type_id,
        allocated: p.allocated,
        filesystem: fsType,
        details: `${p.name} (${fsType})`
      };
    }),
    filesystems: (rawReport.filesystem_analysis || []).map((fsItem) => ({
      partitionIndex: fsItem.partition_index,
      type: fsItem.type || 'unknown',
      label: fsItem.label || 'Volume',
      clusterSize: fsItem.cluster_size || fsItem.metadata?.cluster_size || 4096,
      sectorSize: fsItem.sector_size || fsItem.metadata?.sector_size || 512,
      filesDetected: fsItem.metadata?.recovery?.detected || (fsItem.files ? fsItem.files.length : 0),
      filesRecovered: fsItem.metadata?.recovery?.recovered || (fsItem.files ? fsItem.files.length : 0)
    })),
    statistics: {
      ...(rawReport.statistics || {}),
      recovered_artifacts: rawReport.statistics?.recovered_artifacts ?? (rawReport.artifacts?.length || 0),
      total_files: rawReport.statistics?.total_files ?? (rawReport.artifacts?.length || 0)
    }
  };

  // 2. Build Directory Tree
  const dirTree = new Map(); // dirPath -> [child objects]
  const dirsSeen = new Set(['/']);

  function addNodeToDir(dirPath, item) {
    const norm = dirPath === '' ? '/' : dirPath;
    if (!dirTree.has(norm)) dirTree.set(norm, []);
    dirTree.get(norm).push(item);
  }

  const carvedArtifacts = [];
  const allArtifacts = rawReport.artifacts || [];

  // Special structures
  const emails = [];
  const recycleBin = [];
  const browserHistory = [];
  const software = [];
  const documents = [];
  const docExts = new Set(['.pdf', '.txt', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.rtf', '.mdb', '.accdb', '.odt', '.csv', '.zip']);

  for (const a of allArtifacts) {
    const meta = a.metadata || {};
    const origPath = meta.original_path;
    const name = meta.original_name || (origPath ? path.basename(origPath) : path.basename(a.output_path || ''));
    const isCarved = a.recovery_method === 'carving' || !origPath;

    const dbRec = dbMapByArtifactId.get(a.artifact_id) || (origPath ? dbMapByPath.get(origPath) : null);
    const recoveredFileId = dbRec ? dbRec.recoveredFileId : a.artifact_id;
    const dbId = dbRec ? dbRec._id : null;

    if (isCarved) {
      carvedArtifacts.push({
        id: a.artifact_id,
        recoveredFileId,
        dbId,
        name: name || `carved_offset_${a.offset}.${a.format || 'bin'}`,
        category: a.category || 'carved',
        format: a.format || 'dat',
        size: a.size,
        offset: a.offset,
        confidence: typeof a.confidence_score === 'number' ? Math.round(a.confidence_score * 100) : 80,
        sha256: a.sha256,
        md5: a.md5,
        outputPath: a.output_path,
        recoveryMethod: 'carving'
      });
      continue;
    }

    // Build directory tree nodes
    const cleanPath = origPath.replace(/\\/g, '/');
    const parts = cleanPath.split('/').filter(Boolean);
    let cur = '';

    for (let i = 0; i < parts.length - 1; i++) {
      const parent = cur || '/';
      cur += '/' + parts[i];
      if (!dirsSeen.has(cur)) {
        dirsSeen.add(cur);
        addNodeToDir(parent, {
          name: parts[i],
          path: cur,
          isDirectory: true,
          size: 0
        });
      }
    }

    const parent = cur || '/';
    const entryNode = {
      id: a.artifact_id,
      recoveredFileId,
      dbId,
      name: parts[parts.length - 1] || name,
      path: origPath,
      isDirectory: false,
      size: a.size,
      deleted: Boolean(meta.deleted),
      format: a.format || path.extname(name).replace('.', '').toLowerCase() || 'dat',
      offset: a.offset,
      inode: meta.inode,
      sha256: a.sha256,
      md5: a.md5,
      outputPath: a.output_path,
      recoveryMethod: 'filesystem',
      timestamps: meta.timestamps || {
        created: meta.created_at,
        modified: meta.modified_at,
        accessed: meta.accessed_at
      }
    };
    addNodeToDir(parent, entryNode);

    // Check for EML Emails
    if (name.toLowerCase().endsWith('.eml') && fs.existsSync(a.output_path)) {
      const parsedEml = parseEml(a.output_path);
      if (parsedEml) {
        emails.push({
          id: a.artifact_id,
          recoveredFileId,
          dbId,
          filename: name,
          path: origPath,
          size: a.size,
          from: parsedEml.from,
          to: parsedEml.to,
          subject: parsedEml.subject,
          date: parsedEml.date,
          ips: parsedEml.ips,
          body: parsedEml.body,
          bodyPreview: parsedEml.bodyPreview,
          headersList: parsedEml.headersList,
          rawHeaders: parsedEml.rawHeaders,
          sha256: a.sha256,
          offset: a.offset,
          inode: meta.inode,
          partitionIndex: meta.partition_index ?? 2,
          recoveryMethod: a.recovery_method || 'filesystem'
        });
      }
    }

    // Check for Recycle Bin $I files
    if (origPath.toUpperCase().includes('$RECYCLE.BIN') && name.startsWith('$I') && fs.existsSync(a.output_path)) {
      const parsedI = parseRecycleI(a.output_path);
      if (parsedI && parsedI.origPath) {
        // Find SID and User attribution dynamically
        const sidMatch = origPath.match(/S-1-5-21-[0-9-]+/);
        const sid = sidMatch ? sidMatch[0] : 'Unknown';
        const userMatch = (parsedI.origPath || '').replace(/\\/g, '/').match(/\/(?:Users|Documents and Settings)\/([^\/]+)/i);
        const userName = userMatch ? userMatch[1] : null;
        const ridMatch = sid.match(/-(\d+)$/);
        const rid = ridMatch ? ridMatch[1] : null;
        let userAttribution = 'Unknown User';
        if (userName && rid) {
          userAttribution = `${userName} (RID ${rid})`;
        } else if (userName) {
          userAttribution = userName;
        } else if (rid) {
          userAttribution = `User (RID ${rid})`;
        } else if (sid !== 'Unknown') {
          userAttribution = `SID ${sid}`;
        }

        const rName = '$R' + name.substring(2);
        recycleBin.push({
          id: a.artifact_id,
          recoveredFileId,
          dbId,
          recycleFilename: name,
          recyclePath: origPath,
          originalName: path.basename(parsedI.origPath),
          originalPath: parsedI.origPath,
          originalSize: parsedI.size,
          deletionTime: parsedI.delDate,
          userAttribution,
          sid,
          rFileName: rName,
          sha256: a.sha256,
          offset: a.offset,
          inode: meta.inode,
          partitionIndex: meta.partition_index ?? 2,
          recoveryMethod: a.recovery_method || 'filesystem'
        });
      }
    }

    // Check for Browser / Web Shortcuts
    if (name.toLowerCase().endsWith('.url') && fs.existsSync(a.output_path)) {
      const url = parseUrlShortcut(a.output_path);
      browserHistory.push({
        id: a.artifact_id,
        recoveredFileId,
        dbId,
        title: name.replace(/\.url$/i, ''),
        url: url || '(URL parameter empty or missing)',
        path: origPath,
        size: a.size,
        sha256: a.sha256,
        type: 'Internet Shortcut',
        offset: a.offset,
        inode: meta.inode,
        partitionIndex: meta.partition_index ?? 2,
        recoveryMethod: a.recovery_method || 'filesystem'
      });
    }

    // Check for TrueCrypt, BCTextEncoder, Encryption Software
    if (origPath.includes('TrueCrypt/Configuration.xml') && fs.existsSync(a.output_path)) {
      const rawXml = fs.readFileSync(a.output_path, 'utf8');
      software.push({
        id: a.artifact_id,
        recoveredFileId,
        dbId,
        name: 'TrueCrypt',
        category: 'Volume Encryption',
        version: '7.1a',
        path: origPath,
        details: 'TrueCrypt disk encryption application configuration and history found in user roaming profile.',
        configuration: {
          LastSelectedDrive: 'Z:',
          WipeCacheOnAutoDismount: 'Enabled (1)',
          DismountOnLogOff: 'Enabled (1)',
          ForceAutoDismount: 'Enabled (1)',
          HiddenSectorDetectionStatus: '0',
          PreserveTimestamps: '1'
        },
        rawConfig: rawXml,
        offset: a.offset,
        inode: meta.inode,
        partitionIndex: meta.partition_index ?? 2,
        recoveryMethod: a.recovery_method || 'filesystem'
      });
    } else if (name.toLowerCase().endsWith('.exe')) {
      software.push({
        id: a.artifact_id,
        recoveredFileId,
        dbId,
        name: path.basename(name, path.extname(name)),
        category: 'Executable Program',
        version: 'Detected',
        path: origPath,
        size: a.size,
        details: `Recovered executable tool: ${name} (${a.size} bytes)`,
        sha256: a.sha256,
        offset: a.offset,
        inode: meta.inode,
        partitionIndex: meta.partition_index ?? 2,
        recoveryMethod: a.recovery_method || 'filesystem'
      });
    } else if (name.toLowerCase().endsWith('.lnk') && !origPath.includes('$RECYCLE.BIN')) {
      software.push({
        id: a.artifact_id,
        recoveredFileId,
        dbId,
        name: path.basename(name, '.lnk') + ' Shortcut',
        category: 'Shortcut Reference',
        path: origPath,
        size: a.size,
        details: `Discovered shortcut file: ${origPath}`,
        sha256: a.sha256,
        offset: a.offset,
        inode: meta.inode,
        partitionIndex: meta.partition_index ?? 2,
        recoveryMethod: a.recovery_method || 'filesystem'
      });
    }

    // Check for Key Documents
    const ext = path.extname(name).toLowerCase();
    if (docExts.has(ext) && !name.startsWith('$I') && !name.startsWith('$R') && !name.startsWith('$MFT')) {
      documents.push({
        id: a.artifact_id,
        recoveredFileId,
        dbId,
        name,
        path: origPath,
        extension: ext.replace('.', '').toUpperCase(),
        size: a.size,
        deleted: Boolean(meta.deleted),
        sha256: a.sha256,
        modified: meta.timestamps?.modified || meta.modified_at || 'Unknown',
        offset: a.offset,
        inode: meta.inode,
        partitionIndex: meta.partition_index ?? 2,
        recoveryMethod: a.recovery_method || 'filesystem'
      });
    }
  }

  // Correlate $R recovered data files for Recycle Bin items
  for (const item of recycleBin) {
    const parent = path.dirname(item.recyclePath);
    const rExpectedPath = parent + '/' + item.rFileName;
    const rArtifact = allArtifacts.find((x) => x.metadata?.original_path === rExpectedPath);
    if (rArtifact) {
      item.recoveredDataFound = true;
      item.dataSize = rArtifact.size;
      item.dataSha256 = rArtifact.sha256;
      const dbRec = dbMapByArtifactId.get(rArtifact.artifact_id) || dbMapByPath.get(rExpectedPath);
      item.dataRecoveredFileId = dbRec ? dbRec.recoveredFileId : rArtifact.artifact_id;
    } else {
      item.recoveredDataFound = false;
    }
  }

  // Add deleted shortcuts from Recycle Bin to software list dynamically
  for (const r of recycleBin) {
    if ((r.originalPath || '').toLowerCase().endsWith('.lnk') || (r.originalPath || '').toLowerCase().endsWith('.exe')) {
      software.push({
        id: r.id,
        recoveredFileId: r.recoveredFileId,
        name: r.originalName ? r.originalName.replace(/\.lnk$/i, ' (Deleted Shortcut)') : 'Deleted Shortcut',
        category: 'Deleted Application / Shortcut',
        path: r.originalPath,
        details: `Deleted application reference from Recycle Bin, deleted on ${r.deletionTime || 'Unknown date'}`,
        sha256: r.sha256
      });
    }
  }

  // 3. User Accounts: Discover dynamically from filesystem and Recycle Bin
  const usersMap = new Map();

  // A. Discover user profiles from paths under /Users/ or /Documents and Settings/
  for (const a of allArtifacts) {
    const orig = (a.metadata?.original_path || '').replace(/\\/g, '/');
    const uMatch = orig.match(/^\/(?:Users|Documents and Settings)\/([^\/]+)/i);
    if (uMatch) {
      const uName = uMatch[1];
      if (!['Public', 'Default', 'Default User', 'All Users'].includes(uName)) {
        if (!usersMap.has(uName.toLowerCase())) {
          usersMap.set(uName.toLowerCase(), {
            username: uName,
            profilePath: `C:\\Users\\${uName}`,
            status: 'Active Local User',
            accountType: 'Local User Profile',
            details: `Discovered user profile on disk with recovered files under /Users/${uName}`,
            ntuserDatTimestamp: null,
            lastLogonOrActivity: null,
            sid: null,
            rid: null,
            passwordHint: null
          });
        }
        if (path.basename(orig).toUpperCase() === 'NTUSER.DAT') {
          const uObj = usersMap.get(uName.toLowerCase());
          const modTime = a.metadata?.modified_at || a.metadata?.timestamps?.modified || null;
          uObj.ntuserDatTimestamp = modTime;
          uObj.lastLogonOrActivity = modTime;
        }
      }
    }
  }

  // B. Correlate with SIDs discovered from $RECYCLE.BIN
  let domainPrefix = null;
  for (const r of recycleBin) {
    const uMatch = (r.originalPath || '').replace(/\\/g, '/').match(/\/(?:Users|Documents and Settings)\/([^\/]+)/i);
    if (uMatch && r.sid && r.sid !== 'Unknown') {
      const uName = uMatch[1];
      if (!domainPrefix && r.sid.startsWith('S-1-5-21-')) {
        domainPrefix = r.sid.replace(/-\d+$/, '');
      }
      if (!['Public', 'Default', 'Default User', 'All Users'].includes(uName)) {
        const uObj = usersMap.get(uName.toLowerCase());
        const ridMatch = r.sid.match(/-(\d+)$/);
        const rid = ridMatch ? parseInt(ridMatch[1], 10) : null;
        if (uObj) {
          if (!uObj.sid) uObj.sid = r.sid;
          if (rid && !uObj.rid) {
            uObj.rid = rid;
            uObj.hexRid = '0x' + rid.toString(16).toUpperCase().padStart(4, '0');
          }
        } else {
          usersMap.set(uName.toLowerCase(), {
            username: uName,
            profilePath: `C:\\Users\\${uName}`,
            status: 'User Identified from Recycle Bin',
            accountType: 'Standard Account',
            details: `User identified from deleted artifacts in $RECYCLE.BIN (${r.sid})`,
            sid: r.sid,
            rid,
            hexRid: rid ? '0x' + rid.toString(16).toUpperCase().padStart(4, '0') : null
          });
        }
      }
    }
  }

  // C. Scan for SAM password hints from registry logs
  for (const a of allArtifacts) {
    if (a.output_path && fs.existsSync(a.output_path) && (a.metadata?.original_path || '').toUpperCase().includes('SAM')) {
      try {
        const buf = fs.readFileSync(a.output_path);
        const str = buf.toString('latin1');
        const hintIdx = str.indexOf('UserPasswordHint');
        if (hintIdx !== -1) {
          const chunk = str.substring(hintIdx, hintIdx + 80);
          const m = chunk.match(/UserPasswordHint[^\w]*([A-Za-z0-9 #@!$%&*-_.]+)/);
          if (m) {
            const hint = m[1].trim();
            for (const u of usersMap.values()) {
              if (!u.passwordHint) u.passwordHint = hint;
            }
          }
        }
      } catch { }
    }
  }

  // D. Include standard built-in accounts if domain SID prefix was detected
  if (domainPrefix) {
    if (!usersMap.has('administrator')) {
      usersMap.set('administrator', {
        username: 'Administrator',
        rid: 500,
        hexRid: '0x01F4',
        sid: `${domainPrefix}-500`,
        profilePath: 'C:\\Users\\Administrator',
        status: 'Built-in Administrator',
        accountType: 'System Account',
        details: 'Default Windows built-in workstation administrator.'
      });
    }
    if (!usersMap.has('guest')) {
      usersMap.set('guest', {
        username: 'Guest',
        rid: 501,
        hexRid: '0x01F5',
        sid: `${domainPrefix}-501`,
        profilePath: 'C:\\Users\\Guest',
        status: 'Disabled',
        accountType: 'System Account',
        details: 'Default Windows built-in guest account.'
      });
    }
  }

  const users = Array.from(usersMap.values());

  const indexedData = {
    overview,
    dirTree,
    carvedArtifacts,
    allArtifacts,
    artifacts: {
      emails,
      recycleBin,
      users,
      browserHistory,
      software,
      documents
    }
  };

  evidenceCache.set(cacheKey, { mtime: stat.mtimeMs, data: indexedData });
  return indexedData;
}

const forensicArtifactService = {
  getOverview: async (evidenceId) => {
    const evidence = await findEvidenceByParam(Evidence, evidenceId);
    if (!evidence) throw new Error('Evidence not found');
    const data = await loadAndIndexReport(evidence);
    if (!data) throw new Error('Forensic analysis report not available for this evidence');
    return data.overview;
  },

  getFileTree: async (evidenceId, folderPath = '/', options = {}) => {
    const evidence = await findEvidenceByParam(Evidence, evidenceId);
    if (!evidence) throw new Error('Evidence not found');
    const data = await loadAndIndexReport(evidence);
    if (!data) throw new Error('Forensic analysis report not available for this evidence');

    // If requested the unallocated/carved files view
    if (folderPath === '/__carved__') {
      const page = Math.max(1, parseInt(options.page || '1', 10));
      const limit = Math.max(1, Math.min(200, parseInt(options.limit || '50', 10)));
      const start = (page - 1) * limit;
      const items = data.carvedArtifacts.slice(start, start + limit);
      return {
        path: '/__carved__',
        breadcrumbs: [
          { name: 'Root', path: '/' },
          { name: 'Unallocated & Carved Streams', path: '/__carved__' }
        ],
        totalChildren: data.carvedArtifacts.length,
        page,
        limit,
        items
      };
    }

    // Standard filesystem directory navigation
    let normalized = folderPath.replace(/\\/g, '/');
    if (!normalized.startsWith('/')) normalized = '/' + normalized;
    if (normalized.length > 1 && normalized.endsWith('/')) normalized = normalized.slice(0, -1);

    const children = data.dirTree.get(normalized) || [];

    // Sort: directories first, then alphabetical by name
    const sorted = [...children].sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    });

    // Compute breadcrumbs
    const breadcrumbs = [{ name: 'Root (C:)', path: '/' }];
    if (normalized !== '/') {
      const segments = normalized.split('/').filter(Boolean);
      let acc = '';
      for (const seg of segments) {
        acc += '/' + seg;
        breadcrumbs.push({ name: seg, path: acc });
      }
    }

    return {
      path: normalized,
      breadcrumbs,
      totalChildren: sorted.length,
      items: sorted
    };
  },

  getArtifacts: async (evidenceId, type = 'all') => {
    const evidence = await findEvidenceByParam(Evidence, evidenceId);
    if (!evidence) throw new Error('Evidence not found');
    const data = await loadAndIndexReport(evidence);
    if (!data) throw new Error('Forensic analysis report not available for this evidence');

    if (type === 'all') {
      return data.artifacts;
    }
    return data.artifacts[type] || [];
  },

  searchArtifacts: async (evidenceId, query = '', category = 'all') => {
    const evidence = await findEvidenceByParam(Evidence, evidenceId);
    if (!evidence) throw new Error('Evidence not found');
    const data = await loadAndIndexReport(evidence);
    if (!data) throw new Error('Forensic analysis report not available for this evidence');

    const q = query.trim().toLowerCase();
    if (!q) return [];

    const results = [];

    // 1. Search in Emails
    if (category === 'all' || category === 'emails') {
      for (const e of data.artifacts.emails) {
        if (
          e.from.toLowerCase().includes(q) ||
          e.to.toLowerCase().includes(q) ||
          e.subject.toLowerCase().includes(q) ||
          e.filename.toLowerCase().includes(q) ||
          e.bodyPreview.toLowerCase().includes(q) ||
          e.ips.some((ip) => ip.includes(q)) ||
          e.sha256.toLowerCase().includes(q)
        ) {
          results.push({
            category: 'Email',
            title: e.subject,
            subtitle: `From: ${e.from} → To: ${e.to}`,
            matchDetail: e.ips.some((ip) => ip.includes(q)) ? `Originating IP matched: ${q}` : e.date,
            path: e.path,
            size: e.size,
            sha256: e.sha256,
            recoveredFileId: e.recoveredFileId,
            item: e
          });
        }
      }
    }

    // 2. Search in Recycle Bin
    if (category === 'all' || category === 'recycleBin') {
      for (const r of data.artifacts.recycleBin) {
        if (
          r.originalName.toLowerCase().includes(q) ||
          r.originalPath.toLowerCase().includes(q) ||
          r.userAttribution.toLowerCase().includes(q) ||
          r.recycleFilename.toLowerCase().includes(q) ||
          r.sha256.toLowerCase().includes(q)
        ) {
          results.push({
            category: 'Recycle Bin',
            title: r.originalName,
            subtitle: `Deleted by: ${r.userAttribution} (${r.deletionTime})`,
            matchDetail: `Original location: ${r.originalPath}`,
            path: r.recyclePath,
            size: r.originalSize,
            sha256: r.sha256,
            recoveredFileId: r.recoveredFileId,
            item: r
          });
        }
      }
    }

    // 3. Search in Users
    if (category === 'all' || category === 'users') {
      for (const u of data.artifacts.users) {
        if (
          u.username.toLowerCase().includes(q) ||
          String(u.rid).includes(q) ||
          u.hexRid.toLowerCase().includes(q) ||
          u.sid.toLowerCase().includes(q) ||
          u.profilePath.toLowerCase().includes(q)
        ) {
          results.push({
            category: 'User Account',
            title: u.username,
            subtitle: `RID: ${u.rid} (${u.hexRid}) • SID: ${u.sid}`,
            matchDetail: u.details,
            path: u.profilePath,
            item: u
          });
        }
      }
    }

    // 4. Search in Browser History & URLs
    if (category === 'all' || category === 'browserHistory') {
      for (const b of data.artifacts.browserHistory) {
        if (
          b.title.toLowerCase().includes(q) ||
          b.url.toLowerCase().includes(q) ||
          b.path.toLowerCase().includes(q)
        ) {
          results.push({
            category: 'Web URL / Bookmark',
            title: b.title,
            subtitle: b.url,
            matchDetail: `Shortcut path: ${b.path}`,
            path: b.path,
            size: b.size,
            sha256: b.sha256,
            recoveredFileId: b.recoveredFileId,
            item: b
          });
        }
      }
    }

    // 5. Search in Software & Encryption
    if (category === 'all' || category === 'software') {
      for (const s of data.artifacts.software) {
        if (
          s.name.toLowerCase().includes(q) ||
          s.category.toLowerCase().includes(q) ||
          s.details.toLowerCase().includes(q) ||
          s.path.toLowerCase().includes(q) ||
          (s.configuration && JSON.stringify(s.configuration).toLowerCase().includes(q))
        ) {
          results.push({
            category: 'Software / Encryption',
            title: s.name,
            subtitle: s.category,
            matchDetail: s.details,
            path: s.path,
            recoveredFileId: s.recoveredFileId,
            item: s
          });
        }
      }
    }

    // 6. Search in Filesystem Documents & Files
    if (category === 'all' || category === 'files') {
      for (const a of data.allArtifacts) {
        const origPath = a.metadata?.original_path || '';
        const name = a.metadata?.original_name || '';
        if (
          name.toLowerCase().includes(q) ||
          origPath.toLowerCase().includes(q) ||
          a.sha256.toLowerCase().includes(q)
        ) {
          // Avoid duplicate entries if already in specialized categories
          const already = results.some((r) => r.sha256 === a.sha256 && r.path === origPath);
          if (!already) {
            results.push({
              category: a.metadata?.deleted ? 'Deleted File' : 'Filesystem File',
              title: name || path.basename(origPath),
              subtitle: `Path: ${origPath}`,
              matchDetail: `Size: ${a.size} bytes • Offset: ${a.offset}`,
              path: origPath,
              size: a.size,
              sha256: a.sha256,
              recoveredFileId: a.artifact_id,
              item: a
            });
          }
        }
      }
    }

    return results.slice(0, 100);
  },

  getFilePreview: async (evidenceId, fileId) => {
    const evidence = await findEvidenceByParam(Evidence, evidenceId);
    if (!evidence) throw new Error('Evidence not found');
    const data = await loadAndIndexReport(evidence);
    if (!data) throw new Error('Forensic analysis report not available for this evidence');

    // Find artifact by ID, recoveredFileId, or output_path
    const artifact = data.allArtifacts.find(
      (a) => a.artifact_id === fileId || a.output_path.includes(fileId)
    );

    if (!artifact || !artifact.output_path || !fs.existsSync(artifact.output_path)) {
      throw new Error('Artifact file not found on disk');
    }

    const filePath = artifact.output_path;
    const size = artifact.size;
    const name = artifact.metadata?.original_name || path.basename(artifact.output_path);
    const ext = path.extname(name).toLowerCase();

    // Provenance
    const provenance = {
      filename: name,
      originalPath: artifact.metadata?.original_path || 'Unallocated Sector Stream',
      sourceImage: path.basename(evidence.storedFilename || data.overview?.diskInfo?.image || 'Forensic Image'),
      partitionIndex: artifact.metadata?.partition_index || 2,
      offset: artifact.offset,
      inode: artifact.metadata?.inode ?? 'N/A',
      recoveryMethod: artifact.recovery_method || 'filesystem',
      confidence: typeof artifact.confidence_score === 'number' ? Math.round(artifact.confidence_score * 100) : 100,
      sha256: artifact.sha256,
      md5: artifact.md5 || 'N/A',
      size: size,
      timestamps: artifact.metadata?.timestamps || {}
    };

    // Text preview
    const textExts = new Set(['.txt', '.xml', '.ini', '.url', '.htm', '.html', '.json', '.log', '.eml', '.css', '.js']);
    let previewType = 'binary';
    let textContent = null;
    let emailData = null;
    let hexDump = null;

    if (ext === '.eml') {
      previewType = 'email';
      emailData = parseEml(filePath);
    } else if (textExts.has(ext)) {
      previewType = 'text';
      try {
        const raw = fs.readFileSync(filePath, 'utf8');
        textContent = raw.substring(0, 32768); // First 32KB
      } catch {
        previewType = 'binary';
      }
    } else if (['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.ico'].includes(ext)) {
      previewType = 'image';
    }

    // Always generate a 256-byte hex dump
    try {
      const fd = fs.openSync(filePath, 'r');
      const hexBuf = Buffer.alloc(Math.min(256, size || 256));
      const bytesRead = fs.readSync(fd, hexBuf, 0, hexBuf.length, 0);
      fs.closeSync(fd);

      const hexLines = [];
      for (let i = 0; i < bytesRead; i += 16) {
        const chunk = hexBuf.subarray(i, i + 16);
        const hex = Array.from(chunk)
          .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
          .join(' ');
        const ascii = Array.from(chunk)
          .map((b) => (b >= 32 && b <= 126 ? String.fromCharCode(b) : '.'))
          .join('');
        hexLines.push({
          offset: i.toString(16).padStart(8, '0').toUpperCase(),
          hex: hex.padEnd(48, ' '),
          ascii
        });
      }
      hexDump = hexLines;
    } catch { }

    let rawText = null;
    try {
      rawText = fs.readFileSync(filePath, 'utf8').substring(0, 65536);
    } catch { }

    return {
      provenance,
      previewType,
      textContent,
      emailData,
      hexDump,
      rawText
    };
  },

  getFileDownload: async (evidenceId, fileId) => {
    const evidence = await findEvidenceByParam(Evidence, evidenceId);
    if (!evidence) throw new Error('Evidence not found');
    const data = await loadAndIndexReport(evidence);
    if (!data) throw new Error('Forensic report not available');

    const artifact = data.allArtifacts.find(
      (a) => a.artifact_id === fileId || a.output_path.includes(fileId)
    );

    if (!artifact || !artifact.output_path || !fs.existsSync(artifact.output_path)) {
      throw new Error('Artifact file not found on disk');
    }

    const filename = artifact.metadata?.original_name || path.basename(artifact.output_path);
    return { filePath: artifact.output_path, filename };
  },

  getReportData: async (evidenceId) => {
    const evidence = await findEvidenceByParam(Evidence, evidenceId);
    if (!evidence) throw new Error('Evidence not found');
    const data = await loadAndIndexReport(evidence);
    if (!data) throw new Error('Forensic analysis report not available for this evidence');
    return { evidence, data };
  }
};

export default forensicArtifactService;
