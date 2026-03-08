import { NextRequest, NextResponse } from "next/server";

const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbzD0VtL4HXyMr63RXnaY063E_gghxZm_gRPiNCWw4L63QTdUugMA94GYKAkMU02Ss1Ztg/exec";

const ALLOWED_ACTIONS = new Set([
  "sendSingleTicket",
  "sendTicketsFromSheet",
  "testSendTicketsFromSheet",
  "testSingleTicket",
]);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.action || !ALLOWED_ACTIONS.has(body.action)) {
      return NextResponse.json(
        { status: "error", message: "Invalid action" },
        { status: 400 }
      );
    }

    const res = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    // Google Apps Script may redirect (302) for deployed web apps
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { status: "error", message: text };
    }

    return NextResponse.json(data, { status: res.ok ? 200 : 502 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { status: "error", message },
      { status: 500 }
    );
  }
}
