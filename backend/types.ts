export type NodeMetadata = {
  name: string;
}

export type Node = {
  id: string;
  meta: NodeMetadata;
  overlay: string;
  status: "Running" | "Stopped" | "Wiped";
  pid?: string;
  vncDisplay?: number;
  guacConnectionId?: number;
};

