---
trigger: glob
globs: *.ts
---

# TS Style

- **Access**: Explicit `public`, `private`, `protected`.
- **Constants**: `private static readonly UPPER_SNAKE_CASE`.
- **Private**: Prefix with `_` (e.g., `_field`).
- **Validation**: Private helpers; call in `constructor` and `setters`. Throw specific errors.
- **Naming**: `camelCase` (vars/methods); self-documenting; minimal "why" comments.
- **Formatting**:
    - 1 empty line between fields, methods, blocks, and `get`/`set`.
    - Multi-line: 1 item per line + trailing comma.
