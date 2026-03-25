import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AeroInput } from "@/components/AeroInput";
import { deleteProject, listProjects, loadProject, renameProject, saveProject, type SavedProjectMeta } from "@/lib/projectStore";
import { useAnalysis } from "@/contexts/AnalysisContext";
import { FolderOpen, Save, Trash2, Edit3, Download } from "lucide-react";

function fmt(ts: string) {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

export default function ProjectManagerModal(props: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { open, onOpenChange } = props;
  const analysis = useAnalysis();
  const [projects, setProjects] = useState<SavedProjectMeta[]>([]);
  const [newName, setNewName] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const refresh = () => setProjects(listProjects());

  useEffect(() => {
    if (open) refresh();
  }, [open]);

  const hasAnyData = useMemo(() => {
    return !!(analysis.windData || analysis.windRose || analysis.airportReportData || analysis.heliportReportData || analysis.waterReportData);
  }, [analysis.windData, analysis.windRose, analysis.airportReportData, analysis.heliportReportData, analysis.waterReportData]);

  const handleSave = () => {
    const name = (newName || "").trim() || `Project ${new Date().toLocaleDateString()}`;
    saveProject(name, {
      windData: analysis.windData,
      windRose: analysis.windRose,
      runwayCandidates: analysis.runwayCandidates,
      runwayOptimization: analysis.runwayOptimization,
      crosswindLimit: analysis.crosswindLimit,
      runwayLength: analysis.runwayLength,
      runwayLengthInputs: analysis.runwayLengthInputs,
      waterRunway: analysis.waterRunway,
      helipad: analysis.helipad,
      airportReportData: analysis.airportReportData,
      heliportReportData: analysis.heliportReportData,
      waterReportData: analysis.waterReportData,
    });
    setNewName("");
    refresh();
  };

  const handleLoad = (id: string) => {
    const proj = loadProject(id);
    if (!proj) return;
    setActiveId(id);
    analysis.hydrate(proj.state);
    onOpenChange(false);
  };

  const handleDelete = (id: string) => {
    if (!confirm("Delete this saved project? This cannot be undone.")) return;
    deleteProject(id);
    if (activeId === id) setActiveId(null);
    refresh();
  };

  const handleStartRename = (p: SavedProjectMeta) => {
    setRenameId(p.id);
    setRenameValue(p.name);
  };

  const handleCommitRename = () => {
    if (!renameId) return;
    const name = renameValue.trim();
    if (!name) return;
    renameProject(renameId, name);
    setRenameId(null);
    setRenameValue("");
    refresh();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Project Manager</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-3 border border-border rounded-sm bg-secondary/10">
            <p className="text-xs text-muted-foreground">
              Save multiple projects (snapshots) and reload them later. Auto-save still keeps your last session.
            </p>
          </div>

          <div className="grid grid-cols-12 gap-3 items-end">
            <div className="col-span-12 md:col-span-8">
              <AeroInput label="New project name" placeholder="e.g. Riyadh Heliport Study" value={newName} onChange={setNewName} />
            </div>
            <div className="col-span-12 md:col-span-4">
              <button
                disabled={!hasAnyData}
                onClick={handleSave}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-sm bg-primary text-primary-foreground rounded-sm transition-all disabled:opacity-30"
              >
                <Save className="w-4 h-4" /> Save snapshot
              </button>
            </div>
          </div>

          <div className="border border-border rounded-sm overflow-hidden">
            <div className="px-3 py-2 bg-secondary/20 text-[10px] uppercase tracking-wider text-muted-foreground font-mono-data">
              Saved projects ({projects.length})
            </div>
            <div className="max-h-[320px] overflow-auto">
              {projects.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  No saved projects yet.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {projects.map((p) => {
                    const renaming = renameId === p.id;
                    return (
                      <div key={p.id} className="p-3 flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          {renaming ? (
                            <div className="flex items-center gap-2">
                              <input
                                value={renameValue}
                                onChange={(e) => setRenameValue(e.target.value)}
                                className="aero-input w-full h-9"
                              />
                              <button onClick={handleCommitRename} className="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-sm">
                                Save
                              </button>
                              <button onClick={() => setRenameId(null)} className="px-3 py-1.5 text-xs border border-border rounded-sm text-muted-foreground">
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <>
                              <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                              <p className="text-[10px] text-muted-foreground font-mono-data">
                                Updated: {fmt(p.updatedAt)} • Created: {fmt(p.createdAt)}
                              </p>
                            </>
                          )}
                        </div>

                        {!renaming && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleLoad(p.id)}
                              className="inline-flex items-center gap-2 px-3 py-1.5 text-xs border border-primary text-primary rounded-sm hover:bg-primary hover:text-primary-foreground transition-colors"
                            >
                              <FolderOpen className="w-3.5 h-3.5" /> Load
                            </button>
                            <button
                              onClick={() => handleStartRename(p)}
                              className="inline-flex items-center gap-2 px-2.5 py-1.5 text-xs border border-border text-muted-foreground rounded-sm hover:text-foreground transition-colors"
                              title="Rename"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(p.id)}
                              className="inline-flex items-center gap-2 px-2.5 py-1.5 text-xs border border-destructive/30 text-destructive rounded-sm hover:bg-destructive hover:text-destructive-foreground transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="text-[10px] text-muted-foreground">
            Tip: Use JSON export/import for sharing with other computers.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

