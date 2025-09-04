## CTIR — Claude Task Intelligence Router

Routing intelligente dei task tra Claude Code, modelli locali (Ollama) e MCP servers, con gestione auto-resume delle finestre a 5 ore.

Per dettagli di visione, architettura e setup, vedi `docs/idee_fondanti/*`.

### MCP Servers
- `mcp/ctir-ollama-mcp`: server MCP interno per delegare task a modelli locali (Ollama). Strumenti: `analyze_error`, `generate_unit_tests`, `format_code`.

Esecuzione rapida:
- Install: `npm --prefix mcp/ctir-ollama-mcp install`
- Dev: `npm --prefix mcp/ctir-ollama-mcp run dev`
- Build: `npm --prefix mcp/ctir-ollama-mcp run build`
- Health: `npm run mcp:health`
