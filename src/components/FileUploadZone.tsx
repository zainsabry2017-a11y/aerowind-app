import { Upload, CheckCircle } from "lucide-react";
import { motion } from "framer-motion";
import { useRef, useState, useCallback } from "react";

interface FileUploadZoneProps {
  title?: string;
  accept?: string;
  onFile?: (file: File) => void;
}

const FileUploadZone = ({ title = "Drop file here or click to browse", accept = ".csv,.txt,.xlsx", onFile }: FileUploadZoneProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = useCallback((file: File) => {
    setFileName(file.name);
    onFile?.(file);
  }, [onFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
      <motion.div
        whileHover={{ scale: 1.005 }}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-sm p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors group ${
          isDragging ? "border-primary bg-primary/5" : fileName ? "border-primary/40" : "border-border hover:border-primary/50"
        }`}
      >
        <div className={`w-12 h-12 rounded-sm flex items-center justify-center transition-shadow ${
          fileName ? "bg-primary/20" : "bg-secondary group-hover:glow-cyan"
        }`}>
          {fileName ? (
            <CheckCircle className="w-5 h-5 text-primary" />
          ) : (
            <Upload className="w-5 h-5 text-primary" />
          )}
        </div>
        <div className="text-center">
          {fileName ? (
            <>
              <p className="text-sm text-primary font-mono-data">{fileName}</p>
              <p className="text-xs text-muted-foreground mt-1">Click or drop to replace</p>
            </>
          ) : (
            <>
              <p className="text-sm text-foreground">{title}</p>
              <p className="text-xs text-muted-foreground mt-1">Accepts {accept} files</p>
            </>
          )}
        </div>
      </motion.div>
    </>
  );
};

export default FileUploadZone;
