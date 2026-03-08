"""Current simulation runs: per-task (drone_id, session_id) pairs for stop/pause to update DB."""

# task_id -> [(drone_id, session_id)]; task_id None used for legacy single run
_run_by_task: dict[int | None, list[tuple[int, int]]] = {}


def set_current_run(task_id: int | None, drone_session_pairs: list[tuple[int, int]]) -> None:
    """Set or replace the run for one task (or legacy when task_id is None)."""
    global _run_by_task
    _run_by_task = {task_id: list(drone_session_pairs)}


def add_task_run(task_id: int, drone_session_pairs: list[tuple[int, int]]) -> None:
    """Add a task's run (for concurrent multi-task). Does not replace existing tasks."""
    global _run_by_task
    _run_by_task[task_id] = list(drone_session_pairs)


def remove_task_run(task_id: int | None) -> None:
    """Remove a task's run from current runs."""
    global _run_by_task
    _run_by_task.pop(task_id, None)


def get_current_run() -> tuple[int | None, list[tuple[int, int]]]:
    """Return (task_id, pairs) for single-task/legacy. Prefer task_id from first key that is not None, else None."""
    if not _run_by_task:
        return None, []
    # Legacy: single key None
    if None in _run_by_task and len(_run_by_task) == 1:
        return None, list(_run_by_task[None])
    # Multi-task: return first non-None task (for backward compat with code that expects one run)
    for tid, pairs in _run_by_task.items():
        if tid is not None:
            return tid, list(pairs)
    return None, list(_run_by_task.get(None, []))


def get_run_for_task(task_id: int | None) -> list[tuple[int, int]] | None:
    """Get pairs for a specific task, or None if not running."""
    return list(_run_by_task[task_id]) if task_id in _run_by_task else None


def get_current_task_id() -> int | None:
    """First non-None task_id in current runs, or None."""
    for tid in _run_by_task:
        if tid is not None:
            return tid
    return None


def get_all_task_ids() -> list[int]:
    """All task IDs currently in run state (excludes legacy None)."""
    return [tid for tid in _run_by_task if tid is not None]


def get_all_runs() -> dict[int | None, list[tuple[int, int]]]:
    """All runs (task_id or None -> pairs). For stopping everything."""
    return dict(_run_by_task)


def clear_current_run() -> None:
    """Clear all runs (legacy and tasks)."""
    global _run_by_task
    _run_by_task = {}
