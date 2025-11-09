import express from "express";
import { spawn, exec } from "child_process";
import { randomUUID } from "crypto";
import fs from "fs";
import mysql from "mysql2/promise";
import cors from "cors";
import {$} from 'bun';

import { type Node, type NodeMetadata } from "./types";
import { type } from "os";

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

const DATA_FILE = "/app/data/nodes.json";
const OVERLAY_PATH = "/app/overlays";
const IMAGE_PATH = "/app/images/base.qcow2";
const getImagePath = (type:string) => `/app/images/${type}.qcow2`;

const NODES: Node[] = fs.existsSync(DATA_FILE)
  ? JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"))
  : [];

const TAPS: Record<string, string[]> = {};
const BRIDGES: Set<string>[] = [];

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

export async function ensureTap(tapId: string) {
  try {
    const check = await $`ip link show ${tapId}`.quiet();
    if (check.exitCode === 0) {
      console.log(`TAP ${tapId} already exists`);
      return;
    }
  } catch {}

   
  console.log(`Creating TAP ${tapId}`);
  await $`ip tuntap add dev ${tapId} mode tap user root`;

  await $`ip link set ${tapId} up`;

}

function createOverlay(nodeId: string, type: "base"|"router" = "base") {
  return new Promise<void>((resolve, reject) => {
    const cmd = `qemu-img create -f qcow2 -F qcow2 -b ${getImagePath(type)} ${OVERLAY_PATH}/node_${nodeId}.qcow2`;
    exec(cmd, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

async function startQemu(nodeId: string, offset: number, type: "base"|"router" = "base", ram = 2048) {

  const tapId = `tap_${nodeId.slice(0,5)}`
  if(type === "base") 
    await ensureTap(tapId);
  else {
    await ensureTap(tapId+'_1');
    await ensureTap(tapId+'_2');
    }
  const prm = new Promise<ReturnType<typeof spawn>>((resolve, reject) => {
    const cmd = [
      "-name", `Qemu Node ${nodeId}`,
      "-m", ram.toString(),
      "-monitor", `unix:/tmp/qemu-${nodeId}.monitor,server,nowait`,
      "-hda", `${OVERLAY_PATH}/node_${nodeId}.qcow2`,
      "-vnc", `0.0.0.0:${offset}`,
      "-machine", "pc,accel=kvm",
      "-enable-kvm",
      "-cpu", "host"
    ]
    if(!TAPS[nodeId]) TAPS[nodeId] = [];
    if(type === "base"){
      TAPS[nodeId]?.push(tapId);
      cmd.push("-device","e1000,netdev=net0")
      cmd.push("-netdev", `tap,id=net0,ifname=${tapId},script=no,downscript=no`)
    } else {
      TAPS[nodeId]?.push(`tap_${nodeId.slice(0,5)}_1`)
      TAPS[nodeId]?.push(`tap_${nodeId.slice(0,5)}_2`)
      cmd.push("-device","e1000,netdev=net0,mac=52:54:00:00:00:01")
      cmd.push("-netdev", `tap,id=net0,ifname=${tapId}_1,script=no,downscript=no`)
      cmd.push("-device","e1000,netdev=net1,mac=52:54:00:00:00:02")
      cmd.push("-netdev", `tap,id=net1,ifname=${tapId}_2,script=no,downscript=no`)
      cmd.push("-serial", `telnet:0.0.0.0:${5000 + offset},server,nowait`)
    }
    console.log(cmd);
    const qemu = spawn("qemu-system-x86_64", cmd, {stdio:"inherit"});

    qemu.on("error", reject);
    qemu.on("spawn", () => resolve(qemu));
  });

  return await prm;
}

function stopQemu(nodeId: string) {
  const proc = QEMU_PROCESSES[nodeId];
  if (proc) {
    proc.kill("SIGTERM");
    delete QEMU_PROCESSES[nodeId];
  }
}

app.post("/nodes/:type", async (req, res) => {
  try {
    const nodeType = req.params.type;
    const id = randomUUID().replace('-','');
    const meta: NodeMetadata = req.body;

    await createOverlay(id, nodeType as any);

    const node: Node = {
      id,
      type: nodeType as any,
      overlay: `${OVERLAY_PATH}/node_${id}.qcow2`,
      status: "Stopped",
      vncDisplay: undefined,
      meta,
    };

    NODES.push(node);
    TAPS[node.id] = [];
    saveNodes();

    res.json(node);
  } catch (err: any) {
    console.error(err);
    res.status(500).send(err.message);
  }
});

app.get("/taps", async (req, res) => {
  res.json(TAPS);
})

app.post("/taps/:id/bridge/:with", async (req, res) => {
  const t1 = req.params.id;
  const t2 = req.params.with;
  if (!t1 || !t2) return res.status(404).send("Node not found");

  const bri = BRIDGES.length+1;

  await $`ip link add name br${bri} type bridge`;
  await $`ip link set br${bri} up`;
  await $`ip link set ${t1} master br${bri}`;
  await $`ip link set ${t2} master br${bri}`;
  BRIDGES.push(new Set([t1, t2]))
  res.sendStatus(200);
})

app.post("/nodes/:id/run", async (req, res) => {
  const node = NODES.find(n => n.id === req.params.id);
  if (!node) return res.status(404).send("Node not found");

  try {
    const base = node.type === "base" ? 5900 : 5000;
    const offset = node.vncDisplay ?? pickVncDisplay(NODES);
    const qemuProc = await startQemu(node.id, offset, node.type);

    QEMU_PROCESSES[node.id] = qemuProc;
    node.vncDisplay = offset;
    node.status = "Running";

    const conn = await mysql.createConnection(dbConfig);

    if (!node.guacConnectionId) {
      const [result] = await conn.execute(
        "INSERT INTO guacamole_connection (connection_name, protocol) VALUES (?, ?)",
        [`Node-${node.id}`, node.type === "base"?"vnc":"telnet"]
      );

      const connectionId = (result as any).insertId;

      await conn.execute(
        `INSERT INTO guacamole_connection_parameter (connection_id, parameter_name, parameter_value)
         VALUES 
         (?, 'hostname', 'backend'),
         (?, 'port', ?)`,
        [connectionId, connectionId, (base + offset).toString()]
      );

      node.guacConnectionId = connectionId;
    } else {
      await conn.execute(
        `UPDATE guacamole_connection_parameter 
         SET parameter_value = ?
         WHERE connection_id = ? AND parameter_name = 'port'`,
        [(base + offset).toString(), node.guacConnectionId]
      );
    }

    await conn.end();
    saveNodes();

    res.json({ ...node, guacamoleUrl: `/guacamole/#/client/${node.guacConnectionId}` });
  } catch (err: any) {
    console.error(err);
    res.status(500).send(err);
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

app.listen(3000, async () => {
console.log("Backend running on :3000")
});
