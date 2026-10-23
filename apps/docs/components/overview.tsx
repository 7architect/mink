export function Overview() {
  return (
    <>
      <div className="mink-hero">
        <span className="mink-kicker">Your repository control center</span>
        <h1>
          Less remembering.
          <br />
          More building.
        </h1>
        <p>
          Find project commands, fill in the details, and see what happens. Mink brings scripts,
          workflows, and local services into one terminal palette.
        </p>
        <div className="mink-links">
          <a href="/quickstart/">Start with Mink →</a>
          <a href="/configuration/">Explore the configuration</a>
        </div>
      </div>

      <div className="mink-terminal">
        <div className="mink-terminal-label">~/your-project · mink</div>
        <pre>{`MINK  repository control center
Search › check

› check · Verify the project [pipeline]
api:test · Test the API [task]
scripts/qa.sh · Run quality checks [task]

↑↓ select · Enter configure · Ctrl+S services`}</pre>
      </div>

      <div className="mink-grid">
        <article>
          <h2>Start with what you have</h2>
          <p>
            Discover package scripts and shell files. Add a mink.yml when a command needs
            parameters, a clearer name, or a workflow around it.
          </p>
        </article>
        <article>
          <h2>Make the details explicit</h2>
          <p>
            Typed forms, defaults, conditions, and a preview help teammates run the same command
            with the right values.
          </p>
        </article>
        <article>
          <h2>Connect the work</h2>
          <p>
            Run dependency graphs with bounded concurrency. Reuse nested pipelines and wait for
            services to become ready.
          </p>
        </article>
        <article>
          <h2>Keep the terminal in view</h2>
          <p>
            Watch output, cancel tasks, restart local services, and return to recent commands
            without leaving the palette.
          </p>
        </article>
      </div>
    </>
  );
}
