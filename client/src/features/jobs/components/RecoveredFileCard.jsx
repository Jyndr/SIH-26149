import React from 'react';
import Card from '../../../components/ui/Card';
import HashCopy from '../../../components/ui/HashCopy';
import { formatBytes } from '../../../utils/format';

const RecoveredFileCard = ({ file }) => {
  const name = file.recoveredPath || file.originalPath || file.fileName || file.recoveredFileId || 'Recovered file';

  return (
    <Card className="hover:shadow-md transition-shadow">
      <Card.Body>
        <h3 className="mb-2 truncate text-sm font-semibold text-gray-900">{name}</h3>
        <div className="space-y-1 text-xs text-gray-500">
          <div className="flex justify-between">
            <span>Size</span>
            <span>{formatBytes(file.size || file.fileSize)}</span>
          </div>
          <div className="flex justify-between">
            <span>Type</span>
            <span>{file.fileType || file.metadata?.mimeType || 'Unknown'}</span>
          </div>
          {file.recoveryStatus && (
            <div className="flex justify-between">
              <span>Status</span>
              <span>{file.recoveryStatus}</span>
            </div>
          )}
          {file.hash && (
            <div className="flex justify-between">
              <span>Hash</span>
              <HashCopy value={file.hash} />
            </div>
          )}
        </div>
      </Card.Body>
    </Card>
  );
};

export default RecoveredFileCard;
