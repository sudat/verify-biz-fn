---
# Modeling rules (BPMN / DMN / Glossary / Context Map)
---

## Glossary token convention
When a business term appears inside BPMN or DMN labels, wrap it as `«用語»`.
Example: `«請求書»を確認`, `«承認ルート»を決定`.

## BPMN
- Store BPMN XML at `spec/process/**/*.bpmn`.
- Each BPMN process must have a stable `process id`.
- Any lane/task/gateway names that include business terms must use `«...».`

## DMN
- Store DMN XML at `spec/decision/**/*.dmn`.
- DMN decision names and input/output names that include business terms must use `«...».`

## Context Map
- Define contexts and allowed dependencies in `spec/context-map.yml`.
- Code must respect dependency rules: cross-context access must go through a context's `api/` surface only.

## Change package flags
Every CR must include:
- `process_change`, `decision_change`, `glossary_change`, `contextmap_change`
and targets listing which files will be touched.