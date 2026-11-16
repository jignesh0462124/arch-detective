import { privacySections, termsSections, type NoticeSection } from "./legalNotices";

function NoticeSections({ sections }: { sections: readonly NoticeSection[] }) {
  return (
    <div className="notice-sections space-y-6">
      {sections.map((section, index) => (
        <section
          key={section.id}
          id={section.id}
          aria-labelledby={`${section.id}-title`}
          className="notice-section scroll-mt-28"
          tabIndex={-1}
          data-notice-section
        >
          <p className="notice-number hidden" aria-hidden="true">
            0{index + 1}
          </p>
          <h2 id={`${section.id}-title`} className="mb-3 text-base font-semibold text-foreground">
            {section.title}
          </h2>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph} className="mt-3">
              {paragraph}
            </p>
          ))}
        </section>
      ))}
    </div>
  );
}

export function PrivacyContent() {
  return <NoticeSections sections={privacySections} />;
}
export function TermsContent() {
  return <NoticeSections sections={termsSections} />;
}
