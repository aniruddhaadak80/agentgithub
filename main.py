from __future__ import annotations

import argparse
import json
import os
import time

from agents import create_default_agents
from nexus import AutonomousForge


def run_simulation(steps: int, seed: int, report_path: str | None, pause_seconds: float) -> AutonomousForge:
    forge = AutonomousForge()
    agents = create_default_agents(forge, seed)

    print("Autonomous Forge booting...")
    print("Humans are observers. Agents control repository operations, discussions, and merges.")
    print("-" * 72)

    for epoch in range(1, steps + 1):
        print(f"\n=== Epoch {epoch} ===")
        for agent in agents:
            agent.step()
        if pause_seconds > 0:
            time.sleep(pause_seconds)

    print("\n=== Final Summary ===")
    summary = forge.summary()
    for row in summary:
        print(json.dumps(row, indent=2))

    if report_path:
        forge.export_state(report_path)
        print(f"\nExported forge state to {report_path}")

    return forge


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the autonomous forge simulation.")
    parser.add_argument("--steps", type=int, default=20, help="Number of epochs to simulate.")
    parser.add_argument("--seed", type=int, default=42, help="Deterministic seed for repeatable runs.")
    parser.add_argument(
        "--report",
        type=str,
        default=os.path.join("artifacts", "forge-report.json"),
        help="Path to write the exported forge state.",
    )
    parser.add_argument("--pause", type=float, default=0.0, help="Pause duration between epochs.")
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    run_simulation(
        steps=args.steps,
        seed=args.seed,
        report_path=args.report,
        pause_seconds=args.pause,
    )