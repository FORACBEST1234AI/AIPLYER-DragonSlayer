# AIPLYER DragonSlayer

Advanced Mineflayer bot for Minecraft **1.21.1** focused on surviving, progressing, and eventually soloing the Ender Dragon without cheats.

## Server defaults
- Host: `AITEST12.aternos.me`
- Port: `15820`
- Username: `AIPLYER`
- Version: `1.21.1`

## Key changes in v2
- **Proxy removed completely**
- **DNS optimized** with Cloudflare + Google resolvers
- **Cycle fixed to 5 hours 56 minutes** (`21360s`)
- **Re-run system improved**:
  - `scripts/run_forever.sh` for VPS/Termux/Linux
  - GitHub Actions schedule every 6 hours
  - optional self-dispatch step in workflow
- **Skill registry expanded** to 50+ micro-skills
- Stronger memory, shelter, recovery, combat, and progression helpers

## Run locally
```bash
npm install
npm test
npm start
```

## GitHub Actions
Workflow runs on:
- `workflow_dispatch`
- schedule every 6 hours
- push to `main`

## Long-running mode
```bash
bash scripts/run_forever.sh
```

## Memory files
- `data/memory.json` - persistent bot memory
- `logs/` - runtime logs

## Notes
- No cheats are used.
- The bot tries to act human-like and survive first.
- If GitHub Actions is delayed by GitHub, use `run_forever.sh` on a VPS / Oracle Cloud / Termux for the most reliable long-running setup.
