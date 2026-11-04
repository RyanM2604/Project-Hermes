export default function EventsLoading() {
  return (
    <main className="hm-events-page hm-events-browse" aria-busy="true">
      <div className="hermes-container">
        <header className="hm-events-hero">
          <h1>Find something worth showing up for.</h1>
          <p>Events, free food, clubs, and opportunities happening around campus.</p>
        </header>

        <span className="sr-only" role="status">Loading events</span>
        <div className="hm-filter" aria-hidden="true">
          <div className="hm-filter-scroll">
            {[120, 112, 132, 130, 118].map((width, index) => (
              <div
                key={index}
                className="h-11 shrink-0 rounded-full border border-[var(--hm-line)] bg-[var(--hm-card)] motion-safe:animate-pulse"
                style={{ width }}
              />
            ))}
          </div>
        </div>

        <section className="hm-soon" aria-hidden="true">
          <div className="hm-section-heading"><h2>Starting soon</h2></div>
          <div className="hm-soon-rail">
            {[0, 1, 2].map((item) => (
              <div key={item} className="hm-soon-item motion-safe:animate-pulse">
                <div className="h-4 w-24 rounded bg-black/10" />
                <div className="space-y-3">
                  <div className="h-3 w-20 rounded bg-black/10" />
                  <div className="h-8 w-56 max-w-full rounded bg-black/10" />
                  <div className="h-4 w-32 rounded bg-black/10" />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="hm-feed" aria-hidden="true">
          <div className="hm-section-heading"><h2>All events</h2></div>
          <div className="hm-feed-list">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="hm-event-card motion-safe:animate-pulse">
                <div className="hm-event-media" />
                <div className="hm-event-body space-y-4">
                  <div className="h-3 w-28 rounded bg-[var(--hm-paper-deep)]" />
                  <div className="h-8 w-4/5 rounded bg-[var(--hm-paper-deep)]" />
                  <div className="h-4 w-2/3 rounded bg-[var(--hm-paper-deep)]" />
                  <div className="h-4 w-1/2 rounded bg-[var(--hm-paper-deep)]" />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
