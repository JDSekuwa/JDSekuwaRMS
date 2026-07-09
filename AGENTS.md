cat >> AGENTS.md << 'EOF'

## Project build plan

This project is being built in a strict layered sequence, documented in full in
BUILD_PLAN.md at the project root: Database layer -> Backend services layer ->
Frontend layer -> Testing layer -> Deployment layer. Before starting any task,
check which stage of BUILD_PLAN.md the current request corresponds to, and follow
that stage's scope exactly - do not build ahead into a later layer (e.g. do not
write UI code while working a Database-layer stage).

After completing any stage's work, always append a new section to
DOCUMENTATION.md at the project root summarizing what was built and why, following
whatever format earlier sections already use. Never overwrite earlier sections of
DOCUMENTATION.md.

Never run package installs (npm/npx), never run database migrations or seed
scripts, and never push to git or interact with GitHub remotes - always hand back
the exact command for the human to run themselves and report back the output.
EOF


<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
