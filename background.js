const MALABAR_RATE_ENDPOINT = "https://gold.liverate.in/api/trend-rates";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "blinkdeal:get-malabar-rate") return;

  fetch(MALABAR_RATE_ENDPOINT)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Rate request failed (${response.status})`);
      }
      return response.json();
    })
    .then((payload) => sendResponse({ ok: true, payload }))
    .catch(() =>
      sendResponse({
        ok: false,
        error: "Unable to fetch the live Malabar 24K rate.",
      }),
    );

  return true;
});
