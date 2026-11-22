const express = require("express");
const axios = "axios" in globalThis ? globalThis.axios : require("axios");
const { YemotRouter } = require("yemot-router2");

const config = require("../config");
const supabase = require("../supabase");
const { buildAudioFileId, generateAndUploadGoogleTts } = require("../lib/ttsYemot");
const { collectAiKeys, transcribeAudio, generateAiAnswer } = require("../lib/aiEngines");

const app = express();
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(express.json({ limit: "50mb" }));

const sessions = new Map();
const requestLimits = new Map();

function sanitizeSpeech(text) {
  return String(text || "")
    .replace(/[\r\n]+/g, " ")
    .replace(/[,.?!:;'"״׳`_*~#–—&?=<>/()\\[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function checkRateLimit(phone) {
  if (!phone || phone === "default_user" || phone === config.adminPhone) return true;
  const now = Date.now();
  const recent = (requestLimits.get(phone) || []).filter((ts) => now - ts < 60000);
  if (recent.length >= 20) return false;
  recent.push(now);
  requestLimits.set(phone, recent);
  return true;
}

async function fetchAudioFromYemot(params, token, returnFolder) {
  const candidates = [
    params.read,
    params.record,
    params.path,
    params.Path,
    params.file,
    params.File,
    params.ApiPath,
    `ivr2:/${returnFolder}/last.wav`,
    "ivr2:/1/last.wav"
  ].filter(Boolean);

  for (const raw of candidates) {
    const val = String(raw).trim();
    if (!val || /^\d+$/.test(val)) continue;
    const yemotPath = val.startsWith("ivr2:")
      ? val
      : val.startsWith("/")
      ? `ivr2:${val}`
      : `ivr2:/${val}`;

    const url = `https://www.call2all.co.il/ym/api/DownloadFile?token=${encodeURIComponent(
      token
    )}&path=${encodeURIComponent(yemotPath)}`;

    try {
      const resp = await axios.get(url, { responseType: "arraybuffer", timeout: 8000 });
      if (resp.data && resp.data.byteLength > 0) {
        return Buffer.from(resp.data);
      }
    } catch (_) {}
  }

  return null;
}

function sendYemotAction(res, messagePart, returnFolder = "1") {
  res.status(200);
  res.set("Content-Type", "text/plain; charset=utf-8");
  return res.send(`id_list_message=${messagePart}&go_to_folder=/${returnFolder}`);
}

function sendDigitMenu(res, promptText, returnFolder = "1") {
  res.status(200);
  res.set("Content-Type", "text/plain; charset=utf-8");
  const params = new URLSearchParams({
    read: "yes",
    max_digits: "1",
    min_digits: "1",
    sec_wait: "6",
    play_ok: "no",
    id_list_message: `t-${sanitizeSpeech(promptText)}`,
    go_to_folder: `/${returnFolder}`
  });
  return res.send(params.toString());
}

function sendRecordPrompt(res, promptText, returnFolder = "1") {
  res.status(200);
  res.set("Content-Type", "text/plain; charset=utf-8");
  const params = new URLSearchParams({
    read: "yes",
    read_type: "record",
    max_sec: "25",
    sec_wait: "4",
    play_ok: "yes",
    id_list_message: `t-${sanitizeSpeech(promptText)}`,
    go_to_folder: `/${returnFolder}`
  });
  return res.send(params.toString());
}

async function processCall(req, res, callObj = null) {
  try {
    const params = { ...(req.query || {}), ...(req.body || {}) };
    const returnFolder =
      String(params.return_folder || params.SHL || "1").replace(/^\/+/, "") || "1";
    const token =
      params.token ||
      params.TOKEN ||
      params.ApiToken ||
      params.SessionToken ||
      process.env.YM_API_TOKEN ||
      "";
    const phone = callObj?.phone || params.ApiPhone || params.phone || "default_user";
    const callId = callObj?.callId || params.ApiCallId || params.ApiYFCallId || `${Date.now()}`;
    const sessionKey = `${phone}_${callId}`;

    if (!token) {
      return sendYemotAction(res, `t-${sanitizeSpeech("חסר טוקן מערכת")}`, returnFolder);
    }

    if (!checkRateLimit(phone)) {
      return sendYemotAction(
        res,
        `t-${sanitizeSpeech("חרגת ממספר הפניות המותר בדקה")}`,
        returnFolder
      );
    }

    const banned = phone !== config.adminPhone && (await supabase.isUserBanned(phone));
    if (banned) {
      return sendYemotAction(
        res,
        `t-${sanitizeSpeech(config.bannedUserResponse)}`,
        returnFolder
      );
    }

    let session = sessions.get(sessionKey) || {
      step: "menu",
      history: [],
      language: "he",
      persona: "רוני",
      userName: null,
      userCity: null
    };

    if (session.step === "menu" && (params.read === undefined || params.read === "")) {
      session.step = "awaiting_choice";
      sessions.set(sessionKey, session);
      return sendDigitMenu(res, "היי, לשאלה הקש 1, להיסטוריה הקש 2", returnFolder);
    }

    if (session.step === "awaiting_choice") {
      const choice = String(params.read || "").trim();

      if (choice === "1") {
        session.step = "awaiting_question";
        sessions.set(sessionKey, session);
        return sendRecordPrompt(res, "אנא אמור את שאלתך לאחר הצפצוף", returnFolder);
      }

      if (choice === "2") {
        session.step = "menu";
        sessions.set(sessionKey, session);
        const historyRows = await supabase.getAllConversationsForToday(phone);
        if (!historyRows || historyRows.length === 0) {
          return sendYemotAction(
            res,
            `t-${sanitizeSpeech("לא נמצאה היסטוריית שיחות להיום")}`,
            returnFolder
          );
        }

        const lastTwo = historyRows.slice(-2);
        const spoken = lastTwo
          .map(
            (row, index) =>
              `שיחה ${index + 1}. שאלת: ${row.question || "לא ידוע"}. התשובה: ${
                row.answer || "ללא תשובה"
              }`
          )
          .join(". ");

        return sendYemotAction(res, `t-${sanitizeSpeech(spoken)}`, returnFolder);
      }

      session.step = "awaiting_choice";
      sessions.set(sessionKey, session);
      return sendDigitMenu(
        res,
        "הקשה לא מזוהה. לשאלה הקש 1, להיסטוריה הקש 2",
        returnFolder
      );
    }

    if (session.step === "awaiting_question") {
      session.step = "menu";
      sessions.set(sessionKey, session);

      const keys = collectAiKeys(params);
      const audioBuffer = await fetchAudioFromYemot(params, token, returnFolder);
      if (!audioBuffer) {
        return sendYemotAction(
          res,
          `t-${sanitizeSpeech("לא נקלטה הקלטה תקינה. נסה שוב")}`,
          returnFolder
        );
      }

      const transcribedText = await transcribeAudio(
        audioBuffer,
        keys.deepgramApiKey,
        session.language
      );
      if (!transcribedText) {
        return sendYemotAction(
          res,
          `t-${sanitizeSpeech("לא הצלחתי להבין את השאלה. נסה שוב")}`,
          returnFolder
        );
      }

      const isDeepRequested = config.deepDetailsTriggers.some((t) =>
        transcribedText.includes(t)
      );
      const aiResult = await generateAiAnswer({
        transcribedText,
        session,
        keys,
        requestedModel: params.MODEL || params.model,
        isDeepRequested
      });

      const audioFileId = buildAudioFileId(phone, `${callId}_${Date.now()}`);
      session.history.push({ role: "user", content: transcribedText });
      session.history.push({ role: "assistant", content: aiResult.answer });
      if (session.history.length > 6) {
        session.history = session.history.slice(-6);
      }
      sessions.set(sessionKey, session);

      supabase
        .logConversation(
          phone,
          transcribedText,
          aiResult.answer,
          aiResult.model,
          session.userName,
          session.userCity,
          audioFileId
        )
        .catch(() => {});

      const uploaded = await generateAndUploadGoogleTts(
        aiResult.answer,
        token,
        audioFileId,
        config.targetAudioFolder
      );

      if (uploaded) {
        return sendYemotAction(
          res,
          `l-/${config.targetAudioFolder}.f-${audioFileId}`,
          returnFolder
        );
      }

      return sendYemotAction(res, `t-${sanitizeSpeech(aiResult.answer)}`, returnFolder);
    }

    session.step = "awaiting_choice";
    sessions.set(sessionKey, session);
    return sendDigitMenu(res, "היי, לשאלה הקש 1, להיסטוריה הקש 2", returnFolder);
  } catch (err) {
    console.error("❌ [IVR Fatal Error]", err);
    return sendYemotAction(
      res,
      `t-${sanitizeSpeech("אירעה שגיאה בשרת. נסה שוב מאוחר יותר")}`,
      "1"
    );
  }
}

const router = YemotRouter();
router.all("/", async (call) => {
  await processCall(call.req, call.res, call);
});

app.use("/api/ivr", router);
app.use("/", router);

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🚀 IVR server listening on port ${PORT}`);
  });
}

module.exports = async (req, res) => {
  return app(req, res);
};
