const axios = "axios" in globalThis ? globalThis.axios : require("axios");

const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_KEY ||
  "";

function isConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_KEY);
}

function headers() {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
    Prefer: "return=representation"
  };
}

function startOfTodayIso() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now.toISOString();
}

async function isUserBanned(phone) {
  if (!isConfigured() || !phone) return false;
  try {
    const url = `${SUPABASE_URL}/rest/v1/banned_users?phone=eq.${encodeURIComponent(String(phone))}&select=phone&limit=1`;
    const res = await axios.get(url, { headers: headers(), timeout: 6000 });
    return Array.isArray(res.data) && res.data.length > 0;
  } catch (err) {
    console.warn("⚠️ [Supabase isUserBanned]", err.message || err);
    return false;
  }
}

async function getAllConversationsForToday(phone) {
  if (!isConfigured() || !phone) return [];
  try {
    const since = encodeURIComponent(startOfTodayIso());
    const url = `${SUPABASE_URL}/rest/v1/conversations?phone=eq.${encodeURIComponent(
      String(phone)
    )}&created_at=gte.${since}&order=created_at.asc&limit=30`;
    const res = await axios.get(url, { headers: headers(), timeout: 7000 });
    return Array.isArray(res.data) ? res.data : [];
  } catch (err) {
    console.warn("⚠️ [Supabase getAllConversationsForToday]", err.message || err);
    return [];
  }
}

async function logConversation(phone, question, answer, model, userName = null, userCity = null, audioFileId = null) {
  if (!isConfigured()) return null;
  try {
    const url = `${SUPABASE_URL}/rest/v1/conversations`;
    const payload = {
      phone: String(phone || "unknown"),
      question: String(question || ""),
      answer: String(answer || ""),
      model: String(model || "unknown"),
      user_name: userName || null,
      user_city: userCity || null,
      audio_file_id: audioFileId || null,
      created_at: new Date().toISOString()
    };
    const res = await axios.post(url, payload, { headers: headers(), timeout: 7000 });
    return Array.isArray(res.data) ? res.data[0] : res.data;
  } catch (err) {
    console.warn("⚠️ [Supabase logConversation]", err.message || err);
    return null;
  }
}

module.exports = {
  isUserBanned,
  getAllConversationsForToday,
  logConversation
};
