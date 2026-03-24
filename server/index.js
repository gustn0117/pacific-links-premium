const express = require("express");
const app = express();

app.use(express.json());

// Supabase 설정
const SUPABASE_URL = "https://api.hsweb.pics/rest/v1/inquiries";
const SUPABASE_KEY =
  process.env.SUPABASE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNjQxNzY5MjAwLCJleHAiOjE3OTk1MzU2MDB9.pei5Gx1wqEkbcDs1CiHFuTWNuVRlcrG5dPmYdrAqDdY";
const SUPABASE_SCHEMA = "pacific_links_premium";

// 알리고 SMS 설정
const ALIGO_API_KEY = process.env.ALIGO_API_KEY || "";
const ALIGO_USER_ID = process.env.ALIGO_USER_ID || "";
const ALIGO_SENDER = process.env.ALIGO_SENDER || "";
const ADMIN_PHONE = process.env.ADMIN_PHONE || "";

async function sendSMS(data) {
  if (!ALIGO_API_KEY || !ADMIN_PHONE) {
    console.log("[SMS] 설정 미완료 - SMS 미발송");
    return;
  }

  const msg = [
    "[안내자료 신청]",
    `상품: ${data.product}`,
    `지역: ${data.region}`,
    `이름: ${data.name}`,
    `연락처: ${data.phone}`,
  ].join("\n");

  const form = new URLSearchParams();
  form.append("key", ALIGO_API_KEY);
  form.append("user_id", ALIGO_USER_ID);
  form.append("sender", ALIGO_SENDER);
  form.append("receiver", ADMIN_PHONE);
  form.append("msg", msg);

  try {
    const res = await fetch("https://apis.aligo.in/send/", {
      method: "POST",
      body: form,
    });
    const result = await res.json();
    console.log("[SMS] 발송 결과:", JSON.stringify(result));
  } catch (err) {
    console.error("[SMS] 발송 실패:", err.message);
  }
}

// 모든 /api/inquiries 요청을 Supabase로 프록시
app.all("/api/inquiries", async (req, res) => {
  try {
    // 쿼리 파라미터 전달 (admin 패널의 필터링 등)
    const url = new URL(SUPABASE_URL);
    const params = new URL(req.originalUrl, "http://localhost").searchParams;
    params.forEach((value, key) => url.searchParams.set(key, value));

    const headers = {
      Host: "api.hsweb.pics",
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Accept-Profile": SUPABASE_SCHEMA,
      "Content-Profile": SUPABASE_SCHEMA,
    };

    if (req.headers["content-type"])
      headers["Content-Type"] = req.headers["content-type"];
    if (req.headers["prefer"]) headers["Prefer"] = req.headers["prefer"];

    const fetchOptions = { method: req.method, headers };

    if (["POST", "PATCH", "PUT"].includes(req.method)) {
      fetchOptions.body = JSON.stringify(req.body);
    }

    const response = await fetch(url.toString(), fetchOptions);
    const responseText = await response.text();

    res.status(response.status);
    const ct = response.headers.get("content-type");
    if (ct) res.setHeader("Content-Type", ct);
    res.send(responseText);

    // POST 성공 시 SMS 알림 발송 (비동기, 응답 차단 안 함)
    if (req.method === "POST" && response.ok) {
      sendSMS(req.body).catch((err) =>
        console.error("[SMS] Error:", err.message)
      );
    }
  } catch (err) {
    console.error("[Proxy] Error:", err.message);
    res.status(500).json({ error: "서버 오류가 발생했습니다" });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
});
