"use client";
import { useEffect, useState } from "react";
import axios from "axios";

interface Node {
  id: string;
  meta: {
    name: string;
  };
  overlay: string;
  status: string;
  vncDisplay?: number;
  guacamoleUrl?: string;
}

export default function Home() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState("");

  const BASE_URL = "http://localhost:3000";

  const refreshNodes = async () => {
    const res = await axios.get(`${BASE_URL}/nodes`);
    setNodes(res.data);
  };

  useEffect(() => {
    refreshNodes();
  }, []);

  const handleAction = async (
    nodeId: string,
    action: "run" | "stop" | "wipe",
  ) => {
    setLoading(true);
    await axios.post(`${BASE_URL}/nodes/${nodeId}/${action}`);
    await refreshNodes();
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!newName) return;

    setLoading(true);
    await axios.post(`${BASE_URL}/nodes`, { name: newName });
    setNewName("");
    await refreshNodes();
    setLoading(false);
  };

  return (
    <div className="p-6 bg-gray-100 text-black min-h-screen">
      <h1 className="text-3xl font-bold mb-6">QEMU Lab Nodes</h1>

      <div className="mb-6 flex gap-2">
        <input
          type="text"
          placeholder="Node name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="px-3 py-2 border rounded flex-1"
        />
        <button
          onClick={handleCreate}
          disabled={loading || !newName}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
        >
          Create Node
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {nodes.map((node) => (
          <div key={node.id} className="bg-white p-4 rounded shadow">
            <p className="font-semibold">ID: {node.id}</p>
            <p>Name: {node.meta.name}</p>
            <p>
              Status:{" "}
              <span
                className={
                  node.status === "Running" ? "text-green-600" : "text-red-600"
                }
              >
                {node.status}
              </span>
            </p>
            {node.vncDisplay != null && <p>VNC Display: {node.vncDisplay}</p>}

            <div className="mt-4 flex gap-2 flex-wrap">
              {node.guacamoleUrl && node.status === "Running" && (
                <a
                  href={`http://localhost:8080${node.guacamoleUrl}`}
                  target="_blank"
                  className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Connect
                </a>
              )}

              <button
                onClick={() => handleAction(node.id, "run")}
                disabled={loading || node.status === "Running"}
                className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
              >
                Start
              </button>

              <button
                onClick={() => handleAction(node.id, "stop")}
                disabled={loading || node.status === "Stopped" || node.status === "Wiped"}
                className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
              >
                Stop
              </button>

              <button
                onClick={() => handleAction(node.id, "wipe")}
                disabled={loading}
                className="px-3 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600 disabled:opacity-50"
              >
                Wipe
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

