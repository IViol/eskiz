import "./About.css";

export function About() {
  return (
    <div className="about">
      <div className="about-container">
        <h1>About Eskiz</h1>
        <div className="about-content">
          <p>
            Eskiz is a tool for generating structured DesignSpecs from text prompts. It uses OpenAI
            to convert natural language descriptions into JSON specifications that can be executed
            in Figma via a plugin.
          </p>
          <p>
            The Figma REST API cannot create frames or design elements programmatically. Eskiz
            generates DesignSpecs that a Figma plugin can consume to create frames, nodes, and
            layouts within Figma's plugin runtime.
          </p>
          <h2>Limitations (v0)</h2>
          <ul>
            <li>Supports only text and button node types</li>
            <li>Simple vertical and horizontal layouts only</li>
            <li>Figma plugin execution logic coming soon</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
