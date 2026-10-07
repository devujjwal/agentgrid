'use client';

const prompts = ['Triage my emails', 'Plan a campaign', 'Review a code diff', 'Help me study'];

export function TaskCommand({
  query,
  onQuery,
  onPrompt,
  onExplore,
}: {
  query: string;
  onQuery: (value: string) => void;
  onPrompt: (value: string) => void;
  onExplore: () => void;
}) {
  return (
    <form
      className="command-console"
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        onExplore();
      }}
    >
      <label htmlFor="task-query" className="eyebrow">
        Your task → your agent
      </label>
      <div className="command-input">
        <span className="command-symbol" aria-hidden="true">
          ⌁
        </span>
        <input
          id="task-query"
          type="search"
          maxLength={200}
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder="Describe your task…"
          aria-describedby="task-search-help"
        />
        <button className="command-submit" type="submit" aria-label="Explore matching agents">
          ↗
        </button>
      </div>
      <p id="task-search-help" className="sr-only">
        Search the local draft catalogue by task. These resources use interactive instructions; no
        connector or background execution is implied.
      </p>
      <div className="prompt-row">
        <span className="prompt-label">Try a task</span>
        {prompts.map((prompt) => (
          <button
            type="button"
            key={prompt}
            onClick={() => {
              onPrompt(prompt);
            }}
          >
            {prompt}
            <span aria-hidden="true">↗</span>
          </button>
        ))}
      </div>
    </form>
  );
}
