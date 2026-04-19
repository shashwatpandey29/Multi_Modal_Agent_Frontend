import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import ForceGraph3D, { type ForceGraphMethods, type LinkObject, type NodeObject } from "react-force-graph-3d";
import { BrainCircuit, Database, Focus, Maximize2, Minimize2, Network, RefreshCw, RotateCcw, SlidersHorizontal, Target } from "lucide-react";
import { clearNovaMemory, getNovaMemoryByMode } from "../api/api";
import type { NovaMemorySnapshotResponse, SessionMode } from "../types/api";

export type MemoryGraphSelection = {
  nodeIds: number[];
  edgeIds: number[];
};

type NovaMemoryGraphProps = {
  sessionId: string;
  sessionMode: SessionMode | string;
  refreshSignal?: number;
  onSelectionChange?: (selection: MemoryGraphSelection) => void;
  onSnapshotLoaded?: (snapshot: NovaMemorySnapshotResponse) => void;
};

type GraphNode = {
  id: number;
  label: string;
  type: string;
  weight: number;
  color: string;
  val: number;
  isSelected: boolean;
  isSearchMatch: boolean;
};

type GraphLink = {
  id: number;
  source: number;
  target: number;
  relation: string;
  weight: number;
  color: string;
  isSelected: boolean;
  isSearchMatch: boolean;
};

type GraphTheme = "constellation" | "dna";
type DetailTab = "summary" | "relations" | "evidence" | "diagnostics";

type EvidenceItem = {
  id: string;
  kind: "fact" | "message";
  content: string;
  score: number;
  role: string;
  createdAt: string;
};

type OrbitTarget = {
  x: number;
  y: number;
  z: number;
};

type OrbitControlsLike = {
  autoRotate?: boolean;
  autoRotateSpeed?: number;
  enableDamping?: boolean;
  dampingFactor?: number;
  zoomSpeed?: number;
  minDistance?: number;
  maxDistance?: number;
  enableZoom?: boolean;
  target?: OrbitTarget;
  update?: () => void;
};

const GRAPH_THEME_STORAGE_KEY = "nova-graph-theme";
const AUTO_REFRESH_MS = 18000;
const ZOOM_MIN_DISTANCE = 45;
const ZOOM_MAX_DISTANCE = 2200;

const EMPTY_MEMORY: NovaMemorySnapshotResponse = {
  session_id: "",
  nodes: [],
  edges: [],
  facts: [],
};

const DETAIL_TABS: Array<{ id: DetailTab; label: string }> = [
  { id: "summary", label: "Summary" },
  { id: "relations", label: "Relations" },
  { id: "evidence", label: "Evidence" },
  { id: "diagnostics", label: "Diagnostics" },
];

const clamp = (value: number, min: number, max: number): number => {
  return Math.min(max, Math.max(min, value));
};

const nodeColorByWeight = (weight: number, theme: GraphTheme): string => {
  const normalized = clamp(weight / 10, 0, 1);
  const hue = theme === "dna" ? 300 - normalized * 90 : 200 - normalized * 85;
  const lightness = theme === "dna" ? 46 + normalized * 19 : 48 + normalized * 18;
  return `hsl(${hue.toFixed(0)} 92% ${lightness.toFixed(0)}%)`;
};

const themeBackdropClass = (theme: GraphTheme): string => {
  if (theme === "dna") {
    return "bg-[radial-gradient(circle_at_20%_18%,rgba(244,114,182,0.18),transparent_40%),radial-gradient(circle_at_78%_82%,rgba(251,146,60,0.15),transparent_45%),repeating-linear-gradient(160deg,rgba(248,113,113,0.06)_0_1px,transparent_1px_18px)]";
  }

  return "bg-[radial-gradient(circle_at_16%_20%,rgba(56,189,248,0.2),transparent_42%),radial-gradient(circle_at_84%_24%,rgba(34,211,238,0.15),transparent_42%),radial-gradient(circle_at_74%_86%,rgba(148,163,184,0.12),transparent_48%)]";
};

function NovaMemoryGraph({
  sessionId,
  sessionMode,
  refreshSignal,
  onSelectionChange,
  onSnapshotLoaded,
}: NovaMemoryGraphProps) {
  const graphRef = useRef<ForceGraphMethods<NodeObject<GraphNode>, LinkObject<GraphNode, GraphLink>> | undefined>(undefined);
  const [memory, setMemory] = useState<NovaMemorySnapshotResponse>(EMPTY_MEMORY);
  const [loading, setLoading] = useState<boolean>(true);
  const [clearing, setClearing] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [minWeight, setMinWeight] = useState<number>(0);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  const [graphTheme, setGraphTheme] = useState<GraphTheme>(() => {
    if (typeof window === "undefined") {
      return "constellation";
    }

    try {
      const savedTheme = window.localStorage.getItem(GRAPH_THEME_STORAGE_KEY);
      return savedTheme === "dna" ? "dna" : "constellation";
    } catch {
      return "constellation";
    }
  });
  const [expanded, setExpanded] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<DetailTab>("summary");
  const [focusedNodeId, setFocusedNodeId] = useState<number | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<number[]>([]);
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<number[]>([]);

  const normalizedSearch = useMemo(() => searchTerm.trim().toLowerCase(), [searchTerm]);
  const maxNodeWeight = useMemo(
    () =>
      memory.nodes.length > 0
        ? memory.nodes.reduce((max, node) => Math.max(max, node.weight), 0)
        : 0,
    [memory.nodes]
  );

  const loadMemory = useCallback(
    async (withLoader = false) => {
      if (!sessionId) {
        setMemory(EMPTY_MEMORY);
        return;
      }

      if (withLoader) {
        setLoading(true);
      }

      try {
        const snapshot = await getNovaMemoryByMode(sessionId, sessionMode);
        setMemory(snapshot);
        onSnapshotLoaded?.(snapshot);
        setError("");
      } catch (fetchError) {
        const message = fetchError instanceof Error ? fetchError.message : "Unable to load NOVA memory";
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [onSnapshotLoaded, sessionId, sessionMode]
  );

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!active) {
        return;
      }
      await loadMemory(true);
    };

    void load();

    const interval = window.setInterval(() => {
      if (active && autoRefresh && !expanded) {
        void loadMemory();
      }
    }, AUTO_REFRESH_MS);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [autoRefresh, expanded, loadMemory]);

  useEffect(() => {
    if (typeof refreshSignal === "number") {
      void loadMemory(true);
    }
  }, [loadMemory, refreshSignal]);

  useEffect(() => {
    try {
      window.localStorage.setItem(GRAPH_THEME_STORAGE_KEY, graphTheme);
    } catch {
      // Ignore storage failures.
    }
  }, [graphTheme]);

  useEffect(() => {
    const nodeIdSet = new Set(memory.nodes.map((node) => node.id));
    const edgeIdSet = new Set(memory.edges.map((edge) => edge.id));

    setSelectedNodeIds((previous) => previous.filter((id) => nodeIdSet.has(id)));
    setSelectedEdgeIds((previous) => previous.filter((id) => edgeIdSet.has(id)));
    setFocusedNodeId((previous) => (previous !== null && nodeIdSet.has(previous) ? previous : null));
  }, [memory.edges, memory.nodes]);

  useEffect(() => {
    onSelectionChange?.({
      nodeIds: selectedNodeIds,
      edgeIds: selectedEdgeIds,
    });
  }, [onSelectionChange, selectedEdgeIds, selectedNodeIds]);

  useEffect(() => {
    const controls = graphRef.current?.controls?.() as OrbitControlsLike | undefined;

    if (!controls) {
      return;
    }

    controls.autoRotate = autoRotate;
    controls.autoRotateSpeed = 0.45;
    controls.enableDamping = true;
    controls.dampingFactor = 0.14;
    controls.enableZoom = true;
    controls.zoomSpeed = 0.62;
    controls.minDistance = ZOOM_MIN_DISTANCE;
    controls.maxDistance = ZOOM_MAX_DISTANCE;
  }, [autoRotate, memory.nodes.length]);

  useEffect(() => {
    if (minWeight > maxNodeWeight) {
      setMinWeight(maxNodeWeight);
    }
  }, [maxNodeWeight, minWeight]);

  useEffect(() => {
    setActiveTab("summary");
  }, [focusedNodeId]);

  useEffect(() => {
    if (!expanded) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setExpanded(false);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [expanded]);

  const resolveNodeId = (value: unknown): number => {
    if (typeof value === "number") {
      return value;
    }
    if (typeof value === "string") {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : -1;
    }
    if (value && typeof value === "object" && "id" in value) {
      const idValue = (value as { id?: unknown }).id;
      if (typeof idValue === "number") {
        return idValue;
      }
      if (typeof idValue === "string") {
        const parsed = Number(idValue);
        return Number.isFinite(parsed) ? parsed : -1;
      }
    }
    return -1;
  };

  const toggleNodeSelection = (nodeId: number) => {
    if (!Number.isFinite(nodeId) || nodeId < 0) {
      return;
    }

    setSelectedNodeIds((previous) =>
      previous.includes(nodeId) ? previous.filter((id) => id !== nodeId) : [...previous, nodeId]
    );
  };

  const toggleEdgeSelection = (edgeId: number) => {
    if (!Number.isFinite(edgeId) || edgeId < 0) {
      return;
    }

    setSelectedEdgeIds((previous) =>
      previous.includes(edgeId) ? previous.filter((id) => id !== edgeId) : [...previous, edgeId]
    );
  };

  const getCameraTarget = (controls: OrbitControlsLike | undefined): OrbitTarget => {
    const target = controls?.target;
    if (
      target &&
      Number.isFinite(target.x) &&
      Number.isFinite(target.y) &&
      Number.isFinite(target.z)
    ) {
      return target;
    }

    return { x: 0, y: 0, z: 0 };
  };

  const zoomGraph = (factor: number) => {
    const graph = graphRef.current;
    if (!graph) {
      return;
    }

    const controls = graph.controls?.() as OrbitControlsLike | undefined;
    const camera = graph.camera?.() as { position?: OrbitTarget } | undefined;
    if (!camera?.position) {
      return;
    }

    const target = getCameraTarget(controls);
    const dx = camera.position.x - target.x;
    const dy = camera.position.y - target.y;
    const dz = camera.position.z - target.z;
    const currentDistance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const safeDistance = currentDistance > 0.001 ? currentDistance : ZOOM_MIN_DISTANCE;
    const nextDistance = clamp(safeDistance * factor, ZOOM_MIN_DISTANCE, ZOOM_MAX_DISTANCE);
    const ratio = nextDistance / safeDistance;

    graph.cameraPosition(
      {
        x: target.x + dx * ratio,
        y: target.y + dy * ratio,
        z: target.z + dz * ratio,
      },
      target,
      260
    );

    controls?.update?.();
  };

  const handleZoomIn = () => zoomGraph(0.84);
  const handleZoomOut = () => zoomGraph(1.2);
  const handleFitView = () => {
    const graph = graphRef.current;
    if (!graph) {
      return;
    }

    graph.zoomToFit(420, 72);
  };

  const graphData = useMemo(() => {
    const includedNodeMap = new Map<number, GraphNode>();

    for (const node of memory.nodes) {
      const isSearchMatch = normalizedSearch.length > 0 && node.label.toLowerCase().includes(normalizedSearch);
      const isSelected = selectedNodeIds.includes(node.id);
      const passesWeight = node.weight >= minWeight;

      const shouldInclude = normalizedSearch
        ? (passesWeight && isSearchMatch) || isSelected
        : passesWeight || isSelected;

      if (!shouldInclude) {
        continue;
      }

      const nodeColor = isSelected
        ? "hsl(42 96% 62%)"
        : isSearchMatch
        ? graphTheme === "dna"
          ? "hsl(28 96% 61%)"
          : "hsl(160 94% 56%)"
        : nodeColorByWeight(node.weight, graphTheme);

      includedNodeMap.set(node.id, {
        id: node.id,
        label: node.label,
        type: node.type,
        weight: node.weight,
        color: nodeColor,
        val: clamp(2 + node.weight * 1.4 + (isSelected ? 2.8 : 0) + (isSearchMatch ? 1.2 : 0), 2, 18),
        isSelected,
        isSearchMatch,
      });
    }

    const links: GraphLink[] = [];

    for (const edge of memory.edges) {
      const sourceId = resolveNodeId(edge.source);
      const targetId = resolveNodeId(edge.target);
      if (!includedNodeMap.has(sourceId) || !includedNodeMap.has(targetId)) {
        continue;
      }

      const relationMatch = normalizedSearch.length > 0 && edge.relation.toLowerCase().includes(normalizedSearch);
      const endpointMatch =
        normalizedSearch.length > 0 &&
        (Boolean(includedNodeMap.get(sourceId)?.label.toLowerCase().includes(normalizedSearch)) ||
          Boolean(includedNodeMap.get(targetId)?.label.toLowerCase().includes(normalizedSearch)));

      const isSearchMatch = Boolean(relationMatch || endpointMatch);
      const isSelected = selectedEdgeIds.includes(edge.id);

      links.push({
        id: edge.id,
        source: sourceId,
        target: targetId,
        relation: edge.relation,
        weight: edge.weight,
        color: isSelected
          ? "rgba(250, 204, 21, 0.88)"
          : isSearchMatch
          ? graphTheme === "dna"
            ? "rgba(249, 115, 22, 0.78)"
            : "rgba(45, 212, 191, 0.74)"
          : graphTheme === "dna"
          ? "rgba(253, 186, 116, 0.48)"
          : "rgba(108, 233, 255, 0.45)",
        isSelected,
        isSearchMatch,
      });
    }

    const nodes = Array.from(includedNodeMap.values());

    return { nodes, links };
  }, [graphTheme, memory.edges, memory.nodes, minWeight, normalizedSearch, selectedEdgeIds, selectedNodeIds]);

  const nodeLookup = useMemo(() => new Map(memory.nodes.map((node) => [node.id, node])), [memory.nodes]);

  const focusedNode = useMemo(() => {
    if (focusedNodeId === null) {
      return null;
    }
    return memory.nodes.find((node) => node.id === focusedNodeId) || null;
  }, [focusedNodeId, memory.nodes]);

  const focusedIncomingEdges = useMemo(() => {
    if (focusedNodeId === null) {
      return [];
    }

    return memory.edges
      .filter((edge) => resolveNodeId(edge.target) === focusedNodeId)
      .sort((left, right) => right.weight - left.weight)
      .slice(0, 6);
  }, [focusedNodeId, memory.edges]);

  const focusedOutgoingEdges = useMemo(() => {
    if (focusedNodeId === null) {
      return [];
    }

    return memory.edges
      .filter((edge) => resolveNodeId(edge.source) === focusedNodeId)
      .sort((left, right) => right.weight - left.weight)
      .slice(0, 6);
  }, [focusedNodeId, memory.edges]);

  const focusedEvidence = useMemo<EvidenceItem[]>(() => {
    if (!focusedNode) {
      return [];
    }

    const label = focusedNode.label.toLowerCase();
    const labelTokens = label
      .split(/[^a-z0-9]+/i)
      .map((token) => token.trim())
      .filter((token) => token.length >= 3);

    const computeTokenSignal = (text: string): number => {
      const normalizedText = text.toLowerCase();
      if (labelTokens.length === 0) {
        return normalizedText.includes(label) ? 1 : 0;
      }

      const matches = labelTokens.filter((token) => normalizedText.includes(token)).length;
      const phraseBoost = normalizedText.includes(label) ? 0.25 : 0;
      return clamp(matches / labelTokens.length + phraseBoost, 0, 1);
    };

    const factEvidence = memory.facts
      .map((fact, index) => {
        const tokenSignal = computeTokenSignal(fact.content);
        return {
          id: `fact-${typeof fact.id === "number" ? fact.id : index}`,
          kind: "fact" as const,
          content: fact.content,
          score: clamp(fact.score * 0.72 + tokenSignal * 0.28, 0, 1),
          role: fact.source_role,
          createdAt: fact.created_at,
          tokenSignal,
        };
      })
      .filter((fact) => fact.tokenSignal > 0)
      .map((fact, index) => ({
        id: `${fact.id}-${index}`,
        kind: "fact" as const,
        content: fact.content,
        score: fact.score,
        role: fact.role,
        createdAt: fact.createdAt,
      }));

    const messageEvidence = (memory.messages ?? [])
      .map((message) => {
        const tokenSignal = computeTokenSignal(message.content);
        return {
          id: `msg-${message.id}`,
          kind: "message" as const,
          content: message.content,
          score: clamp(0.2 + tokenSignal * 0.8, 0, 1),
          role: message.role,
          createdAt: message.created_at,
          tokenSignal,
        };
      })
      .filter((message) => message.tokenSignal > 0)
      .map((message) => ({
        id: `msg-${message.id}`,
        kind: "message" as const,
        content: message.content,
        score: message.score,
        role: message.role,
        createdAt: message.createdAt,
      }));

    return [...factEvidence, ...messageEvidence]
      .sort((left, right) => right.score - left.score)
      .slice(0, 10);
  }, [focusedNode, memory.facts, memory.messages]);

  const focusedDiagnostics = useMemo(() => {
    if (!focusedNode) {
      return null;
    }

    const duplicateCount = memory.nodes.filter(
      (node) => node.label.toLowerCase() === focusedNode.label.toLowerCase()
    ).length;
    const relatedCount = focusedIncomingEdges.length + focusedOutgoingEdges.length;

    return {
      duplicateRisk: duplicateCount > 1 ? "elevated" : "low",
      connectivity: relatedCount === 0 ? "isolated" : relatedCount < 3 ? "fragile" : "stable",
      momentum: focusedNode.weight >= 7 ? "strong" : focusedNode.weight >= 4 ? "moderate" : "weak",
      recency: focusedNode.updated_at,
    };
  }, [focusedIncomingEdges.length, focusedNode, focusedOutgoingEdges.length, memory.nodes]);

  const handleClearMemory = async () => {
    if (!sessionId) {
      return;
    }

    setClearing(true);
    try {
      await clearNovaMemory(sessionId, sessionMode);
      await loadMemory(true);
    } catch (clearError) {
      const message = clearError instanceof Error ? clearError.message : "Unable to clear NOVA memory";
      setError(message);
    } finally {
      setClearing(false);
    }
  };

  const hasGraphData = graphData.nodes.length > 0;
  const modeLabel = sessionMode === "volatile" ? "Incognito" : "Persistent";
  const activeSelectionCount = selectedNodeIds.length + selectedEdgeIds.length;

  const renderGraphCanvas = (heightClass: string, immersive: boolean) => (
    <div className={`mt-3 rounded-xl border border-[var(--border-subtle)] overflow-hidden bg-[var(--surface-input)]/70 ${heightClass} relative`}>
      <div className={`absolute inset-0 pointer-events-none ${themeBackdropClass(graphTheme)} ${immersive ? "opacity-100" : "opacity-90"}`} />

      {loading ? (
        <div className="h-full w-full flex items-center justify-center text-[var(--text-muted)] text-sm">Loading NOVA memory graph...</div>
      ) : !hasGraphData ? (
        <div className="h-full w-full flex items-center justify-center text-[var(--text-muted)] text-sm px-4 text-center">
          Memory graph is empty. Start chatting with NOVA to grow the brain.
        </div>
      ) : (
        <ForceGraph3D
          ref={graphRef}
          graphData={graphData}
          backgroundColor="rgba(0,0,0,0)"
          nodeLabel={(node) => {
            const currentNode = node as GraphNode;
            return `${currentNode.label} [${currentNode.type}] (weight ${currentNode.weight.toFixed(1)})`;
          }}
          nodeColor={(node) => (node as GraphNode).color}
          nodeVal={(node) => (node as GraphNode).val}
          linkColor={(link) => (link as GraphLink).color}
          linkWidth={(link) => 0.3 + Math.min(2.5, (link as GraphLink).weight * 0.4)}
          linkOpacity={0.62}
          linkDirectionalParticles={(link) =>
            (link as GraphLink).isSelected ? 5 : Math.max(1, Math.min(4, Math.round((link as GraphLink).weight)))
          }
          linkDirectionalParticleSpeed={(link) => 0.0025 + Math.min(0.009, (link as GraphLink).weight * 0.0009)}
          linkDirectionalParticleWidth={1.3}
          nodeOpacity={0.96}
          showNavInfo={false}
          enableNodeDrag={false}
          d3VelocityDecay={0.3}
          warmupTicks={45}
          cooldownTicks={120}
          onNodeClick={(node, event) => {
            const nodeId = resolveNodeId((node as GraphNode).id);
            if (nodeId < 0) {
              return;
            }

            setFocusedNodeId(nodeId);

            if (event?.shiftKey) {
              toggleNodeSelection(nodeId);
            }
          }}
          onLinkClick={(link, event) => {
            const graphLink = link as GraphLink;

            const sourceId = resolveNodeId(graphLink.source);
            const targetId = resolveNodeId(graphLink.target);
            const sourceWeight = sourceId >= 0 ? nodeLookup.get(sourceId)?.weight ?? 0 : 0;
            const targetWeight = targetId >= 0 ? nodeLookup.get(targetId)?.weight ?? 0 : 0;

            if (sourceId >= 0 || targetId >= 0) {
              setFocusedNodeId(targetWeight > sourceWeight ? targetId : sourceId);
            }

            if (event?.shiftKey) {
              toggleEdgeSelection(graphLink.id);
            }
          }}
        />
      )}
    </div>
  );

  const detailPanel = (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-chip)]/70 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-soft)] flex items-center gap-1">
          <Focus size={11} /> Node Intelligence
        </p>
        {focusedNode && (
          <span className="text-[10px] uppercase tracking-[0.1em] text-[var(--text-muted)]">
            Focus: {focusedNode.label}
          </span>
        )}
      </div>

      <div className="mt-2 inline-flex rounded-lg border border-[var(--border-subtle)] overflow-hidden">
        {DETAIL_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-2.5 py-1.5 text-[10px] uppercase tracking-[0.12em] transition-colors ${
              activeTab === tab.id
                ? "bg-[var(--accent-primary)] text-white"
                : "bg-[var(--surface-panel)] text-[var(--text-muted)] hover:text-[var(--app-text)]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {!focusedNode ? (
        <p className="text-xs text-[var(--text-muted)] leading-relaxed mt-3">
          Click to focus any node. Use Shift + Click to add nodes or edges into the bridge selection basket.
        </p>
      ) : (
        <div className="mt-3">
          {activeTab === "summary" && (
            <div className="space-y-2 text-xs text-[var(--text-muted)]">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-panel)]/85 p-2">
                  <p className="uppercase tracking-[0.11em] text-[var(--text-soft)]">Type</p>
                  <p className="mt-1 text-[var(--app-text)]">{focusedNode.type}</p>
                </div>
                <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-panel)]/85 p-2">
                  <p className="uppercase tracking-[0.11em] text-[var(--text-soft)]">Weight</p>
                  <p className="mt-1 text-[var(--app-text)]">{focusedNode.weight.toFixed(2)}</p>
                </div>
                <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-panel)]/85 p-2">
                  <p className="uppercase tracking-[0.11em] text-[var(--text-soft)]">Inbound</p>
                  <p className="mt-1 text-[var(--app-text)]">{focusedIncomingEdges.length}</p>
                </div>
                <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-panel)]/85 p-2">
                  <p className="uppercase tracking-[0.11em] text-[var(--text-soft)]">Outbound</p>
                  <p className="mt-1 text-[var(--app-text)]">{focusedOutgoingEdges.length}</p>
                </div>
              </div>

              <p className="leading-relaxed">
                This node gains strength when repeated facts and messages reinforce the same label, and when relation edges
                link it to multiple active concepts in the graph.
              </p>

              <p className="leading-relaxed">
                Last updated: <span className="text-[var(--app-text)]">{focusedNode.updated_at}</span>
              </p>
            </div>
          )}

          {activeTab === "relations" && (
            <div className="grid grid-cols-1 gap-2 text-xs">
              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-panel)]/85 p-2">
                <p className="uppercase tracking-[0.11em] text-[var(--text-soft)] mb-1">Incoming Relations</p>
                <ul className="space-y-1.5 max-h-32 overflow-y-auto no-scrollbar text-[var(--text-muted)]">
                  {focusedIncomingEdges.length === 0 ? (
                    <li>No inbound edges detected.</li>
                  ) : (
                    focusedIncomingEdges.map((edge) => (
                      <li key={`in-${edge.id}`}>
                        {(edge.source_label ?? nodeLookup.get(resolveNodeId(edge.source))?.label ?? edge.source) as string} --
                        {edge.relation}--&gt; {edge.target_label ?? focusedNode.label} ({edge.weight.toFixed(2)})
                      </li>
                    ))
                  )}
                </ul>
              </div>

              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-panel)]/85 p-2">
                <p className="uppercase tracking-[0.11em] text-[var(--text-soft)] mb-1">Outgoing Relations</p>
                <ul className="space-y-1.5 max-h-32 overflow-y-auto no-scrollbar text-[var(--text-muted)]">
                  {focusedOutgoingEdges.length === 0 ? (
                    <li>No outbound edges detected.</li>
                  ) : (
                    focusedOutgoingEdges.map((edge) => (
                      <li key={`out-${edge.id}`}>
                        {focusedNode.label} --{edge.relation}--&gt; {edge.target_label ?? nodeLookup.get(resolveNodeId(edge.target))?.label ?? edge.target} ({edge.weight.toFixed(2)})
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </div>
          )}

          {activeTab === "evidence" && (
            <ul className="space-y-2 max-h-64 overflow-y-auto no-scrollbar text-xs text-[var(--text-muted)]">
              {focusedEvidence.length === 0 ? (
                <li className="leading-relaxed">No direct evidence snippet found for this node in the current memory snapshot.</li>
              ) : (
                focusedEvidence.map((item) => (
                  <li key={item.id} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-panel)]/85 p-2">
                    <p className="uppercase tracking-[0.1em] text-[var(--text-soft)] mb-1">
                      {item.kind} • {item.role} • signal {item.score.toFixed(2)}
                    </p>
                    <p className="leading-relaxed text-[var(--app-text)]/90">{item.content}</p>
                  </li>
                ))
              )}
            </ul>
          )}

          {activeTab === "diagnostics" && focusedDiagnostics && (
            <div className="space-y-2 text-xs text-[var(--text-muted)]">
              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-panel)]/85 p-2">
                <p className="uppercase tracking-[0.11em] text-[var(--text-soft)]">Duplicate Risk</p>
                <p className="mt-1 text-[var(--app-text)]">{focusedDiagnostics.duplicateRisk}</p>
              </div>
              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-panel)]/85 p-2">
                <p className="uppercase tracking-[0.11em] text-[var(--text-soft)]">Connectivity</p>
                <p className="mt-1 text-[var(--app-text)]">{focusedDiagnostics.connectivity}</p>
              </div>
              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-panel)]/85 p-2">
                <p className="uppercase tracking-[0.11em] text-[var(--text-soft)]">Momentum</p>
                <p className="mt-1 text-[var(--app-text)]">{focusedDiagnostics.momentum}</p>
              </div>
              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-panel)]/85 p-2">
                <p className="uppercase tracking-[0.11em] text-[var(--text-soft)]">Last Activity</p>
                <p className="mt-1 text-[var(--app-text)]">{focusedDiagnostics.recency}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <>
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-panel)]/75 backdrop-blur-xl p-3 sm:p-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--text-soft)]">NOVA Brain</p>
            <h3 className="text-sm sm:text-base font-semibold text-[var(--app-text)] flex items-center gap-2 mt-1">
              <BrainCircuit size={16} className="text-[var(--accent-primary)]" />
              Graph Memory Layer
            </h3>
            <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-soft)] mt-1">
              Mode: {modeLabel} • Theme: {graphTheme}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg border border-[var(--border-subtle)] overflow-hidden">
              <button
                type="button"
                onClick={() => setGraphTheme("constellation")}
                className={`px-2.5 py-1.5 text-[10px] uppercase tracking-[0.11em] ${
                  graphTheme === "constellation"
                    ? "bg-[var(--accent-primary)] text-white"
                    : "bg-[var(--surface-panel)] text-[var(--text-muted)] hover:text-[var(--app-text)]"
                }`}
              >
                Constellation
              </button>
              <button
                type="button"
                onClick={() => setGraphTheme("dna")}
                className={`px-2.5 py-1.5 text-[10px] uppercase tracking-[0.11em] ${
                  graphTheme === "dna"
                    ? "bg-[var(--accent-primary)] text-white"
                    : "bg-[var(--surface-panel)] text-[var(--text-muted)] hover:text-[var(--app-text)]"
                }`}
              >
                DNA
              </button>
            </div>

            <button
              onClick={() => void loadMemory(true)}
              className="px-2.5 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-chip)] text-[var(--text-muted)] hover:text-[var(--app-text)] hover:bg-[var(--surface-chip-hover)] transition-colors text-xs flex items-center gap-1.5"
              title="Refresh memory"
              type="button"
            >
              <RefreshCw size={13} />
              Refresh
            </button>

            <button
              onClick={() => setExpanded(true)}
              className="px-2.5 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-chip)] text-[var(--text-muted)] hover:text-[var(--app-text)] hover:bg-[var(--surface-chip-hover)] transition-colors text-xs flex items-center gap-1.5"
              title="Expand graph workspace"
              type="button"
            >
              <Maximize2 size={13} />
              Expand
            </button>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
          <label className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-chip)] px-2.5 py-2 block md:col-span-2">
            <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-soft)] mb-1">Graph Search</p>
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Filter nodes, relations, and facts"
              className="w-full bg-transparent text-sm text-[var(--app-text)] placeholder-[var(--placeholder)] outline-none"
            />
          </label>

          <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-chip)] px-2.5 py-2">
            <div className="flex items-center justify-between gap-2 mb-1">
              <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-soft)] flex items-center gap-1">
                <SlidersHorizontal size={11} /> Min Node Weight
              </p>
              <span className="text-[10px] text-[var(--text-muted)]">{minWeight.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={Math.max(1, Math.ceil(maxNodeWeight))}
              step={0.2}
              value={minWeight}
              onChange={(event) => setMinWeight(Number(event.target.value))}
              className="w-full accent-[var(--accent-primary)]"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-3">
          <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-chip)] px-2.5 py-2">
            <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-soft)] flex items-center gap-1">
              <Database size={11} /> Nodes
            </p>
            <p className="text-sm font-semibold text-[var(--app-text)] mt-1">{memory.nodes.length}</p>
          </div>
          <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-chip)] px-2.5 py-2">
            <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-soft)] flex items-center gap-1">
              <Network size={11} /> Edges
            </p>
            <p className="text-sm font-semibold text-[var(--app-text)] mt-1">{memory.edges.length}</p>
          </div>
          <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-chip)] px-2.5 py-2">
            <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-soft)]">Facts</p>
            <p className="text-sm font-semibold text-[var(--app-text)] mt-1">{memory.facts.length}</p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleZoomIn}
            className="px-2.5 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-chip)] text-[var(--text-muted)] hover:text-[var(--app-text)] hover:bg-[var(--surface-chip-hover)] transition-colors text-xs"
          >
            Zoom In
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            className="px-2.5 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-chip)] text-[var(--text-muted)] hover:text-[var(--app-text)] hover:bg-[var(--surface-chip-hover)] transition-colors text-xs"
          >
            Zoom Out
          </button>
          <button
            type="button"
            onClick={handleFitView}
            className="px-2.5 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-chip)] text-[var(--text-muted)] hover:text-[var(--app-text)] hover:bg-[var(--surface-chip-hover)] transition-colors text-xs"
          >
            Fit View
          </button>
          <button
            type="button"
            onClick={() => setAutoRotate((previous) => !previous)}
            className="px-2.5 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-chip)] text-[var(--text-muted)] hover:text-[var(--app-text)] hover:bg-[var(--surface-chip-hover)] transition-colors text-xs"
          >
            {autoRotate ? "Pause Orbit" : "Resume Orbit"}
          </button>
          <button
            type="button"
            onClick={() => setAutoRefresh((previous) => !previous)}
            className="px-2.5 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-chip)] text-[var(--text-muted)] hover:text-[var(--app-text)] hover:bg-[var(--surface-chip-hover)] transition-colors text-xs"
          >
            Auto Refresh {autoRefresh ? "On" : "Off"}
          </button>
          <button
            type="button"
            onClick={() => void handleClearMemory()}
            disabled={clearing}
            className="px-2.5 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-chip)] text-[var(--text-muted)] hover:text-[var(--app-text)] hover:bg-[var(--surface-chip-hover)] transition-colors text-xs disabled:opacity-60"
          >
            <span className="inline-flex items-center gap-1.5">
              <RotateCcw size={12} /> {clearing ? "Resetting" : "Reset"}
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedNodeIds([]);
              setSelectedEdgeIds([]);
              setFocusedNodeId(null);
            }}
            className="px-2.5 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-chip)] text-[var(--text-muted)] hover:text-[var(--app-text)] hover:bg-[var(--surface-chip-hover)] transition-colors text-xs"
          >
            Clear Basket
          </button>
          <span className="px-2.5 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-chip)] text-[var(--text-muted)] text-xs inline-flex items-center gap-1.5">
            <Target size={12} /> Selected {activeSelectionCount} items for bridge
          </span>
        </div>

        {!expanded && renderGraphCanvas("h-[320px] sm:h-[390px]", false)}

        {error && <p className="mt-3 text-xs text-red-300/90">{error}</p>}

        {!expanded && <div className="mt-3">{detailPanel}</div>}
      </motion.section>

      {expanded && (
        <div className="fixed inset-0 z-[80] bg-[var(--app-bg)]/95 backdrop-blur-md p-3 sm:p-4">
          <div className="h-full rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-panel)]/90 shadow-2xl overflow-hidden flex flex-col">
            <div className="px-3 sm:px-4 py-3 border-b border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-soft)]">Immersive Graph Workspace</p>
                <p className="text-sm text-[var(--app-text)] font-semibold mt-1">Node Working Analysis View</p>
              </div>

              <div className="flex items-center gap-2">
                <div className="inline-flex rounded-lg border border-[var(--border-subtle)] overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setGraphTheme("constellation")}
                    className={`px-2.5 py-1.5 text-[10px] uppercase tracking-[0.11em] ${
                      graphTheme === "constellation"
                        ? "bg-[var(--accent-primary)] text-white"
                        : "bg-[var(--surface-panel)] text-[var(--text-muted)] hover:text-[var(--app-text)]"
                    }`}
                  >
                    Constellation
                  </button>
                  <button
                    type="button"
                    onClick={() => setGraphTheme("dna")}
                    className={`px-2.5 py-1.5 text-[10px] uppercase tracking-[0.11em] ${
                      graphTheme === "dna"
                        ? "bg-[var(--accent-primary)] text-white"
                        : "bg-[var(--surface-panel)] text-[var(--text-muted)] hover:text-[var(--app-text)]"
                    }`}
                  >
                    DNA
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setExpanded(false)}
                  className="px-2.5 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-chip)] text-[var(--text-muted)] hover:text-[var(--app-text)] hover:bg-[var(--surface-chip-hover)] transition-colors text-xs inline-flex items-center gap-1.5"
                >
                  <Minimize2 size={13} /> Close
                </button>
              </div>
            </div>

            <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-3 p-3 sm:p-4">
              <div className="min-h-0 flex flex-col">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <label className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-chip)] px-2.5 py-2 block md:col-span-2">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-soft)] mb-1">Graph Search</p>
                    <input
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder="Filter nodes, relations, and facts"
                      className="w-full bg-transparent text-sm text-[var(--app-text)] placeholder-[var(--placeholder)] outline-none"
                    />
                  </label>

                  <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-chip)] px-2.5 py-2">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-soft)] flex items-center gap-1">
                        <SlidersHorizontal size={11} /> Min Node Weight
                      </p>
                      <span className="text-[10px] text-[var(--text-muted)]">{minWeight.toFixed(1)}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={Math.max(1, Math.ceil(maxNodeWeight))}
                      step={0.2}
                      value={minWeight}
                      onChange={(event) => setMinWeight(Number(event.target.value))}
                      className="w-full accent-[var(--accent-primary)]"
                    />
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleZoomIn}
                    className="px-2.5 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-chip)] text-[var(--text-muted)] hover:text-[var(--app-text)] hover:bg-[var(--surface-chip-hover)] transition-colors text-xs"
                  >
                    Zoom In
                  </button>
                  <button
                    type="button"
                    onClick={handleZoomOut}
                    className="px-2.5 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-chip)] text-[var(--text-muted)] hover:text-[var(--app-text)] hover:bg-[var(--surface-chip-hover)] transition-colors text-xs"
                  >
                    Zoom Out
                  </button>
                  <button
                    type="button"
                    onClick={handleFitView}
                    className="px-2.5 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-chip)] text-[var(--text-muted)] hover:text-[var(--app-text)] hover:bg-[var(--surface-chip-hover)] transition-colors text-xs"
                  >
                    Fit View
                  </button>
                  <button
                    type="button"
                    onClick={() => setAutoRotate((previous) => !previous)}
                    className="px-2.5 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-chip)] text-[var(--text-muted)] hover:text-[var(--app-text)] hover:bg-[var(--surface-chip-hover)] transition-colors text-xs"
                  >
                    {autoRotate ? "Pause Orbit" : "Resume Orbit"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void loadMemory(true)}
                    className="px-2.5 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-chip)] text-[var(--text-muted)] hover:text-[var(--app-text)] hover:bg-[var(--surface-chip-hover)] transition-colors text-xs"
                  >
                    Refresh
                  </button>
                  <button
                    type="button"
                    onClick={() => setAutoRefresh((previous) => !previous)}
                    className="px-2.5 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-chip)] text-[var(--text-muted)] hover:text-[var(--app-text)] hover:bg-[var(--surface-chip-hover)] transition-colors text-xs"
                  >
                    Auto Refresh {autoRefresh ? "On" : "Off"}
                  </button>
                  <span className="px-2.5 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-chip)] text-[var(--text-muted)] text-xs inline-flex items-center gap-1.5">
                    <Target size={12} /> Selected {activeSelectionCount}
                  </span>
                </div>

                <div className="flex-1 min-h-0">{renderGraphCanvas("h-full min-h-[360px]", true)}</div>

                {error && <p className="mt-2 text-xs text-red-300/90">{error}</p>}
              </div>

              <div className="min-h-0 overflow-y-auto no-scrollbar">{detailPanel}</div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default NovaMemoryGraph;
