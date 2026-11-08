import { useState, useCallback, useRef, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  MiniMap,
  BackgroundVariant,
  addEdge,
  reconnectEdge,
  applyNodeChanges,
  applyEdgeChanges,
  Connection,
  EdgeChange,
  NodeChange,
  ReactFlowInstance,
  ConnectionMode,
  PanOnScrollMode,
  SelectionMode,
  ConnectionLineType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  ArrowLeft,
  Play,
  Undo2,
  Redo2,
  MoreHorizontal,
  Plus,
  MousePointer,
  Hand,
  Layers,
  Minus,
  Maximize2,
  History,
  Trash2,
  Loader2,
  Terminal,
} from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as Tooltip from '@radix-ui/react-tooltip';
import { EditableWorkflowTitle } from './EditableWorkflowTitle.js';
import { CloudAutosaveIndicator, CloudSaveStatus } from './CloudAutosaveIndicator.js';
import { WorkflowNode } from './WorkflowNode.js';
import { WorkflowEdge } from './WorkflowEdge.js';
import { NodePalette } from './NodePalette.js';
import { NodeConfigPanel } from './NodeConfigPanel.js';
import { ExecutionPanel } from './ExecutionPanel.js';
import {
  CanvasNode,
  CanvasEdge,
  workflowGraphToReactFlow,
  reactFlowToWorkflowGraph,
} from './graphConverter.js';
import {
  api,
  WorkflowRecord,
  NodeTypeMetadata,
  RunRecord,
  NodeRunRecord,
} from '../api/client.js';
import { ThemeSelector, useTheme } from '../components/ThemeSelector.js';

const nodeTypes = {
  workflowNode: WorkflowNode,
};

const edgeTypes = {
  workflowEdge: WorkflowEdge,
};

interface WorkflowEditorProps {
  workflow: WorkflowRecord;
  nodeTypesMeta: NodeTypeMetadata[];
  onSave: (updated: WorkflowRecord) => void;
  onOpenHistory: () => void;
  onBack?: () => void;
  onDeleteWorkflow?: () => void;
}

export function WorkflowEditor({
  workflow,
  nodeTypesMeta,
  onSave,
  onOpenHistory,
  onBack,
  onDeleteWorkflow,
}: WorkflowEditorProps) {
  const { theme } = useTheme();
  const metaMap = useRef(new Map<string, NodeTypeMetadata>());
  useEffect(() => {
    metaMap.current = new Map(nodeTypesMeta.map((n) => [n.type, n]));
  }, [nodeTypesMeta]);

  // Convert initial workflow graph to React Flow format
  const initial = workflowGraphToReactFlow(workflow.graph, metaMap.current);
  const [nodes, setNodes] = useState<CanvasNode[]>(initial.nodes);
  const [edges, setEdges] = useState<CanvasEdge[]>(initial.edges);
  const [name, setName] = useState(workflow.name);
  const [isActive, setIsActive] = useState(workflow.active);
  const [isActivating, setIsActivating] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Helper to generate state signature for comparison
  const getGraphSignature = useCallback((title: string, nds: CanvasNode[], eds: CanvasEdge[]) => {
    return JSON.stringify({
      name: title,
      nodes: nds.map((n) => ({ id: n.id, type: n.type, pos: n.position, data: n.data })),
      edges: eds.map((e) => ({ id: e.id, source: e.source, sourceHandle: e.sourceHandle, target: e.target, targetHandle: e.targetHandle })),
    });
  }, []);

  // Cloud autosave state
  const [saveStatus, setSaveStatus] = useState<CloudSaveStatus>('saved');
  const [saveError, setSaveError] = useState<string | null>(null);
  const lastSavedHashRef = useRef<string>(getGraphSignature(workflow.name, initial.nodes, initial.edges));
  const inflightSaveRef = useRef<boolean>(false);
  const pendingSaveRef = useRef<boolean>(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Undo / Redo history
  interface HistorySnapshot {
    nodes: CanvasNode[];
    edges: CanvasEdge[];
  }
  const [past, setPast] = useState<HistorySnapshot[]>([]);
  const [future, setFuture] = useState<HistorySnapshot[]>([]);

  const pushHistory = useCallback((currentNodes: CanvasNode[], currentEdges: CanvasEdge[]) => {
    setPast((prev) => [...prev.slice(-25), { nodes: currentNodes, edges: currentEdges }]);
    setFuture([]);
  }, []);

  const handleUndo = useCallback(() => {
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    const newPast = past.slice(0, past.length - 1);
    setFuture((f) => [{ nodes, edges }, ...f]);
    setPast(newPast);
    setNodes(previous.nodes);
    setEdges(previous.edges);
    setIsDirty(true);
    setSaveStatus((prev) => (prev === 'saving' ? prev : 'unsaved'));
  }, [past, nodes, edges]);

  const handleRedo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[0];
    const newFuture = future.slice(1);
    setPast((p) => [...p, { nodes, edges }]);
    setFuture(newFuture);
    setNodes(next.nodes);
    setEdges(next.edges);
    setIsDirty(true);
    setSaveStatus((prev) => (prev === 'saving' ? prev : 'unsaved'));
  }, [future, nodes, edges]);

  const initialSelectedId = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('selectNode')
    : null;
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(initialSelectedId);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [autoConnectSourceId, setAutoConnectSourceId] = useState<string | null>(null);
  const [interactionMode, setInteractionMode] = useState<'select' | 'pan'>('select');
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [isConnecting, setIsConnecting] = useState(false);

  // Execution & Live SSE state
  const [currentRun, setCurrentRun] = useState<RunRecord | null>(null);
  const [nodeRuns, setNodeRuns] = useState<NodeRunRecord[]>([]);
  const [isPanelVisible, setIsPanelVisible] = useState(false);
  const [panelHeight, setPanelHeight] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('vulp_execution_panel_height');
      return saved ? Math.max(160, Math.min(650, parseInt(saved, 10))) : 280;
    } catch {
      return 280;
    }
  });
  const [isRunning, setIsRunning] = useState(false);

  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance<CanvasNode, CanvasEdge> | null>(null);

  const prevWorkflowIdRef = useRef(workflow.id);

  // Sync when workflow prop changes (e.g. initial mount or switching workflows)
  useEffect(() => {
    if (prevWorkflowIdRef.current !== workflow.id) {
      prevWorkflowIdRef.current = workflow.id;
      const converted = workflowGraphToReactFlow(workflow.graph, metaMap.current);
      setNodes(converted.nodes);
      setEdges(converted.edges);
      setName(workflow.name);
      setIsActive(workflow.active);
      setIsDirty(false);
      setSaveStatus('saved');
      setSaveError(null);
      lastSavedHashRef.current = getGraphSignature(workflow.name, converted.nodes, converted.edges);
      setPast([]);
      setFuture([]);
      const querySelect = typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search).get('selectNode')
        : null;
      setSelectedNodeId(querySelect || null);
    } else {
      // Same workflow instance: only sync active state or name if changed externally
      setIsActive(workflow.active);
      if (workflow.name !== name && !isDirty) {
        setName(workflow.name);
      }
    }
  }, [workflow.id, workflow.active, workflow.name, getGraphSignature, isDirty, name]);

  // Fetch latest run outputs for current workflow
  const fetchLatestRun = useCallback(async () => {
    if (!workflow.id) return;
    try {
      const runs = await api.getRuns();
      const wfRuns = runs.filter((r) => r.workflowId === workflow.id);
      if (wfRuns.length > 0) {
        const latestRun = wfRuns[0];
        const details = await api.getRunDetails(latestRun.id);
        if (details && details.run) {
          setCurrentRun(details.run);
          if (details.nodeRuns) {
            setNodeRuns(details.nodeRuns);
            setNodes((nds) =>
              nds.map((n) => {
                const nr = details.nodeRuns.find((r) => r.nodeKey === n.id);
                return nr ? { ...n, data: { ...n.data, executionStatus: nr.status } } : n;
              })
            );
          }
        }
      }
    } catch (err) {
      console.warn('Could not load latest run details:', err);
    }
  }, [workflow.id]);

  // Hydrate latest run outputs on workflow load so dynamic variable discovery has runtime outputs
  useEffect(() => {
    fetchLatestRun();
  }, [fetchLatestRun]);

  // Handle React Flow node changes
  const onNodesChange = useCallback((changes: NodeChange<CanvasNode>[]) => {
    setNodes((nds) => applyNodeChanges<CanvasNode>(changes, nds));
    if (changes.some((c) => c.type === 'position' || c.type === 'remove' || c.type === 'add')) {
      setIsDirty(true);
      setSaveStatus((prev) => (prev === 'saving' ? prev : 'unsaved'));
    }
  }, []);

  // Handle React Flow edge changes
  const onEdgesChange = useCallback((changes: EdgeChange<CanvasEdge>[]) => {
    setEdges((eds) => applyEdgeChanges<CanvasEdge>(changes, eds));
    if (changes.some((c) => c.type === 'remove' || c.type === 'add')) {
      setIsDirty(true);
      setSaveStatus((prev) => (prev === 'saving' ? prev : 'unsaved'));
    }
  }, []);

  // Connection validation with direction, self-loop and trigger guard
  const isValidConnection = useCallback(
    (connection: CanvasEdge | Connection) => {
      if (!connection.source || !connection.target) return false;
      if (connection.source === connection.target) return false;

      // Disallow connecting into a trigger step (triggers cannot receive inputs)
      const targetNode = nodes.find((n) => n.id === connection.target);
      if (targetNode?.data.category === 'trigger') {
        return false;
      }

      // Disallow connecting target handle to target handle
      const sHandle = connection.sourceHandle || '';
      const tHandle = connection.targetHandle || '';
      if (sHandle.startsWith('input') && tHandle.startsWith('input')) {
        return false;
      }

      return true;
    },
    [nodes]
  );

  // Handle connection with automatic cardinal position selection
  const onConnect = useCallback(
    (params: Connection) => {
      if (!params.source || !params.target) return;
      if (params.source === params.target) return;

      pushHistory(nodes, edges);

      const sourceNode = nodes.find((n) => n.id === params.source);
      const targetNode = nodes.find((n) => n.id === params.target);

      let resolvedSourceHandle = params.sourceHandle || 'default';
      let resolvedTargetHandle = params.targetHandle || 'input';

      if (sourceNode?.data.type === 'logic.if') {
        if (params.sourceHandle === 'false' || params.sourceHandle === 'false-bottom') {
          resolvedSourceHandle = params.sourceHandle;
        } else if (params.sourceHandle === 'true' || params.sourceHandle === 'true-top') {
          resolvedSourceHandle = params.sourceHandle;
        } else {
          resolvedSourceHandle = 'true';
        }
      } else {
        resolvedSourceHandle = params.sourceHandle || 'default';
      }

      if (targetNode?.data.type === 'logic.merge') {
        resolvedTargetHandle = params.targetHandle || 'input';
      } else {
        resolvedTargetHandle = params.targetHandle || 'input';
      }

      const branch = resolvedSourceHandle.startsWith('true')
        ? 'true'
        : resolvedSourceHandle.startsWith('false')
        ? 'false'
        : 'default';

      const newEdge: CanvasEdge = {
        id: `e_${params.source}_${resolvedSourceHandle}_to_${params.target}_${resolvedTargetHandle}`,
        type: 'workflowEdge',
        source: params.source,
        sourceHandle: resolvedSourceHandle,
        target: params.target,
        targetHandle: resolvedTargetHandle,
        animated: false,
        data: { branch },
        style: { stroke: 'var(--color-edge)', strokeWidth: 1.75 },
      };

      setEdges((eds) => addEdge(newEdge, eds));
      setIsDirty(true);
      setSaveStatus((prev) => (prev === 'saving' ? prev : 'unsaved'));
    },
    [nodes, edges, pushHistory]
  );

  // Handle edge reconnection
  const onReconnect = useCallback(
    (oldEdge: CanvasEdge, newConnection: Connection) => {
      pushHistory(nodes, edges);
      setEdges((eds) => reconnectEdge(oldEdge, newConnection, eds));
      setIsDirty(true);
      setSaveStatus((prev) => (prev === 'saving' ? prev : 'unsaved'));
    },
    [nodes, edges, pushHistory]
  );

  // Contextual Add Action callback from trigger node
  const handleOpenAddActionForNode = useCallback((sourceNodeId: string) => {
    setSelectedNodeId(null);
    setAutoConnectSourceId(sourceNodeId);
    setIsPaletteOpen(true);
  }, []);

  // Handle node selection (progressive disclosure: closes Step Library when opening inspector)
  const onNodeClick = useCallback((_: React.MouseEvent, node: CanvasNode) => {
    setSelectedNodeId(node.id);
    setIsPaletteOpen(false);
    setAutoConnectSourceId(null);
  }, []);

  // Canvas pane click (progressive disclosure: dismisses any open contextual drawer)
  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setIsPaletteOpen(false);
    setAutoConnectSourceId(null);
  }, []);

  // Track zoom level changes
  const onMoveEnd = useCallback((_: any, viewport: { zoom: number }) => {
    setZoomLevel(Math.round(viewport.zoom * 100));
  }, []);

  // Fit view helper capping maximum zoom to 100% (never upscale small graphs to 200%)
  const handleFitView = useCallback(() => {
    reactFlowInstance?.fitView({ maxZoom: 1, minZoom: 0.2, padding: 0.25, duration: 200 });
  }, [reactFlowInstance]);

  // Add node from Palette (closes palette upon selection and selects newly added node)
  const addNodeByType = useCallback(
    (type: string, position?: { x: number; y: number }, autoSelect = true) => {
      pushHistory(nodes, edges);
      const meta = metaMap.current.get(type);
      const key = `${type.replace(/[^a-z0-9]/gi, '_')}_${Date.now().toString(36).slice(-4)}`;

      const currentAutoConnectId = autoConnectSourceId;
      const sourceNode = currentAutoConnectId
        ? nodes.find((n) => n.id === currentAutoConnectId)
        : null;

      let pos = position;
      if (!pos) {
        if (sourceNode) {
          pos = {
            x: sourceNode.position.x + 320,
            y: sourceNode.position.y,
          };
        } else if (reactFlowInstance) {
          pos = reactFlowInstance.screenToFlowPosition({
            x: window.innerWidth / 2,
            y: window.innerHeight / 2,
          });
        } else {
          pos = { x: 250, y: 150 };
        }
      }

      const initialParams: Record<string, any> = {};
      if (meta?.params) {
        for (const p of meta.params) {
          if (p.default !== undefined) {
            initialParams[p.name] = p.default;
          }
        }
      }

      const newNode: CanvasNode = {
        id: key,
        type: 'workflowNode',
        position: pos,
        data: {
          key,
          type,
          name: meta?.label || type,
          params: initialParams,
          category: meta?.category,
          outputs: meta?.outputs || ['default'],
          executionStatus: 'idle',
        },
      };

      setNodes((nds) => [...nds, newNode]);

      if (sourceNode) {
        const newEdge: CanvasEdge = {
          id: `e_${sourceNode.id}_default_to_${key}_input`,
          type: 'workflowEdge',
          source: sourceNode.id,
          sourceHandle: 'default',
          target: key,
          targetHandle: 'input',
          animated: false,
          data: { branch: 'default' },
          style: { stroke: 'var(--color-edge)', strokeWidth: 1.75 },
        };
        setEdges((eds) => addEdge(newEdge, eds));
        setAutoConnectSourceId(null);
      }

      setIsPaletteOpen(false); // Close library after step is chosen
      if (autoSelect) {
        setSelectedNodeId(key);
      }
      setIsDirty(true);
      setSaveStatus((prev) => (prev === 'saving' ? prev : 'unsaved'));

      if (sourceNode && reactFlowInstance) {
        setTimeout(() => {
          reactFlowInstance.fitView({ maxZoom: 1, padding: 0.3, duration: 250 });
        }, 50);
      }
    },
    [reactFlowInstance, nodes, edges, pushHistory, autoConnectSourceId]
  );

  // Drag and drop onto canvas
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData('application/reactflow');
      if (!type || !reactFlowInstance) return;

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      addNodeByType(type, position, false);
    },
    [reactFlowInstance, addNodeByType]
  );

  // Update node data from Config Panel
  const handleUpdateNode = useCallback((key: string, updates: Partial<CanvasNode['data']>) => {
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === key) {
          return {
            ...n,
            data: {
              ...n.data,
              ...updates,
            },
          };
        }
        return n;
      })
    );
    setIsDirty(true);
    setSaveStatus((prev) => (prev === 'saving' ? prev : 'unsaved'));
  }, []);

  // Delete node
  const handleDeleteNode = useCallback((key: string) => {
    pushHistory(nodes, edges);
    setNodes((nds) => nds.filter((n) => n.id !== key));
    setEdges((eds) => eds.filter((e) => e.source !== key && e.target !== key));
    if (selectedNodeId === key) {
      setSelectedNodeId(null);
    }
    setIsDirty(true);
    setSaveStatus((prev) => (prev === 'saving' ? prev : 'unsaved'));
  }, [selectedNodeId, nodes, edges, pushHistory]);

  // Core save function
  const performSave = async (explicitName?: string): Promise<WorkflowRecord | null> => {
    const currentName = explicitName !== undefined ? explicitName : name;
    const currentNodes = nodes;
    const currentEdges = edges;
    const targetSignature = getGraphSignature(currentName, currentNodes, currentEdges);

    if (inflightSaveRef.current) {
      pendingSaveRef.current = true;
      return null;
    }

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    inflightSaveRef.current = true;
    setSaveStatus('saving');
    setSaveError(null);

    try {
      const graph = reactFlowToWorkflowGraph(currentNodes, currentEdges);
      const updated = await api.updateWorkflow(workflow.id, {
        name: currentName,
        graph,
      });

      // Check if new modifications occurred while this save was in flight
      const latestSignature = getGraphSignature(name, nodes, edges);
      if (latestSignature !== targetSignature || pendingSaveRef.current) {
        inflightSaveRef.current = false;
        pendingSaveRef.current = false;
        setSaveStatus('unsaved');
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
          performSave();
        }, 1000);
        onSave(updated);
        return updated;
      }

      // Server-confirmed persistence with no concurrent edits
      lastSavedHashRef.current = targetSignature;
      inflightSaveRef.current = false;
      pendingSaveRef.current = false;
      setIsDirty(false);
      setSaveStatus('saved');
      onSave(updated);
      return updated;
    } catch (err: any) {
      inflightSaveRef.current = false;
      pendingSaveRef.current = false;
      const msg = err?.message || 'Failed to save workflow';
      setSaveStatus('error');
      setSaveError(msg);
      return null;
    }
  };

  // Keyboard shortcuts: Cmd+S / Ctrl+S (save), Cmd+Z (undo), Cmd+Shift+Z / Cmd+Y (redo)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable
      ) {
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        performSave();
      } else if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
      } else if (
        ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'z') ||
        ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y')
      ) {
        e.preventDefault();
        handleRedo();
      } else if (
        (e.altKey && (e.code === 'KeyT' || e.key.toLowerCase() === 't')) ||
        ((e.metaKey || e.ctrlKey) && (e.code === 'Backquote' || e.key === '`'))
      ) {
        e.preventDefault();
        setIsPanelVisible((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo, name, nodes, edges]);

  // Debounced auto-save: persist changes after 1.5s of inactivity
  useEffect(() => {
    const currentSig = getGraphSignature(name, nodes, edges);
    if (currentSig !== lastSavedHashRef.current) {
      if (saveStatus !== 'saving' && saveStatus !== 'error') {
        setSaveStatus('unsaved');
      }
      setIsDirty(true);
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
      saveTimerRef.current = setTimeout(() => {
        performSave();
      }, 1500);
    }
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [nodes, edges, name, getGraphSignature]);

  // Toggle active/published state
  const handleToggleActive = async () => {
    setIsActivating(true);
    try {
      if (!isActive) {
        if (saveStatus === 'unsaved' || isDirty) {
          const saved = await performSave();
          if (!saved) {
            setIsActivating(false);
            return;
          }
        }
        const res = await api.activateWorkflow(workflow.id);
        setIsActive(true);
        onSave(res.workflow);
      } else {
        const res = await api.deactivateWorkflow(workflow.id);
        setIsActive(false);
        onSave(res.workflow);
      }
    } catch (err: any) {
      alert(`Cannot toggle activation: ${err.message}`);
    } finally {
      setIsActivating(false);
    }
  };

  // Immediate Execution of Workflow Automation
  const handleRunWorkflow = async () => {
    if (isRunning) return;

    if (saveStatus === 'unsaved' || isDirty) {
      const saved = await performSave();
      if (!saved) return;
    }

    const triggers = nodes.filter((n) => n.data.category === 'trigger');
    if (triggers.length === 0) {
      alert('Cannot run: your workflow has no Trigger step. Please add a Manual Trigger, Webhook, or Schedule step.');
      return;
    }

    const targetTrigger =
      (selectedNodeId && nodes.find((n) => n.id === selectedNodeId && n.data.category === 'trigger')) ||
      triggers[0];

    const triggerKey = targetTrigger.data.key || targetTrigger.id;

    // Extract payload from configured trigger parameters
    let parsedPayload: any = {};
    const rawPayload = targetTrigger.data.params?.payload;
    if (rawPayload !== undefined && rawPayload !== null) {
      if (typeof rawPayload === 'object') {
        parsedPayload = rawPayload;
      } else if (typeof rawPayload === 'string' && rawPayload.trim()) {
        try {
          parsedPayload = JSON.parse(rawPayload);
        } catch {
          alert('Invalid JSON in trigger payload. Please check your trigger configuration.');
          return;
        }
      }
    }

    setIsRunning(true);
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: { ...n.data, executionStatus: 'idle' },
      }))
    );
    setNodeRuns([]);
    setCurrentRun(null);
    setIsPanelVisible(true);

    try {
      const { runId } = await api.runWorkflow(workflow.id, {
        triggerKey,
        triggerPayload: parsedPayload,
      });

      // Active fallback polling ensures execution status & logs are updated even if SSE drops
      let pollActive = true;
      const pollRun = async () => {
        if (!pollActive) return;
        try {
          const details = await api.getRunDetails(runId);
          if (details && details.run) {
            setCurrentRun(details.run);
            if (details.nodeRuns && details.nodeRuns.length > 0) {
              setNodeRuns(details.nodeRuns);
              setNodes((nds) =>
                nds.map((n) => {
                  const nr = details.nodeRuns.find((r) => r.nodeKey === n.id);
                  return nr ? { ...n, data: { ...n.data, executionStatus: nr.status } } : n;
                })
              );
            }
            if (details.run.status !== 'running' && details.run.status !== 'queued') {
              pollActive = false;
              setIsRunning(false);
              setEdges((eds) =>
                eds.map((edge) => ({ ...edge, data: { ...edge.data, isExecuting: false } }))
              );
              return;
            }
          }
        } catch (pollErr) {
          console.warn('[Poll] Run poll error:', pollErr);
        }
        if (pollActive) {
          setTimeout(pollRun, 500);
        }
      };

      // Trigger immediate poll
      setTimeout(pollRun, 150);

      const eventsUrl = api.getRunEventsUrl(runId);
      const eventSource = new EventSource(eventsUrl);

      eventSource.addEventListener('snapshot', (e) => {
        try {
          const snapshot = JSON.parse(e.data);
          if (snapshot.run) setCurrentRun(snapshot.run);
          if (snapshot.nodeRuns && snapshot.nodeRuns.length > 0) {
            setNodeRuns(snapshot.nodeRuns);
            setNodes((nds) =>
              nds.map((n) => {
                const nr = snapshot.nodeRuns.find((r: any) => r.nodeKey === n.id);
                return nr ? { ...n, data: { ...n.data, executionStatus: nr.status } } : n;
              })
            );
          }
        } catch (err) {
          console.error('Error parsing SSE snapshot:', err);
        }
      });

      eventSource.addEventListener('node.started', (e) => {
        const evt = JSON.parse(e.data);
        setNodes((nds) =>
          nds.map((n) =>
            n.id === evt.nodeKey
              ? { ...n, data: { ...n.data, executionStatus: 'running' } }
              : n
          )
        );
        setEdges((eds) =>
          eds.map((edge) =>
            edge.target === evt.nodeKey || edge.source === evt.nodeKey
              ? { ...edge, data: { ...edge.data, isExecuting: true } }
              : edge
          )
        );
      });

      eventSource.addEventListener('node.finished', (e) => {
        const evt = JSON.parse(e.data);
        setNodes((nds) =>
          nds.map((n) =>
            n.id === evt.nodeKey
              ? { ...n, data: { ...n.data, executionStatus: evt.status } }
              : n
          )
        );
        setEdges((eds) =>
          eds.map((edge) =>
            edge.target === evt.nodeKey
              ? { ...edge, data: { ...edge.data, isExecuting: false } }
              : edge
          )
        );

        setNodeRuns((prev) => {
          const exists = prev.find((nr) => nr.nodeKey === evt.nodeKey);
          if (exists) {
            return prev.map((nr) => (nr.nodeKey === evt.nodeKey ? { ...nr, ...evt } : nr));
          }
          const nodeMeta = nodes.find((n) => n.id === evt.nodeKey);
          return [
            ...prev,
            {
              id: `${evt.runId}_${evt.nodeKey}`,
              runId: evt.runId,
              seq: prev.length + 1,
              nodeKey: evt.nodeKey,
              nodeName: nodeMeta?.data.name || evt.nodeKey,
              nodeType: nodeMeta?.data.type || 'unknown',
              status: evt.status,
              attempts: evt.attempts,
              paramsResolved: evt.paramsResolved,
              output: evt.output,
              error: evt.error,
              logs: evt.logs || [],
              startedAt: evt.at,
              finishedAt: evt.at,
            },
          ];
        });
      });

      eventSource.addEventListener('run.finished', (e) => {
        const evt = JSON.parse(e.data);
        pollActive = false;
        setIsRunning(false);
        setCurrentRun((prev) => (prev ? { ...prev, status: evt.status, error: evt.error } : null));
        setEdges((eds) =>
          eds.map((edge) => ({ ...edge, data: { ...edge.data, isExecuting: false } }))
        );
        eventSource.close();
        // Final database sync to ensure all logs and step outputs are in state
        api.getRunDetails(runId).then((details) => {
          if (details && details.nodeRuns) {
            setCurrentRun(details.run);
            setNodeRuns(details.nodeRuns);
          }
        }).catch(() => {});
      });

      eventSource.onerror = (err) => {
        console.warn('SSE connection error / closed:', err);
        eventSource.close();
        // Do not force isRunning to false here; background pollRun will finish and set status
      };
    } catch (err: any) {
      setIsRunning(false);
      alert(`Execution failed: ${err.message}`);
    }
  };

  const handleCancelRun = async () => {
    if (!currentRun?.id) return;
    try {
      await api.cancelRun(currentRun.id);
    } catch (err: any) {
      console.error('Failed to cancel run:', err);
    }
  };

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || null;
  const selectedNodeMeta = selectedNode
    ? metaMap.current.get(selectedNode.data.type)
    : undefined;

  const isInitialCanvas =
    nodes.length === 1 &&
    edges.length === 0 &&
    (nodes[0]?.data.type === 'manual.trigger' || nodes[0]?.data.category === 'trigger');

  const displayNodes = nodes.map((n) => {
    const hasOutgoing = edges.some((e) => e.source === n.id);
    const showAddActionAffordance =
      n.data.type === 'manual.trigger' && (isInitialCanvas || !hasOutgoing);

    return {
      ...n,
      selected: n.id === selectedNodeId,
      data: {
        ...n.data,
        showAddActionAffordance,
        onAddNextAction: handleOpenAddActionForNode,
      },
    };
  });

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#0F0F0F] select-none font-sans">
      {/* Refined Minimal Production-Grade Topbar */}
      <header className="h-12 px-3.5 bg-[#0F0F0F] border-b border-[#222222] flex items-center justify-between shrink-0 z-10 select-none">
        {/* Left: Back to workflows + Editable title + Cloud autosave icon */}
        <div className="flex items-center gap-2 min-w-0 max-w-[65%]">
          {onBack && (
            <Tooltip.Root delayDuration={150}>
              <Tooltip.Trigger asChild>
                <button
                  type="button"
                  onClick={onBack}
                  className="p-1.5 rounded-[8px] text-text-muted hover:text-text-primary hover:bg-[#1A1A1A] transition-colors shrink-0"
                  aria-label="Back to Workflows"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content
                  side="bottom"
                  sideOffset={8}
                  className="z-50 px-2 py-1 text-xs font-medium text-text-primary bg-[#1C1C1C] border border-[#2E2E2E] rounded-[6px] shadow-2xl pointer-events-none select-none"
                >
                  Back to Workflows
                  <Tooltip.Arrow className="fill-[#1C1C1C]" />
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          )}

          {/* Editable Workflow Title */}
          <EditableWorkflowTitle
            name={name}
            onSaveName={(newName) => {
              setName(newName);
              setIsDirty(true);
              performSave(newName);
            }}
          />

          {/* Unified Cloud Autosave Indicator */}
          <CloudAutosaveIndicator
            status={saveStatus}
            error={saveError}
            onSaveNow={() => performSave()}
            onRetry={() => performSave()}
          />
        </div>

        {/* Right cluster: Undo/Redo, Run, Publish/Published, Overflow Menu */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Undo / Redo */}
          <div className="flex items-center gap-0.5 text-text-muted">
            <Tooltip.Root delayDuration={150}>
              <Tooltip.Trigger asChild>
                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={past.length === 0}
                  className="p-1.5 rounded-[8px] hover:bg-[#1A1A1A] hover:text-text-primary transition-colors disabled:opacity-25"
                  aria-label="Undo"
                >
                  <Undo2 className="w-4 h-4" />
                </button>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content
                  side="bottom"
                  sideOffset={8}
                  className="z-50 px-2 py-1 text-xs font-medium text-text-primary bg-[#1C1C1C] border border-[#2E2E2E] rounded-[6px] shadow-2xl pointer-events-none select-none"
                >
                  Undo (⌘Z)
                  <Tooltip.Arrow className="fill-[#1C1C1C]" />
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>

            <Tooltip.Root delayDuration={150}>
              <Tooltip.Trigger asChild>
                <button
                  type="button"
                  onClick={handleRedo}
                  disabled={future.length === 0}
                  className="p-1.5 rounded-[8px] hover:bg-[#1A1A1A] hover:text-text-primary transition-colors disabled:opacity-25"
                  aria-label="Redo"
                >
                  <Redo2 className="w-4 h-4" />
                </button>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content
                  side="bottom"
                  sideOffset={8}
                  className="z-50 px-2 py-1 text-xs font-medium text-text-primary bg-[#1C1C1C] border border-[#2E2E2E] rounded-[6px] shadow-2xl pointer-events-none select-none"
                >
                  Redo (⇧⌘Z)
                  <Tooltip.Arrow className="fill-[#1C1C1C]" />
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          </div>

          <div className="h-3.5 w-[1px] bg-[#262626] mx-0.5" />

          {/* Run Button */}
          <Tooltip.Root delayDuration={200}>
            <Tooltip.Trigger asChild>
              <button
                type="button"
                onClick={handleRunWorkflow}
                disabled={isRunning}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#181818] hover:bg-[#222222] border border-[#282828] text-text-primary text-xs font-medium shadow-sm transition-all active:scale-[0.98] disabled:opacity-40 cursor-pointer"
              >
                {isRunning ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />
                ) : (
                  <Play className="w-3.5 h-3.5 text-text-secondary fill-current" />
                )}
                <span>{isRunning ? 'Running' : 'Run'}</span>
              </button>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content
                side="bottom"
                sideOffset={8}
                className="z-50 px-2 py-1 text-xs font-medium text-text-primary bg-[#1C1C1C] border border-[#2E2E2E] rounded-[6px] shadow-2xl pointer-events-none select-none"
              >
                Run automation with configured trigger data
                <Tooltip.Arrow className="fill-[#1C1C1C]" />
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>

          {/* Show / Hide Execution Panel (VS Code Terminal style) */}
          <Tooltip.Root delayDuration={150}>
            <Tooltip.Trigger asChild>
              <button
                type="button"
                onClick={() => {
                  setIsPanelVisible((prev) => {
                    const next = !prev;
                    if (next) {
                      fetchLatestRun();
                    }
                    return next;
                  });
                }}
                className={`p-1.5 px-2 rounded-[8px] transition-all flex items-center gap-1.5 text-xs font-medium cursor-pointer ${
                  isPanelVisible
                    ? 'bg-[#222222] text-[#FF7306] border border-[#333333] shadow-sm'
                    : 'text-text-muted hover:text-text-primary hover:bg-[#1A1A1A] border border-transparent'
                }`}
                aria-label={isPanelVisible ? 'Hide Execution Panel (⌥T)' : 'Show Execution Panel (⌥T)'}
              >
                <Terminal className="w-3.5 h-3.5" />
                <span className="text-[11px] font-sans hidden sm:inline">Logs</span>
              </button>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content
                side="bottom"
                sideOffset={8}
                className="z-50 px-2 py-1 text-xs font-medium text-text-primary bg-[#1C1C1C] border border-[#2E2E2E] rounded-[6px] shadow-2xl pointer-events-none select-none"
              >
                {isPanelVisible ? 'Hide Execution Panel (⌥T)' : 'Show Execution Panel (⌥T)'}
                <Tooltip.Arrow className="fill-[#1C1C1C]" />
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>

          {/* Publish / Published Control */}
          <Tooltip.Root delayDuration={200}>
            <Tooltip.Trigger asChild>
              <button
                type="button"
                onClick={handleToggleActive}
                disabled={isActivating || saveStatus === 'saving'}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all active:scale-[0.98] disabled:opacity-40 ${
                  isActive
                    ? 'bg-[#181818] hover:bg-[#202020] border border-[#2A2A2A] hover:border-[#383838] text-text-primary'
                    : 'bg-white hover:bg-[#F2F2F2] text-black font-semibold shadow-sm'
                }`}
              >
                {isActivating ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : isActive ? (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-black/40" />
                )}
                <span>{isActive ? 'Published' : 'Publish'}</span>
              </button>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content
                side="bottom"
                sideOffset={8}
                className="z-50 px-2 py-1 text-xs font-medium text-text-primary bg-[#1C1C1C] border border-[#2E2E2E] rounded-[6px] shadow-2xl pointer-events-none select-none"
              >
                {isActive
                  ? 'Active: listening for triggers. Click to unpublish.'
                  : 'Publish to enable automated trigger execution'}
                <Tooltip.Arrow className="fill-[#1C1C1C]" />
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>

          {/* Overflow Menu */}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                type="button"
                className="p-1.5 rounded-[8px] text-text-muted hover:text-text-primary hover:bg-[#1A1A1A] transition-colors"
                title="More options"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                className="z-50 min-w-[200px] bg-[#1A1A1A] border border-[#2E2E2E] rounded-[16px] p-1.5 shadow-2xl space-y-1 animate-in fade-in zoom-in-95 duration-150 text-xs"
                sideOffset={8}
                align="end"
              >
                <DropdownMenu.Item
                  onClick={onOpenHistory}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-text-secondary hover:text-text-primary hover:bg-[#262626] cursor-pointer outline-none transition-colors"
                >
                  <History className="w-4 h-4 text-text-muted" />
                  <span>Execution Runs</span>
                </DropdownMenu.Item>

                <div className="p-2 border-t border-[#262626] flex items-center justify-between">
                  <span className="text-text-muted">Theme</span>
                  <ThemeSelector />
                </div>

                {onDeleteWorkflow && (
                  <DropdownMenu.Item
                    onClick={onDeleteWorkflow}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-danger hover:bg-danger/10 cursor-pointer outline-none transition-colors border-t border-[#262626]"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete Automation</span>
                  </DropdownMenu.Item>
                )}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </header>

      {/* Main Studio Area */}
      <div className="flex-1 flex flex-row overflow-hidden relative min-h-0 min-w-0">
        {/* Step Palette (overlay on left so canvas is never resized or squished) */}
        {isPaletteOpen && (
          <div className="absolute left-0 top-0 bottom-0 z-30 shadow-2xl flex flex-col pointer-events-auto">
            <NodePalette
              title={autoConnectSourceId ? 'Add Next Action' : 'Step Library'}
              nodeTypes={nodeTypesMeta}
              onAddNode={(type) => {
                addNodeByType(type, undefined, true);
              }}
              onClose={() => {
                setIsPaletteOpen(false);
                setAutoConnectSourceId(null);
              }}
            />
          </div>
        )}

        {/* Center Workspace (Canvas on top + Docked Bottom Execution Panel) */}
        <div className="flex-1 flex flex-col h-full overflow-hidden relative min-w-0 min-h-0">
          {/* React Flow Canvas: flex-1 */}
          <div className={`flex-1 h-full relative overflow-hidden min-h-0 ${isConnecting ? 'is-connecting' : ''}`} ref={reactFlowWrapper}>
          <ReactFlow<CanvasNode, CanvasEdge>
            nodes={displayNodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onReconnect={onReconnect}
            onConnectStart={() => setIsConnecting(true)}
            onConnectEnd={() => setIsConnecting(false)}
            onNodeClick={onNodeClick}
            onNodeDragStart={() => pushHistory(nodes, edges)}
            onPaneClick={onPaneClick}
            onInit={(instance) => {
              setReactFlowInstance(instance);
              instance.fitView({ maxZoom: 1, padding: 0.25 });
              setTimeout(() => {
                instance.fitView({ maxZoom: 1, padding: 0.25, duration: 150 });
              }, 220);
            }}
            onDragOver={onDragOver}
            onDrop={onDrop}
            onMoveEnd={onMoveEnd}
            fitView
            fitViewOptions={{
              maxZoom: 1,
              minZoom: 0.2,
              padding: 0.25,
            }}
            minZoom={0.2}
            maxZoom={2.5}
            snapToGrid={false}
            connectionMode={ConnectionMode.Loose}
            connectionLineType={ConnectionLineType.Bezier}
            connectionLineStyle={{ stroke: '#FFFFFF', strokeWidth: 2 }}
            isValidConnection={isValidConnection}
            panOnScroll={true}
            panOnScrollMode={PanOnScrollMode.Free}
            panOnScrollSpeed={1.2}
            zoomOnPinch={true}
            zoomOnScroll={false}
            panActivationKeyCode="Space"
            panOnDrag={interactionMode === 'pan' ? true : [1, 2]}
            selectionOnDrag={interactionMode === 'select'}
            selectionMode={SelectionMode.Partial}
            selectNodesOnDrag={false}
            defaultEdgeOptions={{ type: 'workflowEdge', animated: false }}
            colorMode={theme === 'dark' ? 'dark' : theme === 'light' ? 'light' : 'system'}
            proOptions={{ hideAttribution: true }}
            className="bg-[#0F0F0F]"
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={20}
              size={1.5}
              color="var(--color-grid-dots)"
            />

            {/* Bottom-Right MiniMap (matches reference screenshot) */}
            <MiniMap
              nodeColor={() => '#333333'}
              nodeStrokeColor="#222222"
              nodeStrokeWidth={1}
              nodeBorderRadius={4}
              maskColor={theme === 'light' ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.75)'}
              className="!bg-[#141414]/90 !backdrop-blur-md !border !border-[#262626] !rounded-[18px] !shadow-2xl overflow-hidden"
              style={{ width: 140, height: 90 }}
            />
          </ReactFlow>

          {/* First-Time Blank Canvas Guidance */}
          {isInitialCanvas && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 pointer-events-none transition-all duration-300">
              <div className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-surface-elevated/95 backdrop-blur-md border border-border shadow-xl text-text-secondary text-xs font-medium">
                <div className="w-2 h-2 rounded-full bg-[#FF7306] animate-pulse shrink-0" />
                <span>Your automation starts here. Add an action to decide what happens next.</span>
              </div>
            </div>
          )}

          {/* Floating Left Canvas Tools Dock (matches reference screenshot) */}
          <div className="absolute left-6 top-6 z-10 flex flex-col gap-1.5 p-1.5 rounded-[18px] bg-[#161616]/90 backdrop-blur-md border border-[#262626] shadow-2xl">
            <button
              type="button"
              onClick={() => {
                if (!isPaletteOpen) {
                  setSelectedNodeId(null);
                  setAutoConnectSourceId(null);
                  setIsPaletteOpen(true);
                } else {
                  setIsPaletteOpen(false);
                  setAutoConnectSourceId(null);
                }
              }}
              className={`w-8 h-8 rounded-[12px] flex items-center justify-center transition-all ${
                isPaletteOpen
                  ? 'bg-white text-black font-bold shadow-sm'
                  : 'text-text-muted hover:text-text-primary hover:bg-[#242424]'
              }`}
              title="Add automation step"
            >
              <Plus className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setInteractionMode('select')}
              className={`w-8 h-8 rounded-[12px] flex items-center justify-center transition-all ${
                interactionMode === 'select'
                  ? 'bg-[#262626] text-white shadow-sm'
                  : 'text-text-muted hover:text-text-primary hover:bg-[#242424]'
              }`}
              title="Select / pointer tool"
            >
              <MousePointer className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setInteractionMode('pan')}
              className={`w-8 h-8 rounded-[12px] flex items-center justify-center transition-all ${
                interactionMode === 'pan'
                  ? 'bg-[#262626] text-white shadow-sm'
                  : 'text-text-muted hover:text-text-primary hover:bg-[#242424]'
              }`}
              title="Pan canvas tool"
            >
              <Hand className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleFitView}
              className="w-8 h-8 rounded-[12px] flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-[#242424] transition-all"
              title="Fit to view"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Floating Bottom-Left Zoom Toolbar (matches reference screenshot) */}
          <div className="absolute bottom-6 left-6 z-10 flex items-center gap-1 px-2.5 py-1.5 rounded-[18px] bg-[#161616]/90 backdrop-blur-md border border-[#262626] shadow-2xl text-xs text-text-muted">
            <button
              type="button"
              className="p-1 rounded-[8px] hover:text-text-primary hover:bg-[#242424] transition-colors"
              title="Canvas layers"
            >
              <Layers className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => reactFlowInstance?.zoomTo(1, { duration: 200 })}
              className="font-mono text-[11px] px-2 py-0.5 text-text-secondary hover:text-text-primary hover:bg-[#242424] rounded-[6px] transition-colors select-none"
              title="Click to reset to 100%"
            >
              {zoomLevel}%
            </button>

            <button
              type="button"
              onClick={() => reactFlowInstance?.zoomOut()}
              className="p-1 rounded-[8px] hover:text-text-primary hover:bg-[#242424] transition-colors"
              title="Zoom out"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => reactFlowInstance?.zoomIn()}
              className="p-1 rounded-[8px] hover:text-text-primary hover:bg-[#242424] transition-colors"
              title="Zoom in"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>

            <div className="w-[1px] h-3 bg-[#2E2E2E] mx-1" />

            <button
              type="button"
              onClick={handleFitView}
              className="p-1 rounded-[8px] hover:text-text-primary hover:bg-[#242424] transition-colors"
              title="Fit to view"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Empty State Overlay */}
          {nodes.length === 0 && (
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-6 text-center select-none">
              <div className="max-w-md p-8 rounded-[28px] bg-[#161616]/95 backdrop-blur-md border border-[#262626] shadow-modal flex flex-col items-center space-y-4 pointer-events-auto animate-in fade-in zoom-in-95 duration-200">
                <div className="w-14 h-14 rounded-[20px] bg-[#222222] border border-[#2D2D2D] text-trigger flex items-center justify-center shadow-subtle">
                  <Plus className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-text-primary">
                    Build your automation step by step
                  </h3>
                  <p className="text-xs text-text-muted leading-relaxed font-sans max-w-sm">
                    Open the step catalog with + on the toolbar, or add a starting block below.
                  </p>
                </div>
                <div className="flex gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedNodeId(null);
                      setIsPaletteOpen(true);
                    }}
                    className="px-5 py-2.5 rounded-full bg-white hover:bg-[#EAEAEA] text-black text-xs font-semibold transition-all shadow-md flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Starting Step</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

          {/* Bottom: Docked Resizable Execution Panel */}
          {isPanelVisible && (
            <ExecutionPanel
              run={currentRun}
              nodeRuns={nodeRuns}
              height={panelHeight}
              onHeightChange={setPanelHeight}
              onClose={() => setIsPanelVisible(false)}
              onReRun={handleRunWorkflow}
              onRefresh={fetchLatestRun}
              onCancel={handleCancelRun}
              isRunning={isRunning}
            />
          )}
        </div>

        {/* Right: Step Inspector Panel (NodeConfigPanel) */}
        {selectedNode && (
          <div
            className="relative z-20 shadow-2xl flex flex-col pointer-events-auto h-full shrink-0"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <NodeConfigPanel
              node={selectedNode}
              allNodes={nodes}
              edges={edges}
              nodeRuns={nodeRuns}
              meta={selectedNodeMeta}
              workflowId={workflow.id}
              workflowActive={isActive}
              onUpdate={handleUpdateNode}
              onDelete={handleDeleteNode}
              onClose={() => {
                setSelectedNodeId(null);
                if (isDirty) performSave();
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
