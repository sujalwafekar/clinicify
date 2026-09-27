import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";

export class LocalTimestamp {
  readonly seconds: number;
  readonly nanoseconds: number;

  constructor(ms: number = Date.now()) {
    this.seconds = Math.floor(ms / 1000);
    this.nanoseconds = (ms % 1000) * 1_000_000;
  }

  toMillis(): number {
    return this.seconds * 1000 + Math.floor(this.nanoseconds / 1_000_000);
  }

  toDate(): Date {
    return new Date(this.toMillis());
  }

  toJSON(): { _type: "timestamp"; ms: number } {
    return { _type: "timestamp", ms: this.toMillis() };
  }
}

function reviveValues(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "object") {
    if (obj._type === "timestamp" && typeof obj.ms === "number") {
      return new LocalTimestamp(obj.ms);
    }
    if (Array.isArray(obj)) {
      return obj.map(reviveValues);
    }
    const res: any = {};
    for (const key of Object.keys(obj)) {
      res[key] = reviveValues(obj[key]);
    }
    return res;
  }
  return obj;
}

function sanitizeForStorage(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "object") {
    if ("toMillis" in obj && typeof obj.toMillis === "function") {
      return { _type: "timestamp", ms: obj.toMillis() };
    }
    if (obj instanceof Date) {
      return { _type: "timestamp", ms: obj.getTime() };
    }
    // Handle FieldValue.serverTimestamp()
    if (obj._methodName === "serverTimestamp" || obj.constructor?.name === "ServerTimestampTransform") {
      return { _type: "timestamp", ms: Date.now() };
    }
    if (Array.isArray(obj)) {
      return obj.map(sanitizeForStorage);
    }
    const res: any = {};
    for (const key of Object.keys(obj)) {
      // Handle FieldValue.serverTimestamp
      const val = obj[key];
      if (val && typeof val === "object" && (val._methodName === "serverTimestamp" || val.constructor?.name === "ServerTimestampTransform")) {
        res[key] = { _type: "timestamp", ms: Date.now() };
      } else {
        res[key] = sanitizeForStorage(val);
      }
    }
    return res;
  }
  return obj;
}

interface LocalDBData {
  doctors: any[];
  medicines: any[];
  rooms: any[];
  visits: any[];
  patients: any[];
  queueEvents: any[];
  prescriptions: any[];
  pharmacyOrders: any[];
  queues: any[];
  staffRequests: any[];
  loginRequests: any[];
  notifications: any[];
  users: any[];
  [key: string]: any[];
}

const DEFAULT_DOCTORS = [
  {
    id: "d-mehta",
    name: "Dr. Ananya Mehta",
    department: "General Medicine",
    departmentId: "general-medicine",
    room: "Room 3",
    status: "available",
    averageDuration: 9,
    hospitalId: "H1",
    currentVisitId: null,
  },
  {
    id: "d-iyer",
    name: "Dr. Rohan Iyer",
    department: "Cardiology",
    departmentId: "cardiology",
    room: "Room 4",
    status: "available",
    averageDuration: 8,
    hospitalId: "H1",
    currentVisitId: null,
  },
];

const DEFAULT_ROOMS = [
  {
    id: "d-mehta",
    doctorId: "d-mehta",
    doctorName: "Dr. Ananya Mehta",
    department: "General Medicine",
    room: "Room 3",
    status: "joined",
    patientsCount: 0,
    todayVisits: 0,
  },
  {
    id: "d-iyer",
    doctorId: "d-iyer",
    doctorName: "Dr. Rohan Iyer",
    department: "Cardiology",
    room: "Room 4",
    status: "joined",
    patientsCount: 0,
    todayVisits: 0,
  },
];

const DEFAULT_MEDICINES = [
  { id: "m-paracetamol", name: "Paracetamol 500mg", unit: "tablet", unitPrice: 1.2, stockQuantity: 100, lowStockThreshold: 10, stockStatus: "available", active: true },
  { id: "m-amoxicillin", name: "Amoxicillin 250mg", unit: "capsule", unitPrice: 4.5, stockQuantity: 100, lowStockThreshold: 10, stockStatus: "available", active: true },
  { id: "m-ibuprofen", name: "Ibuprofen 400mg", unit: "tablet", unitPrice: 2.1, stockQuantity: 100, lowStockThreshold: 10, stockStatus: "available", active: true },
  { id: "m-azithromycin", name: "Azithromycin 500mg", unit: "tablet", unitPrice: 14, stockQuantity: 100, lowStockThreshold: 10, stockStatus: "available", active: true },
  { id: "m-omeprazole", name: "Omeprazole 20mg", unit: "capsule", unitPrice: 3.8, stockQuantity: 100, lowStockThreshold: 10, stockStatus: "available", active: true },
  { id: "m-cetirizine", name: "Cetirizine 10mg", unit: "tablet", unitPrice: 1.4, stockQuantity: 100, lowStockThreshold: 10, stockStatus: "available", active: true },
  { id: "m-metformin", name: "Metformin 500mg", unit: "tablet", unitPrice: 1.7, stockQuantity: 100, lowStockThreshold: 10, stockStatus: "available", active: true },
  { id: "m-amlodipine", name: "Amlodipine 5mg", unit: "tablet", unitPrice: 2.5, stockQuantity: 100, lowStockThreshold: 10, stockStatus: "available", active: true },
  { id: "m-atorvastatin", name: "Atorvastatin 10mg", unit: "tablet", unitPrice: 4, stockQuantity: 100, lowStockThreshold: 10, stockStatus: "available", active: true },
  { id: "m-ors", name: "ORS Sachet", unit: "sachet", unitPrice: 12, stockQuantity: 100, lowStockThreshold: 10, stockStatus: "available", active: true },
];

class LocalFirestoreDB {
  private dbPath: string;
  private data: LocalDBData;

  constructor() {
    const dataDir = resolve(process.cwd(), ".data");
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }
    this.dbPath = resolve(dataDir, "clinicify-db.json");
    this.data = this.load();
  }

  private load(): LocalDBData {
    if (existsSync(this.dbPath)) {
      try {
        const raw = readFileSync(this.dbPath, "utf8");
        const parsed = JSON.parse(raw);
        return {
          doctors: parsed.doctors ?? DEFAULT_DOCTORS,
          medicines: parsed.medicines ?? DEFAULT_MEDICINES,
          rooms: parsed.rooms ?? DEFAULT_ROOMS,
          visits: parsed.visits ?? [],
          patients: parsed.patients ?? [],
          queueEvents: parsed.queueEvents ?? [],
          prescriptions: parsed.prescriptions ?? [],
          pharmacyOrders: parsed.pharmacyOrders ?? [],
          queues: parsed.queues ?? [],
          staffRequests: parsed.staffRequests ?? [],
          loginRequests: parsed.loginRequests ?? [],
          notifications: parsed.notifications ?? [],
          users: parsed.users ?? [],
          ...parsed,
        };
      } catch (e) {
        console.error("[LocalDB] Error reading JSON DB, initializing fresh:", e);
      }
    }
    const initial: LocalDBData = {
      doctors: DEFAULT_DOCTORS,
      medicines: DEFAULT_MEDICINES,
      rooms: DEFAULT_ROOMS,
      visits: [],
      patients: [],
      queueEvents: [],
      prescriptions: [],
      pharmacyOrders: [],
      queues: [],
      staffRequests: [],
      loginRequests: [],
      notifications: [],
      users: [],
    };
    this.saveDirect(initial);
    return initial;
  }

  private saveDirect(d: LocalDBData) {
    try {
      writeFileSync(this.dbPath, JSON.stringify(d, null, 2), "utf8");
    } catch (e) {
      console.error("[LocalDB] Error writing JSON DB:", e);
    }
  }

  public save() {
    this.saveDirect(this.data);
  }

  public getRawData(): LocalDBData {
    return this.data;
  }

  collection(collectionName: string) {
    return new LocalCollectionRef(this, collectionName);
  }

  batch() {
    return new LocalWriteBatch(this);
  }

  async runTransaction<T>(updateFunction: (transaction: LocalTransaction) => Promise<T>): Promise<T> {
    const tx = new LocalTransaction(this);
    const result = await updateFunction(tx);
    await tx.commit();
    return result;
  }
}

export class LocalDocumentSnapshot {
  constructor(
    public readonly id: string,
    private _data: any | undefined,
    public readonly ref: LocalDocumentRef
  ) {}

  get exists(): boolean {
    return this._data !== undefined && this._data !== null;
  }

  data(): any | undefined {
    if (!this.exists) return undefined;
    return reviveValues(JSON.parse(JSON.stringify(this._data)));
  }
}

export class LocalQuerySnapshot {
  constructor(public readonly docs: LocalDocumentSnapshot[]) {}

  get empty(): boolean {
    return this.docs.length === 0;
  }

  get size(): number {
    return this.docs.length;
  }

  forEach(callback: (doc: LocalDocumentSnapshot) => void): void {
    this.docs.forEach(callback);
  }
}

export class LocalDocumentRef {
  constructor(
    public readonly db: LocalFirestoreDB,
    public readonly collectionName: string,
    public readonly id: string
  ) {}

  async get(): Promise<LocalDocumentSnapshot> {
    const col = this.db.getRawData()[this.collectionName] || [];
    const found = col.find((item: any) => item.id === this.id);
    return new LocalDocumentSnapshot(this.id, found, this);
  }

  async set(data: any, options?: { merge?: boolean }): Promise<void> {
    const raw = this.db.getRawData();
    if (!raw[this.collectionName]) raw[this.collectionName] = [];
    const col = raw[this.collectionName];
    const sanitized = sanitizeForStorage(data);
    const idx = col.findIndex((item: any) => item.id === this.id);

    if (idx >= 0) {
      if (options?.merge) {
        col[idx] = { ...col[idx], ...sanitized, id: this.id };
      } else {
        col[idx] = { ...sanitized, id: this.id };
      }
    } else {
      col.push({ ...sanitized, id: this.id });
    }
    this.db.save();
  }

  async update(data: any): Promise<void> {
    const raw = this.db.getRawData();
    if (!raw[this.collectionName]) raw[this.collectionName] = [];
    const col = raw[this.collectionName];
    const idx = col.findIndex((item: any) => item.id === this.id);
    if (idx < 0) {
      throw new Error(`Document ${this.collectionName}/${this.id} not found for update`);
    }
    const sanitized = sanitizeForStorage(data);
    col[idx] = { ...col[idx], ...sanitized };
    this.db.save();
  }

  async delete(): Promise<void> {
    const raw = this.db.getRawData();
    if (!raw[this.collectionName]) return;
    raw[this.collectionName] = raw[this.collectionName].filter((item: any) => item.id !== this.id);
    this.db.save();
  }
}

export class LocalQuery {
  protected filters: Array<{ field: string; op: string; value: any }> = [];
  protected sortFields: Array<{ field: string; dir: "asc" | "desc" }> = [];
  protected limitCount?: number;

  constructor(
    public readonly db: LocalFirestoreDB,
    public readonly collectionName: string
  ) {}

  where(field: string, op: string, value: any): LocalQuery {
    const q = new LocalQuery(this.db, this.collectionName);
    q.filters = [...this.filters, { field, op, value }];
    q.sortFields = [...this.sortFields];
    q.limitCount = this.limitCount;
    return q;
  }

  orderBy(field: string, dir: "asc" | "desc" = "asc"): LocalQuery {
    const q = new LocalQuery(this.db, this.collectionName);
    q.filters = [...this.filters];
    q.sortFields = [...this.sortFields, { field, dir }];
    q.limitCount = this.limitCount;
    return q;
  }

  limit(count: number): LocalQuery {
    const q = new LocalQuery(this.db, this.collectionName);
    q.filters = [...this.filters];
    q.sortFields = [...this.sortFields];
    q.limitCount = count;
    return q;
  }

  async get(): Promise<LocalQuerySnapshot> {
    const raw = this.db.getRawData();
    let col = [...(raw[this.collectionName] || [])];

    // Apply filters
    for (const f of this.filters) {
      col = col.filter(item => {
        let v = item[f.field];
        if (v && typeof v === "object" && v._type === "timestamp") {
          v = v.ms;
        }
        let target = f.value;
        if (target && typeof target === "object" && typeof target.toMillis === "function") {
          target = target.toMillis();
        }

        switch (f.op) {
          case "==":
            return v === target;
          case "!=":
            return v !== target;
          case "<":
            return v < target;
          case "<=":
            return v <= target;
          case ">":
            return v > target;
          case ">=":
            return v >= target;
          case "in":
            return Array.isArray(target) && target.includes(v);
          case "array-contains":
            return Array.isArray(v) && v.includes(target);
          default:
            return true;
        }
      });
    }

    // Apply sort
    for (const s of this.sortFields) {
      col.sort((a, b) => {
        let va = a[s.field];
        let vb = b[s.field];
        if (va && typeof va === "object" && va._type === "timestamp") va = va.ms;
        if (vb && typeof vb === "object" && vb._type === "timestamp") vb = vb.ms;
        if (va === vb) return 0;
        if (va === undefined || va === null) return 1;
        if (vb === undefined || vb === null) return -1;
        return s.dir === "asc" ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
      });
    }

    // Apply limit
    if (typeof this.limitCount === "number" && this.limitCount >= 0) {
      col = col.slice(0, this.limitCount);
    }

    const docs = col.map(item => new LocalDocumentSnapshot(
      item.id,
      item,
      new LocalDocumentRef(this.db, this.collectionName, item.id)
    ));

    return new LocalQuerySnapshot(docs);
  }
}

export class LocalCollectionRef extends LocalQuery {
  doc(id?: string): LocalDocumentRef {
    const docId = id || randomUUID();
    return new LocalDocumentRef(this.db, this.collectionName, docId);
  }

  async add(data: any): Promise<LocalDocumentRef> {
    const docId = randomUUID();
    const ref = new LocalDocumentRef(this.db, this.collectionName, docId);
    await ref.set(data);
    return ref;
  }
}

export class LocalWriteBatch {
  private ops: Array<() => Promise<void>> = [];

  constructor(private db: LocalFirestoreDB) {}

  set(ref: LocalDocumentRef, data: any, options?: { merge?: boolean }): LocalWriteBatch {
    this.ops.push(async () => {
      await ref.set(data, options);
    });
    return this;
  }

  update(ref: LocalDocumentRef, data: any): LocalWriteBatch {
    this.ops.push(async () => {
      await ref.update(data);
    });
    return this;
  }

  delete(ref: LocalDocumentRef): LocalWriteBatch {
    this.ops.push(async () => {
      await ref.delete();
    });
    return this;
  }

  async commit(): Promise<void> {
    for (const op of this.ops) {
      await op();
    }
  }
}

export class LocalTransaction {
  private ops: Array<() => Promise<void>> = [];

  constructor(private db: LocalFirestoreDB) {}

  async get(ref: LocalDocumentRef): Promise<LocalDocumentSnapshot> {
    return ref.get();
  }

  set(ref: LocalDocumentRef, data: any, options?: { merge?: boolean }): LocalTransaction {
    this.ops.push(async () => {
      await ref.set(data, options);
    });
    return this;
  }

  update(ref: LocalDocumentRef, data: any): LocalTransaction {
    this.ops.push(async () => {
      await ref.update(data);
    });
    return this;
  }

  delete(ref: LocalDocumentRef): LocalTransaction {
    this.ops.push(async () => {
      await ref.delete();
    });
    return this;
  }

  async commit(): Promise<void> {
    for (const op of this.ops) {
      await op();
    }
  }
}

let localDbInstance: LocalFirestoreDB | null = null;
export function getLocalDb(): LocalFirestoreDB {
  if (!localDbInstance) {
    localDbInstance = new LocalFirestoreDB();
  }
  return localDbInstance;
}
