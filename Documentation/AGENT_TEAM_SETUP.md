# Agent Team Setup Guide for MoltArena

## Overview

This guide shows you how to set up an agent team with 3 specialized teammates to build MoltArena:
1. **UX Designer** - Frontend, user experience, React components
2. **Architect** - Backend architecture, API design, database schema
3. **QA Reviewer** - Testing, code review, quality assurance

## Prerequisites

✅ Agent teams are now enabled in your `~/.claude/settings.json`

## Starting Your Agent Team

### Option 1: Quick Start (Recommended)

Copy and paste this prompt into Claude Code:

```
Create an agent team to build the MoltArena platform (see DESIGN.md).
Structure the team with 3 teammates:

1. UX Designer (use Sonnet):
   - Focus on React frontend, spectator UI, and user experience
   - Build components for live battle viewing, voting interface, agent dashboard
   - Ensure accessibility and responsive design
   - Own all files in /frontend directory

2. Technical Architect (use Opus):
   - Focus on backend architecture, API design, and database schema
   - Build Fastify REST API, Socket.io real-time system, battle engine
   - Design PostgreSQL schema and Redis caching
   - Own all files in /backend directory

3. QA Reviewer (use Sonnet):
   - Review code from UX Designer and Architect teammates
   - Write tests, check for security issues, validate architecture decisions
   - Run tests and verify implementations before completion
   - Don't write production code - focus on quality gates

Have them work through Phase 1 tasks from DESIGN.md. Use delegate mode
so you focus on coordination. Require plan approval for the Architect
before they start backend implementation.
```

### Option 2: Step-by-Step Manual Setup

If you want more control, follow these steps:

#### Step 1: Start a New Claude Code Session

```bash
cd ~/Documents/MoltArena
claude
```

#### Step 2: Request Team Creation

```
I want to create an agent team to build MoltArena. Please read DESIGN.md
and propose a team structure with 3 teammates: one for UX, one for technical
architecture, and one for testing/review.
```

#### Step 3: Approve and Configure

Claude will propose the team. Review and approve, then:

```
Use Sonnet for the UX designer and QA reviewer, Opus for the architect.
Enable plan approval for the architect teammate before they start
implementation. Switch to delegate mode.
```

#### Step 4: Assign Initial Tasks

```
Break down Phase 1 (Voice-First MVP) from DESIGN.md into specific tasks:
- UX: React setup, spectator UI components, WebSocket client
- Architect: Backend setup, API endpoints, database schema, battle engine
- QA: Test plans, security review checklist, CI/CD setup

Create tasks in the shared task list with dependencies.
```

## Display Modes

### In-Process Mode (Default)
- All teammates run in your main terminal
- Use **Shift+Up/Down** to select teammates
- Type to message the selected teammate
- Press **Enter** to view their full session
- Press **Escape** to interrupt
- Press **Ctrl+T** to toggle task list

### Split-Pane Mode (Requires tmux or iTerm2)
- Each teammate gets their own terminal pane
- Click into a pane to interact with that teammate
- See all outputs simultaneously

To force split-pane mode (if you have tmux):
```bash
claude --teammate-mode tmux
```

## Working with Your Team

### Check Task Progress

```
Show me the current task list and what each teammate is working on.
```

### Message Individual Teammates

In in-process mode:
1. Press **Shift+Down** to cycle to the teammate
2. Type your message
3. Press Enter to send

Examples:
```
[To UX Designer]
Focus on the spectator UI first. Make sure the audio player works
with Deepgram streams before building the voting interface.

[To Architect]
Make sure the WebSocket events match what the UX designer expects.
Review the API design section in DESIGN.md.

[To QA Reviewer]
Review the Architect's database schema before they implement it.
Check for indexing issues and missing foreign key constraints.
```

### Review Teammate Work

```
Ask the QA Reviewer to review the UX Designer's latest React components
and provide feedback on accessibility and code quality.
```

### Require Plan Approval

For risky changes:

```
Have the Architect create a plan for the battle state machine
implementation. Don't let them start coding until I approve the plan.
```

The Architect will work in plan mode, create a plan, and send it to the lead for approval.

### Shut Down a Teammate

When a teammate's work is done:

```
Ask the UX Designer to shut down - their Phase 1 tasks are complete.
```

### Clean Up the Team

When all work is done:

```
Ask all teammates to shut down, then clean up the team.
```

⚠️ **Always let the lead clean up, never have a teammate run cleanup directly.**

## Team Communication Patterns

### Effective Communication

**Good examples:**
```
[Broadcast to all teammates]
Read the DESIGN.md authentication section. We're using bearer tokens
for Phase 1, StrongDM ID for Phase 2. Don't implement OAuth yet.

[To Architect]
The UX Designer needs the WebSocket event schema. Share the battle:turn
event structure from the API design section.

[To QA Reviewer]
The Architect just finished the database schema. Review it for:
1. Missing indexes
2. Foreign key constraints
3. Potential N+1 query issues
```

**Avoid:**
- Vague instructions: "Make it better"
- Overlapping responsibilities: "Both of you work on the API"
- Ignoring dependencies: Starting frontend before API is defined

### Inter-Agent Communication

Teammates can message each other directly:

```
Have the UX Designer ask the Architect for the exact WebSocket event
format for battle commentary.
```

This creates a direct conversation between agents without going through you.

## Best Practices for MoltArena

### 1. Clear File Ownership

- **UX Designer owns:** `/frontend/**/*`
- **Architect owns:** `/backend/**/*`
- **QA Reviewer owns:** `/tests/**/*`, `/docs/testing/**/*`

This prevents file conflicts and merge issues.

### 2. Phase-Based Development

Follow the phased approach from DESIGN.md:

**Phase 1 (Week 1-3):**
- UX: Spectator UI, battle view, voting interface
- Architect: REST API, WebSocket server, battle engine, AI judge integration
- QA: Unit tests, integration tests, security checks

**Phase 2 (Week 4):**
- UX: Matchmaking UI, leaderboard
- Architect: ELO system, matchmaking queue, StrongDM ID auth
- QA: Load testing, competitive integrity checks

### 3. Regular Check-ins

Every few hours:

```
Everyone report progress and any blockers.
```

### 4. Plan Approval for Risky Work

Use plan approval for:
- Database schema changes
- Authentication implementation
- Battle state machine
- WebSocket event protocol

```
Architect: create a plan for the battle state machine. Include state
transitions, error handling, and recovery scenarios. Don't implement
until QA Reviewer and I approve it.
```

### 5. Quality Gates

Before marking tasks complete:

```
QA Reviewer: before the Architect marks the REST API task as complete,
verify:
1. All endpoints have validation
2. Error handling is consistent
3. Rate limiting is implemented
4. API docs are up to date
```

## Hooks for Quality Control

Add these hooks to automatically enforce quality gates:

### TeammateIdle Hook

Prevents teammates from going idle without review:

```json
{
  "hooks": {
    "TeammateIdle": [
      {
        "hooks": [
          {
            "type": "prompt",
            "prompt": "Review the teammate's recent work in $ARGUMENTS. If they completed significant code changes without tests, exit with code 2 and remind them to add tests."
          }
        ]
      }
    ]
  }
}
```

### TaskCompleted Hook

Validates tasks before marking complete:

```json
{
  "hooks": {
    "TaskCompleted": [
      {
        "hooks": [
          {
            "type": "agent",
            "prompt": "The task $ARGUMENTS was just marked complete. Verify the work is actually done and tests pass. If not, exit with code 2 to prevent completion."
          }
        ]
      }
    ]
  }
}
```

## Troubleshooting

### Teammates Not Visible

Press **Shift+Down** repeatedly to cycle through active teammates. They may already be running.

### Too Many Permission Prompts

Pre-approve common operations:

```json
{
  "permissions": {
    "allow": [
      "Bash(command:npm install)",
      "Bash(command:npm run dev)",
      "Write(file:frontend/**)",
      "Write(file:backend/**)",
      "Edit(file:frontend/**)",
      "Edit(file:backend/**)"
    ]
  }
}
```

### Teammate Stopped on Error

1. Use **Shift+Up/Down** to select the teammate
2. Press **Enter** to view their output
3. Send them instructions to recover:

```
Check the error in your last command. The database connection failed
because PostgreSQL isn't running. Start it with docker-compose up -d postgres.
```

### Lead Starting Implementation

If the lead starts writing code instead of coordinating:

```
Wait for your teammates to complete their tasks. You should focus on
coordination, not implementation. Use delegate mode.
```

Then press **Shift+Tab** to cycle into delegate mode.

### File Conflicts

If two teammates edit the same file:

```
Pause! UX Designer and Architect are both editing App.tsx.
UX Designer: you own the frontend, continue.
Architect: focus on backend only, don't touch frontend files.
```

## Example Session Flow

Here's what a typical session looks like:

```
You: Create an agent team for MoltArena with UX, Architect, QA roles.

[Claude creates team, spawns 3 teammates]

You: Break down Phase 1 into tasks with clear owners and dependencies.

[Lead creates task list, assigns tasks]

UX Designer: Starting React setup and component structure...
Architect: Creating database schema and API design...
QA Reviewer: Reviewing DESIGN.md and creating test plan...

[2 hours later]

You: Everyone report progress.

UX Designer: Completed React setup, Vite config, and base components.
             Starting on spectator UI. Need WebSocket event format from Architect.

Architect: Database schema complete, migrations written. API endpoints
           defined. Sharing WebSocket events with UX Designer now.

QA Reviewer: Reviewed database schema - found 2 missing indexes,
             Architect is fixing. Test plan drafted in /docs/testing/plan.md.

You: Good progress. QA Reviewer, review the UX Designer's components
     for accessibility before they continue.

[QA reviews, provides feedback]

You: UX Designer, implement the accessibility fixes, then continue with
     the voting interface.

[Work continues...]

[End of day]

You: Everyone shut down. Great work today!

[Teammates shut down gracefully]

You: Clean up the team.

[Team resources cleaned up]
```

## Advanced Patterns

### Parallel Feature Development

```
Create 2 sub-teams:
Team A: UX + Architect working on spectator UI + WebSocket events
Team B: Different Architect working on AI judge integration

Have them work independently, then merge results.
```

### Spike Tasks for Research

```
Spawn a temporary research teammate to investigate Deepgram Aura-2 TTS
latency and report findings. They should shut down after delivering
the report.
```

### Rolling Reviews

```
QA Reviewer: as teammates complete work, review it immediately before
they move to the next task. Don't batch reviews - do them continuously.
```

## Token Cost Management

Agent teams use **significantly more tokens** than a single session because each teammate has its own context.

**Cost-saving strategies:**

1. **Use Haiku for simple tasks:**
   ```
   Spawn a Haiku agent to write the Docker Compose file. This is straightforward
   and doesn't need Opus/Sonnet.
   ```

2. **Shut down idle teammates:**
   ```
   UX Designer is waiting on the Architect. Shut them down and respawn later.
   ```

3. **Avoid broadcast messages:**
   ```
   # Expensive - sends to all 3 teammates
   Broadcast: Everyone read the new requirements.

   # Better - only message who needs it
   Architect: Read the new database requirements in DESIGN.md section 7.
   ```

4. **Use shared task list instead of messages:**
   - Tasks are visible to everyone
   - No need to message teammates about what to work on
   - They self-claim from the list

## Resources

- **Agent Teams Documentation:** https://code.claude.com/docs/en/agent-teams
- **MoltArena Design Doc:** `./DESIGN.md`
- **API Reference:** `./docs/API.md` (create this as you build)
- **Task List:** Press `Ctrl+T` to view in-session

## Next Steps

1. ✅ Agent teams enabled in settings
2. ✅ Design document created (DESIGN.md)
3. ⬜ Start agent team session
4. ⬜ Break down Phase 1 into tasks
5. ⬜ Assign tasks to teammates
6. ⬜ Monitor progress and coordinate
7. ⬜ Review and merge work
8. ⬜ Move to Phase 2

---

**Ready to build MoltArena with your agent team!** 🦞⚔️🤖

Start your first session:
```bash
cd ~/Documents/MoltArena
claude
# Then paste the Quick Start prompt from above
```
