export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    if (request.method !== "POST") {
      return json({ error: "method_not_allowed" }, 405);
    }

    if (!env.OPENAI_API_KEY) {
      return json({ error: "missing_openai_api_key" }, 500);
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return json({ error: "invalid_json" }, 400);
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: env.OPENAI_MODEL || "gpt-5-nano",
        store: false,
        max_output_tokens: 80,
        instructions: [
          "あなたは飲み会にいる気の利く友達です。",
          "短い日本語で1文だけ返してください。",
          "飲酒を煽らないでください。",
          "医学的に安全だと断定しないでください。",
          "必要なら水や休憩を軽く勧めてください。",
          "説教臭くせず、少しだけユーモアを入れてください。",
        ].join("\n"),
        input: buildPrompt(payload),
      }),
    });

    if (!response.ok) {
      return json({ error: "openai_request_failed" }, 502);
    }

    const data = await response.json();
    const comment = String(data.output_text || "").trim().replace(/^["「]|["」]$/g, "");
    return json({ comment: comment.slice(0, 80) });
  },
};

function buildPrompt(payload) {
  return [
    `今回追加したもの: ${payload.addedDrink || "不明"}`,
    `お酒かどうか: ${payload.isAlcohol ? "お酒" : "水など"}`,
    `合計杯数: ${Number(payload.totalCount || 0)}杯`,
    `飲み始めから: ${Number(payload.elapsedMinutes || 0)}分`,
    `前回のお酒から: ${payload.minutesSincePrevious == null ? "なし" : `${Number(payload.minutesSincePrevious)}分`}`,
    `水: ${Number(payload.waterCount || 0)}回`,
    `内訳: ${JSON.stringify(payload.breakdown || {})}`,
  ].join("\n");
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders(),
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "https://takeru1123.github.io",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}
