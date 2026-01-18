import "./HowItWorks.css";

export function HowItWorks() {
  return (
    <div className="how-it-works">
      <div className="how-it-works-container">
        <h1>How It Works</h1>
        <div className="how-it-works-content">
          <section>
            <h2>1. Enter a Prompt</h2>
            <p>
              Describe the design you want to create. For example: "Create a login form with email
              field and submit button"
            </p>
          </section>
          <section>
            <h2>2. Generate DesignSpec</h2>
            <p>
              The API uses OpenAI to convert your prompt into a structured DesignSpec JSON object
              with frames, nodes, and layout information.
            </p>
          </section>
          <section>
            <h2>3. Use in Figma</h2>
            <p>
              Copy or download the DesignSpec JSON and use it with the Eskiz Figma plugin to create
              frames and nodes in your design.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
