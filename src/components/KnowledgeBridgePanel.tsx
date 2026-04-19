import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { AlertCircle, ArrowRightLeft, CheckCircle2, Download, Upload } from "lucide-react";
import { exportNovaKnowledgeBridge, importNovaKnowledgeBridge } from "../api/api";
import type { NovaBridgeExportResponse, NovaMemorySnapshotResponse, SessionMode } from "../types/api";

type MemoryGraphSelection = {
  nodeIds: number[];
  edgeIds: number[];
};

type KnowledgeBridgePanelProps = {
  sessionId: string;
  sessionMode: SessionMode | string;
  snapshot: NovaMemorySnapshotResponse | null;
  graphSelection: MemoryGraphSelection;
  onBridgeImported?: () => void;
};

const toListKey = (values: number[]): string => values.slice().sort((left, right) => left - right).join(",");
const EMPTY_NODES: NonNullable<NovaMemorySnapshotResponse["nodes"]> = [];
const EMPTY_EDGES: NonNullable<NovaMemorySnapshotResponse["edges"]> = [];
const EMPTY_MESSAGES: Exclude<NovaMemorySnapshotResponse["messages"], undefined> = [];

const snippet = (value: string, maxLength = 80): string => {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1)}...`;
};

function KnowledgeBridgePanel({
  sessionId,
  sessionMode,
  snapshot,
  graphSelection,
  onBridgeImported,
}: KnowledgeBridgePanelProps) {
  const [initializedSourceKey, setInitializedSourceKey] = useState<string>("");
  const [selectedNodeIds, setSelectedNodeIds] = useState<number[]>([]);
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<number[]>([]);
  const [selectedFactIds, setSelectedFactIds] = useState<number[]>([]);
  const [selectedMessageIds, setSelectedMessageIds] = useState<number[]>([]);

  const [exportNodes, setExportNodes] = useState<boolean>(true);
  const [exportEdges, setExportEdges] = useState<boolean>(true);
  const [exportFacts, setExportFacts] = useState<boolean>(true);
  const [exportMessages, setExportMessages] = useState<boolean>(true);

  const [targetSessionId, setTargetSessionId] = useState<string>("");
  const [targetMode, setTargetMode] = useState<SessionMode>("persistent");

  const [importGraph, setImportGraph] = useState<boolean>(true);
  const [importFacts, setImportFacts] = useState<boolean>(true);
  const [importMessages, setImportMessages] = useState<boolean>(true);
  const [consentChecked, setConsentChecked] = useState<boolean>(false);

  const [exporting, setExporting] = useState<boolean>(false);
  const [importing, setImporting] = useState<boolean>(false);
  const [bridgeBundle, setBridgeBundle] = useState<NovaBridgeExportResponse | null>(null);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");

  const sourceKey = `${sessionId}:${sessionMode}`;
  const graphSelectionKey = `${toListKey(graphSelection.nodeIds)}|${toListKey(graphSelection.edgeIds)}`;

  const nodes = snapshot?.nodes ?? EMPTY_NODES;
  const edges = snapshot?.edges ?? EMPTY_EDGES;
  const factsWithIds = useMemo(
    () =>
      (snapshot?.facts ?? []).filter(
        (fact): fact is { id: number; content: string; source_role: string; score: number; created_at: string } =>
          typeof fact.id === "number"
      ),
    [snapshot?.facts]
  );
  const messages = snapshot?.messages ?? EMPTY_MESSAGES;

  useEffect(() => {
    if (!snapshot) {
      return;
    }

    if (initializedSourceKey !== sourceKey) {
      const initialNodeIds = graphSelection.nodeIds.length > 0 ? graphSelection.nodeIds : nodes.map((node) => node.id);
      const initialEdgeIds = graphSelection.edgeIds.length > 0 ? graphSelection.edgeIds : edges.map((edge) => edge.id);

      setSelectedNodeIds(initialNodeIds);
      setSelectedEdgeIds(initialEdgeIds);
      setSelectedFactIds(factsWithIds.map((fact) => fact.id));
      setSelectedMessageIds(messages.map((message) => message.id));

      setTargetSessionId(`${sessionId}-bridge`);
      setTargetMode("persistent");
      setImportGraph(true);
      setImportFacts(true);
      setImportMessages(true);
      setConsentChecked(false);
      setBridgeBundle(null);
      setError("");
      setSuccess("");
      setInitializedSourceKey(sourceKey);
      return;
    }

    if (graphSelection.nodeIds.length > 0) {
      setSelectedNodeIds((previous) => {
        const graphSet = new Set(graphSelection.nodeIds);
        const merged = previous.filter((id) => graphSet.has(id));
        return merged.length > 0 ? merged : graphSelection.nodeIds;
      });
    }

    if (graphSelection.edgeIds.length > 0) {
      setSelectedEdgeIds((previous) => {
        const graphSet = new Set(graphSelection.edgeIds);
        const merged = previous.filter((id) => graphSet.has(id));
        return merged.length > 0 ? merged : graphSelection.edgeIds;
      });
    }
  }, [
    edges,
    factsWithIds,
    graphSelection.edgeIds,
    graphSelection.nodeIds,
    graphSelectionKey,
    initializedSourceKey,
    messages,
    nodes,
    sessionId,
    snapshot,
    sourceKey,
  ]);

  const toggleId = (list: number[], id: number): number[] => {
    return list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
  };

  const nodeFilter = exportNodes ? selectedNodeIds : [];
  const edgeFilter = exportEdges ? selectedEdgeIds : [];

  const factFilter = useMemo<number[] | undefined>(() => {
    if (!exportFacts) {
      return [];
    }

    if ((snapshot?.facts.length ?? 0) > 0 && factsWithIds.length === 0) {
      return undefined;
    }

    return selectedFactIds;
  }, [exportFacts, factsWithIds.length, selectedFactIds, snapshot?.facts.length]);

  const messageFilter = exportMessages ? selectedMessageIds : [];

  const selectedCounts = {
    nodes: nodeFilter.length,
    edges: edgeFilter.length,
    facts: factFilter === undefined ? snapshot?.facts.length ?? 0 : factFilter.length,
    messages: messageFilter.length,
  };

  const hasSelectablePayload =
    selectedCounts.nodes + selectedCounts.edges + selectedCounts.facts + selectedCounts.messages > 0;

  const handleExportBridge = async () => {
    if (!snapshot) {
      return;
    }

    if (!hasSelectablePayload) {
      setError("Select at least one memory item to export.");
      setSuccess("");
      return;
    }

    setExporting(true);
    setError("");
    setSuccess("");

    try {
      const bundle = await exportNovaKnowledgeBridge({
        source_session_id: sessionId,
        source_mode: sessionMode,
        node_ids: nodeFilter,
        edge_ids: edgeFilter,
        fact_ids: factFilter,
        message_ids: messageFilter,
      });

      setBridgeBundle(bundle);
      setConsentChecked(false);
      setSuccess("Bridge bundle created. Review counts and confirm import target.");
    } catch (exportError) {
      const message = exportError instanceof Error ? exportError.message : "Failed to export memory bridge";
      setError(message);
    } finally {
      setExporting(false);
    }
  };

  const handleImportBridge = async () => {
    if (!bridgeBundle) {
      return;
    }

    if (!consentChecked) {
      setError("Please confirm cross-session transfer before importing.");
      setSuccess("");
      return;
    }

    setImporting(true);
    setError("");
    setSuccess("");

    try {
      const importResponse = await importNovaKnowledgeBridge({
        target_session_id: targetSessionId.trim() || sessionId,
        target_mode: targetMode,
        payload: bridgeBundle.payload,
        include_graph: importGraph,
        include_facts: importFacts,
        include_messages: importMessages,
      });

      setSuccess(
        `Bridge imported to ${importResponse.target_session_id} (${importResponse.target_mode}): ` +
          `${importResponse.imported.nodes} nodes, ${importResponse.imported.edges} edges, ` +
          `${importResponse.imported.facts} facts, ${importResponse.imported.messages} messages.`
      );
      setConsentChecked(false);
      onBridgeImported?.();
    } catch (importError) {
      const message = importError instanceof Error ? importError.message : "Failed to import memory bridge";
      setError(message);
    } finally {
      setImporting(false);
    }
  };

  const bridgePreview = bridgeBundle?.counts;

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
      className="mt-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-panel)]/75 backdrop-blur-xl p-3 sm:p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--text-soft)]">Knowledge Bridge</p>
          <h3 className="text-sm sm:text-base font-semibold text-[var(--app-text)] flex items-center gap-2 mt-1">
            <ArrowRightLeft size={16} className="text-[var(--accent-primary)]" />
            Selective Cross-Session Transfer
          </h3>
        </div>

        <span className="text-[10px] uppercase tracking-[0.12em] px-2 py-1 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-chip)] text-[var(--text-muted)]">
          Source {sessionId} ({sessionMode})
        </span>
      </div>

      {!snapshot ? (
        <p className="mt-3 text-xs text-[var(--text-muted)]">Loading source snapshot for bridge selection...</p>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-chip)] px-2.5 py-2">
              <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-soft)]">Nodes</p>
              <p className="text-sm font-semibold text-[var(--app-text)] mt-1">{selectedCounts.nodes}</p>
            </div>
            <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-chip)] px-2.5 py-2">
              <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-soft)]">Edges</p>
              <p className="text-sm font-semibold text-[var(--app-text)] mt-1">{selectedCounts.edges}</p>
            </div>
            <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-chip)] px-2.5 py-2">
              <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-soft)]">Facts</p>
              <p className="text-sm font-semibold text-[var(--app-text)] mt-1">{selectedCounts.facts}</p>
            </div>
            <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-chip)] px-2.5 py-2">
              <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-soft)]">Messages</p>
              <p className="text-sm font-semibold text-[var(--app-text)] mt-1">{selectedCounts.messages}</p>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-chip)]/80 p-3">
              <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-soft)] mb-2">Node Basket</p>
              <div className="flex items-center gap-2 mb-2">
                <label className="text-xs text-[var(--text-muted)] inline-flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={exportNodes}
                    onChange={(event) => setExportNodes(event.target.checked)}
                    className="accent-[var(--accent-primary)]"
                  />
                  Include in export
                </label>
                <button
                  type="button"
                  onClick={() => setSelectedNodeIds(nodes.map((node) => node.id))}
                  className="text-[10px] uppercase tracking-[0.12em] px-2 py-1 rounded-md border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--app-text)]"
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedNodeIds([])}
                  className="text-[10px] uppercase tracking-[0.12em] px-2 py-1 rounded-md border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--app-text)]"
                >
                  None
                </button>
              </div>
              <ul className="space-y-1.5 max-h-24 overflow-y-auto no-scrollbar">
                {nodes.slice(0, 14).map((node) => (
                  <li key={node.id}>
                    <label className="text-xs text-[var(--text-muted)] inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedNodeIds.includes(node.id)}
                        onChange={() => setSelectedNodeIds((current) => toggleId(current, node.id))}
                        className="accent-[var(--accent-primary)]"
                      />
                      {node.label} ({node.weight.toFixed(1)})
                    </label>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-chip)]/80 p-3">
              <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-soft)] mb-2">Edge Basket</p>
              <div className="flex items-center gap-2 mb-2">
                <label className="text-xs text-[var(--text-muted)] inline-flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={exportEdges}
                    onChange={(event) => setExportEdges(event.target.checked)}
                    className="accent-[var(--accent-primary)]"
                  />
                  Include in export
                </label>
                <button
                  type="button"
                  onClick={() => setSelectedEdgeIds(edges.map((edge) => edge.id))}
                  className="text-[10px] uppercase tracking-[0.12em] px-2 py-1 rounded-md border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--app-text)]"
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedEdgeIds([])}
                  className="text-[10px] uppercase tracking-[0.12em] px-2 py-1 rounded-md border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--app-text)]"
                >
                  None
                </button>
              </div>
              <ul className="space-y-1.5 max-h-24 overflow-y-auto no-scrollbar">
                {edges.slice(0, 12).map((edge) => (
                  <li key={edge.id}>
                    <label className="text-xs text-[var(--text-muted)] inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedEdgeIds.includes(edge.id)}
                        onChange={() => setSelectedEdgeIds((current) => toggleId(current, edge.id))}
                        className="accent-[var(--accent-primary)]"
                      />
                      {edge.source_label ?? edge.source} --{edge.relation}--&gt; {edge.target_label ?? edge.target}
                    </label>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-chip)]/80 p-3">
              <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-soft)] mb-2">Fact Basket</p>
              <div className="flex items-center gap-2 mb-2">
                <label className="text-xs text-[var(--text-muted)] inline-flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={exportFacts}
                    onChange={(event) => setExportFacts(event.target.checked)}
                    className="accent-[var(--accent-primary)]"
                  />
                  Include in export
                </label>
                {factsWithIds.length > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setSelectedFactIds(factsWithIds.map((fact) => fact.id))}
                      className="text-[10px] uppercase tracking-[0.12em] px-2 py-1 rounded-md border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--app-text)]"
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedFactIds([])}
                      className="text-[10px] uppercase tracking-[0.12em] px-2 py-1 rounded-md border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--app-text)]"
                    >
                      None
                    </button>
                  </>
                )}
              </div>
              {factsWithIds.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)]">Facts in this snapshot are exported as a whole set.</p>
              ) : (
                <ul className="space-y-1.5 max-h-24 overflow-y-auto no-scrollbar">
                  {factsWithIds.slice(0, 8).map((fact) => (
                    <li key={fact.id}>
                      <label className="text-xs text-[var(--text-muted)] inline-flex items-start gap-2">
                        <input
                          type="checkbox"
                          checked={selectedFactIds.includes(fact.id)}
                          onChange={() => setSelectedFactIds((current) => toggleId(current, fact.id))}
                          className="accent-[var(--accent-primary)] mt-[2px]"
                        />
                        {snippet(fact.content, 92)}
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-chip)]/80 p-3">
              <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-soft)] mb-2">Message Basket</p>
              <div className="flex items-center gap-2 mb-2">
                <label className="text-xs text-[var(--text-muted)] inline-flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={exportMessages}
                    onChange={(event) => setExportMessages(event.target.checked)}
                    className="accent-[var(--accent-primary)]"
                  />
                  Include in export
                </label>
                <button
                  type="button"
                  onClick={() => setSelectedMessageIds(messages.map((message) => message.id))}
                  className="text-[10px] uppercase tracking-[0.12em] px-2 py-1 rounded-md border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--app-text)]"
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedMessageIds([])}
                  className="text-[10px] uppercase tracking-[0.12em] px-2 py-1 rounded-md border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--app-text)]"
                >
                  None
                </button>
              </div>
              <ul className="space-y-1.5 max-h-24 overflow-y-auto no-scrollbar">
                {messages.slice(0, 8).map((message) => (
                  <li key={message.id}>
                    <label className="text-xs text-[var(--text-muted)] inline-flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={selectedMessageIds.includes(message.id)}
                        onChange={() => setSelectedMessageIds((current) => toggleId(current, message.id))}
                        className="accent-[var(--accent-primary)] mt-[2px]"
                      />
                      <span>
                        <span className="uppercase tracking-[0.08em] text-[var(--text-soft)]">{message.role}</span>
                        : {snippet(message.content, 72)}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void handleExportBridge()}
              disabled={exporting || !hasSelectablePayload}
              className="px-3 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-chip)] text-[var(--text-muted)] hover:text-[var(--app-text)] hover:bg-[var(--surface-chip-hover)] transition-colors text-xs inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              <Download size={13} /> {exporting ? "Exporting..." : "Create Bridge Bundle"}
            </button>

            {bridgePreview && (
              <span className="text-[10px] uppercase tracking-[0.12em] px-2 py-1 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-chip)] text-[var(--text-muted)]">
                Bundle {bridgePreview.nodes}N / {bridgePreview.edges}E / {bridgePreview.facts}F / {bridgePreview.messages}M
              </span>
            )}
          </div>

          {bridgeBundle && (
            <div className="mt-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-chip)]/80 p-3">
              <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-soft)] mb-2">Import Wizard</p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <label className="md:col-span-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-panel)] px-2.5 py-2 block">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-soft)] mb-1">Target Session</p>
                  <input
                    value={targetSessionId}
                    onChange={(event) => setTargetSessionId(event.target.value)}
                    placeholder="session-id"
                    className="w-full bg-transparent text-sm text-[var(--app-text)] placeholder-[var(--placeholder)] outline-none"
                  />
                </label>

                <label className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-panel)] px-2.5 py-2 block">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-soft)] mb-1">Target Mode</p>
                  <select
                    value={targetMode}
                    onChange={(event) => setTargetMode(event.target.value as SessionMode)}
                    className="w-full bg-transparent text-sm text-[var(--app-text)] outline-none"
                  >
                    <option value="persistent">Persistent</option>
                    <option value="volatile">Incognito</option>
                  </select>
                </label>
              </div>

              <div className="mt-3 flex flex-wrap gap-3">
                <label className="text-xs text-[var(--text-muted)] inline-flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={importGraph}
                    onChange={(event) => setImportGraph(event.target.checked)}
                    className="accent-[var(--accent-primary)]"
                  />
                  Import graph (nodes + edges)
                </label>
                <label className="text-xs text-[var(--text-muted)] inline-flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={importFacts}
                    onChange={(event) => setImportFacts(event.target.checked)}
                    className="accent-[var(--accent-primary)]"
                  />
                  Import facts
                </label>
                <label className="text-xs text-[var(--text-muted)] inline-flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={importMessages}
                    onChange={(event) => setImportMessages(event.target.checked)}
                    className="accent-[var(--accent-primary)]"
                  />
                  Import messages
                </label>
              </div>

              <label className="mt-3 text-xs text-[var(--text-muted)] inline-flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={consentChecked}
                  onChange={(event) => setConsentChecked(event.target.checked)}
                  className="accent-[var(--accent-primary)] mt-[2px]"
                />
                I confirm this is an intentional cross-session transfer.
              </label>

              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => void handleImportBridge()}
                  disabled={importing || !consentChecked}
                  className="px-3 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-chip)] text-[var(--text-muted)] hover:text-[var(--app-text)] hover:bg-[var(--surface-chip-hover)] transition-colors text-xs inline-flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Upload size={13} /> {importing ? "Importing..." : "Import Bundle"}
                </button>
              </div>
            </div>
          )}

          {error && (
            <p className="mt-3 text-xs text-red-300/90 inline-flex items-center gap-1.5">
              <AlertCircle size={12} /> {error}
            </p>
          )}

          {success && (
            <p className="mt-3 text-xs text-emerald-300 inline-flex items-center gap-1.5">
              <CheckCircle2 size={12} /> {success}
            </p>
          )}
        </>
      )}
    </motion.section>
  );
}

export default KnowledgeBridgePanel;
