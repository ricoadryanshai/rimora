// Lets the `mcp` function call other edge functions on behalf of an already-verified
// connector token, by presenting the project's service role key as the bearer token.
const encoder = new TextEncoder();

const timingSafeEqual = (a: string, b: string) => {
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  let diff = left.length ^ right.length;
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  }
  return diff === 0;
};

export const isInternalCall = (req: Request) => {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const bearer = req.headers
    .get("Authorization")
    ?.match(/^Bearer\s+(.+)$/i)?.[1]
    ?.trim();
  return Boolean(serviceKey && bearer && timingSafeEqual(bearer, serviceKey));
};

type UserLookup = {
  auth: {
    getUser: () => Promise<{ data: { user: unknown }; error: unknown }>;
  };
};

/** Same shape as `userClient.auth.getUser()`, but trusts internal service-role calls. */
export const getCaller = (req: Request, userClient: UserLookup) =>
  isInternalCall(req)
    ? Promise.resolve({ data: { user: { id: "internal" } }, error: null })
    : userClient.auth.getUser();
