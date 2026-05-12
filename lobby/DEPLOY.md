# Deploy the lobby Worker

```bash
cd ~/penguin-highway/lobby

# 1. Create the KV namespace (prints an `id = "..."` line)
npx wrangler kv namespace create rooms

# 2. Paste the id into wrangler.toml (replace REPLACE_WITH_KV_ID)

# 3. Deploy
npx wrangler deploy

# Worker URL appears in the output, like:
#   https://penguin-lobby.<account-subdomain>.workers.dev
#
# Copy that URL and paste into game.html — find `const LOBBY_URL`.
```

## Verify

```bash
curl https://penguin-lobby.<account>.workers.dev/rooms
# → []  (empty array on first deploy)
```

## Clean up later

```bash
# Delete all rooms manually if needed
npx wrangler kv key list --binding=ROOMS
npx wrangler kv key delete --binding=ROOMS room:<code>
```
