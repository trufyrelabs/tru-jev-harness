export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <div className="site-brand-row">
          <a
            className="site-brand"
            href="https://trufyre.ai/"
            target="_blank"
            rel="noreferrer"
            aria-label="TruFyre home"
          >
            <img
              className="site-brand-logo"
              src="/trufyre-lockup.png"
              alt="TruFyre"
              width={220}
              height={66}
            />
          </a>
          <span className="product-chip">Jev Harness</span>
        </div>

        <a
          className="book-call"
          href="https://trufyre.ai/"
          target="_blank"
          rel="noreferrer"
        >
          <span className="book-call-label">Book a call</span>
          <span className="book-call-divider" aria-hidden="true" />
          <span className="book-call-icon" aria-hidden="true">
            ↗
          </span>
        </a>
      </div>
    </header>
  );
}
