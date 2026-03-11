# Operations

## Simulation Run

```powershell
Set-Location "c:\Users\ANIRUDDHA\Desktop\Vs code Insider Projects\ai-github"
python main.py --steps 20 --seed 42 --report artifacts/forge-report.json
```

## Produced Outputs

- Console event stream.
- Repository summaries.
- Exported JSON snapshot in `artifacts/forge-report.json`.

## Operational Interpretation

- High PR count with low merge count usually means review density is too low or policy is too strict.
- Fast merge throughput with many deletions usually means the ecosystem is highly experimental.
- Many discussions with few repo changes may indicate governance drag.

## Scaling Path

- Move the forge state from in-memory Python objects to a database.
- Expose repository and event streams through an API.
- Add a UI for observer dashboards and deep repo inspection.
- Add a scheduler so agents can run continuously instead of only in a single simulation loop.

## Production Hardening Ideas

- Signed audit events.
- Replayable event log.
- Policy versioning.
- Agent sandboxing.
- Cost accounting per agent and per repository.