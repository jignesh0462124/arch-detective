import { MarketingFooter, MarketingHeader } from "./MarketingChrome";
import { ReviewWorkflow } from "./ReviewWorkflow";
import "./public-pages.css";

const members = ["Jignesh Sonewane", "Soham Pashine", "Bhargav Bawane"];

export function TeamPage() {
  return (
    <div className="public-page" data-public-page="team">
      <MarketingHeader current="team" />
      <main className="public-container">
        <section className="team-introduction" aria-labelledby="team-title">
          <div className="team-story">
            <p className="public-eyebrow">Our team</p>
            <h1 id="team-title">
              The team behind <span>Archon.</span>
            </h1>
            <p className="public-intro">
              A college project built to make source-code security reviews easier to understand.
            </p>
            <p className="team-college">G. H. Raisoni College of Engineering, Nagpur</p>
          </div>
          <figure className="team-photograph">
            <div className="team-photo-frame">
              <img
                src="/assets/team/project-seminar-original.jpeg"
                alt="Group photograph of the project seminar participants and faculty, as supplied by the team"
                width={1600}
                height={1046}
                loading="eager"
                fetchPriority="high"
                decoding="async"
              />
            </div>
            <figcaption>
              <strong>First prize · Project seminar</strong>
              <span>Team and faculty · Original photograph supplied by the project team</span>
            </figcaption>
          </figure>
        </section>
        <section className="team-roster" aria-labelledby="project-team-title">
          <h2 id="project-team-title" className="public-section-title">
            Project team
          </h2>
          <ul className="team-members">
            {members.map((name) => (
              <li key={name}>
                <h3>{name}</h3>
                <p>Project team member</p>
              </li>
            ))}
          </ul>
          <div className="team-guide">
            <h3>Professor Pankaj Sonewane</h3>
            <p>Project guide · DIC Department</p>
          </div>
        </section>
        <ReviewWorkflow />
      </main>
      <MarketingFooter current="team" />
    </div>
  );
}
