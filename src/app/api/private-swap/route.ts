import { NextRequest, NextResponse } from "next/server";
import {
  PRIVACY_POOL_ADDRESS,
  buildPrivateSwapFee,
  submitPrivateSwap,
  type PrivateSwapCallAndProof,
  type PrivateFeeMode,
} from "@avnu/avnu-sdk";

// Server-only proxy for the AVNU privacy paymaster. The paymaster API key must
// never reach the browser, so buildPrivateSwapFee and submitPrivateSwap run
// here; proof generation stays client-side with the user's wallet.

export async function POST(req: NextRequest) {
  const paymasterApiKey = process.env.AVNU_PAYMASTER_API_KEY;
  if (!paymasterApiKey) {
    return NextResponse.json(
      { error: "AVNU_PAYMASTER_API_KEY is not set on the server." },
      { status: 500 }
    );
  }

  let body: {
    action?: string;
    feeMode?: PrivateFeeMode;
    callAndProof?: PrivateSwapCallAndProof;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    if (body.action === "fee" && body.feeMode) {
      const fee = await buildPrivateSwapFee({
        poolAddress: PRIVACY_POOL_ADDRESS,
        feeMode: body.feeMode,
        paymasterApiKey,
      });
      return NextResponse.json({ fee });
    }

    if (body.action === "submit" && body.callAndProof && body.feeMode) {
      const { transactionHash } = await submitPrivateSwap({
        callAndProof: body.callAndProof,
        feeMode: body.feeMode,
        paymasterApiKey,
      });
      return NextResponse.json({ transactionHash });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
