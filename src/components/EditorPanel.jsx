import { useState } from "react";
export default function EditorPanel({
  data,
  changeField,
  addExperience,
  addSkill,
  removeItem,
}) {
  const [section, setSection] = useState("basics");
  const values = [
    ...Object.values(data.basics),
    data.summary,
    data.closingStatement.label,
    data.closingStatement.text,
    ...data.experience.flatMap((role) =>
      Object.values(role).map((value) =>
        Array.isArray(value) ? value.join("\n") : value,
      ),
    ),
    ...data.skills.flatMap(Object.values),
  ];
  const completion = Math.round(
    (values.filter((value) => String(value).trim()).length / values.length) *
      100,
  );
  return (
    <aside className="editor-panel" aria-label="Resume editor">
      <div className="editor-intro">
        <div>
          <p className="eyebrow">Resume editor</p>
          <h1>Shape your story.</h1>
        </div>
        <span className="completion" id="completion">
          {completion}%
        </span>
      </div>
      <div className="progress-track">
        <span id="progressBar" style={{ width: `${completion}%` }}></span>
      </div>

      <nav className="section-tabs" aria-label="Editor sections">
        <button
          className={`tab ${section === "basics" ? "active" : ""}`}
          data-target="basics"
          onClick={() => setSection("basics")}
        >
          <span>01</span> Basics
        </button>
        <button
          className={`tab ${section === "summary" ? "active" : ""}`}
          data-target="summary"
          onClick={() => setSection("summary")}
        >
          <span>02</span> Summary
        </button>
        <button
          className={`tab ${section === "experience" ? "active" : ""}`}
          data-target="experience"
          onClick={() => setSection("experience")}
        >
          <span>03</span> Experience
        </button>
        <button
          className={`tab ${section === "skills" ? "active" : ""}`}
          data-target="skills"
          onClick={() => setSection("skills")}
        >
          <span>04</span> Skills
        </button>
      </nav>

      <form id="resumeForm" onSubmit={(event) => event.preventDefault()}>
        <section
          className={`form-section ${section === "basics" ? "active" : ""}`}
          data-section="basics"
        >
          <div className="section-heading">
            <h2>Personal details</h2>
            <p>The essentials hiring teams need.</p>
          </div>
          <label>
            Full name
            <input
              name="basics.name"
              value={data.basics.name}
              onChange={changeField}
              autoComplete="name"
            />
          </label>
          <label>
            Professional title
            <input
              name="basics.title"
              value={data.basics.title}
              onChange={changeField}
            />
          </label>
          <label>
            Header label
            <input
              name="basics.documentLabel"
              value={data.basics.documentLabel}
              onChange={changeField}
              placeholder="e.g. Curriculum Vitae, Résumé, Professional Profile"
            />
          </label>
          <label>
            Specialties
            <input
              name="basics.tagline"
              value={data.basics.tagline}
              onChange={changeField}
            />
          </label>
          <div className="field-row">
            <label>
              Location
              <input
                name="basics.location"
                value={data.basics.location}
                onChange={changeField}
                autoComplete="address-level2"
              />
            </label>
            <label>
              Phone
              <input
                name="basics.phone"
                value={data.basics.phone}
                onChange={changeField}
                autoComplete="tel"
              />
            </label>
          </div>
          <label>
            Email
            <input
              name="basics.email"
              value={data.basics.email}
              onChange={changeField}
              type="email"
              autoComplete="email"
            />
          </label>
          <label>
            Portfolio
            <input
              name="basics.portfolio"
              value={data.basics.portfolio}
              onChange={changeField}
              autoComplete="url"
            />
          </label>
        </section>

        <section
          className={`form-section ${section === "summary" ? "active" : ""}`}
          data-section="summary"
        >
          <div className="section-heading">
            <h2>Professional summary</h2>
            <p>Keep it direct, specific, and human.</p>
          </div>
          <label>
            Summary
            <textarea
              name="summary"
              value={data.summary}
              onChange={changeField}
              rows="10"
            ></textarea>
            <span className="field-hint">
              <span id="summaryCount">{data.summary.length}</span> characters
            </span>
          </label>
          <div className="tip">
            <span>✦</span>
            <p>
              <strong>Make the first scan count.</strong> Lead with scope,
              strengths, and the business outcomes you repeatedly create.
            </p>
          </div>
          <div className="closing-editor">
            <div className="closing-editor-heading">
              <div>
                <h3>Closing statement</h3>
                <p>An optional final value proposition.</p>
              </div>
              <label className="toggle">
                <input
                  type="checkbox"
                  name="closingStatement.enabled"
                  checked={data.closingStatement.enabled}
                  onChange={changeField}
                />
                <span></span>
                <em>Show</em>
              </label>
            </div>
            <div
              className={`closing-editor-fields ${data.closingStatement.enabled ? "" : "disabled"}`}
              id="closingEditorFields"
            >
              <label>
                Label
                <input
                  name="closingStatement.label"
                  value={data.closingStatement.label}
                  onChange={changeField}
                  placeholder="e.g. What I bring, Leadership approach"
                />
              </label>
              <label>
                Statement
                <textarea
                  name="closingStatement.text"
                  value={data.closingStatement.text}
                  onChange={changeField}
                  rows="4"
                  placeholder="A concise, role-specific statement that adds something new."
                ></textarea>
              </label>
            </div>
          </div>
        </section>

        <section
          className={`form-section ${section === "experience" ? "active" : ""}`}
          data-section="experience"
        >
          <div className="section-heading section-heading-action">
            <div>
              <h2>Experience</h2>
              <p>Your recent roles carry the most weight.</p>
            </div>
            <button
              className="add-button"
              type="button"
              id="addExperienceButton"
              onClick={addExperience}
            >
              <span>+</span> Add role
            </button>
          </div>
          <div id="experienceFields">
            {data.experience.map((role, index) => (
              <fieldset className="role-card" key={index}>
                <legend>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  {role.company || "New role"}
                </legend>
                <button
                  className="remove-button"
                  type="button"
                  data-remove-experience={index}
                  aria-label={`Remove ${role.company || "role"}`}
                  onClick={() => removeItem("experience", index)}
                >
                  Remove
                </button>
                <label>
                  Company
                  <input
                    name={`experience.${index}.company`}
                    value={role.company}
                    onChange={changeField}
                  />
                </label>
                <label>
                  Role
                  <input
                    name={`experience.${index}.role`}
                    value={role.role}
                    onChange={changeField}
                  />
                </label>
                <div className="field-row">
                  <label>
                    Dates
                    <input
                      name={`experience.${index}.dates`}
                      value={role.dates}
                      onChange={changeField}
                    />
                  </label>
                  <label>
                    Location
                    <input
                      name={`experience.${index}.location`}
                      value={role.location}
                      onChange={changeField}
                    />
                  </label>
                </div>
                <label>
                  Highlights
                  <textarea
                    name={`experience.${index}.bullets`}
                    value={role.bullets.join("\n")}
                    onChange={changeField}
                    rows="7"
                  />
                  <span className="field-hint">One achievement per line</span>
                </label>
              </fieldset>
            ))}
          </div>
        </section>

        <section
          className={`form-section ${section === "skills" ? "active" : ""}`}
          data-section="skills"
        >
          <div className="section-heading section-heading-action">
            <div>
              <h2>Core competencies</h2>
              <p>Use the language your target roles use.</p>
            </div>
            <button
              className="add-button"
              type="button"
              id="addSkillButton"
              onClick={addSkill}
            >
              <span>+</span> Add group
            </button>
          </div>
          <div id="skillFields">
            {data.skills.map((skill, index) => (
              <div className="skill-field" key={index}>
                <button
                  className="remove-button"
                  type="button"
                  data-remove-skill={index}
                  aria-label={`Remove ${skill.category || "skill group"}`}
                  onClick={() => removeItem("skills", index)}
                >
                  Remove
                </button>
                <label>
                  Category
                  <input
                    name={`skills.${index}.category`}
                    value={skill.category}
                    onChange={changeField}
                  />
                </label>
                <label>
                  Skills
                  <input
                    name={`skills.${index}.items`}
                    value={skill.items}
                    onChange={changeField}
                  />
                </label>
              </div>
            ))}
          </div>
        </section>
      </form>
    </aside>
  );
}
