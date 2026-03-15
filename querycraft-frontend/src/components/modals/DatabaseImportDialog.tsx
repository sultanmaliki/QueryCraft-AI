'use client';

import { useState } from "react";
import { Upload, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'https://apiquerycraft.hubzero.in';

type FileMeta = {
  id: string;
  originalName: string;
  path: string;
  size: number;
  uploadedAt: string;
  ext: string;
  type: string;
};

type UploadResponse = {
  success: true;
  file: FileMeta;
};

type ConnectionSaveResult = {
  saved: true;
  key: string;
};

type OnImportResult = UploadResponse | ConnectionSaveResult;

interface DatabaseImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (result: OnImportResult, connectionString?: string) => void;
}

function extractErrorMessage(err: unknown): string {
  if (!err) return 'Unknown error';
  if (err instanceof Error) return err.message;
  try {
    return String(err);
  } catch {
    return 'Unknown error';
  }
}

export function DatabaseImportDialog({ open, onOpenChange, onImport }: DatabaseImportDialogProps) {
  const [importMethod, setImportMethod] = useState<'connection' | 'file'>('connection');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [connectionString, setConnectionString] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    setSelectedFile(file);
    setError(null);
    setSuccessMsg(null);
  };

  const uploadFileToServer = async (file: File): Promise<UploadResponse> => {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch(`${API_BASE}/api/db/upload`, {
      method: 'POST',
      body: fd
    });
    const json = await res.json();
    if (!res.ok) {
      const msg = (json && (json.message || json.error)) ? (json.message || json.error) : `Upload failed (${res.status})`;
      throw new Error(msg);
    }
    return json as UploadResponse;
  };

  const handleImportClick = async () => {
    setError(null);
    setSuccessMsg(null);

    if (importMethod === 'file') {
      if (!selectedFile) {
        setError('No file selected');
        return;
      }

      setLoading(true);
      try {
        const uploadResp = await uploadFileToServer(selectedFile);

        // <-- Save last uploaded file id so CodeCard or other UI can auto-use it
        try {
          localStorage.setItem('qc_last_uploaded_file', uploadResp.file.id);
        } catch (e) {
          console.error('Failed to save last uploaded file id to localStorage', e);
        }

        setSuccessMsg('File uploaded successfully');
        onImport(uploadResp);
      } catch (err: unknown) {
        setError(extractErrorMessage(err));
      } finally {
        setLoading(false);
        onOpenChange(false);
        setSelectedFile(null);
      }
    } else {
      // existing connection branch unchanged...
      const cs = connectionString.trim();
      if (!cs) {
        setError('Connection string is empty');
        return;
      }
      try {
        const key = 'qc_conn_default';
        localStorage.setItem(key, cs);
        setSuccessMsg('Connection saved locally');
        onImport({ saved: true, key }, cs);
      } catch (err: unknown) {
        setError(extractErrorMessage(err));
      } finally {
        onOpenChange(false);
        setConnectionString("");
      }
    }
  };

  // Aurora colors / gradients (direct values)
  const dialogBackground = `linear-gradient(135deg, rgba(11,18,32,0.88) 0%, rgba(16,33,59,0.88) 100%)`;
  const cardDefaultBg = `linear-gradient(135deg, rgba(30,41,59,0.88) 0%, rgba(39,52,73,0.90) 100%)`;
  const cardInactiveBg = `linear-gradient(135deg, rgba(11,18,32,0.88) 0%, rgba(18,24,38,0.88) 100%)`;
  const borderColor = `rgba(30,41,59,0.88)`;
  const highlightBorder = `#0ea5e9`;
  const mutedText = "#94a3b8";
  const primaryText = "#f8fafc";
  const errorColor = "#fb7185";   // replaced tailwind text-red-400
  const successColor = "#10b981"; // replaced tailwind text-green-400

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[500px]"
        style={{
          background: dialogBackground,
          border: `1px solid ${borderColor}`,
          color: primaryText,
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)"
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Database className="w-5 h-5" style={{ color: primaryText }} />
            <span>Import Database</span>
          </DialogTitle>
          <DialogDescription style={{ color: mutedText }}>
            Upload a file or connect to an existing database.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="grid grid-cols-1 gap-3">
            {/* Upload File card */}
            {/* <Card
              className="cursor-pointer transition-all"
              onClick={() => {
                setImportMethod('file');
                setError(null);
                setSuccessMsg(null);
              }}
              style={{
                background: importMethod === 'file' ? cardDefaultBg : cardInactiveBg,
                border: importMethod === 'file' ? `2px solid ${highlightBorder}` : `1px solid ${borderColor}`,
                boxShadow: importMethod === 'file' ? `0 6px 18px rgba(14,165,233,0.06)` : undefined,
                color: primaryText
              }}
            >
              <CardContent className="flex flex-col items-center p-4">
                <FileText className="w-8 h-8 mb-2" style={{ color: mutedText }} />
                <span className="text-sm font-medium" style={{ color: primaryText }}>Upload File</span>
                <span className="text-xs" style={{ color: mutedText, textAlign: "center" }}>
                  SQL, CSV, JSON, SQLite
                </span>
              </CardContent>
            </Card> */}

            {/* Connect DB card */}
            <Card
              className="cursor-pointer transition-all"
              onClick={() => {
                setImportMethod('connection');
                setError(null);
                setSuccessMsg(null);
              }}
              style={{
                background: importMethod === 'connection' ? cardDefaultBg : cardInactiveBg,
                border: importMethod === 'connection' ? `2px solid ${highlightBorder}` : `1px solid ${borderColor}`,
                boxShadow: importMethod === 'connection' ? `0 6px 18px rgba(14,165,233,0.06)` : undefined,
                color: primaryText
              }}
            >
              <CardContent className="flex flex-col items-center p-4">
                <Database className="w-8 h-8 mb-2" style={{ color: mutedText }} />
                <span className="text-sm font-medium" style={{ color: primaryText }}>Connect DB</span>
                <span className="text-xs" style={{ color: mutedText, textAlign: "center" }}>Connection String</span>
              </CardContent>
            </Card>
          </div>

          {importMethod === 'file' && (
            <div className="space-y-2">
              <Label htmlFor="database-file" style={{ color: primaryText }}>
                Select Database File
              </Label>
              <Input
                id="database-file"
                type="file"
                accept=".sql,.csv,.json,.sqlite,.db"
                onChange={handleFileChange}
                style={{
                  background: "#0f172a",
                  border: `1px solid ${borderColor}`,
                  color: primaryText
                }}
              />
              <p className="text-xs" style={{ color: mutedText }}>
                Supported: .sql, .csv, .json, .sqlite, .db
              </p>
            </div>
          )}

          {importMethod === 'connection' && (
            <div className="space-y-2">
              <Label htmlFor="connection-string" style={{ color: primaryText }}>
                Database Connection String
              </Label>
              <Input
                id="connection-string"
                type="text"
                placeholder="postgresql://user:pass@host:port/db"
                value={connectionString}
                onChange={(e) => setConnectionString(e.target.value)}
                style={{
                  background: "#0f172a",
                  border: `1px solid ${borderColor}`,
                  color: primaryText
                }}
              />
              <p className="text-xs" style={{ color: mutedText }}>
                We will save this string locally for convenience.
              </p>
            </div>
          )}

          {error && <div className="text-sm" style={{ color: errorColor }}>{error}</div>}
          {successMsg && <div className="text-sm" style={{ color: successColor }}>{successMsg}</div>}

          <div className="flex justify-end space-x-2 pt-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleImportClick}
              disabled={
                loading ||
                (importMethod === 'file' && !selectedFile) ||
                (importMethod === 'connection' && !connectionString.trim())
              }
            >
              <Upload className="w-4 h-4 mr-2" />
              {loading ? 'Importing...' : 'Import'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
