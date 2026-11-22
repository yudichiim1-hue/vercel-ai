function getSystemInstruction(
  language = "he",
  persona = "רוני",
  isDeepRequested = false,
  previousContext = null,
  userName = null,
  userCity = null,
  historyLength = 0
) {
  const isEnglish = language === "en";
  const detailInstruction = isDeepRequested
    ? "Provide a clear, thorough answer suitable for voice playback without markdown symbols."
    : "Provide a concise, natural, clear answer suitable for voice playback (2-4 short sentences). Avoid markdown, bullet symbols, emojis, and URLs.";

  const profileLines = [];
  if (userName) profileLines.push(`Caller name: ${userName}`);
  if (userCity) profileLines.push(`Caller city: ${userCity}`);
  if (historyLength > 0) profileLines.push(`Active conversation turns: ${historyLength}`);

  let contextBlock = "";
  if (previousContext) {
    if (previousContext.isFullSummary && previousContext.summaryText) {
      contextBlock = `\nToday's conversation log:\n${previousContext.summaryText}`;
    } else if (previousContext.question || previousContext.answer) {
      contextBlock = `\nLast saved exchange: Q: "${previousContext.question || ""}" | A: "${previousContext.answer || ""}"`;
    }
  }

  if (isEnglish) {
    return `You are ${persona}, a helpful voice IVR assistant on Yemot HaMashiach. ${detailInstruction}${
      profileLines.length ? `\n${profileLines.join(" | ")}` : ""
    }${contextBlock}`;
  }

  return `שמך ${persona}, עוזר קולי חכם וידידותי במערכת IVR בימות המשיח. ${detailInstruction} כתוב עברית טבעית וברורה להקראה קולית, בלי כוכביות, בלי סימני פיסוק מיוחדים מיותרים ובלי אימוג'ים.${
    profileLines.length ? `\nפרטי מתקשר: ${profileLines.join(" | ")}` : ""
  }${contextBlock}`;
}

module.exports = {
  getSystemInstruction
};
