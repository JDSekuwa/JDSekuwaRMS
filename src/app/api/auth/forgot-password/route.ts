import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    // TODO: Integrate Resend email delivery in Stage B-9 for password reset flow.
    return NextResponse.json({
      status: "success",
      message: "Password reset request received. TODO: Integrate Resend email delivery in Stage B-9.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
