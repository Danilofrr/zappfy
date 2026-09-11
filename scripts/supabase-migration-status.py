#!/usr/bin/env python3
"""Turn `supabase migration list` table output into stable version lists."""

from __future__ import annotations

import argparse
import re
from pathlib import Path

VERSION = re.compile(r"^\d{14}$")


def parse(path: Path) -> tuple[set[str], set[str]]:
    local: set[str] = set()
    remote: set[str] = set()
    for line in path.read_text(encoding="utf-8").splitlines():
        columns = [column.strip() for column in line.split("|")]
        if len(columns) < 2:
            continue
        if VERSION.fullmatch(columns[0]):
            local.add(columns[0])
        if VERSION.fullmatch(columns[1]):
            remote.add(columns[1])
    return local, remote


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("status", type=Path)
    parser.add_argument(
        "kind", choices=("local", "remote", "local-only", "remote-only", "shared")
    )
    args = parser.parse_args()
    local, remote = parse(args.status)
    versions = {
        "local": local,
        "remote": remote,
        "local-only": local - remote,
        "remote-only": remote - local,
        "shared": local & remote,
    }[args.kind]
    print("\n".join(sorted(versions)))


if __name__ == "__main__":
    main()
