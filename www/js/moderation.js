// Nickname moderation, shared by the app and the server (required by Google Play
// and App Store rules for user-generated content). Blocks common English and
// Hindi/Urdu abuse, including l33t-speak and spaced-out spellings.
const BAD = [
  'fuck', 'fuk', 'fck', 'shit', 'bitch', 'cunt', 'dick', 'cock', 'pussy', 'asshole', 'bastard', 'slut', 'whore',
  'porn', 'sex', 'nude', 'rape', 'nigg', 'fag', 'retard', 'penis', 'vagina', 'boob', 'tits', 'horny', 'hitler', 'nazi',
  'kill', 'isis', 'terror',
  'chut', 'chotiy', 'chod', 'madarc', 'behenc', 'bhenc', 'bhosd', 'gandu', 'gaand', 'gand', 'randi', 'lund', 'loda', 'lauda',
  'harami', 'kutta', 'kutti', 'kamina', 'saala', 'haramzad', 'jhaat', 'bsdk', 'mc', 'bc',
];
// short words that are only blocked as a whole name (to avoid blocking e.g. "Mcdonald")
const WHOLE_ONLY = new Set(['mc', 'bc', 'gand', 'sex', 'kill', 'nazi', 'rape', 'randi', 'isis', 'dick', 'loda', 'saala']);
const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', '@': 'a', $: 's', '!': 'i' };

export const ALLOWED_EMOJI = ['👍', '😂', '😡', '😱', '🔥', '👏'];

function squash(s) {
  return s.toLowerCase().replace(/[0-9@$!]/g, ch => LEET[ch] ?? ch).replace(/[^a-z]/g, '').replace(/(.)\1+/g, '$1');
}

export function isOffensive(name) {
  const flat = squash(name);
  if (!flat) return false;
  return BAD.some(w => {
    const ww = w.replace(/(.)\1+/g, '$1');
    return WHOLE_ONLY.has(w) ? flat === ww : flat.includes(ww);
  });
}

// Returns a safe nickname: trimmed, max 12 chars, no links/phone numbers/abuse.
export function cleanName(raw, fallback = 'Player') {
  let s = String(raw || '').normalize('NFKC').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 12);
  if (!s) return fallback;
  if (/(https?:|www\.|\.com|@)/i.test(s)) return fallback; // links / emails
  if ((s.match(/\d/g) || []).length >= 5) return fallback; // phone numbers
  if (isOffensive(s)) return fallback;
  return s;
}
