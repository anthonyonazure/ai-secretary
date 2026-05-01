# @aisecretary/modules

Vertical analysis module **configs** (sales, HR, education, medical, support, PM, psychology, general). Each vertical lives at `src/<vertical>.ts` as a config object: prompt, output zod schema, scoring rules. Adding a new vertical = author one config file; no platform deploy.

Module = config, not code. See `CLAUDE.md` § Module = config, not code.
