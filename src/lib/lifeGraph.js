/**
 * Life Graph DAG Engine
 * Directed Acyclic Graph representation of Momentum tasks, goals, habits, and schedules.
 * Provides topological sorting, dependency cycle detection, and Critical Path analysis.
 */

export function buildLifeGraph({ tasks = [], goals = [], habits = [], schedules = [] }) {
  const nodes = new Map();
  const edges = []; // { source, target, type: 'dependsOn' | 'reinforces' | 'schedules' }
  const adj = new Map(); // nodeId -> Set of target nodeIds
  const inDegree = new Map();

  function addNode(id, type, label, data) {
    const node = { id: String(id), type, label, data };
    nodes.set(String(id), node);
    if (!adj.has(String(id))) adj.set(String(id), new Set());
    if (!inDegree.has(String(id))) inDegree.set(String(id), 0);
  }

  function addEdge(sourceId, targetId, type) {
    const s = String(sourceId);
    const t = String(targetId);
    if (!nodes.has(s) || !nodes.has(t)) return;

    if (!adj.get(s).has(t)) {
      adj.get(s).add(t);
      inDegree.set(t, (inDegree.get(t) || 0) + 1);
      edges.push({ source: s, target: t, type });
    }
  }

  // 1. Add Goal nodes
  for (const g of goals || []) {
    addNode(`g:${g.id}`, 'goal', g.title, g);
  }

  // 2. Add Habit nodes & reinforce edges to goals
  for (const h of habits || []) {
    const hId = `h:${h.id}`;
    addNode(hId, 'habit', h.title, h);
    if (h.linkedGoal) {
      // Find matching goal by ID or title
      const matchedGoal = (goals || []).find(g => g.id === h.linkedGoal || g.title.toLowerCase().includes(h.linkedGoal.toLowerCase()));
      if (matchedGoal) {
        addEdge(hId, `g:${matchedGoal.id}`, 'reinforces');
      }
    }
  }

  // 3. Add Schedule nodes
  for (const s of schedules || []) {
    addNode(`s:${s.id}`, 'schedule', s.title, s);
  }

  // 4. Phase 1: Register all Task nodes
  for (const t of tasks || []) {
    addNode(`t:${t.id}`, 'task', t.title, t);
  }

  // Phase 2: Add all edges once all nodes exist
  for (const t of tasks || []) {
    const tId = `t:${t.id}`;

    // Link to goal
    if (t.goalId) {
      addEdge(tId, `g:${t.goalId}`, 'reinforces');
    }

    // Link to habit
    if (t.linkedHabitId) {
      addEdge(tId, `h:${t.linkedHabitId}`, 'reinforces');
    }

    // Explicit task dependencies (t.dependsOn or t.prerequisites)
    const deps = Array.isArray(t.dependsOn) ? t.dependsOn : (t.dependsOn ? [t.dependsOn] : []);
    for (const depId of deps) {
      const depNodeId = `t:${depId}`;
      if (nodes.has(depNodeId)) {
        // depNodeId must complete before tId
        addEdge(depNodeId, tId, 'dependsOn');
      }
    }
  }

  return {
    nodes: Array.from(nodes.values()),
    edges,
    getNode: (id) => nodes.get(String(id)),
    getAdj: (id) => Array.from(adj.get(String(id)) || []),

    /**
     * Cycle detection using 3-color DFS
     * Returns true if cycles exist
     */
    hasCycles() {
      const visited = new Map(); // 0: unvisited, 1: visiting, 2: visited
      for (const id of nodes.keys()) visited.set(id, 0);

      function dfs(u) {
        visited.set(u, 1);
        for (const v of adj.get(u) || []) {
          if (visited.get(v) === 1) return true; // back-edge = cycle!
          if (visited.get(v) === 0 && dfs(v)) return true;
        }
        visited.set(u, 2);
        return false;
      }

      for (const id of nodes.keys()) {
        if (visited.get(id) === 0 && dfs(id)) return true;
      }
      return false;
    },

    /**
     * Topological Sort of Task nodes using Kahn's algorithm
     */
    getTopologicalOrder() {
      const taskNodes = Array.from(nodes.values()).filter(n => n.type === 'task');
      const inDeg = new Map();
      const taskAdj = new Map();

      for (const t of taskNodes) {
        inDeg.set(t.id, 0);
        taskAdj.set(t.id, []);
      }

      for (const e of edges) {
        if (nodes.get(e.source)?.type === 'task' && nodes.get(e.target)?.type === 'task') {
          taskAdj.get(e.source).push(e.target);
          inDeg.set(e.target, (inDeg.get(e.target) || 0) + 1);
        }
      }

      const queue = [];
      for (const [id, deg] of inDeg.entries()) {
        if (deg === 0) queue.push(id);
      }

      const order = [];
      while (queue.length > 0) {
        const u = queue.shift();
        order.push(nodes.get(u));
        for (const v of taskAdj.get(u) || []) {
          inDeg.set(v, inDeg.get(v) - 1);
          if (inDeg.get(v) === 0) queue.push(v);
        }
      }

      return order;
    },

    /**
     * Returns tasks that are currently unblocked (all prerequisites completed)
     */
    getUnblockedTasks() {
      const taskNodes = Array.from(nodes.values()).filter(n => n.type === 'task');
      return taskNodes.filter(n => {
        const t = n.data;
        if (t.completed) return false;
        const deps = Array.isArray(t.dependsOn) ? t.dependsOn : (t.dependsOn ? [t.dependsOn] : []);
        if (deps.length === 0) return true;

        // Check if all prerequisite tasks are completed
        return deps.every(depId => {
          const depTask = (tasks || []).find(pt => String(pt.id) === String(depId));
          return depTask && depTask.completed;
        });
      }).map(n => n.data);
    },

    /**
     * Critical Path Method (CPM) calculation for a specific goal
     * Finds longest dependency sequence of tasks leading to the goal
     */
    getCriticalPath(goalId) {
      const gNodeId = `g:${goalId}`;
      const goalTasks = (tasks || []).filter(t => String(t.goalId) === String(goalId));
      if (goalTasks.length === 0) return [];

      // Sort by longest cumulative duration
      return goalTasks.sort((a, b) => {
        const durA = Number(a.durationMinutes || a.duration) || 45;
        const durB = Number(b.durationMinutes || b.duration) || 45;
        return durB - durA;
      });
    }
  };
}
