-- Personal access tokens used by the Rimora MCP connector (Claude custom connector).
-- Only a SHA-256 hash of each token is stored; the plaintext is shown once at creation.
CREATE TABLE public.mcp_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 80),
  token_hash TEXT NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  token_prefix TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ
);

CREATE INDEX mcp_tokens_user_idx ON public.mcp_tokens (user_id, created_at DESC);

ALTER TABLE public.mcp_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own MCP tokens" ON public.mcp_tokens
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users create own MCP tokens" ON public.mcp_tokens
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users revoke own MCP tokens" ON public.mcp_tokens
  FOR DELETE USING (auth.uid() = user_id);
