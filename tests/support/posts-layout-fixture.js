function buildPostsLayoutFixture() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body>
  <main class="projects">
    <div class="container content-with-sidebar" style="width: 980px;">
      <div class="content-main">
        <ul class="grid" aria-label="Completed project list" style="grid-template-columns: repeat(2, minmax(0, 1fr));">
          <li class="card">
            <img class="thumb" src="https://example.com/featured-a.jpg" alt="Long featured image title">
            <div class="card-content">
              <div class="card-chips">
                <div class="card-type-chip card-type-chip--needlework">Crochet</div>
                <div class="card-design-source-chip card-design-source-chip--pattern">Pattern/File</div>
              </div>
              <div class="card-heading">
                <h3><a href="/posts/long-title-a">A long title that should wrap onto two lines and stop there rather than growing forever</a></h3>
                <div class="subtitle"><a href="/posts?category[]=wearables">Wearables</a></div>
              </div>
              <div class="card-excerpt">Short excerpt that still leaves room for the date to sit at the bottom of the card.</div>
              <div class="card-date caption">November 2023</div>
            </div>
          </li>
          <li class="card">
            <img class="thumb" src="https://example.com/featured-b.jpg" alt="Second featured image title">
            <div class="card-content">
              <div class="card-chips">
                <div class="card-type-chip card-type-chip--modeling">3D Print</div>
              </div>
              <div class="card-heading">
                <h3><a href="/posts/short-title-b">Short title</a></h3>
                <div class="subtitle"><a href="/posts?category[]=accessories">Accessories</a></div>
              </div>
              <div class="card-excerpt">Another excerpt that is intentionally short.</div>
              <div class="card-date caption">October 2023</div>
            </div>
          </li>
        </ul>
      </div>

      <aside class="panel posts-panel">
        <h2>Browse by</h2>
        <div class="panel-content">Browse the archive by project type, category, tag, or year.</div>
      </aside>
    </div>
  </main>
</body>
</html>`;
}

module.exports = {
  buildPostsLayoutFixture,
};
