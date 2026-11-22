const ADMIN_PHONE = process.env.ADMIN_PHONE || "0556755846";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "1234";
const TARGET_AUDIO_FOLDER = process.env.TARGET_AUDIO_FOLDER || "8";

module.exports = {
  adminPhone: ADMIN_PHONE,
  adminPassword: ADMIN_PASSWORD,
  targetAudioFolder: TARGET_AUDIO_FOLDER,
  bannedUserResponse: "הגישה לשירות הושעתה עקב חריגה מכללי השימוש.",
  blockedResponseMarker: "חסום מערכת",
  searchKeywords: ["חפש לי", "חדשות", "מזג אוויר", "היום", "2026", "מחיר", "שער"],
  blockedKeywords: [],
  resetTriggers: ["אפס שיחה", "התחל מחדש", "שיחה חדשה"],
  summaryTriggers: ["סכם לי", "סיכום שיחה", "מה דיברנו"],
  deepDetailsTriggers: ["תפרט יותר", "בהרחבה", "פרט עוד"],
  switchToEnglishTriggers: ["דבר אנגלית", "עבור לאנגלית", "switch to english"],
  switchToHebrewTriggers: ["דבר עברית", "עבור לעברית", "switch to hebrew"],
  personaTriggers: [],
  nameTriggers: ["קוראים לי", "שמי הוא", "אני "],
  changeNameTriggers: ["שנה שם", "תחליף שם"],
  cityTriggers: ["אני גר ב", "אני מ"],
  changeCityTriggers: ["שנה עיר", "תחליף עיר"],
  adminLoginTriggers: ["מצב מנהל", "כניסת מנהל"],
  adminLogoutTriggers: ["צא ממצב מנהל", "יציאת מנהל"],
  getWarningMessage(attempt) {
    return `אזהרה מספר ${attempt}. אנא שמור על כללי השימוש של המערכת.`;
  }
};
