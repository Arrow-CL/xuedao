import { NextRequest, NextResponse } from "next/server";

const API_KEY = process.env.BAIDU_OCR_API_KEY || "";
const SECRET_KEY = process.env.BAIDU_OCR_SECRET_KEY || "";
const TOKEN_URL = "https://aip.baidubce.com/oauth/2.0/token";
const OCR_URL = "https://aip.baidubce.com/rest/2.0/ocr/v1/formula";

let cachedToken: { token: string; expires: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expires) {
    return cachedToken.token;
  }
  const res = await fetch(TOKEN_URL + "?grant_type=client_credentials&client_id=" + API_KEY + "&client_secret=" + SECRET_KEY, {
    method: "POST",
  });
  const data = await res.json();
  if (data.access_token) {
    cachedToken = {
      token: data.access_token,
      expires: Date.now() + (data.expires_in || 2592000) * 1000 - 60000,
    };
    return data.access_token;
  }
  throw new Error("Failed to get Baidu access token: " + JSON.stringify(data));
}

export async function POST(req: NextRequest) {
  try {
    const { image } = await req.json();
    if (!image) {
      return NextResponse.json({ text: "" }, { status: 200 });
    }

    const token = await getAccessToken();

    const formData = new URLSearchParams();
    formData.append("image", image);
    formData.append("recognize_granularity", "big");

    const res = await fetch(OCR_URL + "?access_token=" + token, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData.toString(),
    });

    const data = await res.json();

    if (data.words_result && data.words_result.length > 0) {
      const texts = data.words_result.map((r: any) => r.words).join("\n");
      return NextResponse.json({ text: texts });
    }

    return NextResponse.json({ text: "" });
  } catch (err) {
    console.error("OCR error:", err);
    return NextResponse.json({ text: "" }, { status: 200 });
  }
}
