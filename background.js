const ENDPOINT = "https://api.typesafe.ai/v1/systemone";

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type !== "judge") return;
  judge(msg.filter, msg.tweets).then(sendResponse);
  return true; // async sendResponse
});

// tweets: [{id, text}] -> {verdicts: {id: probability}}
async function judge(filter, tweets) {
  const { apiKey } = await chrome.storage.local.get("apiKey");
  if (!apiKey) return { error: "no API key set" };

  const questions = {};
  for (const t of tweets) {
    questions[t.id] = {
      type: "noul",
      instructions: {
        tweet: t.text,
        question: `Does \`tweet\` match this filter? Filter: ${filter}`,
      },
    };
  }

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "jev-latest",
        state: "Tweets from a Twitter/X timeline.",
        questions,
      }),
    });
    if (!res.ok) return { error: `API ${res.status}` };
    const data = await res.json();
    const verdicts = {};
    for (const [id, a] of Object.entries(data.answers)) verdicts[id] = a.noul;
    return { verdicts };
  } catch (e) {
    return { error: String(e) };
  }
}
