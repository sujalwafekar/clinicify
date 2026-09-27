import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const collectionName = searchParams.get("name");
    if (!collectionName) {
      return NextResponse.json({ error: "Collection name required" }, { status: 400 });
    }

    const db = adminDb();
    const snap = await db.collection(collectionName).get();
    const items = snap.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json(
      { items },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load collection" },
      { status: 500 }
    );
  }
}
