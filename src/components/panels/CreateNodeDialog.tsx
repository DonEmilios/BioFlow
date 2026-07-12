import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ShieldCheck, UploadCloud, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createCustomNode, checkSandboxAvailable, CustomNodeLanguage } from "@/lib/customNodeApi";
import { useCustomNodeStore } from "@/store/customNodeStore";
import { NodeCategory } from "@/lib/nodeRegistry";

const TEMPLATES: Record<CustomNodeLanguage, string> = {
  python: `import json, sys

def main():
    payload = json.loads(sys.argv[1])
    params = payload.get("params", {})
    files = payload.get("resolvedFiles", [])  # [{id, filename, path}, ...]

    # TODO: your logic here. Read files with open(files[0]["path"]) if connected.
    result = {"summary": "Describe what this node computed.", "value": 42}

    print(json.dumps(result))

if __name__ == "__main__":
    main()
`,
  r: `# NOTE: jsonlite is not preinstalled in the r-base sandbox image this node
# runs in. Until custom-node dependency management exists (see ROADMAP.md),
# either avoid non-base packages or arrange for jsonlite to be present on
# the compute backend's image.
library(jsonlite)

args <- commandArgs(trailingOnly = TRUE)
payload <- fromJSON(args[1], simplifyVector = FALSE)
params <- payload$params
files <- payload$resolvedFiles  # list(list(id=..., filename=..., path=...), ...)

# TODO: your logic here. Read files with readLines(files[[1]]$path) if connected.
result <- list(summary = "Describe what this node computed.", value = 42)

cat(toJSON(result, auto_unbox = TRUE))
`,
};

const CATEGORY_OPTIONS: { value: NodeCategory; label: string }[] = [
  { value: "process", label: "Process" },
  { value: "input", label: "Input" },
  { value: "database", label: "Database" },
  { value: "viz", label: "Visualization" },
  { value: "output", label: "Output" },
  { value: "ai", label: "AI" },
];

export default function CreateNodeDialog() {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<NodeCategory>("process");
  const [language, setLanguage] = useState<CustomNodeLanguage>("python");
  const [code, setCode] = useState<Record<CustomNodeLanguage, string>>({ ...TEMPLATES });
  const [submitting, setSubmitting] = useState(false);
  const [sandboxAvailable, setSandboxAvailable] = useState<boolean | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addCustomNode = useCustomNodeStore((s) => s.addCustomNode);

  useEffect(() => {
    if (open) checkSandboxAvailable().then(setSandboxAvailable);
  }, [open]);

  const resetForm = () => {
    setLabel("");
    setDescription("");
    setCategory("process");
    setLanguage("python");
    setCode({ ...TEMPLATES });
  };

  const handleFileImport = async (file: File | null) => {
    if (!file) return;
    const expectedExt = language === "python" ? ".py" : ".r";
    if (!file.name.toLowerCase().endsWith(expectedExt)) {
      toast.error(`Expected a ${expectedExt} file for ${language === "python" ? "Python" : "R"}.`);
      return;
    }
    const text = await file.text();
    setCode((prev) => ({ ...prev, [language]: text }));
  };

  const handleSubmit = async () => {
    if (!label.trim()) {
      toast.error("Node name is required.");
      return;
    }
    if (!code[language].trim()) {
      toast.error("Code cannot be empty.");
      return;
    }

    setSubmitting(true);
    try {
      const manifest = await createCustomNode({
        label: label.trim(),
        description: description.trim(),
        category,
        language,
        code: code[language],
      });
      addCustomNode(manifest);
      toast.success(`Node "${manifest.label}" created — find it in the sidebar.`);
      resetForm();
      setOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to create node.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5 text-muted-foreground">
          <Sparkles size={12} strokeWidth={1.5} />
          Create Node
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Custom Node</DialogTitle>
          <DialogDescription>
            Import a proprietary algorithm as a reusable pipeline node. Runs inside an isolated container
            (no network, capped CPU/memory) on the compute backend.
          </DialogDescription>
        </DialogHeader>

        {sandboxAvailable === true && (
          <div className="flex items-start gap-2 rounded-md border border-success/30 bg-success/5 p-2.5 text-xs text-muted-foreground">
            <ShieldCheck size={14} className="text-success shrink-0 mt-0.5" />
            <span>
              Sandboxed execution available — this node will run in a network-isolated Docker container on the
              compute backend.
            </span>
          </div>
        )}
        {sandboxAvailable === false && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-2.5 text-xs text-muted-foreground">
            <AlertTriangle size={14} className="text-destructive shrink-0 mt-0.5" />
            <span>
              <strong>No container runtime detected</strong> on the compute backend — this node will be created,
              but runs will fail closed with an error until Docker is available there. It will not fall back to
              unsandboxed execution.
            </span>
          </div>
        )}
        {sandboxAvailable === null && (
          <div className="flex items-start gap-2 rounded-md border border-border bg-secondary/30 p-2.5 text-xs text-muted-foreground">
            <AlertTriangle size={14} className="text-muted-foreground shrink-0 mt-0.5" />
            <span>Checking sandbox availability on the compute backend…</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Node Name</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Custom Peak Caller"
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as NodeCategory)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className="text-xs">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Description</Label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What does this node do?"
            className="h-8 text-xs"
          />
        </div>

        <Tabs value={language} onValueChange={(v) => setLanguage(v as CustomNodeLanguage)}>
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="python" className="text-xs">Python</TabsTrigger>
              <TabsTrigger value="r" className="text-xs">R</TabsTrigger>
            </TabsList>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1.5"
              onClick={() => fileInputRef.current?.click()}
            >
              <UploadCloud size={12} strokeWidth={1.5} />
              Import file
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept={language === "python" ? ".py" : ".r,.R"}
              className="hidden"
              onChange={(e) => handleFileImport(e.target.files?.[0] ?? null)}
            />
          </div>

          <TabsContent value="python" className="mt-2">
            <Textarea
              value={code.python}
              onChange={(e) => setCode((prev) => ({ ...prev, python: e.target.value }))}
              className="font-mono text-xs min-h-[240px]"
              spellCheck={false}
            />
          </TabsContent>
          <TabsContent value="r" className="mt-2">
            <Textarea
              value={code.r}
              onChange={(e) => setCode((prev) => ({ ...prev, r: e.target.value }))}
              className="font-mono text-xs min-h-[240px]"
              spellCheck={false}
            />
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Creating…" : "Create Node"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
