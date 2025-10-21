import express from "express";
import { spawn, exec } from "child_process";
import { randomUUID } from "crypto";
import fs from "fs";
import mysql from "mysql2/promise";
import cors from "cors";

import { type Node, type NodeMetadata } from "./types";

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

const DATA_FILE = "/app/data/nodes.json";
const OVERLAY_PATH = "/app/overlays";
const IMAGE_PATH = "/app/images/base.qcow2";

const NODES: Node[] = fs.existsSync(DATA_FILE)
  ? JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"))
  : [];

function saveNodes() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(NODES, null, 2));
}

const QEMU_PROCESSES: Record<string, ReturnType<typeof spawn>> = {};

function pickVncDisplay(nodes: Node[]) {
  const used = new Set(nodes.map(n => n.vncDisplay));
  for (let i = 0; i < 100; i++) if (!used.has(i)) return i;
  throw new Error("No VNC displays free");
}

const dbConfig = {
  host: "mysql",
  user: "guacuser",
  password: "guacpass",
  database: "guacdb",
};

function createOverlay(nodeId: string) {
  return new Promise<void>((resolve, reject) => {
    const cmd = `qemu-img create -f qcow2 -F qcow2 -b ${IMAGE_PATH} ${OVERLAY_PATH}/node_${nodeId}.qcow2`;
    exec(cmd, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

function startQemu(nodeId: string, offset: number, ram = 2048) {
  return new Promise<ReturnType<typeof spawn>>((resolve, reject) => {
    const qemu = spawn("qemu-system-x86_64", [
      "-name", `Qemu Node ${nodeId}`,
      "-monitor", `unix:/tmp/qemu-${nodeId}.monitor,server,nowait`,
      "-m", ram.toString(),
      "-hda", `${OVERLAY_PATH}/node_${nodeId}.qcow2`,
      "-vnc", `0.0.0.0:${offset}`,
      "-netdev", `user,id=net0,hostfwd=tcp::${2221 + offset}-:22`,
      "-device", "e1000,netdev=net0",
    ]);

    qemu.on("error", reject);
    qemu.on("spawn", () => resolve(qemu));
  });
}

function stopQemu(nodeId: string) {
  const proc = QEMU_PROCESSES[nodeId];
  if (proc) {
    proc.kill("SIGTERM");
    delete QEMU_PROCESSES[nodeId];
  }
}

app.post("/nodes", async (req, res) => {
  try {
    const id = randomUUID();
    const meta: NodeMetadata = req.body;

    await createOverlay(id);

    const node: Node = {
      id,
      overlay: `${OVERLAY_PATH}/node_${id}.qcow2`,
      status: "Stopped",
      vncDisplay: undefined,
      meta,
    };

    NODES.push(node);
    saveNodes();

    res.json(node);
  } catch (err: any) {
    console.error(err);
    res.status(500).send(err.message);
  }
});

app.post("/nodes/:id/run", async (req, res) => {
  const node = NODES.find(n => n.id === req.params.id);
  if (!node) return res.status(404).send("Node not found");

  try {
    const offset = node.vncDisplay ?? pickVncDisplay(NODES);
    const qemuProc = await startQemu(node.id, offset);

    QEMU_PROCESSES[node.id] = qemuProc;
    node.vncDisplay = offset;
    node.status = "Running";

    const conn = await mysql.createConnection(dbConfig);

    if (!node.guacConnectionId) {
      const [result] = await conn.execute(
        "INSERT INTO guacamole_connection (connection_name, protocol) VALUES (?, ?)",
        [`Node-${node.id}`, "vnc"]
      );

      const connectionId = (result as any).insertId;

      await conn.execute(
        `INSERT INTO guacamole_connection_parameter (connection_id, parameter_name, parameter_value)
         VALUES 
         (?, 'hostname', 'backend'),
         (?, 'port', ?)`,
        [connectionId, connectionId, (5900 + offset).toString()]
      );

      node.guacConnectionId = connectionId;
    } else {
      await conn.execute(
        `UPDATE guacamole_connection_parameter 
         SET parameter_value = ?
         WHERE connection_id = ? AND parameter_name = 'port'`,
        [(5900 + offset).toString(), node.guacConnectionId]
      );
    }

    await conn.end();
    saveNodes();

    res.json({ ...node, guacamoleUrl: `/guacamole/#/client/${node.guacConnectionId}` });
  } catch (err: any) {
    console.error(err);
    res.status(500).send("Error in Guacamole");
  }
});

app.post("/nodes/:id/stop", (req, res) => {
  const node = NODES.find(n => n.id === req.params.id);
  if (!node) return res.status(404).send("Node not found");

  stopQemu(node.id);
  node.status = "Stopped";
  node.vncDisplay = undefined;
  saveNodes();
  res.json(node);
});

app.post("/nodes/:id/wipe", async (req, res) => {
  const node = NODES.find(n => n.id === req.params.id);
  if (!node) return res.status(404).send("Node not found");

  stopQemu(node.id);

  try {
    await createOverlay(node.id);
    node.status = "Wiped";
    node.vncDisplay = undefined;
    saveNodes();
    res.json(node);
  } catch (err: any) {
    console.error(err);
    res.status(500).send(err.message);
  }
});

app.get("/nodes", (_, res) => {
  res.json(
    NODES.map((n) => ({
      ...n,
      guacamoleUrl: n.guacConnectionId != null ? `/guacamole/#/client/${n.guacConnectionId}` : null,
    }))
  );
});

app.listen(3000, () => console.log("Backend running on :3000"));

