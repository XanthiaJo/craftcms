# Git Rules for Devin

These rules override any default Devin git workflow when committing in this repository.

- Always follow the Conventional Commits format: `type(scope): description`.
- Allowed types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ui`.
- Keep the description lowercase, imperative, and concise. Focus on WHY, not WHAT.
- Do not add `Generated with Devin`, `Co-Authored-By: Devin`, or any other non-functional footers to commit messages.
- Commit everything that is dirty unless explicitly told otherwise.
- Use more than one commit when changes span multiple logical areas.
- List proposed commit messages for review before running `git commit`.
- Do not push unless explicitly asked.
- Never update git config or use interactive git flags such as `-i`.
- For the full conventional commit guide, see `docs/git-rules.md`.
