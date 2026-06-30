// Phone-only signups store user.name (and therefore their auto-created org name)
// as the raw phone number, e.g. "+77073535549". We never want to surface that as
// a page title / workspace name, so treat an all-digits/+()- string as "no name".
const PHONE_LIKE_REGEX = /^\+?[\d\s()-]{6,}$/;

export function looksLikePhone(value: string | null | undefined): boolean {
  return Boolean(value && PHONE_LIKE_REGEX.test(value.trim()));
}
